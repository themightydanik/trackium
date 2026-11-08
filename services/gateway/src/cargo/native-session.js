import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError, object, uuid } from '../telemetry/schema.js';
import { body } from '../telemetry/api.js';
import { transaction } from './shared.js';
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const nativePopKey = (proof, challenge, token) =>
  createHash('sha256')
    .update('trackium:native:pop:v1\0' + proof + '\0' + challenge + '\0' + token)
    .digest();
export function nativeMac(key, method, path, time, nonce, raw) {
  return createHmac('sha256', key)
    .update(['v1', method, path, time, nonce, hash(raw)].join('\n'))
    .digest('hex');
}
export function createNativeSessions(pool, config) {
  if (config.nativeEnabled && new URL(config.publicOrigin).protocol !== 'https:')
    throw new Error('Native clients require HTTPS PUBLIC_ORIGIN');
  const audience = 'trackium:native:v1:' + new URL(config.publicOrigin).origin;
  return {
    async challenge(input) {
      object(input, ['tenant_id', 'proof_hash', 'label']);
      uuid(input.tenant_id);
      if (
        !/^[a-f0-9]{64}$/.test(input.proof_hash ?? '') ||
        typeof input.label !== 'string' ||
        input.label.length < 1 ||
        input.label.length > 80
      )
        throw new ApiError(400, 'invalid native challenge');
      return transaction(pool, null, async (db) => {
        await db.query('SELECT pg_advisory_xact_lock(736219,9)');
        await db.query(
          "DELETE FROM cargo_native_nonces WHERE session_id IN (SELECT id FROM cargo_native_sessions WHERE expires_at<now()-interval '24 hours')"
        );
        await db.query(
          "DELETE FROM cargo_native_sessions WHERE expires_at<now()-interval '24 hours'"
        );
        await db.query(
          "DELETE FROM cargo_native_pairing WHERE expires_at<now()-interval '24 hours'"
        );
        const count = (
          await db.query(
            'SELECT count(*) AS n,count(*) FILTER(WHERE tenant_id=$1) AS t FROM cargo_native_pairing WHERE expires_at>now()',
            [input.tenant_id]
          )
        ).rows[0];
        if (Number(count.n) >= 2000 || Number(count.t) >= 10)
          throw new ApiError(429, 'too many native challenges');
        if (
          !(await db.query('SELECT 1 FROM telemetry_tenants WHERE id=$1', [input.tenant_id]))
            .rowCount
        )
          throw new ApiError(404, 'tenant not found');
        const r = (
          await db.query(
            'INSERT INTO cargo_native_pairing(id,tenant_id,proof_hash,audience,label) VALUES($1,$2,$3,$4,$5) RETURNING id,expires_at',
            [randomUUID(), input.tenant_id, input.proof_hash, audience, input.label]
          )
        ).rows[0];
        return { ...r, audience, scopes: ['read', 'publish'], approval_required: true };
      });
    },
    async approve(identity, id) {
      if (
        identity.kind === 'session' ||
        identity.kind === 'native' ||
        !identity.scopes.includes('admin') ||
        !identity.scopes.includes('publish') ||
        !identity.scopes.includes('read')
      )
        throw new ApiError(403, 'owner read/admin/publish credential required');
      const row = await pool.query(
        'UPDATE cargo_native_pairing SET approved_by=$1 WHERE id=$2 AND tenant_id=$3 AND audience=$4 AND consumed_at IS NULL AND approved_by IS NULL AND expires_at>now() RETURNING id',
        [identity.id, uuid(id), identity.tenant_id, audience]
      );
      if (!row.rowCount) throw new ApiError(409, 'challenge unavailable for this owner');
      return { approved: true };
    },
    async claim(input) {
      object(input, ['challenge_id', 'proof']);
      uuid(input.challenge_id);
      if (typeof input.proof !== 'string' || !/^0x[a-f0-9]{64}$/.test(input.proof))
        throw new ApiError(400, 'invalid device proof');
      return transaction(pool, null, async (db) => {
        const r = (
          await db.query(
            'SELECT * FROM cargo_native_pairing WHERE id=$1 AND audience=$2 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
            [input.challenge_id, audience]
          )
        ).rows[0];
        if (!r || r.proof_hash !== hash(input.proof) || !r.approved_by)
          throw new ApiError(409, 'owner approval and matching challenge proof required');
        const owner = (
          await db.query(
            'SELECT scopes,revoked_at FROM telemetry_api_keys WHERE tenant_id=$1 AND id=$2',
            [r.tenant_id, r.approved_by]
          )
        ).rows[0];
        if (
          owner.revoked_at ||
          !['read', 'admin', 'publish'].every((s) => owner.scopes.includes(s))
        )
          throw new ApiError(403, 'owner credential no longer authorizes publication');
        const token = 'trk_native_' + randomBytes(32).toString('hex'),
          id = randomUUID(),
          key = nativePopKey(input.proof, r.id, token);
        const session = (
          await db.query(
            'INSERT INTO cargo_native_sessions(id,tenant_id,token_hash,pop_key,audience,approved_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,tenant_id,expires_at',
            [id, r.tenant_id, hash(token), key, audience, r.approved_by]
          )
        ).rows[0];
        await db.query('UPDATE cargo_native_pairing SET consumed_at=now() WHERE id=$1', [r.id]);
        return { ...session, token, audience, scopes: ['read', 'publish'] };
      });
    },
    async authenticate(req) {
      if (!config.nativeEnabled) throw new ApiError(403, 'native clients disabled');
      if (req.trackiumNativeIdentity) return req.trackiumNativeIdentity;
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, ''),
        time = req.headers['x-trackium-time'],
        nonce = req.headers['x-trackium-nonce'],
        mac = req.headers['x-trackium-mac'];
      if (
        !/^trk_native_[a-f0-9]{64}$/.test(token) ||
        req.headers.origin ||
        req.headers.cookie ||
        req.headers['x-trackium-client'] !== 'android-native-v1' ||
        req.headers['x-trackium-audience'] !== audience ||
        !/^\d{13}$/.test(time ?? '') ||
        Math.abs(Date.now() - Number(time)) > 30000 ||
        !/^[a-f0-9]{32}$/.test(nonce ?? '') ||
        !/^[a-f0-9]{64}$/.test(mac ?? '')
      )
        throw new ApiError(401, 'invalid native request');
      let raw = Buffer.alloc(0);
      if (!['GET', 'HEAD'].includes(req.method)) {
        const read = await body(req, 262144);
        raw = read.raw;
        req.trackiumNativeBody = read;
      } else if (Number(req.headers['content-length'] ?? 0) !== 0)
        throw new ApiError(400, 'GET body forbidden');
      const identity = await transaction(pool, null, async (db) => {
        const row = (
          await db.query(
            `SELECT s.* FROM cargo_native_sessions s JOIN telemetry_api_keys k ON k.id=s.approved_by AND k.tenant_id=s.tenant_id WHERE s.token_hash=$1 AND s.audience=$2 AND s.expires_at>now() AND s.revoked_at IS NULL AND k.revoked_at IS NULL AND ARRAY['admin','read','publish']::text[] <@ k.scopes FOR UPDATE OF s`,
            [hash(token), audience]
          )
        ).rows[0];
        if (!row || row.requests >= 900)
          throw new ApiError(401, 'native session expired, revoked or exhausted');
        const expected = nativeMac(row.pop_key, req.method, req.url, time, nonce, raw);
        if (!timingSafeEqual(Buffer.from(expected), Buffer.from(mac)))
          throw new ApiError(401, 'invalid native proof of possession');
        try {
          await db.query('INSERT INTO cargo_native_nonces(session_id,nonce) VALUES($1,$2)', [
            row.id,
            nonce
          ]);
        } catch (e) {
          if (e.code === '23505') throw new ApiError(409, 'native request replay');
          throw e;
        }
        await db.query('UPDATE cargo_native_sessions SET requests=requests+1 WHERE id=$1', [
          row.id
        ]);
        return {
          id: row.id,
          tenant_id: row.tenant_id,
          scopes: ['read', 'publish'],
          kind: 'native',
          audience,
          expires_at: row.expires_at
        };
      });
      req.trackiumNativeIdentity = identity;
      return identity;
    },
    async revoke(identity, id = identity.id) {
      if (identity.kind === 'native' && id !== identity.id)
        throw new ApiError(403, 'native session may revoke only itself');
      if (identity.kind !== 'native' && !identity.scopes.includes('admin'))
        throw new ApiError(403, 'owner required');
      const r = await pool.query(
        'UPDATE cargo_native_sessions SET revoked_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id',
        [identity.tenant_id, uuid(id)]
      );
      if (!r.rowCount) throw new ApiError(404, 'native session not found');
      return { revoked: true };
    }
  };
}
