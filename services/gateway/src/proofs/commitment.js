import { canonicalize, uuid } from '../telemetry/schema.js';
import { hash } from '../cargo/shared.js';
export const DOMAIN = 'trackium:cargo:minima-proof:v1';
export const PORT = 250;
export const TYPES = [
  'shipment_created',
  'checkpoint_reached',
  'temperature_violation',
  'temperature_recovered',
  'route_deviation',
  'route_recovered',
  'status_changed'
];
export class ProofError extends Error {
  constructor(code, { retryable = true } = {}) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}
export function hexId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value))
    throw new ProofError('INVALID_MINIMA_ID', { retryable: false });
  return value.toLowerCase();
}
export function chainId(value) {
  if (!/^0x[0-9a-f]{2}$/i.test(value ?? ''))
    throw new ProofError('INVALID_CHAIN_ID', { retryable: false });
  return value.toLowerCase();
}
export function record(row) {
  if (
    typeof row.canonical_payload !== 'string' ||
    Buffer.byteLength(row.canonical_payload) > 131072
  )
    throw new ProofError('CANONICAL_SIZE', { retryable: false });
  let value;
  try {
    value = JSON.parse(row.canonical_payload);
  } catch {
    throw new ProofError('INVALID_CANONICAL', { retryable: false });
  }
  if (canonicalize(value) !== row.canonical_payload)
    throw new ProofError('NON_CANONICAL', { retryable: false });
  if (hash(row.canonical_payload) !== row.sha256)
    throw new ProofError('EVENT_HASH_MISMATCH', { retryable: false });
  const n = Number(row.sequence);
  if (
    !Number.isSafeInteger(n) ||
    n < 1 ||
    value.schema_version !== 1 ||
    value.sequence !== n ||
    value.event_id !== row.id ||
    value.shipment_id !== row.shipment_id ||
    value.tenant_id !== row.tenant_id ||
    value.event_type !== row.event_type ||
    value.source_trust !== row.source_trust ||
    value.previous_hash !== (row.previous_hash ?? null) ||
    !['synthetic', 'unverified'].includes(value.source_trust)
  )
    throw new ProofError('EVENT_METADATA_MISMATCH', { retryable: false });
  for (const id of [value.event_id, value.shipment_id, value.tenant_id]) uuid(id);
  if (
    !/^[a-z_]{1,64}$/.test(value.event_type) ||
    !/^[0-9a-f]{64}$/.test(row.sha256) ||
    (row.previous_hash !== null && !/^[0-9a-f]{64}$/.test(row.previous_hash))
  )
    throw new ProofError('INVALID_EVENT_FORMAT', { retryable: false });
  return value;
}
export function buildCommitment(row, { mode, chain, publisherAddress = null }) {
  record(row);
  if (!['test', 'live'].includes(mode))
    throw new ProofError('INVALID_PROOF_MODE', { retryable: false });
  if (mode === 'live') publisherAddress = hexId(publisherAddress);
  const envelope = {
    domain: DOMAIN,
    schema_version: 1,
    publish_mode: mode,
    chain_id: chainId(chain),
    publisher_address: publisherAddress,
    event_id: row.id,
    shipment_id: row.shipment_id,
    event_type: row.event_type,
    sequence: Number(row.sequence),
    canonical_sha256: row.sha256,
    previous_hash: row.previous_hash ?? null,
    source_trust: row.source_trust
  };
  const canonical = canonicalize(envelope),
    digest = hash(canonical),
    flags = (row.source_trust === 'synthetic' ? 1 : 0) | (mode === 'test' ? 2 : 0);
  const wire = '0x54524b5001' + flags.toString(16).padStart(2, '0') + digest;
  return { envelope, canonical, digest, wire };
}
export function verifyRecords(records, anchor) {
  if (!Array.isArray(records) || !records.length || records.length > 2000)
    throw new ProofError('CHAIN_RECORD_COUNT', { retryable: false });
  let previous = null;
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    record(row);
    if (
      Number(row.sequence) !== i + 1 ||
      row.previous_hash !== previous ||
      row.shipment_id !== anchor.shipment_id ||
      row.tenant_id !== anchor.tenant_id ||
      row.source_trust !== anchor.source_trust
    )
      throw new ProofError('HASH_CHAIN_GAP_OR_MISMATCH', { retryable: false });
    previous = row.sha256;
  }
  if (records.at(-1).id !== anchor.id)
    throw new ProofError('ANCHOR_NOT_LAST', { retryable: false });
  return true;
}
