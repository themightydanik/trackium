import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, chmod, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { createPasswordDigest } from '../src/cargo/accounts.js';
import { createIntegritas } from '../src/proofs/integritas.js';
import { administerDemo } from '../src/cargo/demo-admin.js';
import { initialize } from '../src/journal.js';
import { hash } from '../src/cargo/shared.js';
import { migrate } from '../src/telemetry/migrate.js';
import { provisionTenant } from '../src/telemetry/service.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');

test('Demo CLI creates one synthetic Viewer and rotates and disables access without email', async t => {
  const schema = 'demo_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query('CREATE SCHEMA ' + schema);
  const scoped = new URL(url);
  scoped.searchParams.set('options', '-c search_path=' + schema);
  const connection = { connectionString: scoped.href };
  const directory = await mkdtemp(join(tmpdir(),'trackium-demo-'));
  const secret = join(directory,'secret'), next = join(directory,'rotation'), insecure = join(directory,'insecure');
  const pass = 'random local fixture password', rotated = 'new random local fixture password';
  await writeFile(secret,pass + '\n',{mode:0o600});
  await writeFile(next,rotated + '\n',{mode:0o600});
  await writeFile(insecure,pass,{mode:0o644});
  await chmod(insecure,0o644);
  let runtime, db, origin, publicOrigin;
  async function start(enabled) {
    if (runtime) await runtime.gateway.shutdown();
    db = new pg.Pool(connection);
    const listener = createServer().listen(0,'127.0.0.1');
    await once(listener,'listening');
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    origin = 'http://127.0.0.1:' + port;
    publicOrigin = origin.replace('http:', 'https:');
    const config = readConfig({ DATABASE_URL:scoped.href, ENABLE_WEB_WORKSPACE:'true', ENABLE_TCP_RECEIVER:'false',
      PUBLIC_ORIGIN:publicOrigin, HTTP_PORT:String(port), INTEGRITAS_MODE:'test',
      CUSTOMER_DEMO_ENABLED:String(enabled) });
    runtime = createRuntime(db,{...config,host:'127.0.0.1'}, {worker:false,logger:{info(){},error(){}}});
    await runtime.gateway.start();
  }
  t.after(async () => {
    await runtime?.gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
    await rm(directory,{recursive:true,force:true});
  });
  await start(true);
  const cli = (...args) => promisify(execFile)(process.execPath,
    ['src/cargo/demo-cli.js', ...args], { env:{...process.env,DATABASE_URL:scoped.href} });
  await assert.rejects(cli('bootstrap','--password-file='+insecure), /owner-only/);
  const args = ['bootstrap','--password-file='+secret];
  const [a,b] = await Promise.all([cli(...args),cli(...args)]);
  assert.deepEqual([a,b].map(result => JSON.parse(result.stdout).status).sort(),['already-present','created']);
  await assert.rejects(cli('bootstrap','--email=second@example.test','--password-file='+secret), /Unknown or malformed option/);
  const { rows:[demo] } = await db.query('SELECT * FROM customer_demo');
  const other = await provisionTenant(db,'Private fixture company');
  const privateDevice = await runtime.telemetry.register(other.tenant_id,{label:'Invisible fixture',mode:'real'});
  await db.query("INSERT INTO customer_accounts(id,email,password_digest,verified_at) VALUES($1,'ordinary@example.test',$2,now())",
    [randomUUID(),await createPasswordDigest(pass)]);
  const proofs = createIntegritas(db);
  for (let i=0;i<6;i++) await proofs.tick();
  const call = async (path, { data, method = data === undefined ? 'GET' : 'POST', cookie, csrf, extra = {} } = {}) => {
    const response = await fetch(origin + path,{method,headers:{
      'X-Trackium-Client':'cargo-v2','sec-fetch-site':'same-origin',origin:publicOrigin,
      'content-type':'application/json', ...(cookie && {cookie}), ...(csrf && {'x-csrf-token':csrf}), ...extra
    },body:data === undefined ? undefined : JSON.stringify(data)});
    return { status:response.status, data:await response.json(),
      cookie:response.headers.getSetCookie()[0]?.split(';')[0], set:response.headers.getSetCookie()[0] };
  };
  const login = (password, username = 'trackium-demo') => call('/v1/account/login',{data:{username,password}});
  const creds = async (password) => {
    const result = await login(password);
    assert.equal(result.status,200);
    assert.match(result.set,/HttpOnly; SameSite=Strict; .*; Secure$/);
    const session = await call('/v1/session',{cookie:result.cookie});
    return { cookie:result.cookie, csrf:session.data.csrf, session:session.data };
  };
  assert.equal((await login(pass,'ordinary@example.test')).status,401);
  assert.equal((await login(pass,'demo@trackium.invalid')).status,401);
  assert.equal((await call('/v1/account/login',{data:{email:'demo@trackium.invalid',password:pass}})).status,400);
  assert.equal((await call('/v1/account/register',{data:{email:'public@example.test'}})).status,404);
  assert.equal((await call('/v1/account/recover',{data:{email:'demo@example.test'}})).status,404);
  const logged = await creds(pass);
  assert.equal(logged.session.role,'viewer');
  assert.equal(logged.session.email,undefined);
  assert.deepEqual(logged.session.scopes,['read']);
  assert.equal(logged.session.tenant_id,demo.tenant_id);
  assert.equal(logged.session.company_name,'Trackium Demo');
  const data = await call('/v1/shipments',logged);
  assert.equal(data.data.shipments.length,2);
  assert.ok(data.data.shipments.every(row => row.source_trust === 'synthetic' && row.route.length>=2));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM telemetry_events WHERE tenant_id=$1',[demo.tenant_id])).rows[0].n,0);
  assert.equal((await call('/v1/devices/'+privateDevice.id,logged)).status,404);
  assert.equal((await call('/v1/account/switch',{...logged,data:{company:other.tenant_id}})).status,404);
  assert.equal((await call('/v1/account/company',{...logged,data:{name:'Undesired'}})).status,404);
  assert.equal((await call('/v1/shipments',{...logged,data:{}})).status,403);
  assert.equal((await call('/v1/proof-publisher',logged)).status,404);
  assert.equal((await call('/v1/shipments/'+data.data.shipments[0].id+'/proofs',logged)).status,404);
  const results = await call('/v1/integritas/proofs',logged);
  assert.equal(results.data.proofs.length,2);
  assert.ok(results.data.proofs.every(p => p.status === 'verified' && p.verification === 'TEST_ONLY' && p.on_chain_verified === false));
  assert.equal((await call('/v1/integritas/proofs',{...logged,data:{}})).status,403);
  assert.equal((await call('/v1/integritas/proofs/'+results.data.proofs[0].id+'/verify',{cookie:logged.cookie,data:{}})).status,403);
  assert.equal((await call('/v1/integritas/proofs/'+results.data.proofs[0].id+'/verify',{...logged,data:{}})).status,200);
  const lite = await (await fetch(origin+'/app/')).text();
  const core = await (await fetch(origin+'/app/core')).text();
  assert.match(lite,/data-customer-demo="true"/);
  assert.doesNotMatch(core,/data-customer-demo/);

  // An independently approved Core browser session still uses its own tenant.
  const challenge = await call('/v1/pairing/challenges',{data:{tenant_id:other.tenant_id}});
  assert.equal(challenge.status,201);
  const approval = await call('/v1/pairing/challenges/'+challenge.data.id+'/approve',{
    extra:{authorization:'Bearer '+other.token},data:{scopes:['read']}
  });
  assert.equal(approval.status,200);
  const paired = await call('/v1/pairing/session',{method:'POST',cookie:challenge.cookie});
  assert.equal(paired.status,201);
  const both = logged.cookie + '; ' + paired.cookie;
  const coreRequest = {cookie:both,extra:{'x-trackium-workspace':'pairing'}};
  assert.equal((await call('/v1/session',coreRequest)).data.tenant_id,other.tenant_id);
  assert.equal((await call('/v1/proof-publisher',coreRequest)).status,200);
  assert.equal((await call('/v1/session',{cookie:both})).data.tenant_id,demo.tenant_id);
  assert.equal((await call('/v1/proof-publisher',{cookie:both})).status,404);

  await cli('revoke');
  assert.equal((await call('/v1/session',logged)).status,401);
  await cli('rotate','--password-file='+next);
  assert.equal((await call('/v1/session',logged)).status,401);
  assert.equal((await login(pass)).status,401);
  const renewed = await creds(rotated);
  await cli('disable');
  assert.equal((await call('/v1/session',renewed)).status,401);
  assert.equal((await login(rotated)).status,401);
  await cli('enable');
  const last = await creds(rotated);
  await start(false);
  assert.doesNotMatch(await (await fetch(origin+'/app/')).text(), /data-customer-demo/);
  assert.equal((await call('/v1/session',last)).status,401);
});

test('Migration 014 updates the existing 013 demo without replacing its evidence or company', async t => {
  const schema = 'demo_upgrade_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({connectionString:url});
  await admin.query('CREATE SCHEMA ' + schema);
  const db = new pg.Pool({connectionString:url,options:'-c search_path=' + schema});
  t.after(async () => {
    await db.end();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await initialize(db);
  const directory = new URL('../migrations/',import.meta.url);
  const files = (await readdir(directory)).filter(file => /^01[0-3]_|^00[1-9]_/.test(file)).sort();
  assert.equal(files.length,13);
  await db.query('CREATE TABLE gateway_schema_migrations(version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const [index,file] of files.entries()) {
    const sql = await readFile(new URL(file,directory),'utf8');
    await db.query(sql);
    await db.query('INSERT INTO gateway_schema_migrations(version,checksum) VALUES($1,$2)',[index+1,hash(sql)]);
  }
  await administerDemo(db,'bootstrap',{password:'migration fixture password'});
  const {rows:[before]} = await db.query('SELECT * FROM customer_demo');
  const snapshot = async () => {
    const tables = ['customer_accounts','customer_members','telemetry_tenants','cargo_shipments','cargo_events','cargo_integritas_requests','cargo_integritas_states'];
    return Promise.all(tables.map(table => db.query('SELECT to_jsonb(t) AS row FROM '+table+' t ORDER BY 1').then(result => result.rows)));
  };
  const regularId = randomUUID();
  await db.query("INSERT INTO customer_accounts(id,email,password_digest) VALUES($1,'ordinary@example.test','fixture')",[regularId]);
  await db.query('INSERT INTO customer_sessions(id,account_id,tenant_id,token_hash) VALUES($1,$2,$3,$4),($5,$6,NULL,$7)',
    [randomUUID(),before.account_id,before.tenant_id,hash('prior demo cookie'),randomUUID(),regularId,hash('ordinary cookie')]);
  const beforeUpgrade = await snapshot();
  assert.equal(beforeUpgrade[3].length,2);
  assert.equal(beforeUpgrade[5].length,2);
  await migrate(db);
  assert.deepEqual((await db.query('SELECT * FROM customer_demo')).rows,[{...before,username:'trackium-demo'}]);
  assert.deepEqual(await snapshot(),beforeUpgrade);
  assert.deepEqual((await db.query('SELECT account_id FROM customer_sessions')).rows,[{account_id:regularId}]);
  await db.query('INSERT INTO customer_sessions(id,account_id,tenant_id,token_hash) VALUES($1,$2,$3,$4)',
    [randomUUID(),before.account_id,before.tenant_id,hash('new demo cookie')]);
  await migrate(db);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM customer_sessions')).rows[0].n,2);
});
