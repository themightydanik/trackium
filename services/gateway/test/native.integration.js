import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { provisionTenant, issueKey } from '../src/telemetry/service.js';
import { nativePopKey, nativeMac } from '../src/cargo/native-session.js';
const url = process.env.TEST_DATABASE_URL;
if (!url) throw Error('TEST_DATABASE_URL required');
test(
  'Native Android owner pairing, PoP HTTP authentication and tenant isolation',
  { timeout: 30000 },
  async (t) => {
    const admin = new pg.Pool({ connectionString: url }),
      schema = 'native_' + randomUUID().replaceAll('-', '');
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
    const config = {
      ...readConfig({
        DATABASE_URL: url,
        ENABLE_NATIVE_CLIENTS: 'true',
        PUBLIC_ORIGIN: 'https://gateway.test'
      }),
      host: '127.0.0.1',
      tcpPort: 0,
      httpPort: 0
    };
    const rt = createRuntime(db, config, {
      worker: false,
      logger: { error() {}, warn() {} }
    });
    await rt.gateway.start();
    t.after(async () => {
      await rt.gateway.shutdown();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    });
    const origin = 'http://127.0.0.1:' + rt.gateway.api.address().port,
      a = await provisionTenant(db, 'A'),
      b = await provisionTenant(db, 'B');
    // Exercise explicit least-privilege and owner credentials independently.
    const reader = await issueKey(db, a.tenant_id, ['read']);
    const owner = await issueKey(db, a.tenant_id, ['admin', 'read', 'publish']),
      other = await issueKey(db, b.tenant_id, ['admin', 'read', 'publish']);
    const req = async (path, { token, method = 'GET', body, headers = {} } = {}) => {
      const r = await fetch(origin + path, {
        method,
        headers: {
          ...(token ? { authorization: 'Bearer ' + token } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { status: r.status, data: await r.json() };
    };
    const secret = '0x' + randomBytes(32).toString('hex'),
      sha = (x) => createHash('sha256').update(x).digest('hex');
    const challenge = async () => {
      const r = await req('/v1/native/challenges', {
        method: 'POST',
        body: { tenant_id: a.tenant_id, proof_hash: sha(secret), label: 'Test Android' }
      });
      assert.equal(r.status, 201);
      return r.data;
    };
    let c = await challenge();
    const approve = (id, token = owner.token) =>
      req('/v1/native/challenges/' + id + '/approve', { method: 'POST', body: {}, token });
    assert.equal((await approve(c.id, other.token)).status, 409);
    assert.equal((await approve(c.id, reader.token)).status, 403);
    const claim = (id, proof = secret) =>
      req('/v1/native/claim', { method: 'POST', body: { challenge_id: id, proof } });
    assert.equal((await claim(c.id)).status, 409);
    assert.equal((await approve(c.id)).status, 200);
    assert.equal((await approve(c.id)).status, 409);
    assert.equal((await claim(c.id, '0x' + '00'.repeat(32))).status, 409);
    let r = await claim(c.id);
    assert.equal(r.status, 201);
    const session = r.data;
    assert.deepEqual(session.scopes, ['read', 'publish']);
    assert.equal((await claim(c.id)).status, 409);
    const key = nativePopKey(secret, c.id, session.token),
      audience = 'trackium:native:v1:https://gateway.test';
    const signed = (path, method = 'GET', body, overrides = {}) => {
      const time = Date.now().toString(),
        nonce = randomBytes(16).toString('hex');
      return {
        token: session.token,
        method,
        body,
        headers: {
          'x-trackium-client': 'android-native-v1',
          'x-trackium-audience': audience,
          'x-trackium-time': time,
          'x-trackium-nonce': nonce,
          'x-trackium-mac': nativeMac(
            key,
            method,
            path,
            time,
            nonce,
            Buffer.from(body === undefined ? '' : JSON.stringify(body))
          ),
          ...overrides
        }
      };
    };
    const path = '/v1/native/session',
      args = signed(path);
    assert.equal((await req(path, args)).status, 200);
    assert.equal((await req(path, args)).status, 409);
    assert.equal((await req(path, { token: session.token })).status, 401);
    assert.equal(
      (await req(path, signed(path, 'GET', undefined, { 'x-trackium-audience': 'evil' }))).status,
      401
    );
    assert.equal(
      (await req(path, signed(path, 'GET', undefined, { origin: 'https://gateway.test' }))).status,
      401
    );
    assert.equal((await req(path, signed(path, 'GET', undefined, { cookie: 'x=y' }))).status, 401);
    assert.equal(
      (await req(path, signed(path, 'GET', undefined, { 'x-trackium-time': '1000000000000' })))
        .status,
      401
    );
    assert.equal((await req('/v1/devices', signed('/v1/devices'))).status, 200); // delegated telemetry route authenticates exactly once
    assert.equal(
      (await req('/v1/shipments', signed('/v1/shipments', 'POST', { name: 'forbidden' }))).status,
      403
    );
    const da = await rt.telemetry.register(a.tenant_id, { label: 'A', mode: 'synthetic' }),
      dbb = await rt.telemetry.register(b.tenant_id, { label: 'B', mode: 'synthetic' });
    const shipment = (name, device_id) => ({
      name,
      device_id,
      route: [
        { name: 'A', latitude: 50, longitude: 30 },
        { name: 'B', latitude: 51, longitude: 31 }
      ],
      conditions: { temperature_min_c: 2, temperature_max_c: 8 }
    });
    const aShipment = await req('/v1/shipments', {
      method: 'POST',
      token: a.token,
      body: shipment('Tenant A', da.id)
    });
    assert.equal(aShipment.status, 201);
    const bShipment = await req('/v1/shipments', {
      method: 'POST',
      token: b.token,
      body: shipment('Tenant B', dbb.id)
    });
    assert.equal(bShipment.status, 201);
    r = await req('/v1/shipments', signed('/v1/shipments'));
    assert.equal(r.status, 200);
    assert.equal(r.data.shipments.length, 1);
    const foreign = '/v1/shipments/' + bShipment.data.id;
    assert.equal((await req(foreign, signed(foreign))).status, 404);
    await db.query(
      "UPDATE cargo_native_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
      [session.id]
    );
    assert.equal((await req(path, signed(path))).status, 401);
    await db.query(
      "UPDATE cargo_native_sessions SET expires_at=now()+interval '15 minutes',requests=900 WHERE id=$1",
      [session.id]
    );
    assert.equal((await req(path, signed(path))).status, 401);
    await db.query('UPDATE cargo_native_sessions SET requests=0 WHERE id=$1', [session.id]);
    await db.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1', [owner.id]);
    assert.equal((await req(path, signed(path))).status, 401);
    await db.query('UPDATE telemetry_api_keys SET revoked_at=NULL WHERE id=$1', [owner.id]);
    const changed = signed(path, 'DELETE', {});
    changed.body = { changed: true };
    assert.equal((await req(path, changed)).status, 401);
    assert.equal((await req(path, signed(path, 'DELETE', {}))).status, 200);
    assert.equal((await req(path, signed(path))).status, 401);
    c = await challenge();
    await approve(c.id);
    await db.query(
      "UPDATE cargo_native_pairing SET expires_at=now()-interval '1 second' WHERE id=$1",
      [c.id]
    );
    assert.equal((await claim(c.id)).status, 409);
    c = await challenge();
    await approve(c.id);
    await db.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1', [owner.id]);
    assert.equal((await claim(c.id)).status, 403);
  }
);
