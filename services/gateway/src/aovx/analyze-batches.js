import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeAovxFrame } from './frame.js';

const MAX_PACKETS = 5000;
const MAX_FRAME_HEX_LENGTH = 131072;
const MAX_BATCH_DETAILS = 100;
const DEFAULT_BATCH_GAP_MINUTES = 15;

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarizeIntervals(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    sampleCount: sorted.length,
    minSeconds: sorted[0] ?? null,
    medianSeconds: percentile(sorted, 0.5),
    p95Seconds: percentile(sorted, 0.95),
    maxSeconds: sorted.at(-1) ?? null
  };
}

function parseReceivedAt(value) {
  if (typeof value !== 'string') return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function analyzeAovxDeliveryBatches(document, options = {}) {
  if (!document || !Array.isArray(document.packets)) {
    throw new TypeError('capture must be a JSON object with a packets array');
  }
  if (document.packets.length > MAX_PACKETS) {
    throw new RangeError(`capture exceeds ${MAX_PACKETS} packets`);
  }

  const gapMinutes = options.batchGapMinutes ?? DEFAULT_BATCH_GAP_MINUTES;
  if (!Number.isFinite(gapMinutes) || gapMinutes <= 0 || gapMinutes > 1440) {
    throw new RangeError('batchGapMinutes must be greater than 0 and at most 1440');
  }
  const gapMs = gapMinutes * 60 * 1000;
  const errors = [];
  const records = [];
  let nonTelemetryCount = 0;
  let invalidCount = 0;
  let missingOrInvalidReceivedAtCount = 0;

  for (let index = 0; index < document.packets.length; index += 1) {
    const item = document.packets[index];
    try {
      const hex = item?.raw_payload_hex;
      if (typeof hex !== 'string' || hex.length < 4 ||
          hex.length > MAX_FRAME_HEX_LENGTH || hex.length % 2 ||
          !/^[0-9a-f]+$/i.test(hex)) {
        throw new Error('raw_payload_hex must be a bounded even-length hexadecimal frame');
      }
      const wire = Buffer.from(hex, 'hex');
      const frame = decodeAovxFrame(wire);
      if (frame.messageId !== 0x0200) {
        nonTelemetryCount += 1;
        continue;
      }
      const receivedAt = typeof item.received_at === 'string' ? item.received_at : null;
      const receivedMs = parseReceivedAt(receivedAt);
      if (receivedMs === null) missingOrInvalidReceivedAtCount += 1;
      const status = frame.body.length >= 8 ? frame.body.readUInt32BE(4) : 0;
      records.push({
        inputIndex: index,
        receivedAt,
        receivedMs,
        deliveryMode: (status & 0x80000000) !== 0 ? 'buffered' : 'realtime',
        frameHash: createHash('sha256').update(wire).digest('hex')
      });
    } catch (error) {
      invalidCount += 1;
      if (errors.length < 100) errors.push({
        packetIndex: index,
        error: error instanceof Error ? error.message : 'unknown decode error'
      });
    }
  }

  const chronological = records
    .filter(record => record.receivedMs !== null)
    .sort((left, right) => left.receivedMs - right.receivedMs || left.inputIndex - right.inputIndex);
  const intervals = [];
  const batches = [];
  for (let recordIndex = 0; recordIndex < chronological.length; recordIndex += 1) {
    const record = chronological[recordIndex];
    const previous = chronological[recordIndex - 1];
    if (previous) intervals.push((record.receivedMs - previous.receivedMs) / 1000);

    const currentBatch = batches.at(-1);
    const gapSeconds = currentBatch
      ? (record.receivedMs - currentBatch.lastReceivedMs) / 1000
      : null;
    if (!currentBatch || gapSeconds * 1000 > gapMs) {
      batches.push({
        batchNumber: batches.length + 1,
        firstReceivedMs: record.receivedMs,
        lastReceivedMs: record.receivedMs,
        packetCount: 0,
        bufferedCount: 0,
        realtimeCount: 0,
        interArrivalSeconds: []
      });
    }
    const batch = batches.at(-1);
    if (batch.packetCount > 0) {
      batch.interArrivalSeconds.push((record.receivedMs - batch.lastReceivedMs) / 1000);
    }
    batch.packetCount += 1;
    batch[record.deliveryMode === 'buffered' ? 'bufferedCount' : 'realtimeCount'] += 1;
    batch.lastReceivedMs = record.receivedMs;
    record.batchNumber = batch.batchNumber;
  }

  const hashGroups = new Map();
  for (const record of chronological) {
    if (!hashGroups.has(record.frameHash)) hashGroups.set(record.frameHash, []);
    hashGroups.get(record.frameHash).push(record);
  }
  const repeatedGroups = [...hashGroups.values()].filter(group => group.length > 1);
  const crossBatchGroups = repeatedGroups.filter(group =>
    new Set(group.map(record => record.batchNumber)).size > 1
  );

  const batchDetails = batches.map(batch => ({
    batchNumber: batch.batchNumber,
    firstReceivedAt: new Date(batch.firstReceivedMs).toISOString(),
    lastReceivedAt: new Date(batch.lastReceivedMs).toISOString(),
    durationSeconds: Math.round((batch.lastReceivedMs - batch.firstReceivedMs) / 1000),
    packetCount: batch.packetCount,
    modeCounts: { buffered: batch.bufferedCount, realtime: batch.realtimeCount },
    interArrival: summarizeIntervals(batch.interArrivalSeconds)
  }));

  return {
    packetCount: document.packets.length,
    telemetry0200Count: records.length,
    nonTelemetryCount,
    invalidCount,
    missingOrInvalidReceivedAtCount,
    batchGapThresholdMinutes: gapMinutes,
    chronologicalPacketCount: chronological.length,
    batchCount: batches.length,
    receiveIntervals: summarizeIntervals(intervals),
    batchGapIntervals: batches.slice(1).map((batch, index) => ({
      afterBatch: index + 1,
      beforeBatch: index + 2,
      gapSeconds: Math.round((batch.firstReceivedMs - batches[index].lastReceivedMs) / 1000)
    })),
    repeatedFrameSummary: {
      repeatedFrameGroupCount: repeatedGroups.length,
      repeatedObservationCount: repeatedGroups.reduce((sum, group) => sum + group.length, 0),
      groupsRepeatedAcrossBatches: crossBatchGroups.length,
      observationsInCrossBatchGroups: crossBatchGroups.reduce((sum, group) => sum + group.length, 0)
    },
    batches: batchDetails.slice(0, MAX_BATCH_DETAILS),
    omittedBatchCount: Math.max(0, batchDetails.length - MAX_BATCH_DETAILS),
    errors,
    notes: [
      'A delivery batch is a descriptive grouping of received 0x0200 packets; a new batch starts only when the receive-time gap is greater than the configured threshold.',
      'The batch-gap threshold is an analysis heuristic, not an AOVX protocol field or proof of a device buffering cycle.',
      'Repeated frames are exact SHA-256 matches of the complete received wire frame. Cross-batch repetition does not identify whether replay originated in the tracker, gateway path, or another component.',
      'Packets without a valid received_at timestamp are excluded from chronology and batch grouping but remain included in packet and telemetry counts.',
      'Device timestamps and their timezone are not interpreted in this report; use a separate delivery-age report for explicitly provisional UTC-assumption calculations.',
      'This utility is offline-only and does not deduplicate, suppress, acknowledge, or modify telemetry.'
    ]
  };
}

function parseArguments(args) {
  const [inputPath, ...rest] = args;
  if (!inputPath) throw new Error('Usage: npm run aovx:batches -- <capture.json> [--batch-gap-minutes <n>]');
  let batchGapMinutes = DEFAULT_BATCH_GAP_MINUTES;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--batch-gap-minutes' || !rest[index + 1]) {
      throw new Error('Usage: npm run aovx:batches -- <capture.json> [--batch-gap-minutes <n>]');
    }
    batchGapMinutes = Number(rest[index + 1]);
    index += 1;
  }
  return { inputPath, batchGapMinutes };
}

async function main() {
  const { inputPath, batchGapMinutes } = parseArguments(process.argv.slice(2));
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  process.stdout.write(`${JSON.stringify(analyzeAovxDeliveryBatches(input, { batchGapMinutes }), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`AOVX batch analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
