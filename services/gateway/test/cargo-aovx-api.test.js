import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCargoApi } from '../src/cargo/api.js';

async function fixture(t, { rowCount = 1, token = 'test-operator-token', result } = {}) {
  const calls = { database: 0, command: 0 };
  const handler = createCargoApi({
    pool: {
      async query() {
        calls.database += 1;
        return {
          rowCount,
          rows: rowCount === 1 ? [{ device_id_bcd: '944063243931' }] : []
        };
      }
    },
    aovxGnssEnable: async deviceIdBcd => {
      calls.command += 1;
      assert.equal(deviceIdBcd, '944063243931');
      return result ?? {
        command_sent: true,
        acknowledged: true,
        verified: true,
        observed_gnss: 'enabled'
      };
    },
    config: { aovxObservationsToken: token },
    logger: { info() {}, warn() {}, error() {} }
  });
  const server = http.createServer((req, res) => void handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, calls, token };
}

function post(server, { authorization = 'Bearer test-operator-token', path = '/internal/aovx/devices/944063243931/gnss-enable', body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      method: 'POST',
      path,
      headers: {
        ...(authorization ? { authorization } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {})
      }
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

test('GNSS operator route rejects invalid bearer credentials before database or device access', async t => {
  const f = await fixture(t);
  const response = await post(f.server, { authorization: 'Bearer wrong-token' });
  assert.equal(response.status, 401);
  assert.deepEqual(f.calls, { database: 0, command: 0 });
});

test('GNSS operator route rejects request bodies before database or device access', async t => {
  const f = await fixture(t);
  const response = await post(f.server, { body: '{"value":0}' });
  assert.equal(response.status, 400);
  assert.match(response.body, /request body not allowed/);
  assert.deepEqual(f.calls, { database: 0, command: 0 });
});

test('GNSS operator route requires exactly one active physical device binding', async t => {
  const f = await fixture(t, { rowCount: 2 });
  const response = await post(f.server);
  assert.equal(response.status, 404);
  assert.equal(f.calls.database, 1);
  assert.equal(f.calls.command, 0);
});

test('GNSS operator route invokes only the fixed device operation after bearer and binding checks', async t => {
  const f = await fixture(t);
  const response = await post(f.server);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    command_sent: true,
    acknowledged: true,
    verified: true,
    observed_gnss: 'enabled'
  });
  assert.deepEqual(f.calls, { database: 1, command: 1 });
});
