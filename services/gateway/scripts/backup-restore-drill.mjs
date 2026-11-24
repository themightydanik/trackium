import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { encodeAovxFrame, decodeAovxFrame } from '../src/aovx/frame.js';
import { administerPilot } from '../src/cargo/pilot-admin.js';
import { createPasswordDigest } from '../src/cargo/accounts.js';
import { createCustomerMail } from '../src/cargo/customer-mail.js';
import { createNotifications } from '../src/cargo/notifications.js';
import { acknowledge, claimOutbox } from '../src/cargo/outbox.js';
import { createRuntime } from '../src/cargo/runtime.js';
import { hash, transaction } from '../src/cargo/shared.js';
import { readConfig } from '../src/config.js';
import { persistPacket } from '../src/journal.js';
import { changeCustomerAccess, customerStatus, provisionCustomer } from '../src/managed/service.js';
import { createIntegritas } from '../src/proofs/integritas.js';
import { verifyBundle } from '../src/proofs/verifier.js';
import { createTelemetryService, provisionTenant } from '../src/telemetry/service.js';

const image = 'postgres@sha256:1d5b02d3a9941fbd52437db4107f8c52d6297dac553ca1e5c299ebb3756b4857';
const name = 'trackium-restore-drill-' + randomBytes(8).toString('hex');
const password = randomBytes(24).toString('hex');
const source = 'drill_source';
const recovered = 'drill_recovered';
const damaged = 'drill_damaged';
const incomplete = 'drill_incomplete';

assert.equal(process.argv.length, 2, 'This drill only accepts its own disposable databases');
const endpoint = process.env.DOCKER_CONTEXT || !process.env.DOCKER_HOST
  ? execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], {
      encoding: 'utf8', timeout: 10000
    }).trim()
  : process.env.DOCKER_HOST;
assert.match(endpoint, /^unix:\/\/\//, 'Select a local Unix-socket Docker daemon');
const dockerEnv = { ...process.env };
delete dockerEnv.DOCKER_CONTEXT;
delete dockerEnv.DOCKER_HOST;
const docker = (args, options = {}) =>
  execFileSync('docker', ['--host', endpoint, ...args], {
    env: dockerEnv, timeout: 90000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'], ...options
  });
const inside = (...args) => docker(['exec', name, ...args]);
const psql = (database, sql) =>
  inside('psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database, '-Atqc', sql)
    .toString().trim();
const dump = (...options) =>
  inside('pg_dump', '-U', 'postgres', '-Fc', '--no-owner', '--no-acl', ...options, source);
const restore = (database, archive) =>
  docker(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '--single-transaction',
    '--exit-on-error', '--no-owner', '--no-acl', '-d', database], { input: archive });

function openDatabase(port, database) {
  return new pg.Pool({
    host: '127.0.0.1', port, database, user: 'postgres', password, ssl: false,
    options: '-c search_path=public', connectionTimeoutMillis: 3000, statement_timeout: 10000
  });
}

function gatewayFor(port, database) {
  const db = openDatabase(port, database);
  const runtime = createRuntime(db, {
    ...readConfig({ DATABASE_URL: 'local-drill', PROOF_MODE: 'test', ENABLE_TCP_RECEIVER: 'false' }),
    host: '127.0.0.1', httpPort: 0
  }, { worker: false, logger: { info() {}, warn() {}, error() {} } });
  return { db, runtime };
}

async function fixture(db, runtime) {
  const managed = await provisionCustomer(db, randomUUID(), 'Restore drill managed owner');
  let previousOwner, owner;
  await changeCustomerAccess(db, managed.customer_id, '0', credential => { previousOwner = credential; });
  await changeCustomerAccess(db, managed.customer_id, '1', credential => { owner = credential; });
  const other = await provisionTenant(db, 'Restore drill other tenant');
  const account = randomUUID();
  await db.query(
    "INSERT INTO customer_accounts(id,email,password_digest,verified_at) VALUES($1,'drill@example.test','disabled-backup-fixture',now())",
    [account]);
  await db.query("INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,'owner')",
    [account, owner.tenant_id]);
  const customerMail = createCustomerMail(db, { provider:'resend', from:'drill@example.test',
    tokenKey:randomBytes(32), apiKey:'re_drill_fixture' }, async () => assert.fail('No external delivery in the restore drill'));
  await transaction(db,null,client => customerMail.enqueue(client,'reset','drill@example.test',account));
  const telemetry = createTelemetryService(db);
  const device = await telemetry.register(owner.tenant_id, { label: 'Generated tracker', mode: 'real' });
  const bcd = '111222333444';
  await telemetry.bindAovxDevice(owner.tenant_id, null, { device_id: device.id, device_id_bcd: bcd });
  const shipment = await runtime.shipments.create(owner.tenant_id, {
    name: 'Restore drill shipment', device_id: device.id,
    route: [{ name: 'Origin', latitude: 51, longitude: 17 }, { name: 'Destination', latitude: 50, longitude: 30 }],
    conditions: { temperature_min_c: 2, temperature_max_c: 8 }
  });
  const notifications = createNotifications(db);
  await notifications.setPreferences(owner.tenant_id, { enabled: true });
  await runtime.shipments.change(owner.tenant_id, shipment.id, 'active');
  await notifications.tick();
  const [delivered] = (await notifications.status(owner.tenant_id)).notifications;
  const integritas = createIntegritas(db);
  const prepared = await integritas.prepare(owner.tenant_id, delivered.event_id);
  await integritas.tick();
  await integritas.tick();
  await integritas.tick();
  assert.equal((await integritas.bundle(owner.tenant_id, prepared.id)).proof.status, 'verified');
  assert.equal(delivered.state, 'delivered');
  assert.equal(delivered.attempts, 1);
  return { owner, other, device, bcd, shipment, managed, previousOwner };
}

function packet(db, bcd, sequenceNumber) {
  const body = Buffer.alloc(40);
  body.writeUInt32BE(0x80000012, 4);
  Buffer.from('241101123456', 'hex').copy(body, 22);
  return persistPacket({
    payload: encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: Buffer.from(bcd, 'hex'), sequenceNumber, body }),
    aovx: { messageId: 0x0200, deviceIdBcd: bcd, sequenceNumber }
  }, db);
}

async function snapshot(db) {
  const tables = [
    ['gateway_schema_migrations', 'version'],
    ['managed_customers', 'customer_id'],
    ['customer_accounts', 'id'],
    ['customer_demo', 'account_id'],
    ['customer_demo_pilot', 'account_id'],
    ['customer_aovx_approvals', 'identifier_sha256'],
    ['customer_demo_pilot_audit', 'id'],
    ['customer_members', 'account_id'],
    ['customer_sessions', 'id'],
    ['customer_mail_tokens', 'token_hash'],
    ['customer_mail_jobs', 'id'],
    ['telemetry_api_keys', 'id'],
    ['gateway_packets', 'id'],
    ['telemetry_aovx_device_bindings', 'id'],
    ['telemetry_aovx_transfers', 'id'],
    ['telemetry_events', 'id'],
    ['telemetry_aovx_packet_events', 'packet_id'],
    ['cargo_shipments', 'id'],
    ['cargo_checkpoints', 'ordinal'],
    ['cargo_events', 'sequence'],
    ['cargo_outbox', 'event_id'],
    ['cargo_notification_preferences', 'tenant_id'],
    ['cargo_notification_deliveries', 'event_id'],
    ['cargo_notification_inbox', 'event_id'],
    ['cargo_integritas_requests', 'id'],
    ['cargo_integritas_states', 'request_id'],
    ['cargo_proofs', 'sequence'],
    ['cargo_proof_states', 'id'],
    ['cargo_proof_attempts', 'id']
  ];
  const result = {};
  for (const [table, order] of tables)
    result[table] = (await db.query('SELECT * FROM ' + table + ' ORDER BY ' + order)).rows;
  return result;
}

async function verifyMigrations(rows) {
  assert.deepEqual(rows.map(row => row.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => /^\d{3}_.*\.sql$/.test(file)).sort();
  assert.equal(files.length, rows.length);
  for (const [index, file] of files.entries())
    assert.equal(rows[index].checksum, hash(await readFile(new URL(file, directory))), file);
}

function verifyHistory(state, seeded, { linkCount, sampleCount }) {
  const events = state.telemetry_events;
  const links = state.telemetry_aovx_packet_events;
  assert.equal(events.length, sampleCount);
  assert.equal(links.length, linkCount, 'raw packet lineage is incomplete');
  for (const raw of state.gateway_packets) {
    assert.equal(raw.sha256, hash(raw.raw_payload));
    const link = links.find(row => row.packet_id === raw.id);
    if (raw.aovx_processing_state === 'pending') {
      assert.equal(link, undefined);
      continue;
    }
    assert.equal(raw.aovx_processing_state, 'processed');
    const event = events.find(row => row.id === link?.event_id);
    assert.ok(event, 'processed packet is linked to logical telemetry');
    assert.equal(link.tenant_id, seeded.owner.tenant_id);
    assert.equal(link.device_id, seeded.device.id);
    assert.equal(event.tenant_id, link.tenant_id);
    assert.equal(event.device_id, link.device_id);
    assert.equal(event.source, 'aovx-gal-v1');
    assert.equal(event.trust, 'unverified');
    assert.equal(event.parser_version, 'aovx-gal-v2');
    assert.equal(event.event_time_basis, 'gateway_received_at');
    assert.equal(event.device_time_raw, '241101123456');
    assert.equal(event.payload.gps, null);
    assert.equal(event.source_event_id, hash(decodeAovxFrame(raw.raw_payload).raw));
    assert.equal(event.canonical_sha256, hash(event.canonical_event));
    assert.deepEqual(JSON.parse(event.canonical_event), event.payload);
  }

  let previous = null;
  const cargo = state.cargo_events;
  assert.equal(cargo.length, 2 + sampleCount);
  assert.equal(state.cargo_outbox.length, cargo.length);
  for (const [index, row] of cargo.entries()) {
    assert.equal(Number(row.sequence), index + 1);
    assert.equal(row.previous_hash, previous);
    assert.equal(row.sha256, hash(row.canonical_payload));
    const canonical = JSON.parse(row.canonical_payload);
    assert.equal(canonical.sequence, index + 1);
    assert.equal(canonical.previous_hash, previous);
    if (index >= 2) {
      assert.equal(row.event_type, 'telemetry_recorded');
      const telemetry = events.find(event => event.id === canonical.data.telemetry_event_id);
      assert.equal(canonical.data.canonical_sha256, telemetry.canonical_sha256);
    }
    const jobs = state.cargo_outbox.filter(job => job.event_id === row.id);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].tenant_id, row.tenant_id);
    assert.equal(jobs[0].proof_enqueued_at, null);
    previous = row.sha256;
  }
  assert.equal(state.cargo_shipments[0].status, 'active');
  assert.equal(state.cargo_shipments[0].head_hash, previous);
  assert.equal(Number(state.cargo_shipments[0].event_sequence), cargo.length);
  assert.ok(state.cargo_checkpoints.every(row => row.visited_at === null));
}

async function exportEvidence(runtime, { owner, other }, proofId) {
  const url = 'http://127.0.0.1:' + runtime.gateway.api.address().port + '/v1/proofs/' + proofId + '/bundle';
  const request = token => fetch(url, {
    headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(5000)
  });
  const forbidden = await request(other.token);
  assert.equal(forbidden.status, 404);
  await forbidden.body.cancel();
  const response = await request(owner.token);
  assert.equal(response.status, 200);
  const bundle = await response.text();
  const evidence = JSON.parse(bundle);
  assert.equal(evidence.proof.mode, 'test');
  assert.equal(evidence.proof.txpow_id, null);
  assert.equal(evidence.proof.transaction_id, null);
  assert.match(evidence.proof.test_receipt, /^test:/);
  assert.deepEqual(await verifyBundle(evidence, {}), {
    verified: false, status: 'test', reason: 'TEST_ONLY_NOT_BLOCKCHAIN', hash_chain_valid: true
  });
  return bundle;
}

let clusterCreated = false;
let gateway;
try {
  docker(['create', '--name', name, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD', image], {
    env: { ...dockerEnv, POSTGRES_PASSWORD: password }
  });
  clusterCreated = true;
  docker(['start', name]);
  const deadline = Date.now() + 45000;
  for (;;) {
    try {
      inside('pg_isready', '-h', '127.0.0.1', '-U', 'postgres');
      break;
    } catch (err) {
      if (Date.now() >= deadline) throw err;
      await delay(400);
    }
  }
  const binding = docker(['port', name, '5432/tcp']).toString().trim();
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const port = Number(binding.split(':')[1]);
  for (const database of [source, recovered, damaged, incomplete])
    inside('createdb', '-U', 'postgres', '-T', 'template0', database);

  gateway = gatewayFor(port, source);
  await gateway.runtime.gateway.start();
  const { db, runtime } = gateway;
  const seeded = await fixture(db, runtime);
  // Back up one acknowledged job, one expired lease and one pending job.
  const jobs = await claimOutbox(db);
  const created = jobs.find(job => job.event_type === 'shipment_created');
  const active = jobs.find(job => job.event_type === 'status_changed');
  await acknowledge(db, created.tenant_id, created.id, created.lease_token);
  await db.query("UPDATE cargo_outbox SET lease_until=now()-interval '1 second' WHERE event_id=$1", [active.id]);
  const first = await packet(db, seeded.bcd, 1);
  const repeat = await packet(db, seeded.bcd, 1);
  const firstEvent = await runtime.aovxIngestion.processPacket(first.id);
  assert.equal(firstEvent.duplicate, false);
  assert.deepEqual(await runtime.aovxIngestion.processPacket(repeat.id), { ...firstEvent, duplicate: true });
  const pending = await packet(db, seeded.bcd, 2);
  await runtime.proofs.tick();
  // Exercise restoration of a populated promotion without adding another shipment
  // to the independent cargo-chain fixture.
  const demoAccount = randomUUID();
  const demoArchive = randomUUID();
  await db.query("INSERT INTO telemetry_tenants(id,name) VALUES($1,'Backup demo archive')", [demoArchive]);
  await db.query("INSERT INTO customer_accounts(id,email,password_digest,verified_at) VALUES($1,'restore-demo@example.test',$2,now())",
    [demoAccount, await createPasswordDigest(randomBytes(24).toString('hex'))]);
  await db.query("INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,'viewer')", [demoAccount,demoArchive]);
  await db.query('INSERT INTO customer_demo(account_id,tenant_id) VALUES($1,$2)', [demoAccount,demoArchive]);
  const pilot = await administerPilot(db, 'promote', {
    name: 'Backup physical pilot', identifiers: ['555222333444'], password: randomBytes(24).toString('hex')
  });
  const baseline = await snapshot(db);
  await verifyMigrations(baseline.gateway_schema_migrations);
  verifyHistory(baseline, seeded, { linkCount: 2, sampleCount: 1 });
  assert.equal(baseline.cargo_proofs.length, 2);
  assert.ok(baseline.cargo_proof_states.length > 0);
  const proofId = baseline.cargo_proofs.at(-1).id;
  const evidence = await exportEvidence(runtime, seeded, proofId);

  const backupStart = performance.now();
  const archive = dump();
  const backupMs = Math.round(performance.now() - backupStart);
  const incompleteArchive = dump('--exclude-table-data=public.telemetry_aovx_packet_events');
  console.log('Backup SHA-256:', hash(archive), '· bytes:', archive.length);
  await runtime.gateway.shutdown();
  gateway = undefined;

  for (const [label, broken] of [
    ['corrupted header', Buffer.concat([Buffer.from('BROKE'), archive.subarray(5)])],
    ['truncated archive', archive.subarray(0, archive.length - 32)]
  ]) {
    assert.throws(() => restore(damaged, broken), error =>
      Number.isInteger(error.status) && error.status !== 0 && /pg_restore: error:/.test(error.stderr.toString())
    );
    assert.equal(psql(damaged, "SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0');
    console.log('PASS:', label, 'rejected without partially restoring tables');
  }

  restore(incomplete, incompleteArchive);
  // Read the incomplete copy without starting the application or replaying data.
  const incompleteDB = openDatabase(port, incomplete);
  try {
    const partial = await snapshot(incompleteDB);
    assert.throws(() => verifyHistory(partial, seeded, { linkCount: 2, sampleCount: 1 }),
      /raw packet lineage is incomplete/);
  } finally {
    await incompleteDB.end();
  }
  console.log('PASS: structurally valid but incomplete archive failed the lineage gate');

  const recoveryStart = performance.now();
  restore(recovered, archive);
  gateway = gatewayFor(port, recovered);
  await gateway.runtime.gateway.start();
  const restored = await snapshot(gateway.db);
  await verifyMigrations(restored.gateway_schema_migrations);
  assert.deepEqual(restored, baseline, 'restore and startup changed the backup evidence');
  verifyHistory(restored, seeded, { linkCount: 2, sampleCount: 1 });
  const restoredPilot = await administerPilot(gateway.db, 'inspect');
  assert.equal(restoredPilot.pilot_tenant_id, pilot.pilot_tenant_id);
  assert.equal(restoredPilot.active, true);
  assert.equal(restored.customer_aovx_approvals.length, 1);
  assert.equal(restored.customer_demo_pilot_audit[0].action, 'promote');
  const restoredNotifications = createNotifications(gateway.db);
  await restoredNotifications.tick();
  assert.deepEqual((await snapshot(gateway.db)).cargo_notification_inbox, baseline.cargo_notification_inbox);
  assert.deepEqual((await restoredNotifications.status(seeded.other.tenant_id)).notifications, []);
  await assert.rejects(gateway.db.query('UPDATE cargo_events SET sha256=sha256'), /immutable/);
  await assert.rejects(gateway.db.query('DELETE FROM cargo_events'), /immutable/);
  assert.equal(await exportEvidence(gateway.runtime, seeded, proofId), evidence);
  const managed = await customerStatus(gateway.db, seeded.managed.customer_id);
  assert.equal(managed.tenant_id, seeded.owner.tenant_id);
  assert.equal(managed.access_revision, 2);
  assert.equal(managed.access, 'active');
  const oldAccess = await fetch('http://127.0.0.1:' + gateway.runtime.gateway.api.address().port + '/v1/devices',
    { headers: { authorization: 'Bearer ' + seeded.previousOwner.token }, signal: AbortSignal.timeout(5000) });
  assert.equal(oldAccess.status, 401);
  await oldAccess.body.cancel();
  console.log('PASS: restored managed registration, current owner access and previous key revocation');
  console.log('Local dump and verified recovery (ms):', backupMs, Math.round(performance.now() - recoveryStart),
    '· fixture writes lost at quiescent cut: 0');
  console.log('PASS: 001–016 checksums, packet lineage, immutable ledger, outbox, local inbox and test proof export');

  await gateway.db.query(`
    CREATE FUNCTION drill_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'drill outbox failure'; END $$;
    CREATE TRIGGER drill_reject_outbox BEFORE INSERT ON cargo_outbox
    FOR EACH ROW EXECUTE FUNCTION drill_reject_outbox();
  `);
  await assert.rejects(gateway.runtime.aovxIngestion.processPacket(pending.id), /drill outbox failure/);
  assert.deepEqual(await snapshot(gateway.db), baseline, 'failed outbox write must leave the packet pending');
  await gateway.db.query('DROP TRIGGER drill_reject_outbox ON cargo_outbox');
  assert.deepEqual(await gateway.runtime.aovxIngestion.processPending(), { processed: 1 });
  assert.deepEqual(await gateway.runtime.aovxIngestion.processPending(), { processed: 0 });
  assert.deepEqual(await gateway.runtime.aovxIngestion.processPacket(pending.id), { processed: false, reason: 'not-pending' });
  const newRepeat = await packet(gateway.db, seeded.bcd, 2);
  assert.ok(BigInt(newRepeat.id) > BigInt(pending.id), 'raw packet sequence resumes above restored IDs');
  assert.equal((await gateway.runtime.aovxIngestion.processPacket(newRepeat.id)).duplicate, true);
  const reclaimed = await claimOutbox(gateway.db);
  const expired = reclaimed.find(job => job.event_type === 'status_changed');
  const oldLease = baseline.cargo_outbox.find(job => job.event_id === expired.id);
  assert.notEqual(expired.lease_token, oldLease.lease_token);
  await assert.rejects(acknowledge(gateway.db, expired.tenant_id, expired.id, oldLease.lease_token), { status: 409 });
  await acknowledge(gateway.db, expired.tenant_id, expired.id, expired.lease_token);
  assert.ok(!reclaimed.some(job => job.event_type === 'shipment_created'));
  await gateway.runtime.proofs.tick();
  const resumed = await snapshot(gateway.db);
  verifyHistory(resumed, seeded, { linkCount: 4, sampleCount: 2 });
  assert.deepEqual(resumed.cargo_events.slice(0, baseline.cargo_events.length), baseline.cargo_events);
  assert.deepEqual(resumed.cargo_proofs, baseline.cargo_proofs);
  console.log('PASS: restored physical pilot membership, verified inventory and migration audit');
  console.log('PASS: restart, outbox rollback, pending ingestion, duplicate replay, sequences and lease recovery');
} finally {
  try {
    await gateway?.runtime.gateway.shutdown();
  } finally {
    if (clusterCreated) docker(['rm', '-f', '-v', name]);
  }
}
