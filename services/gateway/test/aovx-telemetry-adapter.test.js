import test from 'node:test';
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
