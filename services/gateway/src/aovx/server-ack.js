import { encodeAovxFrame } from './frame.js';

// 0x0900's type, status, coordinates, motion fields and BCD time occupy 25 bytes.
const ADDITIONAL_REPORT_MIN_BYTES = 25;
// Protocol V3.0 §2.3.1 allows a basic report without extensions.
const BASIC_REPORT_MIN_BYTES = 28;
const ACKNOWLEDGED_TYPES = new Set([0x0200, 0x0900]);

export function supportsAovxServerAck(frame) {
  return ACKNOWLEDGED_TYPES.has(frame.messageId);
}

export function canAcknowledgeAovxFrame(frame) {
  return supportsAovxServerAck(frame) &&
    frame.checksumMatchesXor &&
    (frame.properties & 0xfc00) === 0 &&
    /^[0-9]{12}$/.test(frame.deviceIdBcd.toString('hex')) &&
    (frame.body.length >= (frame.messageId === 0x0200 ? BASIC_REPORT_MIN_BYTES : ADDITIONAL_REPORT_MIN_BYTES));
}

export function encodeAovxServerAck(frame, sequenceNumber) {
  const body = Buffer.alloc(5);
  body.writeUInt16BE(frame.sequenceNumber, 0);
  body.writeUInt16BE(frame.messageId, 2);
  // Result 0 acknowledges durable receipt of the device report.
  return encodeAovxFrame({ messageId: 0x8001, deviceIdBcd: frame.deviceIdBcd, sequenceNumber, body });
}
