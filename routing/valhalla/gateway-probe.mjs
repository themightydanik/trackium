/* Executed within the disposable Gateway service, never against production. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { request } from 'node:http';
import pg from 'pg';
import { provisionTenant } from './src/telemetry/service.js';
import { randomUUID, createHash } from 'node:crypto';

const origin = process.env.PUBLIC_ORIGIN;
const endpoint = 'http://127.0.0.1:' + process.env.HTTP_PORT;
const profile = process.argv[2] ?? 'fixture';
const routePath = '/v1/routes/calculate';
const point = (latitude, longitude) => ({latitude, longitude});
const fixture = {origin:point(48,11.001), destination:point(48,11.039), profile:'auto'};
const truck = {height_m:3.9,width_m:2.5,length_m:16,weight_t:35,axle_load_t:10};
const kyiv = point(50.45036,30.52475), lviv = point(49.84112,24.02999), warsaw = point(52.23119,21.00658);
const paris = point(48.85696,2.35086);

async function call(session, path, data, overrides = {}) {
  const body = data === undefined ? undefined : JSON.stringify(data);
  const {response,payload} = await new Promise((resolve,reject) => {
    const req = request(endpoint + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        host:new URL(origin).host, origin, 'sec-fetch-site':'same-origin',
        'x-trackium-client':'cargo-v2', cookie:session.cookie ?? '',
        'x-csrf-token':session.csrf ?? '', 'content-type':'application/json',
        ...(body && {'content-length':Buffer.byteLength(body)}), ...overrides
      }
    }, async response => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve({response,payload:JSON.parse(Buffer.concat(chunks))});
      } catch (error) { reject(error); }
    });
    req.setTimeout(15000, () => req.destroy(new Error('Gateway probe timed out')));
    req.on('error', reject);
    req.end(body);
  });
  const setCookie = response.headers['set-cookie']?.[0];
  if (setCookie) session.cookie = setCookie.split(';')[0];
  if (payload.csrf) session.csrf = payload.csrf;
  return {status: response.statusCode, payload};
}

async function mail(email, purpose) {
  for (const name of await readdir(process.env.ACCOUNT_MAIL_DIRECTORY)) {
    if (!name.endsWith('.json')) continue;
    const message = JSON.parse(await readFile(join(process.env.ACCOUNT_MAIL_DIRECTORY,name),'utf8'));
    if (message.email === email && message.purpose === purpose) return message.code;
  }
  throw new Error('Expected local test mail');
}

async function customer() {
  const email = randomUUID() + '@example.test', password = 'routing disposable account fixture';
  const session = {};
  assert.equal((await call(session,'/v1/account/register',{email})).status,202);
  assert.equal((await call(session,'/v1/account/verify',{code:await mail(email,'verify'),password})).status,200);
  assert.equal((await call(session,'/v1/account/login',{email,password})).status,200);
  const {status} = await call(session,'/v1/account/session');
  assert.equal(status,200);
  assert.equal((await call(session,'/v1/account/company',{name:'Disposable routing review'})).status,200);
  assert.equal((await call(session,'/v1/account/session')).payload.role,'owner');
  return {session,email};
}

assert.equal((await call({},'/readyz')).status,200);
assert.equal((await call({},'/readyz/routing')).status,200);
const {session: owner} = await customer();
assert.equal((await call({},routePath,fixture)).status,401);
assert.equal((await call({...owner},routePath,fixture,{'x-csrf-token':''})).status,403);
assert.equal((await call({...owner},routePath,fixture,{origin:'http://example.test'})).status,403);
assert.ok([401,403].includes((await call({...owner},routePath,fixture,{authorization:'Bearer invalid'})).status));
const {session: other,email} = await customer();
const otherCompany = (await call(other,'/v1/account/session')).payload.tenant_id;
assert.equal((await call(owner,'/v1/account/switch',{company:otherCompany})).status,404);
assert.equal((await call(owner,routePath,{...fixture, tenant_id:otherCompany})).payload.code,'INVALID_REQUEST');

const rows = [];
async function calculate(name, input, actor = owner) {
  const {status,payload} = await call(actor,routePath,input);
  assert.equal(status,200,JSON.stringify({name,status,code:payload.code}));
  assert.equal(payload.graph.id,process.env.ROUTING_GRAPH_RELEASE_ID);
  assert.equal(payload.graph.engine_version,'3.6.3');
  assert.equal(payload.profile,input.profile);
  assert.ok(payload.route.distance_m > 0 && payload.route.estimated_duration_s > 0);
  assert.ok(payload.route.legs.every(leg => leg.shape && leg.maneuvers.length));
  assert.deepEqual(payload.alternatives,{status:'unsupported',routes:[]});
  rows.push({name,profile:payload.profile,graph:payload.graph,
    distance_m:payload.route.distance_m,estimated_duration_s:payload.route.estimated_duration_s,
    legs:payload.route.legs.length,warnings:payload.warnings});
  return payload;
}

if (profile === 'fixture') {
  const car = await calculate('synthetic car',fixture);
  const hgv = await calculate('synthetic truck detour',{...fixture,profile:'truck',truck});
  assert.ok(hgv.route.distance_m > car.route.distance_m);
  assert.deepEqual(hgv.truck,truck);
  const closed = await call(owner,routePath,{...fixture,destination:point(48,11.085)});
  assert.equal(closed.status,422);
  assert.equal(closed.payload.code,'ROUTE_NOT_FOUND');
  const distant = await call(owner,routePath,{...fixture,destination:point(49,11)});
  assert.equal(distant.payload.code,'COVERAGE_UNAVAILABLE');
  const large = await call(owner,routePath,{...fixture,extra:'x'.repeat(9000)});
  assert.equal(large.status,413);
  assert.equal((await call(owner,routePath,{...fixture,waypoints:Array(9).fill(fixture.origin)})).payload.code,'INVALID_WAYPOINTS');
  assert.equal((await call(owner,routePath,{...fixture,upstream:'ignored'})).payload.code,'INVALID_REQUEST');

  const db = new pg.Pool({connectionString:process.env.DATABASE_URL});
  const id = await call(owner,'/v1/session');
  const key = (kind, value) => 'routing:' + kind + ':' + createHash('sha256').update(value).digest('hex');
  const actorKey = key('actor',id.payload.account_id);
  const tenantKey = key('tenant',id.payload.tenant_id);
  async function fill(bucket, attempts) {
    await db.query(`INSERT INTO customer_rate_buckets(window_at,bucket,attempts)
      SELECT date_trunc('minute',now()) + slot * interval '1 minute',$1,$2 FROM generate_series(0,1) AS slot
      ON CONFLICT (window_at,bucket) DO UPDATE SET attempts=excluded.attempts`,[bucket,attempts]);
  }
  try {
    const key = await provisionTenant(db, 'Disposable scoped routing key');
    const bearer = {authorization:'Bearer ' + key.token};
    assert.equal((await call({},'/v1/shipments',undefined,bearer)).status,200);
    assert.equal((await call({},routePath,fixture,bearer)).status,403);
    await fill(actorKey,8);
    assert.equal((await call(owner,routePath,fixture)).payload.code,'ROUTING_RATE_LIMITED');
    await fill(actorKey,0);
    await fill(tenantKey,24);
    const tenantBlocked = await call(owner,routePath,fixture);
    assert.equal(tenantBlocked.status,429);
    assert.equal(tenantBlocked.payload.code,'ROUTING_RATE_LIMITED');
    assert.equal((await call(other,routePath,fixture)).status,200);
  } finally { await db.end(); }
} else {
  const cases = profile === 'ukraine' ? [
    ['Kyiv–Lviv',kyiv,lviv],['Lviv–Kyiv',lviv,kyiv],
    ['Lviv–Holohory',lviv,point(49.7627,24.7527),[point(49.25845,24.62936)]],
  ] : [
    ['Kyiv–Lviv',kyiv,lviv],['Lviv–Rzeszów',lviv,point(50.03741,22.00709)],
    ['Kyiv–Warsaw',kyiv,warsaw],['Odesa–Bucharest',point(46.48182,30.73715),point(44.43546,26.10097)],
    ['Berlin–Warsaw',point(52.51647,13.38055),warsaw],['Warsaw–Paris',warsaw,paris]
  ];
  for (const [name,origin,destination,waypoints] of cases)
    await calculate(name,{origin,destination,waypoints,profile:'auto'});
  await calculate('Truck', {origin:kyiv,destination:lviv,profile:'truck',truck}, other);
  if (profile === 'ukraine')
    assert.equal((await call(owner,routePath,{origin:kyiv,destination:paris,profile:'auto'})).payload.code,
      'COVERAGE_UNAVAILABLE');
}

assert.equal((await call(owner,'/v1/account/invite',{email,role:'viewer'})).status,200);
assert.equal((await call(other,'/v1/account/accept',{code:await mail(email,'invite')})).status,200);
assert.equal((await call(other,'/v1/account/session')).payload.role,'viewer');
assert.equal((await call(other,routePath,fixture)).status,403);
console.log(JSON.stringify({profile,routes:rows},null,2));
