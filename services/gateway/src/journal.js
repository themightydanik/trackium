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
      error TEXT,
      aovx_message_id INTEGER,
      aovx_device_id_bcd TEXT,
      aovx_sequence_number INTEGER,
      aovx_checksum_status TEXT,
      aovx_parse_status TEXT,
      aovx_parse_error TEXT,
      aovx_parsed_payload JSONB,
      aovx_processing_state TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (aovx_processing_state IN ('not_applicable','pending','processed','unbound','rejected')),
      aovx_processing_error TEXT
    );
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_message_id INTEGER;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_device_id_bcd TEXT;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_sequence_number INTEGER;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_checksum_status TEXT;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_parse_status TEXT;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_parse_error TEXT;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_parsed_payload JSONB;
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_processing_state TEXT NOT NULL DEFAULT 'not_applicable'
      CHECK (aovx_processing_state IN ('not_applicable','pending','processed','unbound','rejected'));
    ALTER TABLE gateway_packets ADD COLUMN IF NOT EXISTS aovx_processing_error TEXT;
    CREATE INDEX IF NOT EXISTS gateway_packets_received_idx ON gateway_packets(received_at);
    CREATE INDEX IF NOT EXISTS gateway_packets_aovx_message_idx ON gateway_packets(aovx_message_id, received_at)
      WHERE aovx_message_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS gateway_aovx_device_observations (
      device_id_bcd TEXT PRIMARY KEY CHECK (device_id_bcd ~ '^[0-9a-f]{12}$'),
      first_seen_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      packet_count BIGINT NOT NULL DEFAULT 0 CHECK (packet_count >= 0),
      last_message_id INTEGER,
      last_sequence_number INTEGER,
      last_checksum_status TEXT,
      last_parse_status TEXT,
      registration_message_seen_at TIMESTAMPTZ,
      authentication_message_seen_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS gateway_aovx_device_observations_last_seen_idx
      ON gateway_aovx_device_observations(last_seen_at DESC);
  `);
}

export async function persistPacket({ payload, remoteAddress, aovx = null }, database = pool) {
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const deviceIdBcd = typeof aovx?.deviceIdBcd === 'string' && /^[0-9a-f]{12}$/i.test(aovx.deviceIdBcd)
    ? aovx.deviceIdBcd.toLowerCase()
    : null;
  const result = await database.query(
    `WITH packet AS (
      INSERT INTO gateway_packets (
        transport, remote_address, raw_payload, sha256,
        aovx_message_id, aovx_device_id_bcd, aovx_sequence_number,
        aovx_checksum_status, aovx_parse_status, aovx_parse_error, aovx_parsed_payload,
        aovx_processing_state
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        CASE WHEN $5 = 512 THEN 'pending' ELSE 'not_applicable' END)
      RETURNING id, received_at
    ),
    observation AS (
      INSERT INTO gateway_aovx_device_observations AS current (
        device_id_bcd, first_seen_at, last_seen_at, packet_count,
        last_message_id, last_sequence_number, last_checksum_status, last_parse_status,
        registration_message_seen_at, authentication_message_seen_at
      )
      SELECT
        $6, packet.received_at, packet.received_at, 1,
        $5, $7, $8, $9,
        CASE WHEN $5 = 256 THEN packet.received_at END,
        CASE WHEN $5 = 258 THEN packet.received_at END
      FROM packet
      WHERE $6 IS NOT NULL
      ON CONFLICT (device_id_bcd) DO UPDATE SET
        first_seen_at = LEAST(current.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(current.last_seen_at, EXCLUDED.last_seen_at),
        packet_count = current.packet_count + 1,
        last_message_id = CASE WHEN EXCLUDED.last_seen_at >= current.last_seen_at
          THEN EXCLUDED.last_message_id ELSE current.last_message_id END,
        last_sequence_number = CASE WHEN EXCLUDED.last_seen_at >= current.last_seen_at
          THEN EXCLUDED.last_sequence_number ELSE current.last_sequence_number END,
        last_checksum_status = CASE WHEN EXCLUDED.last_seen_at >= current.last_seen_at
          THEN EXCLUDED.last_checksum_status ELSE current.last_checksum_status END,
        last_parse_status = CASE WHEN EXCLUDED.last_seen_at >= current.last_seen_at
          THEN EXCLUDED.last_parse_status ELSE current.last_parse_status END,
        registration_message_seen_at = COALESCE(current.registration_message_seen_at, EXCLUDED.registration_message_seen_at),
        authentication_message_seen_at = COALESCE(current.authentication_message_seen_at, EXCLUDED.authentication_message_seen_at)
      RETURNING device_id_bcd
    )
    SELECT id, received_at FROM packet`,
    [
      'tcp', remoteAddress ?? null, payload, sha256,
      aovx?.messageId ?? null, deviceIdBcd, aovx?.sequenceNumber ?? null,
      aovx?.checksumStatus ?? null, aovx?.parseStatus ?? null, aovx?.parseError ?? null,
      aovx?.parsedPayload ?? null
    ]
  );
  return { ...result.rows[0], sha256 };
}
