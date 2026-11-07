import { randomUUID } from 'node:crypto';
import { ApiError } from '../telemetry/schema.js';
import { transaction } from './shared.js';
// Internal worker API only. Processed means handed to a consumer, never on-chain.
export async function claimOutbox(pool, { limit = 20, leaseMs = 30000 } = {}) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(leaseMs) ||
    leaseMs < 1000 ||
    leaseMs > 300000
  )
    throw new Error('invalid lease');
  return transaction(pool, null, async (c) => {
    const rows = (
      await c.query(
        "SELECT event_id FROM cargo_outbox WHERE (state='pending' AND available_at<=now()) OR (state='processing' AND lease_until<=now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT $1",
        [limit]
      )
    ).rows;
    const jobs = [];
    for (const row of rows) {
      const token = randomUUID();
      await c.query(
        "UPDATE cargo_outbox SET state='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+($3*interval '1 millisecond') WHERE event_id=$1",
        [row.event_id, token, leaseMs]
      );
      jobs.push({
        ...(await c.query('SELECT * FROM cargo_events WHERE id=$1', [row.event_id])).rows[0],
        lease_token: token
      });
    }
    return jobs;
  });
}
export async function acknowledge(pool, tenant, eventId, token) {
  const r = await pool.query(
    "UPDATE cargo_outbox SET state='processed',processed_at=COALESCE(processed_at,now()) WHERE tenant_id=$1 AND event_id=$2 AND lease_token=$3 AND (state='processed' OR (state='processing' AND lease_until>now())) RETURNING event_id",
    [tenant, eventId, token]
  );
  if (!r.rowCount) throw new ApiError(409, 'stale or invalid outbox lease');
  return r.rows[0];
}
export async function retry(pool, tenant, eventId, token) {
  const r = await pool.query(
    "UPDATE cargo_outbox SET state='pending',available_at=now()+interval '5 seconds',lease_token=NULL,lease_until=NULL WHERE tenant_id=$1 AND event_id=$2 AND lease_token=$3 AND state='processing' AND lease_until>now() RETURNING event_id",
    [tenant, eventId, token]
  );
  if (!r.rowCount) throw new ApiError(409, 'stale or invalid outbox lease');
}
