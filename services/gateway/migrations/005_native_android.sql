ALTER TABLE cargo_publisher_policies ADD COLUMN publisher_transport TEXT NOT NULL DEFAULT 'server_rpc';
UPDATE cargo_publisher_policies SET publisher_transport='mds_legacy' WHERE publisher_kind='local';
ALTER TABLE cargo_publisher_policies ADD CONSTRAINT cargo_publisher_transport CHECK (
 (publisher_kind='server' AND publisher_transport='server_rpc') OR
 (publisher_kind='local' AND publisher_transport IN ('mds_legacy','android_minimaapi')));
ALTER TABLE cargo_proofs ADD COLUMN publisher_transport TEXT NOT NULL DEFAULT 'server_rpc';
UPDATE cargo_proofs SET publisher_transport='mds_legacy' WHERE publisher_kind='local';
ALTER TABLE cargo_proofs ADD CONSTRAINT cargo_proof_transport CHECK (
 (publisher_kind='server' AND publisher_transport='server_rpc') OR
 (publisher_kind='local' AND publisher_transport IN ('mds_legacy','android_minimaapi')));
CREATE FUNCTION cargo_transport_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN IF NEW.publisher_transport IS DISTINCT FROM OLD.publisher_transport THEN RAISE EXCEPTION 'publisher transport is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER cargo_transport_immutable BEFORE UPDATE ON cargo_proofs FOR EACH ROW EXECUTE FUNCTION cargo_transport_immutable();
CREATE TABLE cargo_native_pairing (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id), proof_hash TEXT NOT NULL,
 audience TEXT NOT NULL, label TEXT NOT NULL, approved_by UUID, consumed_at TIMESTAMPTZ,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '2 minutes',
 FOREIGN KEY(tenant_id,approved_by) REFERENCES telemetry_api_keys(tenant_id,id)
);
CREATE TABLE cargo_native_sessions (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES telemetry_tenants(id), token_hash TEXT UNIQUE NOT NULL,
 pop_key BYTEA NOT NULL, audience TEXT NOT NULL, approved_by UUID NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '15 minutes', revoked_at TIMESTAMPTZ,
 requests INTEGER NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 900),
 FOREIGN KEY(tenant_id,approved_by) REFERENCES telemetry_api_keys(tenant_id,id)
);
CREATE TABLE cargo_native_nonces (
 session_id UUID NOT NULL REFERENCES cargo_native_sessions(id), nonce TEXT NOT NULL,
 PRIMARY KEY(session_id,nonce)
);
