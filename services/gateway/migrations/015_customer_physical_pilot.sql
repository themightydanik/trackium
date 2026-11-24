CREATE TABLE customer_demo_pilot (
  account_id uuid PRIMARY KEY REFERENCES customer_demo(account_id),
  tenant_id uuid NOT NULL UNIQUE REFERENCES telemetry_tenants(id),
  active boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_aovx_approvals (
  tenant_id uuid NOT NULL REFERENCES telemetry_tenants(id),
  identifier_sha256 text NOT NULL UNIQUE CHECK (identifier_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (tenant_id, identifier_sha256)
);

CREATE TABLE customer_demo_pilot_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES customer_demo_pilot(account_id),
  action text NOT NULL CHECK (action IN ('promote','rollback')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
