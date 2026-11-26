CREATE TABLE device_activation_inventory (
  serial text PRIMARY KEY CHECK (serial ~ '^[A-Z0-9][A-Z0-9._-]{3,63}$'),
  device_id_bcd text NOT NULL UNIQUE CHECK (device_id_bcd ~ '^[0-9]{12}$'),
  activation_sha256 text CHECK (activation_sha256 ~ '^[a-f0-9]{64}$'),
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  tenant_id uuid,
  device_id uuid,
  FOREIGN KEY (tenant_id,device_id) REFERENCES telemetry_devices (tenant_id,id),
  UNIQUE (tenant_id,device_id),
  CHECK ((claimed_at IS NULL AND tenant_id IS NULL AND device_id IS NULL) OR
    (claimed_at IS NOT NULL AND tenant_id IS NOT NULL AND device_id IS NOT NULL AND activation_sha256 IS NULL))
);

CREATE FUNCTION guard_inventory_aovx_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inventory device_activation_inventory%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('aovx-enroll:'||NEW.device_id_bcd,0));
  SELECT * INTO inventory FROM device_activation_inventory WHERE device_id_bcd=NEW.device_id_bcd;
  IF FOUND AND (inventory.tenant_id, inventory.device_id) IS DISTINCT FROM (NEW.tenant_id, NEW.device_id) THEN
    RAISE EXCEPTION 'AOVX identifier reserved for device activation' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_inventory_aovx_binding
BEFORE INSERT ON telemetry_aovx_device_bindings
FOR EACH ROW EXECUTE FUNCTION guard_inventory_aovx_binding();
