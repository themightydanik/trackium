import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');
test('Customer accounts verify, recover, revoke, manage company roles and rotate between isolated companies', async t => {
  const directory = await mkdtemp(join(tmpdir(),'trackium-mail-'));
  const schema = 'accounts_' + randomUUID().replaceAll('-','');
  const admin = new pg.Pool({ connectionString: url });
  const db = new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
  await admin.query('CREATE SCHEMA ' + schema);
  const listener = createServer().listen(0,'127.0.0.1');
  await once(listener,'listening');
  const httpPort = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = 'http://127.0.0.1:' + httpPort;
  const config = readConfig({ DATABASE_URL: url, ENABLE_WEB_WORKSPACE:'true', ENABLE_TCP_RECEIVER:'false',
    PUBLIC_ORIGIN: origin, HTTP_PORT: String(httpPort), ACCOUNT_MAIL_DIRECTORY: directory });
  const { gateway } = createRuntime(db, { ...config, host:'127.0.0.1' }, { worker:false, logger:{ info(){}, error(){} } });
  t.after(async () => {
    await gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
    await rm(directory,{ recursive:true, force:true });
  });
  await gateway.start();
  const customer = () => ({ cookie:'', csrf:'' });
  const account = (c, action, data, options) => call(c,'/v1/account/'+action,data,options);
  async function call(c, path, data, { headers = {}, method = data === undefined ? 'GET' : 'POST' } = {}) {
    const res = await fetch(origin + path, {
      method, headers: { 'X-Trackium-Client':'cargo-v2', 'sec-fetch-site':'same-origin',
        origin, cookie:c.cookie, 'x-csrf-token':c.csrf, 'content-type':'application/json', ...headers },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    const set = res.headers.getSetCookie()[0];
    if (set) {
      assert.match(set,/HttpOnly; SameSite=Strict/);
      c.cookie = set.split(';')[0];
    }
    const result = await res.json();
    if (result.csrf) c.csrf = result.csrf;
    return { status: res.status, ...result };
  }
  const mail = async (email, purpose) => {
    const entries = await Promise.all((await readdir(directory)).map(file =>
      readFile(join(directory,file),'utf8').then(JSON.parse)));
    const matches = entries.filter(m => m.email === email && m.purpose === purpose);
    assert.equal(matches.length,1);
    return matches[0].code;
  };
  const secret = 'local fixture password 1';
  async function signup(c,email) {
    assert.equal((await account(c,'register',{email})).status,202);
    assert.equal((await account(c,'login',{email,password:secret})).status,401);
    assert.equal((await account(c,'verify',{code:await mail(email,'verify'),password:secret})).status,200);
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
  assert.equal((await account(owner,'invite',{email:viewerEmail,role:'viewer'})).status,200);
  const earlier = {...viewer};
  assert.equal((await account(viewer,'accept',{code:await mail(viewerEmail,'invite')})).status,200);
  assert.equal((await call(earlier,'/v1/session')).status,401);
  const invited = await account(viewer,'session');
  assert.equal(invited.role,'viewer');
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
  assert.equal((await account(viewer,'recover',{email:viewerEmail})).status,202);
  const recovery = await mail(viewerEmail,'reset');
  assert.equal((await account(viewer,'reset',{code:recovery,password:'changed fixture password'})).status,200);
  assert.equal((await call(viewer,'/v1/session')).status,401);
  assert.equal((await account(viewer,'login',{email:viewerEmail,password:'changed fixture password'})).status,200);
});
