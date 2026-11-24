import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('Demo activation requires explicit test proof mode and keeps public accounts off', () => {
  const env = { DATABASE_URL:'fixture', ENABLE_WEB_WORKSPACE:'true',
    PUBLIC_ORIGIN:'https://demo.example.test', INTEGRITAS_MODE:'test' };
  assert.equal(readConfig(env).demoEnabled,false);
  const demo = {...env,CUSTOMER_DEMO_ENABLED:'true'};
  assert.equal(readConfig(demo).demoEnabled,true);
  for (const override of [{CUSTOMER_ACCOUNTS_ENABLED:'true'},{INTEGRITAS_MODE:'disabled'},
    {PROOF_MODE:'test'},{PROOF_ALLOW_MAINNET:'true'},{ENABLE_WEB_WORKSPACE:'false'}])
    assert.throws(() => readConfig({...demo,...override}),/Customer demo requires/);
  assert.throws(() => readConfig({...demo,NODE_ENV:'production',PUBLIC_ORIGIN:'http://localhost'}),/HTTPS/);
});

test('Physical pilot requires an explicit opt-in and inherits demo publication gates', () => {
  const demo = { DATABASE_URL:'fixture', ENABLE_WEB_WORKSPACE:'true', CUSTOMER_DEMO_ENABLED:'true',
    PUBLIC_ORIGIN:'https://demo.example.test', INTEGRITAS_MODE:'test' };
  assert.equal(readConfig(demo).pilotEnabled,false);
  const pilot = { ...demo, CUSTOMER_DEMO_PILOT_ENABLED:'true' };
  assert.equal(readConfig(pilot).pilotEnabled,true);
  assert.throws(() => readConfig({...pilot,CUSTOMER_DEMO_ENABLED:'false'}), /requires CUSTOMER_DEMO_ENABLED/);
  assert.throws(() => readConfig({...pilot,CUSTOMER_DEMO_PILOT_ENABLED:'yes'}), /Invalid/);
  assert.throws(() => readConfig({...pilot,PROOF_ALLOW_LIVE:'true'}), /Customer demo requires/);
});
