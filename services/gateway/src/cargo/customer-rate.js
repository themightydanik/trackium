import { ApiError } from '../telemetry/schema.js';
import { hash } from './shared.js';

export async function takeCustomerRate(pool, bucket, ceiling) {
  const { rows: [result] } = await pool.query(
    `INSERT INTO customer_rate_buckets(window_at,bucket,attempts)
     VALUES(date_trunc('minute',statement_timestamp()),$1,1)
     ON CONFLICT(window_at,bucket) DO UPDATE SET attempts=customer_rate_buckets.attempts+1
     WHERE customer_rate_buckets.attempts<$2
     RETURNING attempts`, [bucket,ceiling]);
  if (!result) throw new ApiError(429, 'Try again in a minute');
  return result.attempts;
}

export async function limitCustomerRequest(pool, req) {
  if (await takeCustomerRate(pool, 'global', 100) === 1)
    await pool.query("DELETE FROM customer_rate_buckets WHERE window_at<now()-interval '5 minutes'");
  // Railway peers may be shared. Forwarded headers are not identity evidence.
  await takeCustomerRate(pool, 'peer:' + hash(req.socket.remoteAddress || 'unknown'), 30);
}
