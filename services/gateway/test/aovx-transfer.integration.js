import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { administerDemo } from '../src/cargo/demo-admin.js';
import { administerPilot } from '../src/cargo/pilot-admin.js';
import { administerAovxTransfer } from '../src/aovx/transfer.js';
import { provisionTenant } from '../src/telemetry/service.js';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { persistPacket } from '../src/journal.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');

test('approved transfer is atomic under concurrent arrivals and rollback preserves both histories', { timeout: 30000 }, async t => {
  const schema = 'custody_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query('CREATE SCHEMA ' + schema);
  const directory = await mkdtemp(join(tmpdir(), 'trackium-transfer-'));
  const scoped = new URL(url);
  scoped.searchParams.set('options', '-c search_path=' + schema);
  const cli = (command, file, ...args) => promisify(execFile)(process.execPath,
    ['src/aovx/transfer-cli.js', command, '--file=' + file, ...args],
    { env: { ...process.env, DATABASE_URL: scoped.href } });
  const db = new pg.Pool({ connectionString: url, application_name: schema, options: '-c search_path=' + schema });
  const runtime = createRuntime(db, { ...readConfig({ DATABASE_URL: url, TCP_PROTOCOL: 'aovx' }),
    host: '127.0.0.1', httpPort: 0, tcpPort: 0 }, { worker: false, logger: { info(){}, error(){} } });
  t.after(async () => {
    await runtime.gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
    await rm(directory, { recursive: true, force: true });
  });
  await runtime.gateway.start();
  const internal = await provisionTenant(db, 'Trackium Internal');
  const third = await provisionTenant(db, 'Unrelated company');
  const tracker = await runtime.telemetry.register(internal.tenant_id, { label: 'Controlled transfer tracker', mode: 'real' });
  const identifier = '555444333221';
  const binding = await runtime.telemetry.bindAovxDevice(internal.tenant_id, internal.id,
    { device_id: tracker.id, device_id_bcd: identifier });
  await administerDemo(db, 'bootstrap', { password: 'local transfer viewer fixture' });
  await assert.rejects(administerPilot(db, 'plan', { name: 'Trackium Physical Pilot', identifiers: [identifier] }),
    { status: 409 });
  const promoted = await administerPilot(db, 'promote', { name: 'Trackium Physical Pilot', identifiers: [],
    transferOnly: true, password: 'local transfer pilot fixture' });
  const pilot = promoted.pilot_tenant_id;
  const approvals = () => ({ id: randomUUID(), source_approval: randomUUID(), destination_approval: randomUUID(),
    custody_reference: randomUUID(), operator_reference: randomUUID() });
  const plan = { ...approvals(), identifier, source_tenant: internal.tenant_id, source_device: tracker.id,
    source_binding: binding.id, destination_tenant: pilot, destination_label: 'Pilot tracker' };
  const operate = (command, input = plan) => administerAovxTransfer(db, command, input);
  const processStored = packet => runtime.aovxIngestion.processPacket(packet.id);
  function frame(sequence, offset = -2000, status = 2) {
    const body = Buffer.alloc(40);
    body.writeUInt32BE(status, 4);
    body.writeUInt32BE(51110000, 8);
    body.writeUInt32BE(17040000, 12);
    Buffer.from(new Date(Date.now() + offset).toISOString().slice(2,19).replace(/\D/g, ''), 'hex').copy(body, 22);
    return encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: Buffer.from(identifier, 'hex'),
      sequenceNumber: sequence, body });
  }
  async function packet(sequence, offset, status) {
    const payload = frame(sequence, offset, status);
    return { ...await persistPacket({ payload, aovx: { messageId: 0x0200, deviceIdBcd: identifier } }, db), payload };
  }
  const first = await packet(1);
  assert.equal((await processStored(first)).processed, true);
  const pending = await packet(2);
  const snapshot = async (tenant, device) => (await db.query(
    'SELECT id,canonical_sha256,canonical_event FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2 ORDER BY id',
    [tenant,device])).rows;
  const originalHistory = await snapshot(internal.tenant_id, tracker.id);
  const planFile = join(directory, 'plan.json');
  await writeFile(planFile, JSON.stringify(plan), { mode: 0o600 });
  await assert.rejects(cli('apply-transfer', planFile), /requires --approve=transfer/);
  const planned = JSON.parse((await cli('plan-transfer', planFile)).stdout);
  assert.equal(planned.status, 'dry-run');
  assert.equal(planned.pending_packets, 1);
  assert.equal(planned.source.observations, 1);
  assert.equal(planned.source.open_shipments, 0);
  assert.equal((await operate('inspect-transfer', { identifier: '555444333222' })).active, null);
  await assert.rejects(operate('plan-transfer', { ...plan, destination_tenant: third.tenant_id }), { status: 409 });
  await assert.rejects(operate('plan-transfer', { ...plan, source_binding: randomUUID() }), { status: 409 });
  await assert.rejects(operate('plan-transfer', { ...plan, identifier: '555444333222' }), { status: 409 });

  const shipment = await runtime.shipments.create(internal.tenant_id, { name: 'Open shipment', device_id: tracker.id,
    route: [{ name: 'Start', latitude: 51.11, longitude: 17.04 }, { name: 'End', latitude: 50, longitude: 30 }],
    conditions: { temperature_min_c: 2, temperature_max_c: 8 } });
  await runtime.shipments.change(internal.tenant_id, shipment.id, 'active');
  await assert.rejects(operate('apply-transfer'), /Close active or delivered shipments/);
  await runtime.shipments.change(internal.tenant_id, shipment.id, 'cancelled');

  await db.query("ALTER TABLE telemetry_aovx_transfers ADD CONSTRAINT test_fail_audit CHECK (false)");
  await assert.rejects(operate('apply-transfer'), { code: '23514' });
  assert.equal((await operate('inspect-transfer', { identifier })).active.id, binding.id);
  assert.equal((await runtime.telemetry.list(pilot, 10)).devices.length, 0);
  await db.query('ALTER TABLE telemetry_aovx_transfers DROP CONSTRAINT test_fail_audit');

  // Hold the transfer after both binding changes, before commit. Workers can
  // see the old binding but must wait on its tenant lock before attribution.
  await db.query(`CREATE FUNCTION test_hold_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_advisory_xact_lock(31415926); RETURN NEW; END $$;
    CREATE TRIGGER test_hold_transfer BEFORE INSERT ON telemetry_aovx_transfers
    FOR EACH ROW EXECUTE FUNCTION test_hold_transfer()`);
  const gate = await db.connect();
  await gate.query('BEGIN');
  await gate.query('SELECT pg_advisory_xact_lock(31415926)');
  let moving, queued, tcpClosed;
  try {
    moving = operate('apply-transfer');
    const deadline = Date.now() + 5000;
    for (;;) {
      const { rows } = await db.query(
        `SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
          WHERE l.locktype='advisory' AND l.objid=31415926 AND NOT l.granted AND a.application_name=$1`, [schema]);
      if (rows.length) break;
      assert.ok(Date.now() < deadline, 'transfer did not reach audit barrier');
      await delay(10);
    }
    // Advance past AOVX's one-second granularity before emulating a new measurement.
    await delay(1200);
    const socket = connect(runtime.gateway.tcp.address().port, '127.0.0.1');
    tcpClosed = once(socket, 'close');
    socket.end(frame(3, 0));
    queued = processStored(pending);
    for (;;) {
      const { rows: [waiting] } = await db.query(
        `SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%cargo:%'`, [schema]);
      if (waiting.count >= 2) break;
      assert.ok(Date.now() < deadline, 'ingestion workers did not reach the tenant lock');
      await delay(10);
    }
  } finally {
    await gate.query('ROLLBACK');
    gate.release();
  }
  const result = await moving;
  assert.equal(result.status, 'applied');
  await tcpClosed;
  assert.deepEqual(await queued, { processed: false, reason: 'unbound' });
  const deadline = Date.now() + 5000;
  for (;;) {
    const { rows: [later] } = await db.query(
      'SELECT received_at,aovx_processing_state FROM gateway_packets WHERE aovx_sequence_number=3');
    assert.ok(later.received_at >= result.effective_at);
    if (later.aovx_processing_state !== 'pending') {
      assert.equal(later.aovx_processing_state, 'processed');
      break;
    }
    assert.ok(Date.now() < deadline, 'post-cutover TCP packet did not leave the queue');
    await delay(10);
  }
  const state = await operate('inspect-transfer', { identifier });
  const dest = state.active.device_id;
  assert.equal(state.active.id, result.destination_binding_id);
  assert.equal(state.active.tenant_id, pilot);
  await assert.rejects(runtime.telemetry.bindAovxDevice(internal.tenant_id, internal.id, {
    device_id: tracker.id, device_id_bcd: identifier
  }), /requires operator custody review/);
  assert.equal(JSON.parse((await cli('apply-transfer', planFile, '--approve=transfer')).stdout).status, 'already-applied');
  await assert.rejects(operate('apply-transfer', { ...plan, destination_label: 'Changed' }), { status: 409 });
  await assert.rejects(operate('apply-transfer', { ...plan, ...approvals() }), { status: 409 });

  const replay = () => persistPacket({ payload: first.payload, aovx: { messageId: 0x0200, deviceIdBcd: identifier } }, db);
  assert.equal((await processStored(await replay())).reason, 'outside-custody-window');
  assert.equal((await processStored(await packet(4, 0, 0x80000002))).reason, 'outside-custody-window');
  assert.equal((await processStored(await packet(5, 60000))).reason, 'outside-custody-window');
  const location = await runtime.telemetry.latest(pilot, dest, true);
  assert.equal(location.location.trust, 'unverified');
  await assert.rejects(runtime.telemetry.latest(internal.tenant_id, dest, true), { status: 404 });
  await assert.rejects(runtime.telemetry.latest(pilot, tracker.id, true), { status: 404 });
  assert.equal((await runtime.telemetry.latest(internal.tenant_id, tracker.id, true)).location, null);
  assert.deepEqual(await snapshot(internal.tenant_id, tracker.id), originalHistory);
  const pilotHistory = await snapshot(pilot,dest);
  assert.equal(pilotHistory.length, 1);

  const reversal = { ...approvals(), identifier, source_tenant: pilot, source_device: dest,
    source_binding: result.destination_binding_id, destination_tenant: internal.tenant_id, reverse_of: plan.id };
  const reversed = await operate('apply-transfer', reversal);
  assert.equal(reversed.reverse_of, result.id);
  assert.equal((await operate('inspect-transfer', { identifier })).active.device_id, tracker.id);
  assert.equal((await operate('apply-transfer', reversal)).status, 'already-applied');
  assert.equal((await processStored(await replay())).reason, 'outside-custody-window');
  assert.deepEqual(await snapshot(pilot,dest), pilotHistory);
  assert.deepEqual(await snapshot(internal.tenant_id,tracker.id), originalHistory);
  await assert.rejects(db.query('DELETE FROM telemetry_aovx_transfers'), /immutable/);
  await delay(1200);
  assert.equal((await processStored(await packet(6,0))).processed, true);
  assert.equal((await snapshot(internal.tenant_id,tracker.id)).length, 2);
  assert.equal((await snapshot(pilot,dest)).length, 1);
});
