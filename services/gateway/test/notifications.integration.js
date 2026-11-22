import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../src/telemetry/migrate.js';
import { createTelemetryService, provisionTenant } from '../src/telemetry/service.js';
import { createShipmentService } from '../src/cargo/shipments.js';
import { createNotifications } from '../src/cargo/notifications.js';
import { claimOutbox } from '../src/cargo/outbox.js';
import { hash } from '../src/cargo/shared.js';
import { initialize } from '../src/journal.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required (disposable database)');

test('Notification consent, atomic enqueue, deduplication, retries, restart and proof outbox isolation', async (t) => {
  const schema = 'notifications_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  const connect = () => new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
  await admin.query('CREATE SCHEMA ' + schema);
  let db = connect();
  t.after(async () => {
    await db.end();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await initialize(db);
  await migrate(db);
  const { tenant_id: tenant } = await provisionTenant(db, 'Free notification tenant');
  const { tenant_id: other } = await provisionTenant(db, 'Other tenant');
  const telemetry = createTelemetryService(db);
  const shipments = createShipmentService(db);
  let notifications = createNotifications(db);
  const draft = async (mode) => {
    const device = await telemetry.register(tenant, { label: 'Generated ' + mode, mode });
    return shipments.create(tenant, {
      name: 'Test cargo', device_id: device.id,
      route: [{ name: 'A', latitude: 51, longitude: 17 }, { name: 'B', latitude: 50, longitude: 30 }],
      conditions: { temperature_min_c: 2, temperature_max_c: 8 }
    });
  };
  const noConsent = await draft('real');
  await shipments.change(tenant, noConsent.id, 'active');
  assert.deepEqual((await notifications.status(tenant)).notifications, []);
  await notifications.setPreferences(tenant, { enabled: true });
  const synthetic = await draft('synthetic');
  await shipments.change(tenant, synthetic.id, 'active');
  assert.deepEqual((await notifications.status(tenant)).notifications, []);
  await notifications.setPreferences(tenant, { enabled: true, include_synthetic: true });
  await shipments.change(tenant, synthetic.id, 'cancelled');
  await Promise.all([notifications.tick(), notifications.tick()]);
  const [simulated] = (await notifications.status(tenant)).notifications;
  assert.equal(simulated.source_trust, 'synthetic');
  assert.equal(simulated.state, 'delivered');
  assert.equal(simulated.attempts, 1);

  const real = await draft('real');
  await db.query(`
    CREATE FUNCTION reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'notification insert failure'; END $$;
    CREATE TRIGGER reject_notification BEFORE INSERT ON cargo_notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION reject_notification();
  `);
  await assert.rejects(shipments.change(tenant, real.id, 'active'), /notification insert failure/);
  assert.equal((await shipments.detail(tenant, real.id)).status, 'draft');
  const original = await shipments.events(tenant, real.id, 0, 100);
  assert.equal(original.events.length, 1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM cargo_outbox o JOIN cargo_events e ON e.id=o.event_id WHERE e.shipment_id=$1", [real.id])).rows[0].n, 1);
  await db.query('DROP TRIGGER reject_notification ON cargo_notification_deliveries');
  await shipments.change(tenant, real.id, 'active');
  const [, event] = (await shipments.events(tenant, real.id, 0, 100)).events;
  assert.equal(event.previous_hash, original.events[0].sha256);
  assert.equal(event.sha256, hash(event.canonical_payload));
  const [job] = (await claimOutbox(db, { limit: 100 })).filter(row => row.id === event.id);
  assert.ok(job.lease_token);

  await db.query(`CREATE TRIGGER reject_notification BEFORE INSERT ON cargo_notification_inbox
    FOR EACH ROW EXECUTE FUNCTION reject_notification()`);
  const delivery = async (id = event.id) => (await notifications.status(tenant)).notifications.find(row => row.event_id === id);
  const forceDue = (id) => db.query('UPDATE cargo_notification_deliveries SET next_attempt_at=now() WHERE event_id=$1', [id]);
  await Promise.all([notifications.tick(), notifications.tick()]);
  assert.equal((await delivery()).last_error, 'LOCAL_INBOX_WRITE_FAILED');
  assert.equal((await delivery()).attempts, 1);
  assert.equal((await delivery()).delivered_at, null);
  await notifications.tick();
  assert.equal((await delivery()).attempts, 1);
  await db.end();
  db = connect();
  notifications = createNotifications(db);
  await db.query('DROP TRIGGER reject_notification ON cargo_notification_inbox');
  await forceDue(event.id);
  await Promise.all([notifications.tick(), notifications.tick()]);
  assert.equal((await delivery()).state, 'delivered');
  assert.equal((await delivery()).attempts, 2);
  assert.equal((await delivery()).last_error, null);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cargo_notification_inbox WHERE event_id=$1', [event.id])).rows[0].n, 1);
  assert.deepEqual((await notifications.status(other)).notifications, []);
  const { rows: [outbox] } = await db.query('SELECT state,lease_token,attempts FROM cargo_outbox WHERE event_id=$1', [event.id]);
  assert.deepEqual(outbox, { state: 'processing', lease_token: job.lease_token, attempts: 1 });

  const afterRestart = createShipmentService(db);
  await afterRestart.change(tenant, real.id, 'cancelled');
  const terminal = (await notifications.status(tenant)).notifications.find(row => row.shipment_status === 'cancelled' && row.shipment_id === real.id);
  await db.query(`CREATE TRIGGER reject_notification BEFORE INSERT ON cargo_notification_inbox
    FOR EACH ROW EXECUTE FUNCTION reject_notification()`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await forceDue(terminal.event_id);
    await notifications.tick();
    assert.equal((await delivery(terminal.event_id)).attempts, attempt);
  }
  await forceDue(terminal.event_id);
  await notifications.tick();
  assert.equal((await delivery(terminal.event_id)).state, 'failed');
  assert.equal((await delivery(terminal.event_id)).attempts, 3);

  await afterRestart.change(tenant, noConsent.id, 'cancelled');
  const cancelled = (await notifications.status(tenant)).notifications.find(row => row.shipment_id === noConsent.id);
  await notifications.setPreferences(tenant, { enabled: false });
  await notifications.tick();
  assert.equal((await delivery(cancelled.event_id)).state, 'cancelled');
  assert.equal((await delivery(cancelled.event_id)).attempts, 0);
  assert.equal((await delivery()).state, 'delivered');
});
