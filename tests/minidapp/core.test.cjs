const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const { GatewayClient, validateOrigin, provenance } = require('../../assets/v2/gateway-client.js');
const model = require('../../assets/v2/gateway-model.js');
const id = '6b6c68dd-c05d-470a-a28f-616aa7bc8481';
test('Gateway client fails closed without pairing and does not invoke fetch', async () => {
  const original = global.fetch;
  global.fetch = () => {
    throw new Error('must not fetch');
  };
  try {
    await assert.rejects(new GatewayClient().devices(), { code: 'PAIRING_UNAVAILABLE' });
  } finally {
    global.fetch = original;
  }
});
test('read-only Gateway contracts map actual v1 routes with encoded history filters', async () => {
  const calls = [];
  const client = new GatewayClient({
    transport: {
      read: async (p) => {
        calls.push(p);
        return {};
      }
    }
  });
  await client.devices({ limit: 20, cursor: id });
  await client.device(id);
  await client.location(id);
  await client.status(id);
  await client.history(id, { limit: 5, cursor: 'a&b', from: '2026-11-07T12:00:00.000Z' });
  assert.deepEqual(calls.slice(0, 4), [
    '/v1/devices?limit=20&cursor=' + id,
    '/v1/devices/' + id,
    '/v1/devices/' + id + '/location',
    '/v1/devices/' + id + '/status'
  ]);
  assert.match(calls[4], /cursor=a%26b/);
  assert.match(calls[4], /from=2026/);
  assert.throws(() => client.device('../devices'), { code: 'INVALID_ID' });
});
test('Gateway errors never expose transport secrets and do not return demo fallback', async () => {
  const client = new GatewayClient({
    transport: {
      read: async () => {
        throw new Error('secret-token-do-not-leak');
      }
    }
  });
  await assert.rejects(
    client.devices(),
    (e) => e.code === 'GATEWAY_UNAVAILABLE' && !e.message.includes('secret-token')
  );
});
test('connection profile accepts only origins without credentials or secret-bearing components', () => {
  assert.equal(validateOrigin('https://gateway.example.com/'), 'https://gateway.example.com');
  assert.equal(validateOrigin('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
  for (const origin of [
    'javascript:alert(1)',
    'http://gateway.example.com',
    'https://user:secret@example.com',
    'https://example.com/?token=secret',
    'https://example.com/#secret',
    'https://example.com/v1'
  ])
    assert.throws(() => validateOrigin(origin), { code: 'INVALID_ORIGIN' });
});
test('Gateway response model handles missing sensors and never upgrades real registration to verified', async () => {
  const view = model.deviceView(
    { id, label: 'real registry', mode: 'real', enabled: true },
    { status: 'unknown', last_event_at: null },
    { location: null },
    { events: [], next_cursor: null }
  );
  assert.equal(view.trust, 'unverified');
  assert.equal(view.battery, null);
  assert.equal(view.latitude, null);
  const loaded = await model.loadDevice(
    {
      device: async () => ({ id, label: 'fixture', mode: 'synthetic', enabled: true }),
      status: async () => ({ status: 'moving' }),
      location: async () => ({
        location: { gps: { latitude: 0, longitude: 0 }, trust: 'synthetic' }
      }),
      history: async () => ({
        events: [
          { payload: { temperature_c: 0, humidity_pct: 0, battery_pct: 0, trust: 'synthetic' } }
        ],
        next_cursor: 'next'
      })
    },
    id
  );
  assert.equal(loaded.latitude, 0);
  assert.equal(loaded.temperature, 0);
  assert.equal(loaded.nextCursor, 'next');
  assert.equal(loaded.trust, 'synthetic');
  assert.equal(provenance({ trust: 'verified' }), 'Unverified');
});
test('demo dataset is deterministic, isolated per use and exclusively synthetic', () => {
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/v2/demo-data.js'), 'utf8'), scope);
  const first = scope.window.TrackiumDemo.create(),
    second = scope.window.TrackiumDemo.create();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.events.length, 36);
  assert.ok(first.events.every((e) => e.payload.trust === 'synthetic'));
  first.devices[0].label = 'changed';
  assert.notEqual(second.devices[0].label, 'changed');
});
test('MDS bridge sends only status; no inited-only success or blockchain confirmation', () => {
  let callback, statusCallback;
  const calls = [],
    states = [];
  const window = {
    location: { search: '?uid=0xabcd' },
    MDS: {
      init: (cb) => (callback = cb),
      cmd: (cmd, cb) => {
        calls.push(cmd);
        statusCallback = cb;
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/v2/mds-bridge.js'), 'utf8'), {
    window,
    URLSearchParams,
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 2,
    clearInterval() {}
  });
  window.TrackiumMDS.start((s) => states.push(s));
  callback({ event: 'inited' });
  assert.equal(states.at(-1).state, 'connecting');
  statusCallback({ status: true, response: { chain: { block: 123 } } });
  assert.equal(states.at(-1).block, 123);
  assert.equal(states.at(-1).state, 'ready');
  callback({ event: 'MDS_SHUTDOWN' });
  assert.equal(states.at(-1).state, 'unavailable');
  statusCallback({ status: true, response: { chain: { block: 124 } } });
  assert.equal(states.at(-1).state, 'unavailable', 'late status cannot revive a stopped session');
  assert.deepEqual(calls, ['status']);
  assert.equal(window.TrackiumMDS.legacyUrl(), './legacy.html?uid=0xabcd');
});
test('standalone preview does not initialize MDS or request privileged commands', () => {
  const states = [];
  const window = {
    location: { search: '' },
    MDS: {
      init() {
        throw new Error('must not run');
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/v2/mds-bridge.js'), 'utf8'), {
    window,
    URLSearchParams
  });
  window.TrackiumMDS.start((s) => states.push(s));
  assert.equal(states[0].state, 'standalone');
});
test('ES5 background initializer preserves used legacy schemas and fails closed on SQL errors', () => {
  const originalQueries = [];
  const old = {
    MDS: {
      sql(q, cb) {
        originalQueries.push(q);
        cb({ status: true });
      },
      log() {}
    }
  };
  vm.createContext(old);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/database.js'), 'utf8'), old);
  vm.runInContext('new TrackiumDatabase().init(function(){})', old);
  const expected = originalQueries.filter(
    (q) =>
      /^CREATE TABLE IF NOT EXISTS (devices|movements|events) \(/.test(q) || /^CREATE INDEX/.test(q)
  );
  const seen = [];
  const scope = {
    MDS: {
      sql(q, cb) {
        seen.push(q);
        cb({ status: true });
      }
    }
  };
  vm.createContext(scope);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'assets/v2/background-database.js'), 'utf8'),
    scope
  );
  vm.runInContext(
    'var db = new TrackiumBackgroundDatabase(); db.init(function(ok){result=ok;})',
    scope
  );
  assert.deepEqual(seen, expected);
  assert.equal(scope.result, true);
  assert.equal(scope.db.initialized, true);
  scope.MDS.sql = (q, cb) => cb({ status: false });
  vm.runInContext(
    'var failed = new TrackiumBackgroundDatabase(); failed.init(function(ok){failedResult=ok;})',
    scope
  );
  assert.equal(scope.failedResult, false);
  assert.equal(scope.failed.initialized, false);
});
test('background service initializes in an ES5-like context without globalThis/Promise and retains Android/local DB flow', () => {
  const sql = [],
    network = [];
  let handler;
  const scope = {
    console,
    MDS: {
      load(file) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), scope);
      },
      init(cb) {
        handler = cb;
      },
      log() {},
      sql(q, cb) {
        sql.push(q);
        cb({
          status: true,
          rows: q.startsWith('SELECT device_id') ? [{ device_id: 'legacy-device' }] : []
        });
      },
      net: {
        GET(url, cb) {
          network.push(url);
          cb({
            status: true,
            response: JSON.stringify({
              deviceId: 'legacy-device',
              latitude: 50,
              longitude: 30,
              battery: 90
            })
          });
        }
      },
      cmd() {
        throw new Error('background must not submit blockchain commands');
      }
    }
  };
  vm.createContext(scope);
  vm.runInContext('globalThis=undefined;Promise=undefined;', scope);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'service.js'), 'utf8'), scope);
  handler({ event: 'inited' });
  assert.deepEqual(network, ['http://127.0.0.1:8123/location']);
  assert.ok(sql.some((q) => q.startsWith('INSERT INTO movements')));
  assert.ok(sql.some((q) => q.startsWith('UPDATE devices')));
  assert.ok(sql.some((q) => q.startsWith('INSERT INTO events')));
});
