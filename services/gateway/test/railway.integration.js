import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import http from 'node:http';
import pg from 'pg';
import { migrate } from '../src/telemetry/migrate.js';
import { initialize } from '../src/journal.js';
import { provisionTenant, issueKey, createTelemetryService } from '../src/telemetry/service.js';
import { nativePopKey, nativeMac } from '../src/cargo/native-session.js';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw Error('TEST_DATABASE_URL required (disposable PostgreSQL database)');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function port() {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const value = s.address().port; await new Promise((r) => s.close(r)); return value;
}

test('Railway process: upgrade 001–005, owner pairing, PostgreSQL persistence and SIGTERM restart with publication disabled',
  { timeout: 40000 }, async (t) => {
    const admin = new pg.Pool({ connectionString: database });
    const schema = 'railway_' + randomUUID().replaceAll('-', '');
    await admin.query('CREATE SCHEMA ' + schema);
    const connection = new URL(database);
    connection.searchParams.set('options', '-c search_path=' + schema);
    const db = new pg.Pool({ connectionString: connection.href });
    let child;
    async function stop() {
      if (!child || child.exitCode !== null) return;
      const process = child;
      const exited = once(process, 'exit');
      process.kill('SIGTERM');
      const timer = setTimeout(() => process.kill('SIGKILL'), 12000);
      try { assert.deepEqual(await exited, [0, null], 'SIGTERM must drain and exit cleanly'); }
      finally { clearTimeout(timer); }
    }
    t.after(async () => {
      try { await stop(); } finally {
        await db.end(); await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); await admin.end();
      }
    });
    // Model an existing deployment on migration 004 using the unmodified SQL.
    await initialize(db);
    await db.query('CREATE TABLE gateway_schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const [i, name] of ['001_telemetry.sql', '002_cargo.sql', '003_proofs.sql', '004_publisher_safety.sql'].entries()) {
      const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
      await db.query(sql);
      await db.query('INSERT INTO gateway_schema_migrations(version,checksum) VALUES($1,$2)', [i + 1, sha(sql)]);
    }
    const a = await provisionTenant(db, 'Railway A'), b = await provisionTenant(db, 'Railway B');
    const owner = await issueKey(db, a.tenant_id, ['read', 'admin', 'publish']);
    const other = await issueKey(db, b.tenant_id, ['read', 'admin', 'publish']);
    await Promise.all([migrate(db), migrate(db)]);
    const migrations = (await db.query('SELECT * FROM gateway_schema_migrations ORDER BY version')).rows;
    assert.deepEqual(migrations.map((m) => m.version), [1, 2, 3, 4, 5]);
    // A mismatch in any migration, including 005, must abort rather than replay.
    for (const row of migrations) {
      await db.query("UPDATE gateway_schema_migrations SET checksum='changed' WHERE version=$1", [row.version]);
      await assert.rejects(migrate(db), /checksum mismatch/);
      await db.query('UPDATE gateway_schema_migrations SET checksum=$2 WHERE version=$1', [row.version, row.checksum]);
    }
    const telemetry = createTelemetryService(db);
    const deviceA = await telemetry.register(a.tenant_id, { label: 'A synthetic', mode: 'synthetic' });
    const deviceB = await telemetry.register(b.tenant_id, { label: 'B synthetic', mode: 'synthetic' });
    const httpPort = await port();
    const origin = 'http://127.0.0.1:' + httpPort;
    async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
      return new Promise((resolve, reject) => {
        const req = http.request(origin + path, {
          method, headers: { host: 'gateway.test', ...(token ? { authorization: 'Bearer ' + token } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        }, (response) => {
          let raw = '';
          response.on('data', (x) => { raw += x; });
          response.on('error', reject);
          response.on('end', () => {
            try {
              const resultHeaders = new Headers();
              for (const [key, value] of Object.entries(response.headers))
                for (const item of Array.isArray(value) ? value : [value])
                  resultHeaders.append(key, item);
              resolve({ status: response.statusCode, data: JSON.parse(raw), headers: resultHeaders });
            } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.end(body === undefined ? undefined : JSON.stringify(body));
      });
    }
    async function start(webEnabled = false) {
      let output = '';
      child = spawn(process.execPath, ['src/server.js'], {
        cwd: new URL('../', import.meta.url),
        // Deliberately minimal: no inherited Minima RPC credentials or flags.
        env: { PATH: process.env.PATH, DATABASE_URL: connection.href, PORT: String(httpPort),
          HTTP_PORT: String(await port()), DEPLOYMENT_PROFILE: 'railway-test',
          ENABLE_TCP_RECEIVER: 'false', ENABLE_NATIVE_CLIENTS: 'true',
          ENABLE_WEB_WORKSPACE: String(webEnabled), PUBLIC_ORIGIN: 'https://gateway.test',
          ENABLE_SERVER_SIMULATOR: 'false', ENABLE_FIXTURE_ADAPTER: 'false',
          PROOF_MODE: 'disabled', PROOF_ALLOW_LIVE: 'false', PROOF_ALLOW_MAINNET: 'false',
          PROOF_MAX_PUBLICATIONS: '1' }, stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', (x) => { output += x; });
      child.stderr.on('data', (x) => { output += x; });
      const deadline = Date.now() + 10000;
      while (true) {
        assert.equal(child.exitCode, null, 'Gateway exited before readiness');
        try { if ((await request('/readyz')).status === 200) break; } catch {}
        if (Date.now() > deadline) throw Error('Gateway readiness deadline');
        await wait(50);
      }
      assert.ok(output.includes('gateway HTTP listening ' + httpPort));
      assert.ok(!output.includes('gateway TCP listening'));
    }
    await start();
    assert.equal((await request('/healthz', { headers: { host: 'healthcheck.railway.app' } })).status, 200);
    assert.equal((await request('/readyz')).status, 200);
    assert.equal((await request('/v1/devices')).status, 401);
    assert.equal((await request('/v1/shipments')).status, 401);
    assert.equal((await request('/v1/native/challenges', { method: 'POST', body: {
      tenant_id: a.tenant_id, proof_hash: '0'.repeat(64), label: 'x'.repeat(17000)
    } })).status, 413);
    assert.equal((await request('/v1/native/challenges', { method: 'POST', body: {}, headers: {
      host: 'evil.test', 'x-forwarded-host': 'gateway.test', 'x-forwarded-proto': 'https'
    } })).status, 403);
    for (const path of ['/v1/admin/tenants', '/v1/tenants', '/v1/keys'])
      assert.equal((await request(path, { token: owner.token, method: 'POST', body: {} })).status, 404);
    const proof = '0x' + randomBytes(32).toString('hex');
    const challenge = await request('/v1/native/challenges', { method: 'POST', body: {
      tenant_id: a.tenant_id, proof_hash: sha(proof), label: 'Railway Android fixture'
    } });
    assert.equal(challenge.status, 201);
    const approvePath = '/v1/native/challenges/' + challenge.data.id + '/approve';
    assert.equal((await request(approvePath, { method: 'POST', body: {} })).status, 401);
    assert.equal((await request(approvePath, { method: 'POST', token: other.token, body: {} })).status, 409);
    const claimBody = { challenge_id: challenge.data.id, proof };
    assert.equal((await request('/v1/native/claim', { method: 'POST', body: claimBody })).status, 409);
    assert.equal((await request(approvePath, { method: 'POST', body: {}, token: owner.token })).status, 200);
    const claim = await request('/v1/native/claim', { method: 'POST', body: claimBody });
    assert.equal(claim.status, 201);
    const session = claim.data, key = nativePopKey(proof, challenge.data.id, session.token);
    const signed = (path, method = 'GET', body) => {
      const time = String(Date.now()), nonce = randomBytes(16).toString('hex');
      return { token: session.token, method, body, headers: {
        'x-trackium-client': 'android-native-v1', 'x-trackium-audience': session.audience,
        'x-trackium-time': time, 'x-trackium-nonce': nonce,
        'x-trackium-mac': nativeMac(key, method, path, time, nonce,
          body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)))
      } };
    };
    const devices = await request('/v1/devices', signed('/v1/devices'));
    assert.equal(devices.status, 200);
    assert.deepEqual(devices.data.devices.map((d) => d.id), [deviceA.id]);
    const foreign = '/v1/devices/' + deviceB.id;
    assert.equal((await request(foreign, signed(foreign))).status, 404);
    const shipmentInput = (device_id) => ({ name: 'Railway fixture', device_id,
      route: [{ name: 'A', latitude: 50, longitude: 30 }, { name: 'B', latitude: 51, longitude: 31 }],
      conditions: { temperature_min_c: 2, temperature_max_c: 8 } });
    const shipment = await request('/v1/shipments', { method: 'POST', token: a.token, body: shipmentInput(deviceA.id) });
    assert.equal(shipment.status, 201);
    const foreignShipment = await request('/v1/shipments', { method: 'POST', token: b.token, body: shipmentInput(deviceB.id) });
    assert.equal(foreignShipment.status, 201);
    const foreignProofs = '/v1/shipments/' + foreignShipment.data.id + '/proofs';
    assert.equal((await request(foreignProofs, signed(foreignProofs))).status, 404);
    const proofPath = '/v1/shipments/' + shipment.data.id + '/proofs';
    let proofs = await request(proofPath, signed(proofPath));
    assert.equal(proofs.status, 200);
    assert.equal(proofs.data.engine_mode, 'disabled');
    assert.deepEqual(proofs.data.proofs, []);
    assert.equal((await request('/v1/proof-publisher/policy', { method: 'POST', token: owner.token, body: {} })).status, 403);
    const events = (await db.query('SELECT id FROM cargo_events WHERE shipment_id=$1', [shipment.data.id])).rows;
    assert.ok(events.length > 0);
    const approveProof = '/v1/proof-publisher/events/' + events[0].id + '/approve';
    assert.equal((await request(approveProof, { method: 'POST', token: owner.token, body: {
      confirmation: 'PUBLISH MAINNET ' + events[0].id
    } })).status, 403);
    assert.equal((await request('/v1/simulated-devices', { method: 'POST', token: a.token, body: { label: 'no' } })).status, 403);
    const fixturePath = '/v1/fixtures/devices/' + deviceA.id + '/events';
    assert.equal((await request(fixturePath, { method: 'POST', token: a.token, body: {} })).status, 404);
    const replay = signed('/v1/native/session');
    assert.equal((await request('/v1/native/session', replay)).status, 200);
    assert.equal((await request('/v1/native/session', replay)).status, 409);
    await stop();
    await start(true);
    assert.deepEqual((await db.query('SELECT * FROM gateway_schema_migrations ORDER BY version')).rows, migrations);
    assert.equal((await request('/v1/native/session', replay)).status, 409, 'nonce persists across restart');
    const read = await request('/v1/shipments', signed('/v1/shipments'));
    assert.equal(read.status, 200);
    assert.deepEqual(read.data.shipments.map((s) => s.id), [shipment.data.id]);
    proofs = await request(proofPath, signed(proofPath));
    assert.equal(proofs.data.engine_mode, 'disabled');
    assert.equal((await db.query('SELECT count(*) AS n FROM cargo_proofs')).rows[0].n, '0');
    // HTTPS browser pairing remains origin/CSRF-bound behind plain internal HTTP.
    const browserHeaders = { origin: 'https://gateway.test', 'sec-fetch-site': 'same-origin', 'x-trackium-client': 'cargo-v2' };
    const browserChallenge = await request('/v1/pairing/challenges', { method: 'POST', body: { tenant_id: a.tenant_id }, headers: browserHeaders });
    assert.equal(browserChallenge.status, 201);
    assert.match(browserChallenge.headers.get('set-cookie'), /; Secure/);
    const cookie = browserChallenge.headers.get('set-cookie').split(';')[0];
    const browserApproval = '/v1/pairing/challenges/' + browserChallenge.data.id + '/approve';
    assert.equal((await request(browserApproval, { method: 'POST', token: other.token, body: { scopes: ['read'] } })).status, 409);
    assert.equal((await request(browserApproval, { method: 'POST', token: owner.token, body: { scopes: ['read'] } })).status, 200);
    assert.equal((await request('/v1/pairing/session', { method: 'POST', body: {}, headers: { ...browserHeaders, cookie, origin: 'https://evil.test' } })).status, 403);
    const browserSession = await request('/v1/pairing/session', { method: 'POST', body: {}, headers: { ...browserHeaders, cookie } });
    assert.equal(browserSession.status, 201);
    assert.equal((await request('/v1/pairing/session', { method: 'POST', body: {}, headers: { ...browserHeaders, cookie } })).status, 401);
    assert.equal((await request('/v1/session', { headers: { ...browserHeaders,
      cookie: browserSession.headers.getSetCookie()[0].split(';')[0] } })).status, 200);
  });
