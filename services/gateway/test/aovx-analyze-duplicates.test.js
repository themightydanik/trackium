import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAovxFrame } from '../src/aovx/frame.js';
import { analyzeAovxDuplicateSamples } from '../src/aovx/analyze-duplicates.js';

const DEVICE = Buffer.from('944063243931', 'hex');

function packet({ timestamp = '261119163552', sequenceNumber = 1,
  status = '90780000', temperature = '0104', light = '046b' } = {}) {
  const body = Buffer.alloc(56);
  Buffer.from(status, 'hex').copy(body, 4);
  Buffer.from(timestamp, 'hex').copy(body, 22);
  Buffer.from([0xf6, 0x0e, 0x00, 0x0f]).copy(body, 40);
  Buffer.from(light, 'hex').copy(body, 44);
  Buffer.from(temperature, 'hex').copy(body, 46);
  Buffer.from('0287', 'hex').copy(body, 48);
  Buffer.from('ffce00480440', 'hex').copy(body, 50);
  return {
    raw_payload_hex: encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: DEVICE, sequenceNumber, body
    }).toString('hex')
  };
}

function changeStatusOnly(frameHex, status) {
  const wire = Buffer.from(frameHex, 'hex');
  const decoded = wire.subarray(1, -1);
  Buffer.from(status, 'hex').copy(decoded, 16);
  let checksum = 0;
  for (const byte of decoded.subarray(0, -1)) checksum ^= byte;
  decoded[decoded.length - 1] = checksum;
  return Buffer.concat([Buffer.from([0x7e]), decoded, Buffer.from([0x7e])]).toString('hex');
}

test('detects a repeated F6 sample whose only frame changes are status and checksum', () => {
  const first = packet();
  const second = { raw_payload_hex: changeStatusOnly(first.raw_payload_hex, '10040000') };
  const result = analyzeAovxDuplicateSamples({ packets: [first, second] });

  assert.equal(result.f6SampleCount, 2);
  assert.equal(result.repeatedSampleGroupCount, 1);
  assert.equal(result.groupsWithMultipleStatuses, 1);
  assert.equal(result.statusOnlyAndChecksumGroups, 1);
  assert.equal(result.groupsWithOtherStatusByteChanges, 0);
  assert.deepEqual(result.groups[0].statusValues, ['10040000', '90780000']);
  assert.deepEqual(result.groups[0].comparisonDetails[0].changedOffsets, [16, 17, 233]);
  assert.equal(result.groups[0].comparisonDetails[0].onlyStatusAndChecksum, true);
});

test('reports changes outside status and checksum separately', () => {
  const first = packet();
  const changed = Buffer.from(first.raw_payload_hex, 'hex');
  // Alter a non-status body byte without repairing checksum; analysis observes raw differences.
  changed[1 + 12 + 22] ^= 0x01;
  const result = analyzeAovxDuplicateSamples({
    packets: [first, { raw_payload_hex: changed.toString('hex') }]
  });

  assert.equal(result.repeatedSampleGroupCount, 1);
  assert.equal(result.groupsWithMultipleStatuses, 0);
});

test('counts exact duplicate frames without exposing device identifiers', () => {
  const sample = packet();
  const result = analyzeAovxDuplicateSamples({ packets: [sample, sample] });

  assert.equal(result.exactFrameDuplicateObservations, 1);
  assert.equal(result.groups[0].distinctFrameCount, 1);
  assert.equal(JSON.stringify(result).includes(DEVICE.toString('hex')), false);
});

test('keeps different devices and different F6 values in separate sample groups', () => {
  const first = packet();
  const otherSensor = packet({ temperature: '0105' });
  const result = analyzeAovxDuplicateSamples({ packets: [first, otherSensor] });

  assert.equal(result.repeatedSampleGroupCount, 0);
});

test('counts malformed frames and telemetry without F6', () => {
  const body = Buffer.alloc(40);
  Buffer.from('261119163552', 'hex').copy(body, 22);
  const noF6 = encodeAovxFrame({
    messageId: 0x0200, deviceIdBcd: DEVICE, sequenceNumber: 1, body
  }).toString('hex');
  const result = analyzeAovxDuplicateSamples({
    packets: [{ raw_payload_hex: 'bad' }, { raw_payload_hex: noF6 }]
  });

  assert.equal(result.invalidCount, 1);
  assert.equal(result.telemetryWithoutF6Count, 1);
  assert.equal(result.f6SampleCount, 0);
});

test('rejects invalid capture shapes and excessive packet counts', () => {
  assert.throws(() => analyzeAovxDuplicateSamples({}), /packets array/);
  assert.throws(() => analyzeAovxDuplicateSamples({ packets: Array(5001).fill({}) }), /exceeds/);
});
