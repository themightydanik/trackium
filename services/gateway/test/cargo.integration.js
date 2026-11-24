import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect as connectTcp } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { provisionTenant, issueKey } from '../src/telemetry/service.js';
import { canonicalize } from '../src/telemetry/schema.js';
import { createIntegritas } from '../src/proofs/integritas.js';
import { ingestSynthetic } from '../src/cargo/ingestion.js';
import { transaction, tenantLock, hash } from '../src/cargo/shared.js';
import { claimOutbox, acknowledge, retry } from '../src/cargo/outbox.js';
import { decodeAovxFrame, encodeAovxFrame } from '../src/aovx/frame.js';
import { persistPacket } from '../src/journal.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required (disposable database)');
const silent = { error() {}, warn() {} };
test(
  'Cargo: migrations, authenticated pipeline, durable simulation, sessions and outbox',
  { timeout: 30000 },
  async (t) => {
    const schema = 'cargo_test_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: url });
    await admin.query('CREATE SCHEMA ' + schema);
    const connect = () =>
      new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
    let db = connect();
    const config = {
      ...readConfig({ DATABASE_URL: url }),
      host: '127.0.0.1',
      tcpPort: 0,
      httpPort: 0,
      webEnabled: true,
      simulatorEnabled: true,
      fixturesEnabled: true
    };
    let runtime = createRuntime(db, config, { worker: false, logger: silent });
    await runtime.gateway.start();
    config.httpPort = runtime.gateway.api.address().port;
    config.publicOrigin = 'http://127.0.0.1:' + config.httpPort;
    t.after(async () => {
      try {
        await runtime.gateway.shutdown();
      } finally {
        await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
        await admin.end();
      }
    });
    const a = await provisionTenant(db, 'tenant A'),
      b = await provisionTenant(db, 'tenant B'),
      reader = await issueKey(db, a.tenant_id, ['read']);
    let cookie = '',
      csrf = '';
    const req = async (
      path,
      {
        method = 'GET',
        body,
        token = a.token,
        browser = false,
        origin = config.publicOrigin,
        headers = {}
      } = {}
    ) => {
      const response = await fetch(config.publicOrigin + path, {
        method,
        headers: {
          ...(token && !browser ? { authorization: 'Bearer ' + token } : {}),
          ...(browser
            ? {
                host: new URL(config.publicOrigin).host,
                'sec-fetch-site': 'same-origin',
                origin,
                'x-trackium-client': 'cargo-v2',
                cookie,
                'x-csrf-token': csrf
              }
            : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(';')[0];
        const name = pair.split('=')[0];
        cookie = cookie
          .split('; ')
          .filter((p) => p && !p.startsWith(name + '='))
          .concat(pair.endsWith('=') ? [] : [pair])
          .join('; ');
      }
      return { status: response.status, body: await response.json() };
    };
    let simulated, other, physical, s, run;
    const route = [
      { name: 'Origin', latitude: 51.11, longitude: 17.04, radius_m: 100 },
      { name: 'Destination', latitude: 50.45, longitude: 30.52, radius_m: 100 }
    ];
    const input = () => ({
      name: 'Synthetic cargo',
      device_id: simulated.id,
      route,
      conditions: {
        temperature_min_c: 2,
        temperature_max_c: 8,
        tolerance_c: 1,
        max_deviation_m: 1000
      }
    });
    await t.test(
      'additive migration and dedicated identity retain raw/legacy API isolation',
      async () => {
        assert.deepEqual(
          (
            await db.query('SELECT version FROM gateway_schema_migrations ORDER BY version')
          ).rows.map((r) => r.version),
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        );
        simulated = (
          await req('/v1/simulated-devices', {
            method: 'POST',
            body: { label: 'Dedicated simulator' }
          })
        ).body;
        assert.equal(simulated.identity_kind, 'simulator');
        assert.equal(simulated.mode, 'synthetic');
        other = (
          await req('/v1/simulated-devices', {
            method: 'POST',
            body: { label: 'B' },
            token: b.token
          })
        ).body;
        physical = (
          await req('/v1/devices', {
            method: 'POST',
            body: { label: 'Real tracker', mode: 'real' }
          })
        ).body;
        assert.equal(
          (
            await req('/v1/simulated-devices', {
              method: 'POST',
              body: { label: 'no' },
              token: reader.token
            })
          ).status,
          403
        );
        s = (await req('/v1/shipments', { method: 'POST', body: input() })).body;
        assert.equal(s.source_trust, 'synthetic');
        assert.equal((await req('/v1/shipments/' + s.id, { token: b.token })).status, 404);
        assert.equal(
          (
            await req('/v1/shipments', {
              method: 'POST',
              body: { ...input(), device_id: other.id }
            })
          ).status,
          404
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id, {
              method: 'PATCH',
              body: { device_id: physical.id }
            })
          ).status,
          409
        );
        assert.equal(
          (await req('/v1/shipments/' + s.id, { method: 'PATCH', body: { name: 'Updated draft' } }))
            .status,
          200
        );
      }
    );
    await t.test(
      'Cargo API delegates tenant-scoped AOVX enrollment routes to Telemetry Core',
      async () => {
        const created = await req('/v1/aovx/devices', {
          method: 'POST',
          body: { device_id: physical.id, device_id_bcd: '944063243931' }
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.device_id, physical.id);
        assert.equal(created.body.trust, 'unverified');
        assert.equal(
          (await req('/v1/aovx/devices', { token: b.token })).body.devices.length,
          0
        );
        assert.equal(
          (await req('/v1/aovx/devices', { token: reader.token })).status,
          200
        );
        assert.equal(
          (await req('/v1/aovx/devices/944063243931', { method: 'DELETE' })).status,
          200
        );
      }
    );
    await t.test(
      'status machine, permissions and dedicated simulator commands fail closed',
      async () => {
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'completed' }
            })
          ).status,
          409
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'active' },
              token: reader.token
            })
          ).status,
          403
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'active' }
            })
          ).status,
          200
        );
        assert.equal(
          (await req('/v1/shipments/' + s.id, { method: 'PATCH', body: { name: 'cannot edit' } }))
            .status,
          409
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'delivered' }
            })
          ).status,
          409
        );
        run = (
          await req('/v1/shipments/' + s.id + '/simulations', {
            method: 'POST',
            body: { scenario: 'temperature-excursion' }
          })
        ).body;
        assert.equal(run.state, 'running');
        assert.equal(
          (await req('/v1/simulations/' + run.id + '/pause', { method: 'POST', token: b.token }))
            .status,
          404
        );
        assert.equal(
          (await req('/v1/simulations/' + run.id + '/pause', { method: 'POST' })).status,
          200
        );
        assert.equal(
          (await req('/v1/simulations/' + run.id + '/pause', { method: 'POST' })).status,
          409
        );
        await runtime.simulator.tick();
        assert.equal(
          (await db.query('SELECT step FROM cargo_simulations WHERE id=$1', [run.id])).rows[0].step,
          0
        );
        assert.equal(
          (await req('/v1/simulations/' + run.id + '/resume', { method: 'POST' })).status,
          200
        );
      }
    );
    await t.test(
      'tick transaction rolls back ingestion, events and cursor together on failure',
      async () => {
        const count = (await db.query('SELECT count(*) FROM cargo_events')).rows[0].count;
        await db.query(
          "CREATE FUNCTION reject_cursor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.step>OLD.step THEN RAISE EXCEPTION 'injected cursor failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_cursor BEFORE UPDATE ON cargo_simulations FOR EACH ROW EXECUTE FUNCTION reject_cursor()"
        );
        try {
          await assert.rejects(runtime.simulator.tick(), /injected cursor failure/);
        } finally {
          await db.query(
            'DROP TRIGGER reject_cursor ON cargo_simulations; DROP FUNCTION reject_cursor()'
          );
        }
        assert.equal((await db.query('SELECT count(*) FROM telemetry_events')).rows[0].count, '0');
        assert.equal((await db.query('SELECT count(*) FROM cargo_events')).rows[0].count, count);
        assert.equal((await db.query('SELECT count(*) FROM cargo_outbox')).rows[0].count, count);
        assert.equal(
          (await db.query('SELECT step FROM cargo_simulations WHERE id=$1', [run.id])).rows[0].step,
          0
        );
      }
    );
    await t.test(
      'simulator ingestion reaches PostgreSQL and checkpoints exactly once; replay deduplicates',
      async () => {
        await runtime.simulator.tick();
        const telemetry = (
          await db.query("SELECT * FROM telemetry_events WHERE source='simulator-v1'")
        ).rows[0];
        assert.equal(telemetry.trust, 'synthetic');
        assert.equal(telemetry.identity_kind, 'simulator');
        const duplicate = await transaction(db, a.tenant_id, (c) =>
          ingestSynthetic(
            c,
            a.tenant_id,
            simulated.id,
            {
              schema_version: 1,
              source_event_id: telemetry.payload.source_event_id,
              occurred_at: telemetry.payload.occurred_at,
              gps: telemetry.payload.gps,
              temperature_c: telemetry.payload.temperature_c,
              humidity_pct: telemetry.payload.humidity_pct,
              battery_pct: telemetry.payload.battery_pct,
              status: telemetry.payload.status,
              extra: telemetry.payload.extra
            },
            Buffer.from('duplicate'),
            { source: 'simulator-v1', onEvent: runtime.shipments.onTelemetry }
          )
        );
        assert.equal(duplicate.duplicate, true);
        const revisit = {
          schema_version: 1,
          source_event_id: 'revisit-origin',
          occurred_at: new Date().toISOString(),
          gps: { latitude: route[0].latitude, longitude: route[0].longitude },
          temperature_c: 5,
          status: 'moving'
        };
        await transaction(db, a.tenant_id, (c) =>
          ingestSynthetic(
            c,
            a.tenant_id,
            simulated.id,
            revisit,
            Buffer.from(JSON.stringify(revisit)),
            { source: 'simulator-v1', onEvent: runtime.shipments.onTelemetry }
          )
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM cargo_events WHERE event_type='checkpoint_reached'"
            )
          ).rows[0].count,
          '1'
        );
        assert.equal(
          (await req('/v1/devices/' + simulated.id + '/location')).body.location.trust,
          'synthetic'
        );
      }
    );
    await t.test(
      'active run survives actual Gateway shutdown/recreation without repeating its cursor',
      async () => {
        const before = (await db.query('SELECT step FROM cargo_simulations WHERE id=$1', [run.id]))
          .rows[0].step;
        await runtime.gateway.shutdown();
        db = connect();
        runtime = createRuntime(db, config, { worker: false, logger: silent });
        await runtime.gateway.start();
        assert.equal(
          (await db.query('SELECT step FROM cargo_simulations WHERE id=$1', [run.id])).rows[0].step,
          before
        );
        for (let i = 0; i < 4; i++) {
          await db.query(
            "UPDATE cargo_simulations SET next_tick_at=now()-interval '1 second' WHERE id=$1",
            [run.id]
          );
          await runtime.simulator.tick();
        }
        const detail = (await req('/v1/shipments/' + s.id)).body;
        assert.equal(detail.status, 'delivered');
        assert.ok(detail.checkpoints.every((cp) => cp.visited_at));
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM cargo_events WHERE event_type='checkpoint_reached'"
            )
          ).rows[0].count,
          '2'
        );
        const history = (await req('/v1/shipments/' + s.id + '/events')).body.events;
        assert.ok(history.some((e) => e.event_type === 'temperature_violation'));
        assert.ok(history.some((e) => e.event_type === 'temperature_recovered'));
        assert.ok(history.every((e) => e.source_trust === 'synthetic'));
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'completed' }
            })
          ).status,
          200
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id + '/transitions', {
              method: 'POST',
              body: { status: 'completed' }
            })
          ).status,
          409
        );
        assert.equal(
          (await req('/v1/simulations/' + run.id + '/resume', { method: 'POST' })).status,
          409
        );
      }
    );
    await t.test(
      'hash-linked immutable events and transactional outbox survive retries and stale leases',
      async () => {
        const events = (
          await db.query('SELECT * FROM cargo_events WHERE shipment_id=$1 ORDER BY sequence', [
            s.id
          ])
        ).rows;
        let previous = null;
        for (const e of events) {
          assert.equal(e.previous_hash, previous);
          assert.equal(hash(e.canonical_payload), e.sha256);
          const envelope = JSON.parse(e.canonical_payload);
          assert.equal(envelope.source_trust, 'synthetic');
          assert.equal(envelope.event_id, e.id);
          previous = e.sha256;
        }
        assert.equal(
          (await db.query('SELECT count(*) FROM cargo_outbox')).rows[0].count,
          String(events.length)
        );
        await assert.rejects(
          db.query("UPDATE cargo_events SET source_trust='unverified' WHERE id=$1", [events[0].id]),
          /immutable/
        );
        const [first] = await claimOutbox(db, { limit: 1 });
        await retry(db, a.tenant_id, first.id, first.lease_token);
        await db.query('UPDATE cargo_outbox SET available_at=now() WHERE event_id=$1', [first.id]);
        const [second] = await claimOutbox(db, { limit: 1 });
        await db.query(
          "UPDATE cargo_outbox SET lease_until=now()-interval '1 second' WHERE event_id=$1",
          [second.id]
        );
        const jobs = await claimOutbox(db, { limit: 100 });
        const third = jobs.find((j) => j.id === second.id);
        assert.ok(third);
        await assert.rejects(acknowledge(db, a.tenant_id, second.id, second.lease_token), {
          status: 409
        });
        await acknowledge(db, a.tenant_id, third.id, third.lease_token);
        await acknowledge(db, a.tenant_id, third.id, third.lease_token);
        assert.ok((await claimOutbox(db, { limit: 100 })).every((j) => j.id !== third.id));
      }
    );
    await t.test(
      'one-use pairing enforces owner tenant, audience, CSRF, replay, expiry and revocation',
      async () => {
        const challenge = (
          await req('/v1/pairing/challenges', {
            method: 'POST',
            browser: true,
            body: { tenant_id: a.tenant_id }
          })
        ).body;
        assert.ok(challenge.id);
        const originalCookie = cookie;
        assert.equal(
          (await req('/v1/pairing/session', { method: 'POST', browser: true })).status,
          409
        );
        assert.equal(
          (
            await req('/v1/pairing/challenges/' + challenge.id + '/approve', {
              method: 'POST',
              token: b.token,
              body: { scopes: ['read'] }
            })
          ).status,
          409
        );
        assert.equal(
          (
            await req('/v1/pairing/challenges/' + challenge.id + '/approve', {
              method: 'POST',
              body: { scopes: ['admin'] }
            })
          ).status,
          403
        );
        assert.equal(
          (
            await req('/v1/pairing/challenges/' + challenge.id + '/approve', {
              method: 'POST',
              body: { scopes: ['read', 'shipments', 'simulate'] }
            })
          ).status,
          200
        );
        assert.equal(
          (
            await req('/v1/pairing/challenges/' + challenge.id + '/approve', {
              method: 'POST',
              body: { scopes: ['read'] }
            })
          ).status,
          409
        );
        const claimed = await req('/v1/pairing/session', { method: 'POST', browser: true });
        assert.equal(claimed.status, 201);
        csrf = claimed.body.csrf;
        const sessionCookie = cookie;
        assert.equal(
          (await req('/v1/shipments', { browser: true })).body.shipments[0].tenant_id,
          a.tenant_id
        );
        assert.equal(
          (
            await req('/v1/shipments/' + s.id, {
              browser: true,
              token: null,
              origin: 'https://attacker.example'
            })
          ).status,
          403
        );
        assert.equal(
          (
            await req('/v1/simulated-devices', {
              method: 'POST',
              browser: true,
              body: { label: 'csrf' },
              headers: { 'x-csrf-token': '' }
            })
          ).status,
          403
        );
        assert.equal(
          (
            await req('/v1/devices', {
              method: 'POST',
              browser: true,
              body: { label: 'admin', mode: 'real' }
            })
          ).status,
          403
        );
        cookie = originalCookie;
        assert.equal(
          (await req('/v1/pairing/session', { method: 'POST', browser: true })).status,
          401
        );
        cookie = sessionCookie;
        await db.query(
          "UPDATE cargo_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
          [claimed.body.id]
        );
        assert.equal((await req('/v1/session', { browser: true })).status, 401);
        const expiring = (
          await req('/v1/pairing/challenges', {
            method: 'POST',
            browser: true,
            body: { tenant_id: a.tenant_id }
          })
        ).body;
        await db.query(
          "UPDATE cargo_pairing SET expires_at=now()-interval '1 second' WHERE id=$1",
          [expiring.id]
        );
        assert.equal(
          (await req('/v1/pairing/session', { method: 'POST', browser: true })).status,
          401
        );
        const fresh = (
          await req('/v1/pairing/challenges', {
            method: 'POST',
            browser: true,
            body: { tenant_id: a.tenant_id }
          })
        ).body;
        await req('/v1/pairing/challenges/' + fresh.id + '/approve', {
          method: 'POST',
          body: { scopes: ['read'] }
        });
        const session = await req('/v1/pairing/session', { method: 'POST', browser: true });
        csrf = session.body.csrf;
        assert.equal(
          (await req('/v1/sessions/' + session.body.id, { method: 'DELETE', token: b.token }))
            .status,
          404
        );
        assert.equal((await req('/v1/session', { method: 'DELETE', browser: true })).status, 200);
        assert.equal((await req('/v1/session', { browser: true })).status, 401);
        const delegated = await issueKey(db, a.tenant_id, ['read', 'admin']);
        const c = (
          await req('/v1/pairing/challenges', {
            method: 'POST',
            browser: true,
            body: { tenant_id: a.tenant_id }
          })
        ).body;
        await req('/v1/pairing/challenges/' + c.id + '/approve', {
          method: 'POST',
          token: delegated.token,
          body: { scopes: ['read'] }
        });
        const issued = await req('/v1/pairing/session', { method: 'POST', browser: true });
        assert.equal(issued.status, 201);
        await db.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1', [
          delegated.id
        ]);
        assert.equal((await req('/v1/session', { browser: true })).status, 401);
      }
    );
    await t.test('disabled simulator and real-device mixing are rejected', async () => {
      const physicalShipment = (
        await req('/v1/shipments', { method: 'POST', body: { ...input(), device_id: physical.id } })
      ).body;
      await req('/v1/shipments/' + physicalShipment.id + '/transitions', {
        method: 'POST',
        body: { status: 'active' }
      });
      assert.equal(
        (
          await req('/v1/shipments/' + physicalShipment.id + '/simulations', {
            method: 'POST',
            body: { scenario: 'normal' }
          })
        ).status,
        403
      );
      const fresh = (await req('/v1/shipments', { method: 'POST', body: input() })).body;
      await req('/v1/shipments/' + fresh.id + '/transitions', {
        method: 'POST',
        body: { status: 'active' }
      });
      const r = (
        await req('/v1/shipments/' + fresh.id + '/simulations', {
          method: 'POST',
          body: { scenario: 'normal' }
        })
      ).body;
      await req('/v1/simulations/' + r.id + '/pause', { method: 'POST' });
      assert.equal(
        (await req('/v1/simulations/' + r.id + '/finish', { method: 'POST' })).status,
        200
      );
      assert.equal(
        (await req('/v1/simulations/' + r.id + '/resume', { method: 'POST' })).status,
        409
      );
      const restart = (
        await req('/v1/shipments/' + fresh.id + '/simulations', {
          method: 'POST',
          body: { scenario: 'normal' }
        })
      ).body;
      await runtime.telemetry.setEnabled(a.tenant_id, simulated.id, { enabled: false });
      await runtime.simulator.tick();
      assert.equal(
        (await db.query('SELECT state FROM cargo_simulations WHERE id=$1', [restart.id])).rows[0]
          .state,
        'paused'
      );
      assert.equal(
        (await req('/v1/simulations/' + restart.id + '/resume', { method: 'POST' })).status,
        409
      );
      const { createSimulator } = await import('../src/cargo/simulator.js');
      await assert.rejects(
        createSimulator(db, runtime.shipments).start(a.tenant_id, physicalShipment.id, 'normal'),
        { status: 403 }
      );
    });
  }
);

test('AOVX TCP and replay share the existing shipment transaction', { timeout: 30000 }, async t => {
  const schema = 'cargo_aovx_test_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query('CREATE SCHEMA ' + schema);
  const config = {
    ...readConfig({ DATABASE_URL: url, PROOF_MODE: 'disabled' }),
    host: '127.0.0.1', tcpProtocol: 'aovx', tcpPort: 0, httpPort: 0
  };
  let db, runtime;
  async function start(worker) {
    db = new pg.Pool({
      connectionString: url, application_name: schema, options: '-c search_path=' + schema + ' -c timezone=Pacific/Auckland'
    });
    runtime = createRuntime(db, config, { worker, logger: silent });
    await runtime.gateway.start();
  }
  t.after(async () => {
    try {
      await runtime?.gateway.shutdown();
    } finally {
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    }
  });
  await start(false);

  const a = (await provisionTenant(db, 'AOVX shipment tenant')).tenant_id;
  const b = (await provisionTenant(db, 'Other shipment tenant')).tenant_id;
  async function activeShipment(tenant) {
    const device = await runtime.telemetry.register(tenant, { label: 'Physical tracker', mode: 'real' });
    const shipment = await runtime.shipments.create(tenant, {
      name: 'Physical cargo',
      device_id: device.id,
      route: [
        { name: 'Origin', latitude: 51.11, longitude: 17.04 },
        { name: 'Destination', latitude: 50.45, longitude: 30.52 }
      ],
      conditions: { temperature_min_c: 2, temperature_max_c: 8 }
    });
    await runtime.shipments.change(tenant, shipment.id, 'active');
    return { device, shipment };
  }
  const { device, shipment } = await activeShipment(a);
  const other = await activeShipment(b);
  const bcd = '111222333444';
  const binding = { device_id: device.id, device_id_bcd: bcd };
  await runtime.telemetry.bindAovxDevice(a, null, binding);
  await assert.rejects(
    runtime.telemetry.bindAovxDevice(b, null, binding),
    { status: 404 }
  );
  await assert.rejects(
    runtime.telemetry.bindAovxDevice(b, null, { ...binding, device_id: other.device.id }),
    { status: 409 }
  );

  function wire(sequenceNumber, deviceId = bcd, status = 0x12, deviceTime = '261119163552', latitude = 51110000) {
    const body = Buffer.alloc(40);
    body.writeUInt32BE(status, 4);
    body.writeUInt32BE(latitude, 8);
    body.writeUInt32BE(17040000, 12);
    Buffer.from(deviceTime, 'hex').copy(body, 22);
    return encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: Buffer.from(deviceId, 'hex'), sequenceNumber, body
    });
  }
  const persist = (sequenceNumber, deviceId = bcd, status, deviceTime, latitude) => persistPacket({
    payload: wire(sequenceNumber, deviceId, status, deviceTime, latitude),
    aovx: { messageId: 0x0200, deviceIdBcd: deviceId, sequenceNumber }
  }, db);
  const count = async (table) => (await db.query('SELECT count(*)::int AS n FROM ' + table)).rows[0].n;
  async function waitFor(read) {
    const deadline = Date.now() + 5000;
    do {
      const value = await read();
      if (value) return value;
      await delay(20);
    } while (Date.now() < deadline);
    assert.fail('Timed out waiting for PostgreSQL state');
  }

  await t.test('TCP records the bound physical sample and leaves missing measurements unknown', async () => {
    const socket = connectTcp(runtime.gateway.tcp.address().port, '127.0.0.1');
    const closed = once(socket, 'close');
    socket.end(wire(1));
    await closed;
    const packet = await waitFor(async () => (await db.query(
      "SELECT * FROM gateway_packets WHERE aovx_processing_state='processed'"
    )).rows[0]);
    const [event] = (await db.query('SELECT * FROM telemetry_events')).rows;
    assert.equal(event.tenant_id, a);
    assert.equal(event.device_id, device.id);
    assert.equal(event.source, 'aovx-gal-v1');
    assert.equal(event.trust, 'unverified');
    assert.equal(event.identity_kind, 'physical');
    assert.equal(event.parser_version, 'aovx-gal-v2');
    assert.equal(event.device_time_raw, '261119163552');
    assert.equal(event.event_time_basis, 'gateway_received_at');
    assert.equal(event.payload.occurred_at, packet.received_at.toISOString());
    assert.equal(event.received_at.toISOString(), packet.received_at.toISOString());
    assert.equal(event.payload.gps.latitude, 51.11);
    assert.equal(event.payload.gps.longitude, 17.04);
    assert.equal(event.payload.extra.live_position_eligible, false);
    for (const field of ['temperature_c', 'humidity_pct', 'battery_pct'])
      assert.equal(event.payload[field], null);
    assert.equal(event.canonical_sha256, hash(event.canonical_event));
    assert.equal(event.source_event_id, hash(decodeAovxFrame(wire(1)).raw));
    assert.deepEqual(packet.raw_payload, wire(1));
    const link = (await db.query('SELECT * FROM telemetry_aovx_packet_events')).rows[0];
    assert.deepEqual([link.packet_id, link.tenant_id, link.device_id, link.event_id],
      [packet.id, a, device.id, event.id]);
    const { events } = await runtime.shipments.events(a, shipment.id);
    const entry = events.at(-1);
    assert.equal(entry.event_type, 'telemetry_recorded');
    assert.equal(entry.source_trust, 'unverified');
    assert.deepEqual(JSON.parse(entry.canonical_payload).data, {
      telemetry_event_id: event.id, canonical_sha256: event.canonical_sha256, payload: event.payload
    });
  });

  await t.test('concurrent duplicates link every packet and take the tenant lock before device rows', async () => {
    const first = await persist(2);
    const second = await persist(2);
    const lock = await db.connect();
    let processing;
    try {
      await lock.query('BEGIN');
      await tenantLock(lock, a);
      processing = Promise.all([first, second].map(packet => runtime.aovxIngestion.processPacket(packet.id)));
      // Wait for actual lock contention before proving the device is still unlocked.
      await waitFor(async () => (await db.query(
        `SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity s ON s.pid=l.pid
         WHERE s.application_name=$1 AND l.locktype='advisory' AND NOT l.granted`, [schema]
      )).rows[0].n === 2);
      await lock.query('SELECT id FROM telemetry_devices WHERE id=$1 FOR UPDATE NOWAIT', [device.id]);
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
      if (processing) {
        const results = await processing;
        assert.deepEqual(results.map(result => result.duplicate).sort(), [false, true]);
        assert.equal(results[0].eventId, results[1].eventId);
      }
    }
    const variant = await persist(2, bcd, 0x92);
    assert.equal((await runtime.aovxIngestion.processPacket(variant.id)).duplicate, false);
    assert.equal(await count('telemetry_events'), 3);
    assert.equal(await count('telemetry_aovx_packet_events'), 4);
  });

  await t.test('outbox failure rolls back normalized telemetry and shipment, then restart replays once', async () => {
    const before = await runtime.shipments.detail(a, shipment.id);
    const counts = {
      telemetry_events: await count('telemetry_events'),
      telemetry_aovx_packet_events: await count('telemetry_aovx_packet_events'),
      cargo_events: await count('cargo_events'),
      cargo_outbox: await count('cargo_outbox')
    };
    const { events } = await runtime.shipments.events(a, shipment.id);
    const previous = JSON.parse(events.at(-1).canonical_payload).data.payload;
    const pending = await persist(3, bcd, 0x80000012, '261118120000');
    await db.query(`
      CREATE FUNCTION test_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test outbox failure'; END $$;
      CREATE TRIGGER test_reject_outbox BEFORE INSERT ON cargo_outbox
      FOR EACH ROW EXECUTE FUNCTION test_reject_outbox();
    `);
    await assert.rejects(runtime.aovxIngestion.processPacket(pending.id), /test outbox failure/);
    for (const [table, n] of Object.entries(counts)) assert.equal(await count(table), n);
    assert.deepEqual(await runtime.shipments.detail(a, shipment.id), before);
    const state = async () => (await db.query(
      'SELECT aovx_processing_state FROM gateway_packets WHERE id=$1', [pending.id]
    )).rows[0].aovx_processing_state;
    assert.equal(await state(), 'pending');
    await db.query('DROP TRIGGER test_reject_outbox ON cargo_outbox');
    await runtime.gateway.shutdown();
    await start(true);
    await waitFor(async () => (await state()) === 'processed');
    await runtime.aovxIngestion.stop();
    assert.deepEqual(await runtime.aovxIngestion.processPacket(pending.id), {
      processed: false, reason: 'not-pending'
    });
    for (const [table, n] of Object.entries(counts)) assert.equal(await count(table), n + 1);
    const replayed = (await db.query(
      `SELECT e.payload FROM telemetry_events e JOIN telemetry_aovx_packet_events p ON p.event_id=e.id
       WHERE p.packet_id=$1`, [pending.id]
    )).rows[0].payload;
    assert.equal(replayed.extra.buffered, true);
    assert.equal(replayed.device_time_raw, '261118120000');
    assert.equal(replayed.occurred_at, pending.received_at.toISOString());
    assert.ok(replayed.device_time_raw < previous.device_time_raw);
    assert.ok(replayed.occurred_at >= previous.occurred_at);
  });

  await t.test('disabled, revoked and unbound packets stay raw and never touch another tenant', async () => {
    await runtime.telemetry.setEnabled(a, device.id, { enabled: false });
    const disabled = await persist(4);
    assert.equal((await runtime.aovxIngestion.processPacket(disabled.id)).reason, 'unbound');
    await runtime.telemetry.setEnabled(a, device.id, { enabled: true });
    await runtime.telemetry.revokeAovxDevice(a, bcd);
    const revoked = await persist(5);
    const unknown = await persist(6, '111222333555');
    for (const packet of [revoked, unknown])
      assert.equal((await runtime.aovxIngestion.processPacket(packet.id)).reason, 'unbound');
    const beforeTransfer = await persist(7);
    await delay(5);
    await runtime.telemetry.bindAovxDevice(b, null, { ...binding, device_id: other.device.id });
    assert.equal((await runtime.aovxIngestion.processPacket(beforeTransfer.id)).reason, 'unbound');
    const states = (await db.query(
      'SELECT aovx_processing_state FROM gateway_packets WHERE id=ANY($1::bigint[])',
      [[disabled.id, revoked.id, unknown.id, beforeTransfer.id]]
    )).rows;
    assert.deepEqual(states.map(row => row.aovx_processing_state), Array(4).fill('unbound'));
    assert.equal(await count('telemetry_events'), 4);
    assert.equal(await count('telemetry_aovx_packet_events'), 5);
    assert.equal(await count('cargo_proofs'), 0);
    const foreign = await runtime.shipments.events(b, other.shipment.id);
    assert.deepEqual(foreign.events.map(event => event.event_type), ['shipment_created', 'status_changed']);
    await assert.rejects(runtime.shipments.events(b, shipment.id), { status: 404 });
  });

  await t.test('shipment ledger and outbox contain exactly one linked event per logical sample', async () => {
    const { events } = await runtime.shipments.events(a, shipment.id);
    assert.deepEqual(events.map(event => event.event_type), [
      'shipment_created', 'status_changed', ...Array(4).fill('telemetry_recorded')
    ]);
    let head = null;
    for (const [index, event] of events.entries()) {
      assert.equal(Number(event.sequence), index + 1);
      assert.equal(event.previous_hash, head);
      assert.equal(JSON.parse(event.canonical_payload).previous_hash, head);
      assert.equal(event.sha256, hash(event.canonical_payload));
      assert.equal(event.outbox_state, 'pending');
      head = event.sha256;
    }
    const samples = events.slice(2).map(event => JSON.parse(event.canonical_payload).data.telemetry_event_id);
    assert.equal(new Set(samples).size, 4);
    assert.equal(await count('cargo_outbox'), events.length + 2);
    const detail = await runtime.shipments.detail(a, shipment.id);
    assert.equal(detail.head_hash, head);
    assert.equal(Number(detail.event_sequence), events.length);
    assert.equal(detail.status, 'active');
    assert.equal(detail.temperature_violation, false);
    assert.equal(detail.route_violation, false);
    assert.ok(detail.checkpoints.every(checkpoint => checkpoint.visited_at === null));
  });
  await t.test('buffered and ambiguous physical measurements remain in history and cannot drive live state', async () => {
    const reader = await issueKey(db, a, ['read']);
    const read = async action => {
      const response = await fetch(
        `http://127.0.0.1:${runtime.gateway.api.address().port}/v1/devices/${device.id}/${action}`,
        { headers: { authorization: 'Bearer ' + reader.token } }
      );
      assert.equal(response.status, 200);
      return response.json();
    };

    // Test-only normalized payloads exercise both guards independently of the
    // production adapter, which rejects these ambiguous measurements.
    for (const sample of [
      { buffered: true, gps: { latitude: 0, longitude: 10 }, temperature_c: 20, violation: false },
      { buffered: false, gps: { latitude: 51.11, longitude: 17.04 }, temperature_c: 5, violation: true }
    ]) {
      if (sample.violation) {
        await db.query(
          'UPDATE cargo_shipments SET route_violation=true,temperature_violation=true WHERE tenant_id=$1 AND id=$2',
          [a, shipment.id]
        );
      }
      const id = randomUUID();
      const sha256 = await transaction(db, a, async c => {
        const { rows: [{ payload }] } = await c.query(
          `SELECT payload FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2
           AND (payload->'extra'->>'buffered')::boolean=$3 ORDER BY received_at DESC LIMIT 1`,
          [a, device.id, sample.buffered]
        );
        const event = {
          ...payload,
          source_event_id: hash(id),
          gps: sample.gps,
          temperature_c: sample.temperature_c
        };
        const canonical = canonicalize(event);
        const digest = hash(canonical);
        await c.query(
          `INSERT INTO telemetry_events
             (id,tenant_id,device_id,device_mode,schema_version,source,trust,source_event_id,
              occurred_at,received_at,payload,canonical_event,canonical_sha256,identity_kind,
              event_time_basis,device_time_raw,parser_version)
           VALUES($1,$2,$3,'real',1,'aovx-gal-v1','unverified',$4,$5,$5,$6,$7,$8,
             'physical','gateway_received_at',$9,'aovx-gal-v1')`,
          [id, a, device.id, event.source_event_id, event.occurred_at, event, canonical, digest,
            event.device_time_raw]
        );
        await runtime.shipments.onTelemetry(c, { id, event, sha256: digest });
        return digest;
      });
      const { events } = await runtime.shipments.events(a, shipment.id);
      const entry = events.at(-1);
      assert.equal(entry.event_type, 'telemetry_recorded');
      assert.equal(entry.previous_hash, events.at(-2).sha256);
      assert.equal(entry.sha256, hash(entry.canonical_payload));
      assert.equal(entry.outbox_state, 'pending');
      const { data } = JSON.parse(entry.canonical_payload);
      assert.equal(data.telemetry_event_id, id);
      assert.equal(data.canonical_sha256, sha256);
      const detail = await runtime.shipments.detail(a, shipment.id);
      assert.equal(detail.status, 'active');
      assert.equal(detail.route_violation, sample.violation);
      assert.equal(detail.temperature_violation, sample.violation);
      assert.ok(detail.checkpoints.every(checkpoint => checkpoint.visited_at === null));
      assert.deepEqual(await read('location'), { device_id: device.id, location: null });
      const history = await read('events');
      assert.deepEqual(history.events.find(event => event.id === id).payload.gps, sample.gps);
    }
  });
  await t.test('only the newest timely real-time fix supplies a tenant-scoped last known location', async () => {
    const { device, shipment } = await activeShipment(a);
    const bcd = '111222333666';
    await runtime.telemetry.bindAovxDevice(a, null, { device_id: device.id, device_id_bcd: bcd });
    async function ingest(...args) {
      const packet = await persist(...args);
      return runtime.aovxIngestion.processPacket(packet.id);
    }
    const now = Math.floor(Date.now() / 1000) * 1000;
    const iso = seconds => new Date(now + seconds * 1000).toISOString();
    const bcdAt = seconds => iso(seconds).slice(2, 19).replace(/\D/g, '');
    const read = tenant => runtime.telemetry.latest(tenant, device.id, true);
    const before = await runtime.shipments.detail(a, shipment.id);
    const ledger = await runtime.shipments.events(a, shipment.id);
    const baseline = await count('telemetry_events');
    const outbox = await count('cargo_outbox');
    const proofs = await count('cargo_proofs');
    const first = bcdAt(-20);
    await ingest(90, bcd, 2, first);
    const latest = (await read(a)).location;
    assert.equal(latest.occurred_at, iso(-20));
    assert.ok(new Date(latest.received_at).toISOString() > latest.occurred_at);
    assert.equal(latest.trust, 'unverified');
    assert.equal(latest.gps.latitude, 51.11);
    await assert.rejects(read(b), { status: 404 });

    assert.equal((await ingest(90, bcd, 2, first)).duplicate, true);
    await ingest(91, bcd, 6, bcdAt(-30));
    await ingest(92, bcd, 0x80000006, bcdAt(-10));
    await ingest(93, bcd, 0, bcdAt(-8));
    await ingest(94, bcd, 2, '26af23011130');
    await ingest(95, bcd, 6, bcdAt(60));
    assert.deepEqual((await read(a)).location, latest);
    await ingest(90, bcd, 6, first); // Different frame, conflicting fix at the same UTC second.
    assert.equal((await read(a)).location, null);
    await ingest(96, bcd, 6, bcdAt(-5));
    assert.equal((await read(a)).location.gps.latitude, -51.11);

    const { rows: [buffered] } = await db.query(
      `SELECT t.payload,p.raw_payload AS wire FROM gateway_packets p JOIN telemetry_aovx_packet_events l
        ON p.id=l.packet_id JOIN telemetry_events t ON l.event_id=t.id WHERE t.id IN (
          SELECT id FROM telemetry_events WHERE device_id=$1 AND payload->'extra'->>'sequence_number'='92'
        )`, [device.id]
    );
    assert.equal(buffered.payload.device_measured_at, iso(-10));
    assert.equal(buffered.payload.gps.latitude, -51.11);
    assert.equal(buffered.payload.extra.buffered, true);
    assert.deepEqual(buffered.wire, wire(92, bcd, 0x80000006, bcdAt(-10)));
    assert.equal(await count('telemetry_events'), baseline + 8);
    assert.equal(await count('cargo_outbox'), outbox + 8);
    assert.equal(await count('cargo_proofs'), proofs);
    const entries = (await runtime.shipments.events(a, shipment.id)).events.slice(ledger.events.length);
    assert.equal(entries.length, 8);
    const integritas = createIntegritas(db);
    await assert.rejects(integritas.prepare(a, entries[0].id), { status: 409 });
    assert.equal(await count('cargo_integritas_requests'), 0);
    let previous = ledger.events.at(-1).sha256;
    for (const entry of entries) {
      assert.equal(entry.event_type, 'telemetry_recorded');
      assert.equal(entry.previous_hash, previous);
      assert.equal(entry.sha256, hash(entry.canonical_payload));
      previous = entry.sha256;
    }
    const after = await runtime.shipments.detail(a, shipment.id);
    assert.deepEqual(after.checkpoints, before.checkpoints);
    assert.equal(after.route_violation, before.route_violation);
    assert.equal(after.temperature_violation, before.temperature_violation);
    assert.equal(after.head_hash, previous);
  });
  await t.test('diagnostics are read only, scoped to this binding, and explain packet and position outcomes', async () => {
    const physical = await runtime.telemetry.register(a, { label: 'Diagnostics tracker', mode: 'real' });
    const id = physical.id;
    const bcd = '111222333777';
    const path = `http://127.0.0.1:${runtime.gateway.api.address().port}/v1/devices/${id}/diagnostics`;
    const [reader, outsider, restricted] = await Promise.all([
      issueKey(db, a, ['read']), issueKey(db, b, ['read']), issueKey(db, a, ['admin'])
    ]);
    const request = (key, method = 'GET') => fetch(path, {
      method, headers: key ? { authorization: 'Bearer ' + key.token } : {}
    });
    async function diagnostics() {
      const response = await request(reader);
      assert.equal(response.status, 200);
      const raw = await response.text();
      assert.ok(!raw.includes(bcd));
      assert.doesNotMatch(raw, /raw_payload|remote_address|processing_error/);
      return JSON.parse(raw);
    }
    async function expectReason(reason) {
      const result = await diagnostics();
      assert.equal(result.position.reason, reason);
      assert.equal(result.position.observation_eligible, reason === 'eligible');
      return result;
    }
    assert.equal((await request()).status, 401);
    assert.equal((await request(outsider)).status, 404);
    assert.equal((await request(restricted)).status, 403);
    assert.equal((await request(reader, 'PATCH')).status, 404);
    assert.equal((await expectReason('unbound_device')).packet, null);
    // A previous tenant's packets under the same BCD must remain invisible.
    const previousOwner = await runtime.telemetry.register(b, { label: 'Previous tracker', mode: 'real' });
    await runtime.telemetry.bindAovxDevice(b, null, { device_id: previousOwner.id, device_id_bcd: bcd });
    await persist(100, bcd);
    await runtime.telemetry.revokeAovxDevice(b, bcd);
    await delay(5);
    await runtime.telemetry.bindAovxDevice(a, null, { device_id: id, device_id_bcd: bcd });
    const empty = await expectReason('no_decoded_observation');
    assert.equal(empty.packet_recency, 'no_recent_data');
    assert.equal(empty.packet, null);

    const now = Math.floor(Date.now() / 1000) * 1000;
    const iso = seconds => new Date(now + seconds * 1000).toISOString();
    const time = seconds => iso(seconds).slice(2, 19).replace(/\D/g, '');
    const observe = async (sequence, status, deviceTime, latitude) => {
      const packet = await persist(sequence, bcd, status, deviceTime, latitude);
      return runtime.aovxIngestion.processPacket(packet.id);
    };
    const pending = await persist(101, bcd, 2, time(-20));
    assert.equal((await expectReason('no_decoded_observation')).packet.ingestion, 'pending');
    await runtime.aovxIngestion.processPacket(pending.id);
    const first = await expectReason('eligible');
    assert.equal(first.observation.measured_at, iso(-20));
    assert.equal(first.packet_recency, 'recent');
    assert.equal(first.packet.received_at, pending.received_at.toISOString());
    assert.equal(first.observation.received_at, pending.received_at.toISOString());
    assert.equal(first.observation.gnss, 'fix');
    assert.equal(first.observation.delivery, 'real_time');
    assert.equal(first.observation.parser_version, 'aovx-gal-v2');
    assert.equal(first.observation.packet_ref, String(pending.id));
    assert.ok(first.observation.receive_lag_ms >= 20000);
    const duplicate = await observe(101, 2, time(-20));
    assert.equal(duplicate.duplicate, true);
    assert.equal((await expectReason('eligible')).observation.event_id, first.observation.event_id);

    await observe(102, 2, time(-25));
    await expectReason('out_of_order');
    await observe(103, 2, time(-301)); // Also models a device clock jumping backward.
    await expectReason('delayed_report');
    await observe(104, 0x80000002, time(-10));
    const buffered = await expectReason('buffered_report');
    assert.equal(buffered.observation.delivery, 'buffered');
    assert.equal(buffered.last_valid_gnss_at, iso(-10));
    assert.equal(buffered.position.last_known_at, iso(-20));
    await observe(111, 2, time(-9), 90000001);
    await expectReason('invalid_position');
    await observe(105, 0, time(-9));
    assert.equal((await expectReason('no_gnss_fix')).observation.gnss, 'unfix');
    await observe(106, 2, '261132011130');
    assert.equal((await expectReason('invalid_device_time')).observation.clock, 'invalid_timestamp');
    await observe(107, 2, time(30));
    const future = await expectReason('future_device_time');
    assert.equal(future.observation.clock, 'future_timestamp');
    assert.ok(future.observation.receive_lag_ms < 0);

    const raw = wire(108, bcd, 2, time(-8));
    raw[raw.length - 2] ^= 1;
    const rejected = await persistPacket({
      payload: raw, aovx: { messageId: 0x0200, deviceIdBcd: bcd, checksumStatus: 'xor-mismatch' }
    }, db);
    assert.equal((await runtime.aovxIngestion.processPacket(rejected.id)).reason, 'rejected');
    const failure = await diagnostics();
    assert.equal(failure.packet.ingestion, 'rejected');
    assert.equal(failure.packet.decoding, 'failed');
    assert.equal(failure.observation.event_id, future.observation.event_id);

    await observe(109, 6, time(-20));
    const conflict = await expectReason('conflicting_fixes');
    assert.equal(conflict.position.conflict, true);
    assert.equal(conflict.position.last_known_at, null);
    await observe(110, 6, time(-5));
    await expectReason('eligible');
    const ranged = (key, from, to, limit = '200') => fetch(
      path.replace('/diagnostics', '/lab-history') + '?' + new URLSearchParams({ from, to, limit }),
      { headers: { authorization: 'Bearer ' + key.token } }
    );
    assert.equal((await ranged(outsider, iso(-60), iso(60))).status, 404);
    assert.equal((await ranged(restricted, iso(-60), iso(60))).status, 403);
    assert.equal((await ranged(reader, '', iso(60))).status, 400);
    assert.equal((await ranged(reader, iso(60), iso(-60))).status, 400);
    assert.equal((await ranged(reader, iso(-691200), iso(60))).status, 400);
    const small = await (await ranged(reader, iso(-60), iso(60), '1')).json();
    assert.equal(small.truncated, true);
    assert.equal(small.observations.length, 1);
    const response = await ranged(reader, iso(-60), iso(60));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.text();
    assert.equal(body.includes(bcd), false);
    assert.doesNotMatch(body, /raw_payload|device_time_raw|source_event_id|canonical_event|remote_address/);
    const range = JSON.parse(body);
    assert.equal(range.truncated, false);
    assert.equal(range.time_basis, 'gateway_received_at');
    assert.equal(range.observations.filter(row => row.measured_at === iso(-20)).length, 2);
    assert.equal(range.observations.find(row => row.buffered).position.latitude, 51.11);
    assert.equal(range.observations.find(row => row.measured_at === iso(30)).position, null);
    const emptyRange = await (await ranged(reader, iso(-120), iso(-61))).json();
    assert.deepEqual(emptyRange.observations, []);
    await runtime.telemetry.setEnabled(a, id, { enabled: false });
    await expectReason('device_disabled');
    assert.equal((await runtime.telemetry.latest(a, id, true)).location, null);
    await runtime.telemetry.setEnabled(a, id, { enabled: true });
    await runtime.telemetry.revokeAovxDevice(a, bcd);
    assert.equal((await expectReason('unbound_device')).observation, null);
    assert.equal((await runtime.telemetry.latest(a, id, true)).location, null);
    await delay(5);
    await runtime.telemetry.bindAovxDevice(a, null, { device_id: id, device_id_bcd: bcd });
    assert.equal((await expectReason('no_decoded_observation')).position.last_known_at, null);
  });
  await t.test('manufacturer frame crosses the TCP framer and retains immutable raw lineage', async () => {
    const raw = Buffer.from(readFileSync(new URL('./fixtures/aovx-manufacturer-0200.hex', import.meta.url), 'utf8')
      .replace(/\s/g, ''), 'hex');
    const physical = await runtime.telemetry.register(a, { label: 'Manufacturer fixture', mode: 'real' });
    await runtime.telemetry.bindAovxDevice(a, null, {
      device_id: physical.id, device_id_bcd: decodeAovxFrame(raw).deviceIdBcd.toString('hex')
    });
    const socket = connectTcp(runtime.gateway.tcp.address().port, '127.0.0.1');
    const closed = once(socket, 'close');
    socket.write(raw.subarray(0, 25));
    socket.end(raw.subarray(25));
    await closed;
    const row = await waitFor(async () => (await db.query(
      `SELECT p.raw_payload,t.payload,t.canonical_event,t.canonical_sha256,t.received_at
         FROM telemetry_aovx_packet_events l JOIN gateway_packets p ON p.id=l.packet_id
         JOIN telemetry_events t ON t.tenant_id=l.tenant_id AND t.id=l.event_id
         WHERE l.tenant_id=$1 AND l.device_id=$2`, [a, physical.id]
    )).rows[0]);
    assert.deepEqual(row.raw_payload, raw);
    assert.equal(row.payload.device_measured_at, '2026-11-23T01:11:30.000Z');
    assert.equal(row.payload.occurred_at, row.received_at.toISOString());
    assert.equal(row.canonical_sha256, hash(row.canonical_event));
  });
});
