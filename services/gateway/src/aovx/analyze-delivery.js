import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const MAX_PACKETS = 5000;
const MAX_DETAILS = 200;

function decodeBcdTimestamp(hex) {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2}){6}$/i.test(hex)) return null;
  const digits = hex.match(/../gu).map(pair => Number(pair));
  if (digits.some(value => !Number.isInteger(value) || value > 99)) return null;
  const [year, month, day, hour, minute, second] = digits;
  const fullYear = 2000 + year;
  const date = new Date(Date.UTC(fullYear, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour ||
      date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  return date.toISOString();
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function ageBucket(seconds) {
  if (seconds < 0) return 'negative-clock-delta';
  if (seconds < 60) return '<1m';
  if (seconds < 5 * 60) return '1-5m';
  if (seconds < 15 * 60) return '5-15m';
  if (seconds < 60 * 60) return '15-60m';
  if (seconds < 6 * 60 * 60) return '1-6h';
  if (seconds < 24 * 60 * 60) return '6-24h';
  return '24h+';
}

export function analyzeAovxDelivery(document) {
  if (!document || !Array.isArray(document.packets)) {
    throw new TypeError('capture must be a JSON object with a packets array');
  }
  if (document.packets.length > MAX_PACKETS) {
    throw new RangeError(`capture exceeds ${MAX_PACKETS} packets`);
  }

  const records = [];
  const errors = [];
  for (let index = 0; index < document.packets.length; index += 1) {
    const item = document.packets[index];
    try {
      const hex = item?.raw_payload_hex;
      if (typeof hex !== 'string' || hex.length < 4 || hex.length % 2 ||
          !/^[0-9a-f]+$/i.test(hex)) throw new Error('invalid raw_payload_hex');
      const wire = Buffer.from(hex, 'hex');
      const frame = decodeAovxFrame(wire);
      if (frame.messageId !== 0x0200) continue;
      const parsed = parseAovxMessage(frame);
      const status = parsed.data.status;
      const timestampBcdHex = frame.body.subarray(22, 28).toString('hex');
      const deviceTimestamp = decodeBcdTimestamp(timestampBcdHex);
      const receivedAt = typeof item.received_at === 'string' ? item.received_at : null;
      const receivedMs = receivedAt ? Date.parse(receivedAt) : NaN;
      const deviceMs = deviceTimestamp ? Date.parse(deviceTimestamp) : NaN;
      const ageSecondsUtcAssumption = Number.isFinite(receivedMs) && Number.isFinite(deviceMs)
        ? Math.round((receivedMs - deviceMs) / 1000) : null;
      const sha256 = createHash('sha256').update(wire).digest('hex');
      records.push({
        packetId: typeof item.id === 'string' ? item.id : null,
        deviceIdBcd: frame.deviceIdBcd.toString('hex'),
        sequenceNumber: frame.sequenceNumber,
        timestampBcdHex,
        deviceTimestampUtcAssumption: deviceTimestamp,
        receivedAt,
        statusHex: status.toString(16).padStart(8, '0'),
        deliveryMode: (status & 0x80000000) !== 0 ? 'buffered' : 'realtime',
        ageSecondsUtcAssumption,
        sha256
      });
    } catch (error) {
      if (errors.length < 100) errors.push({
        packetId: typeof item?.id === 'string' ? item.id : null,
        packetIndex: index,
        error: error instanceof Error ? error.message : 'unknown decode error'
      });
    }
  }

  const modeCounts = { buffered: 0, realtime: 0 };
  const ageBuckets = {};
  const validAges = [];
  let missingReceivedAt = 0;
  let invalidDeviceTimestamps = 0;
  let negativeAgeCount = 0;
  for (const record of records) {
    modeCounts[record.deliveryMode] += 1;
    if (!record.deviceTimestampUtcAssumption) invalidDeviceTimestamps += 1;
    if (!record.receivedAt || !Number.isFinite(Date.parse(record.receivedAt))) missingReceivedAt += 1;
    if (record.ageSecondsUtcAssumption !== null) {
      validAges.push(record.ageSecondsUtcAssumption);
      ageBuckets[ageBucket(record.ageSecondsUtcAssumption)] =
        (ageBuckets[ageBucket(record.ageSecondsUtcAssumption)] ?? 0) + 1;
      if (record.ageSecondsUtcAssumption < 0) negativeAgeCount += 1;
    }
  }
  const sortedAges = [...validAges].sort((a, b) => a - b);

  const hashGroups = new Map();
  const timestampStatusGroups = new Map();
  for (const record of records) {
    if (!hashGroups.has(record.sha256)) hashGroups.set(record.sha256, []);
    hashGroups.get(record.sha256).push(record);
    const key = `${record.deviceIdBcd}:${record.timestampBcdHex}`;
    if (!timestampStatusGroups.has(key)) timestampStatusGroups.set(key, new Map());
    const statuses = timestampStatusGroups.get(key);
    if (!statuses.has(record.statusHex)) statuses.set(record.statusHex, []);
    statuses.get(record.statusHex).push(record.packetId);
  }
  const repeatedFrames = [...hashGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({
      sha256,
      observationCount: group.length,
      packetIds: group.slice(0, MAX_DETAILS).map(record => record.packetId),
      firstReceivedAt: group.map(record => record.receivedAt).filter(Boolean).sort()[0] ?? null,
      lastReceivedAt: group.map(record => record.receivedAt).filter(Boolean).sort().at(-1) ?? null,
      omittedPacketIdCount: Math.max(0, group.length - MAX_DETAILS)
    }));
  const timestampStatusConflicts = [...timestampStatusGroups.entries()]
    .filter(([, statuses]) => statuses.size > 1)
    .map(([key, statuses]) => ({
      deviceTimestampKey: key,
      statusVariants: [...statuses.entries()].map(([statusHex, packetIds]) => ({
        statusHex, packetIds: packetIds.slice(0, MAX_DETAILS)
      }))
    }));

  return {
    packetCount: document.packets.length,
    telemetry0200Count: records.length,
    modeCounts,
    deliveryAgeUtcAssumption: {
      sampleCount: sortedAges.length,
      minSeconds: sortedAges[0] ?? null,
      medianSeconds: percentile(sortedAges, 0.5),
      p95Seconds: percentile(sortedAges, 0.95),
      maxSeconds: sortedAges.at(-1) ?? null,
      buckets: ageBuckets,
      negativeAgeCount,
      missingReceivedAt,
      invalidDeviceTimestamps
    },
    repeatedFrameSummary: {
      uniqueFrameCount: hashGroups.size,
      repeatedHashGroupCount: repeatedFrames.length,
      duplicateObservationCount: records.length - hashGroups.size,
      groups: repeatedFrames.slice(0, MAX_DETAILS),
      omittedGroupCount: Math.max(0, repeatedFrames.length - MAX_DETAILS)
    },
    timestampStatusConflictCount: timestampStatusConflicts.length,
    timestampStatusConflicts: timestampStatusConflicts.slice(0, MAX_DETAILS),
    records: records.slice(0, MAX_DETAILS),
    recordsOmitted: Math.max(0, records.length - MAX_DETAILS),
    errors,
    errorsOmitted: Math.max(0, document.packets.length - records.length - errors.length),
    notes: [
      'Device timestamps are interpreted as YYMMDDhhmmss BCD and provisionally treated as UTC solely to calculate age; device timezone is not confirmed.',
      'Status bit 31 is reported as 0=realtime and 1=buffered per the protocol workbook.',
      'Repeated frames are grouped by SHA-256 of the complete received wire frame. Every raw observation remains in the capture; this report does not deduplicate or suppress data.',
      'Same device timestamp with multiple status values is a conflict diagnostic, not proof of a protocol error.'
    ]
  };
}

async function main() {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) {
    process.stderr.write('Usage: npm run aovx:delivery -- <capture.json>\n');
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(await readFile(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(analyzeAovxDelivery(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`AOVX delivery analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
