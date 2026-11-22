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
