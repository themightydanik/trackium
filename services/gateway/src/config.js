import { customerMailConfig } from './cargo/customer-mail.js';
import { roadTilesConfig } from './cargo/road-tiles.js';
import { readRoutingConfig } from './routing/service.js';
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
  for (const name of ['ENABLE_WEB_WORKSPACE', 'ENABLE_SERVER_SIMULATOR', 'ENABLE_NATIVE_CLIENTS', 'ENABLE_TCP_RECEIVER', 'ENABLE_LOCAL_NOTIFICATIONS'])
    if (env[name] !== undefined && !['true', 'false'].includes(env[name]))
      throw new Error(name + ' must be true or false');
  const integritasMode = env.INTEGRITAS_MODE ?? 'disabled';
  if (!['disabled', 'test'].includes(integritasMode))
    throw new Error('INTEGRITAS_MODE must be disabled or test');
  const demoEnabled = (env.CUSTOMER_DEMO_ENABLED ?? 'false') === 'true';
  if (env.CUSTOMER_DEMO_ENABLED !== undefined && !['true','false'].includes(env.CUSTOMER_DEMO_ENABLED))
    throw new Error('Invalid CUSTOMER_DEMO_ENABLED');
  const pilotEnabled = env.CUSTOMER_DEMO_PILOT_ENABLED === 'true';
  if (env.CUSTOMER_DEMO_PILOT_ENABLED !== undefined &&
      !['true', 'false'].includes(env.CUSTOMER_DEMO_PILOT_ENABLED))
    throw new Error('Invalid CUSTOMER_DEMO_PILOT_ENABLED');
  if (pilotEnabled && !demoEnabled) throw new Error('Physical pilot requires CUSTOMER_DEMO_ENABLED');
  if (demoEnabled && (env.CUSTOMER_ACCOUNTS_ENABLED === 'true' || env.ENABLE_WEB_WORKSPACE !== 'true' ||
      integritasMode !== 'test' || (env.PROOF_MODE ?? 'disabled') !== 'disabled' ||
      (env.PROOF_ALLOW_LIVE ?? 'false') !== 'false' || (env.PROOF_ALLOW_MAINNET ?? 'false') !== 'false'))
    throw new Error('Customer demo requires Lite, Integritas test, and disabled public accounts and native proof publication');
  if (demoEnabled && (env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_ID) &&
      (!env.PUBLIC_ORIGIN || new URL(env.PUBLIC_ORIGIN).protocol !== 'https:'))
    throw new Error('Production customer demo requires HTTPS PUBLIC_ORIGIN');
  if (demoEnabled && !env.PUBLIC_ORIGIN) throw new Error('Customer demo requires an explicit PUBLIC_ORIGIN');
  const profiles = ['railway-test', 'railway-aovx-pilot', 'railway-public', 'railway-demo'];
  if (env.DEPLOYMENT_PROFILE !== undefined && !profiles.includes(env.DEPLOYMENT_PROFILE))
    throw new Error('Unknown DEPLOYMENT_PROFILE');
  const railwayTest = env.DEPLOYMENT_PROFILE === 'railway-test';
  const railwayAovxPilot = env.DEPLOYMENT_PROFILE === 'railway-aovx-pilot';
  const railwayPublic = env.DEPLOYMENT_PROFILE === 'railway-public';
  const railwayDemo = env.DEPLOYMENT_PROFILE === 'railway-demo';
  const railwayHttps = railwayPublic || railwayDemo;
  const routing = readRoutingConfig(env);
  if (railwayHttps) {
    let origin;
    try { origin = new URL(env.PUBLIC_ORIGIN); }
    catch { throw new Error('Railway HTTPS profiles require an explicit HTTPS PUBLIC_ORIGIN'); }
    if (env.NODE_ENV !== 'production' || origin.protocol !== 'https:' || origin.origin !== env.PUBLIC_ORIGIN ||
        env.ENABLE_WEB_WORKSPACE !== 'true' || (routing && !routing.railway))
      throw new Error('Railway HTTPS profiles require an HTTPS workspace and private Railway routing if configured');
    if (railwayPublic && (demoEnabled || pilotEnabled || integritasMode !== 'disabled'))
      throw new Error('Railway public requires disabled demo and Integritas modes');
    if (railwayDemo && ((env.CUSTOMER_ACCOUNTS_ENABLED ?? 'false') !== 'false' ||
        (!demoEnabled && integritasMode !== 'disabled')))
      throw new Error('Railway demo requires closed registration and disables Integritas while demo access is off');
    if (env.ENABLE_TCP_RECEIVER !== 'false' &&
        !(env.ENABLE_TCP_RECEIVER === 'true' && env.TCP_PROTOCOL === 'aovx'))
      throw new Error('Railway HTTPS profiles require TCP disabled or an explicitly configured AOVX receiver');
  }
  if (railwayTest || railwayAovxPilot || railwayHttps) {
    if (env.ENABLE_NATIVE_CLIENTS !== 'true')
      throw new Error('Railway profiles require native clients');
    if (!env.PUBLIC_ORIGIN || new URL(env.PUBLIC_ORIGIN).protocol !== 'https:')
      throw new Error('Railway profiles require an explicit HTTPS PUBLIC_ORIGIN');
    if ((env.PROOF_MODE ?? 'disabled') !== 'disabled' ||
        (env.PROOF_ALLOW_LIVE ?? 'false') !== 'false' ||
        (env.PROOF_ALLOW_MAINNET ?? 'false') !== 'false' ||
        (env.PROOF_MAX_PUBLICATIONS ?? '1') !== '1' ||
        (env.ENABLE_SERVER_SIMULATOR ?? 'false') !== 'false' ||
        (env.ENABLE_FIXTURE_ADAPTER ?? 'false') !== 'false')
      throw new Error('Railway profiles forbid publication, simulation and fixture ingestion');
  }
  if (railwayTest && env.ENABLE_TCP_RECEIVER !== 'false')
    throw new Error('Railway test requires a disabled TCP receiver');
  const tcpProtocol = env.TCP_PROTOCOL ?? 'raw';
  if (!['raw', 'aovx'].includes(tcpProtocol)) throw new Error('TCP_PROTOCOL must be raw or aovx');
  if (railwayAovxPilot &&
      (env.ENABLE_TCP_RECEIVER !== 'true' || tcpProtocol !== 'aovx'))
    throw new Error('Railway AOVX pilot requires an explicitly enabled AOVX TCP receiver');
  const aovxObservationsToken = env.AOVX_OBSERVATIONS_TOKEN || undefined;
  if (aovxObservationsToken !== undefined && (typeof aovxObservationsToken !== 'string' || aovxObservationsToken.length < 32 || aovxObservationsToken.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(aovxObservationsToken))) throw new Error('AOVX_OBSERVATIONS_TOKEN must be 32..512 URL-safe characters');
  const tcpEnabled = env.ENABLE_TCP_RECEIVER !== 'false';
  const tcpPort = integer(env, 'TCP_PORT', 9000, 65535);
  const httpPort = env.HTTP_PORT !== undefined
    ? integer(env, 'HTTP_PORT', 8080, 65535)
    : integer(env, 'PORT', 8080, 65535);
  if (tcpEnabled && tcpPort === httpPort)
    throw new Error('TCP_PORT and HTTP_PORT must be different when TCP receiver is enabled');
  return {
    integritasMode,
    demoEnabled,
    pilotEnabled,
    customerMail: customerMailConfig(env),
    railwayTest,
    railwayPublic,
    railwayHttps,
    railwayAovxPilot,
    tcpProtocol,
    aovxObservationsToken,
    proofs: proofConfig(env),
    nativeEnabled: env.ENABLE_NATIVE_CLIENTS === 'true',
    webEnabled: env.ENABLE_WEB_WORKSPACE === 'true',
    localNotificationsEnabled: env.ENABLE_LOCAL_NOTIFICATIONS === 'true',
    simulatorEnabled: env.ENABLE_SERVER_SIMULATOR === 'true',
    publicOrigin: env.PUBLIC_ORIGIN || 'http://127.0.0.1:8080',
    webRoot: env.WEB_ROOT,
    roadTiles: roadTilesConfig(env),
    routing,
    fixturesEnabled: env.ENABLE_FIXTURE_ADAPTER === 'true',
    tcpPort,
    tcpEnabled,
    httpPort,
    maxFrameBytes: integer(env, 'MAX_FRAME_BYTES', 65536, 16 * 1024 * 1024),
    maxConnections: integer(env, 'MAX_CONNECTIONS', 100),
    maxPendingFrames: integer(env, 'MAX_PENDING_FRAMES', 100),
    maxPendingBytes: integer(env, 'MAX_PENDING_BYTES', 8 * 1024 * 1024),
    socketTimeoutMs: integer(env, 'SOCKET_TIMEOUT_MS', 120000),
    shutdownTimeoutMs: integer(env, 'SHUTDOWN_TIMEOUT_MS', 10000)
  };
}
