import { createHash } from 'node:crypto';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function tenantLock(client, tenant) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('cargo:'||$1,0))", [tenant]);
}
export async function transaction(pool, tenant, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenant) await tenantLock(client, tenant);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
