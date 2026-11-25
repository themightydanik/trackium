import { randomUUID } from 'node:crypto';
import { hash, transaction } from '../cargo/shared.js';
import { routeError } from './contract.js';

const missing = () => routeError(404, 'ROUTE_RESOURCE_NOT_FOUND', 'Shipment or route revision not found');
const stale = () => routeError(409, 'ROUTE_GENERATION_CONFLICT', 'Route history changed. Refresh before retrying');
const invalidState = () => routeError(409, 'ROUTE_STATE_CONFLICT', 'Revision cannot make this transition');
const MAX_REVISIONS = 100;
const SUMMARY = `r.id,r.version,r.calculation->>'profile' AS profile,r.calculation->'graph' AS graph,
 r.calculation->>'calculated_at' AS calculated_at,
 r.calculation#>'{route,distance_m}' AS distance_m,
 r.calculation#>'{route,estimated_duration_s}' AS estimated_duration_s`;
const STATUS = `(SELECT a.state FROM cargo_road_route_audit a
 WHERE (a.tenant_id,a.shipment_id,a.revision_id)=(r.tenant_id,r.shipment_id,r.id)
 ORDER BY a.generation DESC LIMIT 1) AS state`;

async function shipment(db, keys, lock = false) {
  const {rows:[row]} = await db.query(`SELECT id FROM cargo_shipments
    WHERE tenant_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`, keys);
  if (!row) throw missing();
}

async function head(db, keys) {
  const {rows:[row]} = await db.query(`SELECT generation,active_revision_id FROM cargo_road_route_heads
    WHERE tenant_id=$1 AND shipment_id=$2`, keys);
  return row ?? {generation:0, active_revision_id:null};
}

async function audit(db, keys, id, generation, state, actor) {
  await db.query(`INSERT INTO cargo_road_route_audit
    (tenant_id,shipment_id,revision_id,generation,state,actor_account_id) VALUES($1,$2,$3,$4,$5,$6)`,
    [...keys,id,generation,state,actor]);
}

async function advance(db, keys, generation, activeId) {
  await db.query(`INSERT INTO cargo_road_route_heads(tenant_id,shipment_id,generation,active_revision_id)
    VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,shipment_id) DO UPDATE
    SET generation=excluded.generation,active_revision_id=excluded.active_revision_id`, [...keys,generation,activeId]);
}

async function revision(db, keys, id) {
  const {rows:[row]} = await db.query(`SELECT r.id,r.version,r.stops,r.calculation,${STATUS},
    (SELECT jsonb_agg(jsonb_build_object('state',a.state,'generation',a.generation,
      'actor_account_id',a.actor_account_id,'occurred_at',a.occurred_at) ORDER BY a.generation)
     FROM cargo_road_route_audit a WHERE (a.tenant_id,a.shipment_id,a.revision_id)=(r.tenant_id,r.shipment_id,r.id)) AS audit
    FROM cargo_road_route_revisions r WHERE r.tenant_id=$1 AND r.shipment_id=$2 AND r.id=$3`, [...keys,id]);
  if (!row) throw missing();
  return row;
}

export function createRouteRevisions(pool, routing) {
  return {
    // A repeatable snapshot keeps generation, revision states and the active pointer consistent.
    async read(keys, action, ids = []) {
      return transaction(pool, null, async db => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await shipment(db, keys);
        const current = await head(db, keys);
        if (action === 'active') return {...current, revision:current.active_revision_id ?
          await revision(db, keys, current.active_revision_id) : null};
        if (action === 'detail') return {...current, revision:await revision(db, keys, ids[0])};
        if (action === 'compare') {
          const {rows} = await db.query(`SELECT ${SUMMARY},r.stops,r.calculation->'truck' AS truck,${STATUS}
            FROM cargo_road_route_revisions r WHERE tenant_id=$1 AND shipment_id=$2 AND id=ANY($3::uuid[])`, [...keys,ids]);
          if (rows.length !== 2) throw missing();
          const from = rows.find(row => row.id === ids[0]), to = rows.find(row => row.id === ids[1]);
          return {...current, from, to, delta:{distance_m:to.distance_m-from.distance_m,
            estimated_duration_s:to.estimated_duration_s-from.estimated_duration_s}};
        }
        const {rows} = await db.query(`SELECT ${SUMMARY},${STATUS} FROM cargo_road_route_revisions r
          WHERE tenant_id=$1 AND shipment_id=$2 ORDER BY version DESC`, keys);
        return {...current, revisions:rows};
      });
    },

    async propose(identity, keys, calculation, expected, requestId, signal) {
      const digest = hash(JSON.stringify([identity.account_id,calculation.profile,
        calculation.points.map(point => [point.latitude,point.longitude]),
        calculation.truck && Object.keys(calculation.truck).sort().map(key => [key,calculation.truck[key]])]));
      async function findReplay(db) {
        const {rows:[row]} = await db.query(`SELECT id,request_digest FROM cargo_road_route_revisions
          WHERE tenant_id=$1 AND shipment_id=$2 AND request_id=$3`, [...keys,requestId]);
        if (!row) return null;
        if (row.request_digest !== digest)
          throw routeError(409, 'ROUTE_REQUEST_CONFLICT', 'Request ID was used for a different proposal');
        return row.id;
      }
      async function checkCapacity(db) {
        const {rows:[{version}]} = await db.query(`SELECT COALESCE(MAX(version),0) AS version
          FROM cargo_road_route_revisions WHERE tenant_id=$1 AND shipment_id=$2`, keys);
        if (version >= MAX_REVISIONS) throw routeError(409, 'ROUTE_HISTORY_LIMIT', 'Shipment has 100 route revisions');
        return version + 1;
      }
      async function precondition(db, lock) {
        await shipment(db, keys, lock);
        const current = await head(db, keys);
        const existing = await findReplay(db);
        if (existing) return {response:{...current,revision:await revision(db,keys,existing),replayed:true}};
        if (current.generation !== expected) throw stale();
        return {current, version:await checkCapacity(db)};
      }
      const preflight = await transaction(pool, null, async db => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        return precondition(db, false);
      });
      if (preflight.response) return preflight.response;
      if (!routing) throw routeError(503, 'ROUTING_UNAVAILABLE', 'Routing temporarily unavailable');
      const calculated = await routing.calculate(identity, calculation, signal);
      const snapshot = JSON.stringify(calculated);
      if (Buffer.byteLength(snapshot) > 1048576)
        throw routeError(502, 'ROUTING_RESPONSE_INVALID', 'Calculated route exceeds storage limit');
      return transaction(pool, null, async db => {
        const {response,current,version} = await precondition(db, true);
        if (response) return response;
        // Check PostgreSQL canonical JSONB size before inserting anything.
        const {rows:[{fits}]} = await db.query('SELECT octet_length($1::jsonb::text)<=1048576 AS fits',[snapshot]);
        if (!fits) throw routeError(502, 'ROUTING_RESPONSE_INVALID', 'Calculated route exceeds storage limit');
        const id = randomUUID(), generation = expected + 1;
        await db.query(`INSERT INTO cargo_road_route_revisions
          (tenant_id,shipment_id,id,version,request_id,request_digest,stops,calculation)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...keys,id,version,requestId,digest,JSON.stringify(calculation.points),snapshot]);
        await audit(db,keys,id,generation,'proposed',identity.account_id);
        await advance(db,keys,generation,current.active_revision_id);
        return {generation,active_revision_id:current.active_revision_id,revision:await revision(db,keys,id),replayed:false};
      });
    },

    async transition(identity, keys, id, action, expected) {
      return transaction(pool, null, async db => {
        await shipment(db, keys, true);
        const current = await head(db, keys);
        if (current.generation !== expected) throw stale();
        const {rows:[target]} = await db.query(`SELECT ${STATUS} FROM cargo_road_route_revisions r
          WHERE tenant_id=$1 AND shipment_id=$2 AND id=$3`, [...keys,id]);
        if (!target) throw missing();
        const approve = action === 'approve';
        if (target.state !== (approve ? 'proposed' : 'approved')) throw invalidState();
        const generation = expected + 1;
        if (!approve && current.active_revision_id)
          await audit(db,keys,current.active_revision_id,generation,'superseded',identity.account_id);
        await audit(db,keys,id,generation,approve ? 'approved' : 'active',identity.account_id);
        const active_revision_id = approve ? current.active_revision_id : id;
        await advance(db,keys,generation,active_revision_id);
        return {generation,active_revision_id,revision:await revision(db,keys,id)};
      });
    }
  };
}
