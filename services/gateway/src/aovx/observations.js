import { ApiError, invalid } from '../telemetry/schema.js';
function normalizeId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{12}$/i.test(value))
    throw new ApiError(400, 'invalid AOVX device identifier');
  return value.toLowerCase();
}
export function createAovxObservations(pool) {
  return {
    async list(limit = 100, cursor) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) invalid('invalid limit');
      const after = cursor === undefined ? null : normalizeId(cursor);
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
    }
  };
}
