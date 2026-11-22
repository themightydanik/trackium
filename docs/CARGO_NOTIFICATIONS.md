# Local shipment notifications

Enable `ENABLE_LOCAL_NOTIFICATIONS=true` on a disposable local Gateway and restart it. The flag defaults to off. The local transport writes a receipt to the same PostgreSQL database. It has no external address fields, credentials, message provider or network calls. Existing Free and Managed Gateway clients can continue using their usual authenticated APIs.

A tenant owner approves the local inbox with their existing admin credential using a trusted API client:

```http
PUT /v1/notifications
Content-Type: application/json

{"enabled":true,"include_synthetic":false}
```

Pass the bearer credential via the trusted client’s authorization header. Keep it out of Lite, URLs and logs. Omit `include_synthetic` to exclude demo data. An owner may explicitly opt in to synthetic notifications for a rehearsal. Send `{"enabled":false}` to stop new notifications and cancel queued deliveries. Turning off synthetic notifications also cancels queued synthetic deliveries. Delivered and failed entries remain visible. Re-enabling starts with future eligible events.

A paired customer with `read` can see the latest 25 notification states in **Settings → Local shipment notifications** or with `GET /v1/notifications`. The API derives the tenant from the authenticated key or session. It accepts no tenant selector. Editing preferences requires the existing admin scope. A revoked key or session cannot access the inbox.

## Event and delivery semantics

Shipment status changes, checkpoints, route deviation/recovery and temperature violation/recovery are eligible after consent. The Gateway appends a delivery record in the same transaction as the immutable event and its cargo outbox record. Raw telemetry and shipment draft events produce no notification. Existing physical telemetry still cannot drive location-derived transitions. Notices label provenance from the originating event. **Delivered** refers to the local inbox receipt. Proof publication and verification follow their existing independent rules.

The delivery worker uses separate rows and does not claim or change the existing proof outbox. It processes bounded batches and serializes with tenant consent changes. Receipt and delivery state commit together. A failed local receipt write retries after five and ten seconds, then records a terminal failure at three attempts. The latest error is a stable code without underlying database details. An interrupted transaction leaves the delivery eligible after restart. The cargo event ID uniquely identifies a receipt. No historical scan or automatic replay of terminal deliveries is performed.

Migration 009 adds preferences, delivery and receipt tables. Existing cargo and proof rows are preserved. Turn off the worker and inbox API by removing the flag or setting it to false. That switch pauses delivery. Re-enable it to resume durable pending work, or first use the owner opt-out endpoint if the plan is to cancel it. Backup and restore preserve preferences and delivery state. Reconcile consent changes that occurred after an older snapshot before resuming its worker.

A real communication channel needs approval of the channel, recipient consent, destination ownership, retention and provider idempotency. These local checks provide no external delivery evidence. TRK-P1-205 remains dependent on the product owner’s decisions about plan limits, lifecycle and read/export access. Billing is a separate integration.
