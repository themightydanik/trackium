import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { compareAovxTelemetry } from '../src/aovx/compare-telemetry.js';

const DEVICE_A = Buffer.from('944063243931', 'hex');
const DEVICE_B = Buffer.from('123456789012', 'hex');

function packet({ timestamp, sequenceNumber, device = DEVICE_A, status = '10000000',
  latitude = '00000000', longitude = '00000000', altitude = '0000',
  speed = '0000', direction = '0000', temperature = '00f0', humidity = '02a0', dataType = 0x00 }) {
  const body = Buffer.alloc(56);
  Buffer.from(status, 'hex').copy(body, 4);
  Buffer.from(latitude, 'hex').copy(body, 8);
  Buffer.from(longitude, 'hex').copy(body, 12);
  Buffer.from(altitude, 'hex').copy(body, 16);
  Buffer.from(speed, 'hex').copy(body, 18);
  Buffer.from(direction, 'hex').copy(body, 20);
  Buffer.from(timestamp, 'hex').copy(body, 22);
  Buffer.from([0xf6, 0x0e, dataType, 0x0f]).copy(body, 40);
  Buffer.from('0011', 'hex').copy(body, 44); // light
  Buffer.from(temperature, 'hex').copy(body, 46);
  Buffer.from(humidity, 'hex').copy(body, 48);
  Buffer.from('ff00ff00ff00', 'hex').copy(body, 50); // accelerometer
  return {
    raw_payload_hex: encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: device, sequenceNumber, body
    }).toString('hex')
  };
}

test('compares F6 raw fields with fixed telemetry in BCD timestamp order', () => {
  const result = compareAovxTelemetry({ packets: [
    packet({ timestamp: '261119090200', sequenceNumber: 3, temperature: '00f2', speed: '0002' }),
    packet({ timestamp: '261119090000', sequenceNumber: 1 }),
    packet({ timestamp: '261119090100', sequenceNumber: 2, temperature: '00f1', speed: '0001' })
  ] });

  assert.equal(result.f6SampleCount, 3);
  assert.equal(result.dataTypeCounts['0x00'], 3);
  assert.equal(result.fieldMaskCounts['0x0f'], 3);
  assert.equal(result.transitions.transitionCount, 2);
  assert.deepEqual(result.transitions.transitions.map(item => item.from.sequenceNumber), [1, 2]);
  assert.deepEqual(result.transitions.transitions[0].changedSensorFields, ['temperatureRaw']);
  assert.deepEqual(result.transitions.transitions[0].changedFixedFields, ['speed']);
  assert.equal(
    result.transitions.changeCoOccurrence.temperatureRaw.speed.bothChanged, 2
  );
  assert.equal(result.fieldValues.sensor.temperatureRaw.distinctValueCount, 3);
  assert.match(result.note, /No units/);
});

test('does not compare adjacent samples across device boundaries', () => {
  const result = compareAovxTelemetry({ packets: [
    packet({ timestamp: '261119090000', sequenceNumber: 1, device: DEVICE_A }),
    packet({ timestamp: '261119090100', sequenceNumber: 1, device: DEVICE_B })
  ] });

  assert.equal(result.deviceCount, 2);
  assert.equal(result.perDeviceTransitionCount, 0);
  assert.equal(result.transitions.transitionCount, 0);
  assert.equal(result.transitions.incomparableBoundaryCount, 0);
  assert.equal(result.transitions.changeCoOccurrence.temperatureRaw.speed.comparableTransitions, 0);
});

test('excludes malformed frames and telemetry without a parsed F6 extension', () => {
  const noF6Body = Buffer.alloc(40);
  Buffer.from('261119090000', 'hex').copy(noF6Body, 22);
  const noF6 = encodeAovxFrame({
    messageId: 0x0200, deviceIdBcd: DEVICE_A, sequenceNumber: 2, body: noF6Body
  }).toString('hex');
  const result = compareAovxTelemetry({ packets: [
    { raw_payload_hex: 'not-hex' },
    { raw_payload_hex: noF6 }
  ] });

  assert.equal(result.invalidCount, 1);
  assert.equal(result.telemetryWithoutF6Count, 1);
  assert.equal(result.f6SampleCount, 0);
});

test('rejects invalid capture shapes and excessive packet counts', () => {
  assert.throws(() => compareAovxTelemetry({}), /packets array/);
  assert.throws(() => compareAovxTelemetry({ packets: Array(5001).fill({}) }), /exceeds/);
});

test('does not compare across different F6 data types', () => {
  const result = compareAovxTelemetry({ packets: [
    packet({ timestamp: '261119090000', sequenceNumber: 1, dataType: 0x00 }),
    packet({ timestamp: '261119090100', sequenceNumber: 2, dataType: 0x10, temperature: '00f1' })
  ] });

  assert.equal(result.transitions.transitionCount, 0);
  assert.equal(result.transitions.incomparableBoundaryCount, 1);
});
