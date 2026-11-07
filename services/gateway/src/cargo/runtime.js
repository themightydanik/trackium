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
export function createRuntime(pool, config, { worker = true, logger = console } = {}) {
  publicOrigin(config.publicOrigin);
  const shipments = createShipmentService(pool);
  const telemetry = createTelemetryService(pool, { onEvent: shipments.onTelemetry });
  const simulator = createSimulator(pool, shipments, { enabled: config.simulatorEnabled });
  const pairing = createPairing(pool, config);
  const authenticate = (req) =>
    req.headers.authorization
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
        if (worker && config.simulatorEnabled) stopWorker = startWorker(simulator, logger);
      },
      persistPacket: (packet) => persistPacket(packet, pool),
      checkReady: () => pool.query('SELECT 1'),
      async close() {
        await stopWorker();
        await pool.end();
      }
    },
    requestHandler: createCargoApi({
      telemetry,
      shipments,
      simulator,
      pairing,
      config,
      telemetryApi,
      logger
    }),
    assetHandler: createWebHandler(config)
  });
  return { gateway, shipments, telemetry, simulator, pairing };
}
