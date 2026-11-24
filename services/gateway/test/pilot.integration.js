import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { readConfig } from '../src/config.js';
import { createAccounts } from '../src/cargo/accounts.js';
import { createRuntime } from '../src/cargo/runtime.js';
import { administerDemo } from '../src/cargo/demo-admin.js';
import { administerPilot } from '../src/cargo/pilot-admin.js';
import { provisionTenant } from '../src/telemetry/service.js';
import { persistPacket } from '../src/journal.js';
import { encodeAovxFrame } from '../src/aovx/frame.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');

test('closed demo promotion, authorized AOVX onboarding and evidence-preserving rollback', { timeout: 40000 }, async t => {
  const schema = 'physical_pilot_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query('CREATE SCHEMA ' + schema);
  const scoped = new URL(url);
  scoped.searchParams.set('options', '-c search_path=' + schema);
  const db = new pg.Pool({ connectionString: scoped.href });
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = 'http://127.0.0.1:' + port;
  const config = readConfig({ DATABASE_URL: scoped.href, PUBLIC_ORIGIN: origin, HTTP_PORT: String(port),
    ENABLE_TCP_RECEIVER: 'false', ENABLE_WEB_WORKSPACE: 'true', INTEGRITAS_MODE: 'test',
    CUSTOMER_DEMO_ENABLED: 'true', CUSTOMER_DEMO_PILOT_ENABLED: 'true' });
  const runtime = createRuntime(db, { ...config, host: '127.0.0.1' }, { worker: false, logger: { info(){}, error(){} } });
  const dir = await mkdtemp(join(tmpdir(), 'trackium-pilot-'));
  t.after(async () => {
    await runtime.gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
    await rm(dir, { recursive: true, force: true });
  });
  await runtime.gateway.start();
  const original = 'local viewer fixture password', rotated = 'local pilot fixture password';
  const rollback = 'local rollback fixture password';
  const bcd = '555111222333', otherBcd = '555111222444';
  const passwordFile = join(dir, 'rotation'), deviceFile = join(dir, 'inventory');
  await writeFile(passwordFile, rotated + '\n', { mode: 0o600 });
  await writeFile(deviceFile, bcd + '\n', { mode: 0o600 });
  const cli = (...args) => promisify(execFile)(process.execPath, ['src/cargo/pilot-cli.js', ...args],
    { env: { ...process.env, DATABASE_URL: scoped.href } });
  const planArgs = ['--name=Pilot fixtures', '--device-file=' + deviceFile];
  await administerDemo(db, 'bootstrap', { password: original });
  const archive = JSON.parse((await cli('inspect')).stdout);
  const archiveEvidence = async () => (await db.query(
    'SELECT id,sha256 FROM cargo_events WHERE tenant_id=$1 ORDER BY id', [archive.archive_tenant_id])).rows;
  const evidence = await archiveEvidence();
  const call = async (path, { data, cookie, csrf } = {}) => {
    const response = await fetch(origin + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'X-Trackium-Client': 'cargo-v2', 'sec-fetch-site': 'same-origin', origin,
        'content-type': 'application/json', ...(cookie && {cookie}), ...(csrf && {'x-csrf-token':csrf}) },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, value: await response.json(),
      cookie: response.headers.getSetCookie()[0]?.split(';')[0] };
  };
  const login = password => call('/v1/account/login', { data: { username: 'trackium-demo', password } });
  const session = async cookie => {
    const response = await call('/v1/account/session', { cookie });
    assert.equal(response.status, 200);
    return { cookie, csrf: response.value.csrf, identity: response.value };
  };
  const viewer = await session((await login(original)).cookie);
  assert.equal(viewer.identity.role, 'viewer');
  const enrollment = data => ({ label: 'Physical pilot tracker', device_id_bcd: bcd, ownership: 'confirmed', ...data });
  assert.equal((await call('/v1/account/aovx-enroll', { ...viewer, data: enrollment() })).status, 403);

  const foreign = await provisionTenant(db, 'Other company');
  const foreignDevice = await runtime.telemetry.register(foreign.tenant_id, { label: 'Foreign tracker', mode: 'real' });
  await runtime.telemetry.bindAovxDevice(foreign.tenant_id, null, { device_id: foreignDevice.id, device_id_bcd: otherBcd });
  await runtime.telemetry.revokeAovxDevice(foreign.tenant_id, otherBcd);
  await assert.rejects(administerPilot(db, 'plan', { name: 'Other plan', identifiers: [otherBcd] }), /unavailable/);
  const planned = await cli('plan', ...planArgs);
  assert.equal(JSON.parse(planned.stdout).status, 'dry-run');
  assert.doesNotMatch(planned.stdout, new RegExp(bcd));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM customer_demo_pilot')).rows[0].n, 0);
  await assert.rejects(administerPilot(db, 'promote', { name: 'Pilot fixtures', identifiers: [bcd], password: original }),
    /distinct/);

  await db.query("ALTER TABLE customer_demo_pilot_audit ADD CONSTRAINT test_fail_promote CHECK (action<>'promote')");
  await assert.rejects(administerPilot(db, 'promote', { name: 'Pilot fixtures', identifiers: [bcd], password: rotated }));
  assert.equal((await call('/v1/session', viewer)).status, 200);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM telemetry_tenants WHERE name='Pilot fixtures'")).rows[0].n, 0);
  await db.query('ALTER TABLE customer_demo_pilot_audit DROP CONSTRAINT test_fail_promote');
  const promotion = JSON.parse((await cli('promote', ...planArgs, '--password-file=' + passwordFile, '--approve=promote')).stdout);
  assert.equal(promotion.account_id, archive.account_id);
  assert.equal((await call('/v1/session', viewer)).status, 401);
  assert.equal((await login(original)).status, 401);
  const owner = await session((await login(rotated)).cookie);
  assert.equal(owner.identity.tenant_id, promotion.pilot_tenant_id);
  assert.equal(owner.identity.role, 'owner');
  assert.equal(owner.identity.can_enroll_aovx, true);
  assert.deepEqual(owner.identity.scopes, ['read', 'shipments']);
  assert.equal(owner.identity.companies.length, 1);
  const gateOff = createAccounts(db, { ...config, pilotEnabled: false }, runtime.pairing, runtime.telemetry, null);
  await assert.rejects(gateOff.session({ headers: { cookie: owner.cookie, origin, host: new URL(origin).host, 'x-trackium-client': 'cargo-v2', 'sec-fetch-site': 'same-origin' } }),
    { status: 401 });
  assert.equal((await call('/v1/shipments', owner)).value.shipments.length, 0);
  assert.equal((await call('/v1/devices/' + foreignDevice.id, owner)).status, 404);
  assert.equal((await call('/v1/account/company', { ...owner, data: { name: 'Unapproved' } })).status, 404);
  assert.equal((await call('/v1/proof-publisher', owner)).status, 404);
  assert.equal((await call('/v1/integritas/proofs', { ...owner, data: {} })).status, 403);
  const enroll = data => call('/v1/account/aovx-enroll', { ...owner, data: enrollment(data) });
  assert.equal((await call('/v1/account/aovx-enroll', { cookie: owner.cookie, data: enrollment() })).status, 403);
  assert.equal((await enroll({ ownership: 'absent' })).status, 400);
  assert.equal((await enroll({ device_id_bcd: 'bad' })).status, 400);
  assert.equal((await enroll({ device_id_bcd: otherBcd })).status, 409);
  assert.equal((await call('/v1/devices', owner)).value.devices.length, 0);
  const attempts = await Promise.all([enroll(), enroll()]);
  assert.deepEqual(attempts.map(response => response.status).sort(), [201,409]);
  const device = attempts.find(response => response.status === 201).value;
  assert.equal(device.identity_kind, 'physical');
  assert.equal((await call('/v1/devices', owner)).value.devices.length, 1);

  const body = Buffer.alloc(40);
  body.writeUInt32BE(2, 4);
  body.writeUInt32BE(51110000, 8);
  body.writeUInt32BE(17040000, 12);
  const digits = new Date(Date.now() - 2000).toISOString().slice(2,19).replace(/\D/g, '');
  Buffer.from(digits, 'hex').copy(body, 22);
  const packet = await persistPacket({ payload: encodeAovxFrame({
    messageId: 0x0200, deviceIdBcd: Buffer.from(bcd, 'hex'), sequenceNumber: 1, body
  }), aovx: { messageId: 0x0200, deviceIdBcd: bcd } }, db);
  assert.equal((await runtime.aovxIngestion.processPacket(packet.id)).processed, true);
  const diagnostics = (await call('/v1/devices/' + device.id + '/diagnostics', owner)).value;
  assert.equal(diagnostics.trust, 'unverified');
  assert.equal(diagnostics.position.last_known.latitude, 51.11);
  assert.deepEqual(await archiveEvidence(), evidence);

  await writeFile(passwordFile, rollback + '\n', { mode: 0o600 });
  await cli('rollback', '--password-file=' + passwordFile, '--approve=rollback');
  assert.equal((await call('/v1/session', owner)).status, 401);
  assert.equal((await login(rotated)).status, 401);
  const again = await session((await login(rollback)).cookie);
  assert.equal(again.identity.role, 'viewer');
  assert.equal(again.identity.tenant_id, archive.archive_tenant_id);
  assert.equal((await call('/v1/devices/' + device.id, again)).status, 404);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM telemetry_events WHERE tenant_id=$1',
    [promotion.pilot_tenant_id])).rows[0].n, 1);
  assert.deepEqual(await archiveEvidence(), evidence);
  assert.deepEqual((await db.query('SELECT action FROM customer_demo_pilot_audit ORDER BY id')).rows,
    [{ action: 'promote' }, { action: 'rollback' }]);
});
