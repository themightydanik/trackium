import test from 'node:test';
import assert from 'node:assert/strict';
import { aovxChecksum, decodeAovxFrame, encodeAovxFrame, escapeAovxPayload, unescapeAovxPayload } from '../src/aovx/frame.js';

const AUTH_SAMPLE = Buffer.from('7e0102000c22104221432800023232313034323231343332383e7e', 'hex');
const REGISTRATION_SAMPLE = Buffer.from('7e01000026221042214328000100000000414f5658000000000000000000000000000000000000000000000000000000000000487e', 'hex');
const REGISTRATION_RESPONSE_SAMPLE = Buffer.from('7e8100000f22104221432800010001003232313034323231343332383f7e', 'hex');

test('decodes documented 0x0102 sample and reports XOR candidate match', () => {
  const decoded = decodeAovxFrame(AUTH_SAMPLE);
  assert.equal(decoded.messageId, 0x0102);
  assert.equal(decoded.bodyLength, 12);
  assert.equal(decoded.sequenceNumber, 2);
  assert.equal(decoded.deviceIdBcd.toString('hex'), '221042214328');
  assert.equal(decoded.body.toString('ascii'), '221042214328');
  assert.equal(decoded.checksumStatus, 'xor-match');
});

test('decodes 0x0100 and 0x8100 workbook samples while flagging XOR mismatches', () => {
  const registration = decodeAovxFrame(REGISTRATION_SAMPLE);
  assert.equal(registration.messageId, 0x0100);
  assert.equal(registration.bodyLength, 38);
  assert.equal(registration.checksum, 0x48);
  assert.equal(registration.checksumStatus, 'xor-mismatch');
  const response = decodeAovxFrame(REGISTRATION_RESPONSE_SAMPLE);
  assert.equal(response.messageId, 0x8100);
  assert.equal(response.bodyLength, 15);
  assert.equal(response.checksum, 0x3f);
  assert.equal(response.checksumStatus, 'xor-mismatch');
});

test('strict XOR-candidate policy is opt-in', () => {
  assert.throws(() => decodeAovxFrame(REGISTRATION_SAMPLE, { checksumPolicy: 'require-xor-match' }), /XOR-candidate checksum mismatch/);
  assert.throws(() => decodeAovxFrame(AUTH_SAMPLE, { checksumPolicy: 'unknown' }), /checksumPolicy/);
});

test('encodes and decodes escaped 0x7E and 0x7D bytes', () => {
  const frame = encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: Buffer.from('221042214328', 'hex'), sequenceNumber: 513, body: Buffer.from([0x7e, 0x7d, 0x00, 0xff]) });
  assert.ok(frame.includes(Buffer.from([0x7d, 0x02])));
  assert.ok(frame.includes(Buffer.from([0x7d, 0x01])));
  const decoded = decodeAovxFrame(frame);
  assert.equal(decoded.messageId, 0x0200);
  assert.equal(decoded.sequenceNumber, 513);
  assert.deepEqual(decoded.body, Buffer.from([0x7e, 0x7d, 0x00, 0xff]));
});

test('XOR candidate helper computes XOR over bytes', () => {
  assert.equal(aovxChecksum(Buffer.from([0x01, 0x02, 0x03])), 0x00);
});

test('reports checksum mismatch without discarding a structurally valid frame', () => {
  const corrupted = Buffer.from(AUTH_SAMPLE);
  corrupted[corrupted.length - 2] ^= 0x01;
  const decoded = decodeAovxFrame(corrupted);
  assert.equal(decoded.checksumStatus, 'xor-mismatch');
  assert.equal(decoded.body.toString('ascii'), '221042214328');
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

test('escape and unescape preserve translated byte values', () => {
  const original = Buffer.from([0x00, 0x7d, 0x7e, 0xff]);
  assert.deepEqual(unescapeAovxPayload(escapeAovxPayload(original)), original);
});

test('rejects oversized message bodies', () => {
  assert.throws(() => encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: Buffer.from('221042214328', 'hex'), sequenceNumber: 1, body: Buffer.alloc(1024) }), /1023/);
});
