CREATE TABLE cargo_integritas_requests (
 id UUID PRIMARY KEY,
 tenant_id UUID NOT NULL,
 event_id UUID NOT NULL,
 evidence TEXT NOT NULL,
 evidence_sha3_256 TEXT NOT NULL CHECK (length(evidence_sha3_256)=64),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,event_id),
 FOREIGN KEY(tenant_id,event_id) REFERENCES cargo_events(tenant_id,id)
);
CREATE TRIGGER cargo_integritas_request_immutable BEFORE UPDATE OR DELETE ON cargo_integritas_requests
 FOR EACH ROW EXECUTE FUNCTION cargo_event_immutable();

CREATE TABLE cargo_integritas_states (
 request_id UUID PRIMARY KEY REFERENCES cargo_integritas_requests(id),
 status TEXT NOT NULL DEFAULT 'prepared'
 CHECK (status IN ('prepared','submitted','pending','anchored','verified','failed','unknown')),
 operation_id TEXT,
 error TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cargo_integritas_work ON cargo_integritas_states(updated_at)
 WHERE status IN ('prepared','submitted','pending','unknown');
