CREATE TABLE telemetry_tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE telemetry_api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  scopes TEXT[] NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read','admin','fixture']::TEXT[]),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE TABLE telemetry_devices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  mode TEXT NOT NULL CHECK (mode IN ('synthetic','real')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, mode)
);
CREATE TABLE telemetry_device_bindings (
  tenant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, device_id),
  FOREIGN KEY (tenant_id, device_id) REFERENCES telemetry_devices(tenant_id, id)
);
-- Separate provenance: HTTP fixtures must never masquerade as TCP packets.
CREATE TABLE telemetry_fixture_inputs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload BYTEA NOT NULL CHECK (octet_length(raw_payload) <= 16384),
  UNIQUE (tenant_id, device_id, id),
  FOREIGN KEY (tenant_id, device_id) REFERENCES telemetry_device_bindings(tenant_id, device_id)
);
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  device_mode TEXT NOT NULL DEFAULT 'synthetic' CHECK (device_mode = 'synthetic'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  source TEXT NOT NULL CHECK (source = 'fixture-v1'),
  trust TEXT NOT NULL CHECK (trust = 'synthetic'),
  source_event_id TEXT NOT NULL CHECK (length(source_event_id) BETWEEN 1 AND 128),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  canonical_event TEXT NOT NULL,
  canonical_sha256 TEXT NOT NULL CHECK (length(canonical_sha256) = 64),
  fixture_input_id UUID NOT NULL,
  -- Reserved FK for a future authenticated protocol adapter; fixtures cannot set it.
  raw_packet_id BIGINT REFERENCES gateway_packets(id),
  CHECK (raw_packet_id IS NULL),
  FOREIGN KEY (tenant_id, device_id, device_mode) REFERENCES telemetry_devices(tenant_id, id, mode),
  FOREIGN KEY (tenant_id, device_id, fixture_input_id) REFERENCES telemetry_fixture_inputs(tenant_id, device_id, id),
  UNIQUE (tenant_id, device_id, source, source_event_id)
);
CREATE INDEX telemetry_events_history_idx ON telemetry_events(tenant_id, device_id, occurred_at DESC, id DESC);
CREATE INDEX telemetry_devices_tenant_idx ON telemetry_devices(tenant_id, id);
CREATE INDEX telemetry_keys_tenant_idx ON telemetry_api_keys(tenant_id);
