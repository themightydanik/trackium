import pg from 'pg';
import { ApiError } from '../telemetry/schema.js';
import { readOwnerSecret } from '../cargo/demo-admin.js';
import { administerAovxTransfer } from './transfer.js';

const [command, input, approval, ...extra] = process.argv.slice(2);
let pool;
try {
  if (!process.env.DATABASE_URL) throw new ApiError(400, 'Set DATABASE_URL through the approved secret store');
  if (!['inspect-transfer','plan-transfer','apply-transfer'].includes(command) || !input?.startsWith('--file=') ||
      extra.length || (command === 'apply-transfer' ? approval !== '--approve=transfer' : approval !== undefined))
    throw new ApiError(400, 'Use inspect-transfer, plan-transfer or apply-transfer with --file; apply requires --approve=transfer');
  const contents = await readOwnerSecret(input.slice('--file='.length), 4096);
  let data;
  try { data = JSON.parse(contents); }
  catch { throw new ApiError(400, 'Expected a JSON input file'); }
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  console.log(JSON.stringify(await administerAovxTransfer(pool, command, data)));
} catch (error) {
  console.error(error instanceof ApiError ? error.message : 'Transfer failed. Check migration 016 and approved database access.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
