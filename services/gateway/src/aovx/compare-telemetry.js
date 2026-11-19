import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const MAX_CAPTURE_PACKETS = 5000;
const MAX_TRANSITION_DETAILS = 100;
const SENSOR_FIELDS = ['lightRaw', 'temperatureRaw', 'humidityRaw', 'accelerometerRaw'];
const FIXED_FIELDS = ['status', 'latitude', 'longitude', 'altitude', 'speed', 'direction'];

function rawHex(body, offset, length) {
  return body.subarray(offset, offset + length).toString('hex');
}

function changed(left, right) {
  return left !== right;
}

function increment(bucket, key) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function summarizeFieldValues(records, fieldName, source) {
  const counts = {};
  for (const record of records) {
    const value = source === 'sensor'
      ? record.sensorFields[fieldName]
      : record.fixedFields[fieldName];
    if (value !== undefined) increment(counts, value);
  }
  return {
    sampleCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
    distinctValueCount: Object.keys(counts).length,
    valueCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  };
}

function emptyPairs() {
  const pairs = {};
  for (const sensorName of SENSOR_FIELDS) {
    pairs[sensorName] = {};
    for (const fixedName of FIXED_FIELDS) {
      pairs[sensorName][fixedName] = {
        comparableTransitions: 0,
        bothChanged: 0,
        sensorOnlyChanged: 0,
        fixedOnlyChanged: 0,
        neitherChanged: 0
      };
    }
  }
  return pairs;
}

function mergeDeviceTransitions(summaries) {
  const changeCoOccurrence = emptyPairs();
  const transitions = [];
  let transitionCount = 0;
  let incomparableBoundaryCount = 0;
  for (const summary of summaries) {
    transitionCount += summary.transitionCount;
    incomparableBoundaryCount += summary.incomparableBoundaryCount;
    transitions.push(...summary.transitions);
    for (const sensorName of SENSOR_FIELDS) {
      for (const fixedName of FIXED_FIELDS) {
        const target = changeCoOccurrence[sensorName][fixedName];
        const source = summary.changeCoOccurrence[sensorName][fixedName];
        for (const key of Object.keys(target)) target[key] += source[key];
      }
    }
  }
  return {
    transitionCount,
    incomparableBoundaryCount,
    transitionsOmitted: Math.max(0, transitionCount - Math.min(transitions.length, MAX_TRANSITION_DETAILS)),
    transitions: transitions.slice(0, MAX_TRANSITION_DETAILS),
    changeCoOccurrence,
    note: 'Co-occurrence counts describe adjacent observations within each device and matching F6 data type/mask only. They do not establish causation or identify sensor units or physical meaning.'
  };
}

function buildTransitions(records) {
  const pairs = emptyPairs();
  const details = [];
  let transitionCount = 0;
  let incomparableBoundaryCount = 0;
  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (previous.dataTypeRaw !== current.dataTypeRaw || previous.fieldMask !== current.fieldMask) {
      incomparableBoundaryCount += 1;
      continue;
    }
    transitionCount += 1;
    const changedSensorFields = SENSOR_FIELDS.filter(name =>
      previous.sensorFields[name] !== undefined &&
      current.sensorFields[name] !== undefined &&
      changed(previous.sensorFields[name], current.sensorFields[name])
    );
    const changedFixedFields = FIXED_FIELDS.filter(name =>
      changed(previous.fixedFields[name], current.fixedFields[name])
    );

    for (const sensorName of SENSOR_FIELDS) {
      const beforeSensor = previous.sensorFields[sensorName];
      const afterSensor = current.sensorFields[sensorName];
      if (beforeSensor === undefined || afterSensor === undefined) continue;
      const sensorChanged = changed(beforeSensor, afterSensor);
      for (const fixedName of FIXED_FIELDS) {
        const fixedChanged = changed(previous.fixedFields[fixedName], current.fixedFields[fixedName]);
        const stats = pairs[sensorName][fixedName];
        stats.comparableTransitions += 1;
        if (sensorChanged && fixedChanged) stats.bothChanged += 1;
        else if (sensorChanged) stats.sensorOnlyChanged += 1;
        else if (fixedChanged) stats.fixedOnlyChanged += 1;
        else stats.neitherChanged += 1;
      }
    }

    if (details.length < MAX_TRANSITION_DETAILS) {
      details.push({
        from: { timestampBcdDigits: previous.timestampBcdDigits, sequenceNumber: previous.sequenceNumber },
        to: { timestampBcdDigits: current.timestampBcdDigits, sequenceNumber: current.sequenceNumber },
        changedSensorFields,
        changedFixedFields
      });
    }
  }

  return {
    transitionCount,
    incomparableBoundaryCount,
    transitionsOmitted: Math.max(0, transitionCount - details.length),
    transitions: details,
    changeCoOccurrence: pairs,
    note: 'Co-occurrence counts describe adjacent observations only when F6 data type and field mask match. They do not establish causation or identify sensor units or physical meaning.'
  };
}

export function compareAovxTelemetry(document) {
  if (!document || !Array.isArray(document.packets)) {
    throw new TypeError('capture must be a JSON object with a packets array');
  }
  if (document.packets.length > MAX_CAPTURE_PACKETS) {
    throw new RangeError(`capture exceeds ${MAX_CAPTURE_PACKETS} packets`);
  }

  const byDevice = new Map();
  let invalidCount = 0;
  let nonTelemetryCount = 0;
  let telemetryWithoutF6Count = 0;
  const dataTypeCounts = {};
  const fieldMaskCounts = {};

  for (let packetIndex = 0; packetIndex < document.packets.length; packetIndex += 1) {
    const item = document.packets[packetIndex];
    try {
      const hex = item?.raw_payload_hex;
      if (typeof hex !== 'string' || hex.length < 4 || hex.length % 2 ||
          !/^[0-9a-f]+$/i.test(hex)) {
        throw new Error('invalid raw frame hex');
      }
      const frame = decodeAovxFrame(Buffer.from(hex, 'hex'));
      if (frame.messageId !== 0x0200) {
        nonTelemetryCount += 1;
        continue;
      }
      const parsed = parseAovxMessage(frame);
      const data = parsed.data;
      const sensor = data.observedExtensions.sensorInformation;
      if (!sensor?.matchesObservedEnvelope) {
        telemetryWithoutF6Count += 1;
        continue;
      }

      const timestampBcdDigits = data.timestampBcdDigits;
      const record = {
        inputIndex: packetIndex,
        timestampBcdDigits,
        sequenceNumber: frame.sequenceNumber,
        dataTypeRaw: sensor.dataTypeRaw,
        fieldMask: sensor.fieldMask,
        fixedFields: {
          status: rawHex(frame.body, 4, 4),
          latitude: rawHex(frame.body, 8, 4),
          longitude: rawHex(frame.body, 12, 4),
          altitude: rawHex(frame.body, 16, 2),
          speed: rawHex(frame.body, 18, 2),
          direction: rawHex(frame.body, 20, 2)
        },
        sensorFields: Object.fromEntries(
          Object.entries(sensor.fields).map(([name, value]) => [name, value.toString('hex')])
        )
      };

      const deviceKey = frame.deviceIdBcd.toString('hex');
      if (!byDevice.has(deviceKey)) byDevice.set(deviceKey, []);
      byDevice.get(deviceKey).push(record);
      increment(dataTypeCounts, `0x${sensor.dataTypeRaw.toString(16).padStart(2, '0')}`);
      increment(fieldMaskCounts, `0x${sensor.fieldMask.toString(16).padStart(2, '0')}`);
    } catch {
      invalidCount += 1;
    }
  }

  const records = [];
  const deviceSummaries = [];
  for (const deviceRecords of byDevice.values()) {
    const sortable = deviceRecords.filter(record => typeof record.timestampBcdDigits === 'string');
    sortable.sort((a, b) =>
      a.timestampBcdDigits.localeCompare(b.timestampBcdDigits) || a.inputIndex - b.inputIndex
    );
    records.push(...sortable);
    deviceSummaries.push({
      sampleCount: sortable.length,
      invalidBcdTimestampCount: deviceRecords.length - sortable.length,
      ...buildTransitions(sortable)
    });
  }

  const fieldValues = { sensor: {}, fixed: {} };
  for (const name of SENSOR_FIELDS) {
    fieldValues.sensor[name] = summarizeFieldValues(records, name, 'sensor');
  }
  for (const name of FIXED_FIELDS) {
    fieldValues.fixed[name] = summarizeFieldValues(records, name, 'fixed');
  }

  const combinedTransitions = mergeDeviceTransitions(deviceSummaries);
  return {
    packetCount: document.packets.length,
    invalidCount,
    nonTelemetryCount,
    telemetryWithoutF6Count,
    deviceCount: byDevice.size,
    f6SampleCount: records.length,
    dataTypeCounts,
    fieldMaskCounts,
    chronologicalBasis: 'BCD digit string order within each device; no timezone or elapsed-time assumption',
    fieldValues,
    transitions: combinedTransitions,
    perDeviceTransitionCount: deviceSummaries.reduce((sum, item) => sum + item.transitionCount, 0),
    invalidBcdTimestampCount: deviceSummaries.reduce((sum, item) => sum + item.invalidBcdTimestampCount, 0),
    note: 'Fixed telemetry and F6 sensor values are compared as raw hexadecimal bytes. Records with invalid BCD timestamps are excluded from chronological comparisons. No units, scales, signedness, byte order, coordinates, or causal relationships are inferred.'
  };
}
