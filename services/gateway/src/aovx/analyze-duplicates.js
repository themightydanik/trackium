import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const MAX_CAPTURE_PACKETS = 5000;
const MAX_FRAME_HEX_LENGTH = 131072;
const MAX_GROUP_DETAILS = 100;
const HEADER_LENGTH = 12;
const STATUS_PACKET_OFFSETS = [HEADER_LENGTH + 4, HEADER_LENGTH + 5, HEADER_LENGTH + 6, HEADER_LENGTH + 7];

function increment(bucket, key) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function getSensorKey(sensor) {
  return Object.entries(sensor.fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value.toString('hex')}`)
    .join('|');
}

function compareFrames(left, right) {
  const changes = [];
  const length = Math.max(left.length, right.length);
  for (let offset = 0; offset < length; offset += 1) {
    if (left[offset] !== right[offset]) changes.push(offset);
  }
  const checksumOffset = left.length === right.length ? left.length - 1 : null;
  const statusOffsets = STATUS_PACKET_OFFSETS;
  const onlyStatusAndChecksum = changes.every(offset =>
    statusOffsets.includes(offset) || offset === checksumOffset
  );
  const statusChanged = statusOffsets.some(offset => left[offset] !== right[offset]);
  const checksumChanged = checksumOffset !== null && changes.includes(checksumOffset);
  return {
    changedOffsets: changes,
    statusChanged,
    checksumChanged,
    onlyStatusAndChecksum: onlyStatusAndChecksum && statusChanged &&
      left.length === right.length
  };
}

function summarizeGroup(records) {
  const baseline = records[0];
  const statusValues = [...new Set(records.map(record => record.status))].sort();
  const uniqueFrames = new Set(records.map(record => record.frameHex));
  const comparisons = records.slice(1).map(record => ({
    status: record.status,
    ...compareFrames(baseline.frame, record.frame)
  }));

  const statusVariants = comparisons.filter(item => item.status !== baseline.status);
  const statusOnlyVariants = statusVariants.filter(item => item.onlyStatusAndChecksum);
  const otherStatusVariants = statusVariants.filter(item => !item.onlyStatusAndChecksum);
  const exactFrameDuplicateObservations = records.length - uniqueFrames.size;

  return {
    timestampBcdDigits: baseline.timestampBcdDigits,
    sequenceNumber: baseline.sequenceNumber,
    sampleCount: records.length,
    distinctFrameCount: uniqueFrames.size,
    exactFrameDuplicateObservations,
    distinctStatusCount: statusValues.length,
    statusValues,
    comparisonsAgainstFirst: comparisons.length,
    statusVariantsCompared: statusVariants.length,
    statusOnlyAndChecksumVariants: statusOnlyVariants.length,
    statusVariantsWithOtherByteChanges: otherStatusVariants.length,
    comparisonDetails: comparisons.slice(0, 20).map(item => ({
      status: item.status,
      changedOffsets: item.changedOffsets,
      statusChanged: item.statusChanged,
      checksumChanged: item.checksumChanged,
      onlyStatusAndChecksum: item.onlyStatusAndChecksum
    }))
  };
}

export function analyzeAovxDuplicateSamples(document) {
  if (!document || !Array.isArray(document.packets)) {
    throw new TypeError('capture must be a JSON object with a packets array');
  }
  if (document.packets.length > MAX_CAPTURE_PACKETS) {
    throw new RangeError(`capture exceeds ${MAX_CAPTURE_PACKETS} packets`);
  }

  const groups = new Map();
  let invalidCount = 0;
  let nonTelemetryCount = 0;
  let telemetryWithoutF6Count = 0;
  let f6SampleCount = 0;

  for (let packetIndex = 0; packetIndex < document.packets.length; packetIndex += 1) {
    const item = document.packets[packetIndex];
    try {
      const hex = item?.raw_payload_hex;
      if (typeof hex !== 'string' || hex.length < 4 ||
          hex.length > MAX_FRAME_HEX_LENGTH || hex.length % 2 ||
          !/^[0-9a-f]+$/i.test(hex)) {
        throw new Error('invalid raw frame hex');
      }

      const frame = decodeAovxFrame(Buffer.from(hex, 'hex'));
      if (frame.messageId !== 0x0200) {
        nonTelemetryCount += 1;
        continue;
      }

      const parsed = parseAovxMessage(frame);
      const sensor = parsed.data.observedExtensions.sensorInformation;
      if (!sensor?.matchesObservedEnvelope) {
        telemetryWithoutF6Count += 1;
        continue;
      }

      const timestampBcdDigits = parsed.data.timestampBcdDigits;
      if (typeof timestampBcdDigits !== 'string') {
        telemetryWithoutF6Count += 1;
        continue;
      }

      f6SampleCount += 1;
      const deviceKey = frame.deviceIdBcd.toString('hex');
      const sampleKey = [
        deviceKey,
        timestampBcdDigits,
        frame.sequenceNumber,
        sensor.dataTypeRaw,
        sensor.fieldMask,
        getSensorKey(sensor)
      ].join(':');

      if (!groups.has(sampleKey)) groups.set(sampleKey, []);
      groups.get(sampleKey).push({
        inputIndex: packetIndex,
        timestampBcdDigits,
        sequenceNumber: frame.sequenceNumber,
        status: frame.body.subarray(4, 8).toString('hex'),
        frame: frame.raw,
        frameHex: frame.raw.toString('hex')
      });
    } catch {
      invalidCount += 1;
    }
  }

  const repeatedGroups = [...groups.values()]
    .filter(records => records.length > 1)
    .map(summarizeGroup)
    .sort((left, right) =>
      left.timestampBcdDigits.localeCompare(right.timestampBcdDigits) ||
      left.sequenceNumber - right.sequenceNumber
    );

  const groupsWithMultipleStatuses = repeatedGroups.filter(group => group.distinctStatusCount > 1);
  const statusOnlyAndChecksumGroups = groupsWithMultipleStatuses.filter(group =>
    group.statusVariantsCompared > 0 &&
    group.statusOnlyAndChecksumVariants === group.statusVariantsCompared
  );
  const groupsWithOtherStatusByteChanges = groupsWithMultipleStatuses.filter(group =>
    group.statusVariantsWithOtherByteChanges > 0
  );

  const reportedGroups = repeatedGroups.slice(0, MAX_GROUP_DETAILS);
  return {
    packetCount: document.packets.length,
    invalidCount,
    nonTelemetryCount,
    telemetryWithoutF6Count,
    f6SampleCount,
    repeatedSampleGroupCount: repeatedGroups.length,
    repeatedObservationCount: repeatedGroups.reduce((sum, group) => sum + group.sampleCount, 0),
    groupsWithMultipleStatuses: groupsWithMultipleStatuses.length,
    statusOnlyAndChecksumGroups: statusOnlyAndChecksumGroups.length,
    groupsWithOtherStatusByteChanges: groupsWithOtherStatusByteChanges.length,
    exactFrameDuplicateObservations: repeatedGroups.reduce(
      (sum, group) => sum + group.exactFrameDuplicateObservations, 0
    ),
    reportedGroupCount: reportedGroups.length,
    omittedGroupCount: Math.max(0, repeatedGroups.length - reportedGroups.length),
    statusOffsetsInUnescapedPacket: STATUS_PACKET_OFFSETS,
    checksumOffset: 'last byte of unescaped packet; algorithm remains an unconfirmed XOR candidate',
    groups: reportedGroups,
    note: 'Samples are grouped internally by device, BCD timestamp, sequence number, F6 data type/mask, and raw F6 field bytes. Device identifiers are not emitted. Status-only classification means all changed unescaped packet offsets are confined to the four status bytes and final checksum byte; it does not establish why the status differs or confirm checksum semantics.'
  };
}

async function main() {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) {
    process.stderr.write('Usage: npm run aovx:duplicates -- <capture.json>\n');
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(await readFile(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(analyzeAovxDuplicateSamples(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`AOVX duplicate analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
