CREATE TABLE telemetry_aovx_device_bindings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  device_id_bcd TEXT NOT NULL CHECK (device_id_bcd ~ '^[0-9]{12}$'),
  trust TEXT NOT NULL DEFAULT 'unverified' CHECK (trust = 'unverified'),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_by_api_key_id UUID,
  CHECK ((state = 'active' AND revoked_at IS NULL) OR (state = 'revoked' AND revoked_at IS NOT NULL)),
  FOREIGN KEY (tenant_id, device_id) REFERENCES telemetry_device_bindings(tenant_id, device_id),
  FOREIGN KEY (tenant_id, created_by_api_key_id) REFERENCES telemetry_api_keys(tenant_id, id)
);
CREATE UNIQUE INDEX telemetry_aovx_active_identifier
  ON telemetry_aovx_device_bindings(device_id_bcd) WHERE state = 'active';
CREATE UNIQUE INDEX telemetry_aovx_active_device
  ON telemetry_aovx_device_bindings(tenant_id, device_id) WHERE state = 'active';
CREATE INDEX telemetry_aovx_tenant_history
  ON telemetry_aovx_device_bindings(tenant_id, created_at DESC);
