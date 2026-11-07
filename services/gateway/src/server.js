import { readConfig } from './config.js';
import { createGateway } from './gateway.js';

const config = readConfig();
const journal = await import('./journal.js');
const gateway = createGateway({ journal, config });

const stop = () => gateway.shutdown().catch(err => {
  console.error(err.message);
  process.exit(1); // A timed-out drain must not be reported as a clean shutdown.
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
