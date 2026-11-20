const FLAG = 0x7e;
const ESCAPE = 0x7d;
const ESCAPED_FLAG = 0x02;
const ESCAPED_ESCAPE = 0x01;
const HEADER_LENGTH = 12;
const MIN_FRAME_LENGTH = HEADER_LENGTH + 1;

/** AOVX protocol checksum: XOR from the first header byte through the final body byte. */
export function aovxChecksum(bytes) {
  let checksum = 0;
  for (const byte of bytes) checksum ^= byte;
  return checksum;
}

export function unescapeAovxPayload(bytes) {
  const output = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte !== ESCAPE) {
      if (byte === FLAG) throw new Error('unexpected unescaped 0x7E inside AOVX frame');
      output.push(byte);
      continue;
    }
    if (i + 1 >= bytes.length) throw new Error('truncated AOVX escape sequence');
    const escaped = bytes[++i];
    if (escaped === ESCAPED_FLAG) output.push(FLAG);
    else if (escaped === ESCAPED_ESCAPE) output.push(ESCAPE);
    else throw new Error(`invalid AOVX escape sequence: 0x${escaped.toString(16).padStart(2, '0')}`);
  }
  return Buffer.from(output);
}

export function escapeAovxPayload(bytes) {
  const output = [];
  for (const byte of bytes) {
    if (byte === FLAG) output.push(ESCAPE, ESCAPED_FLAG);
    else if (byte === ESCAPE) output.push(ESCAPE, ESCAPED_ESCAPE);
    else output.push(byte);
  }
  return Buffer.from(output);
}

/**
 * Decode the generic AOVX envelope.
 * "observe" reports the XOR-candidate comparison without rejecting the frame.
 * "require-xor-match" is opt-in and intended only for controlled fixtures.
 */
export function decodeAovxFrame(wireFrame, { checksumPolicy = 'observe' } = {}) {
  if (!['observe', 'require-xor-match'].includes(checksumPolicy)) {
    throw new TypeError('checksumPolicy must be observe or require-xor-match');
  }
  const wire = Buffer.from(wireFrame);
  if (wire.length < 2 || wire[0] !== FLAG || wire[wire.length - 1] !== FLAG) {
    throw new Error('AOVX frame must begin and end with 0x7E');
  }
  const packet = unescapeAovxPayload(wire.subarray(1, -1));
  if (packet.length < MIN_FRAME_LENGTH) throw new Error('AOVX frame is shorter than its header and checksum');

  const messageId = packet.readUInt16BE(0);
  const properties = packet.readUInt16BE(2);
  const bodyLength = properties & 0x03ff;
  const expectedLength = HEADER_LENGTH + bodyLength + 1;
  if (packet.length !== expectedLength) {
    throw new Error(`AOVX body length mismatch: header says ${bodyLength}, packet contains ${packet.length - HEADER_LENGTH - 1}`);
  }

  const receivedChecksum = packet[packet.length - 1];
  const calculatedXorChecksum = aovxChecksum(packet.subarray(0, -1));
  const checksumMatchesXor = receivedChecksum === calculatedXorChecksum;
  if (!checksumMatchesXor && checksumPolicy === 'require-xor-match') {
    throw new Error(`AOVX XOR-candidate checksum mismatch: calculated 0x${calculatedXorChecksum.toString(16).padStart(2, '0')}, received 0x${receivedChecksum.toString(16).padStart(2, '0')}`);
  }
  return {
    messageId, properties, bodyLength,
    deviceIdBcd: Buffer.from(packet.subarray(4, 10)),
    sequenceNumber: packet.readUInt16BE(10),
    body: Buffer.from(packet.subarray(HEADER_LENGTH, -1)),
    checksum: receivedChecksum,
    checksumAlgorithm: 'xor',
    checksumMatchesXor,
    checksumStatus: checksumMatchesXor ? 'xor-match' : 'xor-mismatch',
    raw: packet
  };
}

export function encodeAovxFrame({ messageId, deviceIdBcd, sequenceNumber, body = Buffer.alloc(0), properties = 0 }) {
  if (!Number.isInteger(messageId) || messageId < 0 || messageId > 0xffff) throw new TypeError('messageId must be an unsigned 16-bit integer');
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 0 || sequenceNumber > 0xffff) throw new TypeError('sequenceNumber must be an unsigned 16-bit integer');
  if (!Number.isInteger(properties) || properties < 0 || properties > 0xffff) throw new TypeError('properties must be an unsigned 16-bit integer');
  const device = Buffer.from(deviceIdBcd);
  const payload = Buffer.from(body);
  if (device.length !== 6) throw new TypeError('deviceIdBcd must contain exactly 6 bytes');
  if (payload.length > 0x03ff) throw new RangeError('AOVX body cannot exceed 1023 bytes in this protocol profile');

  const headerProperties = (properties & 0xfc00) | payload.length;
  const packet = Buffer.alloc(HEADER_LENGTH + payload.length + 1);
  packet.writeUInt16BE(messageId, 0);
  packet.writeUInt16BE(headerProperties, 2);
  device.copy(packet, 4);
  packet.writeUInt16BE(sequenceNumber, 10);
  payload.copy(packet, HEADER_LENGTH);
  // AOVX checksum is XOR over the complete header and body.
  packet[packet.length - 1] = aovxChecksum(packet.subarray(0, -1));
  return Buffer.concat([Buffer.from([FLAG]), escapeAovxPayload(packet), Buffer.from([FLAG])]);
}
