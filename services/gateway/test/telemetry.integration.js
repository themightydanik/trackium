import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import net from 'node:net';
import { once } from 'node:events';
import { initialize, persistPacket } from '../src/journal.js';
import { migrate } from '../src/telemetry/migrate.js';
import { provisionTenant, issueKey, createTelemetryService } from '../src/telemetry/service.js';
import { createTelemetryApi } from '../src/telemetry/api.js';
import { createGateway } from '../src/gateway.js';
import { readConfig } from '../src/config.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required; use a disposable PostgreSQL database');
const sample = (id = 'sample-1', at = '2026-11-07T12:00:00.000Z') => ({
  schema_version: 1,
  source_event_id: id,
  occurred_at: at,
  gps: { latitude: 50, longitude: 30 },
  temperature_c: 20,
  humidity_pct: 40,
  battery_pct: 70,
  status: 'moving',
  extra: { door_open: false }
});

test(
  'Telemetry Core: PostgreSQL migrations and tenant-isolated HTTP API',
  { timeout: 20000 },
  async (t) => {
    const schema = 'telemetry_test_' + randomUUID().replaceAll('-', '');
    const admin = new pg.Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    let gateway;
    t.after(async () => {
      try {
        if (gateway) await gateway.shutdown();
        else await db.end();
      } finally {
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      }
    });
    await initialize(db);
    const raw = await persistPacket(
      { payload: Buffer.from('existing-raw-packet'), remoteAddress: '127.0.0.1' },
      db
    );
    await t.test(
      'additive migration is concurrent-safe, repeatable and preserves existing raw journal',
      async () => {
        await Promise.all([migrate(db), migrate(db)]);
        assert.equal(
          (await db.query('SELECT count(*) FROM gateway_schema_migrations')).rows[0].count,
          '1'
        );
        assert.equal(
          (
            await db.query('SELECT raw_payload FROM gateway_packets WHERE id=$1', [raw.id])
          ).rows[0].raw_payload.toString(),
          'existing-raw-packet'
        );
        const checksum = (
          await db.query('SELECT checksum FROM gateway_schema_migrations WHERE version=1')
        ).rows[0].checksum;
        await db.query("UPDATE gateway_schema_migrations SET checksum='tampered' WHERE version=1");
        await assert.rejects(migrate(db), /checksum mismatch/);
        await db.query('UPDATE gateway_schema_migrations SET checksum=$1 WHERE version=1', [
          checksum
        ]);
      }
    );
    const a = await provisionTenant(db, 'tenant A'),
      b = await provisionTenant(db, 'tenant B');
    const readOnly = await issueKey(db, a.tenant_id, ['read']);
    let fixtureEnabled = true;
    const service = createTelemetryService(db);
    const handler = (req, res) =>
      createTelemetryApi(service, { fixturesEnabled: fixtureEnabled, logger: { error() {} } })(
        req,
        res
      );
    gateway = createGateway({
      config: { ...readConfig({ DATABASE_URL: url }), host: '127.0.0.1', tcpPort: 0, httpPort: 0 },
      journal: {
        initialize: () => migrate(db),
        persistPacket: (p) => persistPacket(p, db),
        checkReady: () => db.query('SELECT 1'),
        close: () => db.end()
      },
      requestHandler: handler
    });
    await gateway.start();
    const request = async (
      path,
      { token = a.token, method = 'GET', body, rawBody, headers = {} } = {}
    ) => {
      const response = await fetch(`http://127.0.0.1:${gateway.api.address().port}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined || rawBody !== undefined
            ? { 'content-type': 'application/json' }
            : {}),
          ...headers
        },
        body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
      });
      return { status: response.status, body: await response.json() };
    };
    let device, foreign, real;
    await t.test(
      'requires authentication and registers server-generated identities bound only to authenticated tenant',
      async () => {
        assert.equal((await request('/v1/devices', { token: null })).status, 401);
        assert.equal((await request('/v1/devices', { token: 'x'.repeat(43) })).status, 401);
        assert.equal(
          (
            await request('/v1/devices', {
              method: 'POST',
              body: { label: 'spoof', mode: 'synthetic', tenant_id: b.tenant_id }
            })
          ).status,
          400
        );
        device = (
          await request('/v1/devices', {
            method: 'POST',
            body: { label: 'fixture device', mode: 'synthetic' }
          })
        ).body;
        foreign = (
          await request('/v1/devices', {
            token: b.token,
            method: 'POST',
            body: { label: 'other tenant', mode: 'synthetic' }
          })
        ).body;
        real = (
          await request('/v1/devices', {
            method: 'POST',
            body: { label: 'unverified hardware', mode: 'real' }
          })
        ).body;
        assert.equal(device.tenant_id, a.tenant_id);
        assert.match(device.id, /^[0-9a-f-]{36}$/);
        assert.equal(
          (
            await db.query('SELECT tenant_id FROM telemetry_device_bindings WHERE device_id=$1', [
              device.id
            ])
          ).rows[0].tenant_id,
          a.tenant_id
        );
        assert.equal(
          (
            await request('/v1/devices', {
              token: readOnly.token,
              method: 'POST',
              body: { label: 'no', mode: 'synthetic' }
            })
          ).status,
          403
        );
      }
    );
    const fixturePath = (id) => `/v1/fixtures/devices/${id}/events`;
    await t.test(
      'tenant isolation covers list, detail, history, status, location, mutation and fixtures',
      async () => {
        const list = await request('/v1/devices');
        assert.equal(list.body.devices.length, 2);
        assert.ok(list.body.devices.every((d) => d.tenant_id === a.tenant_id));
        for (const suffix of ['', '/events', '/location', '/status'])
          assert.equal((await request(`/v1/devices/${foreign.id}${suffix}`)).status, 404);
        assert.equal(
          (
            await request(`/v1/devices/${foreign.id}`, {
              method: 'PATCH',
              body: { enabled: false }
            })
          ).status,
          404
        );
        assert.equal(
          (await request(fixturePath(foreign.id), { method: 'POST', body: sample() })).status,
          404
        );
        assert.equal((await request('/v1/devices?tenant_id=' + b.tenant_id)).status, 400);
        assert.equal(
          (
            await request(fixturePath(device.id), {
              token: readOnly.token,
              method: 'POST',
              body: sample()
            })
          ).status,
          403
        );
      }
    );
    await t.test(
      'fixtures require explicit enablement, cannot target real devices or claim packet identity',
      async () => {
        fixtureEnabled = false;
        assert.equal(
          (await request(fixturePath(device.id), { method: 'POST', body: sample() })).status,
          404
        );
        fixtureEnabled = true;
        assert.equal(
          (await request(fixturePath(real.id), { method: 'POST', body: sample() })).status,
          403
        );
        assert.equal(
          (
            await request(fixturePath(device.id), {
              method: 'POST',
              body: { ...sample(), device_id: real.id }
            })
          ).status,
          400
        );
      }
    );
    await t.test(
      'atomic concurrent deduplication preserves raw fixture once, rejects conflicting replay',
      async () => {
        const results = await Promise.all([
          request(fixturePath(device.id), { method: 'POST', body: sample() }),
          request(fixturePath(device.id), { method: 'POST', body: sample() })
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
        assert.equal(results[0].body.id, results[1].body.id);
        assert.equal(
          (
            await request(fixturePath(device.id), {
              method: 'POST',
              body: { ...sample(), battery_pct: 1 }
            })
          ).status,
          409
        );
        assert.equal(
          (await db.query('SELECT count(*) FROM telemetry_fixture_inputs')).rows[0].count,
          '1'
        );
        const row = (await db.query('SELECT * FROM telemetry_events')).rows[0];
        assert.equal(row.trust, 'synthetic');
        assert.equal(row.raw_packet_id, null);
        assert.equal(row.payload.device_id, device.id);
        assert.equal(
          createHash('sha256').update(row.canonical_event).digest('hex'),
          row.canonical_sha256
        );
        assert.equal((await db.query('SELECT count(*) FROM gateway_packets')).rows[0].count, '1');
      }
    );
    await t.test(
      'history is ordered by event time, paginated; location survives newer GPS-less event',
      async () => {
        await request(fixturePath(device.id), {
          method: 'POST',
          body: sample('older', '2026-11-06T12:00:00.000Z')
        });
        await request(fixturePath(device.id), {
          method: 'POST',
          body: { ...sample('newer', '2026-11-08T12:00:00.000Z'), gps: null, status: 'alarm' }
        });
        const first = await request(`/v1/devices/${device.id}/events?limit=1`);
        assert.equal(first.body.events[0].payload.source_event_id, 'newer');
        assert.ok(first.body.next_cursor);
        const next = await request(
          `/v1/devices/${device.id}/events?limit=1&cursor=${first.body.next_cursor}`
        );
        assert.equal(next.body.events[0].payload.source_event_id, 'sample-1');
        assert.equal((await request(`/v1/devices/${device.id}/status`)).body.status, 'alarm');
        assert.equal(
          (await request(`/v1/devices/${device.id}/location`)).body.location.occurred_at,
          '2026-11-07T12:00:00.000Z'
        );
        assert.equal((await request(`/v1/devices/${device.id}/events?limit=201`)).status, 400);
        assert.equal((await request(`/v1/devices/${device.id}/events?cursor=invalid`)).status, 400);
      }
    );
    await t.test(
      'database constraints reject tenant mixing and event failure rolls back fixture provenance',
      async () => {
        const event = (await db.query('SELECT * FROM telemetry_events LIMIT 1')).rows[0];
        await assert.rejects(
          db.query(
            `INSERT INTO telemetry_events(id,tenant_id,device_id,schema_version,source,trust,source_event_id,occurred_at,payload,canonical_event,canonical_sha256,fixture_input_id)
      VALUES($1,$2,$3,1,'fixture-v1','synthetic','cross-tenant',now(),'{}','{}',$4,$5)`,
            [randomUUID(), b.tenant_id, device.id, event.canonical_sha256, event.fixture_input_id]
          ),
          { code: '23503' }
        );
        const before = (await db.query('SELECT count(*) FROM telemetry_fixture_inputs')).rows[0]
          .count;
        await db.query(`CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected insert failure'; END $$;
      CREATE TRIGGER reject_test_event BEFORE INSERT ON telemetry_events FOR EACH ROW EXECUTE FUNCTION reject_test_event()`);
        try {
          assert.equal(
            (
              await request(fixturePath(device.id), {
                method: 'POST',
                body: sample('will-rollback')
              })
            ).status,
            503
          );
        } finally {
          await db.query(
            'DROP TRIGGER reject_test_event ON telemetry_events; DROP FUNCTION reject_test_event()'
          );
        }
        assert.equal(
          (await db.query('SELECT count(*) FROM telemetry_fixture_inputs')).rows[0].count,
          before
        );
      }
    );
    await t.test(
      'invalid requests, disabled devices and revoked API keys fail closed',
      async () => {
        assert.equal(
          (await request(fixturePath(device.id), { method: 'POST', rawBody: '{bad' })).status,
          400
        );
        assert.equal(
          (await request(fixturePath(device.id), { method: 'POST', rawBody: 'x'.repeat(16385) }))
            .status,
          413
        );
        assert.equal(
          (
            await request(fixturePath(device.id), {
              method: 'POST',
              body: sample(),
              headers: { 'content-type': 'text/plain' }
            })
          ).status,
          415
        );
        assert.equal(
          (await request(`/v1/devices/${device.id}`, { method: 'PATCH', body: { enabled: false } }))
            .status,
          200
        );
        assert.equal(
          (await request(fixturePath(device.id), { method: 'POST', body: sample('disabled') }))
            .status,
          403
        );
        await db.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1', [readOnly.id]);
        assert.equal((await request('/v1/devices', { token: readOnly.token })).status, 401);
        assert.equal(
          (await db.query('SELECT token_hash FROM telemetry_api_keys WHERE id=$1', [a.id])).rows[0]
            .token_hash,
          createHash('sha256').update(a.token).digest('hex')
        );
      }
    );
    await t.test(
      'TCP synthetic-looking data stays only in untrusted original raw journal',
      async () => {
        const socket = net.connect(gateway.tcp.address().port, '127.0.0.1');
        await once(socket, 'connect');
        const closed = once(socket, 'close');
        socket.end(JSON.stringify({ ...sample(), device_id: device.id }) + '\n');
        await closed;
        // Wait for accepted writes via the gateway shutdown before checking retained rows.
        const before = (await db.query('SELECT count(*) FROM telemetry_events')).rows[0].count;
        assert.equal(before, '3');
        const deadline = Date.now() + 1000;
        while ((await db.query('SELECT count(*) FROM gateway_packets')).rows[0].count !== '2') {
          if (Date.now() > deadline) throw new Error('TCP journal write timed out');
          await new Promise((r) => setTimeout(r, 5));
        }
        assert.equal((await db.query('SELECT count(*) FROM telemetry_events')).rows[0].count, '3');
      }
    );
  }
);
