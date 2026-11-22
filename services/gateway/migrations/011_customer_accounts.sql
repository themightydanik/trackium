CREATE TABLE customer_accounts (
 id uuid PRIMARY KEY,
 email text NOT NULL UNIQUE,
 password_digest text NOT NULL,
 verified_at timestamptz
);
CREATE TABLE customer_members (
 account_id uuid REFERENCES customer_accounts(id) NOT NULL,
 tenant_id uuid REFERENCES telemetry_tenants(id) NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','admin','dispatcher','viewer')),
 PRIMARY KEY (account_id,tenant_id)
);
CREATE TABLE customer_sessions (
 id uuid PRIMARY KEY,
 account_id uuid REFERENCES customer_accounts(id) NOT NULL,
 tenant_id uuid REFERENCES telemetry_tenants(id),
 token_hash text UNIQUE NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '12 hours'
);
CREATE INDEX customer_sessions_account ON customer_sessions(account_id);
CREATE TABLE customer_mail_tokens (
 token_hash text PRIMARY KEY,
 account_id uuid REFERENCES customer_accounts(id),
 email text NOT NULL,
 issuer_id uuid REFERENCES customer_accounts(id),
 purpose text NOT NULL CHECK (purpose IN ('verify','reset','invite')),
 tenant_id uuid REFERENCES telemetry_tenants(id),
 role text CHECK (role IN ('admin','dispatcher','viewer')),
 expires_at timestamptz NOT NULL,
 CHECK ((purpose = 'invite' AND account_id IS NULL AND tenant_id IS NOT NULL AND role IS NOT NULL AND issuer_id IS NOT NULL)
     OR (purpose IN ('verify','reset') AND account_id IS NOT NULL AND tenant_id IS NULL AND role IS NULL AND issuer_id IS NULL))
);
CREATE INDEX customer_mail_expiry ON customer_mail_tokens(expires_at);
