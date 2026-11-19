import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { analyzeAovxDelivery } from '../src/aovx/analyze-delivery.js';

const DEVICE = Buffer.from('944063243931', 'hex');

function packet({ timestamp = '261119183551', status = 0x10000000, id = '1', receivedAt = '2026-11-19T18:36:08.000Z', sequence = 1 } = {}) {
  const body = Buffer.alloc(40);
  body.writeUInt32BE(status, 4);
  Buffer.from(timestamp, 'hex').copy(body, 22);
  const raw = encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: DEVICE, sequenceNumber: sequence, body });
  return { id, raw_payload_hex: raw.toString('hex'), received_at: receivedAt };
}

test('decodes BCD time and reports UTC-assumption delivery age and status mode', () => {
  const result = analyzeAovxDelivery({ packets: [
    packet({ id: 'live', receivedAt: '2026-11-19T18:36:08.000Z' }),
    packet({ id: 'buffered', status: 0x90000000, timestamp: '261119173551', receivedAt: '2026-11-19T18:36:08.000Z', sequence: 2 })
  ] });
  assert.equal(result.telemetry0200Count, 2);
  assert.deepEqual(result.modeCounts, { buffered: 1, realtime: 1 });
  assert.equal(result.records[0].deviceTimestampUtcAssumption, '2026-11-19T18:35:51.000Z');
  assert.equal(result.records[0].ageSecondsUtcAssumption, 17);
  assert.equal(result.deliveryAgeUtcAssumption.sampleCount, 2);
  assert.match(result.notes[0], /timezone is not confirmed/);
});

test('rejects invalid BCD digits and impossible calendar timestamps', () => {
  const result = analyzeAovxDelivery({ packets: [
    packet({ timestamp: '26fa19183551' }),
    packet({ timestamp: '261132183551', id: 'impossible' })
  ] });
  assert.equal(result.deliveryAgeUtcAssumption.invalidDeviceTimestamps, 2);
  assert.equal(result.records[0].deviceTimestampUtcAssumption, null);
  assert.equal(result.records[1].deviceTimestampUtcAssumption, null);
});

test('groups only exact full-frame duplicates and preserves observation counts', () => {
  const duplicate = packet({ id: 'a' });
  const result = analyzeAovxDelivery({ packets: [
    duplicate,
    { ...duplicate, id: 'b', received_at: '2026-11-19T19:00:00.000Z' },
    packet({ id: 'different-status', status: 0x90000000 })
  ] });
  assert.equal(result.repeatedFrameSummary.uniqueFrameCount, 2);
  assert.equal(result.repeatedFrameSummary.repeatedHashGroupCount, 1);
  assert.equal(result.repeatedFrameSummary.duplicateObservationCount, 1);
  assert.equal(result.repeatedFrameSummary.groups[0].observationCount, 2);
});

test('flags same device timestamp with different status without deduplicating', () => {
  const result = analyzeAovxDelivery({ packets: [
    packet({ id: 'live', status: 0x10000000 }),
    packet({ id: 'buffered', status: 0x90000000, receivedAt: '2026-11-19T18:40:00.000Z' })
  ] });
  assert.equal(result.timestampStatusConflictCount, 1);
  assert.equal(result.telemetry0200Count, 2);
});

test('handles missing receive times and rejects invalid capture shapes', () => {
  const row = packet();
  delete row.received_at;
  const result = analyzeAovxDelivery({ packets: [row] });
  assert.equal(result.deliveryAgeUtcAssumption.missingReceivedAt, 1);
  assert.equal(result.deliveryAgeUtcAssumption.sampleCount, 0);
  assert.throws(() => analyzeAovxDelivery({}), /packets array/);
  assert.throws(() => analyzeAovxDelivery({ packets: Array(5001).fill({}) }), /exceeds/);
});


test('bounds raw frame size before decoding', () => {
  const result = analyzeAovxDelivery({ packets: [{ id: 'oversized', raw_payload_hex: 'aa'.repeat(65537) }] });
  assert.equal(result.telemetry0200Count, 0);
  assert.match(result.errors[0].error, /bounded even-length hexadecimal frame/);
});
