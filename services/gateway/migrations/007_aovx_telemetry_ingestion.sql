ALTER TABLE gateway_packets
  ADD COLUMN aovx_processing_state TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (aovx_processing_state IN ('not_applicable','pending','processed','unbound','rejected')),
  ADD COLUMN aovx_processing_error TEXT;

UPDATE gateway_packets
SET aovx_processing_state = 'pending'
WHERE aovx_message_id = 512;

ALTER TABLE telemetry_events
  DROP CONSTRAINT telemetry_events_device_mode_check,
  DROP CONSTRAINT telemetry_events_trust_check,
  DROP CONSTRAINT telemetry_events_source_check,
  DROP CONSTRAINT telemetry_events_check;

ALTER TABLE telemetry_events
  ALTER COLUMN fixture_input_id DROP NOT NULL,
  ADD COLUMN event_time_basis TEXT NOT NULL DEFAULT 'source_timestamp'
    CHECK (event_time_basis IN ('source_timestamp','gateway_received_at')),
  ADD COLUMN device_time_raw TEXT,
  ADD COLUMN parser_version TEXT;

ALTER TABLE telemetry_events
  ADD CONSTRAINT telemetry_events_device_mode_check
    CHECK (device_mode IN ('synthetic','real')),
  ADD CONSTRAINT telemetry_events_trust_check
    CHECK (trust IN ('synthetic','unverified')),
  ADD CONSTRAINT telemetry_events_source_check
    CHECK (
      (source='fixture-v1' AND identity_kind='fixture' AND trust='synthetic') OR
      (source='simulator-v1' AND identity_kind='simulator' AND trust='synthetic') OR
      (source='aovx-gal-v1' AND identity_kind='physical' AND device_mode='real' AND trust='unverified')
    ),
  ADD CONSTRAINT telemetry_events_provenance_check
    CHECK (
      (source IN ('fixture-v1','simulator-v1') AND fixture_input_id IS NOT NULL AND raw_packet_id IS NULL) OR
      (source='aovx-gal-v1' AND fixture_input_id IS NULL AND raw_packet_id IS NULL
        AND event_time_basis='gateway_received_at' AND device_time_raw IS NOT NULL
        AND parser_version IS NOT NULL)
    );

CREATE TABLE telemetry_aovx_packet_events (
  packet_id BIGINT PRIMARY KEY REFERENCES gateway_packets(id),
  tenant_id UUID NOT NULL,
  device_id UUID NOT NULL,
  event_id UUID NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, device_id) REFERENCES telemetry_device_bindings(tenant_id, device_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES telemetry_events(tenant_id, id)
);
CREATE INDEX telemetry_aovx_packet_events_event_idx
  ON telemetry_aovx_packet_events(tenant_id, device_id, event_id);
