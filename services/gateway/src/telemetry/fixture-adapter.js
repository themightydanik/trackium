import { ApiError, normalizeFixture } from './schema.js';

// Explicit test adapter, never installed on the TCP raw-capture path.
// Only the authenticated registry supplies identity; payload identity is rejected.
export function adaptFixture(input, registeredDevice) {
  if (registeredDevice.mode !== 'synthetic' || !registeredDevice.enabled) {
    throw new ApiError(403, 'fixture ingestion requires an enabled synthetic device');
  }
  return normalizeFixture(input, {
    tenantId: registeredDevice.tenant_id,
    deviceId: registeredDevice.id
  });
}
