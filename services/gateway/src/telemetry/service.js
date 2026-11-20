import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiError, invalid, object, text, uuid, timestamp } from './schema.js';
import { ingestSynthetic } from '../cargo/ingestion.js';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const scopesAllowed = ['read', 'admin', 'fixture', 'shipments', 'simulate', 'publish'];
async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
export async function issueKey(client, tenantId, scopes) {
  uuid(tenantId);
  if (!Array.isArray(scopes) || !scopes.length || scopes.some((s) => !scopesAllowed.includes(s)))
    invalid('invalid scopes');
  const token = randomBytes(32).toString('base64url'),
    id = randomUUID();
  await client.query(
    'INSERT INTO telemetry_api_keys(id,tenant_id,token_hash,scopes) VALUES($1,$2,$3,$4)',
    [id, tenantId, hash(token), scopes]
  );
  return { id, token, tenant_id: tenantId, scopes };
}
export async function provisionTenant(pool, name) {
  text(name, 120);
  return transaction(pool, async (client) => {
    const id = randomUUID();
    await client.query('INSERT INTO telemetry_tenants(id,name) VALUES($1,$2)', [id, name]);
    return issueKey(client, id, ['read', 'admin', 'fixture', 'shipments', 'simulate', 'publish']);
  });
}
export function createTelemetryService(pool, { onEvent } = {}) {
  const device = async (client, tenantId, id, lock = false) => {
    const result = await client.query(
      `SELECT id,tenant_id,label,mode,enabled,created_at,identity_kind FROM telemetry_devices
      WHERE tenant_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`,
      [tenantId, uuid(id)]
    );
    if (!result.rowCount) throw new ApiError(404, 'device not found');
    return result.rows[0];
  };
  return {
    async authenticate(header) {
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header ?? '');
      if (!match) throw new ApiError(401, 'authentication required');
      const result = await pool.query(
        'SELECT id,tenant_id,scopes FROM telemetry_api_keys WHERE token_hash=$1 AND revoked_at IS NULL',
        [hash(match[1])]
      );
      if (!result.rowCount) throw new ApiError(401, 'invalid or revoked credential');
      return result.rows[0];
    },
    async register(tenantId, input, identityKind) {
      object(input, ['label', 'mode']);
      text(input.label, 120);
      if (!['synthetic', 'real'].includes(input.mode)) invalid('mode must be synthetic or real');
      return transaction(pool, async (client) => {
        const id = randomUUID();
        await client.query(
          'INSERT INTO telemetry_devices(id,tenant_id,label,mode,identity_kind) VALUES($1,$2,$3,$4,$5)',
          [
            id,
            tenantId,
            input.label,
            input.mode,
            identityKind || (input.mode === 'real' ? 'physical' : 'fixture')
          ]
        );
        await client.query(
          'INSERT INTO telemetry_device_bindings(tenant_id,device_id) VALUES($1,$2)',
          [tenantId, id]
        );
        return device(client, tenantId, id);
      });
    },
    async bindAovxDevice(tenantId, actorKeyId, input) {
      object(input, ['device_id', 'device_id_bcd']);
      const deviceId = uuid(input.device_id);
      if (typeof input.device_id_bcd !== 'string' || !/^[0-9]{12}$/.test(input.device_id_bcd))
        invalid('device_id_bcd must contain exactly 12 decimal digits');
      return transaction(pool, async (client) => {
        const result = await client.query(
          `SELECT id, mode, identity_kind, enabled FROM telemetry_devices
           WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
          [tenantId, deviceId]
        );
        const device = result.rows[0];
        if (!device) throw new ApiError(404, 'device not found');
        if (device.mode !== 'real' || device.identity_kind !== 'physical')
          throw new ApiError(409, 'AOVX binding requires a physical device');
        if (!device.enabled) throw new ApiError(409, 'device disabled');
        const id = randomUUID();
        await client.query(
          `INSERT INTO telemetry_aovx_device_bindings
           (id,tenant_id,device_id,device_id_bcd,created_by_api_key_id)
           VALUES($1,$2,$3,$4,$5)`,
          [id, tenantId, deviceId, input.device_id_bcd, actorKeyId ?? null]
        );
        const binding = await client.query(
          `SELECT id,tenant_id,device_id,device_id_bcd,trust,state,created_at,revoked_at
           FROM telemetry_aovx_device_bindings WHERE id=$1`,
          [id]
        );
        return binding.rows[0];
      });
    },
    async listAovxDevices(tenantId) {
      const result = await pool.query(
        `SELECT id,tenant_id,device_id,device_id_bcd,trust,state,created_at,revoked_at
         FROM telemetry_aovx_device_bindings WHERE tenant_id=$1
         ORDER BY created_at DESC,id DESC`,
        [tenantId]
      );
      return { devices: result.rows };
    },
    async revokeAovxDevice(tenantId, deviceIdBcd) {
      if (typeof deviceIdBcd !== 'string' || !/^[0-9]{12}$/.test(deviceIdBcd))
        invalid('device identifier must contain exactly 12 decimal digits');
      const result = await pool.query(
        `UPDATE telemetry_aovx_device_bindings
         SET state='revoked',revoked_at=now()
         WHERE tenant_id=$1 AND device_id_bcd=$2 AND state='active'
         RETURNING id,tenant_id,device_id,device_id_bcd,trust,state,created_at,revoked_at`,
        [tenantId, deviceIdBcd]
      );
      if (!result.rowCount) throw new ApiError(404, 'active AOVX binding not found');
      return result.rows[0];
    },
    async setEnabled(tenantId, id, input) {
      object(input, ['enabled']);
      if (typeof input.enabled !== 'boolean') invalid('enabled must be boolean');
      const result = await pool.query(
        'UPDATE telemetry_devices SET enabled=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id,tenant_id,label,mode,enabled,created_at,identity_kind',
        [tenantId, uuid(id), input.enabled]
      );
      if (!result.rowCount) throw new ApiError(404, 'device not found');
      return result.rows[0];
    },
    async list(tenantId, limit, cursor) {
      const result = await pool.query(
        `SELECT id,tenant_id,label,mode,enabled,created_at,identity_kind FROM telemetry_devices
        WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,
        [tenantId, cursor ? uuid(cursor) : null, limit + 1]
      );
      const more = result.rows.length > limit,
        rows = result.rows.slice(0, limit);
      return { devices: rows, next_cursor: more ? rows.at(-1).id : null };
    },
    getDevice: (tenantId, id) => device(pool, tenantId, id),
    async ingestFixture(tenantId, id, input, raw) {
      uuid(id);
      return transaction(pool, (client) =>
        ingestSynthetic(client, tenantId, id, input, raw, { onEvent })
      );
    },
    async history(tenantId, id, { limit, cursor, from, to }) {
      await device(pool, tenantId, id);
      let after = null;
      if (cursor) {
        try {
          after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
          object(after, ['at', 'id']);
          timestamp(after.at);
          uuid(after.id);
        } catch {
          invalid('invalid cursor');
        }
      }
      const result = await pool.query(
        `SELECT id,occurred_at,received_at,payload,canonical_event,canonical_sha256 FROM telemetry_events
        WHERE tenant_id=$1 AND device_id=$2 AND ($3::timestamptz IS NULL OR occurred_at >= $3)
        AND ($4::timestamptz IS NULL OR occurred_at <= $4)
        AND ($5::timestamptz IS NULL OR (occurred_at,id)<($5,$6::uuid))
        ORDER BY occurred_at DESC,id DESC LIMIT $7`,
        [tenantId, id, from ?? null, to ?? null, after?.at ?? null, after?.id ?? null, limit + 1]
      );
      const more = result.rows.length > limit,
        events = result.rows.slice(0, limit),
        last = events.at(-1);
      return {
        events,
        next_cursor: more
          ? Buffer.from(
              JSON.stringify({ at: last.occurred_at.toISOString(), id: last.id })
            ).toString('base64url')
          : null
      };
    },
    async latest(tenantId, id, locationOnly = false) {
      const d = await device(pool, tenantId, id);
      const result = await pool.query(
        `SELECT id,occurred_at,payload FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2
        ${locationOnly ? "AND payload->'gps' <> 'null'::jsonb" : ''} ORDER BY occurred_at DESC,id DESC LIMIT 1`,
        [tenantId, id]
      );
      const row = result.rows[0];
      return locationOnly
        ? {
            device_id: d.id,
            location: row
              ? {
                  event_id: row.id,
                  occurred_at: row.occurred_at,
                  gps: row.payload.gps,
                  trust: row.payload.trust
                }
              : null
          }
        : {
            device_id: d.id,
            mode: d.mode,
            enabled: d.enabled,
            last_event_at: row?.occurred_at ?? null,
            status: row?.payload.status ?? 'unknown',
            trust: row?.payload.trust ?? null
          };
    }
  };
}
