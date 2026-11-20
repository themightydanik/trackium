import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame, decodeAovxFrame } from '../src/aovx/frame.js';
import {
  encodeAovxQueryCommand,
  parseAovxGeneralQueryResponse,
  parseAovxConfigurationResponse,
  decodeAovxConfigResponse
} from '../src/aovx/config-query.js';

const deviceIdBcd = Buffer.from('944063243931', 'hex');

test('encodes the documented empty-body 0x8104 query command', () => {
  const frame = encodeAovxQueryCommand({ deviceIdBcd, sequenceNumber: 0xfff9 });
  assert.equal(frame.toString('hex'), '7e81040000944063243931fff9187e');
  const decoded = decodeAovxFrame(frame, { checksumPolicy: 'require-xor-match' });
  assert.equal(decoded.messageId, 0x8104);
  assert.equal(decoded.body.length, 0);
  assert.equal(decoded.sequenceNumber, 0xfff9);
});

test('parses 0x0001 as an acknowledgement, not as a configuration value', () => {
  const frame = decodeAovxFrame(encodeAovxFrame({
    messageId: 0x0001, deviceIdBcd, sequenceNumber: 7,
    body: Buffer.from('fff9810400', 'hex')
  }), { checksumPolicy: 'require-xor-match' });
  assert.deepEqual(parseAovxGeneralQueryResponse(frame), {
    responseSequenceNumber: 0xfff9,
    correspondingMessageId: 0x8104,
    result: 0
  });
});

test('extracts GNSS enabled from a valid 0x0104 parameter response', () => {
  const frame = {
    messageId: 0x0104,
    body: Buffer.from('fff9010000f0290101', 'hex')
  };
  const parsed = parseAovxConfigurationResponse(frame);
  assert.equal(parsed.responseSequenceNumber, 0xfff9);
  assert.equal(parsed.parameterCount, 1);
  assert.equal(parsed.gnssEnabled, 'enabled');
  assert.equal(parsed.gnssRaw[0], 1);
});

test('returns unknown when GNSS parameter is absent or has an unrecognized value', () => {
  assert.equal(parseAovxConfigurationResponse({
    messageId: 0x0104, body: Buffer.from('000100', 'hex')
  }).gnssEnabled, 'unknown');
  assert.equal(parseAovxConfigurationResponse({
    messageId: 0x0104, body: Buffer.from('0001010000f0290102', 'hex')
  }).gnssEnabled, 'unknown');
});

test('rejects truncated, duplicate, malformed and trailing parameter data', () => {
  for (const body of [
    '0001010000f029',             // truncated parameter header
    '0001010000f0290201',         // truncated parameter value
    '0001020000f02901000000f0290101', // duplicate
    '000100ff'                    // undeclared trailing data
  ]) {
    assert.throws(() => parseAovxConfigurationResponse({
      messageId: 0x0104, body: Buffer.from(body, 'hex')
    }));
  }
});

test('rejects a response with an invalid checksum', () => {
  const frame = encodeAovxFrame({
    messageId: 0x0104, deviceIdBcd, sequenceNumber: 1,
    body: Buffer.from('0001000000f0290101', 'hex')
  });
  frame[frame.length - 2] ^= 0x01;
  assert.throws(() => decodeAovxConfigResponse(frame), /checksum mismatch/);
});

test('encodes only the fixed GNSS-enable 0x8103 configuration parameter', async () => {
  const { encodeAovxGnssEnableCommand } = await import('../src/aovx/config-query.js');
  const wire = encodeAovxGnssEnableCommand({ deviceIdBcd, sequenceNumber: 0x1234 });
  const decoded = decodeAovxFrame(wire, { checksumPolicy: 'require-xor-match' });
  assert.equal(decoded.messageId, 0x8103);
  assert.equal(decoded.sequenceNumber, 0x1234);
  assert.deepEqual(decoded.deviceIdBcd, deviceIdBcd);
  assert.deepEqual(decoded.body, Buffer.from('010000f0290101', 'hex'));
});
