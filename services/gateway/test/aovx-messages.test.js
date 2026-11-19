import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAovxFrame } from '../src/aovx/frame.js';
import {
  parseAovxAcknowledgement,
  parseAovxAuthentication,
  parseAovxMessage,
  parseAovxRegistration,
  parseAovxRegistrationResponse
} from '../src/aovx/messages.js';

const AUTH_SAMPLE = Buffer.from('7e0102000c22104221432800023232313034323231343332383e7e', 'hex');
const REGISTRATION_SAMPLE = Buffer.from('7e01000026221042214328000100000000414f5658000000000000000000000000000000000000000000000000000000000000487e', 'hex');
const REGISTRATION_RESPONSE_SAMPLE = Buffer.from('7e8100000f22104221432800010001003232313034323231343332383f7e', 'hex');
const ACK_SAMPLE = Buffer.from('7e8001000522104221432800010001020000b97e', 'hex');

test('parses documented 0x0100 registration fields without normalizing raw identifiers', () => {
  const parsed = parseAovxRegistration(decodeAovxFrame(REGISTRATION_SAMPLE));
  assert.equal(parsed.provinceAreaId.toString('hex'), '0000');
  assert.equal(parsed.districtId.toString('hex'), '0000');
  assert.equal(parsed.manufacturerId.toString('ascii'), 'AOVX');
  assert.equal(parsed.deviceType.length, 20);
  assert.equal(parsed.terminalId.length, 7);
  assert.equal(parsed.plateColor, 0);
  assert.equal(parsed.vehicleLogo, 0);
});

test('parses documented 0x0102 authentication code as opaque bytes and ASCII view', () => {
  const parsed = parseAovxAuthentication(decodeAovxFrame(AUTH_SAMPLE));
  assert.equal(parsed.authenticationCode.toString('hex'), '323231303432323134333238');
  assert.equal(parsed.authenticationCodeText, '221042214328');
  assert.equal(parsed.sequenceNumber, 2);
});

test('parses successful 0x8100 response and its variable authentication code', () => {
  const parsed = parseAovxRegistrationResponse(decodeAovxFrame(REGISTRATION_RESPONSE_SAMPLE));
  assert.equal(parsed.replySequenceNumber, 1);
  assert.equal(parsed.result, 0);
  assert.equal(parsed.resultName, 'success');
  assert.equal(parsed.authenticationCodeText, '221042214328');
});

test('parses documented 0x8001 acknowledgement fields', () => {
  const parsed = parseAovxAcknowledgement(decodeAovxFrame(ACK_SAMPLE));
  assert.equal(parsed.replySequenceNumber, 1);
  assert.equal(parsed.acknowledgedMessageId, 0x0200);
  assert.equal(parsed.result, 0);
  assert.equal(parsed.resultName, 'success');
});

test('dispatches known messages and preserves unknown message bodies as opaque data', () => {
  assert.equal(parseAovxMessage(decodeAovxFrame(ACK_SAMPLE)).type, 'acknowledgement');
  const unknown = parseAovxMessage({ messageId: 0x7777, deviceIdBcd: Buffer.alloc(6), sequenceNumber: 4, body: Buffer.from([1, 2]) });
  assert.equal(unknown.type, 'unknown');
  assert.deepEqual(unknown.body, Buffer.from([1, 2]));
});

test('rejects malformed known message body lengths and inconsistent registration results', () => {
  assert.throws(() => parseAovxRegistration({ messageId: 0x0100, body: Buffer.alloc(37) }), /exactly 38/);
  assert.throws(() => parseAovxAcknowledgement({ messageId: 0x8001, body: Buffer.alloc(4) }), /exactly 5/);
  assert.throws(() => parseAovxRegistrationResponse({
    messageId: 0x8100, deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1,
    body: Buffer.from([0, 1, 0])
  }), /must contain an authentication code/);
  assert.throws(() => parseAovxRegistrationResponse({
    messageId: 0x8100, deviceIdBcd: Buffer.alloc(6), sequenceNumber: 1,
    body: Buffer.from([0, 1, 1, 0x41])
  }), /must not contain an authentication code/);
});

test('rejects passing a decoded frame with a different message ID', () => {
  assert.throws(() => parseAovxAuthentication({ messageId: 0x0100, body: Buffer.alloc(1) }), /unexpected AOVX message ID/);
});
