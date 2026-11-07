import { randomUUID } from 'node:crypto';
import { ApiError, invalid, object, text, uuid, canonicalize } from '../telemetry/schema.js';
import { transaction, hash } from './shared.js';
export const transitions = {
  draft: ['active', 'cancelled'],
  active: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: []
};
export function routeAndConditions(route, conditions) {
  if (!Array.isArray(route) || route.length < 2 || route.length > 32)
    invalid('route requires 2..32 ordered checkpoints');
  const points = route.map((p) => {
    object(p, ['name', 'latitude', 'longitude', 'radius_m']);
    text(p.name, 80);
    for (const [key, min, max] of [
      ['latitude', -85, 85],
      ['longitude', -180, 180],
      ['radius_m', 50, 10000]
    ]) {
      const n = p[key] ?? (key === 'radius_m' ? 200 : null);
      if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
        invalid('invalid checkpoint ' + key);
    }
    return {
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      radius_m: p.radius_m ?? 200
    };
  });
  if (points.some((p, i) => i && distance(p, points[i - 1]) < 1))
    invalid('adjacent checkpoints must differ');
  object(conditions, ['temperature_min_c', 'temperature_max_c', 'tolerance_c', 'max_deviation_m']);
  const c = {
    temperature_min_c: conditions.temperature_min_c,
    temperature_max_c: conditions.temperature_max_c,
    tolerance_c: conditions.tolerance_c ?? 0,
    max_deviation_m: conditions.max_deviation_m ?? 1000
  };
  for (const [key, min, max] of [
    ['temperature_min_c', -100, 150],
    ['temperature_max_c', -100, 150],
    ['tolerance_c', 0, 20],
    ['max_deviation_m', 50, 100000]
  ])
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      invalid('invalid condition ' + key);
  if (c.temperature_min_c > c.temperature_max_c) invalid('inverted temperature range');
  return { route: points, conditions: c };
}
export function distance(a, b) {
  const r = Math.PI / 180;
  const lat = ((a.latitude + b.latitude) / 2) * r;
  return Math.hypot(
    (a.latitude - b.latitude) * 111195,
    (a.longitude - b.longitude) * 111195 * Math.cos(lat)
  );
}
function deviation(point, route) {
  return Math.min(
    ...route.slice(1).map((end, i) => {
      const start = route[i],
        scale = Math.cos((point.latitude * Math.PI) / 180);
      const ax = (start.longitude - point.longitude) * scale,
        ay = start.latitude - point.latitude,
        bx = (end.longitude - point.longitude) * scale,
        by = end.latitude - point.latitude;
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      return Math.hypot(ax + t * dx, ay + t * dy) * 111195;
    })
  );
}
export async function shipment(client, tenant, id, lock = false) {
  const r = await client.query(
    'SELECT * FROM cargo_shipments WHERE tenant_id=$1 AND id=$2' + (lock ? ' FOR UPDATE' : ''),
    [tenant, uuid(id)]
  );
  if (!r.rowCount) throw new ApiError(404, 'shipment not found');
  return r.rows[0];
}
export async function appendEvent(client, s, type, data, key, time = new Date().toISOString()) {
  const previous = await client.query(
    'SELECT id FROM cargo_events WHERE tenant_id=$1 AND shipment_id=$2 AND event_key=$3',
    [s.tenant_id, s.id, key]
  );
  if (previous.rowCount) return previous.rows[0].id;
  const id = randomUUID(),
    sequence = Number(s.event_sequence) + 1;
  const envelope = {
    schema_version: 1,
    sequence,
    shipment_id: s.id,
    tenant_id: s.tenant_id,
    event_id: id,
    event_type: type,
    event_time: time,
    device_id: s.device_id,
    source_trust: s.source_trust,
    previous_hash: s.head_hash ?? null,
    data
  };
  const canonical = canonicalize(envelope),
    digest = hash(canonical);
  await client.query(
    `INSERT INTO cargo_events(id,tenant_id,shipment_id,sequence,event_key,event_type,event_time,device_id,source_trust,canonical_payload,sha256,previous_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      s.tenant_id,
      s.id,
      sequence,
      key,
      type,
      time,
      s.device_id,
      s.source_trust,
      canonical,
      digest,
      s.head_hash
    ]
  );
  await client.query('INSERT INTO cargo_outbox(event_id,tenant_id) VALUES($1,$2)', [
    id,
    s.tenant_id
  ]);
  await client.query(
    'UPDATE cargo_shipments SET head_hash=$3,event_sequence=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2',
    [s.tenant_id, s.id, digest, sequence]
  );
  s.head_hash = digest;
  s.event_sequence = sequence;
  return id;
}
async function setCheckpoints(client, s) {
  await client.query('DELETE FROM cargo_checkpoints WHERE tenant_id=$1 AND shipment_id=$2', [
    s.tenant_id,
    s.id
  ]);
  for (const [i, p] of s.route.entries())
    await client.query(
      'INSERT INTO cargo_checkpoints(id,tenant_id,shipment_id,ordinal,name,latitude,longitude,radius_m,source_trust) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        randomUUID(),
        s.tenant_id,
        s.id,
        i,
        p.name,
        p.latitude,
        p.longitude,
        p.radius_m,
        s.source_trust
      ]
    );
}
async function boundDevice(client, tenant, id) {
  const r = await client.query('SELECT * FROM telemetry_devices WHERE tenant_id=$1 AND id=$2', [
    tenant,
    uuid(id)
  ]);
  if (!r.rowCount) throw new ApiError(404, 'device not found');
  if (!r.rows[0].enabled) throw new ApiError(409, 'device disabled');
  return r.rows[0];
}
export async function transition(client, s, next, key, time = new Date().toISOString()) {
  if (!transitions[s.status].includes(next)) throw new ApiError(409, 'invalid shipment transition');
  if (next === 'active') await boundDevice(client, s.tenant_id, s.device_id);
  if (next === 'delivered') {
    const r = await client.query(
      'SELECT count(*) FROM cargo_checkpoints WHERE tenant_id=$1 AND shipment_id=$2 AND visited_at IS NULL',
      [s.tenant_id, s.id]
    );
    if (r.rows[0].count !== '0') throw new ApiError(409, 'checkpoints incomplete');
  }
  const old = s.status;
  await client.query(
    'UPDATE cargo_shipments SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',
    [s.tenant_id, s.id, next]
  );
  s.status = next;
  if (['completed', 'cancelled'].includes(next))
    await client.query(
      "UPDATE cargo_simulations SET state='finished' WHERE tenant_id=$1 AND shipment_id=$2 AND state IN ('running','paused')",
      [s.tenant_id, s.id]
    );
  await appendEvent(client, s, 'status_changed', { from: old, to: next }, key, time);
}
export function createShipmentService(pool) {
  return {
    async create(tenant, input) {
      object(input, ['name', 'device_id', 'route', 'conditions']);
      text(input.name, 120);
      const parsed = routeAndConditions(input.route, input.conditions);
      return transaction(pool, tenant, async (c) => {
        const d = await boundDevice(c, tenant, input.device_id),
          id = randomUUID();
        await c.query(
          'INSERT INTO cargo_shipments(id,tenant_id,name,device_id,source_trust,route,conditions) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            id,
            tenant,
            input.name,
            d.id,
            d.mode === 'synthetic' ? 'synthetic' : 'unverified',
            JSON.stringify(parsed.route),
            parsed.conditions
          ]
        );
        const s = await shipment(c, tenant, id, true);
        await setCheckpoints(c, s);
        await appendEvent(
          c,
          s,
          'shipment_created',
          { name: s.name, route: s.route, conditions: s.conditions },
          'created'
        );
        return s;
      });
    },
    async list(tenant, limit = 100, cursor) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) invalid('invalid limit');
      const r = await pool.query(
        'SELECT * FROM cargo_shipments WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',
        [tenant, cursor ? uuid(cursor) : null, limit + 1]
      );
      return {
        shipments: r.rows.slice(0, limit),
        next_cursor: r.rows.length > limit ? r.rows[limit - 1].id : null
      };
    },
    async detail(tenant, id) {
      const s = await shipment(pool, tenant, id);
      const cp = await pool.query(
        'SELECT * FROM cargo_checkpoints WHERE tenant_id=$1 AND shipment_id=$2 ORDER BY ordinal',
        [tenant, id]
      );
      return { ...s, checkpoints: cp.rows };
    },
    async update(tenant, id, input) {
      object(input, ['name', 'device_id', 'route', 'conditions']);
      if (!Object.keys(input).length) invalid('empty update');
      return transaction(pool, tenant, async (c) => {
        const s = await shipment(c, tenant, id, true);
        if (s.status !== 'draft') throw new ApiError(409, 'only draft fields can change');
        if (input.name !== undefined) text(input.name, 120);
        const parsed = routeAndConditions(input.route ?? s.route, input.conditions ?? s.conditions);
        const d = await boundDevice(c, tenant, input.device_id ?? s.device_id);
        if ((d.mode === 'synthetic' ? 'synthetic' : 'unverified') !== s.source_trust)
          throw new ApiError(409, 'cannot mix synthetic and real identities');
        await c.query(
          'UPDATE cargo_shipments SET name=$3,device_id=$4,route=$5,conditions=$6 WHERE tenant_id=$1 AND id=$2',
          [tenant, id, input.name ?? s.name, d.id, JSON.stringify(parsed.route), parsed.conditions]
        );
        Object.assign(s, { name: input.name ?? s.name, device_id: d.id, ...parsed });
        await setCheckpoints(c, s);
        await appendEvent(c, s, 'shipment_updated', input, 'updated:' + randomUUID());
        return s;
      });
    },
    async change(tenant, id, next) {
      return transaction(pool, tenant, async (c) => {
        const s = await shipment(c, tenant, id, true);
        await transition(c, s, next, 'transition:' + randomUUID());
        return s;
      });
    },
    async events(tenant, id, after = 0, limit = 100) {
      await shipment(pool, tenant, id);
      if (
        !Number.isSafeInteger(after) ||
        after < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 200
      )
        invalid('invalid event page');
      const r = await pool.query(
        'SELECT e.*,o.state AS outbox_state FROM cargo_events e JOIN cargo_outbox o ON o.event_id=e.id WHERE e.tenant_id=$1 AND e.shipment_id=$2 AND e.sequence>$3 ORDER BY e.sequence LIMIT $4',
        [tenant, id, after, limit]
      );
      return { events: r.rows, next_after: r.rows.length ? Number(r.rows.at(-1).sequence) : after };
    },
    async onTelemetry(c, { id, event, sha256 }) {
      const r = await c.query(
        "SELECT * FROM cargo_shipments WHERE tenant_id=$1 AND device_id=$2 AND status='active' FOR UPDATE",
        [event.tenant_id, event.device_id]
      );
      if (!r.rowCount) return;
      const s = r.rows[0];
      if (s.source_trust !== event.trust) throw new ApiError(409, 'shipment provenance mismatch');
      await appendEvent(
        c,
        s,
        'telemetry_recorded',
        { telemetry_event_id: id, canonical_sha256: sha256, payload: event },
        'telemetry:' + id,
        event.occurred_at
      );
      const cond = s.conditions,
        t = event.temperature_c;
      if (t !== null) {
        const violated =
          t < cond.temperature_min_c - cond.tolerance_c ||
          t > cond.temperature_max_c + cond.tolerance_c;
        if (violated !== s.temperature_violation) {
          await c.query(
            'UPDATE cargo_shipments SET temperature_violation=$3 WHERE tenant_id=$1 AND id=$2',
            [s.tenant_id, s.id, violated]
          );
          await appendEvent(
            c,
            s,
            violated ? 'temperature_violation' : 'temperature_recovered',
            { temperature_c: t, conditions: cond },
            'temperature:' + id,
            event.occurred_at
          );
        }
      }
      if (event.gps) {
        const violated = deviation(event.gps, s.route) > cond.max_deviation_m;
        if (violated !== s.route_violation) {
          await c.query(
            'UPDATE cargo_shipments SET route_violation=$3 WHERE tenant_id=$1 AND id=$2',
            [s.tenant_id, s.id, violated]
          );
          await appendEvent(
            c,
            s,
            violated ? 'route_deviation' : 'route_recovered',
            { gps: event.gps },
            'route:' + id,
            event.occurred_at
          );
        }
        const pending = await c.query(
          'SELECT * FROM cargo_checkpoints WHERE tenant_id=$1 AND shipment_id=$2 AND visited_at IS NULL ORDER BY ordinal LIMIT 1',
          [s.tenant_id, s.id]
        );
        const cp = pending.rows[0];
        if (cp && distance(event.gps, cp) <= cp.radius_m) {
          await c.query(
            'UPDATE cargo_checkpoints SET visited_at=$4,telemetry_event_id=$5 WHERE tenant_id=$1 AND shipment_id=$2 AND id=$3',
            [s.tenant_id, s.id, cp.id, event.occurred_at, id]
          );
          await appendEvent(
            c,
            s,
            'checkpoint_reached',
            { checkpoint_id: cp.id, ordinal: cp.ordinal, name: cp.name, telemetry_event_id: id },
            'checkpoint:' + cp.id,
            event.occurred_at
          );
          if (cp.ordinal === s.route.length - 1)
            await transition(c, s, 'delivered', 'auto-delivered', event.occurred_at);
        }
      }
    }
  };
}
