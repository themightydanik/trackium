import { createHash } from 'node:crypto';
import { canonicalize } from '../telemetry/schema.js';

export const AOVX_TELEMETRY_PARSER_VERSION = 'aovx-gal-v1';

export function adaptAovxTelemetry({ frame, parsed, receivedAt, tenantId, deviceId }) {
  if (frame?.messageId !== 0x0200 || parsed?.messageId !== 0x0200 ||
      !parsed.data || !Buffer.isBuffer(parsed.data.timestampBcd)) {
    throw new TypeError('AOVX telemetry adapter requires a parsed 0x0200 message');
  }
  if (!frame.checksumMatchesXor) throw new Error('AOVX XOR-candidate checksum mismatch');
  const deviceIdBcd = frame.deviceIdBcd.toString('hex');
  if (!/^[0-9]{12}$/.test(deviceIdBcd)) throw new Error('AOVX device identifier is not valid decimal BCD');
  const data = parsed.data;
  const occurredAt = new Date(receivedAt);
  if (!Number.isFinite(occurredAt.getTime())) throw new TypeError('invalid Gateway receive time');
  const occurredAtIso = occurredAt.toISOString();
  const sourceEventId = createHash('sha256').update(frame.raw).digest('hex');
  const event = {
    schema_version: 1,
    canonical_format: 'trackium-json-v1',
    tenant_id: tenantId,
    device_id: deviceId,
    source: AOVX_TELEMETRY_PARSER_VERSION,
    trust: 'unverified',
    source_event_id: sourceEventId,
    occurred_at: occurredAtIso,
    gps: null,
    temperature_c: null,
    humidity_pct: null,
    battery_pct: null,
    status: 'unknown',
    extra: {
      protocol_message_id: 0x0200,
      device_time_bcd_digits: data.timestampBcdDigits,
      sequence_number: frame.sequenceNumber,
      alarm_raw: data.alarm,
      status_raw: data.status,
      buffered: (data.status & 0x80000000) !== 0,
      gnss_fix: (data.status & 0x00000002) !== 0,
      sampled: (data.status & 0x00000010) !== 0,
      latitude_raw: data.latitudeRaw,
      longitude_raw: data.longitudeRaw,
      altitude_raw: data.altitudeRaw,
      speed_raw: data.speedRaw,
      direction_raw: data.directionRaw,
      mileage_raw: String(data.mileageRaw),
      cellular_signal_raw_hex: data.cellularSignalRaw.toString('hex'),
      gnss_satellites_raw_hex: data.gnssSatellitesRaw.toString('hex'),
      checksum_algorithm: 'unconfirmed-xor-candidate',
      checksum_status: frame.checksumStatus
    }
  };
  const canonical = canonicalize(event);
  return {
    event,
    canonical,
    sha256: createHash('sha256').update(canonical).digest('hex'),
    deviceIdBcd,
    deviceTimeRaw: data.timestampBcd.toString('hex')
  };
}
