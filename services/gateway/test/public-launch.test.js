import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

const env = {
  DATABASE_URL: 'postgres://unused',
  RAILWAY_ENVIRONMENT_ID: 'fixture',
  NODE_ENV: 'production',
  DEPLOYMENT_PROFILE: 'railway-public',
  PUBLIC_ORIGIN: 'https://gateway.test',
  ENABLE_NATIVE_CLIENTS: 'true',
  ENABLE_WEB_WORKSPACE: 'true',
  ENABLE_TCP_RECEIVER: 'false'
};

test('public profile requires HTTPS and keeps registration, routing and publishing separately gated', () => {
  assert.equal(readConfig(env).railwayPublic, true);
  assert.equal(readConfig(env).customerMail, null);
  assert.equal(readConfig(env).routing, null);
  assert.equal(readConfig({...env, ENABLE_TCP_RECEIVER:'true', TCP_PROTOCOL:'aovx'}).tcpEnabled, true);
  assert.equal(readConfig({...env, CUSTOMER_ACCOUNTS_ENABLED:'true', CUSTOMER_MAIL_PROVIDER:'resend',
    CUSTOMER_MAIL_FROM:'verify@gateway.test', RESEND_API_KEY:'re_fixture',
    CUSTOMER_MAIL_TOKEN_KEY:'a'.repeat(64)}).customerMail.provider, 'resend');
  for (const overrides of [
    {NODE_ENV:'test'}, {PUBLIC_ORIGIN:'http://gateway.test'}, {PUBLIC_ORIGIN:'https://gateway.test/app'},
    {ENABLE_TCP_RECEIVER:'true'}, {ENABLE_TCP_RECEIVER:undefined}, {ENABLE_WEB_WORKSPACE:'false'}, {ENABLE_FIXTURE_ADAPTER:'true'},
    {PROOF_ALLOW_MAINNET:'true'}, {INTEGRITAS_MODE:'test'},
    {CUSTOMER_ACCOUNTS_ENABLED:'true', CUSTOMER_MAIL_PROVIDER:'local'},
    {ROUTING_VALHALLA_ORIGIN:'http://valhalla:8002', ROUTING_GRAPH_RELEASE_ID:'b'.repeat(64)}
  ]) assert.throws(() => readConfig({...env, ...overrides}));
});
