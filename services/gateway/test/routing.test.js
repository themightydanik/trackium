import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer as createTlsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { readConfig } from '../src/config.js';
import { decodeShape, MAX_RESPONSE, parseCalculation, providerRequest } from '../src/routing/contract.js';
import { createRouting, privateRoutingLookup, readRoutingConfig } from '../src/routing/service.js';

const start = {latitude: 0, longitude: 0};
const end = {latitude: 0, longitude: 0.001};
const input = {origin:start, destination:end, profile:'auto'};
const truck = {height_m:3.9,width_m:2.5,length_m:16,weight_t:35,axle_load_t:10};
const graphId = '1'.repeat(64);
const shape = '???o}@';
const summary = {length:0.11,time:20};
const trip = {
  status:0, units:'kilometers', summary,
  legs:[{shape, summary, maneuvers:[{type:1,travel_mode:'drive',travel_type:'car',instruction:'Continue',length:0.11,time:20,
    begin_shape_index:0,end_shape_index:1}]}]
};
const graphHeaders = {'content-type':'application/json','x-trackium-graph-id':graphId,
  'x-trackium-engine-version':'3.6.3','x-trackium-osm-snapshot':'2026-01-01'};
const identity = {account_id:'abc',tenant_id:'def'};
const status = {version:'3.6.3',has_tiles:true};

test('routing validates stops, profiles and dimensions before producing a fixed upstream request', () => {
  assert.deepEqual(providerRequest(parseCalculation({...input,profile:'truck',truck})), {
    locations:[{lat:0,lon:0,type:'break'},{lat:0,lon:0.001,type:'break'}],
    costing:'truck', units:'kilometers', shape_format:'polyline6',
    costing_options:{truck:{height:3.9,width:2.5,length:16,weight:35,axle_load:10}}
  });
  for (const [changes, code] of [
    [{destination:{...end,latitude:91}},'INVALID_COORDINATES'],
    [{destination:{...end,latitude:NaN}},'INVALID_COORDINATES'],
    [{destination:{...end,latitude:0.0000001}},'INVALID_COORDINATES'],
    [{destination:{...end,latitude:'0'}},'INVALID_COORDINATES'],
    [{destination:{...end,longitude:-180}},'INVALID_WAYPOINTS'],
    [{destination:start},'INVALID_WAYPOINTS'],
    [{waypoints:Array(9).fill(end)},'INVALID_WAYPOINTS'],
    [{profile:'bicycle'},'UNSUPPORTED_PROFILE'],
    [{profile:'truck',truck:{...truck,axle_load_t:31}},'INVALID_VEHICLE_DIMENSIONS'],
    [{profile:'truck'},'INVALID_VEHICLE_DIMENSIONS'],
    [{truck},'INVALID_VEHICLE_DIMENSIONS'],
    [{url:'http://valhalla:8002/status'},'INVALID_REQUEST']
  ]) assert.throws(() => parseCalculation({...input,...changes}), {routingCode:code});
  assert.deepEqual(decodeShape(shape), [start,end]);
  for (const malformed of ['', '?', shape + '\n', '~'.repeat(100), '?'.repeat(10)])
    assert.throws(() => decodeShape(malformed, 2), {routingCode:'ROUTING_RESPONSE_INVALID'});
});

test('routing requires paired fixed private operator configuration', () => {
  assert.equal(readRoutingConfig({}), null);
  for (const origin of ['http://169.254.169.254:80','http://8.8.8.8:80','http://user@valhalla:8002',
    'http://valhalla:8002/route','http://valhalla','http://valhalla:65536','https://valhalla:8002'])
    assert.throws(() => readRoutingConfig({ROUTING_VALHALLA_ORIGIN:origin,ROUTING_GRAPH_RELEASE_ID:graphId}));
  assert.throws(() => readRoutingConfig({ROUTING_VALHALLA_ORIGIN:'http://valhalla:8002'}));
});

test('Railway private lookup permits ULA and private IPv4 but rejects mixed public or local aliases', async () => {
  const origin = {ROUTING_VALHALLA_ORIGIN:'http://valhalla.railway.internal:8002', ROUTING_GRAPH_RELEASE_ID:graphId};
  assert.throws(() => readRoutingConfig(origin));
  assert.equal(readRoutingConfig({...origin, RAILWAY_ENVIRONMENT_ID:'test-id'}).railway, true);

  const lookupWith = (records, railway = true) => new Promise((resolve, reject) =>
    privateRoutingLookup(railway, (name, options, callback) => {
      assert.equal(name, 'valhalla.railway.internal');
      assert.deepEqual(options, {family:railway ? 0 : 4, all:true});
      callback(null, records);
    })('valhalla.railway.internal', {}, (err, address, family) =>
      err ? reject(err) : resolve({address, family})));
  const ula = {address:'fd12:3456::100', family:6};
  const lan = {address:'10.1.2.3', family:4};
  assert.deepEqual(await lookupWith([ula]), ula);
  assert.deepEqual(await lookupWith([lan, ula]), lan);
  for (const record of [
    {address:'2606:4700::1111', family:6}, {address:'fe80::1', family:6},
    {address:'::ffff:10.1.2.3', family:6}, {address:'::1', family:6},
    {address:'127.0.0.1', family:4}, {address:'169.254.169.254', family:4}
  ]) await assert.rejects(lookupWith([ula, record]), {routingCode:'ROUTING_UNAVAILABLE'});
  await assert.rejects(lookupWith([ula], false), {routingCode:'ROUTING_UNAVAILABLE'});
});

async function rig(t, handler, opts, pool = {query:async () => ({rows:[{attempts:2}]})}) {
  const server = createServer((req,res) => {
    req.resume();
    if (req.url === '/status') return res.writeHead(200,graphHeaders).end(JSON.stringify(status));
    handler(req,res);
  }).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return createRouting(readRoutingConfig({
    ROUTING_VALHALLA_ORIGIN:'http://127.0.0.1:' + server.address().port,
    ROUTING_GRAPH_RELEASE_ID:graphId
  }), pool, {}, opts);
}
const route = service => service.calculate(identity,parseCalculation(input));

test('routing normalizes and binds route responses after checking readiness', async t => {
  const service = await rig(t,(req,res) => {
    assert.equal(req.method,'POST');
    assert.equal(req.url,'/route');
    res.writeHead(200,graphHeaders).end(JSON.stringify({trip}));
  });
  const result = await route(service);
  assert.deepEqual(result.graph,{id:graphId,engine_version:'3.6.3',osm_snapshot:'2026-01-01'});
  assert.equal(result.route.distance_m,110);
  assert.equal(result.route.legs[0].shape,shape);
});

for (const [name, code, send] of [
  ['graph swap', 'GRAPH_RELEASE_MISMATCH', res => res.writeHead(200,{...graphHeaders,'x-trackium-graph-id':'2'.repeat(64)}).end('{}')],
  ['snapshot swap', 'GRAPH_RELEASE_MISMATCH', res => res.writeHead(200,{...graphHeaders,'x-trackium-osm-snapshot':'2026-01-02'}).end('{}')],
  ['engine swap', 'GRAPH_RELEASE_MISMATCH', res => res.writeHead(200,{...graphHeaders,'x-trackium-engine-version':'3.6.2'}).end('{}')],
  ['outage', 'ROUTING_UNAVAILABLE', res => res.writeHead(503).end()],
  ['oversized stream', 'ROUTING_RESPONSE_INVALID', res => res.writeHead(200,graphHeaders).end('x'.repeat(MAX_RESPONSE+1))],
  ['no path', 'ROUTE_NOT_FOUND', res => res.writeHead(400,graphHeaders).end('{"error_code":442}')],
  ['missing coverage', 'COVERAGE_UNAVAILABLE', res => res.writeHead(400,graphHeaders).end('{"error_code":171}')],
  ['timeout', 'ROUTING_TIMEOUT', () => {}],
  ['invalid maneuver', 'ROUTING_RESPONSE_INVALID', res => res.writeHead(200,graphHeaders).end(JSON.stringify({
    trip:{...trip,legs:[{...trip.legs[0],maneuvers:[{...trip.legs[0].maneuvers[0],end_shape_index:2}]}]}
  }))]
]) test('routing rejects ' + name, async t => {
  const service = await rig(t,(_req,res) => send(res),{totalMs:150});
  await assert.rejects(route(service),{routingCode:code});
});

test('routing never follows an upstream redirect', async t => {
  let calls = 0;
  const service = await rig(t,(_req,res) => {
    calls++;
    res.writeHead(302, {location:'/redirected'}).end();
  });
  await assert.rejects(route(service), {routingCode:'ROUTING_RESPONSE_INVALID'});
  assert.equal(calls,1);
});

test('routing rejects an auto response for a truck calculation', async t => {
  const service = await rig(t,(_req,res) => res.writeHead(200,graphHeaders).end(JSON.stringify({trip})));
  await assert.rejects(service.calculate(identity,parseCalculation({...input,profile:'truck',truck})),
    {routingCode:'ROUTING_RESPONSE_INVALID'});
});

test('routing concurrency and shared quota reject before calling the engine', async t => {
  let hit, release;
  const started = new Promise(resolve => { hit = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  let full = false;
  const keys = [];
  const service = await rig(t,async (_req,res) => {
    hit();
    await blocked;
    res.writeHead(200,graphHeaders).end(JSON.stringify({trip}));
  },{concurrency:1},{query:async (_sql,[key]) => {
    keys.push(key);
    return {rows:full ? [] : [{attempts:2}]};
  }});
  const first = route(service);
  await started;
  await assert.rejects(route(service),{routingCode:'ROUTING_RATE_LIMITED'});
  release();
  await first;
  assert.match(keys[0],/^routing:actor:[\da-f]{64}$/);
  assert.match(keys[1],/^routing:tenant:[\da-f]{64}$/);
  assert.equal(keys[2],'routing:global');
  full = true;
  await assert.rejects(route(service),{routingCode:'ROUTING_RATE_LIMITED'});
});


test('Oracle mTLS uses the fixed configured peer and authenticates both sides before routing', async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'trackium-routing-tls-'));
  t.after(() => rmSync(scratch,{recursive:true,force:true}));
  const pki = join(scratch,'pki');
  const script = fileURLToPath(new URL('../../../routing/valhalla/oracle/create-pki.sh', import.meta.url));
  execFileSync(script,[pki,'--local-test'],{stdio:'ignore'});
  const read = name => readFileSync(join(pki,name),'utf8');
  const env = {
    ROUTING_ORACLE_ORIGIN:'https://130.61.180.101:8443',
    ROUTING_ORACLE_SERVER_CA_PEM:read('server-ca.crt'),
    ROUTING_ORACLE_CLIENT_CERT_PEM:read('gateway.crt'),
    ROUTING_ORACLE_CLIENT_KEY_PEM:read('gateway.key'),
    ROUTING_GRAPH_RELEASE_ID:graphId
  };
  const pinned = readRoutingConfig(env);
  assert.equal(pinned.host,'130.61.180.101');
  assert.equal(pinned.port,8443);
  for (const profile of ['railway-public','railway-demo']) {
    const config = readConfig({...env, NODE_ENV:'production', DEPLOYMENT_PROFILE:profile,
      PUBLIC_ORIGIN:'https://gateway.example', DATABASE_URL:'postgres://unused',
      ENABLE_WEB_WORKSPACE:'true', ENABLE_NATIVE_CLIENTS:'true', ENABLE_TCP_RECEIVER:'false'});
    assert.ok(config.routing.oracleTls);
  }
  assert.equal(Object.values(pinned).includes(env.ROUTING_ORACLE_CLIENT_KEY_PEM),false);
  for (const origin of ['http://130.61.180.101:8443','https://130.61.180.101:8443/route',
    'https://oracle.example:8443','https://169.254.169.254:8443','https://127.0.0.1:8443'])
    assert.throws(() => readRoutingConfig({...env,ROUTING_ORACLE_ORIGIN:origin}));
  assert.throws(() => readRoutingConfig({...env,ROUTING_VALHALLA_ORIGIN:'http://valhalla:8002'}));
  assert.throws(() => readRoutingConfig({...env,ROUTING_ORACLE_CLIENT_KEY_PEM:''}));
  assert.throws(() => readRoutingConfig({...env,ROUTING_ORACLE_CLIENT_KEY_PEM:'invalid-secret'}), {
    message:'Invalid Oracle routing mTLS credentials'
  });

  const calls = [];
  let reply = 'success';
  const server = createTlsServer({
    ca:read('gateway-ca.crt'), cert:read('server.crt'), key:read('server.key'),
    requestCert:true, rejectUnauthorized:true
  }, (req,res) => {
    assert.equal(req.socket.authorized,true);
    calls.push(req.method+' '+req.url);
    req.resume();
    if (req.url === '/status') return res.writeHead(200,graphHeaders).end(JSON.stringify(status));
    if (reply === 'redirect') return res.writeHead(302,{location:'http://127.0.0.1/admin'}).end();
    if (reply === 'wrong graph') return res.writeHead(200,{...graphHeaders,'x-trackium-graph-id':'2'.repeat(64)}).end('{}');
    if (reply === 'down') return res.writeHead(503).end();
    res.writeHead(200,graphHeaders).end(JSON.stringify({trip}));
  }).listen(0,'0.0.0.0');
  await once(server,'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const pool = {query:async () => ({rows:[{attempts:2}]})};
  const service = (config = pinned, host = '127.0.0.1') => createRouting({
    ...config,host,port:server.address().port
  },pool,{});
  const good = service();
  assert.equal((await route(good)).graph.id,graphId);
  assert.deepEqual(calls,['GET /status','POST /route']);
  const untrusted = readRoutingConfig({...env,ROUTING_ORACLE_SERVER_CA_PEM:read('gateway-ca.crt')});
  const wrongClient = readRoutingConfig({...env,ROUTING_ORACLE_CLIENT_CERT_PEM:read('server.crt'),
    ROUTING_ORACLE_CLIENT_KEY_PEM:read('server.key')});
  for (const peer of [service(untrusted),service(wrongClient),service(pinned,'127.0.0.2')])
    await assert.rejects(peer.checkReady(),{routingCode:'ROUTING_UNAVAILABLE'});
  assert.equal(calls.length,2);

  for (const [mode, code] of [['redirect','ROUTING_RESPONSE_INVALID'],['wrong graph','GRAPH_RELEASE_MISMATCH'],
    ['down','ROUTING_UNAVAILABLE']]) {
    reply = mode;
    await assert.rejects(route(good),{routingCode:code});
  }
  reply = 'success';
  assert.equal((await route(good)).route.distance_m,110);
  assert.deepEqual(calls.slice(2),Array(4).fill('POST /route'));
});
