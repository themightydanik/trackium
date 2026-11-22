CREATE TABLE cargo_notification_preferences (
 tenant_id UUID PRIMARY KEY REFERENCES telemetry_tenants(id),
 enabled BOOLEAN NOT NULL,
 include_synthetic BOOLEAN NOT NULL CHECK (enabled OR NOT include_synthetic)
);

CREATE TABLE cargo_notification_deliveries (
 tenant_id UUID NOT NULL,
 event_id UUID PRIMARY KEY,
 state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','delivered','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_error TEXT CHECK (last_error = 'LOCAL_INBOX_WRITE_FAILED'),
 UNIQUE (tenant_id,event_id),
 FOREIGN KEY (tenant_id,event_id) REFERENCES cargo_events(tenant_id,id)
);
CREATE INDEX cargo_notification_ready ON cargo_notification_deliveries(next_attempt_at,event_id)
 WHERE state='pending';
CREATE INDEX cargo_notification_tenant ON cargo_notification_deliveries(tenant_id);

-- The local inbox is the entire transport. Its idempotency key is the cargo event ID.
CREATE TABLE cargo_notification_inbox (
 tenant_id UUID NOT NULL,
 event_id UUID PRIMARY KEY,
 delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,event_id) REFERENCES cargo_notification_deliveries(tenant_id,event_id)
);
