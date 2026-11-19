import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { analyzeAovxCapture } from '../src/aovx/analyze-capture.js';

const DEVICE = Buffer.from('944063243931', 'hex');

function packet(tail, sequenceNumber = 1, id = String(sequenceNumber)) {
  const body = Buffer.alloc(40 + tail.length);
  Buffer.from('261119090653', 'hex').copy(body, 22);
  Buffer.from(tail).copy(body, 40);
  const wire = encodeAovxFrame({
    messageId: 0x0200,
    deviceIdBcd: DEVICE,
    sequenceNumber,
    body
  });
  return { id, raw_payload_hex: wire.toString('hex') };
}

test('analyzes captured packet exports without assigning telemetry units', () => {
  const result = analyzeAovxCapture({
    packets: [packet([0xaa, 0xbb, 0xcc, 0xdd], 16, '96')]
  });

  assert.equal(result.packetCount, 1);
  assert.equal(result.decodedCount, 1);
  assert.equal(result.invalidCount, 0);
  assert.equal(result.messageIds['0x0200'], 1);
  assert.equal(result.telemetry0200[0].deviceIdBcd, '944063243931');
  assert.equal(result.telemetry0200[0].timestampBcdHex, '261119090653');
  assert.equal(result.telemetry0200[0].tailOffset, 40);
  assert.equal(result.telemetry0200[0].tailHex, 'aabbccdd');
  assert.equal(result.tailAnalysis0200.groupCount, 1);
  assert.match(result.telemetryNote, /No units/);
});

test('reports stable and varying tail offsets with byte frequencies', () => {
  const result = analyzeAovxCapture({
    packets: [
      packet([0xaa, 0xbb, 0xcc, 0xdd], 1),
      packet([0xaa, 0xbb, 0x00, 0xdd], 2),
      packet([0xaa, 0xbb, 0x11, 0xdd], 3)
    ]
  });
  const group = result.tailAnalysis0200.groups[0];

  assert.equal(group.bodyLength, 44);
  assert.equal(group.packetCount, 3);
  assert.deepEqual(group.stableOffsetRanges.ranges, [
    { start: 0, end: 1 },
    { start: 3, end: 3 }
  ]);
  assert.deepEqual(group.varyingOffsetRanges.ranges, [{ start: 2, end: 2 }]);
  assert.equal(group.offsets[2].distinctValueCount, 3);
  assert.deepEqual(group.offsets[2].frequencies, [
    { byte: '00', count: 1 },
    { byte: '11', count: 1 },
    { byte: 'cc', count: 1 }
  ]);
});

test('compares tail groups of different body and tail lengths without semantic labels', () => {
  const result = analyzeAovxCapture({
    packets: [
      packet([0xaa, 0xbb, 0xcc, 0xdd], 1),
      packet([0xaa, 0x99, 0xcc, 0xee, 0xff, 0x11], 2)
    ]
  });
  const comparison = result.tailAnalysis0200.comparisons[0];

  assert.equal(result.tailAnalysis0200.groupCount, 2);
  assert.equal(result.tailAnalysis0200.groups[0].bodyLength, 44);
  assert.equal(result.tailAnalysis0200.groups[1].bodyLength, 46);
  assert.equal(comparison.comparedOffsetCount, 4);
  assert.equal(comparison.differingOffsetCount, 2);
  assert.deepEqual(comparison.differingOffsetSamples, [
    { offset: 1, groupAByte: 'bb', groupBByte: '99' },
    { offset: 3, groupAByte: 'dd', groupBByte: 'ee' }
  ]);
  assert.match(comparison.note, /does not identify a field/);
});

test('bounds per-packet details and aggregate offset output', () => {
  const longTail = Array.from({ length: 300 }, (_, index) => index & 0xff);
  const packets = Array.from({ length: 101 }, (_, index) =>
    packet(longTail, index + 1, String(index + 1))
  );
  const result = analyzeAovxCapture({ packets });

  assert.equal(result.telemetry0200.length, 100);
  assert.equal(result.telemetry0200Omitted, 1);
  assert.equal(result.tailAnalysis0200.groups[0].analyzedOffsetCount, 256);
  assert.equal(result.tailAnalysis0200.groups[0].offsets.length, 256);
  assert.equal(result.tailAnalysis0200.groups[0].offsetsTruncated, true);
});

test('reports malformed packet rows and continues with valid rows', () => {
  const valid = packet([0xaa, 0xbb], 2, 'ok');
  const result = analyzeAovxCapture({ packets: [
    { id: 'bad', raw_payload_hex: 'not-hex' },
    valid
  ] });
  assert.equal(result.decodedCount, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.errors[0].packetId, 'bad');
});

test('handles empty captures and rejects invalid shapes and excessive packet counts', () => {
  const empty = analyzeAovxCapture({ packets: [] });
  assert.equal(empty.tailAnalysis0200.packetCount, 0);
  assert.equal(empty.tailAnalysis0200.groupCount, 0);
  assert.throws(() => analyzeAovxCapture({}), /packets array/);
  assert.throws(() => analyzeAovxCapture({ packets: Array(5001).fill({}) }), /exceeds/);
});
