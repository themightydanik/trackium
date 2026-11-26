import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createCustomerMail } from '../src/cargo/customer-mail.js';
import { takeCustomerRate, limitCustomerRequest } from '../src/cargo/customer-rate.js';
import pg from 'pg';
import { provisionDevices, administerActivation } from '../src/cargo/device-activation.js';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');
test('Customer accounts verify, recover, revoke, manage company roles and rotate between isolated companies', async t => {
  const schema = 'accounts_' + randomUUID().replaceAll('-','');
  const admin = new pg.Pool({ connectionString: url });
  const connection = { connectionString: url, options: '-c search_path=' + schema };
  const db = new pg.Pool(connection);
  const replica = new pg.Pool(connection);
  await admin.query('CREATE SCHEMA ' + schema);
  const listener = createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const httpPort = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = 'http://127.0.0.1:' + httpPort;
  const config = readConfig({ DATABASE_URL: url, ENABLE_WEB_WORKSPACE:'true', ENABLE_TCP_RECEIVER:'false',
    DEVICE_ACTIVATION_ENABLED:'true', DEPLOYMENT_PROFILE:'railway-public', NODE_ENV:'production', ENABLE_NATIVE_CLIENTS:'true',
    PUBLIC_ORIGIN: origin.replace('http:', 'https:'), HTTP_PORT: String(httpPort), CUSTOMER_ACCOUNTS_ENABLED: 'true', CUSTOMER_MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_only',
    CUSTOMER_MAIL_FROM: 'accounts@example.test', CUSTOMER_MAIL_TOKEN_KEY: 'ab'.repeat(32) });
  const { gateway } = createRuntime(db, { ...config, host:'127.0.0.1' }, { worker:false, logger:{ info(){}, error(){} } });
  t.after(async () => {
    await gateway.shutdown();
    await replica.end();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await gateway.start();
  const customer = () => ({ cookie:'', csrf:'' });
  const account = (c, action, data, options) => call(c,'/v1/account/'+action,data,options);
  async function call(c, path, data, { headers = {}, method = data === undefined ? 'GET' : 'POST' } = {}) {
    const res = await fetch(origin + path, {
      method, headers: { 'X-Trackium-Client':'cargo-v2', 'sec-fetch-site':'same-origin',
        origin:origin.replace('http:', 'https:'), cookie:c.cookie, 'x-csrf-token':c.csrf, 'content-type':'application/json', ...headers },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const set = res.headers.getSetCookie()[0];
    if (set) {
      assert.match(set,/HttpOnly; SameSite=Strict; .*; Secure$/);
      c.cookie = set.split(';')[0];
    }
    const result = await res.json();
    if (result.csrf) c.csrf = result.csrf;
    return { status: res.status, ...result };
  }
  const sent = [];
  const transport = async (endpoint, {headers,method,body,signal,redirect}) => {
    assert.equal(endpoint,'https://api.resend.com/emails');
    assert.equal(method,'POST');
    assert.equal(redirect,'error');
    assert.ok(signal);
    assert.equal(headers.authorization,'Bearer re_test_only');
    const payload = JSON.parse(body);
    sent.push({ key:headers['idempotency-key'], payload });
    if (sent.length === 1) return new Response(null,{ status:503, headers:{'Retry-After':'10'} });
    if (sent.length === 2) throw new Error('fixture timeout');
    return new Response(null,{ status:200 });
  };
  const sender = createCustomerMail(db, config.customerMail, transport);
  const otherSender = createCustomerMail(replica, config.customerMail, transport);
  const mail = async (email, purpose) => {
    await Promise.all([sender.tick(),otherSender.tick()]);
    if (sent.length === 1) {
      assert.equal((await db.query('SELECT attempts,outcome FROM customer_mail_jobs')).rows[0].outcome,null);
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_mail_jobs WHERE next_at>now()')).rows[0].n,1);
      for (let i=0;i<2;i++) {
        await db.query('UPDATE customer_mail_jobs SET next_at=now()');
        await Promise.all([sender.tick(),otherSender.tick()]);
      }
      assert.equal(sent.length,3);
      assert.deepEqual(sent[0],sent[1]);
      assert.deepEqual(sent[0],sent[2]);
    }
    const delivered = sent.at(-1).payload;
    assert.deepEqual(delivered.to,[email]);
    assert.match(delivered.subject, {verify:/Confirm/,reset:/Reset/,invite:/Join/}[purpose]);
    const code = /Code: ([a-zA-Z0-9_-]{43})/.exec(delivered.text)[1];
    assert.ok(delivered.html.includes(code));
    const rows = await db.query('SELECT to_jsonb(j)::text AS data FROM customer_mail_jobs j');
    assert.equal(rows.rows.length,1);
    assert.ok(rows.rows.every(job => !job.data.includes(code)));
    assert.equal((await db.query('SELECT outcome FROM customer_mail_jobs')).rows[0].outcome,'accepted');
    return code;
  };
  const secret = 'local fixture password 1';
  async function signup(c,email) {
    assert.equal((await account(c,'register',{email})).status,202);
    assert.equal((await account(c,'login',{email,password:secret})).status,401);
    assert.equal((await account(c,'register',{email})).status,202);
    const code = await mail(email,'verify');
    const checks = await Promise.all([account(c,'verify',{code,password:secret}),
      account(customer(),'verify',{code,password:secret})]);
    assert.deepEqual(checks.map(result => result.status).sort(),[200,400]);
    assert.equal((await account(c,'login',{email,password:secret})).status,200);
    return account(c,'session');
  }
  const owner = customer(), viewer = customer();
  const ownerEmail = 'owner@example.test', viewerEmail = 'viewer@example.test';
  assert.equal((await signup(owner, ownerEmail)).role,null);
  assert.equal((await call(owner,'/v1/devices')).status,403);
  assert.equal((await account(owner,'company',{name:'Northfreight'}, {headers:{'x-csrf-token':''}})).status,403);
  assert.equal((await account(owner,'company',{name:'Northfreight'})).status,200);
  const a = await account(owner,'session');
  assert.equal(a.role,'owner');
  assert.equal((await account(owner,'device',{label:'Test-only cargo device'})).status,201);
  const device = (await call(owner,'/v1/devices')).devices[0];
  assert.equal((await signup(viewer,viewerEmail)).role,null);
  assert.equal((await account(viewer,'company',{name:'Other company'})).status,200);
  const b = await account(viewer,'session');
  assert.equal((await call(viewer,'/v1/devices/'+device.id)).status,404);
  assert.equal((await account(viewer,'switch',{company:a.tenant_id})).status,404);
  let cards;
  const captureCards = async value => { cards = value; };
  const inventory = [{ serial:'TEST-GL110', device_id_bcd:'199999999999' }];
  await assert.rejects(provisionDevices(db, inventory, async () => { throw new Error('export failed'); }), /export failed/);
  assert.equal((await db.query('SELECT * FROM device_activation_inventory')).rowCount,0);
  assert.equal(await provisionDevices(db, inventory, captureCards),1);
  const original = cards[0].code;
  await administerActivation(db,'rotate',inventory[0].serial,captureCards);
  const activation = { serial:cards[0].serial,code:cards[0].code,label:'Unreported GL110' };
  assert.equal(a.device_activation,true);
  assert.equal((await account(owner,'activate-device',activation,{headers:{'x-csrf-token':''}})).status,403);
  const expired = await account(owner,'activate-device',{...activation,code:original});
  assert.equal(expired.status,400);
  const claims = await Promise.all([account(owner,'activate-device',activation),account(viewer,'activate-device',activation)]);
  assert.deepEqual(claims.map(result => result.status).sort(),[201,400]);
  assert.deepEqual(claims.find(result => result.status===400),expired);
  const {rows:[claim]} = await db.query('SELECT * FROM device_activation_inventory');
  const [winner,loser] = claims[0].status===201 ? [owner,viewer] : [viewer,owner];
  assert.equal((await call(winner,'/v1/devices/'+claim.device_id)).status,200);
  assert.equal((await call(loser,'/v1/devices/'+claim.device_id)).status,404);
  assert.equal((await call(winner,'/v1/devices')).devices.find(row=>row.id===claim.device_id).serial,activation.serial);
  assert.equal((await account(loser,'rename-device',{device_id:claim.device_id,label:'Cross-company edit'})).status,404);
  assert.equal((await account(winner,'rename-device',{device_id:claim.device_id,label:'Unauthorized edit'},
    {headers:{'x-csrf-token':''}})).status,403);
  assert.equal((await account(winner,'rename-device',{device_id:claim.device_id,label:'Renamed tracker'})).status,200);
  assert.equal((await call(winner,'/v1/devices/'+claim.device_id)).label,'Renamed tracker');

  assert.equal(claim.activation_sha256,null);
  assert.deepEqual(await account(winner,'activate-device',activation),expired);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM telemetry_aovx_device_bindings WHERE device_id=$1',
    [claim.device_id])).rows[0].n,1);

  await db.query('DELETE FROM customer_rate_buckets');
  assert.equal((await account(owner,'invite',{email:viewerEmail,role:'viewer'})).status,200);
  const earlier = {...viewer};
  assert.equal((await account(viewer,'accept',{code:await mail(viewerEmail,'invite')})).status,200);
  assert.equal((await call(earlier,'/v1/session')).status,401);
  const invited = await account(viewer,'session');
  assert.equal(invited.role,'viewer');
  assert.equal(invited.device_activation,false);
  assert.equal((await account(viewer,'rename-device',{device_id:device.id,label:'Viewer edit'})).status,403);
  assert.equal((await account(viewer,'activate-device',activation)).status,403);
  assert.equal((await call(viewer,'/v1/devices/'+device.id)).status,200);
  assert.equal((await call(viewer,'/v1/shipments',{})).status,403);
  assert.equal((await account(viewer,'members')).status,403);
  assert.equal((await account(owner,'member',{member:invited.account_id,role:'dispatcher'})).status,200);
  assert.deepEqual((await call(viewer,'/v1/session')).scopes,['read','shipments']);
  assert.equal((await account(owner,'member',{member:invited.account_id,role:'admin'})).status,200);
  assert.equal((await account(viewer,'members')).members.length,2);
  assert.equal((await account(viewer,'member',{member:a.account_id,role:'viewer'})).status,403);
  assert.equal((await call(viewer,'/v1/proof-publisher/policy',{})).status,403);
  assert.equal((await account(viewer,'switch',{company:b.tenant_id})).status,200);
  assert.equal((await account(viewer,'session')).role,'owner');
  assert.equal((await call(viewer,'/v1/devices/'+device.id)).status,404);
  assert.equal((await account(owner,'member',{member:invited.account_id,role:null})).status,200);
  assert.equal((await account(viewer,'switch',{company:a.tenant_id})).status,404);
  assert.equal((await call(owner,'/v1/session',undefined,{method:'DELETE'})).status,200);
  assert.equal((await call(owner,'/v1/session')).status,401);
  await db.query('DELETE FROM customer_rate_buckets');
  assert.deepEqual(await account(viewer,'recover',{email:viewerEmail}),
    await account(customer(),'recover',{email:'nonexistent@example.test'}));
  assert.equal((await account(viewer,'recover',{email:viewerEmail})).status,202);
  const recovery = await mail(viewerEmail,'reset');
  assert.equal((await account(viewer,'reset',{code:recovery,password:'changed fixture password'})).status,200);
  assert.equal((await call(viewer,'/v1/session')).status,401);
  assert.equal((await account(viewer,'login',{email:viewerEmail,password:'changed fixture password'})).status,200);

  assert.equal((await account(customer(),'register',{email:'rejection@example.test'})).status,202);
  let rejected = 0;
  const permanentFailure = createCustomerMail(replica, config.customerMail, async () => {
    rejected++;
    return new Response(null,{status:422});
  });
  await permanentFailure.tick();
  await permanentFailure.tick();
  assert.equal(rejected,1);
  assert.equal((await db.query("SELECT outcome FROM customer_mail_jobs")).rows[0].outcome,'rejected');
  assert.equal((await account(customer(),'register',{email:'expired@example.test'})).status,202);
  await db.query("UPDATE customer_mail_tokens SET expires_at=now() WHERE email='expired@example.test'");
  await permanentFailure.tick();
  assert.equal(rejected,1);
  assert.equal((await db.query("SELECT outcome FROM customer_mail_jobs j JOIN customer_mail_tokens t USING(token_hash) WHERE t.email='expired@example.test'")).rows[0].outcome,'expired');

  // The same database counter is enforced by different replica pools.
  const emailRate = await Promise.allSettled(Array.from({length:8},(_,i) =>
    takeCustomerRate(i%2 ? db : replica,'email:login:replica-fixture',5)));
  assert.equal(emailRate.filter(result => result.status === 'fulfilled').length,5);
  assert.ok(emailRate.filter(result => result.status === 'rejected').every(result => result.reason.status === 429));
  await db.query('DELETE FROM customer_rate_buckets');
  for (let i=0;i<30;i++) await limitCustomerRequest(i%2 ? db : replica,{
    socket:{remoteAddress:'192.0.2.20'},headers:{'x-forwarded-for':'198.51.100.' + i}
  });
  await assert.rejects(limitCustomerRequest(replica,{
    socket:{remoteAddress:'192.0.2.20'},headers:{'x-forwarded-for':'203.0.113.20'}
  }),{status:429});
});
