import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';
import { createNativeSessions } from '../src/cargo/native-session.js';
test('Native client defaults and reviewed Server Core profiles fail closed', () => {
  const base = { DATABASE_URL: 'postgres://localhost/unused' };
  assert.equal(readConfig(base).nativeEnabled, false);
  assert.equal(readConfig(base).proofs.coreVersion, '1.0.49.4');
  assert.equal(
    readConfig({ ...base, MINIMA_CORE_PROFILE: 'blackbear-2.2.10' }).proofs.coreVersion,
    '1.1.2.31-euro4'
  );
  assert.equal(
    readConfig({ ...base, MINIMA_CORE_PROFILE: 'trackium-core-1.1.2.31' }).proofs.coreVersion,
    '1.1.2.31'
  );
  assert.throws(() => readConfig({ ...base, MINIMA_CORE_PROFILE: 'unknown' }));
  assert.throws(() => readConfig({ ...base, ENABLE_NATIVE_CLIENTS: 'yes' }));
  assert.throws(
    () => createNativeSessions({}, readConfig({ ...base, ENABLE_NATIVE_CLIENTS: 'true' })),
    /HTTPS/
  );
  assert.doesNotThrow(() =>
    createNativeSessions(
      {},
      readConfig({ ...base, ENABLE_NATIVE_CLIENTS: 'true', PUBLIC_ORIGIN: 'https://gateway.test' })
    )
  );
});
