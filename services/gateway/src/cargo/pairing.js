import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError, uuid } from '../telemetry/schema.js';
import { transaction, hash } from './shared.js';
const token = () => randomBytes(32).toString('base64url');
const sessionScopes = ['read', 'shipments', 'simulate', 'publish'];
export function publicOrigin(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    (u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
  )
    throw new Error('PUBLIC_ORIGIN must be HTTPS or explicit loopback HTTP origin');
  return u.origin;
}
function cookies(req, name) {
  const matches = (req.headers.cookie ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.startsWith(name + '='));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}
export function csrf(raw) {
  return hash('csrf:' + raw);
}
export function createPairing(pool, config) {
  const rates = new Map();
  let minute = 0,
    total = 0;
  function limit(req) {
    const now = Date.now();
    for (const [k, v] of rates) if (v.expires <= now) rates.delete(k);
    if (now - minute > 60000) {
      minute = now;
      total = 0;
    }
    const key = req.socket.remoteAddress;
    const r = rates.get(key) || { count: 0, expires: now + 60000 };
    if (r.count >= 10 || total >= 100 || rates.size >= 1024)
      throw new ApiError(429, 'pairing rate limit');
    r.count++;
    total++;
    rates.set(key, r);
  }

  function originCheck(req, write = false) {
    const origin = publicOrigin(config.publicOrigin);
    if (
      req.headers.host !== new URL(origin).host ||
      req.headers['sec-fetch-site'] !== 'same-origin' ||
      (req.headers.origin && req.headers.origin !== origin) ||
      (write && req.headers.origin !== origin) ||
      req.headers['x-trackium-client'] !== 'cargo-v2'
    )
      throw new ApiError(403, 'same-origin request required');
    return origin;
  }
  function cookie(name, value, maxAge) {
    return (
      `${name}=${value}; Path=/v1/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` +
      (publicOrigin(config.publicOrigin).startsWith('https:') ? '; Secure' : '')
    );
  }
  return {
    originCheck,
    async challenge(req, res, requestedTenant) {
      uuid(requestedTenant);
      const audience = originCheck(req, true);
      limit(req);
      const raw = token(),
        id = randomUUID();
      await transaction(pool, null, async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(731824902)');
        const count = Number(
          (
            await c.query(
              'SELECT count(*) FROM cargo_pairing WHERE expires_at>now() AND consumed_at IS NULL'
            )
          ).rows[0].count
        );
        if (count >= 1000) throw new ApiError(429, 'pairing capacity reached');
        await c.query(
          'INSERT INTO cargo_pairing(id,proof_hash,audience,requested_tenant_id) VALUES($1,$2,$3,$4)',
          [id, hash(raw), audience, requestedTenant]
        );
      });
      res.setHeader('Set-Cookie', cookie('trk_pairing', raw, 120));
      return { id, expires_in: 120, audience };
    },
    async approve(identity, id, scopes) {
      if (!identity.scopes.includes('admin') || identity.kind === 'session')
        throw new ApiError(403, 'tenant owner API credential required');
      if (
        !Array.isArray(scopes) ||
        !scopes.length ||
        scopes.some((s) => !sessionScopes.includes(s) || !identity.scopes.includes(s))
      )
        throw new ApiError(403, 'cannot grant requested scope');
      const r = await pool.query(
        'UPDATE cargo_pairing SET tenant_id=$2,scopes=$3,approved_by=$4 WHERE id=$1 AND audience=$5 AND expires_at>now() AND requested_tenant_id=$2 AND tenant_id IS NULL AND consumed_at IS NULL RETURNING id',
        [uuid(id), identity.tenant_id, scopes, identity.id, publicOrigin(config.publicOrigin)]
      );
      if (!r.rowCount) throw new ApiError(409, 'challenge expired, approved or consumed');
      return r.rows[0];
    },
    async claim(req, res) {
      const audience = originCheck(req, true),
        proof = cookies(req, 'trk_pairing');
      if (!proof || !/^[\w-]{43}$/.test(proof)) throw new ApiError(401, 'pairing cookie required');
      const raw = token();
      const result = await transaction(pool, null, async (c) => {
        const row = (
          await c.query(
            'SELECT * FROM cargo_pairing WHERE proof_hash=$1 AND audience=$2 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE',
            [hash(proof), audience]
          )
        ).rows[0];
        if (!row) throw new ApiError(401, 'challenge expired or consumed');
        if (!row.tenant_id) throw new ApiError(409, 'awaiting tenant owner approval');
        const owner = (
          await c.query(
            'SELECT * FROM telemetry_api_keys WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL FOR SHARE',
            [row.approved_by, row.tenant_id]
          )
        ).rows[0];
        if (
          !owner ||
          !owner.scopes.includes('admin') ||
          row.scopes.some((s) => !owner.scopes.includes(s))
        )
          throw new ApiError(401, 'owner credential revoked or reduced');
        await c.query('UPDATE cargo_pairing SET consumed_at=now() WHERE id=$1', [row.id]);
        return (
          await c.query(
            'INSERT INTO cargo_sessions(id,tenant_id,token_hash,audience,scopes,approved_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,tenant_id,scopes,expires_at',
            [randomUUID(), row.tenant_id, hash(raw), audience, row.scopes, row.approved_by]
          )
        ).rows[0];
      });
      res.setHeader('Set-Cookie', [cookie('trk_session', raw, 300), cookie('trk_pairing', '', 0)]);
      return {
        ...result,
        csrf: csrf(raw),
        audience,
        simulation_enabled: !!config.simulatorEnabled
      };
    },
    async authenticate(req, write = false) {
      if (!config.webEnabled) throw new ApiError(401, 'browser sessions disabled');
      const audience = originCheck(req, write),
        raw = cookies(req, 'trk_session');
      if (!raw || !/^[\w-]{43}$/.test(raw)) throw new ApiError(401, 'session required');
      const result = await pool.query(
        `SELECT s.id,s.tenant_id,s.scopes,s.expires_at FROM cargo_sessions s JOIN telemetry_api_keys k ON k.id=s.approved_by AND k.tenant_id=s.tenant_id WHERE s.token_hash=$1 AND s.audience=$2 AND s.expires_at>now() AND s.revoked_at IS NULL AND k.revoked_at IS NULL AND 'admin'=ANY(k.scopes) AND s.scopes <@ k.scopes`,
        [hash(raw), audience]
      );
      if (!result.rowCount) throw new ApiError(401, 'session expired or revoked');
      if (write) {
        const value = req.headers['x-csrf-token'];
        if (
          typeof value !== 'string' ||
          !/^[0-9a-f]{64}$/.test(value) ||
          !timingSafeEqual(Buffer.from(value), Buffer.from(csrf(raw)))
        )
          throw new ApiError(403, 'CSRF check failed');
      }
      return {
        ...result.rows[0],
        kind: 'session',
        csrf: csrf(raw),
        audience,
        simulation_enabled: !!config.simulatorEnabled
      };
    },
    async revoke(identity, id) {
      const r = await pool.query(
        'UPDATE cargo_sessions SET revoked_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id',
        [identity.tenant_id, uuid(id)]
      );
      if (!r.rowCount) throw new ApiError(404, 'session not found');
      return r.rows[0];
    },
    clear(res) {
      res.setHeader('Set-Cookie', cookie('trk_session', '', 0));
    }
  };
}
