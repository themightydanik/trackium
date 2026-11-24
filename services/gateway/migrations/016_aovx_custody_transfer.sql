CREATE TABLE telemetry_aovx_transfers (
  id uuid PRIMARY KEY,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  source_binding_id uuid NOT NULL UNIQUE REFERENCES telemetry_aovx_device_bindings(id),
  destination_binding_id uuid NOT NULL UNIQUE REFERENCES telemetry_aovx_device_bindings(id),
  reverse_of uuid UNIQUE REFERENCES telemetry_aovx_transfers(id),
  source_approval uuid NOT NULL UNIQUE,
  destination_approval uuid NOT NULL UNIQUE,
  custody_reference uuid NOT NULL,
  operator_reference uuid NOT NULL,
  effective_at timestamptz NOT NULL,
  CHECK (source_binding_id <> destination_binding_id),
  CHECK (source_approval <> destination_approval)
);

CREATE FUNCTION telemetry_aovx_transfer_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AOVX transfer audit is immutable';
END $$;
CREATE TRIGGER telemetry_aovx_transfer_immutable BEFORE UPDATE OR DELETE ON telemetry_aovx_transfers
  FOR EACH ROW EXECUTE FUNCTION telemetry_aovx_transfer_immutable();

CREATE INDEX telemetry_aovx_identifier_history
  ON telemetry_aovx_device_bindings(device_id_bcd, created_at);
