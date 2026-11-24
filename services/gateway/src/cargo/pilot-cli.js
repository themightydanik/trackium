import pg from 'pg';
import { ApiError } from '../telemetry/schema.js';
import { readDemoPassword, readOwnerSecret } from './demo-admin.js';
import { administerPilot } from './pilot-admin.js';

const [command, ...args] = process.argv.slice(2);
const commands = {
  inspect: [],
  plan: ['name','device-file'],
  promote: ['name','device-file','password-file','approve'],
  rollback: ['password-file','approve']
};
let pool;
try {
  if (!process.env.DATABASE_URL) throw new ApiError(400, 'Set DATABASE_URL through the approved secret store');
  if (!Object.hasOwn(commands, command)) throw new ApiError(400, 'Use inspect, plan, promote or rollback');
  const transferOnly = args.includes('--empty-inventory=approved-transfer') && ['plan','promote'].includes(command);
  const expected = transferOnly
    ? commands[command].map(key => key === 'device-file' ? 'empty-inventory' : key)
    : commands[command];
  const options = Object.fromEntries(args.map(value => {
    const match = /^--([a-z-]+)=(.+)$/.exec(value);
    if (!match || !expected.includes(match[1])) throw new ApiError(400, 'Unknown or malformed option');
    return [match[1],match[2]];
  }));
  if (args.length !== expected.length || Object.keys(options).length !== args.length)
    throw new ApiError(400, 'Provide all required options once');
  if (expected.includes('approve') && options.approve !== command)
    throw new ApiError(400, 'Use --approve with the exact operation name after review');
  const identifiers = transferOnly ? [] : options['device-file'] && (await readOwnerSecret(options['device-file'], 280)).split(/\r?\n/);
  const password = options['password-file'] && await readDemoPassword(options['password-file']);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  console.log(JSON.stringify(await administerPilot(pool, command, { name: options.name, identifiers, password, transferOnly })));
} catch (error) {
  console.error(error instanceof ApiError ? error.message : 'Pilot operation failed. Check migration 015, database access and secret-file permissions.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
