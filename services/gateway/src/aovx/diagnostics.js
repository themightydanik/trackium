import { AOVX_TELEMETRY_PARSER_VERSION, MAX_LIVE_RECEIVE_LAG_MS } from './telemetry-adapter.js';

const RECENT_PACKET_MS = 15 * 60 * 1000;

// Shared with /location so diagnostics and the public projection agree on ties.
export const physicalPositionCtes = `
  active_binding AS (
    SELECT device_id_bcd,created_at FROM telemetry_aovx_device_bindings
    WHERE tenant_id=$1 AND device_id=$2 AND state='active'
  ),
  newest AS (
    SELECT id,received_at,payload FROM telemetry_events
    WHERE tenant_id=$1 AND device_id=$2 AND source='aovx-gal-v1'
      AND occurred_at >= (SELECT created_at FROM active_binding)
      AND parser_version='${AOVX_TELEMETRY_PARSER_VERSION}' AND trust='unverified'
      AND payload->'extra'->'live_position_eligible' = 'true'::jsonb
      AND payload->'extra'->'buffered' = 'false'::jsonb
      AND payload->>'device_measured_at' IS NOT NULL AND payload->'gps' <> 'null'::jsonb
    ORDER BY payload->>'device_measured_at' DESC FETCH FIRST 1 ROW WITH TIES
  ),
  position_summary AS (
    SELECT count(DISTINCT payload->'gps') > 1 AS conflict,
           max(payload->>'device_measured_at') AS measurement
    FROM newest
  )`;

function observationReason({ enabled, bound, event, summary, lag }) {
  if (!enabled) return 'device_disabled';
  if (!bound) return 'unbound_device';
  if (!event) return 'no_decoded_observation';
  if (event.parser_version !== AOVX_TELEMETRY_PARSER_VERSION) return 'legacy_parser';
  if (lag === null) return 'invalid_device_time';
  if (lag < 0) return 'future_device_time';
  if (!event.fixed) return 'no_gnss_fix';
  if (!event.has_position) return 'invalid_position';
  if (event.buffered) return 'buffered_report';
  if (lag > MAX_LIVE_RECEIVE_LAG_MS) return 'delayed_report';
  if (event.measured_at < summary.measurement) return 'out_of_order';
  if (summary.conflict) return 'conflicting_fixes';
  return 'eligible';
}

export async function readAovxDiagnostics(pool, device) {
  const { rows: [row] } = await pool.query(`
    WITH ${physicalPositionCtes},
    last_packet AS (
      SELECT o.last_seen_at AS received_at, p.aovx_processing_state AS ingestion,
             CASE WHEN o.last_parse_status='error' OR o.last_checksum_status='xor-mismatch'
                  THEN 'failed' ELSE o.last_parse_status END AS decoding
      FROM active_binding b JOIN gateway_aovx_device_observations o USING (device_id_bcd)
      LEFT JOIN LATERAL (
        SELECT aovx_processing_state FROM gateway_packets p
        WHERE p.received_at=o.last_seen_at AND p.aovx_device_id_bcd=b.device_id_bcd
          AND p.aovx_message_id IS NOT DISTINCT FROM o.last_message_id
        ORDER BY p.id DESC LIMIT 1
      ) p ON true
      WHERE o.last_seen_at >= b.created_at
    ),
    last_observation AS (
      SELECT id,received_at,parser_version,payload
      FROM telemetry_events
      WHERE tenant_id=$1 AND device_id=$2 AND source='aovx-gal-v1' AND trust='unverified'
        AND occurred_at >= (SELECT created_at FROM active_binding)
      ORDER BY occurred_at DESC,id DESC LIMIT 1
    )
    SELECT EXISTS(SELECT 1 FROM active_binding) AS bound, statement_timestamp() AS checked_at,
      (SELECT row_to_json(last_packet) FROM last_packet) AS packet,
      (SELECT json_build_object(
        'id', o.id, 'received_at', o.received_at, 'parser_version', o.parser_version,
        'measured_at', o.payload->>'device_measured_at', 'fixed', o.payload->'extra'->'gnss_fix',
        'buffered', o.payload->'extra'->'buffered',
        'has_position', COALESCE(o.payload->'gps' <> 'null'::jsonb,false),
        'packet_ref', (SELECT l.packet_id::text FROM telemetry_aovx_packet_events l
                       WHERE l.tenant_id=$1 AND l.device_id=$2 AND l.event_id=o.id LIMIT 1)
      ) FROM last_observation o) AS event,
      (SELECT max(payload->>'device_measured_at') FROM telemetry_events
       WHERE tenant_id=$1 AND device_id=$2 AND source='aovx-gal-v1' AND trust='unverified'
         AND occurred_at >= (SELECT created_at FROM active_binding)
         AND parser_version='${AOVX_TELEMETRY_PARSER_VERSION}' AND payload->'gps' <> 'null'::jsonb) AS last_valid_gnss_at,
      (SELECT row_to_json(position_summary) FROM position_summary) AS summary
  `, [device.tenant_id, device.id]);
  const { packet, event, bound, summary } = row;
  const lag = event?.measured_at ? Date.parse(event.received_at) - Date.parse(event.measured_at) : null;
  const reason = observationReason({ enabled: device.enabled, bound, event, summary, lag });
  return {
    device_id: device.id,
    trust: 'unverified',
    binding: bound ? 'active' : 'unbound',
    enabled: device.enabled,
    packet: packet && { ...packet, received_at: new Date(packet.received_at).toISOString() },
    packet_recency: packet && row.checked_at - Date.parse(packet.received_at) <= RECENT_PACKET_MS
      ? 'recent' : 'no_recent_data',
    observation: event && {
      event_id: event.id,
      received_at: new Date(event.received_at).toISOString(),
      measured_at: event.measured_at,
      gnss: event.fixed == null ? 'unknown' : event.fixed ? 'fix' : 'unfix',
      delivery: event.buffered == null ? 'unknown' : event.buffered ? 'buffered' : 'real_time',
      receive_lag_ms: lag,
      clock: event.parser_version !== AOVX_TELEMETRY_PARSER_VERSION ? 'unknown'
        : lag === null ? 'invalid_timestamp' : lag < 0 ? 'future_timestamp' : 'utc_reported',
      parser_version: event.parser_version,
      packet_ref: event.packet_ref
    },
    last_valid_gnss_at: row.last_valid_gnss_at,
    position: {
      observation_eligible: reason === 'eligible',
      reason,
      last_known_at: device.enabled && !summary.conflict ? summary.measurement : null,
      conflict: summary.conflict
    }
  };
}
