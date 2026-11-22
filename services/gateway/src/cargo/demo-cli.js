import pg from 'pg';
import { ApiError } from '../telemetry/schema.js';
import { administerDemo, readDemoPassword } from './demo-admin.js';

const [command, ...args] = process.argv.slice(2);
let pool;
try {
  if (!process.env.DATABASE_URL) throw new ApiError(400, 'Set DATABASE_URL through the approved secret store');
  const expected = { bootstrap: ['email', 'password-file'], rotate: ['password-file'], revoke: [], disable: [], enable: [] };
  if (!Object.hasOwn(expected, command)) throw new ApiError(400, 'Use bootstrap, rotate, revoke, disable or enable');
  const options = Object.fromEntries(args.map(value => {
    const match = /^--([a-z-]+)=(.+)$/.exec(value);
    if (!match || !expected[command].includes(match[1])) throw new ApiError(400, 'Unknown or malformed option');
    return [match[1],match[2]];
  }));
  if (args.length !== expected[command].length || Object.keys(options).length !== args.length)
    throw new ApiError(400, 'Provide all required options once');
  const password = options['password-file'] ? await readDemoPassword(options['password-file']) : undefined;
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  console.log(JSON.stringify(await administerDemo(pool, command, { email: options.email, password })));
} catch (error) {
  console.error(error instanceof ApiError ? error.message : 'Demo operation failed. Check database access, migration 013 and secret-file permissions.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
