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
  return bytes.toString('ascii').replace(/\0+$/u, '');
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

function parseObservedTlvField(bytes, expectedTag, expectedValueLength) {
  const raw = Buffer.from(bytes);
  const tag = raw.length >= 1 ? raw[0] : null;
  const declaredLength = raw.length >= 2 ? raw[1] : null;
  const valueRaw = Buffer.from(raw.subarray(2));
  const matchesObservedEnvelope = raw.length === expectedValueLength + 2 &&
    tag === expectedTag &&
    declaredLength === expectedValueLength &&
    valueRaw.length === declaredLength;

  return {
    format: 'observed-tag-length-value',
    tag,
    declaredLength,
    valueRaw,
    valueHex: valueRaw.toString('hex'),
    valueByte: matchesObservedEnvelope && expectedValueLength === 1 ? valueRaw[0] : null,
    matchesObservedEnvelope
  };
}

function parseObservedTelemetryExtensions(tail) {
  let offset = 0;
  let baseStationInformation = null;
  let deviceFirmwareVersion = null;
  let wifiList = null;
  let batteryInformation = null;
  let deviceGeneralInformation = null;
  let sensorInformation = null;
  let assistantInformation = null;
  const opaqueExtensions = [];

  while (offset + 2 <= tail.length) {
    const blockOffset = offset;
    const tag = tail[offset];
    const declaredLength = tail[offset + 1];
    const valueStart = offset + 2;
    const valueEnd = valueStart + declaredLength;
    if (valueEnd > tail.length) break;

    const valueRaw = Buffer.from(tail.subarray(valueStart, valueEnd));
    const valueHex = valueRaw.toString('hex');
    const envelope = {
      format: 'observed-tag-length-value',
      tag,
      declaredLength,
      valueRaw,
      valueHex,
      offset: blockOffset
    };

    if (tag === 0xf0) {
      const matchesObservedEnvelope = valueRaw.length > 0 && valueRaw.length % 13 === 0;
      if (matchesObservedEnvelope) {
        baseStationInformation = {
          ...envelope,
          matchesObservedEnvelope: true,
          recordLength: 13,
          recordCount: valueRaw.length / 13,
          recordsHex: Array.from({ length: valueRaw.length / 13 }, (_, index) =>
            valueRaw.subarray(index * 13, (index + 1) * 13).toString('hex')),
          records: Array.from({ length: valueRaw.length / 13 }, (_, index) => {
            const record = valueRaw.subarray(index * 13, (index + 1) * 13);
            return {
              offset: index * 13,
              mccRaw: Buffer.from(record.subarray(0, 2)),
              mccHex: record.subarray(0, 2).toString('hex'),
              mncRaw: Buffer.from(record.subarray(2, 4)),
              mncHex: record.subarray(2, 4).toString('hex'),
              cellIdRaw: Buffer.from(record.subarray(4, 8)),
              cellIdHex: record.subarray(4, 8).toString('hex'),
              lacRaw: Buffer.from(record.subarray(8, 12)),
              lacHex: record.subarray(8, 12).toString('hex'),
              rssiRaw: record[12]
            };
          })
        };
      } else {
        baseStationInformation = { ...envelope, matchesObservedEnvelope: false, recordCount: null };
        break;
      }
    } else if (tag === 0xf2) {
      const matchesObservedEnvelope = valueRaw.length > 0 &&
        valueRaw.every(byte => byte >= 0x20 && byte <= 0x7e);
      if (matchesObservedEnvelope) {
        deviceFirmwareVersion = {
          ...envelope,
          matchesObservedEnvelope: true,
          valueAscii: valueRaw.toString('ascii')
        };
      } else {
        opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: false });
      }
    } else if (tag === 0xf4) {
      const matchesObservedEnvelope = valueRaw.length > 0 && valueRaw.length % 7 === 0;
      if (matchesObservedEnvelope) {
        wifiList = {
          ...envelope,
          matchesObservedEnvelope: true,
          recordLength: 7,
          recordCount: valueRaw.length / 7,
          records: Array.from({ length: valueRaw.length / 7 }, (_, index) => {
            const record = valueRaw.subarray(index * 7, (index + 1) * 7);
            return {
              offset: index * 7,
              macRaw: Buffer.from(record.subarray(0, 6)),
              macHex: record.subarray(0, 6).toString('hex'),
              rssiRaw: record[6]
            };
          })
        };
      } else {
        opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: false });
      }
    } else if (tag === 0xf7) {
      const matchesObservedEnvelope = valueRaw.length >= 4 && valueRaw.length <= 6;
      if (matchesObservedEnvelope) {
        batteryInformation = {
          format: 'observed-tag-length-value',
          tag,
          declaredLength,
          matchesObservedEnvelope: true,
          valueLength: valueRaw.length,
          batteryVoltageRaw: Buffer.from(valueRaw.subarray(0, 4)),
          chargeStatusRaw: valueRaw.length >= 5 ? valueRaw[4] : null,
          batteryLevelPercentageRaw: valueRaw.length >= 6 ? valueRaw[5] : null
        };
      } else {
        opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: false });
      }
    } else if (tag === 0xf8) {
      // Device information includes IMEI and ICCID. Expose only its envelope
      // metadata here; do not duplicate those identifiers into parsed fields.
      deviceGeneralInformation = {
        format: 'observed-tag-length-value',
        tag,
        declaredLength,
        valueLength: valueRaw.length,
        matchesObservedEnvelope: valueRaw.length === 29
      };
    } else if (tag === 0xf6) {
      // Workbook layout: one-byte data type, one-byte field mask, then the
      // selected raw sensor fields in bit order. Only accept an exact length.
      const sensorFieldDefinitions = [
        { bit: 0, name: 'lightRaw', length: 2 },
        { bit: 1, name: 'temperatureRaw', length: 2 },
        { bit: 2, name: 'humidityRaw', length: 2 },
        { bit: 3, name: 'accelerometerRaw', length: 6 },
        { bit: 4, name: 'limitsRaw', length: 10 },
        { bit: 5, name: 'barRaw', length: 2 },
        { bit: 6, name: 'reserved2Raw', length: 2 },
        { bit: 7, name: 'reserved3Raw', length: 2 }
      ];
      const dataType = valueRaw.length >= 1 ? valueRaw[0] : null;
      const fieldMask = valueRaw.length >= 2 ? valueRaw[1] : null;
      const expectedValueLength = fieldMask === null ? null :
        2 + sensorFieldDefinitions.reduce((total, field) =>
          total + ((fieldMask & (1 << field.bit)) !== 0 ? field.length : 0), 0);
      const matchesObservedEnvelope = expectedValueLength !== null &&
        valueRaw.length === expectedValueLength &&
        declaredLength === expectedValueLength;

      if (matchesObservedEnvelope) {
        const fields = {};
        let fieldOffset = 2;
        const enabledFields = [];
        for (const field of sensorFieldDefinitions) {
          if ((fieldMask & (1 << field.bit)) === 0) continue;
          fields[field.name] = Buffer.from(valueRaw.subarray(fieldOffset, fieldOffset + field.length));
          enabledFields.push(field.name);
          fieldOffset += field.length;
        }
        const dataTypeDescriptions = {
          0: 'periodic-sampling',
          1: 'low-battery-trigger',
          2: 'motion-trigger',
          3: 'shock-trigger',
          4: 'light-trigger',
          5: 'over-temperature-and-humidity-trigger',
          6: 'over-temperature-trigger',
          7: 'over-humidity-trigger',
          8: 'reserved',
          9: 'bluetooth-sensor-connection-trigger',
          10: 'enter-flight-mode',
          11: 'flight-sampling',
          12: 'exit-flight-mode',
          13: 'external-probe-over-temperature-trigger',
          75: 'ota-upgrade-start',
          76: 'ota-upgrade-succeeded',
          77: 'ota-upgrade-failed'
        };
        sensorInformation = {
          format: 'observed-tag-length-value',
          tag,
          declaredLength,
          matchesObservedEnvelope: true,
          dataTypeRaw: dataType,
          dataTypeDescription: dataTypeDescriptions[dataType] ?? (dataType >= 14 && dataType <= 74 ? 'reserved' : null),
          fieldMaskRaw: Buffer.from([fieldMask]),
          fieldMask,
          enabledFields,
          fields
        };
      } else {
        opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: false });
      }
    } else if (tag === 0xf9) {
      // The workbook's observed mask 0x000f enables four fields whose
      // documented raw widths total 16 bytes after the two-byte mask.
      // Keep all values opaque; only split this exact observed envelope.
      const maskRaw = Buffer.from(valueRaw.subarray(0, 2));
      const mask = valueRaw.length >= 2 ? valueRaw.readUInt16BE(0) : null;
      const matchesObservedEnvelope = valueRaw.length === 18 &&
        declaredLength === 18 &&
        mask === 0x000f;
      if (matchesObservedEnvelope) {
        assistantInformation = {
          format: 'observed-tag-length-value',
          tag,
          declaredLength,
          matchesObservedEnvelope: true,
          maskRaw,
          mask,
          gnssAgeRaw: Buffer.from(valueRaw.subarray(2, 6)),
          accOnTimeRaw: Buffer.from(valueRaw.subarray(6, 10)),
          hdopRaw: Buffer.from(valueRaw.subarray(10, 12)),
          gnssTimeRaw: Buffer.from(valueRaw.subarray(12, 18))
        };
      } else {
        opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: false });
      }
    } else {
      opaqueExtensions.push({ ...envelope, matchesObservedEnvelope: null });
    }

    offset = valueEnd;
  }

  const unparsedTail = Buffer.from(tail.subarray(offset));
  return {
    baseStationInformation,
    deviceFirmwareVersion,
    wifiList,
    batteryInformation,
    deviceGeneralInformation,
    sensorInformation,
    assistantInformation,
    opaqueExtensions,
    unparsedTail,
    unparsedTailHex: unparsedTail.toString('hex'),
    parsedLength: offset
  };
}

function parseBasicInformation(body) {
  // The workbook defines these fixed fields through GNSS count. Later fields are
  // model/configuration dependent; retain them as opaque bytes until decoded.
  // The manufacturer AL300 frame omits the mileage TLV. Only use this
  // shorter layout when both following TLV headers match the capture.
  const omitsMileage = body[28] === 0x30 && body[29] === 1 && body[31] === 0x31 && body[32] === 1;
  const signalOffset = omitsMileage ? 28 : 34;
  const prefixLength = signalOffset + 6;
  requireLength(body, prefixLength, 0x0200);
  const timestampBcd = Buffer.from(body.subarray(22, 28));
  const remainingBody = Buffer.from(body.subarray(prefixLength));
  const observedExtensions = parseObservedTelemetryExtensions(remainingBody);
  const mileageField = omitsMileage ? null : parseObservedTlvField(body.subarray(28, 34), 0x01, 4);
  const cellularSignalField = parseObservedTlvField(body.subarray(signalOffset, signalOffset + 3), 0x30, 1);
  const gnssSatellitesField = parseObservedTlvField(body.subarray(signalOffset + 3, prefixLength), 0x31, 1);
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
    mileageRaw: omitsMileage ? null : readUInt48BE(body, 28),
    cellularSignalRaw: Buffer.from(body.subarray(signalOffset, signalOffset + 3)),
    gnssSatellitesRaw: Buffer.from(body.subarray(signalOffset + 3, prefixLength)),
    mileageField,
    cellularSignalField,
    gnssSatellitesField,
    observedExtensions,
    remainingBody,
    diagnostics: {
      bodyLength: body.length,
      fixedPrefixLength: prefixLength,
      fields: {
        alarm: { offset: 0, length: 4 },
        status: { offset: 4, length: 4 },
        latitudeRaw: { offset: 8, length: 4 },
        longitudeRaw: { offset: 12, length: 4 },
        altitudeRaw: { offset: 16, length: 2 },
        speedRaw: { offset: 18, length: 2 },
        directionRaw: { offset: 20, length: 2 },
        timestampBcd: { offset: 22, length: 6 },
        ...(omitsMileage ? {} : { mileageRaw: { offset: 28, length: 6 } }),
        cellularSignalRaw: { offset: signalOffset, length: 3 },
        gnssSatellitesRaw: { offset: signalOffset + 3, length: 3 }
      },
      remainingBody: {
        offset: prefixLength,
        length: remainingBody.length,
        hex: remainingBody.toString('hex'),
        chunks: hexChunks(remainingBody, prefixLength)
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
