import { createHash } from 'node:crypto';
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const invalid = (message) => {
  throw new ApiError(400, message);
};
export function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('expected object');
  if (Object.keys(value).some((k) => !allowed.includes(k))) invalid('unknown field');
}
export function text(value, max = 128) {
  if (
    typeof value !== 'string' ||
    !value.isWellFormed() ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f]/.test(value)
  )
    invalid('invalid text');
  return value;
}
export function uuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    invalid('invalid UUID');
  return value.toLowerCase();
}
export function timestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    value.startsWith('0000') ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    invalid('expected UTC timestamp with milliseconds');
  return value;
}
function number(value, min, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    invalid('measurement out of range');
  return Object.is(value, -0) ? 0 : value;
}
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
      .join(',') +
    '}'
  );
}
export function normalizeFixture(input, { tenantId, deviceId }) {
  object(input, [
    'schema_version',
    'source_event_id',
    'occurred_at',
    'gps',
    'temperature_c',
    'humidity_pct',
    'battery_pct',
    'status',
    'extra'
  ]);
  if (input.schema_version !== 1) invalid('unsupported schema_version');
  let gps = null;
  if (input.gps !== undefined && input.gps !== null) {
    object(input.gps, [
      'latitude',
      'longitude',
      'altitude_m',
      'accuracy_m',
      'speed_mps',
      'heading_deg'
    ]);
    if (input.gps.latitude == null || input.gps.longitude == null)
      invalid('GPS requires latitude and longitude');
    gps = {
      latitude: number(input.gps.latitude, -90, 90),
      longitude: number(input.gps.longitude, -180, 180),
      altitude_m: number(input.gps.altitude_m, -12000, 100000),
      accuracy_m: number(input.gps.accuracy_m, 0, 100000),
      speed_mps: number(input.gps.speed_mps, 0, 400),
      heading_deg: number(input.gps.heading_deg, 0, 359.999999)
    };
  }
  const extra = input.extra ?? {};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra) || Object.keys(extra).length > 32)
    invalid('invalid extra');
  for (const [key, value] of Object.entries(extra)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || key === 'constructor' || key === 'prototype')
      invalid('invalid extra key');
    if (value !== null && !['number', 'boolean', 'string'].includes(typeof value))
      invalid('extra values must be scalars');
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
    )
      invalid('invalid extra number');
    if (
      typeof value === 'string' &&
      (value.length > 256 || !value.isWellFormed() || value.includes('\u0000'))
    )
      invalid('invalid extra string');
  }
  const status = input.status ?? 'unknown';
  if (!['unknown', 'stationary', 'moving', 'alarm', 'offline'].includes(status))
    invalid('invalid status');
  const event = {
    schema_version: 1,
    canonical_format: 'trackium-json-v1',
    tenant_id: uuid(tenantId),
    device_id: uuid(deviceId),
    source: 'fixture-v1',
    trust: 'synthetic',
    source_event_id: text(input.source_event_id),
    occurred_at: timestamp(input.occurred_at),
    gps,
    temperature_c: number(input.temperature_c, -100, 150),
    humidity_pct: number(input.humidity_pct, 0, 100),
    battery_pct: number(input.battery_pct, 0, 100),
    status,
    extra
  };
  const canonical = canonicalize(event);
  return { event, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
