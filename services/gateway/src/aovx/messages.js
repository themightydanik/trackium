const MESSAGE_IDS = Object.freeze({
  DEVICE_REGISTRATION: 0x0100,
  DEVICE_AUTHENTICATION: 0x0102,
  SERVER_GENERAL_RESPONSE: 0x8001,
  DEVICE_REGISTRATION_RESPONSE: 0x8100
});

const RESPONSE_RESULTS = Object.freeze({
  0: 'success',
  1: 'failure',
  2: 'wrong-message',
  3: 'unsupported',
  4: 'alarm-confirmed'
});

const REGISTRATION_RESULTS = Object.freeze({
  0: 'success',
  1: 'vehicle-already-registered',
  2: 'vehicle-not-found',
  3: 'device-already-registered',
  4: 'device-not-found'
});

function requireMessage(message, expectedId) {
  if (!message || typeof message !== 'object' || !Buffer.isBuffer(message.body)) {
    throw new TypeError('message must be a decoded AOVX frame with a Buffer body');
  }
  if (message.messageId !== expectedId) {
    throw new Error(`unexpected AOVX message ID: expected 0x${expectedId.toString(16)}, received 0x${Number(message.messageId).toString(16)}`);
  }
}

function requireBodyLength(body, length, label) {
  if (body.length !== length) {
    throw new Error(`${label} body must be exactly ${length} bytes; received ${body.length}`);
  }
}

function copyRange(body, start, end) {
  return Buffer.from(body.subarray(start, end));
}

/**
 * Parse the fixed 38-byte body documented for device registration (0x0100).
 * The envelope checksum remains observational and is not validated here.
 */
export function parseAovxRegistration(message) {
  requireMessage(message, MESSAGE_IDS.DEVICE_REGISTRATION);
  const body = message.body;
  requireBodyLength(body, 38, '0x0100 registration');

  return {
    messageId: message.messageId,
    deviceIdBcd: Buffer.from(message.deviceIdBcd),
    sequenceNumber: message.sequenceNumber,
    provinceAreaId: copyRange(body, 0, 2),
    districtId: copyRange(body, 2, 4),
    manufacturerId: copyRange(body, 4, 9),
    deviceType: copyRange(body, 9, 29),
    terminalId: copyRange(body, 29, 36),
    plateColor: body[36],
    vehicleLogo: body[37]
  };
}

/** Parse the variable-length authentication code carried by 0x0102. */
export function parseAovxAuthentication(message) {
  requireMessage(message, MESSAGE_IDS.DEVICE_AUTHENTICATION);
  if (message.body.length === 0) {
    throw new Error('0x0102 authentication body must contain an authentication code');
  }
  return {
    messageId: message.messageId,
    deviceIdBcd: Buffer.from(message.deviceIdBcd),
    sequenceNumber: message.sequenceNumber,
    authenticationCode: Buffer.from(message.body),
    authenticationCodeText: message.body.toString('ascii')
  };
}

/**
 * Parse the 0x8100 registration response:
 * reply sequence (2), result (1), and an optional variable-length auth code.
 * The workbook states that the auth-code field is present only after success.
 */
export function parseAovxRegistrationResponse(message) {
  requireMessage(message, MESSAGE_IDS.DEVICE_REGISTRATION_RESPONSE);
  if (message.body.length < 3) {
    throw new Error('0x8100 registration response body must contain reply sequence and result');
  }
  const result = message.body[2];
  const authenticationCode = copyRange(message.body, 3, message.body.length);
  if (result === 0 && authenticationCode.length === 0) {
    throw new Error('0x8100 successful registration response must contain an authentication code');
  }
  if (result !== 0 && authenticationCode.length !== 0) {
    throw new Error('0x8100 non-success response must not contain an authentication code');
  }
  return {
    messageId: message.messageId,
    deviceIdBcd: Buffer.from(message.deviceIdBcd),
    sequenceNumber: message.sequenceNumber,
    replySequenceNumber: message.body.readUInt16BE(0),
    result,
    resultName: REGISTRATION_RESULTS[result] ?? 'unknown',
    authenticationCode,
    authenticationCodeText: authenticationCode.toString('ascii')
  };
}

/** Parse the fixed 5-byte server acknowledgement body (0x8001). */
export function parseAovxAcknowledgement(message) {
  requireMessage(message, MESSAGE_IDS.SERVER_GENERAL_RESPONSE);
  requireBodyLength(message.body, 5, '0x8001 acknowledgement');
  const result = message.body[4];
  return {
    messageId: message.messageId,
    deviceIdBcd: Buffer.from(message.deviceIdBcd),
    sequenceNumber: message.sequenceNumber,
    replySequenceNumber: message.body.readUInt16BE(0),
    acknowledgedMessageId: message.body.readUInt16BE(2),
    result,
    resultName: RESPONSE_RESULTS[result] ?? 'unknown'
  };
}

/**
 * Dispatch only the message types whose layouts are explicitly described in
 * the protocol workbook. Unknown types remain opaque and are never rejected.
 */
export function parseAovxMessage(message) {
  switch (message?.messageId) {
    case MESSAGE_IDS.DEVICE_REGISTRATION: return { type: 'registration', ...parseAovxRegistration(message) };
    case MESSAGE_IDS.DEVICE_AUTHENTICATION: return { type: 'authentication', ...parseAovxAuthentication(message) };
    case MESSAGE_IDS.SERVER_GENERAL_RESPONSE: return { type: 'acknowledgement', ...parseAovxAcknowledgement(message) };
    case MESSAGE_IDS.DEVICE_REGISTRATION_RESPONSE: return { type: 'registration-response', ...parseAovxRegistrationResponse(message) };
    default:
      return {
        type: 'unknown',
        messageId: message?.messageId,
        deviceIdBcd: message?.deviceIdBcd ? Buffer.from(message.deviceIdBcd) : undefined,
        sequenceNumber: message?.sequenceNumber,
        body: message?.body ? Buffer.from(message.body) : undefined
      };
  }
}

export { MESSAGE_IDS as AOVX_MESSAGE_IDS };
