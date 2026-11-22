import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { hash, transaction } from './shared.js';

export function customerMailConfig(env) {
  const enabled = env.CUSTOMER_ACCOUNTS_ENABLED ?? 'false';
  if (!['true','false'].includes(enabled)) throw new Error('Invalid CUSTOMER_ACCOUNTS_ENABLED');
  if (enabled === 'false') return null;
  if (env.ENABLE_WEB_WORKSPACE !== 'true') throw new Error('Customer accounts require ENABLE_WEB_WORKSPACE=true');
  let origin;
  try {
    origin = new URL(env.PUBLIC_ORIGIN);
  } catch {
    throw new Error('Customer accounts require an explicit PUBLIC_ORIGIN');
  }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
    throw new Error('PUBLIC_ORIGIN must contain only scheme, host and optional port');
  if (env.CUSTOMER_MAIL_PROVIDER === 'local') {
    if (env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_ID || env.DEPLOYMENT_PROFILE ||
      !['127.0.0.1','localhost','[::1]'].includes(origin.hostname) || !['http:','https:'].includes(origin.protocol))
      throw new Error('Local customer mail is restricted to loopback development');
    if (!env.ACCOUNT_MAIL_DIRECTORY || !isAbsolute(env.ACCOUNT_MAIL_DIRECTORY))
      throw new Error('Local customer mail requires an absolute ACCOUNT_MAIL_DIRECTORY');
    return { provider: 'local', directory: env.ACCOUNT_MAIL_DIRECTORY };
  }
  if (env.CUSTOMER_MAIL_PROVIDER !== 'resend') throw new Error('Invalid CUSTOMER_MAIL_PROVIDER');
  if (origin.protocol !== 'https:') throw new Error('Resend customer mail requires HTTPS PUBLIC_ORIGIN');
  if (!/^re_[a-zA-Z0-9_-]+$/.test(env.RESEND_API_KEY ?? '')) throw new Error('Invalid RESEND_API_KEY');
  if (!/^[a-zA-Z0-9._+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(env.CUSTOMER_MAIL_FROM ?? '') ||
      env.CUSTOMER_MAIL_FROM.length > 254) throw new Error('Invalid CUSTOMER_MAIL_FROM');
  if (!/^[a-fA-F0-9]{64}$/.test(env.CUSTOMER_MAIL_TOKEN_KEY ?? ''))
    throw new Error('CUSTOMER_MAIL_TOKEN_KEY must contain 32 random bytes encoded as hex');
  return {
    provider: 'resend', from: env.CUSTOMER_MAIL_FROM, apiKey: env.RESEND_API_KEY,
    tokenKey: Buffer.from(env.CUSTOMER_MAIL_TOKEN_KEY,'hex')
  };
}

const copy = {
  verify: ['Confirm your Trackium email', 'Open Trackium Lite, choose Enter confirmation code, and set your password.'],
  reset: ['Reset your Trackium password', 'Open Trackium Lite and choose Enter recovery code.'],
  invite: ['Join a company in Trackium', 'Sign in with this email, then use Join company under Company settings.']
};
function render(purpose, code) {
  const [subject, instruction] = copy[purpose];
  const expiry = 'This code expires 30 minutes after it was requested. If you did not expect this email, ignore it.';
  return { subject, text: instruction + '\n\nCode: ' + code + '\n\n' + expiry,
    html: '<h1>' + subject + '</h1><p>' + instruction + '</p><p><strong>Code:</strong> <code>' +
      code + '</code></p><p>' + expiry + '</p>' };
}

export function createCustomerMail(pool, config, send = fetch) {
  let pruneAfter = 0;
  const codeFor = id => createHmac('sha256',config.tokenKey).update('trackium-customer-mail-v1:' + id).digest('base64url');
  return {
    async initialize() {
      if (config.provider === 'local') {
        const info = await stat(config.directory);
        if (!info.isDirectory() || (info.mode & 0o077)) throw new Error('Account mail directory must be private (0700)');
      }
    },
    async enqueue(client, purpose, email, account = null, tenant = null, role = null, issuer = null) {
      const id = randomUUID();
      // Serialize duplicate successful submissions, even across Gateway replicas.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        ['customer-mail:' + hash(JSON.stringify([purpose,email,tenant,role]))]);
      const exists = await client.query(
        `SELECT 1 FROM customer_mail_tokens t WHERE t.purpose=$1 AND t.email=$2
         AND t.tenant_id IS NOT DISTINCT FROM $3 AND t.role IS NOT DISTINCT FROM $4
         AND t.expires_at>now()
         AND (t.purpose<>'invite' OR EXISTS (
           SELECT 1 FROM customer_members m WHERE m.tenant_id=t.tenant_id AND m.account_id=t.issuer_id
           AND (m.role='owner' OR (m.role='admin' AND t.role<>'admin'))
         )) LIMIT 1`,
        [purpose,email,tenant,role]);
      if (exists.rowCount) return;

      const code = config.provider === 'resend' ? codeFor(id) : randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO customer_mail_tokens(token_hash,account_id,email,purpose,tenant_id,role,issuer_id,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')`,
        [hash(code), account, email, purpose, tenant, role, issuer]);
      if (config.provider === 'resend')
        await client.query('INSERT INTO customer_mail_jobs(id,token_hash,sender) VALUES($1,$2,$3)',
          [id,hash(code),config.from]);
      else
        await writeFile(join(config.directory,id + '.json'),JSON.stringify({ email, purpose, code }),
          { flag:'wx', mode:0o600 });
    },
    async tick() {
      if (Date.now() >= pruneAfter) {
        await pool.query("DELETE FROM customer_mail_tokens WHERE expires_at<now()-interval '24 hours'");
        pruneAfter = Date.now() + 60000;
      }
      await pool.query(
        `UPDATE customer_mail_jobs j SET outcome='expired' FROM customer_mail_tokens t
         WHERE j.token_hash=t.token_hash AND j.outcome IS NULL AND j.next_at<=now()
         AND (t.expires_at<=now()+interval '30 seconds' OR j.attempts>=8)`);
      const job = await transaction(pool,null,async client => {
        const { rows: [next] } = await client.query(
          `SELECT j.id,j.sender,j.token_hash,t.email,t.purpose FROM customer_mail_jobs j
           JOIN customer_mail_tokens t USING(token_hash) WHERE j.outcome IS NULL AND j.next_at<=now()
           AND j.attempts<8 AND t.expires_at>now()+interval '30 seconds'
           ORDER BY j.next_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`);
        if (!next) return null;
        const { rows: [lease] } = await client.query(
          `UPDATE customer_mail_jobs SET attempts=attempts+1,next_at=now()+interval '30 seconds'
           WHERE id=$1 RETURNING attempts`, [next.id]);
        return { ...next, attempts:lease.attempts };
      });
      if (!job) return;
      const code = codeFor(job.id);
      let outcome = 'rejected';
      let retryAfter = 0;
      if (hash(code) === job.token_hash) {
        try {
          const response = await send('https://api.resend.com/emails', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
            headers: { authorization: 'Bearer ' + config.apiKey, 'content-type': 'application/json',
              'idempotency-key': 'trackium-customer-mail/' + job.id },
            body: JSON.stringify({ from: job.sender, to: [job.email], ...render(job.purpose,code) })
          });
          const retry = [408,409,425,429].includes(response.status) || response.status >= 500;
          outcome = response.ok ? 'accepted' : retry ? null : 'rejected';
          const delay = response.headers.get('retry-after');
          if (delay && /^\d{1,8}$/.test(delay)) retryAfter = Number(delay);
          await response.body?.cancel();
        } catch {
          outcome = null;
        }
      }
      await pool.query(
        `UPDATE customer_mail_jobs SET outcome=$3,next_at=now()+$4*interval '1 second'
         WHERE id=$1 AND attempts=$2 AND outcome IS NULL`, [job.id,job.attempts,outcome,
          Math.max(Math.min(300, 5 * 2 ** (job.attempts - 1)), Math.min(retryAfter,1800))]);
    }
  };
}

export function startCustomerMail(mail, logger) {
  let timer, pending, stopped = false;
  function loop() {
    pending = mail.tick()
      .catch(() => logger.error('Customer mail worker failed'))
      .finally(() => { if (!stopped) timer = setTimeout(loop, 250); });
  }
  loop();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
  };
}
