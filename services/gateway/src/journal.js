import pg from 'pg';
import { createHash } from 'node:crypto';

export const pool = new pg.Pool({
  // PG* variables are supported too, avoiding URL-encoding passwords in Compose.
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  query_timeout: 6000
});
// Idle PostgreSQL connections can fail independently of an active query.
pool.on('error', err => console.error('idle database connection failed:', err.message));

export async function checkReady() { await pool.query('SELECT 1'); }
export async function close() { await pool.end(); }

export async function initialize(database = pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS gateway_packets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transport TEXT NOT NULL CHECK (transport IN ('tcp')),
      remote_address TEXT,
      raw_payload BYTEA NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unclassified',
      device_id TEXT,
      tenant_id TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS gateway_packets_received_idx ON gateway_packets(received_at);
  `);
}

export async function persistPacket({ payload, remoteAddress }, database = pool) {
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const result = await database.query(
    'INSERT INTO gateway_packets (transport, remote_address, raw_payload, sha256) VALUES ($1,$2,$3,$4) RETURNING id, received_at',
    ['tcp', remoteAddress ?? null, payload, sha256]
  );
  return { ...result.rows[0], sha256 };
}
