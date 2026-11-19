import { createNativeSessions } from './native-session.js';
import { createProofService, startProofWorker } from '../proofs/service.js';
import { createGateway } from '../gateway.js';
import { initialize, persistPacket } from '../journal.js';
import { createAovxObservations } from '../aovx/observations.js';
import { migrate } from '../telemetry/migrate.js';
import { createTelemetryService } from '../telemetry/service.js';
import { createTelemetryApi } from '../telemetry/api.js';
import { createShipmentService } from './shipments.js';
import { createSimulator, startWorker } from './simulator.js';
import { createPairing, publicOrigin } from './pairing.js';
import { createCargoApi } from './api.js';
import { createWebHandler } from './web.js';
import { createIngressGuard } from '../ingress.js';
import { diagnosePortConflict } from '../port-diagnostics.js';

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
  const aovxObservations = createAovxObservations(pool);
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
    ingressGuard: config.railwayTest ? createIngressGuard(config) : undefined,
    logger,
    journal: {
      async initialize() {
        const checkpoint = async (phase) => {
          // Port 0 asks the OS for an ephemeral port and is used by integration
          // tests; it is not a fixed listener target worth inspecting.
          if (config.tcpEnabled === false || !Number.isInteger(config.tcpPort) || config.tcpPort <= 0)
            return;
          try {
            const report = await diagnosePortConflict(config.tcpPort);
            (logger.info ?? console.info).call(logger, 'tcp port runtime checkpoint:', JSON.stringify({ ...report, phase }));
          } catch (err) {
            (logger.warn ?? console.warn).call(logger, 'tcp port runtime checkpoint unavailable:', phase, err.message);
          }
        };
        await checkpoint('journal_initialize_started');
        await initialize(pool);
        await migrate(pool);
        await proofs.initialize();
        await checkpoint('database_and_proof_initialization_complete');
        if (worker && config.proofs?.mode !== 'disabled')
          stopProofWorker = startProofWorker(proofs, logger);
        if (worker && config.simulatorEnabled) stopWorker = startWorker(simulator, logger);
        await checkpoint('background_workers_started');
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
      aovxObservations,
      config,
      telemetryApi,
      logger
    }),
    assetHandler: createWebHandler(config)
  });
  return { gateway, shipments, telemetry, simulator, pairing, proofs, native, aovxObservations };
}
