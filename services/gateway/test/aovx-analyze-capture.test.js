import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { analyzeAovxCapture } from '../src/aovx/analyze-capture.js';

const DEVICE = Buffer.from('944063243931', 'hex');

test('analyzes captured packet exports without assigning telemetry units', () => {
  const body = Buffer.alloc(44);
  body.writeUInt32BE(0x12345678, 8);
  Buffer.from('261119090653', 'hex').copy(body, 22);
  Buffer.from('aabbccdd', 'hex').copy(body, 40);
  const wire = encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: DEVICE, sequenceNumber: 16, body });
  const result = analyzeAovxCapture({ packets: [{ id: '96', raw_payload_hex: wire.toString('hex') }] });

  assert.equal(result.packetCount, 1);
  assert.equal(result.decodedCount, 1);
  assert.equal(result.invalidCount, 0);
  assert.equal(result.messageIds['0x0200'], 1);
  assert.equal(result.telemetry0200[0].deviceIdBcd, '944063243931');
  assert.equal(result.telemetry0200[0].timestampBcdHex, '261119090653');
  assert.equal(result.telemetry0200[0].tailOffset, 40);
  assert.equal(result.telemetry0200[0].tailHex, 'aabbccdd');
  assert.match(result.telemetryNote, /No units/);
});

test('reports malformed packet rows and continues with valid rows', () => {
  const wire = encodeAovxFrame({ messageId: 0x0001, deviceIdBcd: DEVICE, sequenceNumber: 1, body: Buffer.alloc(5) });
  const result = analyzeAovxCapture({ packets: [
    { id: 'bad', raw_payload_hex: 'not-hex' },
    { id: 'ok', raw_payload_hex: wire.toString('hex') }
  ] });
  assert.equal(result.decodedCount, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.errors[0].packetId, 'bad');
});

test('rejects invalid capture shapes and excessive packet counts', () => {
  assert.throws(() => analyzeAovxCapture({}), /packets array/);
  assert.throws(() => analyzeAovxCapture({ packets: Array(5001).fill({}) }), /exceeds/);
});
