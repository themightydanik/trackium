import { readConfig } from './config.js';
import { pool } from './journal.js';
import { createRuntime } from './cargo/runtime.js';
const config = readConfig();
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
  console.log('gateway TCP listening', config.tcpPort);
  console.log('gateway HTTP listening', config.httpPort);
} catch (err) {
  console.error('gateway startup failed:', err.message);
  process.exitCode = 1;
}
