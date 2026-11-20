import { encodeAovxFrame, decodeAovxFrame } from './frame.js';

export const AOVX_QUERY_COMMAND = 0x8104;
export const AOVX_GENERAL_QUERY_RESPONSE = 0x0001;
export const AOVX_CONFIGURATION_RESPONSE = 0x0104;
export const AOVX_GNSS_ENABLE_PARAMETER = 0x0000f029;

export function encodeAovxQueryCommand({ deviceIdBcd, sequenceNumber }) {
  return encodeAovxFrame({
    messageId: AOVX_QUERY_COMMAND,
    deviceIdBcd,
    sequenceNumber,
    body: Buffer.alloc(0)
  });
}

export function parseAovxGeneralQueryResponse(frame) {
  if (!frame || frame.messageId !== AOVX_GENERAL_QUERY_RESPONSE) {
    throw new TypeError('expected AOVX 0x0001 general query response');
  }
  if (!Buffer.isBuffer(frame.body) || frame.body.length !== 5) {
    throw new Error('AOVX 0x0001 body must be exactly 5 bytes');
  }
  return {
    responseSequenceNumber: frame.body.readUInt16BE(0),
    correspondingMessageId: frame.body.readUInt16BE(2),
    result: frame.body[4]
  };
}

export function parseAovxConfigurationResponse(frame) {
  if (!frame || frame.messageId !== AOVX_CONFIGURATION_RESPONSE) {
    throw new TypeError('expected AOVX 0x0104 configuration response');
  }
  if (!Buffer.isBuffer(frame.body) || frame.body.length < 3) {
    throw new Error('AOVX 0x0104 body is shorter than its fixed header');
  }

  const responseSequenceNumber = frame.body.readUInt16BE(0);
  const parameterCount = frame.body[2];
  const parameters = new Map();
  let offset = 3;

  for (let index = 0; index < parameterCount; index += 1) {
    if (offset + 5 > frame.body.length) {
      throw new Error('AOVX 0x0104 parameter header is truncated');
    }
    const id = frame.body.readUInt32BE(offset);
    const length = frame.body[offset + 4];
    offset += 5;
    if (offset + length > frame.body.length) {
      throw new Error(`AOVX 0x0104 parameter 0x${id.toString(16)} value is truncated`);
    }
    if (parameters.has(id)) {
      throw new Error(`AOVX 0x0104 contains duplicate parameter 0x${id.toString(16)}`);
    }
    parameters.set(id, Buffer.from(frame.body.subarray(offset, offset + length)));
    offset += length;
  }

  if (offset !== frame.body.length) {
    throw new Error('AOVX 0x0104 contains trailing bytes after declared parameters');
  }

  const gnssRaw = parameters.get(AOVX_GNSS_ENABLE_PARAMETER);
  let gnssEnabled = 'unknown';
  if (gnssRaw) {
    if (gnssRaw.length !== 1) {
      throw new Error('AOVX GNSS Enable (0xF029) must contain exactly one byte');
    }
    if (gnssRaw[0] === 0) gnssEnabled = 'disabled';
    else if (gnssRaw[0] === 1) gnssEnabled = 'enabled';
  }

  return {
    responseSequenceNumber,
    parameterCount,
    gnssEnabled,
    gnssRaw: gnssRaw ? Buffer.from(gnssRaw) : null,
    parameters
  };
}

export function decodeAovxConfigResponse(wireFrame) {
  const frame = decodeAovxFrame(wireFrame, { checksumPolicy: 'require-xor-match' });
  if (frame.messageId === AOVX_GENERAL_QUERY_RESPONSE) {
    return { ...frame, response: parseAovxGeneralQueryResponse(frame) };
  }
  if (frame.messageId === AOVX_CONFIGURATION_RESPONSE) {
    return { ...frame, response: parseAovxConfigurationResponse(frame) };
  }
  throw new Error(`unexpected AOVX response message 0x${frame.messageId.toString(16)}`);
}
