import pg from 'pg';
import { createHash } from 'node:crypto';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

export async function initialize() {
  await pool.query(`
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

export async function persistPacket({ payload, remoteAddress }) {
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const result = await pool.query(
    'INSERT INTO gateway_packets (transport, remote_address, raw_payload, sha256) VALUES ($1,$2,$3,$4) RETURNING id, received_at',
    ['tcp', remoteAddress ?? null, payload, sha256]
  );
  return { ...result.rows[0], sha256 };
}
