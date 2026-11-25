/* Run from the private Gateway container in the disposable D3 Compose project. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import pg from 'pg';
import { administerDemo } from './src/cargo/demo-admin.js';
import { administerPilot } from './src/cargo/pilot-admin.js';
import { createTelemetryService } from './src/telemetry/service.js';

const origin = 'https://demo.example.test';
assert.equal(process.env.PUBLIC_ORIGIN, origin);
assert.equal(process.env.RAILWAY_ENVIRONMENT_ID, 'trackium-d3-disposable');
assert.ok(process.env.DATABASE_URL === 'postgres://trackium@db:5432/trackium');
assert.equal(process.env.DEPLOYMENT_PROFILE, 'railway-demo');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const endpoint = 'http://127.0.0.1:' + process.env.HTTP_PORT;
let cookie = '', csrf = '';
async function call(path, input, expected, {anonymous = false, omitCsrf = false} = {}) {
  const body = input === undefined ? undefined : JSON.stringify(input);
  const {status, headers, raw} = await new Promise((resolve, reject) => {
    const req = request(endpoint + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers:{host:new URL(origin).host, origin, 'sec-fetch-site':'same-origin',
        'x-trackium-client':'cargo-v2', cookie:anonymous ? '' : cookie,
        'x-csrf-token':omitCsrf ? '' : csrf,
        ...(body && {'content-type':'application/json', 'content-length':Buffer.byteLength(body)})}
    }, async res => {
      try {
        const list = [];
        for await (const chunk of res) list.push(chunk);
        resolve({status:res.statusCode, headers:res.headers, raw:Buffer.concat(list).toString()});
      } catch (error) { reject(error); }
    });
    req.setTimeout(15000, () => req.destroy(new Error('Demo probe request timed out')));
    req.on('error', reject);
    req.end(body);
  });
  assert.equal(status, expected, path);
  if (headers['set-cookie']) {
    assert.match(headers['set-cookie'][0], /HttpOnly; SameSite=Strict; .*; Secure$/);
    cookie = headers['set-cookie'][0].split(';')[0];
  }
  const result = raw ? JSON.parse(raw) : null;
  if (result?.csrf) csrf = result.csrf;
  return result;
}
const login = password => call('/v1/account/login', {username:'trackium-demo', password}, 200);
const point = (latitude, longitude) => ({latitude, longitude});
const originPoint = point(49.84112,24.02999);
const waypoint = point(49.783,22.77);
const destination = point(50.03741,22.00709);
const auto = {origin:originPoint, destination, waypoints:[waypoint], profile:'auto'};
const truck = {...auto, profile:'truck', truck:{height_m:3.9,width_m:2.5,length_m:16,weight_t:35,axle_load_t:10}};
try {
  await call('/readyz/routing', undefined, 200);
  await call('/v1/account/register', {email:'unused@example.test'}, 404);
  await call('/v1/routes/calculate',auto,401,{anonymous:true});
  const viewerPassword = randomUUID(), ownerPassword = randomUUID();
  assert.equal((await administerDemo(pool,'bootstrap',{password:viewerPassword})).status,'created');
  await login(viewerPassword);
  const viewer = await call('/v1/account/session',undefined,200);
  assert.equal(viewer.role,'viewer');
  await call('/v1/routes/calculate',auto,403);
  await administerPilot(pool,'promote',{
    name:'Disposable D3 company', identifiers:[], transferOnly:true, password:ownerPassword
  });
  await call('/v1/account/session',undefined,401);
  await login(ownerPassword);
  const owner = await call('/v1/account/session',undefined,200);
  assert.equal(owner.role,'owner');
  assert.equal(owner.companies.length,1);
  const archive = await pool.query('SELECT id FROM cargo_shipments WHERE tenant_id=$1 LIMIT 1',[viewer.tenant_id]);
  await call('/v1/shipments/'+archive.rows[0].id+'/road-routes',undefined,404);
  const device = await createTelemetryService(pool).register(owner.tenant_id,{label:'Unbound D3 registry',mode:'real'});
  assert.equal((await call('/v1/devices/'+device.id+'/location',undefined,200)).location,null);
  const shipment = await call('/v1/shipments',{name:'D3 planning only',device_id:device.id,
    route:[{...originPoint,name:'Lviv'},{...waypoint,name:'Przemyśl'},{...destination,name:'Rzeszów'}],
    conditions:{temperature_min_c:0,temperature_max_c:10}},201);
  await call('/v1/routes/calculate',auto,403,{omitCsrf:true});
  const path = '/v1/shipments/'+shipment.id+'/road-routes';
  for (const [index,calculation] of [auto,truck].entries()) {
    const result = await call('/v1/routes/calculate',calculation,200);
    assert.equal(result.profile,calculation.profile);
    assert.equal(result.graph.id,process.env.ROUTING_GRAPH_RELEASE_ID);
    assert.equal(result.graph.engine_version,'3.6.3');
    assert.ok(result.route.distance_m > 0 && result.route.estimated_duration_s > 0);
    assert.equal(result.route.legs.length,2);
    assert.ok(result.route.legs.every(leg => leg.shape && leg.maneuvers.length));
    const generation = index*3;
    const payload = {expected_generation:generation,request_id:randomUUID(),calculation};
    const {revision} = await call(path,payload,201);
    assert.equal((await call(path,payload,200)).replayed,true);
    await call(path+'/'+revision.id+'/approve',{expected_generation:generation+1},200);
    await call(path+'/'+revision.id+'/activate',{expected_generation:generation+2},200);
    console.log(JSON.stringify({profile:result.profile,graph:result.graph.id,
      distance_m:result.route.distance_m, duration_s:result.route.estimated_duration_s, legs:2}));
  }
  const history = await call(path,undefined,200);
  assert.equal(history.generation,6);
  assert.deepEqual(history.revisions.map(row => row.state).sort(),['active','superseded']);
  const [a,b] = history.revisions;
  await call(path+'/compare?base_revision='+a.id+'&target_revision='+b.id,undefined,200);
} finally {
  await pool.end();
}
