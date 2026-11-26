import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, symlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { encodeAovxFrame, decodeAovxFrame } from '../src/aovx/frame.js';
import { administerPilot } from '../src/cargo/pilot-admin.js';
import { createPasswordDigest } from '../src/cargo/accounts.js';
import { createCustomerMail } from '../src/cargo/customer-mail.js';
import { provisionDevices, administerActivation } from '../src/cargo/device-activation.js';
import { createNotifications } from '../src/cargo/notifications.js';
import { acknowledge, claimOutbox } from '../src/cargo/outbox.js';
import { createRuntime } from '../src/cargo/runtime.js';
import { hash, transaction } from '../src/cargo/shared.js';
import { readConfig } from '../src/config.js';
import { persistPacket } from '../src/journal.js';
import { changeCustomerAccess, customerStatus, provisionCustomer } from '../src/managed/service.js';
import { createIntegritas } from '../src/proofs/integritas.js';
import { verifyBundle } from '../src/proofs/verifier.js';
import { decodeShape } from '../src/routing/contract.js';
import { createRouteRevisions } from '../src/routing/revisions.js';
import { migrate } from '../src/telemetry/migrate.js';
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

function openDatabase(port, database, options = '-c search_path=public') {
  return new pg.Pool({
    host: '127.0.0.1', port, database, user: 'postgres', password, ssl: false,
    options, connectionTimeoutMillis: 3000, statement_timeout: 10000
  });
}

function gatewayFor(port, database, runtimeFactory = createRuntime) {
  const db = openDatabase(port, database);
  const runtime = runtimeFactory(db, {
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
  return { owner, other, device, bcd, shipment, managed, previousOwner, account };
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

async function snapshot(db, includeRoutes = true) {
  const tables = [
    ['gateway_schema_migrations', 'version'],
    ['managed_customers', 'customer_id'],
    ['customer_accounts', 'id'],
    ['customer_demo', 'account_id'],
    ['customer_demo_pilot', 'account_id'],
    ['customer_aovx_approvals', 'identifier_sha256'],
    ['customer_demo_pilot_audit', 'id'],
    ['customer_members', 'account_id, tenant_id'],
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
    ['cargo_checkpoints', 'tenant_id, shipment_id, ordinal'],
    ['cargo_events', 'tenant_id, shipment_id, sequence'],
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
  if (includeRoutes) tables.push(
    ['cargo_road_route_revisions', 'tenant_id, shipment_id, version'],
    ['cargo_road_route_heads', 'tenant_id, shipment_id'],
    ['cargo_road_route_audit', 'tenant_id, shipment_id, generation, state'],
    ['device_activation_inventory', 'serial']
  );
  const result = {};
  for (const [table, order] of tables)
    result[table] = (await db.query('SELECT * FROM ' + table + ' ORDER BY ' + order)).rows;
  return result;
}

async function verifyMigrations(rows) {
  assert.deepEqual(rows.map(row => row.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
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

const b2Commit = 'e97647e98d0c44b6e6c773dfc0c34d4a490ef01a';
const gatewayDirectory = new URL('../', import.meta.url);
let b2Directory;
async function loadB2() {
  b2Directory = await mkdtemp(join(tmpdir(), 'trackium-b2-source-'));
  const archive = execFileSync('git', ['archive', b2Commit, 'services/gateway'], {
    cwd: new URL('../../../', import.meta.url), maxBuffer: 16 * 1024 * 1024
  });
  execFileSync('tar', ['-xf', '-', '-C', b2Directory], {input:archive});
  const oldGateway = join(b2Directory,'services/gateway');
  assert.deepEqual(await readFile(join(oldGateway,'package-lock.json')),
    await readFile(new URL('package-lock.json',gatewayDirectory)), 'B2 dependencies must match the pinned lockfile');
  await symlink(fileURLToPath(new URL('node_modules',gatewayDirectory)), join(oldGateway,'node_modules'), 'dir');
  return (await import(pathToFileURL(join(oldGateway,'src/cargo/runtime.js')).href)).createRuntime;
}

async function seedRoadRoutes(db, seeded) {
  const keys = [seeded.owner.tenant_id, seeded.shipment.id];
  const points = [{latitude:51,longitude:17},{latitude:50,longitude:30}];
  const actor = {account_id:seeded.account};
  const stored = [];
  const shapes = ['_kxg`B_crl_@~b`|@_smxW','_kxg`B_crl_@~flW_{fjL~zrc@_wemJ'];
  // Controlled road-planning results for storage acceptance only. No observations or engine calls.
  for (const [index, digit] of ['1','2'].entries()) {
    const calculation = {
      profile:'auto', calculated_at:'2026-01-01T00:00:00.000Z',
      graph:{id:digit.repeat(64),engine_version:'3.6.3',osm_snapshot:'2026-01-01'},
      route:{geometry_format:'polyline6',distance_m:950000 + index * 1000,estimated_duration_s:36000 + index * 60,
        legs:[{shape:shapes[index],distance_m:950000 + index * 1000,
          estimated_duration_s:36000 + index * 60,
          maneuvers:[{type:1,instruction:'Continue on fixture road',distance_m:950000 + index * 1000,
            estimated_duration_s:36000 + index * 60,begin_shape_index:0,end_shape_index:index+1}]}]},
      alternatives:{status:'unsupported',routes:[]},warnings:['STATIC_OSM_SNAPSHOT']
    };
    const service = createRouteRevisions(db,{calculate:async () => calculation});
    const {revision} = await service.propose(actor,keys,{profile:'auto',points},index*3,randomUUID());
    await service.transition(actor,keys,revision.id,'approve',index*3+1);
    await service.transition(actor,keys,revision.id,'activate',index*3+2);
    stored.push({id:revision.id,calculation});
  }
  return {keys,actor,stored,points};
}

async function verifyRoadRoutes(db, state, fixture) {
  const {keys,actor,stored,points} = fixture;
  const service = createRouteRevisions(db,null);
  assert.equal(state.cargo_road_route_revisions.length,2);
  assert.equal(state.cargo_road_route_heads.length,1);
  assert.equal(state.cargo_road_route_audit.length,7);
  const active = await service.read(keys,'active');
  assert.equal(active.generation,6);
  assert.equal(active.active_revision_id,stored[1].id);
  assert.equal(active.revision.id,stored[1].id);
  for (const [index, saved] of stored.entries()) {
    const {revision} = await service.read(keys,'detail',[saved.id]);
    assert.equal(revision.version,index+1);
    assert.equal(revision.state,index === 0 ? 'superseded' : 'active');
    assert.deepEqual(revision.stops,points);
    assert.deepEqual(revision.calculation,saved.calculation);
    const geometry = decodeShape(revision.calculation.route.legs[0].shape);
    assert.deepEqual([geometry[0],geometry.at(-1)],points);
    assert.deepEqual(revision.audit.map(row => row.state),index === 0
      ? ['proposed','approved','active','superseded'] : ['proposed','approved','active']);
    assert.deepEqual(revision.audit.map(row => row.generation),index === 0 ? [1,2,3,6] : [4,5,6]);
    for (const row of revision.audit) {
      assert.equal(row.actor_account_id,actor.account_id);
      assert.ok(Number.isFinite(Date.parse(row.occurred_at)));
    }
  }
}

async function verifyRouteConstraints(db, fixture, otherTenant) {
  const {keys,stored} = fixture;
  const [first,second] = stored;
  await assert.rejects(db.query('UPDATE cargo_road_route_revisions SET calculation=calculation WHERE id=$1',[first.id]),/immutable/);
  await assert.rejects(db.query('DELETE FROM cargo_road_route_audit WHERE revision_id=$1',[first.id]),/immutable/);
  await assert.rejects(db.query('UPDATE cargo_road_route_heads SET active_revision_id=$3 WHERE tenant_id=$1 AND shipment_id=$2',
    [...keys,randomUUID()]),{code:'23503'});
  // Heads on a different shipment, both within and outside the original tenant.
  for (const tenant of [keys[0],otherTenant]) {
    const id = randomUUID();
    await assert.rejects(transaction(db,null,async client => {
      const device = await createTelemetryService(db).register(tenant,
        {mode:'synthetic',label:'Restore FK fixture'},undefined,client);
      await client.query(`INSERT INTO cargo_shipments(id,tenant_id,name,device_id,source_trust,route,conditions)
        VALUES($1,$2,'FK fixture',$3,'synthetic','[]','{}')`,[id,tenant,device.id]);
      await client.query(`INSERT INTO cargo_road_route_heads(tenant_id,shipment_id,generation,active_revision_id)
        VALUES($1,$2,6,$3)`,[tenant,id,second.id]);
    }), {code:'23503'});
  }
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

  const b2 = await loadB2();
  gateway = gatewayFor(port, source, b2);
  await gateway.runtime.gateway.start();
  const seeded = await fixture(gateway.db, gateway.runtime);
  const before = await snapshot(gateway.db,false);
  assert.equal(before.gateway_schema_migrations.at(-1).version,16);
  assert.equal(before.cargo_shipments.length,1);
  assert.equal(before.cargo_checkpoints.length,2);
  await gateway.runtime.gateway.shutdown();
  gateway = undefined;

  const upgrade = openDatabase(port,source);
  const bounded = openDatabase(port,source,'-c search_path=public -c lock_timeout=2s');
  const blocker = await upgrade.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE cargo_shipments IN ROW EXCLUSIVE MODE');
    const timedOut = assert.rejects(migrate(bounded),{code:'55P03'});
    let waiting;
    const lockDeadline = Date.now() + 1500;
    do {
      const {rows} = await upgrade.query(`SELECT mode FROM pg_locks
        WHERE relation='cargo_shipments'::regclass AND NOT granted`);
      waiting = rows.map(row => row.mode);
      if (waiting.length) break;
      await delay(25);
    } while (Date.now() < lockDeadline);
    await timedOut;
    assert.deepEqual(waiting,['ShareRowExclusiveLock']);
    assert.deepEqual(await snapshot(upgrade,false),before);
    assert.equal((await upgrade.query("SELECT to_regclass('cargo_road_route_revisions') AS relation")).rows[0].relation,null);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await bounded.end();
    await upgrade.end();
  }

  gateway = gatewayFor(port, source);
  await gateway.runtime.gateway.start();
  const { db, runtime } = gateway;
  const after = await snapshot(db,false);
  assert.equal(after.gateway_schema_migrations.pop().version,18);
  assert.equal(after.gateway_schema_migrations.pop().version,17);
  assert.deepEqual(after,before);
  const catalog = await db.query(`SELECT
    (SELECT count(*)::int FROM pg_constraint WHERE conrelid IN
      ('cargo_road_route_heads'::regclass,'cargo_road_route_audit'::regclass,'cargo_road_route_revisions'::regclass)
      AND contype='f') AS foreign_keys,
    to_regclass('cargo_road_route_audit_revision') IS NOT NULL AS audit_index,
    (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('cargo_road_route_audit_immutable','cargo_road_route_revision_immutable')) AS immutable_triggers`);
  assert.deepEqual(catalog.rows[0],{foreign_keys:5,audit_index:true,immutable_triggers:2});
  const routes = await seedRoadRoutes(db,seeded);
  const upgraded = await snapshot(db);
  await verifyRoadRoutes(db,upgraded,routes);
  await migrate(db);
  assert.deepEqual(await snapshot(db),upgraded);
  await db.query("UPDATE gateway_schema_migrations SET checksum='bad' WHERE version=17");
  await assert.rejects(migrate(db),/checksum mismatch/);
  await db.query("UPDATE gateway_schema_migrations SET checksum=$1 WHERE version=17",[upgraded.gateway_schema_migrations.find(row => row.version === 17).checksum]);
  assert.deepEqual(await snapshot(db),upgraded);
  console.log('PASS: populated v016 upgrade, DDL lock timeout rollback, idempotency and rejected v017 checksum mismatch');
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
  await provisionDevices(db,[{serial:'DRILL-INVENTORY',device_id_bcd:'199999999997'}],async () => {});
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
  gateway = gatewayFor(port, recovered, b2);
  await gateway.runtime.gateway.start();
  const b2Response = await fetch('http://127.0.0.1:' + gateway.runtime.gateway.api.address().port +
    '/v1/shipments/' + seeded.shipment.id, {
    headers:{authorization:'Bearer ' + seeded.owner.token},signal:AbortSignal.timeout(5000)
  });
  assert.equal(b2Response.status,200);
  assert.equal((await b2Response.json()).id,seeded.shipment.id);
  assert.deepEqual(await snapshot(gateway.db),baseline);
  await gateway.runtime.gateway.shutdown();
  gateway = gatewayFor(port, recovered);
  await gateway.runtime.gateway.start();
  const restored = await snapshot(gateway.db);
  assert.deepEqual(await administerActivation(gateway.db,'inspect','DRILL-INVENTORY'),{
    serial:'DRILL-INVENTORY',device_id_bcd:'199999999997',claimable:true,claimed:false,tenant_id:null,device_id:null
  });
  await verifyMigrations(restored.gateway_schema_migrations);
  assert.deepEqual(restored, baseline, 'restore and startup changed the backup evidence');
  await verifyRoadRoutes(gateway.db,restored,routes);
  await verifyRouteConstraints(gateway.db,routes,seeded.other.tenant_id);
  console.log('PASS: restored two road revisions, graphs, geometry, seven audit rows and active head at generation 6');
  console.log('PASS: Gateway B3 → B2 (' + b2Commit + ') → B3 without modifying restored history; offline reads verified');
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
  console.log('PASS: 001–018 checksums, packet lineage, immutable ledger, outbox, local inbox and test proof export');

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
    try { if (clusterCreated) docker(['rm', '-f', '-v', name]); }
    finally { if (b2Directory) await rm(b2Directory,{recursive:true,force:true}); }
  }
}
