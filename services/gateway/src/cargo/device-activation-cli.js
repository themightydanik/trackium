import { open } from 'node:fs/promises';
import pg from 'pg';
import { readOwnerSecret } from './demo-admin.js';
import { administerActivation, provisionDevices } from './device-activation.js';

const [action,input,output,...extra] = process.argv.slice(2);
let pool;
let wroteCards = false;

try {
  const exportsCards = ['provision','rotate'].includes(action);
  if (!process.env.DATABASE_URL || !input || extra.length ||
      (exportsCards ? !output : !!output) || !['provision','inspect','rotate','invalidate'].includes(action))
    throw new Error('Invalid activation CLI arguments');
  pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000});
  async function exportCards(cards) {
    const file = await open(output,'wx',0o600);
    wroteCards = true;
    try {
      await file.writeFile(JSON.stringify(cards,null,2)+'\n');
      await file.sync();
    } finally { await file.close(); }
  }
  const result = action === 'provision'
    ? {provisioned:await provisionDevices(pool,JSON.parse(await readOwnerSecret(input,24000)),exportCards)}
    : await administerActivation(pool,action,input,exportCards);
  console.log(JSON.stringify(result));
} catch {
  console.error('Device activation operation failed. Verify inputs, inventory and permissions.');
  if (wroteCards) console.error('Keep the output private and inspect inventory before using or destroying it.');
  process.exitCode = 1;
} finally { await pool?.end(); }
