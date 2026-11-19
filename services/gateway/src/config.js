import { proofConfig } from './proofs/config.js';
function integer(env, name, fallback, max = 2147483647) {
  const value = env[name] ?? String(fallback);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > max
  ) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(value);
}

export function readConfig(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (
    env.ENABLE_FIXTURE_ADAPTER !== undefined &&
    !['true', 'false'].includes(env.ENABLE_FIXTURE_ADAPTER)
  ) {
    throw new Error('ENABLE_FIXTURE_ADAPTER must be true or false');
  }
  for (const name of ['ENABLE_WEB_WORKSPACE', 'ENABLE_SERVER_SIMULATOR', 'ENABLE_NATIVE_CLIENTS', 'ENABLE_TCP_RECEIVER'])
    if (env[name] !== undefined && !['true', 'false'].includes(env[name]))
      throw new Error(name + ' must be true or false');
  if (env.DEPLOYMENT_PROFILE !== undefined && env.DEPLOYMENT_PROFILE !== 'railway-test')
    throw new Error('Unknown DEPLOYMENT_PROFILE');
  const railwayTest = env.DEPLOYMENT_PROFILE === 'railway-test';
  if (railwayTest) {
    if (env.ENABLE_NATIVE_CLIENTS !== 'true' || env.ENABLE_TCP_RECEIVER !== 'false')
      throw new Error('Railway test requires native clients and a disabled TCP receiver');
    if (!env.PUBLIC_ORIGIN || new URL(env.PUBLIC_ORIGIN).protocol !== 'https:')
      throw new Error('Railway test requires an explicit HTTPS PUBLIC_ORIGIN');
    if ((env.PROOF_MODE ?? 'disabled') !== 'disabled' ||
        (env.PROOF_ALLOW_LIVE ?? 'false') !== 'false' ||
        (env.PROOF_ALLOW_MAINNET ?? 'false') !== 'false' ||
        (env.PROOF_MAX_PUBLICATIONS ?? '1') !== '1' ||
        (env.ENABLE_SERVER_SIMULATOR ?? 'false') !== 'false' ||
        (env.ENABLE_FIXTURE_ADAPTER ?? 'false') !== 'false')
      throw new Error('Railway test forbids publication, simulation and fixture ingestion');
  }
  return {
    railwayTest,
    proofs: proofConfig(env),
    nativeEnabled: env.ENABLE_NATIVE_CLIENTS === 'true',
    webEnabled: env.ENABLE_WEB_WORKSPACE === 'true',
    simulatorEnabled: env.ENABLE_SERVER_SIMULATOR === 'true',
    publicOrigin: env.PUBLIC_ORIGIN || 'http://127.0.0.1:8080',
    webRoot: env.WEB_ROOT,
    fixturesEnabled: env.ENABLE_FIXTURE_ADAPTER === 'true',
    tcpPort: integer(env, 'TCP_PORT', 9000, 65535),
    tcpEnabled: env.ENABLE_TCP_RECEIVER !== 'false',
    // Railway's PORT wins over the native/Compose HTTP_PORT setting.
    httpPort: env.PORT !== undefined
      ? integer(env, 'PORT', 8080, 65535)
      : integer(env, 'HTTP_PORT', 8080, 65535),
    maxFrameBytes: integer(env, 'MAX_FRAME_BYTES', 65536, 16 * 1024 * 1024),
    maxConnections: integer(env, 'MAX_CONNECTIONS', 100),
    maxPendingFrames: integer(env, 'MAX_PENDING_FRAMES', 100),
    maxPendingBytes: integer(env, 'MAX_PENDING_BYTES', 8 * 1024 * 1024),
    socketTimeoutMs: integer(env, 'SOCKET_TIMEOUT_MS', 120000),
    shutdownTimeoutMs: integer(env, 'SHUTDOWN_TIMEOUT_MS', 10000)
  };
}
