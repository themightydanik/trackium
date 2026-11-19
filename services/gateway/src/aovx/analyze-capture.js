import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const MAX_CAPTURE_PACKETS = 5000;
const MAX_FRAME_HEX_LENGTH = 131072;

function hexAt(body, offset, length) {
  return body.subarray(offset, offset + length).toString('hex');
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
    telemetry0200: []
  };

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
        summary.telemetry0200.push({
          packetId: typeof item.id === 'string' ? item.id : null,
          deviceIdBcd: frame.deviceIdBcd.toString('hex'),
          sequenceNumber: frame.sequenceNumber,
          bodyLength: frame.bodyLength,
          checksumCandidate: frame.checksumStatus,
          timestampBcdHex: hexAt(frame.body, 22, 6),
          fixedPrefixHex: hexAt(frame.body, 0, Math.min(40, frame.body.length)),
          tailOffset: d.remainingBody.offset,
          tailLength: d.remainingBody.length,
          tailHex: d.remainingBody.hex
        });
      }
    } catch (error) {
      summary.invalidCount += 1;
      if (!summary.errors) summary.errors = [];
      summary.errors.push({
        packetId: typeof item?.id === 'string' ? item.id : null,
        packetIndex: index,
        error: error instanceof Error ? error.message : 'unknown decode error'
      });
    }
  }

  summary.checksumNote = 'XOR is an unconfirmed candidate only; xorMatch is not protocol authentication.';
  summary.telemetryNote = '0x0200 values are emitted as raw bytes. No units, coordinates, timezone, or model-specific tail semantics are inferred.';
  return summary;
}

async function main() {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) {
    process.stderr.write('Usage: npm run aovx:analyze -- <capture.json>\\n');
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(await readFile(path, 'utf8'));
  process.stdout.write(`${JSON.stringify(analyzeAovxCapture(input), null, 2)}\\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`AOVX capture analysis failed: ${error.message}\\n`);
    process.exitCode = 1;
  });
}
