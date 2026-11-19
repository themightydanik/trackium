import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required (disposable database)');
const token = 'operator-test-token-' + 'x'.repeat(40);
const silent = { error() {}, warn() {} };

test('AOVX observations API is disabled by default and protected by a dedicated operator token', { timeout: 30000 }, async (t) => {
  const schema = 'aovx_api_test_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query('CREATE SCHEMA ' + schema);
  const db = new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
  const config = {
    ...readConfig({ DATABASE_URL: url }),
    host: '127.0.0.1', tcpPort: 0, httpPort: 0
  };
  const runtime = createRuntime(db, config, { worker: false, logger: silent });
  await runtime.gateway.start();
  config.httpPort = runtime.gateway.api.address().port;
  config.publicOrigin = 'http://127.0.0.1:' + config.httpPort;
  t.after(async () => {
    try { await runtime.gateway.shutdown(); }
    finally { await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); await admin.end(); }
  });
  await db.query(`INSERT INTO gateway_aovx_device_observations
    (device_id_bcd, first_seen_at, last_seen_at, packet_count, last_message_id,
     last_sequence_number, last_checksum_status, last_parse_status,
     registration_message_seen_at, authentication_message_seen_at)
    VALUES ('221042214328', now(), now(), 3, 258, 7, 'xor-mismatch', 'parsed', now(), now())`);
  const base = config.publicOrigin;
  assert.equal((await fetch(base + '/internal/aovx/devices')).status, 404);
  config.aovxObservationsToken = token;
  assert.equal((await fetch(base + '/internal/aovx/devices')).status, 401);
  assert.equal((await fetch(base + '/internal/aovx/devices', {
    headers: { authorization: 'Bearer wrong' }
  })).status, 401);
  const list = await fetch(base + '/internal/aovx/devices?limit=1', {
    headers: { authorization: 'Bearer ' + token }
  });
  assert.equal(list.status, 200);
  const page = await list.json();
  assert.equal(page.devices.length, 1);
  assert.equal(page.devices[0].device_id_bcd, '221042214328');
  const detail = await fetch(base + '/internal/aovx/devices/221042214328', {
    headers: { authorization: 'Bearer ' + token }
  });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).packet_count, '3');
  assert.equal((await fetch(base + '/internal/aovx/devices', {
    method: 'POST', headers: { authorization: 'Bearer ' + token }
  })).status, 405);
});
