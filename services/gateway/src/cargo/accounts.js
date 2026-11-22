import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { writeFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { ApiError, invalid, object, text, uuid } from '../telemetry/schema.js';
import { body, reply, query } from '../telemetry/api.js';
import { csrf } from './pairing.js';
import { hash, tenantLock, transaction } from './shared.js';

const derive = promisify(scrypt);
const token = () => randomBytes(32).toString('base64url');
const roles = ['admin', 'dispatcher', 'viewer'];
const credentialsError = () => new ApiError(401, 'Invalid email or password, or email not confirmed');

function normalizedEmail(value) {
  text(value, 254);
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Enter a valid email address');
  return email;
}
function password(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || value.length < 12 ||
      Buffer.byteLength(value) > 256) invalid('Password must contain at least 12 characters and at most 256 bytes');
  return value;
}
async function digest(value, salt) {
  const derived = await derive(value, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return salt + ':' + derived.toString('hex');
}
function safeEqual(left, right) {
  return typeof left === 'string' && left.length === right.length &&
    Buffer.byteLength(left) === Buffer.byteLength(right) &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function createAccounts(pool, config, pairing, telemetry) {
  const directory = config.accountMailDirectory;
  if (!isAbsolute(directory)) throw new Error('ACCOUNT_MAIL_DIRECTORY must be an absolute path');
  const rates = new Map();
  const emailRates = new Map();
  let total = 0, windowStart = 0, running = 0;
  function limit(req) {
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      rates.clear();
      emailRates.clear();
      total = 0;
    }
    const ip = req.socket.remoteAddress;
    const count = rates.get(ip) || 0;
    if (count >= 30 || total >= 100 || running >= 4) throw new ApiError(429, 'Try again in a minute');
    rates.set(ip, count + 1);
    total++;
  }
  function cookie(res, raw, age = 43200) {
    res.setHeader('Set-Cookie', 'trk_account=' + raw +
      '; Path=/v1/; HttpOnly; SameSite=Strict; Max-Age=' + age +
      (config.publicOrigin.startsWith('https:') ? '; Secure' : ''));
  }
  async function session(req, write = false) {
    const cookies = (req.headers.cookie ?? '').split(';').map(value => value.trim())
      .filter(value => value.startsWith('trk_account='));
    if (!cookies.length) return null;
    pairing.originCheck(req, write);
    const raw = cookies.length === 1 ? cookies[0].slice('trk_account='.length) : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new ApiError(401, 'Sign in to continue');
    const { rows: [result] } = await pool.query(
      `SELECT s.id,s.account_id,s.tenant_id,s.expires_at,a.email,m.role,t.name AS company_name
       FROM customer_sessions s JOIN customer_accounts a ON a.id=s.account_id
       LEFT JOIN customer_members m ON m.account_id=s.account_id AND m.tenant_id=s.tenant_id
       LEFT JOIN telemetry_tenants t ON t.id=m.tenant_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL`, [hash(raw)]);
    if (!result) throw new ApiError(401, 'Sign in to continue');
    if (write && !safeEqual(req.headers['x-csrf-token'], csrf(raw))) throw new ApiError(403, 'CSRF check failed');
    return { ...result, csrf: csrf(raw), kind: 'session', customer: true,
      scopes: !result.role ? [] : result.role === 'viewer' ? ['read'] : ['read', 'shipments'],
      simulation_enabled: false };
  }
  async function start(client, account, company, res) {
    const raw = token();
    await client.query('DELETE FROM customer_sessions WHERE account_id=$1 AND expires_at<=now()', [account]);
    await client.query('INSERT INTO customer_sessions(id,account_id,tenant_id,token_hash) VALUES($1,$2,$3,$4)',
      [randomUUID(), account, company, hash(raw)]);
    cookie(res, raw);
  }
  async function mail(client, purpose, email, account = null, tenant = null, role = null, issuer = null) {
    const code = token();
    await client.query('DELETE FROM customer_mail_tokens WHERE expires_at<=now()');
    await client.query(
      `INSERT INTO customer_mail_tokens(token_hash,account_id,email,purpose,tenant_id,role,issuer_id,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')`,
      [hash(code), account, email, purpose, tenant, role, issuer]);
    await writeFile(join(directory, randomUUID() + '.json'), JSON.stringify({ email, purpose, code }),
      { flag: 'wx', mode: 0o600 });
  }
  async function consume(client, code, purpose, email = null) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) invalid('Invalid or expired code');
    const { rows: [result] } = await client.query(
      `DELETE FROM customer_mail_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now()
       AND ($3::text IS NULL OR email=$3) RETURNING *`, [hash(code), purpose, email]);
    if (!result) invalid('Invalid or expired code');
    return result;
  }
  const authenticated = async (req, write) => {
    const identity = await session(req, write);
    if (!identity) throw new ApiError(401, 'Sign in to continue');
    return identity;
  };
  const manager = (identity) => {
    if (!['owner','admin'].includes(identity.role)) throw new ApiError(403, 'Company management permission required');
  };
  return {
    session,
    clear: res => cookie(res, '', 0),
    async initialize() {
      const info = await stat(directory);
      if (!info.isDirectory() || (info.mode & 0o077)) throw new Error('Account mail directory must be private (0700)');
    },
    async route(req, res, url) {
      query(url, []);
      const action = url.pathname.slice('/v1/account/'.length);
      const write = req.method === 'POST';
      pairing.originCheck(req, write);
      if (req.method === 'GET' && action === 'session') {
        const identity = await authenticated(req, false);
        const companies = await pool.query(
          `SELECT tenant_id AS id,t.name,m.role FROM customer_members m JOIN telemetry_tenants t ON t.id=m.tenant_id
           WHERE account_id=$1 ORDER BY name,t.id`, [identity.account_id]);
        return reply(res, 200, { ...identity, companies: companies.rows });
      }
      if (req.method === 'GET' && action === 'members') {
        const identity = await authenticated(req, false);
        manager(identity);
        const members = await pool.query(
          `SELECT a.id,a.email,m.role FROM customer_members m JOIN customer_accounts a ON a.id=m.account_id
           WHERE m.tenant_id=$1 ORDER BY a.email`, [identity.tenant_id]);
        return reply(res, 200, { members: members.rows });
      }
      if (!write) throw new ApiError(404, 'Account operation not found');
      limit(req);
      running++;
      try {
        const { input } = await body(req, 4096);
        return await change(req, res, action, input);
      } finally {
        running--;
      }
    }
  };

  async function change(req, res, action, input) {
    if (action === 'register' || action === 'login' || action === 'recover') {
      object(input, action === 'login' ? ['email', 'password'] : ['email']);
      const email = normalizedEmail(input.email);
      const bucket = action + ':' + hash(email);
      const attempts = emailRates.get(bucket) || 0;
      if (attempts >= 5) throw new ApiError(429, 'Try again in a minute');
      emailRates.set(bucket, attempts + 1);
      if (action === 'register') {
        const encoded = await digest(token(), randomBytes(16).toString('hex'));
        await transaction(pool, null, async client => {
          const { rows: [account] } = await client.query(
            `INSERT INTO customer_accounts(id,email,password_digest) VALUES($1,$2,$3)
             ON CONFLICT(email) DO NOTHING RETURNING id`, [randomUUID(), email, encoded]);
          if (account) await mail(client, 'verify', email, account.id);
        });
        return reply(res, 202, { accepted: true });
      }
      if (action === 'recover') {
        await transaction(pool, null, async client => {
          const { rows: [account] } = await client.query('SELECT id,verified_at FROM customer_accounts WHERE email=$1', [email]);
          if (account) await mail(client, account.verified_at ? 'reset' : 'verify', email, account.id);
        });
        return reply(res, 202, { accepted: true });
      }
      const { rows: [account] } = await pool.query('SELECT * FROM customer_accounts WHERE email=$1', [email]);
      const candidate = await digest(password(input.password), account?.password_digest.split(':')[0] || '0'.repeat(32));
      if (!account?.verified_at || !safeEqual(candidate, account.password_digest)) throw credentialsError();
      await transaction(pool, null, async client => {
        const locked = await client.query('SELECT id FROM customer_accounts WHERE id=$1 AND password_digest=$2 FOR UPDATE',
          [account.id, candidate]);
        if (!locked.rowCount) throw credentialsError();
        const { rows: [company] } = await client.query(
          'SELECT tenant_id FROM customer_members WHERE account_id=$1 ORDER BY tenant_id LIMIT 1', [account.id]);
        await start(client, account.id, company?.tenant_id ?? null, res);
      });
      return reply(res, 200, { signed_in: true });
    }
    if (action === 'verify' || action === 'reset') {
      object(input, ['code','password']);
      const encoded = await digest(password(input.password), randomBytes(16).toString('hex'));
      await transaction(pool, null, async client => {
        if (typeof input.code !== 'string' || input.code.length !== 43) invalid('Invalid or expired code');
        const account = await client.query(
          `SELECT a.id FROM customer_accounts a JOIN customer_mail_tokens m ON m.account_id=a.id
           WHERE m.token_hash=$1 AND m.purpose=$2 FOR UPDATE OF a`, [hash(input.code),action]);
        if (!account.rowCount) invalid('Invalid or expired code');
        const entry = await consume(client, input.code, action);
        if (action === 'verify') {
          const updated = await client.query(
            'UPDATE customer_accounts SET verified_at=now(),password_digest=$2 WHERE id=$1 AND verified_at IS NULL',
            [entry.account_id,encoded]);
          if (!updated.rowCount) invalid('Invalid or expired code');
        } else {
          await client.query('UPDATE customer_accounts SET password_digest=$2 WHERE id=$1', [entry.account_id, encoded]);
          await client.query('DELETE FROM customer_sessions WHERE account_id=$1', [entry.account_id]);
        }
        await client.query('DELETE FROM customer_mail_tokens WHERE account_id=$1 AND purpose=$2', [entry.account_id,action]);
      });
      return reply(res, 200, { accepted: true });
    }
    const identity = await authenticated(req, true);
    let nextCompany;
    if (action === 'company' || action === 'switch' || action === 'accept') {
      await transaction(pool, null, async client => {
        if (action === 'company') {
          object(input, ['name']);
          text(input.name, 120);
          nextCompany = randomUUID();
          await client.query('INSERT INTO telemetry_tenants(id,name) VALUES($1,$2)', [nextCompany, input.name.trim()]);
          await client.query("INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,'owner')",
            [identity.account_id,nextCompany]);
        } else if (action === 'accept') {
          object(input, ['code']);
          if (typeof input.code !== 'string' || input.code.length !== 43) invalid('Invalid or expired code');
          const { rows: [pending] } = await client.query(
            "SELECT tenant_id FROM customer_mail_tokens WHERE token_hash=$1 AND purpose='invite' AND email=$2",
            [hash(input.code),identity.email]);
          if (!pending) invalid('Invalid or expired code');
          await tenantLock(client, pending.tenant_id);
          const entry = await consume(client, input.code, 'invite', identity.email);
          nextCompany = entry.tenant_id;
          const { rows: [issuer] } = await client.query('SELECT role FROM customer_members WHERE tenant_id=$1 AND account_id=$2',
            [nextCompany, entry.issuer_id]);
          if (!issuer || !['owner','admin'].includes(issuer.role) || (entry.role === 'admin' && issuer.role !== 'owner'))
            throw new ApiError(403, 'Invitation is no longer authorized');
          await client.query('INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [identity.account_id,nextCompany,entry.role]);
        } else {
          object(input, ['company']);
          nextCompany = uuid(input.company);
        }
        const membership = await client.query('SELECT 1 FROM customer_members WHERE account_id=$1 AND tenant_id=$2 FOR SHARE',
          [identity.account_id, nextCompany]);
        if (!membership.rowCount) throw new ApiError(404, 'Company not found');
        const prior = await client.query('DELETE FROM customer_sessions WHERE id=$1 RETURNING id', [identity.id]);
        if (!prior.rowCount) throw new ApiError(401, 'Session expired');
        await start(client, identity.account_id, nextCompany, res);
      });
      return reply(res, 200, { signed_in: true });
    }
    if (action === 'device') {
      manager(identity);
      object(input, ['label']);
      return reply(res, 201, await telemetry.register(identity.tenant_id, { label: input.label, mode: 'real' }));
    }
    if (action === 'invite' || action === 'member') {
      manager(identity);
      await transaction(pool, identity.tenant_id, async client => {
        const active = await client.query('SELECT role FROM customer_members WHERE tenant_id=$1 AND account_id=$2',
          [identity.tenant_id, identity.account_id]);
        manager(active.rows[0] || {});
        if (action === 'invite') {
          object(input, ['email','role']);
          if (!roles.includes(input.role) || (input.role === 'admin' && active.rows[0].role !== 'owner'))
            throw new ApiError(403, 'Cannot grant this role');
          await mail(client, 'invite', normalizedEmail(input.email), null, identity.tenant_id, input.role, identity.account_id);
        } else {
          object(input, ['member','role']);
          if (input.role !== null && !roles.includes(input.role)) invalid('Invalid role');
          const member = uuid(input.member);
          const { rows: [target] } = await client.query('SELECT role FROM customer_members WHERE tenant_id=$1 AND account_id=$2',
            [identity.tenant_id, member]);
          if (!target) throw new ApiError(404, 'Member not found');
          if (target.role === 'owner' || (active.rows[0].role !== 'owner' && [target.role,input.role].includes('admin')))
            throw new ApiError(403, 'Cannot change this member');
          if (input.role === null)
            await client.query('DELETE FROM customer_members WHERE tenant_id=$1 AND account_id=$2', [identity.tenant_id,member]);
          else await client.query('UPDATE customer_members SET role=$3 WHERE tenant_id=$1 AND account_id=$2',
            [identity.tenant_id,member,input.role]);
          await client.query("DELETE FROM customer_mail_tokens WHERE tenant_id=$1 AND purpose='invite' AND email=(SELECT email FROM customer_accounts WHERE id=$2)",
            [identity.tenant_id,member]);
        }
      });
      return reply(res, 200, { accepted: true });
    }
    throw new ApiError(404, 'Account operation not found');
  }
}
