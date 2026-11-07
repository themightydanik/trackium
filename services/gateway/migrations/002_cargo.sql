ALTER TABLE telemetry_api_keys DROP CONSTRAINT telemetry_api_keys_scopes_check;
ALTER TABLE telemetry_api_keys ADD CONSTRAINT telemetry_api_keys_scopes_check CHECK (
 cardinality(scopes)>0 AND scopes <@ ARRAY['read','admin','fixture','shipments','simulate']::TEXT[]);
ALTER TABLE telemetry_devices ADD COLUMN identity_kind TEXT NOT NULL DEFAULT 'fixture';
UPDATE telemetry_devices SET identity_kind='physical' WHERE mode='real';
ALTER TABLE telemetry_devices ADD CONSTRAINT telemetry_device_identity_check CHECK (
 (mode='real' AND identity_kind='physical') OR (mode='synthetic' AND identity_kind IN ('fixture','simulator')));
ALTER TABLE telemetry_devices ADD UNIQUE(tenant_id,id,mode,identity_kind);
ALTER TABLE telemetry_events ADD COLUMN identity_kind TEXT NOT NULL DEFAULT 'fixture';
ALTER TABLE telemetry_events DROP CONSTRAINT telemetry_events_source_check;
ALTER TABLE telemetry_events ADD CONSTRAINT telemetry_events_source_check CHECK (
 (source='fixture-v1' AND identity_kind='fixture') OR (source='simulator-v1' AND identity_kind='simulator'));
ALTER TABLE telemetry_events ADD FOREIGN KEY(tenant_id,device_id,device_mode,identity_kind)
 REFERENCES telemetry_devices(tenant_id,id,mode,identity_kind);

ALTER TABLE telemetry_api_keys ADD UNIQUE(tenant_id,id);
ALTER TABLE telemetry_events ADD UNIQUE(tenant_id,id);

CREATE TABLE cargo_shipments (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), device_id UUID NOT NULL,
 source_trust TEXT NOT NULL CHECK(source_trust IN ('synthetic','unverified')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','delivered','completed','cancelled')),
 route JSONB NOT NULL, conditions JSONB NOT NULL,
 head_hash TEXT, event_sequence BIGINT NOT NULL DEFAULT 0,
 temperature_violation BOOLEAN NOT NULL DEFAULT false, route_violation BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,id,source_trust), FOREIGN KEY(tenant_id,device_id) REFERENCES telemetry_devices(tenant_id,id)
);
CREATE UNIQUE INDEX cargo_active_device ON cargo_shipments(tenant_id,device_id) WHERE status IN ('active','delivered');
CREATE TABLE cargo_checkpoints (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL, shipment_id UUID NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal>=0),
 name TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
 radius_m DOUBLE PRECISION NOT NULL CHECK(radius_m BETWEEN 50 AND 10000),
 source_trust TEXT NOT NULL CHECK(source_trust IN ('synthetic','unverified')),
 FOREIGN KEY(tenant_id,shipment_id,source_trust) REFERENCES cargo_shipments(tenant_id,id,source_trust),
 visited_at TIMESTAMPTZ, telemetry_event_id UUID,
 FOREIGN KEY(tenant_id,telemetry_event_id) REFERENCES telemetry_events(tenant_id,id),
 UNIQUE(tenant_id,shipment_id,ordinal), FOREIGN KEY(tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id)
);
CREATE TABLE cargo_events (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL, shipment_id UUID NOT NULL,
 sequence BIGINT NOT NULL, event_key TEXT NOT NULL, event_type TEXT NOT NULL, event_time TIMESTAMPTZ NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 device_id UUID NOT NULL, source_trust TEXT NOT NULL CHECK(source_trust IN ('synthetic','unverified')),
 canonical_payload TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64), previous_hash TEXT,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,shipment_id,sequence), UNIQUE(tenant_id,shipment_id,event_key),
 FOREIGN KEY(tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id),
 FOREIGN KEY(tenant_id,shipment_id,source_trust) REFERENCES cargo_shipments(tenant_id,id,source_trust),
 FOREIGN KEY(tenant_id,device_id) REFERENCES telemetry_devices(tenant_id,id)
);
CREATE FUNCTION cargo_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'cargo event records are immutable'; END $$;
CREATE TRIGGER cargo_event_immutable BEFORE UPDATE OR DELETE ON cargo_events FOR EACH ROW EXECUTE FUNCTION cargo_event_immutable();
CREATE TABLE cargo_outbox (
 event_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','processed')),
 attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_until TIMESTAMPTZ, lease_token UUID, processed_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,event_id) REFERENCES cargo_events(tenant_id,id)
);
CREATE INDEX cargo_outbox_ready ON cargo_outbox(state,available_at,lease_until);
CREATE TABLE cargo_simulations (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL, shipment_id UUID NOT NULL, device_id UUID NOT NULL,
 source_trust TEXT NOT NULL DEFAULT 'synthetic' CHECK(source_trust='synthetic'),
 FOREIGN KEY(tenant_id,shipment_id,source_trust) REFERENCES cargo_shipments(tenant_id,id,source_trust),
 device_mode TEXT NOT NULL DEFAULT 'synthetic' CHECK(device_mode='synthetic'),
 identity_kind TEXT NOT NULL DEFAULT 'simulator' CHECK(identity_kind='simulator'),
 FOREIGN KEY(tenant_id,device_id,device_mode,identity_kind) REFERENCES telemetry_devices(tenant_id,id,mode,identity_kind),
 state TEXT NOT NULL CHECK(state IN ('running','paused','finished')),
 scenario TEXT NOT NULL CHECK(scenario IN ('normal','temperature-excursion')),
 step INTEGER NOT NULL DEFAULT 0, interval_ms INTEGER NOT NULL CHECK(interval_ms BETWEEN 250 AND 60000),
 snapshot JSONB NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), next_tick_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id),
 FOREIGN KEY(tenant_id,device_id) REFERENCES telemetry_devices(tenant_id,id)
);
CREATE UNIQUE INDEX cargo_one_run ON cargo_simulations(tenant_id,shipment_id) WHERE state IN ('running','paused');
CREATE INDEX cargo_simulation_due ON cargo_simulations(state,next_tick_at);
CREATE TABLE cargo_pairing (
 id UUID PRIMARY KEY, proof_hash TEXT NOT NULL UNIQUE, audience TEXT NOT NULL, requested_tenant_id UUID NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '2 minutes', tenant_id UUID REFERENCES telemetry_tenants(id),
 scopes TEXT[], approved_by UUID REFERENCES telemetry_api_keys(id), consumed_at TIMESTAMPTZ,
 CHECK(tenant_id IS NULL OR tenant_id=requested_tenant_id),
 FOREIGN KEY(tenant_id,approved_by) REFERENCES telemetry_api_keys(tenant_id,id)
);
CREATE TABLE cargo_sessions (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id),
 token_hash TEXT NOT NULL UNIQUE, audience TEXT NOT NULL,
 scopes TEXT[] NOT NULL CHECK(cardinality(scopes)>0 AND scopes <@ ARRAY['read','shipments','simulate']::TEXT[]),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '5 minutes', revoked_at TIMESTAMPTZ,
 approved_by UUID NOT NULL REFERENCES telemetry_api_keys(id),
 FOREIGN KEY(tenant_id,approved_by) REFERENCES telemetry_api_keys(tenant_id,id)
);
