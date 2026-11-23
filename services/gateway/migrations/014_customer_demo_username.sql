ALTER TABLE customer_demo
  ADD COLUMN username text NOT NULL DEFAULT 'trackium-demo'
  CHECK (username = 'trackium-demo');

DELETE FROM customer_sessions s USING customer_demo d
WHERE s.account_id = d.account_id;
