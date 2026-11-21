import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import net from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { initialize, persistPacket } from '../src/journal.js';
import { migrate } from '../src/telemetry/migrate.js';
import { provisionTenant, issueKey, createTelemetryService } from '../src/telemetry/service.js';
import { createTelemetryApi } from '../src/telemetry/api.js';
import { createGateway } from '../src/gateway.js';
import { createAovxIngestion } from '../src/aovx/ingestion.js';
import { encodeAovxFrame } from '../src/aovx/frame.js';
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
  { timeout: 120000 },
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
          (await db.query('SELECT count(*) FROM gateway_schema_migrations WHERE version=1')).rows[0].count,
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
    await t.test(
      'AOVX enrollment is admin-only, tenant-scoped, physical-only and revocable',
      async () => {
        const bPhysical = (
          await request('/v1/devices', {
            token: b.token,
            method: 'POST',
            body: { label: 'tenant B physical', mode: 'real' }
          })
        ).body;
        assert.equal(
          (await request('/v1/aovx/devices', { token: null })).status,
          401
        );
        assert.equal(
          (await request('/v1/aovx/devices', {
            token: readOnly.token,
            method: 'POST',
            body: { device_id: real.id, device_id_bcd: '944063243931' }
          })).status,
          403
        );
        assert.equal(
          (await request('/v1/aovx/devices', {
            method: 'POST',
            body: { device_id: device.id, device_id_bcd: '944063243931' }
          })).status,
          409
        );
        assert.equal(
          (await request('/v1/aovx/devices', {
            method: 'POST',
            body: { device_id: real.id, device_id_bcd: '94406324393x' }
          })).status,
          400
        );
        const binding = await request('/v1/aovx/devices', {
          method: 'POST',
          body: { device_id: real.id, device_id_bcd: '944063243931' }
        });
        assert.equal(binding.status, 201);
        assert.equal(binding.body.device_id, real.id);
        assert.equal(binding.body.tenant_id, a.tenant_id);
        assert.equal(binding.body.trust, 'unverified');
        assert.equal(binding.body.state, 'active');
        assert.equal(
          (await request('/v1/aovx/devices', {
            token: b.token,
            method: 'POST',
            body: { device_id: bPhysical.id, device_id_bcd: '944063243931' }
          })).status,
          409
        );
        const listed = await request('/v1/aovx/devices');
        assert.equal(listed.status, 200);
        assert.equal(listed.body.devices.length, 1);
        assert.equal(listed.body.devices[0].device_id_bcd, '944063243931');
        assert.equal(
          (await request('/v1/aovx/devices', { token: readOnly.token })).status,
          200
        );
        const revoked = await request('/v1/aovx/devices/944063243931', { method: 'DELETE' });
        assert.equal(revoked.status, 200);
        assert.equal(revoked.body.state, 'revoked');
        assert.ok(revoked.body.revoked_at);
        assert.equal(
          (await request('/v1/aovx/devices/944063243931', { method: 'DELETE' })).status,
          404
        );
        assert.equal(
          (await db.query('SELECT count(*) FROM telemetry_aovx_device_bindings WHERE state=\'revoked\'')).rows[0].count,
          '1'
        );
      }
    );
    await t.test(
      'AOVX packets become unverified tenant telemetry only through an active binding; exact repeats are idempotent',
      async () => {
        const rebound = await request('/v1/aovx/devices', {
          method: 'POST',
          body: { device_id: real.id, device_id_bcd: '944063243931' }
        });
        assert.equal(rebound.status, 201);
        const body = Buffer.alloc(40);
        body.writeUInt32BE(0x00010000, 0);
        body.writeUInt32BE(0x00000012, 4);
        Buffer.from('261119163552', 'hex').copy(body, 22);
        const wire = encodeAovxFrame({
          messageId: 0x0200,
          deviceIdBcd: Buffer.from('944063243931', 'hex'),
          sequenceNumber: 7,
          body
        });
        const persist = () => persistPacket({
          payload: wire,
          remoteAddress: '127.0.0.1',
          aovx: {
            messageId: 0x0200, deviceIdBcd: '944063243931',
            sequenceNumber: 7, checksumStatus: 'xor-match',
            parseStatus: 'parsed', parsedPayload: {}
          }
        }, db);
        const ingestion = createAovxIngestion(db, { batchSize: 1, logger: { error() {} } });
        const first = await persist();
        const duplicate = await persist();
        const recovery = await ingestion.processPending();
        assert.equal(recovery.processed, 1);
        const result = await ingestion.processPacket(first.id);
        assert.equal(result.processed, false);
        assert.equal(result.reason, 'not-pending');
        assert.equal(
          (await db.query('SELECT aovx_processing_state FROM gateway_packets WHERE id=$1', [duplicate.id])).rows[0].aovx_processing_state,
          'pending'
        );
        const repeated = await ingestion.processPacket(duplicate.id);
        assert.equal(repeated.processed, true);
        assert.equal(repeated.duplicate, true);
        const events = await db.query(
          "SELECT * FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2 AND source='aovx-gal-v1'",
          [a.tenant_id, real.id]
        );
        assert.equal(events.rowCount, 1);
        assert.equal(events.rows[0].trust, 'unverified');
        assert.equal(events.rows[0].event_time_basis, 'gateway_received_at');
        assert.equal(events.rows[0].device_time_raw, '261119163552');
        assert.equal(events.rows[0].payload.gps, null);
        assert.equal(events.rows[0].payload.temperature_c, null);
        assert.equal(
          (await db.query('SELECT count(*) FROM telemetry_aovx_packet_events WHERE event_id=$1', [events.rows[0].id])).rows[0].count,
          '2'
        );

        const variantBody = Buffer.from(body);
        variantBody.writeUInt32BE(0x00000092, 4);
        const variantWire = encodeAovxFrame({
          messageId: 0x0200,
          deviceIdBcd: Buffer.from('944063243931', 'hex'),
          sequenceNumber: 7,
          body: variantBody
        });
        const variantPacket = await persistPacket({
          payload: variantWire, remoteAddress: '127.0.0.1',
          aovx: { messageId: 0x0200, deviceIdBcd: '944063243931', sequenceNumber: 7,
            checksumStatus: 'xor-match', parseStatus: 'parsed', parsedPayload: {} }
        }, db);
        await ingestion.processPacket(variantPacket.id);
        assert.equal(
          (await db.query("SELECT count(*) FROM telemetry_events WHERE source='aovx-gal-v1' AND tenant_id=$1", [a.tenant_id])).rows[0].count,
          '2'
        );

        await request('/v1/aovx/devices/944063243931', { method: 'DELETE' });
        const unbound = await persistPacket({
          payload: encodeAovxFrame({
            messageId: 0x0200, deviceIdBcd: Buffer.from('944063243931', 'hex'),
            sequenceNumber: 8, body
          }),
          aovx: { messageId: 0x0200, deviceIdBcd: '944063243931', sequenceNumber: 8,
            checksumStatus: 'xor-match', parseStatus: 'parsed', parsedPayload: {} }
        }, db);
        const unboundResult = await ingestion.processPacket(unbound.id);
        assert.equal(unboundResult.reason, 'unbound');
        assert.equal(
          (await db.query('SELECT aovx_processing_state FROM gateway_packets WHERE id=$1', [unbound.id])).rows[0].aovx_processing_state,
          'unbound'
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
        const row = (await db.query("SELECT * FROM telemetry_events WHERE source='fixture-v1'")).rows[0];
        assert.equal(row.trust, 'synthetic');
        assert.equal(row.raw_packet_id, null);
        assert.equal(row.payload.device_id, device.id);
        assert.equal(
          createHash('sha256').update(row.canonical_event).digest('hex'),
          row.canonical_sha256
        );
        assert.equal((await db.query('SELECT count(*) FROM gateway_packets')).rows[0].count, '5');
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
        const event = (await db.query("SELECT * FROM telemetry_events WHERE source='fixture-v1' LIMIT 1")).rows[0];
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
        assert.equal(before, '5');
        const deadline = Date.now() + 1000;
        while ((await db.query('SELECT count(*) FROM gateway_packets')).rows[0].count !== '6') {
          if (Date.now() > deadline) throw new Error('TCP journal write timed out');
          await new Promise((r) => setTimeout(r, 5));
        }
        assert.equal((await db.query('SELECT count(*) FROM telemetry_events')).rows[0].count, '5');
      }
    );
    await t.test('operator CLI completes tenant-scoped AOVX enrollment and revoke', async (t) => {
      const reader = await issueKey(db, a.tenant_id, ['read']);
      const directory = await mkdtemp(join(tmpdir(), 'trackium-enrollment-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const [ownerFile, readerFile, foreignFile] = await Promise.all(
        [a, reader, b].map(async (key, index) => {
          const file = join(directory, index + '.json');
          await writeFile(file, JSON.stringify(key), { mode: 0o600 });
          return file;
        })
      );
      const origin = 'http://127.0.0.1:' + gateway.api.address().port;
      const cli = fileURLToPath(new URL('../scripts/aovx-enrollment.mjs', import.meta.url));
      const execute = promisify(execFile);
      const call = (credential, command, args = [], base = origin) => execute(process.execPath,
        [cli, command, '--origin=' + base, '--credential-file=' + credential, ...args],
        { timeout: 15000 });
      const run = async (...args) => {
        const { stdout, stderr } = await call(...args);
        assert.equal(stderr, '');
        for (const { token } of [a, b, reader]) assert.ok(!stdout.includes(token));
        return JSON.parse(stdout);
      };
      const rejected = (operation, message) => assert.rejects(operation, error => {
        assert.equal(error.code, 1);
        assert.equal(error.stdout, '');
        for (const { token } of [a, b, reader]) assert.ok(!error.stderr.includes(token));
        assert.match(error.stderr, message);
        return true;
      });

      const device = await run(ownerFile, 'register', ['--label=Owner CLI test tracker']);
      assert.equal(device.tenant_id, a.tenant_id);
      assert.equal(device.mode, 'real');
      assert.equal(device.identity_kind, 'physical');
      const bcd = '012345678901';
      const args = ['--device=' + device.id, '--bcd=' + bcd];
      await rejected(call(ownerFile, 'bind', ['--device=' + device.id, '--bcd=01234567890x']),
        /exactly 12 decimal protocol digits/);
      await rejected(call(readerFile, 'register', ['--label=Denied']), /HTTP 403/);
      await rejected(call(readerFile, 'bind', args), /HTTP 403/);
      await rejected(call(foreignFile, 'bind', args), /HTTP 404/);
      const binding = await run(ownerFile, 'bind', args);
      assert.equal(binding.device_id_bcd, bcd);
      assert.equal(binding.device_id, device.id);
      assert.equal(binding.trust, 'unverified');
      assert.equal(binding.state, 'active');
      await rejected(call(ownerFile, 'bind', args), /HTTP 409/);
      assert.ok((await run(readerFile, 'list')).devices.some(row => row.id === binding.id));
      assert.ok(!(await run(foreignFile, 'list')).devices.some(row => row.id === binding.id));
      await rejected(call(foreignFile, 'revoke', ['--bcd=' + bcd]), /HTTP 404/);
      await rejected(call(readerFile, 'revoke', ['--bcd=' + bcd]), /HTTP 403/);
      const revoked = await run(ownerFile, 'revoke', ['--bcd=' + bcd]);
      assert.equal(revoked.id, binding.id);
      assert.equal(revoked.state, 'revoked');
      assert.ok((await run(ownerFile, 'list')).devices.some(row =>
        row.id === binding.id && row.state === 'revoked'
      ));
      await rejected(call(ownerFile, 'revoke', ['--bcd=' + bcd]), /HTTP 404/);
      const rebound = await run(ownerFile, 'bind', args);
      assert.equal(rebound.state, 'active');
      assert.notEqual(rebound.id, binding.id);
    });
    await t.test('operator CLI rejects unsafe origins, credential files and redirects', async (t) => {
      const directory = await mkdtemp(join(tmpdir(), 'trackium-enrollment-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const credential = join(directory, 'key.json');
      await writeFile(credential, JSON.stringify(a), { mode: 0o600 });
      const cli = fileURLToPath(new URL('../scripts/aovx-enrollment.mjs', import.meta.url));
      const execute = promisify(execFile);
      const list = (base, file = credential) => execute(process.execPath,
        [cli, 'list', '--origin=' + base, '--credential-file=' + file], { timeout: 15000 });
      for (const base of ['http://example.com', 'https://user:secret@example.com',
        'https://example.com/v1', 'https://example.com/?token=secret'])
        await assert.rejects(list(base), /Supply the Gateway HTTPS origin/);
      const origin = 'http://127.0.0.1:' + gateway.api.address().port;
      await chmod(credential, 0o644);
      await assert.rejects(list(origin), /chmod 600/);
      await chmod(credential, 0o600);
      const linked = join(directory, 'linked.json');
      await symlink(credential, linked);
      await assert.rejects(list(origin, linked), /regular credential JSON file/);

      let requests = 0;
      const redirect = createServer((req, res) => {
        requests++;
        res.writeHead(302, { location: '/somewhere-else' });
        res.end();
      });
      redirect.listen(0, '127.0.0.1');
      await once(redirect, 'listening');
      t.after(() => new Promise(resolve => redirect.close(resolve)));
      await assert.rejects(list('http://127.0.0.1:' + redirect.address().port),
        /Gateway request failed/);
      assert.equal(requests, 1, 'the CLI never forwards a credential to a redirect destination');
    });
  }
);
