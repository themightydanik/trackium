import { randomUUID } from 'node:crypto';
import { adaptFixture } from '../telemetry/fixture-adapter.js';
import { ApiError, canonicalize } from '../telemetry/schema.js';
import { hash, tenantLock } from './shared.js';
// One protected transaction pipeline for fixture and simulator adapters. Caller
// supplies an authenticated tenant; device identity always comes from registry.
export async function ingestSynthetic(
  client,
  tenant,
  id,
  input,
  raw,
  { source = 'fixture-v1', onEvent } = {}
) {
  await tenantLock(client, tenant);
  const result = await client.query(
    'SELECT * FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
    [tenant, id]
  );
  const device = result.rows[0];
  if (!device) throw new ApiError(404, 'device not found');
  if (device.identity_kind !== (source === 'simulator-v1' ? 'simulator' : 'fixture'))
    throw new ApiError(403, 'synthetic identity mismatch');
  const normalized = adaptFixture(input, device);
  normalized.event.source = source;
  normalized.canonical = canonicalize(normalized.event);
  normalized.sha256 = hash(normalized.canonical);
  const previous = await client.query(
    'SELECT id,canonical_event FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2 AND source=$3 AND source_event_id=$4',
    [tenant, id, source, input.source_event_id]
  );
  if (previous.rowCount) {
    if (previous.rows[0].canonical_event !== normalized.canonical)
      throw new ApiError(409, 'source_event_id already has different content');
    return { id: previous.rows[0].id, duplicate: true, trust: 'synthetic' };
  }
  const eventId = randomUUID(),
    fixtureId = randomUUID();
  await client.query(
    'INSERT INTO telemetry_fixture_inputs(id,tenant_id,device_id,raw_payload) VALUES($1,$2,$3,$4)',
    [fixtureId, tenant, id, raw]
  );
  await client.query(
    `INSERT INTO telemetry_events(id,tenant_id,device_id,schema_version,source,trust,source_event_id,occurred_at,payload,canonical_event,canonical_sha256,fixture_input_id,identity_kind)
 VALUES($1,$2,$3,1,$4,'synthetic',$5,$6,$7,$8,$9,$10,$11)`,
    [
      eventId,
      tenant,
      id,
      source,
      input.source_event_id,
      normalized.event.occurred_at,
      normalized.event,
      normalized.canonical,
      normalized.sha256,
      fixtureId,
      device.identity_kind
    ]
  );
  if (onEvent)
    await onEvent(client, {
      id: eventId,
      event: normalized.event,
      sha256: normalized.sha256,
      device
    });
  return { id: eventId, duplicate: false, trust: 'synthetic' };
}
