import { readConfig } from './config.js';
import { pool } from './journal.js';
import { diagnosePortConflict } from './port-diagnostics.js';
import { createRuntime } from './cargo/runtime.js';

const config = readConfig();

// Capture the port state before this process creates any servers. A listener
// present here is pre-existing/inherited, not opened by createGateway().
// This is best-effort so restricted procfs access cannot prevent startup.
if (config.tcpEnabled !== false) {
  try {
    const report = await diagnosePortConflict(config.tcpPort);
    console.log('tcp port startup preflight:', JSON.stringify({
      ...report,
      phase: 'before_gateway_creation'
    }));
  } catch (err) {
    console.warn('tcp port startup preflight unavailable:', err.message);
  }
}

const { gateway } = createRuntime(pool, config);
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
