import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aovxChecksum,
  decodeAovxFrame,
  encodeAovxFrame,
  escapeAovxPayload,
  unescapeAovxPayload
} from '../src/aovx/frame.js';

const AUTH_SAMPLE = Buffer.from(
  '7e0102000c22104221432800023232313034323231343332383e7e',
  'hex'
);

test('decodes the documented 0x0102 authentication sample', () => {
  const decoded = decodeAovxFrame(AUTH_SAMPLE);
  assert.equal(decoded.messageId, 0x0102);
  assert.equal(decoded.bodyLength, 12);
  assert.equal(decoded.sequenceNumber, 2);
  assert.equal(decoded.deviceIdBcd.toString('hex'), '221042214328');
  assert.equal(decoded.body.toString('ascii'), '221042214328');
});

test('encodes and decodes a frame with escaped 0x7E and 0x7D bytes', () => {
  const frame = encodeAovxFrame({
    messageId: 0x0200,
    deviceIdBcd: Buffer.from('221042214328', 'hex'),
    sequenceNumber: 513,
    body: Buffer.from([0x7e, 0x7d, 0x00, 0xff])
  });
  assert.ok(frame.includes(Buffer.from([0x7d, 0x02])));
  assert.ok(frame.includes(Buffer.from([0x7d, 0x01])));
  const decoded = decodeAovxFrame(frame);
  assert.equal(decoded.messageId, 0x0200);
  assert.equal(decoded.sequenceNumber, 513);
  assert.deepEqual(decoded.body, Buffer.from([0x7e, 0x7d, 0x00, 0xff]));
});

test('checksum is XOR over the unescaped packet bytes', () => {
  assert.equal(aovxChecksum(Buffer.from([0x01, 0x02, 0x03])), 0x00);
});

test('rejects a corrupted checksum', () => {
  const corrupted = Buffer.from(AUTH_SAMPLE);
  corrupted[corrupted.length - 2] ^= 0x01;
  assert.throws(() => decodeAovxFrame(corrupted), /checksum mismatch/);
});

test('rejects inconsistent body length', () => {
  const frame = Buffer.from(AUTH_SAMPLE);
  frame[4] = 0x0b;
  assert.throws(() => decodeAovxFrame(frame), /body length mismatch/);
});

test('rejects invalid and truncated escape sequences', () => {
  assert.throws(() => unescapeAovxPayload(Buffer.from([0x7d])), /truncated/);
  assert.throws(() => unescapeAovxPayload(Buffer.from([0x7d, 0x03])), /invalid/);
  assert.throws(() => unescapeAovxPayload(Buffer.from([0x7e])), /unescaped/);
});

test('escape and unescape preserve all byte values that need translation', () => {
  const original = Buffer.from([0x00, 0x7d, 0x7e, 0xff]);
  assert.deepEqual(unescapeAovxPayload(escapeAovxPayload(original)), original);
});

test('rejects oversized message bodies instead of truncating the length field', () => {
  assert.throws(() => encodeAovxFrame({
    messageId: 0x0200,
    deviceIdBcd: Buffer.from('221042214328', 'hex'),
    sequenceNumber: 1,
    body: Buffer.alloc(1024)
  }), /1023/);
});
