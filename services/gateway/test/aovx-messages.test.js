import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAovxFrame } from '../src/aovx/frame.js';
import { parseAovxMessage } from '../src/aovx/messages.js';

const REGISTRATION = Buffer.from('7e01000026221042214328000100000000414f5658000000000000000000000000000000000000000000000000000000000000487e', 'hex');
const AUTHENTICATION = Buffer.from('7e0102000c22104221432800023232313034323231343332383e7e', 'hex');
const REGISTRATION_RESPONSE = Buffer.from('7e8100000f22104221432800010001003232313034323231343332383f7e', 'hex');
const ACK = Buffer.from('7e8001000522104221432800010001000200b97e', 'hex');
const BASIC_INFORMATION = Buffer.from('7e0200004c221042214328000a00000000000000000301e611be06fc5dc0004100000000210928172305010400000000300116310107f00d000000005dbb00007e', 'hex');

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
  assert.equal(parsed.data.responseMessageId, 0x0100);
  assert.equal(parsed.data.result, 2);
});

test('parses fixed 0x0200 telemetry prefix and retains model-dependent tail', () => {
  const parsed = parseAovxMessage(decodeAovxFrame(BASIC_INFORMATION));
  assert.equal(parsed.data.alarm, 0);
  assert.equal(parsed.data.status, 3);
  assert.equal(parsed.data.latitudeRaw, 0x01e611be);
  assert.equal(parsed.data.longitudeRaw, 0x06fc5dc0);
  assert.deepEqual(parsed.data.timestampBcd, Buffer.from('210928172305', 'hex'));
  assert.equal(parsed.data.mileageRaw, 0x010400000000);
  assert.equal(parsed.data.remainingBody.length, 36);
});

test('keeps unimplemented messages opaque and rejects truncated known messages', () => {
  const unknown = parseAovxMessage({ messageId: 0x0900, body: Buffer.from([1, 2]), deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1, bodyLength: 2 });
  assert.deepEqual(unknown.data.rawBody, Buffer.from([1, 2]));
  assert.throws(() => parseAovxMessage({ messageId: 0x8001, body: Buffer.alloc(4), deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1, bodyLength: 4 }), /must be 5 bytes/);
});
