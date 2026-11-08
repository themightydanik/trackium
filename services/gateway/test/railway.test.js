import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { readConfig } from '../src/config.js';
import { createGateway } from '../src/gateway.js';
import { createIngressGuard } from '../src/ingress.js';

const env = {
  DATABASE_URL: 'postgres://unused', DEPLOYMENT_PROFILE: 'railway-test',
  PUBLIC_ORIGIN: 'https://gateway.test', ENABLE_NATIVE_CLIENTS: 'true',
  ENABLE_TCP_RECEIVER: 'false'
};

test('Railway PORT takes precedence and invalid ports cannot silently fall back', () => {
  assert.equal(readConfig({ ...env, PORT: '4567', HTTP_PORT: '8080' }).httpPort, 4567);
  assert.equal(readConfig({ DATABASE_URL: 'unused', HTTP_PORT: '1234' }).httpPort, 1234);
  for (const PORT of ['', '0', '65536', '-1', '1.5', 'abc'])
    assert.throws(() => readConfig({ ...env, PORT }), /PORT/);
});

test('Railway test profile refuses unsafe runtime overrides', () => {
  assert.equal(readConfig(env).proofs.mode, 'disabled');
  for (const override of [
    { ENABLE_TCP_RECEIVER: 'true' }, { ENABLE_NATIVE_CLIENTS: 'false' },
    { PUBLIC_ORIGIN: 'http://127.0.0.1:8080' }, { PUBLIC_ORIGIN: undefined },
    { PROOF_MODE: 'live' }, { PROOF_MODE: 'test' }, { PROOF_ALLOW_LIVE: 'true' },
    { PROOF_ALLOW_MAINNET: 'true' }, { PROOF_MAX_PUBLICATIONS: '2' },
    { ENABLE_SERVER_SIMULATOR: 'true' }, { ENABLE_FIXTURE_ADAPTER: 'true' },
    { ENABLE_TCP_RECEIVER: 'yes' }, { DEPLOYMENT_PROFILE: 'unknown' }
  ]) assert.throws(() => readConfig({ ...env, ...override }));
});

function probe(guard, overrides = {}) {
  const req = { method: 'GET', url: '/v1/devices', headers: { host: 'gateway.test' },
    resume() {}, ...overrides };
  const res = new EventEmitter();
  res.setHeader = () => {};
  res.writeHead = (status) => { res.status = status; };
  res.end = () => { res.emit('finish'); };
  return { accepted: guard(req, res), res };
}

test('Ingress budgets cannot be reset with spoofed forwarding headers; health stays available', () => {
  let clock = 0;
  const guard = createIngressGuard(readConfig(env), { now: () => clock });
  for (let i = 0; i < 60; i++) {
    const p = probe(guard, { method: 'POST', url: '/v1/native/challenges', headers: {
      host: 'gateway.test', 'x-forwarded-for': '192.0.2.' + i
    } });
    assert.equal(p.accepted, true);
    p.res.emit('finish');
  }
  assert.equal(probe(guard, { url: '/v1/native/claim' }).res.status, 429);
  assert.equal(probe(guard, { url: '/readyz', headers: { host: 'healthcheck.railway.app' } }).accepted, true);
  clock = 60000;
  const held = Array.from({ length: 32 }, () => probe(guard));
  assert.ok(held.every((p) => p.accepted));
  assert.equal(probe(guard).res.status, 429);
  held[0].res.emit('close');
  const next = probe(guard);
  assert.equal(next.accepted, true);
  next.res.emit('finish');
  for (const p of held) { p.res.emit('finish'); p.res.emit('close'); }
  for (let i = 0; i < 1166; i++) {
    const p = probe(guard); assert.equal(p.accepted, true); p.res.emit('finish');
  }
  assert.equal(probe(guard).res.status, 429);
});

test('Health queries have an independent bounded budget and duplicate Host is rejected', () => {
  const guard = createIngressGuard(readConfig(env));
  for (let i = 0; i < 120; i++) {
    const p = probe(guard, { url: '/readyz', headers: { host: 'healthcheck.railway.app' } });
    assert.equal(p.accepted, true); p.res.emit('finish');
  }
  assert.equal(probe(guard, { url: '/readyz' }).res.status, 429);
  assert.equal(probe(guard).accepted, true);
  assert.equal(probe(guard, { headersDistinct: { host: ['gateway.test', 'evil.test'] } }).res.status, 403);
});

test('HTTP-only listener preserves health checks and exact Host/Origin behind TLS termination', async (t) => {
  let ready = true, closed = false;
  const config = { ...readConfig(env), host: '127.0.0.1', httpPort: 0 };
  const gateway = createGateway({ config, ingressGuard: createIngressGuard(config),
    journal: {
      async initialize() {}, async checkReady() { if (!ready) throw Error('offline'); },
      async close() { closed = true; }
    },
    requestHandler: async (_req, res) => { res.writeHead(401); res.end(); }
  });
  t.after(() => gateway.shutdown());
  await gateway.start();
  assert.equal(gateway.tcp.listening, false);
  const request = (path, headers) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: gateway.api.address().port, path, headers }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    }).on('error', reject);
  });
  assert.equal(await request('/healthz', { host: 'healthcheck.railway.app' }), 200);
  assert.equal(await request('/readyz', { host: 'healthcheck.railway.app' }), 200);
  ready = false;
  assert.equal(await request('/readyz', { host: 'healthcheck.railway.app' }), 503);
  assert.equal(await request('/healthz', { host: 'healthcheck.railway.app' }), 200);
  for (const headers of [
    { host: 'attacker.test', 'x-forwarded-host': 'gateway.test', 'x-forwarded-proto': 'https' },
    { host: 'gateway.test', origin: 'https://attacker.test' },
    { host: 'healthcheck.railway.app' }
  ]) assert.equal(await request('/v1/devices', headers), 403);
  assert.equal(await request('/v1/devices', { host: 'gateway.test', 'x-forwarded-proto': 'http' }), 401);
  await gateway.shutdown();
  assert.equal(closed, true);
  assert.equal(gateway.api.listening, false);
});
