import { ApiError, invalid } from '../telemetry/schema.js';
function normalizeId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{12}$/i.test(value))
    throw new ApiError(400, 'invalid AOVX device identifier');
  return value.toLowerCase();
}
function packetLimit(value) {
  if (!Number.isInteger(value) || value < 1 || value > 50) invalid('invalid packet limit');
  return value;
}
function packetCursor(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{1,19}$/.test(value) || BigInt(value) < 1n || BigInt(value) > 9223372036854775807n)
    invalid('invalid packet cursor');
  return value;
}
export function createAovxObservations(pool) {
  return {
    async list(limit = 100, cursor) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) invalid('invalid limit');
      const after = cursor == null ? null : normalizeId(cursor);
      const result = await pool.query(
        `SELECT device_id_bcd, first_seen_at, last_seen_at, packet_count,
          last_message_id, last_sequence_number, last_checksum_status, last_parse_status,
          registration_message_seen_at, authentication_message_seen_at
         FROM gateway_aovx_device_observations
         WHERE ($1::text IS NULL OR device_id_bcd > $1)
         ORDER BY device_id_bcd LIMIT $2`,
        [after, limit + 1]
      );
      return { devices: result.rows.slice(0, limit),
        next_cursor: result.rows.length > limit ? result.rows[limit - 1].device_id_bcd : null };
    },
    async get(id) {
      const result = await pool.query(
        `SELECT device_id_bcd, first_seen_at, last_seen_at, packet_count,
          last_message_id, last_sequence_number, last_checksum_status, last_parse_status,
          registration_message_seen_at, authentication_message_seen_at
         FROM gateway_aovx_device_observations WHERE device_id_bcd=$1`,
        [normalizeId(id)]
      );
      if (!result.rowCount) throw new ApiError(404, 'AOVX device observation not found');
      return result.rows[0];
    },
    async packets({ limit = 25, before, deviceId } = {}) {
      const boundedLimit = packetLimit(limit);
      const cursor = packetCursor(before);
      const normalizedDeviceId = deviceId == null ? null : normalizeId(deviceId);
      const result = await pool.query(
        `SELECT id::text AS id, received_at, remote_address,
          aovx_message_id, aovx_device_id_bcd, aovx_sequence_number,
          aovx_checksum_status, aovx_parse_status, aovx_parse_error,
          aovx_parsed_payload, octet_length(raw_payload) AS payload_bytes,
          encode(substring(raw_payload FROM 1 FOR 65536), 'hex') AS raw_payload_hex,
          octet_length(raw_payload) > 65536 AS payload_truncated, sha256
         FROM gateway_packets
         WHERE aovx_message_id IS NOT NULL
           AND ($1::bigint IS NULL OR id < $1::bigint)
           AND ($2::text IS NULL OR aovx_device_id_bcd = $2)
         ORDER BY id DESC LIMIT $3`,
        [cursor, normalizedDeviceId, boundedLimit + 1]
      );
      const rows = result.rows.slice(0, boundedLimit);
      return {
        packets: rows,
        next_cursor: result.rows.length > boundedLimit ? rows[rows.length - 1].id : null
      };
    }
  };
}
