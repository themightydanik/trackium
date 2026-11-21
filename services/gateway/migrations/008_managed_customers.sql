-- Operator-owned mapping. Tenant credentials and pairing continue to use the existing tables.
CREATE TABLE managed_customers (
  customer_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES telemetry_tenants(id),
  access_revision INTEGER NOT NULL DEFAULT 0 CHECK (access_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_changed_at TIMESTAMPTZ
);
