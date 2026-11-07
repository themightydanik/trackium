ALTER TABLE cargo_outbox ADD COLUMN proof_enqueued_at TIMESTAMPTZ;
CREATE TABLE cargo_proofs (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL, shipment_id UUID NOT NULL, event_id UUID NOT NULL,
 sequence BIGINT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 chain_id TEXT NOT NULL CHECK(chain_id ~ '^0x[0-9a-f]{2}$'), publisher_address TEXT,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitting','submitted','included','confirmed','retryable_error','failed','reorged')),
 commitment JSONB NOT NULL, commitment_canonical TEXT NOT NULL, commitment_sha256 TEXT NOT NULL CHECK(length(commitment_sha256)=64),
 wire TEXT NOT NULL CHECK(wire ~ '^0x[0-9a-f]{76}$'),
 custom_id TEXT NOT NULL, signed_data TEXT, transaction_id TEXT, mined_data TEXT, mined_sha256 TEXT, txpow_id TEXT,
 test_receipt TEXT, publication_blocked BOOLEAN NOT NULL DEFAULT false, attempts INTEGER NOT NULL DEFAULT 0, submit_attempts INTEGER NOT NULL DEFAULT 0,
 required_depth INTEGER NOT NULL CHECK(required_depth BETWEEN 1 AND 100), confirmations INTEGER NOT NULL DEFAULT 0 CHECK(confirmations>=0),
 included_height BIGINT, included_block_id TEXT, last_checked_at TIMESTAMPTZ,
 verification JSONB, last_error_code TEXT, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(event_id,mode), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,event_id) REFERENCES cargo_events(tenant_id,id),
 FOREIGN KEY(tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id),
 CHECK(mode<>'live' OR (publisher_address IS NOT NULL AND publisher_address ~ '^0x[0-9a-f]{64}$')),
 CHECK(mode='live' OR (state NOT IN ('included','confirmed','reorged') AND confirmations=0)),
 CHECK(attempts>=0 AND submit_attempts>=0),
 CHECK(mode='live' OR (txpow_id IS NULL AND mined_data IS NULL AND transaction_id IS NULL AND signed_data IS NULL)),
 CHECK(state<>'confirmed' OR (mode='live' AND txpow_id IS NOT NULL AND confirmations>=required_depth)),
 CHECK(txpow_id IS NULL OR txpow_id ~ '^0x[0-9a-f]{64}$'),
 CHECK(mined_data IS NULL OR (txpow_id IS NOT NULL AND mined_sha256 IS NOT NULL)),
 CHECK(octet_length(mined_data)<=2097152),CHECK(octet_length(signed_data)<=2097152)
);
CREATE INDEX cargo_proofs_work ON cargo_proofs(mode,state,next_attempt_at);
CREATE TABLE cargo_proof_attempts (
 id UUID PRIMARY KEY, proof_id UUID NOT NULL REFERENCES cargo_proofs(id),
 operation TEXT NOT NULL, request JSONB NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
 outcome TEXT NOT NULL DEFAULT 'started' CHECK(outcome IN ('started','succeeded','failed')),
 response JSONB, response_sha256 TEXT, error_code TEXT
);
CREATE TABLE cargo_proof_states (
 id UUID PRIMARY KEY, proof_id UUID NOT NULL REFERENCES cargo_proofs(id), state TEXT NOT NULL,
 details JSONB NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION cargo_proof_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF ROW(NEW.id,NEW.custom_id,NEW.commitment,NEW.event_id,NEW.tenant_id,NEW.shipment_id,NEW.sequence,NEW.mode,NEW.chain_id,NEW.publisher_address,NEW.commitment_canonical,NEW.commitment_sha256,NEW.wire,NEW.required_depth)
 IS DISTINCT FROM ROW(OLD.id,OLD.custom_id,OLD.commitment,OLD.event_id,OLD.tenant_id,OLD.shipment_id,OLD.sequence,OLD.mode,OLD.chain_id,OLD.publisher_address,OLD.commitment_canonical,OLD.commitment_sha256,OLD.wire,OLD.required_depth)
 THEN RAISE EXCEPTION 'proof identity is immutable'; END IF;
 IF OLD.signed_data IS NOT NULL AND ROW(NEW.signed_data,NEW.transaction_id) IS DISTINCT FROM ROW(OLD.signed_data,OLD.transaction_id) THEN RAISE EXCEPTION 'signed artifact is immutable'; END IF;
 IF OLD.mined_data IS NOT NULL AND ROW(NEW.mined_data,NEW.txpow_id,NEW.transaction_id,NEW.mined_sha256) IS DISTINCT FROM ROW(OLD.mined_data,OLD.txpow_id,OLD.transaction_id,OLD.mined_sha256)
 THEN RAISE EXCEPTION 'mined artifact is immutable'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER cargo_proof_identity_immutable BEFORE UPDATE ON cargo_proofs FOR EACH ROW EXECUTE FUNCTION cargo_proof_identity_immutable();
