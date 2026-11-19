import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAovxFrame } from '../src/aovx/frame.js';
import { parseAovxMessage } from '../src/aovx/messages.js';

const REGISTRATION = Buffer.from('7e01000026221042214328000100000000414f5658000000000000000000000000000000000000000000000000000000000000487e', 'hex');
const AUTHENTICATION = Buffer.from('7e0102000c22104221432800023232313034323231343332383e7e', 'hex');
const REGISTRATION_RESPONSE = Buffer.from('7e8100000f22104221432800010001003232313034323231343332383f7e', 'hex');
const ACK = Buffer.from('7e8001000522104221432800010001020000b97e', 'hex');
const QUERY_RESPONSE = Buffer.from('7e0001000522104221432800010004020000b97e', 'hex');

test('parses registration fields without assigning model identity semantics', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(REGISTRATION));
  assert.equal(parsed.messageName, 'DEVICE_REGISTRATION');
  assert.equal(parsed.data.provinceAreaId, 0);
  assert.equal(parsed.data.districtId, 0);
  assert.equal(parsed.data.manufacturerIdAscii, 'AOVX');
  assert.equal(parsed.data.deviceType.length, 20);
  assert.equal(parsed.data.terminalId.length, 7);
});

test('parses authentication code as opaque bytes and optional printable ASCII', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(AUTHENTICATION));
  assert.equal(parsed.data.authenticationCodeAscii, '221042214328');
  assert.equal(parsed.data.authenticationCode.length, 12);
});

test('parses registration response reply sequence, result and authentication code', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(REGISTRATION_RESPONSE));
  assert.equal(parsed.data.replySequenceNumber, 1);
  assert.equal(parsed.data.result, 0);
  assert.equal(parsed.data.authenticationCodeAscii, '221042214328');
});

test('parses server general ACK body', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(ACK));
  assert.equal(parsed.data.responseSequenceNumber, 1);
  assert.equal(parsed.data.responseMessageId, 0x0200);
  assert.equal(parsed.data.result, 0);
});

test('parses documented 0x0001 query response', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(QUERY_RESPONSE));
  assert.equal(parsed.data.responseSequenceNumber, 4);
  assert.equal(parsed.data.correspondingDeviceMessageId, 0x0200);
  assert.equal(parsed.data.result, 0);
});

test('parses the documented 0x0200 fixed telemetry prefix and preserves opaque tail', () => {
  // The workbook's sample declares a 76-byte body. Exercise the documented
  // 40-byte fixed prefix directly and use a synthetic opaque tail; this is not
  // represented as a complete captured wire frame or a GL110 fixture.
  const fixedPrefix = Buffer.from(
    '000000000000000301e611be06fc5dc0004100000000210928172305010400000000300116310107',
    'hex'
  );
  const body = Buffer.concat([fixedPrefix, Buffer.alloc(36, 0xa5)]);
  assert.equal(body.length, 76);
  const parsed = parseAovxMessage({
    messageId: 0x0200,
    deviceIdBcd: Buffer.from('221042214328', 'hex'),
    sequenceNumber: 10,
    bodyLength: body.length,
    checksumStatus: 'not-evaluated',
    body
  });
  assert.equal(parsed.data.alarm, 0);
  assert.equal(parsed.data.status, 3);
  assert.equal(parsed.data.latitudeRaw, 0x01e611be);
  assert.equal(parsed.data.longitudeRaw, 0x06fc5dc0);
  assert.deepEqual(parsed.data.timestampBcd, Buffer.from('210928172305', 'hex'));
  assert.equal(parsed.data.mileageRaw, 0x010400000000);
  assert.equal(parsed.data.remainingBody.length, 36);
  assert.deepEqual(parsed.data.remainingBody, Buffer.alloc(36, 0xa5));
});

test('keeps unimplemented messages opaque and rejects truncated known messages', () => {
  const unknown = parseAovxMessage({ messageId: 0x0900, body: Buffer.from([1, 2]), deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1, bodyLength: 2 });
  assert.deepEqual(unknown.data.rawBody, Buffer.from([1, 2]));
  assert.throws(() => parseAovxMessage({ messageId: 0x8001, body: Buffer.alloc(4), deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1, bodyLength: 4 }), /must be 5 bytes/);
});
