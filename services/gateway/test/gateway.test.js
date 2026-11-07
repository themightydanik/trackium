import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import { once } from 'node:events';
import { createGateway } from '../src/gateway.js';
import { readConfig } from '../src/config.js';

const deferred = () => Promise.withResolvers();
const quiet = { error() {}, warn() {} };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
  const deadline = Date.now() + 1000;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error('condition timed out');
    await tick();
  }
}
async function fixture(t, overrides = {}, persist = async () => {}) {
  const writes = [];
  let closed = false;
  const journal = {
    async initialize() {},
    async persistPacket(packet) { writes.push(packet.payload.toString()); await persist(packet); },
    async checkReady() {},
    async close() { closed = true; }
  };
  const gateway = createGateway({ journal, logger: quiet, config: {
    ...readConfig({ DATABASE_URL: 'postgres://unused' }),
    host: '127.0.0.1', tcpPort: 0, httpPort: 0, ...overrides
  } });
  await gateway.start();
  t.after(() => gateway.shutdown());
  const connect = async () => {
    const socket = net.connect(gateway.tcp.address().port, '127.0.0.1');
    socket.on('error', () => {});
    socket.on('data', () => {});
    t.after(() => socket.destroy());
    const ended = new Promise(resolve => socket.once('close', resolve));
    await once(socket, 'connect');
    return { socket, ended };
  };
  return { gateway, journal, writes, connect, isClosed: () => closed };
}
function request(gateway, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: gateway.api.address().port, path, agent: false }, res => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    }).once('error', reject);
  });
}

test('serializes coalesced frames, drains after client EOF and discards partial EOF', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {}, async ({ payload }) => { if (payload.toString() === 'one') await gate.promise; });
  const { socket, ended } = await f.connect();
  socket.end('one\ntwo\npartial');
  await until(() => f.writes.length === 1);
  assert.deepEqual(f.writes, ['one']);
  gate.resolve();
  await ended;
  await f.gateway.shutdown();
  assert.deepEqual(f.writes, ['one', 'two']);
});

test('journal failure skips later queued frames and a new connection can write', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {}, async ({ payload }) => {
    if (payload.toString() === 'bad') { await gate.promise; throw new Error('database unavailable'); }
  });
  const first = await f.connect();
  first.socket.write('bad\nskipped\n');
  await until(() => f.writes.length === 1);
  gate.resolve();
  await first.ended;
  const second = await f.connect();
  second.socket.end('reconnected\n');
  await second.ended;
  await f.gateway.shutdown();
  assert.deepEqual(f.writes, ['bad', 'reconnected']);
});

test('global frame budget applies across connections and releases after drain', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, { maxPendingFrames: 1 }, () => gate.promise);
  const first = await f.connect();
  first.socket.write('held\n');
  await until(() => f.writes.length === 1);
  const second = await f.connect();
  second.socket.write('rejected\n');
  await second.ended;
  assert.deepEqual(f.writes, ['held']);
  gate.resolve();
  first.socket.end();
  await first.ended;
  const third = await f.connect();
  third.socket.end('accepted\n');
  await third.ended;
  assert.deepEqual(f.writes, ['held', 'accepted']);
});

test('byte budget stops a coalesced chunk but drains already accepted frames', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, { maxPendingBytes: 3 }, () => gate.promise);
  const { socket, ended } = await f.connect();
  socket.write('aa\nbb\nc\n');
  await until(() => f.writes.length === 1);
  await ended;
  gate.resolve();
  await f.gateway.shutdown();
  assert.deepEqual(f.writes, ['aa']);
});

test('disconnected client retains connection slot while accepted writes drain', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, { maxConnections: 1 }, () => gate.promise);
  const accepted = once(f.gateway.tcp, 'connection');
  const first = await f.connect();
  const [serverSocket] = await accepted;
  first.socket.write('held\n');
  await until(() => f.writes.length === 1);
  const detached = once(serverSocket, 'close');
  serverSocket.destroy();
  first.socket.destroy();
  await detached;
  const second = await f.connect();
  second.socket.write('rejected\n');
  await second.ended;
  assert.deepEqual(f.writes, ['held']);
  gate.resolve();
  await tick();
  const third = await f.connect();
  third.socket.end('new-slot\n');
  await third.ended;
  await f.gateway.shutdown();
  assert.deepEqual(f.writes, ['held', 'new-slot']);
  assert.equal(f.isClosed(), true);
});

test('shutdown waits for all accepted writes before closing journal and is idempotent', { timeout: 3000 }, async t => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, {}, async ({ payload }) => { if (payload.toString() === 'one') await gate.promise; });
  const { socket } = await f.connect();
  socket.write('one\ntwo\n');
  await until(() => f.writes.length === 1);
  const closing = f.gateway.shutdown();
  assert.equal(f.gateway.shutdown(), closing);
  await tick();
  assert.equal(f.isClosed(), false);
  gate.resolve();
  await closing;
  assert.deepEqual(f.writes, ['one', 'two']);
  assert.equal(f.isClosed(), true);
});

test('readiness recovers after transient database failure; liveness and unknown routes remain distinct', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  f.journal.checkReady = async () => { throw new Error('unavailable'); };
  assert.equal(await request(f.gateway, '/readyz'), 503);
  assert.equal(await request(f.gateway, '/healthz'), 200);
  f.journal.checkReady = async () => {};
  assert.equal(await request(f.gateway, '/readyz'), 200);
  assert.equal(await request(f.gateway, '/packets'), 404);
});

test('startup failure closes the journal and any listener already opened', { timeout: 3000 }, async t => {
  const blocker = net.createServer();
  blocker.listen(0, '127.0.0.1');
  await once(blocker, 'listening');
  t.after(() => new Promise(resolve => blocker.close(resolve)));
  let closed = false;
  const gateway = createGateway({ logger: quiet, config: {
    ...readConfig({ DATABASE_URL: 'postgres://unused' }), host: '127.0.0.1', tcpPort: 0, httpPort: blocker.address().port
  }, journal: { async initialize() {}, async close() { closed = true; } } });
  await assert.rejects(gateway.start(), { code: 'EADDRINUSE' });
  assert.equal(gateway.tcp.listening, false);
  assert.equal(closed, true);
});

test('invalid limits and ports fail before opening sockets', () => {
  for (const name of ['TCP_PORT', 'HTTP_PORT', 'MAX_FRAME_BYTES', 'MAX_CONNECTIONS', 'MAX_PENDING_FRAMES', 'MAX_PENDING_BYTES', 'SOCKET_TIMEOUT_MS', 'SHUTDOWN_TIMEOUT_MS']) {
    for (const value of ['0', '-1', 'NaN', 'Infinity', '1.5', '']) {
      assert.throws(() => readConfig({ DATABASE_URL: 'postgres://unused', [name]: value }), new RegExp(name));
    }
  }
  assert.throws(() => readConfig({ DATABASE_URL: 'postgres://unused', TCP_PORT: '65536' }), /TCP_PORT/);
});

test('an incomplete frame is not carried into a reconnected client', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  const first = await f.connect();
  first.socket.end('partial');
  await first.ended;
  const second = await f.connect();
  second.socket.end('fresh\n');
  await second.ended;
  assert.deepEqual(f.writes, ['fresh']);
});

test('shutdown during database initialization never opens listeners', { timeout: 3000 }, async () => {
  const gate = deferred();
  let closed = false;
  const gateway = createGateway({ logger: quiet, config: {
    ...readConfig({ DATABASE_URL: 'postgres://unused' }), tcpPort: 0, httpPort: 0
  }, journal: { initialize: () => gate.promise, async close() { closed = true; } } });
  const starting = gateway.start();
  const stopping = gateway.shutdown();
  gate.resolve();
  await Promise.all([starting, stopping]);
  assert.equal(gateway.tcp.listening, false);
  assert.equal(gateway.api.listening, false);
  assert.equal(closed, true);
});

test('shutdown deadline reports an incomplete drain instead of claiming success', { timeout: 3000 }, async () => {
  const gate = deferred(), entered = deferred(), drained = deferred();
  const gateway = createGateway({ logger: quiet, config: {
    ...readConfig({ DATABASE_URL: 'postgres://unused' }),
    host: '127.0.0.1', tcpPort: 0, httpPort: 0, shutdownTimeoutMs: 30
  }, journal: {
    async initialize() {},
    async persistPacket() { entered.resolve(); await gate.promise; },
    async close() { drained.resolve(); }
  } });
  let socket;
  try {
    await gateway.start();
    socket = net.connect(gateway.tcp.address().port, '127.0.0.1');
    socket.on('error', () => {});
    await once(socket, 'connect');
    socket.write('held\n');
    await entered.promise;
    await assert.rejects(gateway.shutdown(), /shutdown timed out/);
  } finally {
    socket?.destroy();
    gate.resolve();
    await drained.promise;
  }
});
