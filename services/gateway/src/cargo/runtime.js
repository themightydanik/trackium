import { createNativeSessions } from './native-session.js';
import { createProofService, startProofWorker } from '../proofs/service.js';
import { createGateway } from '../gateway.js';
import { initialize, persistPacket } from '../journal.js';
import { migrate } from '../telemetry/migrate.js';
import { createTelemetryService } from '../telemetry/service.js';
import { createTelemetryApi } from '../telemetry/api.js';
import { createShipmentService } from './shipments.js';
import { createSimulator, startWorker } from './simulator.js';
import { createPairing, publicOrigin } from './pairing.js';
import { createCargoApi } from './api.js';
import { createWebHandler } from './web.js';
export function createRuntime(
  pool,
  config,
  { worker = true, logger = console, proofDependencies } = {}
) {
  publicOrigin(config.publicOrigin);
  const shipments = createShipmentService(pool);
  const telemetry = createTelemetryService(pool, { onEvent: shipments.onTelemetry });
  const simulator = createSimulator(pool, shipments, { enabled: config.simulatorEnabled });
  const pairing = createPairing(pool, config);
  const proofs = createProofService(pool, config.proofs, proofDependencies);
  let stopProofWorker = async () => {};
  const native = createNativeSessions(pool, config);
  const authenticate = (req) =>
    req.headers.authorization?.startsWith('Bearer trk_native_')
      ? native.authenticate(req)
      : req.headers.authorization
        ? telemetry.authenticate(req.headers.authorization)
        : pairing.authenticate(req, !['GET', 'HEAD'].includes(req.method));
  const telemetryApi = createTelemetryApi(telemetry, {
    fixturesEnabled: config.fixturesEnabled,
    authenticate,
    logger
  });
  let stopWorker = async () => {};
  const gateway = createGateway({
    config,
    logger,
    journal: {
      async initialize() {
        await initialize(pool);
        await migrate(pool);
        await proofs.initialize();
        if (worker && config.proofs?.mode !== 'disabled')
          stopProofWorker = startProofWorker(proofs, logger);
        if (worker && config.simulatorEnabled) stopWorker = startWorker(simulator, logger);
      },
      persistPacket: (packet) => persistPacket(packet, pool),
      checkReady: () => pool.query('SELECT 1'),
      async close() {
        await Promise.all([stopWorker(), stopProofWorker()]);
        await pool.end();
      }
    },
    requestHandler: createCargoApi({
      telemetry,
      authenticate,
      native,
      proofs,
      shipments,
      simulator,
      pairing,
      config,
      telemetryApi,
      logger
    }),
    assetHandler: createWebHandler(config)
  });
  return { gateway, shipments, telemetry, simulator, pairing, proofs, native };
}
