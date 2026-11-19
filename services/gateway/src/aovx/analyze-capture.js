import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const MAX_CAPTURE_PACKETS = 5000;
const MAX_FRAME_HEX_LENGTH = 131072;
const MAX_TELEMETRY_DETAILS = 100;
const MAX_ERROR_DETAILS = 100;
const MAX_TAIL_ANALYSIS_OFFSETS = 256;
const MAX_VALUE_FREQUENCIES = 8;
const MAX_RANGE_DETAILS = 64;
const MAX_DIFFERENCE_SAMPLES = 64;

function hexAt(body, offset, length) {
  return body.subarray(offset, offset + length).toString('hex');
}

function toRanges(offsets) {
  const ranges = [];
  for (const offset of offsets) {
    const last = ranges[ranges.length - 1];
    if (last && last.end + 1 === offset) {
      last.end = offset;
    } else {
      ranges.push({ start: offset, end: offset });
    }
  }
  return {
    ranges: ranges.slice(0, MAX_RANGE_DETAILS),
    omittedRangeCount: Math.max(0, ranges.length - MAX_RANGE_DETAILS)
  };
}

function mostFrequentByte(frequencies) {
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

function summarizeTailGroup(bodyLength, records) {
  const tails = records.map(record => Buffer.from(record.tailHex, 'hex'));
  const tailLengthCounts = {};
  for (const tail of tails) {
    tailLengthCounts[tail.length] = (tailLengthCounts[tail.length] ?? 0) + 1;
  }

  const maxTailLength = tails.reduce((max, tail) => Math.max(max, tail.length), 0);
  const analyzedOffsetCount = Math.min(maxTailLength, MAX_TAIL_ANALYSIS_OFFSETS);
  const stableOffsets = [];
  const varyingOffsets = [];
  const offsets = [];

  for (let offset = 0; offset < analyzedOffsetCount; offset += 1) {
    const frequencies = new Map();
    for (const tail of tails) {
      if (offset >= tail.length) continue;
      const byte = tail[offset];
      frequencies.set(byte, (frequencies.get(byte) ?? 0) + 1);
    }
    const values = [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const stable = values.length <= 1;
    (stable ? stableOffsets : varyingOffsets).push(offset);
    offsets.push({
      offset,
      sampleCount: values.reduce((sum, [, count]) => sum + count, 0),
      distinctValueCount: values.length,
      frequencies: values.slice(0, MAX_VALUE_FREQUENCIES).map(([byte, count]) => ({
        byte: byte.toString(16).padStart(2, '0'),
        count
      })),
      omittedValueCount: Math.max(0, values.length - MAX_VALUE_FREQUENCIES)
    });
  }

  let commonPrefixLength = 0;
  const shortestTailLength = tails.reduce((min, tail) => Math.min(min, tail.length), Infinity);
  while (commonPrefixLength < shortestTailLength) {
    const value = tails[0]?.[commonPrefixLength];
    if (!tails.every(tail => tail[commonPrefixLength] === value)) break;
    commonPrefixLength += 1;
  }

  return {
    bodyLength,
    packetCount: records.length,
    tailLengthCounts,
    commonPrefixLength,
    analyzedOffsetCount,
    maxTailLength,
    offsetsTruncated: maxTailLength > analyzedOffsetCount,
    stableOffsetRanges: toRanges(stableOffsets),
    varyingOffsetRanges: toRanges(varyingOffsets),
    offsets
  };
}

function compareTailGroups(groupA, groupB, recordsA, recordsB) {
  const tailsA = recordsA.map(record => Buffer.from(record.tailHex, 'hex'));
  const tailsB = recordsB.map(record => Buffer.from(record.tailHex, 'hex'));
  const maxSharedLength = Math.min(
    tailsA.reduce((max, tail) => Math.max(max, tail.length), 0),
    tailsB.reduce((max, tail) => Math.max(max, tail.length), 0)
  );
  const comparedOffsetCount = Math.min(maxSharedLength, MAX_TAIL_ANALYSIS_OFFSETS);
  const differingOffsets = [];

  for (let offset = 0; offset < comparedOffsetCount; offset += 1) {
    const frequenciesA = new Map();
    const frequenciesB = new Map();
    for (const tail of tailsA) {
      if (offset < tail.length) frequenciesA.set(tail[offset], (frequenciesA.get(tail[offset]) ?? 0) + 1);
    }
    for (const tail of tailsB) {
      if (offset < tail.length) frequenciesB.set(tail[offset], (frequenciesB.get(tail[offset]) ?? 0) + 1);
    }
    const byteA = mostFrequentByte(frequenciesA);
    const byteB = mostFrequentByte(frequenciesB);
    if (byteA !== null && byteB !== null && byteA !== byteB) {
      differingOffsets.push({
        offset,
        groupAByte: byteA.toString(16).padStart(2, '0'),
        groupBByte: byteB.toString(16).padStart(2, '0')
      });
    }
  }

  return {
    bodyLengthA: groupA,
    bodyLengthB: groupB,
    comparisonBasis: 'most-frequent byte at each shared tail offset; offsets are relative to tail start',
    comparedOffsetCount,
    differingOffsetCount: differingOffsets.length,
    differingOffsetSamples: differingOffsets.slice(0, MAX_DIFFERENCE_SAMPLES),
    omittedDifferenceCount: Math.max(0, differingOffsets.length - MAX_DIFFERENCE_SAMPLES),
    note: 'A byte difference is an observation only; it does not identify a field or its meaning.'
  };
}

function analyzeTelemetryTails(records) {
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.bodyLength)) grouped.set(record.bodyLength, []);
    grouped.get(record.bodyLength).push(record);
  }

  const sortedGroups = [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  const groups = sortedGroups.map(([bodyLength, groupRecords]) => summarizeTailGroup(bodyLength, groupRecords));
  const comparisons = [];
  for (let left = 0; left < sortedGroups.length; left += 1) {
    for (let right = left + 1; right < sortedGroups.length; right += 1) {
      comparisons.push(compareTailGroups(
        sortedGroups[left][0],
        sortedGroups[right][0],
        sortedGroups[left][1],
        sortedGroups[right][1]
      ));
    }
  }

  return {
    packetCount: records.length,
    groupCount: groups.length,
    maxAnalyzedOffsets: MAX_TAIL_ANALYSIS_OFFSETS,
    maxFrequencyValuesPerOffset: MAX_VALUE_FREQUENCIES,
    groups,
    comparisons,
    note: 'All offsets and byte values are raw observations. No tail field names, units, coordinates, or protocol semantics are inferred.'
  };
}

export function analyzeAovxCapture(document) {
  if (!document || !Array.isArray(document.packets)) {
    throw new TypeError('capture must be a JSON object with a packets array');
  }
  if (document.packets.length > MAX_CAPTURE_PACKETS) {
    throw new RangeError(`capture exceeds ${MAX_CAPTURE_PACKETS} packets`);
  }

  const summary = {
    packetCount: document.packets.length,
    decodedCount: 0,
    invalidCount: 0,
    checksumCandidate: { xorMatch: 0, xorMismatch: 0 },
    messageIds: {},
    bodyLengths: {},
    telemetry0200: [],
    telemetry0200Omitted: 0
  };
  const telemetryTailRecords = [];
  let omittedErrors = 0;

  for (let index = 0; index < document.packets.length; index += 1) {
    const item = document.packets[index];
    try {
      const hex = item?.raw_payload_hex;
      if (typeof hex !== 'string' || hex.length < 4 || hex.length > MAX_FRAME_HEX_LENGTH || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) {
        throw new Error('raw_payload_hex must be an even-length hexadecimal frame');
      }
      const frame = decodeAovxFrame(Buffer.from(hex, 'hex'));
      const parsed = parseAovxMessage(frame);
      summary.decodedCount += 1;
      summary.checksumCandidate[frame.checksumMatchesXor ? 'xorMatch' : 'xorMismatch'] += 1;
      const messageId = `0x${frame.messageId.toString(16).padStart(4, '0')}`;
      summary.messageIds[messageId] = (summary.messageIds[messageId] ?? 0) + 1;
      summary.bodyLengths[frame.bodyLength] = (summary.bodyLengths[frame.bodyLength] ?? 0) + 1;

      if (frame.messageId === 0x0200) {
        const d = parsed.data.diagnostics;
        const tailRecord = {
          bodyLength: frame.bodyLength,
          tailOffset: d.remainingBody.offset,
          tailLength: d.remainingBody.length,
          tailHex: d.remainingBody.hex
        };
        telemetryTailRecords.push(tailRecord);

        if (summary.telemetry0200.length < MAX_TELEMETRY_DETAILS) {
          summary.telemetry0200.push({
            packetId: typeof item.id === 'string' ? item.id : null,
            deviceIdBcd: frame.deviceIdBcd.toString('hex'),
            sequenceNumber: frame.sequenceNumber,
            bodyLength: frame.bodyLength,
            checksumCandidate: frame.checksumStatus,
            timestampBcdHex: hexAt(frame.body, 22, 6),
            fixedPrefixHex: hexAt(frame.body, 0, Math.min(40, frame.body.length)),
            ...tailRecord
          });
        } else {
          summary.telemetry0200Omitted += 1;
        }
      }
    } catch (error) {
      summary.invalidCount += 1;
      if (!summary.errors) summary.errors = [];
      if (summary.errors.length < MAX_ERROR_DETAILS) {
        summary.errors.push({
          packetId: typeof item?.id === 'string' ? item.id : null,
          packetIndex: index,
          error: error instanceof Error ? error.message : 'unknown decode error'
        });
      } else {
        omittedErrors += 1;
      }
    }
  }

  if (omittedErrors > 0) summary.errorsOmitted = omittedErrors;
  summary.tailAnalysis0200 = analyzeTelemetryTails(telemetryTailRecords);
  summary.checksumNote = 'XOR is an unconfirmed candidate only; xorMatch is not protocol authentication.';
  summary.telemetryNote = '0x0200 values are emitted as raw bytes. No units, coordinates, timezone, or model-specific tail semantics are inferred.';
  return summary;
}

async function main() {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) {
    process.stderr.write('Usage: npm run aovx:analyze -- <capture.json>\n');
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(await readFile(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(analyzeAovxCapture(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`AOVX capture analysis failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
