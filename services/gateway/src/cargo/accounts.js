import qrcode from 'qrcode-generator';
import { manageCoreDeviceAccess } from './core-device-access.js';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { limitCustomerRequest, takeCustomerRate } from './customer-rate.js';
import { ApiError, invalid, object, text, uuid } from '../telemetry/schema.js';
import { body, reply, query } from '../telemetry/api.js';
import { claimDevice, renameOwnedDevice } from './device-activation.js';
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
export function createPasswordDigest(value) {
  return digest(password(value), randomBytes(16).toString('hex'));
}
function safeEqual(left, right) {
  return typeof left === 'string' && left.length === right.length &&
    Buffer.byteLength(left) === Buffer.byteLength(right) &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export async function matchesPasswordDigest(value, encoded) {
  return safeEqual(await digest(password(value), encoded.split(':')[0]), encoded);
}

export function createAccounts(pool, config, pairing, telemetry, mail) {
  const demoMode = config.demoEnabled === true;
  const pilotEnabled = config.pilotEnabled === true;
  // The same predicate guards login and every existing cookie request.
  const demoMembership = `d.enabled AND (
    (COALESCE(p.active,false)=false AND d.tenant_id=m.tenant_id AND m.role='viewer')
    OR ($3 AND p.active AND p.tenant_id=m.tenant_id AND m.role='owner')
  )`;
  let running = 0;
  function cookie(res, raw, age = 43200) {
    res.setHeader('Set-Cookie', 'trk_account=' + raw +
      '; Path=/v1/; HttpOnly; SameSite=Strict; Max-Age=' + age +
      (new URL(config.publicOrigin).protocol === 'https:' ? '; Secure' : ''));
  }
  async function session(req, write = false) {
    const cookies = (req.headers.cookie ?? '').split(';').map(value => value.trim())
      .filter(value => value.startsWith('trk_account='));
    if (!cookies.length) return null;
    pairing.originCheck(req, write);
    const raw = cookies.length === 1 ? cookies[0].slice('trk_account='.length) : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new ApiError(401, 'Sign in to continue');
    const { rows: [result] } = await pool.query(
      `SELECT s.id,s.account_id,s.tenant_id,s.expires_at,a.email,m.role,t.name AS company_name,d.account_id IS NOT NULL AS demo,
         COALESCE(p.active,false) AS pilot,
         m.role IN ('owner','admin') AND EXISTS (
           SELECT 1 FROM customer_aovx_approvals x WHERE x.tenant_id=s.tenant_id
         ) AS can_enroll_aovx
       FROM customer_sessions s JOIN customer_accounts a ON a.id=s.account_id
       LEFT JOIN customer_members m ON m.account_id=s.account_id AND m.tenant_id=s.tenant_id
       LEFT JOIN telemetry_tenants t ON t.id=m.tenant_id
       LEFT JOIN customer_demo d ON d.account_id=a.id
       LEFT JOIN customer_demo_pilot p ON p.account_id=d.account_id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND a.verified_at IS NOT NULL
       AND (CASE WHEN $2 THEN ${demoMembership}
            ELSE d.account_id IS NULL END)`, [hash(raw), demoMode, pilotEnabled]);
    if (!result) throw new ApiError(401, 'Sign in to continue');
    if (write && !safeEqual(req.headers['x-csrf-token'], csrf(raw))) throw new ApiError(403, 'CSRF check failed');
    if (result.demo) delete result.email;
    return { ...result, csrf: csrf(raw), kind: 'session', customer: true,
      scopes: !result.role ? [] : result.role === 'viewer' ? ['read'] : ['read', 'shipments'],
      core_device_access: config.coreDeviceAccessEnabled === true && (!demoMode || result.pilot) && result.role === 'owner',
      device_activation: config.deviceActivationEnabled === true && !demoMode && result.role === 'owner',
      simulation_enabled: false };
  }
  async function start(client, account, company, res) {
    const raw = token();
    await client.query('DELETE FROM customer_sessions WHERE account_id=$1 AND expires_at<=now()', [account]);
    await client.query('INSERT INTO customer_sessions(id,account_id,tenant_id,token_hash) VALUES($1,$2,$3,$4)',
      [randomUUID(), account, company, hash(raw)]);
    cookie(res, raw);
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
    async route(req, res, url) {
      query(url, []);
      const action = url.pathname.slice('/v1/account/'.length);
      const write = req.method === 'POST';
      pairing.originCheck(req, write);
      if (write && action === 'aovx-enroll') {
        const identity = await authenticated(req, true);
        manager(identity);
        if (!identity.can_enroll_aovx) throw new ApiError(403, 'Physical enrollment is unavailable for this company');
        await limitCustomerRequest(pool, req);
        const { input } = await body(req, 4096);
        object(input, ['label','device_id_bcd','ownership']);
        if (input.ownership !== 'confirmed') invalid('Confirm that your company controls this tracker');
        const device = await transaction(pool, identity.tenant_id, async client => {
          await client.query('SELECT id FROM customer_accounts WHERE id=$1 FOR NO KEY UPDATE', [identity.account_id]);
          const active = await client.query(
            `SELECT 1 FROM customer_sessions s JOIN customer_members m
               ON m.tenant_id=s.tenant_id AND m.account_id=s.account_id
             WHERE s.id=$1 AND s.expires_at>now() AND m.role IN ('owner','admin')`, [identity.id]
          );
          if (!active.rowCount) throw new ApiError(403, 'Company management permission required');
          const record = await telemetry.register(identity.tenant_id, { label: input.label, mode: 'real' }, 'physical', client);
          await telemetry.bindAovxDevice(identity.tenant_id, null, {
            device_id: record.id, device_id_bcd: input.device_id_bcd
          }, client);
          return record;
        });
        return reply(res, 201, device);
      }
      if (demoMode && !((write && (action === 'login' || /^core-device-(issue|list|approve|revoke)$/.test(action))) ||
          (req.method === 'GET' && action === 'session')))
        throw new ApiError(404, 'Account operation not found');
      if (req.method === 'GET' && action === 'session') {
        const identity = await authenticated(req, false);
        const companies = await pool.query(
          `SELECT tenant_id AS id,t.name,m.role FROM customer_members m JOIN telemetry_tenants t ON t.id=m.tenant_id
           WHERE account_id=$1 AND ($2::uuid IS NULL OR m.tenant_id=$2) ORDER BY name,t.id`,
          [identity.account_id, identity.demo ? identity.tenant_id : null]);
        return reply(res, 200, { ...identity, companies: companies.rows, android_downloads:config.androidDownloads });
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
      if (running >= 4) throw new ApiError(429, 'Try again in a minute');
      running++;
      try {
        await limitCustomerRequest(pool, req);
        const { input } = await body(req, 4096);
        return await change(req, res, action, input);
      } finally {
        running--;
      }
    }
  };

  async function change(req, res, action, input) {
    if (action === 'register' || action === 'recover') {
      object(input, ['email']);
      const email = normalizedEmail(input.email);
      await takeCustomerRate(pool, 'email:' + action + ':' + hash(email), 5);
      if (action === 'register') {
        const encoded = await digest(token(), randomBytes(16).toString('hex'));
        await transaction(pool, null, async client => {
          const { rows: [account] } = await client.query(
            `INSERT INTO customer_accounts(id,email,password_digest) VALUES($1,$2,$3)
             ON CONFLICT(email) DO NOTHING RETURNING id`, [randomUUID(), email, encoded]);
          if (account) await mail.enqueue(client, 'verify', email, account.id);
        });
        return reply(res, 202, { accepted: true });
      }
      if (action === 'recover') {
        const started = performance.now();
        await transaction(pool, null, async client => {
          const { rows: [account] } = await client.query('SELECT id,verified_at FROM customer_accounts a WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM customer_demo d WHERE d.account_id=a.id)', [email]);
          if (account) await mail.enqueue(client, account.verified_at ? 'reset' : 'verify', email, account.id);
        });
        await delay(Math.max(0, 150 - (performance.now() - started)));
        return reply(res, 202, { accepted: true });
      }
    }
    if (action === 'login') {
      const field = demoMode ? 'username' : 'email';
      object(input, [field, 'password']);
      const identifier = demoMode ? text(input.username, 128).trim() : normalizedEmail(input.email);
      await takeCustomerRate(pool, field + ':login:' + hash(identifier), 5);
      const { rows: [account] } = await pool.query(
        demoMode
          ? `SELECT a.id,a.password_digest,a.verified_at FROM customer_demo d
             JOIN customer_accounts a ON a.id=d.account_id WHERE d.username=$1 AND d.enabled`
          : `SELECT a.id,a.password_digest,a.verified_at FROM customer_accounts a
             WHERE a.email=$1 AND NOT EXISTS (SELECT 1 FROM customer_demo d WHERE d.account_id=a.id)`, [identifier]);
      const invalidLogin = () => demoMode
        ? new ApiError(401, 'Invalid username or password')
        : credentialsError();
      const candidate = await digest(password(input.password), account?.password_digest.split(':')[0] || '0'.repeat(32));
      if (!account?.verified_at || !safeEqual(candidate, account.password_digest)) throw invalidLogin();
      await transaction(pool, null, async client => {
        const locked = await client.query('SELECT id FROM customer_accounts WHERE id=$1 AND password_digest=$2 FOR UPDATE',
          [account.id, candidate]);
        if (!locked.rowCount) throw invalidLogin();
        const { rows: [company] } = await client.query(
          `SELECT m.tenant_id FROM customer_members m LEFT JOIN customer_demo d ON d.account_id=m.account_id
           LEFT JOIN customer_demo_pilot p ON p.account_id=d.account_id
           WHERE m.account_id=$1 AND (CASE WHEN $2 THEN ${demoMembership}
             ELSE d.account_id IS NULL END) ORDER BY m.tenant_id LIMIT 1`, [account.id,demoMode,pilotEnabled]);
        if (demoMode && !company) throw invalidLogin();
        await start(client, account.id, company?.tenant_id ?? null, res);
      });
      return reply(res, 200, { signed_in: true });
    }
    if (action === 'verify' || action === 'reset') {
      object(input, ['code','password']);
      const encoded = await createPasswordDigest(input.password);
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
        await client.query('SELECT id FROM customer_accounts WHERE id=$1 FOR KEY SHARE', [identity.account_id]);
        const prior = await client.query('DELETE FROM customer_sessions WHERE id=$1 RETURNING id', [identity.id]);
        if (!prior.rowCount) throw new ApiError(401, 'Session expired');
        await start(client, identity.account_id, nextCompany, res);
      });
      return reply(res, 200, { signed_in: true });
    }
    const coreOperation = /^core-device-(issue|list|approve|revoke)$/.exec(action);
    if (coreOperation) {
      if (!config.coreDeviceAccessEnabled) throw new ApiError(404,'Account operation not found');
      if (identity.role !== 'owner' || !identity.tenant_id || (demoMode && !identity.pilot))
        throw new ApiError(403,'Company owner required');
      const result = await manageCoreDeviceAccess(pool,identity,coreOperation[1],input);
      if (coreOperation[1] !== 'issue') return reply(res,200,result);
      const connection_link = new URL('/app/connect-core',config.publicOrigin);
      connection_link.hash = result.code;
      const qr = qrcode(0,'M');
      qr.addData(connection_link.href);
      qr.make();
      return reply(res,200,{...result,connection_link:connection_link.href,qr_image:qr.createDataURL(4,16)});
    }
    if (action === 'rename-device') {
      if (identity.role !== 'owner' || !identity.tenant_id) throw new ApiError(403, 'Company owner required');
      return reply(res,200,await renameOwnedDevice(pool,identity,input));
    }
    if (action === 'activate-device') {
      if (!config.deviceActivationEnabled) throw new ApiError(404, 'Account operation not found');
      if (identity.role !== 'owner' || !identity.tenant_id) throw new ApiError(403, 'Company owner required');
      await takeCustomerRate(pool,'device-claim:' + hash(identity.account_id),6);
      return reply(res,201,await claimDevice(pool,telemetry,identity,input));
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
          await mail.enqueue(client, 'invite', normalizedEmail(input.email), null, identity.tenant_id, input.role, identity.account_id);
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
          await client.query("DELETE FROM customer_mail_tokens WHERE tenant_id=$1 AND purpose='invite' AND (issuer_id=$2 OR email=(SELECT email FROM customer_accounts WHERE id=$2))",
            [identity.tenant_id,member]);
        }
      });
      return reply(res, 200, { accepted: true });
    }
    throw new ApiError(404, 'Account operation not found');
  }
}
