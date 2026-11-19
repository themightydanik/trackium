import { readConfig } from './config.js';
import { pool } from './journal.js';
import { diagnosePortConflict } from './port-diagnostics.js';
import { createRuntime } from './cargo/runtime.js';

const config = readConfig();

async function logTcpPortState(phase) {
  if (config.tcpEnabled === false) return;
  try {
    const report = await diagnosePortConflict(config.tcpPort);
    console.log('tcp port startup checkpoint:', JSON.stringify({ ...report, phase }));
  } catch (err) {
    console.warn('tcp port startup checkpoint unavailable:', phase, err.message);
  }
}

// Capture the port state before this process creates any servers. A listener
// present here is pre-existing/inherited, not opened by createGateway().
// This is best-effort so restricted procfs access cannot prevent startup.
await logTcpPortState('before_gateway_creation');

const { gateway } = createRuntime(pool, config);
await logTcpPortState('after_runtime_creation_before_gateway_start');

const stop = () =>
  gateway.shutdown().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
try {
  await gateway.start();
  if (config.tcpEnabled) console.log('gateway TCP listening', config.tcpPort);
  console.log('gateway HTTP listening', config.httpPort);
} catch (err) {
  console.error('gateway startup failed:', err.message);
  process.exitCode = 1;
}
