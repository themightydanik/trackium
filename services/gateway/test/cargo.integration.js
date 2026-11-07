import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { provisionTenant, issueKey } from '../src/telemetry/service.js';
import { ingestSynthetic } from '../src/cargo/ingestion.js';
import { transaction, hash } from '../src/cargo/shared.js';
import { claimOutbox, acknowledge, retry } from '../src/cargo/outbox.js';
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
          [1, 2]
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
