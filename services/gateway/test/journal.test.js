import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialize, persistPacket } from '../src/journal.js';

test('journal initialization creates idempotent AOVX metadata and device observation schema', async () => {
  const statements = [];
  await initialize({ async query(sql) { statements.push(sql); return { rows: [] }; } });
  const sql = statements.join('\n');
  for (const column of [
    'aovx_message_id INTEGER',
    'aovx_device_id_bcd TEXT',
    'aovx_sequence_number INTEGER',
    'aovx_checksum_status TEXT',
    'aovx_parse_status TEXT',
    'aovx_parse_error TEXT',
    'aovx_parsed_payload JSONB'
  ]) assert.match(sql, new RegExp('ADD COLUMN IF NOT EXISTS ' + column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sql, /CREATE TABLE IF NOT EXISTS gateway_aovx_device_observations/);
  assert.match(sql, /aovx_processing_state/);
  assert.match(sql, /registration_message_seen_at TIMESTAMPTZ/);
  assert.match(sql, /authentication_message_seen_at TIMESTAMPTZ/);
  assert.match(sql, /packet_count BIGINT/);
});

test('journal atomically persists raw bytes and updates observational AOVX device state', async () => {
  const payload = Buffer.from([0x7e, 0x01, 0x02, 0x7e]);
  const aovx = {
    messageId: 0x0102,
    deviceIdBcd: '221042214328',
    sequenceNumber: 7,
    checksumStatus: 'xor-mismatch',
    parseStatus: 'parsed',
    parseError: null,
    parsedPayload: { authenticationCode: { encoding: 'hex', value: '323132' } }
  };
  let captured;
  const result = await persistPacket({ payload, remoteAddress: '127.0.0.1', aovx }, {
    async query(sql, values) {
      captured = { sql, values };
      return { rows: [{ id: '9', received_at: '2026-11-19T00:00:00Z' }] };
    }
  });
  assert.equal(captured.values[0], 'tcp');
  assert.equal(captured.values[1], '127.0.0.1');
  assert.deepEqual(captured.values[2], payload);
  assert.equal(captured.values[3], createHash('sha256').update(payload).digest('hex'));
  assert.deepEqual(captured.values.slice(4, 10), [0x0102, '221042214328', 7, 'xor-mismatch', 'parsed', null]);
  assert.deepEqual(captured.values[10], aovx.parsedPayload);
  assert.match(captured.sql, /INSERT INTO gateway_aovx_device_observations/);
  assert.match(captured.sql, /ON CONFLICT \(device_id_bcd\) DO UPDATE/);
  assert.match(captured.sql, /CASE WHEN \$5 = 256/);
  assert.match(captured.sql, /CASE WHEN \$5 = 258/);
  assert.match(captured.sql, /registration_message_seen_at/);
  assert.match(captured.sql, /authentication_message_seen_at/);
  assert.equal(result.id, '9');
  assert.equal(result.sha256, captured.values[3]);
});

test('device observation ignores malformed device identifiers but still journals raw AOVX packet', async () => {
  const payload = Buffer.from('wire');
  let captured;
  await persistPacket({
    payload,
    aovx: { messageId: 0x0100, deviceIdBcd: 'not-a-bcd-id', sequenceNumber: 1 }
  }, {
    async query(sql, values) { captured = { sql, values }; return { rows: [{}] }; }
  });
  assert.equal(captured.values[5], null);
  assert.match(captured.sql, /WHERE \$6 IS NOT NULL/);
});

test('raw mode leaves AOVX journal metadata null and cannot create a device observation', async () => {
  const payload = Buffer.from('raw');
  let captured;
  await persistPacket({ payload }, {
    async query(sql, args) { captured = { sql, args }; return { rows: [{}] }; }
  });
  assert.deepEqual(captured.args.slice(4), [null, null, null, null, null, null, null]);
  assert.match(captured.sql, /WHERE \$6 IS NOT NULL/);
});
