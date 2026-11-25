CREATE TABLE cargo_road_route_revisions (
 tenant_id UUID NOT NULL, shipment_id UUID NOT NULL, id UUID NOT NULL,
 version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 100),
 request_id UUID NOT NULL, request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
 stops JSONB NOT NULL CHECK (jsonb_typeof(stops) = 'array' AND jsonb_array_length(stops) BETWEEN 2 AND 10
   AND octet_length(stops::text) <= 4096),
 calculation JSONB NOT NULL CHECK (jsonb_typeof(calculation) = 'object' AND octet_length(calculation::text) <= 1048576
   AND calculation ?& ARRAY['profile','graph','calculated_at','route']
   AND COALESCE(calculation->>'profile' IN ('auto','truck'),false)
   AND jsonb_typeof(calculation->'graph') = 'object'
   AND calculation->'graph' ?& ARRAY['id','engine_version','osm_snapshot']
   AND COALESCE(calculation->'graph'->>'id' ~ '^[0-9a-f]{64}$',false)),
 PRIMARY KEY (tenant_id,shipment_id,id),
 UNIQUE (tenant_id,shipment_id,version), UNIQUE (tenant_id,shipment_id,request_id),
 FOREIGN KEY (tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id)
);
CREATE TABLE cargo_road_route_heads (
 tenant_id UUID NOT NULL, shipment_id UUID NOT NULL,
 generation INTEGER NOT NULL CHECK (generation BETWEEN 0 AND 300),
 active_revision_id UUID,
 PRIMARY KEY (tenant_id,shipment_id),
 FOREIGN KEY (tenant_id,shipment_id) REFERENCES cargo_shipments(tenant_id,id),
 FOREIGN KEY (tenant_id,shipment_id,active_revision_id)
   REFERENCES cargo_road_route_revisions(tenant_id,shipment_id,id)
);
CREATE TABLE cargo_road_route_audit (
 tenant_id UUID NOT NULL, shipment_id UUID NOT NULL, revision_id UUID NOT NULL,
 generation INTEGER NOT NULL CHECK (generation BETWEEN 1 AND 300),
 state TEXT NOT NULL CHECK (state IN ('proposed','approved','active','superseded')),
 actor_account_id UUID NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (tenant_id,shipment_id,revision_id,state),
 UNIQUE (tenant_id,shipment_id,generation,state),
 FOREIGN KEY (tenant_id,shipment_id,revision_id)
   REFERENCES cargo_road_route_revisions(tenant_id,shipment_id,id)
);
CREATE INDEX cargo_road_route_audit_revision ON cargo_road_route_audit
 (tenant_id,shipment_id,revision_id,generation DESC);
CREATE TRIGGER cargo_road_route_revision_immutable BEFORE UPDATE OR DELETE ON cargo_road_route_revisions
 FOR EACH ROW EXECUTE FUNCTION cargo_event_immutable();
CREATE TRIGGER cargo_road_route_audit_immutable BEFORE UPDATE OR DELETE ON cargo_road_route_audit
 FOR EACH ROW EXECUTE FUNCTION cargo_event_immutable();
ALTER TABLE cargo_road_route_heads ADD COLUMN active_state TEXT GENERATED ALWAYS AS ('active'::text) STORED;
ALTER TABLE cargo_road_route_heads ADD FOREIGN KEY (tenant_id,shipment_id,active_revision_id,active_state)
 REFERENCES cargo_road_route_audit(tenant_id,shipment_id,revision_id,state);
