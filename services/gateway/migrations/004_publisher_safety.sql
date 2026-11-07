ALTER TABLE cargo_proofs ADD COLUMN publisher_kind TEXT NOT NULL DEFAULT 'server' CHECK(publisher_kind IN ('server','local'));
ALTER TABLE cargo_proofs ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE cargo_proofs ADD COLUMN approval_expires_at TIMESTAMPTZ;
CREATE TABLE cargo_publisher_policies (
 tenant_id UUID PRIMARY KEY REFERENCES telemetry_tenants(id),
 publisher_kind TEXT NOT NULL CHECK(publisher_kind IN ('server','local')),
 publisher_address TEXT NOT NULL CHECK(publisher_address ~ '^0x[0-9a-f]{64}$'),
 max_publications INTEGER NOT NULL CHECK(max_publications BETWEEN 1 AND 100),
 max_input TEXT NOT NULL CHECK(max_input IN ('0.01','0.1','1')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION cargo_publisher_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF NEW.publisher_kind IS DISTINCT FROM OLD.publisher_kind THEN RAISE EXCEPTION 'publisher ownership is immutable'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER cargo_publisher_immutable BEFORE UPDATE ON cargo_proofs FOR EACH ROW EXECUTE FUNCTION cargo_publisher_immutable();
-- Explicit opt-in capability: existing keys/sessions are not upgraded.
ALTER TABLE telemetry_api_keys DROP CONSTRAINT telemetry_api_keys_scopes_check;
ALTER TABLE telemetry_api_keys ADD CONSTRAINT telemetry_api_keys_scopes_check CHECK (
 cardinality(scopes)>0 AND scopes <@ ARRAY['read','admin','fixture','shipments','simulate','publish']::TEXT[]);
ALTER TABLE cargo_sessions DROP CONSTRAINT cargo_sessions_scopes_check;
ALTER TABLE cargo_sessions ADD CONSTRAINT cargo_sessions_scopes_check CHECK (
 cardinality(scopes)>0 AND scopes <@ ARRAY['read','shipments','simulate','publish']::TEXT[]);
-- A signed job reserves the wallet across browser profiles/devices, not just Web Locks.
CREATE TABLE cargo_local_wallet_claims (
 publisher_address TEXT PRIMARY KEY, proof_id UUID NOT NULL UNIQUE, tenant_id UUID NOT NULL,
 claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,proof_id) REFERENCES cargo_proofs(tenant_id,id)
);
