CREATE TABLE core_device_installations (
  id uuid PRIMARY KEY,
  serial text NOT NULL REFERENCES device_activation_inventory(serial),
  tenant_id uuid NOT NULL,
  device_id uuid NOT NULL,
  key_sha256 text NOT NULL CHECK (key_sha256 ~ '^[a-f0-9]{64}$'),
  permission text NOT NULL CHECK (permission IN ('owner','full','view')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  FOREIGN KEY (tenant_id,device_id) REFERENCES telemetry_devices (tenant_id,id)
);
CREATE UNIQUE INDEX core_device_active_installation
  ON core_device_installations(serial,key_sha256) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX core_device_active_owner
  ON core_device_installations(serial) WHERE revoked_at IS NULL AND permission='owner';

CREATE TABLE core_device_request_nonces (
  key_sha256 text NOT NULL,
  nonce uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_sha256,nonce)
);
CREATE INDEX core_device_request_expiry ON core_device_request_nonces(expires_at);

ALTER TABLE core_device_installations ADD COLUMN approved_at timestamptz;

CREATE TABLE core_device_connection_codes (
  code_sha256 text PRIMARY KEY CHECK (code_sha256 ~ '^[a-f0-9]{64}$'),
  tenant_id uuid NOT NULL,
  device_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('full','view')),
  expires_at timestamptz NOT NULL,
  FOREIGN KEY (tenant_id,device_id) REFERENCES telemetry_devices (tenant_id,id)
);
CREATE INDEX core_device_connection_expiry ON core_device_connection_codes(expires_at);
