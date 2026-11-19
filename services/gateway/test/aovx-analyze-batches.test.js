import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { analyzeAovxDeliveryBatches } from '../src/aovx/analyze-batches.js';

const DEVICE = Buffer.from('944063243931', 'hex');

function packet({ id, receivedAt, status = 0x90780000, sequence = 1 } = {}) {
  const body = Buffer.alloc(40);
  body.writeUInt32BE(status, 4);
  Buffer.from('261119183551', 'hex').copy(body, 22);
  return {
    id,
    received_at: receivedAt,
    raw_payload_hex: encodeAovxFrame({
      messageId: 0x0200,
      deviceIdBcd: DEVICE,
      sequenceNumber: sequence,
      body
    }).toString('hex')
  };
}

test('groups receive bursts and detects exact frames repeated across batches', () => {
  const repeated = packet({ id: 'same-a', receivedAt: '2026-11-19T15:00:00.000Z' });
  const result = analyzeAovxDeliveryBatches({ packets: [
    repeated,
    packet({ id: 'same-b', receivedAt: '2026-11-19T15:00:35.000Z', sequence: 2 }),
    { ...repeated, id: 'same-c', received_at: '2026-11-19T16:20:00.000Z' },
    packet({ id: 'live', receivedAt: '2026-11-19T16:20:35.000Z', status: 0x10000000, sequence: 3 })
  ] });
  assert.equal(result.batchCount, 2);
  assert.equal(result.batches[0].packetCount, 2);
  assert.equal(result.batches[1].packetCount, 2);
  assert.equal(result.receiveIntervals.medianSeconds, 35);
  assert.equal(result.repeatedFrameSummary.repeatedFrameGroupCount, 1);
  assert.equal(result.repeatedFrameSummary.groupsRepeatedAcrossBatches, 1);
  assert.equal(result.repeatedFrameSummary.observationsInCrossBatchGroups, 2);
});

test('uses a configurable strict greater-than batch gap threshold', () => {
  const result = analyzeAovxDeliveryBatches({ packets: [
    packet({ receivedAt: '2026-11-19T15:00:00.000Z' }),
    packet({ receivedAt: '2026-11-19T15:05:00.000Z', sequence: 2 })
  ] }, { batchGapMinutes: 5 });
  assert.equal(result.batchCount, 1);
});

test('excludes missing receive times from chronology without dropping telemetry counts', () => {
  const row = packet({ receivedAt: '2026-11-19T15:00:00.000Z' });
  const missing = packet({ receivedAt: '2026-11-19T15:01:00.000Z', sequence: 2 });
  delete missing.received_at;
  const result = analyzeAovxDeliveryBatches({ packets: [row, missing] });
  assert.equal(result.telemetry0200Count, 2);
  assert.equal(result.chronologicalPacketCount, 1);
  assert.equal(result.missingOrInvalidReceivedAtCount, 1);
});

test('validates capture shape, packet bounds, and batch threshold', () => {
  assert.throws(() => analyzeAovxDeliveryBatches({}), /packets array/);
  assert.throws(() => analyzeAovxDeliveryBatches({ packets: Array(5001).fill({}) }), /exceeds/);
  assert.throws(() => analyzeAovxDeliveryBatches({ packets: [] }, { batchGapMinutes: 0 }), /batchGapMinutes/);
});
