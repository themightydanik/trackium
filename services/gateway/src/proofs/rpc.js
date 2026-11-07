import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { credentials } from './config.js';
import { ProofError } from './commitment.js';
import { hash } from '../cargo/shared.js';
export function endpoint(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new ProofError('RPC_ENDPOINT_REQUIRED', { retryable: false });
  }
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    (u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
  )
    throw new ProofError('UNSAFE_RPC_ENDPOINT', { retryable: false });
  return u;
}
export function sanitize(value, secrets = []) {
  if (typeof value === 'string') {
    let text = value;
    for (const secret of secrets) if (secret) text = text.split(secret).join('[REDACTED]');
    return text;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, secrets));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /^(password|seed|mnemonic|privatekey|authorization|cookie|secret|token)$/i.test(k)
          ? '[REDACTED]'
          : sanitize(v, secrets)
      ])
    );
  return value;
}
export async function createRpc({ url, file, caFile, readOnly = false, requestTimeout = 130000 }) {
  const u = endpoint(url),
    auth = await credentials(file),
    authorization = 'Basic ' + Buffer.from(auth.username + ':' + auth.password).toString('base64');
  const ca = caFile ? await readFile(caFile) : undefined;
  const readonly = new Set(['status', 'txpow', 'scripts', 'coins']);
  const allowed = new Set([
    ...readonly,
    'txncreate',
    'txnlist',
    'txnaddamount',
    'txnstate',
    'txnbasics',
    'txnsign',
    'txncheck',
    'txnexport',
    'txnimport',
    'txnmine',
    'txnminepost'
  ]);
  return {
    async call(command, audit) {
      const verb = command.split(' ')[0];
      if (
        !allowed.has(verb) ||
        (readOnly && !readonly.has(verb)) ||
        /[;\r\n]/.test(command) ||
        Buffer.byteLength(command) > 2097200
      )
        throw new ProofError('RPC_COMMAND_DENIED', { retryable: false });
      const deadline = verb === 'txnmine' ? requestTimeout : Math.min(requestTimeout, 10000);
      const ticket = audit
        ? await audit.start(verb, { verb, command_sha256: hash(command) })
        : null;
      try {
        const result = await new Promise((resolve, reject) => {
          let totalTimer;
          const done = (fn, value) => {
            clearTimeout(totalTimer);
            fn(value);
          };
          const request = (u.protocol === 'https:' ? https : http).request(
            u,
            {
              method: 'POST',
              headers: {
                Authorization: authorization,
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(command),
                Connection: 'close'
              },
              ca,
              rejectUnauthorized: true
            },
            (res) => {
              if (res.statusCode !== 200) {
                res.on('error', () => {});
                request.destroy();
                done(reject, new ProofError(res.statusCode === 401 ? 'RPC_AUTH' : 'RPC_HTTP'));
                return;
              }
              let length = 0;
              const chunks = [];
              res.on('data', (chunk) => {
                length += chunk.length;
                if (length > 2097152) {
                  request.destroy(new ProofError('RPC_RESPONSE_LIMIT'));
                  return;
                }
                chunks.push(chunk);
              });
              res.on('end', () => {
                try {
                  done(resolve, JSON.parse(Buffer.concat(chunks).toString('utf8')));
                } catch {
                  done(reject, new ProofError('RPC_INVALID_JSON'));
                }
              });
              res.on('error', () => done(reject, new ProofError('RPC_NETWORK')));
            }
          );
          request.setTimeout(deadline, () => request.destroy(new ProofError('RPC_TIMEOUT')));
          request.on('error', (e) =>
            done(reject, e instanceof ProofError ? e : new ProofError('RPC_NETWORK'))
          );
          totalTimer = setTimeout(() => request.destroy(new ProofError('RPC_TIMEOUT')), deadline);
          request.end(command);
        });
        const clean = sanitize(result, [auth.password, authorization, authorization.slice(6)]);
        if (audit) await audit.finish(ticket, clean, null);
        if (result.status !== true) {
          const notFound =
            typeof result.error === 'string' &&
            /^(?:Transaction not found|TxPoW not found)/i.test(result.error);
          throw new ProofError(notFound ? 'RPC_NOT_FOUND' : 'RPC_COMMAND_ERROR');
        }
        return result.response;
      } catch (e) {
        const error = e instanceof ProofError ? e : new ProofError('RPC_NETWORK');
        if (audit) await audit.fail(ticket, error.code);
        throw error;
      }
    }
  };
}
