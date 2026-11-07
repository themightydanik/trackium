import test from 'node:test';
import assert from 'node:assert/strict';
import { routeAndConditions, transitions } from '../src/cargo/shipments.js';
import { sample } from '../src/cargo/simulator.js';
import { publicOrigin, createPairing } from '../src/cargo/pairing.js';
import { readConfig } from '../src/config.js';
const route = [
  { name: 'A', latitude: 50, longitude: 20 },
  { name: 'B', latitude: 51, longitude: 21 }
];
const conditions = { temperature_min_c: 2, temperature_max_c: 8 };
test('route and conditions validation rejects invalid/unknown data without protocol assumptions', () => {
  const valid = routeAndConditions(route, conditions);
  assert.equal(valid.route[0].radius_m, 200);
  assert.equal(valid.conditions.tolerance_c, 0);
  for (const [r, c] of [
    [[], conditions],
    [[route[0], route[0]], conditions],
    [route, { ...conditions, temperature_min_c: 9 }],
    [route, { ...conditions, extra: 1 }],
    [[{ ...route[0], latitude: NaN }, route[1]], conditions]
  ])
    assert.throws(() => routeAndConditions(r, c), { status: 400 });
});
test('shipment terminal states have no outgoing transitions', () => {
  assert.deepEqual(transitions.completed, []);
  assert.deepEqual(transitions.cancelled, []);
  assert.ok(!transitions.draft.includes('completed'));
  assert.deepEqual(transitions.delivered, ['completed']);
});
test('simulation samples have repeatable identities, route endpoints and temperature excursion', () => {
  const parsed = routeAndConditions(route, conditions),
    run = {
      id: 'synthetic-run',
      step: 0,
      started_at: '2026-11-07T12:00:00.000Z',
      interval_ms: 1000,
      scenario: 'temperature-excursion',
      snapshot: parsed
    };
  assert.deepEqual(sample(run), sample({ ...run }));
  assert.equal(sample(run).gps.latitude, 50);
  assert.equal(sample({ ...run, step: 4 }).gps.latitude, 51);
  assert.equal(sample({ ...run, step: 2 }).status, 'alarm');
  assert.ok(sample({ ...run, step: 2 }).temperature_c > conditions.temperature_max_c);
  assert.notEqual(sample({ ...run, step: 1 }).source_event_id, sample(run).source_event_id);
});
test('workspace origin rejects credentials, remote plaintext, paths and queries', () => {
  assert.equal(publicOrigin('https://gateway.example/'), 'https://gateway.example');
  for (const value of [
    'http://169.254.169.254',
    'https://user:secret@example.com',
    'https://gateway.example/path',
    'https://gateway.example?token=x'
  ])
    assert.throws(() => publicOrigin(value));
});
test('server simulation and session workspace default to disabled', () => {
  const c = readConfig({ DATABASE_URL: 'postgres://unused' });
  assert.equal(c.webEnabled, false);
  assert.equal(c.simulatorEnabled, false);
  assert.throws(() =>
    readConfig({ DATABASE_URL: 'postgres://unused', ENABLE_SERVER_SIMULATOR: 'yes' })
  );
});

test('HTTPS cookies remain Secure after origin normalization', () => {
  let value;
  createPairing({}, { publicOrigin: 'HTTPS://GATEWAY.EXAMPLE/' }).clear({
    setHeader(name, v) {
      value = v;
    }
  });
  assert.match(value, /; Secure$/);
  assert.match(value, /HttpOnly/);
});
