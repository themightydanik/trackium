import test from 'node:test';
import assert from 'node:assert/strict';
import { customerMailConfig } from '../src/cargo/customer-mail.js';

test('Customer mail requires explicit activation and production HTTPS credentials', () => {
  const active = { CUSTOMER_ACCOUNTS_ENABLED:'true', ENABLE_WEB_WORKSPACE:'true',
    PUBLIC_ORIGIN:'https://stage.example.test', CUSTOMER_MAIL_PROVIDER:'resend',
    RESEND_API_KEY:'re_example_test', CUSTOMER_MAIL_FROM:'accounts@example.test',
    CUSTOMER_MAIL_TOKEN_KEY:'29'.repeat(32) };
  assert.equal(customerMailConfig({ ...active, CUSTOMER_ACCOUNTS_ENABLED:undefined }),null);
  assert.equal(customerMailConfig(active).provider,'resend');
  assert.throws(() => customerMailConfig({...active,RESEND_API_KEY:''}),/RESEND_API_KEY/);
  assert.throws(() => customerMailConfig({...active,CUSTOMER_MAIL_TOKEN_KEY:'bad'}),/CUSTOMER_MAIL_TOKEN_KEY/);
  assert.throws(() => customerMailConfig({...active,PUBLIC_ORIGIN:'http://localhost'}),/HTTPS/);
  assert.throws(() => customerMailConfig({...active,PUBLIC_ORIGIN:'https://user@stage.example.test'}),/PUBLIC_ORIGIN/);
  const local = {...active,PUBLIC_ORIGIN:'http://127.0.0.1:8080',CUSTOMER_MAIL_PROVIDER:'local',
    ACCOUNT_MAIL_DIRECTORY:'/tmp/test-mail'};
  assert.equal(customerMailConfig(local).provider,'local');
  assert.throws(() => customerMailConfig({...local,NODE_ENV:'production'}),/restricted/);
  assert.throws(() => customerMailConfig({...local,RAILWAY_ENVIRONMENT_ID:'fixture'}),/restricted/);
});
