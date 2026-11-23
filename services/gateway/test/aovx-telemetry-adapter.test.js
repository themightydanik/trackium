import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { encodeAovxFrame, decodeAovxFrame } from '../src/aovx/frame.js';
import { parseAovxMessage } from '../src/aovx/messages.js';
import { adaptAovxTelemetry } from '../src/aovx/telemetry-adapter.js';

function telemetryFrame() {
  const body = Buffer.alloc(40);
  body.writeUInt32BE(0x00010000, 0);
  body.writeUInt32BE(0x00000012, 4);
  body.writeUInt32BE(0, 8);
  body.writeUInt32BE(0, 12);
  Buffer.from('261119163552', 'hex').copy(body, 22);
  return decodeAovxFrame(encodeAovxFrame({
    messageId: 0x0200,
    deviceIdBcd: Buffer.from('944063243931', 'hex'),
    sequenceNumber: 7,
    body
  }));
}

test('normalizes AOVX identity and provenance without inventing GPS or measurement units', () => {
  const frame = telemetryFrame();
  const parsed = parseAovxMessage(frame);
  const result = adaptAovxTelemetry({
    frame, parsed, receivedAt: '2026-11-20T10:00:00.000Z',
    tenantId: '11111111-1111-4111-8111-111111111111',
    deviceId: '22222222-2222-4222-8222-222222222222'
  });
  assert.equal(result.deviceIdBcd, '944063243931');
  assert.equal(result.event.source, 'aovx-gal-v1');
  assert.equal(result.event.trust, 'unverified');
  assert.equal(result.event.occurred_at, '2026-11-20T10:00:00.000Z');
  assert.equal(result.event.gps, null);
  assert.equal(result.event.temperature_c, null);
  assert.equal(result.event.extra.latitude_raw, 0);
  assert.equal(result.event.extra.longitude_raw, 0);
  assert.equal(result.deviceTimeRaw, '261119163552');
  assert.equal(result.event.extra.checksum_algorithm, 'unconfirmed-xor-candidate');
});

test('rejects an XOR-candidate mismatch instead of normalizing it', () => {
  const frame = telemetryFrame();
  frame.checksumMatchesXor = false;
  assert.throws(() => adaptAovxTelemetry({
    frame, parsed: parseAovxMessage(frame), receivedAt: '2026-11-20T10:00:00.000Z',
    tenantId: '11111111-1111-4111-8111-111111111111',
    deviceId: '22222222-2222-4222-8222-222222222222'
  }), /checksum mismatch/);
});

const golden = Buffer.from(readFileSync(new URL('./fixtures/aovx-manufacturer-0200.hex', import.meta.url), 'utf8')
  .replace(/\s/g, ''), 'hex');
const measurementReceipt = '2026-11-23T01:11:31.000Z';
function observe(frame, receivedAt = measurementReceipt) {
  return adaptAovxTelemetry({
    frame, parsed: parseAovxMessage(frame), receivedAt,
    tenantId: '11111111-1111-4111-8111-111111111111',
    deviceId: '22222222-2222-4222-8222-222222222222'
  }).event;
}

test('decodes the manufacturer 0x0200 wire frame through the production decoder', () => {
  const frame = decodeAovxFrame(golden);
  assert.equal(golden.length, 233);
  assert.equal(frame.body.length, 218);
  assert.equal(frame.messageId, 0x0200);
  assert.equal(frame.checksum, 0x9a);
  assert.equal(frame.checksumMatchesXor, true);
  const event = observe(frame);
  assert.equal(event.source_event_id, 'c8e234c94bd452f97675367a51c4f0ee110bbae2fcff7d83c2d964e786d6e44c');
  assert.equal(event.trust, 'unverified');
  assert.equal(event.occurred_at, measurementReceipt);
  assert.equal(event.device_time_raw, '261123011130');
  assert.equal(event.device_measured_at, '2026-11-23T01:11:30.000Z');
  assert.deepEqual(event.gps, {
    latitude: 31.867795, longitude: 117.147473,
    altitude_m: null, accuracy_m: null, speed_mps: null, heading_deg: null
  });
  const fields = event.extra;
  assert.equal(fields.latitude_raw, 31867795);
  assert.equal(fields.longitude_raw, 117147473);
  assert.equal(fields.status_raw, 0x10040002);
  assert.equal(fields.gnss_fix, true);
  assert.equal(fields.buffered, false);
  assert.equal(fields.live_position_eligible, true);
  assert.equal(fields.speed_raw, 0);
  assert.equal(fields.direction_raw, 0);
  assert.equal(fields.altitude_raw, 169);
  assert.equal(fields.mileage_raw, null);
  assert.equal(fields.cellular_signal_raw_hex, '30011f');
  assert.equal(fields.gnss_satellites_raw_hex, '310105');
});

test('applies F9 hemisphere, fix and buffering bits and rejects invalid positions and UTC BCD', () => {
  const frame = decodeAovxFrame(golden);
  function variant({ status = 2, lat = 31867795, lon = 117147473, bcd = '261123011130' } = {},
    receivedAt = measurementReceipt) {
    const body = Buffer.from(frame.body);
    body.writeUInt32BE(status, 4);
    body.writeUInt32BE(lat, 8);
    body.writeUInt32BE(lon, 12);
    Buffer.from(bcd, 'hex').copy(body, 22);
    return observe(decodeAovxFrame(encodeAovxFrame({
      messageId: frame.messageId, deviceIdBcd: frame.deviceIdBcd, sequenceNumber: frame.sequenceNumber, body
    })), receivedAt);
  }
  for (const [status, latitude, longitude] of [
    [2, 31.867795, 117.147473], [6, -31.867795, 117.147473],
    [10, 31.867795, -117.147473], [14, -31.867795, -117.147473]
  ]) {
    assert.equal(variant({ status }).gps.latitude, latitude);
    assert.equal(variant({ status }).gps.longitude, longitude);
  }
  assert.equal(variant({ status: 14, lat: 90e6, lon: 180e6 }).gps.latitude, -90);
  assert.equal(variant({ status: 14, lat: 90e6, lon: 180e6 }).gps.longitude, -180);
  assert.equal(variant({ lat: 0 }).gps.latitude, 0);
  for (const input of [{ status: 0 }, { status: 0, lat: 0, lon: 0 }, { lat: 0, lon: 0 },
    { lat: 90e6 + 1 }, { lon: 180e6 + 1 }]) assert.equal(variant(input).gps, null);
  for (const bcd of ['26af23011130', '260230011130', '261123241130', '261123011160', '261100011130']) {
    const event = variant({ bcd });
    assert.equal(event.device_measured_at, null);
    assert.equal(event.gps, null);
    assert.equal(event.device_time_raw, bcd);
  }
  const buffered = variant({ status: 0x80000002 });
  assert.equal(buffered.extra.buffered, true);
  assert.equal(buffered.extra.live_position_eligible, false);
  assert.equal(buffered.gps.latitude, 31.867795);
  const stale = variant({}, '2026-11-23T01:16:30.001Z');
  assert.equal(stale.extra.live_position_eligible, false);
  assert.equal(stale.gps.latitude, 31.867795);
  assert.equal(variant({ bcd: '261123011132' }).gps, null);
});
