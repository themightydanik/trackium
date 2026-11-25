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

test('Railway demo allows only the existing closed demo identity and safe proof modes', () => {
  const demo = {...env, DEPLOYMENT_PROFILE:'railway-demo', CUSTOMER_DEMO_ENABLED:'true',
    CUSTOMER_DEMO_PILOT_ENABLED:'true', INTEGRITAS_MODE:'test',
    ROUTING_VALHALLA_ORIGIN:'http://valhalla.railway.internal:8002',
    ROUTING_GRAPH_RELEASE_ID:'b'.repeat(64)};
  const config = readConfig(demo);
  assert.equal(config.railwayHttps, true);
  assert.equal(config.demoEnabled, true);
  assert.equal(config.pilotEnabled, true);
  assert.equal(config.customerMail, null);
  assert.equal(config.routing.railway, true);
  assert.equal(readConfig({...demo, ENABLE_TCP_RECEIVER:'true', TCP_PROTOCOL:'aovx'}).tcpEnabled, true);
  for (const overrides of [
    {CUSTOMER_ACCOUNTS_ENABLED:'true'}, {PROOF_ALLOW_LIVE:'true'}, {PROOF_ALLOW_MAINNET:'true'},
    {ENABLE_SERVER_SIMULATOR:'true'}, {ENABLE_FIXTURE_ADAPTER:'true'}, {PUBLIC_ORIGIN:'http://gateway.test'},
    {ENABLE_TCP_RECEIVER:'true', TCP_PROTOCOL:'raw'}, {ROUTING_VALHALLA_ORIGIN:'http://valhalla:8002'}
  ]) assert.throws(() => readConfig({...demo, ...overrides}));
  const disarmed = {...demo, CUSTOMER_DEMO_ENABLED:'false', CUSTOMER_DEMO_PILOT_ENABLED:'false'};
  assert.throws(() => readConfig(disarmed));
  assert.equal(readConfig({...disarmed, INTEGRITAS_MODE:'disabled'}).demoEnabled, false);
});
