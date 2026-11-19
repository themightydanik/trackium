import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('AOVX observations operator token is optional but validated when configured', () => {
  const base = { DATABASE_URL: 'postgres://unused' };
  assert.equal(readConfig(base).aovxObservationsToken, undefined);
  const token = 'operator-test-token-' + 'x'.repeat(40);
  assert.equal(readConfig({ ...base, AOVX_OBSERVATIONS_TOKEN: token }).aovxObservationsToken, token);
  for (const value of ['short', 'x'.repeat(513), 'token with spaces', 'bad\nvalue'])
    assert.throws(() => readConfig({ ...base, AOVX_OBSERVATIONS_TOKEN: value }), /AOVX_OBSERVATIONS_TOKEN/);
});
