import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { migrate } from '../src/telemetry/migrate.js';
import { initialize } from '../src/journal.js';
import { createTelemetryService, provisionTenant } from '../src/telemetry/service.js';
import { createShipmentService } from '../src/cargo/shipments.js';
import { createRouteRevisions } from '../src/routing/revisions.js';
import { routeError } from '../src/routing/contract.js';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw Error('TEST_DATABASE_URL required (disposable PostgreSQL database)');
const points = [{latitude:48,longitude:11.001},{latitude:48,longitude:11.039}];
const request = {points,profile:'auto'};
const routeFixture = graph => ({
  profile:'auto', graph:{id:graph,engine_version:'3.6.3',osm_snapshot:'2026-01-01'},
  calculated_at:'2026-01-01T00:00:00.000Z',
  route:{geometry_format:'polyline6',distance_m:3000,estimated_duration_s:150,legs:[]}
});
const actor = {account_id:randomUUID()};

test('PostgreSQL immutable route revisions, tenant keys, generation races and atomic replacement', async t => {
  const schema = 'routes_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({connectionString:database});
  await admin.query('CREATE SCHEMA ' + schema);
  const db = new pg.Pool({connectionString:database,options:'-c search_path=' + schema});
  t.after(async () => {
    await db.end();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await initialize(db);
  await migrate(db);
  async function createShipment() {
    const tenant = (await provisionTenant(db, 'Routing test tenant')).tenant_id;
    const device = await createTelemetryService(db).register(tenant,{label:'Test registry',mode:'synthetic'});
    const shipment = await createShipmentService(db).create(tenant,{name:'Routing test shipment',device_id:device.id,
      route:points.map((p,i) => ({...p,name:'Checkpoint ' + i})),
      conditions:{temperature_min_c:0,temperature_max_c:10}});
    return [tenant,shipment.id];
  }
  const keys = await createShipment(), other = await createShipment();
  const initialShipment = await db.query('SELECT route,event_sequence,head_hash FROM cargo_shipments WHERE id=$1',[keys[1]]);
  let graph = '1'.repeat(64), mode, calls = 0;
  const service = createRouteRevisions(db,{async calculate() {
    calls++;
    if (mode === 'unavailable') throw routeError(503,'ROUTING_UNAVAILABLE','Unavailable');
    return {...routeFixture(graph), ...(mode === 'large' && {extra:'a'.repeat(1048576)})};
  }});
  const propose = (generation, key = randomUUID(), against = keys, calculation = request) =>
    service.propose(actor,against,calculation,generation,key);

  assert.deepEqual(await service.read(keys,'active'),{generation:0,active_revision_id:null,revision:null});
  const idempotency = randomUUID();
  const {revision:first} = await propose(0,idempotency);
  const replay = await propose(0,idempotency);
  assert.equal(replay.replayed,true);
  assert.equal(replay.revision.id,first.id);
  assert.equal(calls,1);
  await assert.rejects(propose(0,idempotency,keys,{...request,points:[...points].reverse()}),
    {routingCode:'ROUTE_REQUEST_CONFLICT'});
  await assert.rejects(propose(0),{routingCode:'ROUTE_GENERATION_CONFLICT'});
  await assert.rejects(propose(0,randomUUID(),[other[0],keys[1]]),{routingCode:'ROUTE_RESOURCE_NOT_FOUND'});
  assert.equal(calls,1);
  await assert.rejects(service.read(other,'detail',[first.id]),{routingCode:'ROUTE_RESOURCE_NOT_FOUND'});
  await assert.rejects(service.transition(actor,keys,first.id,'activate',1),{routingCode:'ROUTE_STATE_CONFLICT'});
  await service.transition(actor,keys,first.id,'approve',1);
  await assert.rejects(service.transition(actor,keys,first.id,'approve',1),{routingCode:'ROUTE_GENERATION_CONFLICT'});
  await service.transition(actor,keys,first.id,'activate',2);

  mode = 'unavailable';
  await assert.rejects(propose(3),{routingCode:'ROUTING_UNAVAILABLE'});
  mode = 'large';
  await assert.rejects(propose(3),{routingCode:'ROUTING_RESPONSE_INVALID'});
  assert.equal((await service.read(keys,'active')).revision.id,first.id);
  mode = undefined;
  graph = '2'.repeat(64);
  const {revision:second} = await propose(3);
  const {revision:third} = await propose(4);
  assert.equal((await service.read(keys,'active')).revision.id,first.id);
  const approvals = await Promise.allSettled([second,third].map(r => service.transition(actor,keys,r.id,'approve',5)));
  assert.equal(approvals.filter(x => x.status === 'fulfilled').length,1);
  assert.equal(approvals.find(x => x.status === 'rejected').reason.routingCode,'ROUTE_GENERATION_CONFLICT');
  await service.transition(actor,keys,approvals[0].status === 'rejected' ? second.id : third.id,'approve',6);

  // Fail the write after both audit rows would have been inserted.
  await db.query(`CREATE FUNCTION reject_route_head() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'test head failure'; END $$;
    CREATE TRIGGER reject_route_head BEFORE UPDATE ON cargo_road_route_heads
    FOR EACH ROW EXECUTE FUNCTION reject_route_head()`);
  const failedProposal = randomUUID();
  await assert.rejects(propose(7,failedProposal), /test head failure/);
  assert.equal((await db.query('SELECT 1 FROM cargo_road_route_revisions WHERE request_id=$1',[failedProposal])).rowCount,0);
  await assert.rejects(service.transition(actor,keys,second.id,'activate',7), /test head failure/);
  assert.equal((await service.read(keys,'active')).revision.state,'active');
  assert.equal((await service.read(keys,'detail',[second.id])).revision.audit.length,2);
  await db.query('DROP TRIGGER reject_route_head ON cargo_road_route_heads');

  const results = await Promise.allSettled([second,third].map(r => service.transition(actor,keys,r.id,'activate',7)));
  assert.equal(results.filter(x => x.status === 'fulfilled').length,1);
  assert.equal(results.find(x => x.status === 'rejected').reason.routingCode,'ROUTE_GENERATION_CONFLICT');
  const offline = createRouteRevisions(db,null);
  const active = await offline.read(keys,'active');
  assert.equal(active.generation,8);
  assert.equal(active.revision.calculation.graph.id,'2'.repeat(64));
  const old = (await offline.read(keys,'detail',[first.id])).revision;
  assert.deepEqual(old.audit.map(row => row.state),['proposed','approved','active','superseded']);
  assert.equal(old.calculation.graph.id,'1'.repeat(64));
  assert.equal((await offline.read(keys,'compare',[first.id,active.revision.id])).delta.distance_m,0);
  assert.equal((await offline.read(keys,'list')).revisions.filter(row => row.state === 'active').length,1);
  assert.equal((await offline.read(keys,'list')).revisions.length,3);
  await assert.rejects(db.query('UPDATE cargo_road_route_revisions SET version=100 WHERE id=$1',[first.id]), /immutable/);
  await assert.rejects(db.query('DELETE FROM cargo_road_route_audit WHERE revision_id=$1',[first.id]), /immutable/);
  await propose(0,randomUUID(),other);
  await assert.rejects(db.query('UPDATE cargo_road_route_heads SET active_revision_id=$1 WHERE shipment_id=$2',
    [first.id,other[1]]), {code:'23503'});
  assert.deepEqual((await db.query('SELECT route,event_sequence,head_hash FROM cargo_shipments WHERE id=$1',[keys[1]])).rows,
    initialShipment.rows);
});
