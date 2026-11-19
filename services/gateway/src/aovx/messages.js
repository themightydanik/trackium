const MESSAGE_IDS = Object.freeze({
  DEVICE_GENERAL_QUERY_RESPONSE: 0x0001,
  DEVICE_REGISTRATION: 0x0100,
  DEVICE_AUTHENTICATION: 0x0102,
  DEVICE_BASIC_INFORMATION: 0x0200,
  DEVICE_ADDITIONAL_INFORMATION: 0x0900,
  SERVER_GENERAL_RESPONSE: 0x8001,
  DEVICE_REGISTRATION_RESPONSE: 0x8100,
  DEVICE_CONFIGURATION: 0x8103,
  DEVICE_QUERY: 0x8104
});

function readUInt48BE(bytes, offset) {
  return bytes.readUIntBE(offset, 6);
}

function asciiOrNull(bytes) {
  if (!bytes.every(byte => byte === 0 || (byte >= 0x20 && byte <= 0x7e))) return null;
  return bytes.toString('ascii').replace(/\\0+$/u, '');
}

function bcdDigitsOrNull(bytes) {
  let digits = '';
  for (const byte of bytes) {
    const high = byte >> 4;
    const low = byte & 0x0f;
    if (high > 9 || low > 9) return null;
    digits += String(high) + String(low);
  }
  return digits;
}

function hexChunks(bytes, baseOffset) {
  const chunks = [];
  for (let start = 0; start < bytes.length; start += 16) {
    const chunk = bytes.subarray(start, Math.min(start + 16, bytes.length));
    const ascii = Array.from(chunk, byte => byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.').join('');
    chunks.push({
      offset: baseOffset + start,
      offsetHex: `0x${(baseOffset + start).toString(16).padStart(2, '0')}`,
      hex: chunk.toString('hex').match(/.{1,2}/gu)?.join(' ') ?? '',
      ascii
    });
  }
  return chunks;
}

function requireLength(body, minimum, messageId) {
  if (body.length < minimum) {
    throw new Error(`AOVX message 0x${messageId.toString(16).padStart(4, '0')} body is too short: expected at least ${minimum}, received ${body.length}`);
  }
}

function parseRegistration(body) {
  if (body.length !== 38) throw new Error(`AOVX 0x0100 body must be 38 bytes, received ${body.length}`);
  return {
    provinceAreaId: body.readUInt16BE(0),
    districtId: body.readUInt16BE(2),
    manufacturerId: Buffer.from(body.subarray(4, 9)),
    manufacturerIdAscii: asciiOrNull(body.subarray(4, 9)),
    deviceType: Buffer.from(body.subarray(9, 29)),
    deviceTypeAscii: asciiOrNull(body.subarray(9, 29)),
    terminalId: Buffer.from(body.subarray(29, 36)),
    licensePlateColor: body[36],
    vehicleLogo: body[37]
  };
}

function parseRegistrationResponse(body) {
  requireLength(body, 3, 0x8100);
  return {
    replySequenceNumber: body.readUInt16BE(0),
    result: body[2],
    authenticationCode: Buffer.from(body.subarray(3)),
    authenticationCodeAscii: asciiOrNull(body.subarray(3))
  };
}

function parseGeneralResponse(body) {
  if (body.length !== 5) throw new Error(`AOVX 0x8001 body must be 5 bytes, received ${body.length}`);
  return {
    responseSequenceNumber: body.readUInt16BE(0),
    responseMessageId: body.readUInt16BE(2),
    result: body[4]
  };
}

function parseGeneralQueryResponse(body) {
  if (body.length !== 5) throw new Error(`AOVX 0x0001 body must be 5 bytes, received ${body.length}`);
  return {
    responseSequenceNumber: body.readUInt16BE(0),
    correspondingDeviceMessageId: body.readUInt16BE(2),
    result: body[4]
  };
}

function parseBasicInformation(body) {
  // The workbook defines these fixed fields through GNSS count. Later fields are
  // model/configuration dependent; retain them as opaque bytes until decoded.
  requireLength(body, 40, 0x0200);
  const timestampBcd = Buffer.from(body.subarray(22, 28));
  const remainingBody = Buffer.from(body.subarray(40));
  return {
    alarm: body.readUInt32BE(0),
    status: body.readUInt32BE(4),
    latitudeRaw: body.readUInt32BE(8),
    longitudeRaw: body.readUInt32BE(12),
    altitudeRaw: body.readUInt16BE(16),
    speedRaw: body.readUInt16BE(18),
    directionRaw: body.readUInt16BE(20),
    timestampBcd,
    timestampBcdDigits: bcdDigitsOrNull(timestampBcd),
    mileageRaw: readUInt48BE(body, 28),
    cellularSignalRaw: Buffer.from(body.subarray(34, 37)),
    gnssSatellitesRaw: Buffer.from(body.subarray(37, 40)),
    remainingBody,
    diagnostics: {
      bodyLength: body.length,
      fixedPrefixLength: 40,
      fields: {
        alarm: { offset: 0, length: 4 },
        status: { offset: 4, length: 4 },
        latitudeRaw: { offset: 8, length: 4 },
        longitudeRaw: { offset: 12, length: 4 },
        altitudeRaw: { offset: 16, length: 2 },
        speedRaw: { offset: 18, length: 2 },
        directionRaw: { offset: 20, length: 2 },
        timestampBcd: { offset: 22, length: 6 },
        mileageRaw: { offset: 28, length: 6 },
        cellularSignalRaw: { offset: 34, length: 3 },
        gnssSatellitesRaw: { offset: 37, length: 3 }
      },
      remainingBody: {
        offset: 40,
        length: remainingBody.length,
        hex: remainingBody.toString('hex'),
        chunks: hexChunks(remainingBody, 40)
      }
    }
  };
}

/**
 * Parse the message body of an already structurally decoded AOVX frame.
 * This is descriptive only: it does not authenticate devices, send ACKs,
 * interpret model-specific extensions, or assert checksum validity.
 */
export function parseAovxMessage(frame) {
  if (!frame || !Buffer.isBuffer(frame.body) || !Number.isInteger(frame.messageId)) {
    throw new TypeError('parseAovxMessage expects a decoded AOVX frame');
  }

  let data;
  switch (frame.messageId) {
    case MESSAGE_IDS.DEVICE_GENERAL_QUERY_RESPONSE:
      data = parseGeneralQueryResponse(frame.body);
      break;
    case MESSAGE_IDS.DEVICE_REGISTRATION:
      data = parseRegistration(frame.body);
      break;
    case MESSAGE_IDS.DEVICE_AUTHENTICATION:
      requireLength(frame.body, 1, frame.messageId);
      data = {
        authenticationCode: Buffer.from(frame.body),
        authenticationCodeAscii: asciiOrNull(frame.body)
      };
      break;
    case MESSAGE_IDS.DEVICE_BASIC_INFORMATION:
      data = parseBasicInformation(frame.body);
      break;
    case MESSAGE_IDS.SERVER_GENERAL_RESPONSE:
      data = parseGeneralResponse(frame.body);
      break;
    case MESSAGE_IDS.DEVICE_REGISTRATION_RESPONSE:
      data = parseRegistrationResponse(frame.body);
      break;
    default:
      data = { rawBody: Buffer.from(frame.body), parsing: 'not-implemented' };
  }

  return {
    messageId: frame.messageId,
    messageName: Object.entries(MESSAGE_IDS).find(([, id]) => id === frame.messageId)?.[0] ?? 'UNKNOWN',
    deviceIdBcd: Buffer.from(frame.deviceIdBcd),
    sequenceNumber: frame.sequenceNumber,
    bodyLength: frame.bodyLength,
    checksumStatus: frame.checksumStatus,
    data
  };
}

export { MESSAGE_IDS };
