import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFixture, canonicalize } from '../src/telemetry/schema.js';
import { readConfig } from '../src/config.js';
const context = {
  tenantId: 'c7dfc5ee-5fe5-40b1-a3a8-5b1b796731a1',
  deviceId: 'b48d725b-fd62-42e8-af18-58e967ee4685'
};
const input = () => ({
  schema_version: 1,
  source_event_id: 'fixture-1',
  occurred_at: '2026-11-07T12:00:00.000Z',
  gps: { latitude: 50.45, longitude: 30.52 },
  temperature_c: 21,
  humidity_pct: 50,
  battery_pct: 80,
  status: 'moving',
  extra: { door_open: false }
});
test('canonical normalized events preserve units, identity and explicit synthetic provenance', () => {
  const { event, canonical, sha256 } = normalizeFixture(input(), context);
  assert.equal(event.trust, 'synthetic');
  assert.equal(event.tenant_id, context.tenantId);
  assert.equal(event.device_id, context.deviceId);
  assert.equal(event.gps.speed_mps, null);
  assert.equal(sha256.length, 64);
  assert.equal(canonical, canonicalize(event));
  const other = input();
  other.extra = { z: 1, a: true };
  const first = normalizeFixture(other, context);
  other.extra = { a: true, z: 1 };
  assert.equal(normalizeFixture(other, context).canonical, first.canonical);
});
test('validation rejects identity injection, unknown versions and invalid measurements', () => {
  const mutations = [
    (x) => (x.device_id = context.deviceId),
    (x) => (x.tenant_id = context.tenantId),
    (x) => (x.trust = 'verified'),
    (x) => (x.raw_packet_id = '1'),
    (x) => (x.schema_version = 2),
    (x) => (x.occurred_at = '2026-02-30T12:00:00.000Z'),
    (x) => (x.gps.latitude = 91),
    (x) => (x.gps.longitude = -181),
    (x) => (x.humidity_pct = 101),
    (x) => (x.battery_pct = -1),
    (x) => (x.temperature_c = Infinity),
    (x) => (x.gps.speed_mps = -1),
    (x) => (x.status = 'trusted'),
    (x) => (x.extra = { nested: {} }),
    (x) => (x.extra = JSON.parse('{"__proto__":1}')),
    (x) => (x.extra = { bad: '\u0000' }),
    (x) => (x.source_event_id = '\ud800'),
    (x) => (x.occurred_at = '0000-01-01T00:00:00.000Z')
  ];
  for (const mutate of mutations) {
    const x = input();
    mutate(x);
    assert.throws(() => normalizeFixture(x, context), { status: 400 });
  }
});
test('null measurements and zero coordinates are valid; receipt time does not enter canonical format', () => {
  const x = input();
  x.gps = { latitude: 0, longitude: -0 };
  delete x.temperature_c;
  const result = normalizeFixture(x, context);
  assert.equal(result.event.gps.longitude, 0);
  assert.equal(result.event.temperature_c, null);
  assert.equal('received_at' in result.event, false);
});
test('fixture adapter is disabled by default and accepts only explicit true/false', () => {
  assert.equal(readConfig({ DATABASE_URL: 'postgres://unused' }).fixturesEnabled, false);
  assert.equal(
    readConfig({ DATABASE_URL: 'postgres://unused', ENABLE_FIXTURE_ADAPTER: 'true' })
      .fixturesEnabled,
    true
  );
  assert.throws(() =>
    readConfig({ DATABASE_URL: 'postgres://unused', ENABLE_FIXTURE_ADAPTER: '1' })
  );
});
