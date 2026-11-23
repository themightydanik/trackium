import { createHash } from 'node:crypto';
import { canonicalize } from '../telemetry/schema.js';

export const AOVX_TELEMETRY_PARSER_VERSION = 'aovx-gal-v2';
const MAX_LIVE_RECEIVE_LAG_MS = 5 * 60 * 1000;

function utcMeasurement(digits) {
  if (!/^\d{12}$/.test(digits ?? '')) return null;
  const [year, month, day, hour, minute, second] = digits.match(/../g).map(Number);
  const date = new Date(Date.UTC(2000 + year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== 2000 + year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour ||
      date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  return date;
}

function position(data, fixed) {
  const { latitudeRaw, longitudeRaw, status } = data;
  if (!fixed || latitudeRaw > 90e6 || longitudeRaw > 180e6 ||
      (latitudeRaw === 0 && longitudeRaw === 0)) return null;
  return {
    latitude: (status & 4 ? -latitudeRaw : latitudeRaw) / 1e6 || 0,
    longitude: (status & 8 ? -longitudeRaw : longitudeRaw) / 1e6 || 0,
    altitude_m: null, accuracy_m: null, speed_mps: null, heading_deg: null
  };
}

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
  const measuredAt = utcMeasurement(data.timestampBcdDigits);
  const lag = measuredAt ? occurredAt - measuredAt : -1;
  const buffered = (data.status & 0x80000000) !== 0;
  const fixed = (data.status & 2) !== 0;
  const gps = lag >= 0 ? position(data, fixed) : null;
  const sourceEventId = createHash('sha256').update(frame.raw).digest('hex');
  const event = {
    schema_version: 1,
    canonical_format: 'trackium-json-v1',
    tenant_id: tenantId,
    device_id: deviceId,
    source: 'aovx-gal-v1',
    trust: 'unverified',
    event_time_basis: 'gateway_received_at',
    device_time_raw: data.timestampBcd.toString('hex'),
    source_event_id: sourceEventId,
    occurred_at: occurredAtIso,
    device_measured_at: measuredAt?.toISOString() ?? null,
    gps,
    temperature_c: null,
    humidity_pct: null,
    battery_pct: null,
    status: 'unknown',
    extra: {
      protocol_message_id: 0x0200,
      device_identifier_bcd: deviceIdBcd,
      device_time_bcd_digits: data.timestampBcdDigits,
      sequence_number: frame.sequenceNumber,
      alarm_raw: data.alarm,
      status_raw: data.status,
      buffered,
      gnss_fix: fixed,
      live_position_eligible: gps !== null && !buffered && lag <= MAX_LIVE_RECEIVE_LAG_MS,
      sampled: (data.status & 0x00000010) !== 0,
      latitude_raw: data.latitudeRaw,
      longitude_raw: data.longitudeRaw,
      altitude_raw: data.altitudeRaw,
      speed_raw: data.speedRaw,
      direction_raw: data.directionRaw,
      mileage_raw: data.mileageRaw === null ? null : String(data.mileageRaw),
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
