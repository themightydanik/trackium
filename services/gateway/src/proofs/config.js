import { readFile, stat } from 'node:fs/promises';
import { ProofError, chainId, hexId } from './commitment.js';
function positive(env, key, fallback, max) {
  const n = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('Invalid ' + key);
  return n;
}
export function proofConfig(env = process.env) {
  const mode = env.PROOF_MODE ?? 'disabled';
  if (!['disabled', 'test', 'live'].includes(mode))
    throw new Error('PROOF_MODE must be disabled, test or live');
  if (mode === 'live' && env.PROOF_ALLOW_LIVE !== 'true')
    throw new Error('Live publication requires PROOF_ALLOW_LIVE=true');
  const publisher = env.PROOF_PUBLISHER ?? 'server';
  if (!['server', 'local'].includes(publisher)) throw new Error('Invalid PROOF_PUBLISHER');
  if (
    mode === 'live' &&
    (env.MINIMA_CHAIN_ID ?? '0x00') === '0x00' &&
    env.PROOF_ALLOW_MAINNET !== 'true'
  )
    throw new Error('Mainnet requires PROOF_ALLOW_MAINNET=true');
  return {
    mode,
    publisher,
    allowMainnet: env.PROOF_ALLOW_MAINNET === 'true',
    maxPublications: positive(env, 'PROOF_MAX_PUBLICATIONS', 1, 100),
    jobSigningFile: env.PROOF_JOB_SIGNING_KEY_FILE,
    chain: chainId(env.MINIMA_CHAIN_ID ?? '0x00'),
    publisherAddress: env.MINIMA_PUBLISHER_ADDRESS ? hexId(env.MINIMA_PUBLISHER_ADDRESS) : null,
    depth: positive(env, 'PROOF_CONFIRMATION_DEPTH', 6, 100),
    maxAttempts: positive(env, 'PROOF_MAX_ATTEMPTS', 5, 10),
    pollMs: 5000,
    writerUrl: env.MINIMA_RPC_URL,
    writerFile: env.MINIMA_RPC_CREDENTIAL_FILE,
    readerUrl: env.MINIMA_READER_RPC_URL,
    readerFile: env.MINIMA_READER_CREDENTIAL_FILE,
    caFile: env.MINIMA_RPC_CA_FILE,
    readerCaFile: env.MINIMA_READER_CA_FILE,
    coreVersion: '1.0.49.4'
  };
}
export async function credentials(file) {
  try {
    const s = await stat(file);
    if (!s.isFile() || (s.mode & 0o077) !== 0 || s.size > 4096) throw new Error();
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (
      typeof value.username !== 'string' ||
      !value.username ||
      value.username.includes(':') ||
      typeof value.password !== 'string' ||
      !value.password ||
      /[\r\n]/.test(value.username + value.password)
    )
      throw new Error();
    return { username: value.username, password: value.password };
  } catch {
    throw new ProofError('RPC_CREDENTIAL_FILE_UNAVAILABLE', { retryable: false });
  }
}
