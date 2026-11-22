CREATE TABLE customer_mail_jobs (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL UNIQUE REFERENCES customer_mail_tokens(token_hash) ON DELETE CASCADE,
 sender text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 next_at timestamptz NOT NULL DEFAULT now(),
 outcome text CHECK (outcome IN ('accepted', 'rejected', 'expired'))
);
CREATE INDEX customer_mail_jobs_ready ON customer_mail_jobs(next_at, id) WHERE outcome IS NULL;

CREATE TABLE customer_rate_buckets (
 window_at timestamptz NOT NULL,
 bucket text NOT NULL,
 attempts integer NOT NULL,
 PRIMARY KEY(window_at, bucket)
);

CREATE INDEX customer_mail_tokens_recipient ON customer_mail_tokens(email,purpose,expires_at);
