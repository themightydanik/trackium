CREATE TABLE customer_demo (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 account_id uuid NOT NULL UNIQUE REFERENCES customer_accounts(id),
 tenant_id uuid NOT NULL UNIQUE REFERENCES telemetry_tenants(id),
 enabled boolean NOT NULL DEFAULT true
);
