# Shipment road route revisions · Issue #88 B3

A shipment has three independent sources of geographic information. Its existing planned checkpoints drive the existing checkpoint and route-deviation logic. An active road route is a planning decision made by an operator. Observed GPS remains in telemetry history with its own provenance and eligibility. B3 never writes checkpoints, telemetry, shipment ledger or proofs.

## Gateway contract

All paths below are relative to `/v1/shipments/{shipment_uuid}/road-routes`. The selected company comes from the existing Lite customer session. All operations require company membership. GET requires `read` and includes Viewer. POST requires the `shipments` scope and existing same-origin CSRF. Owner, Admin and Dispatcher can propose. Owner and Admin can approve and activate. Pairing sessions, API keys and native bearer sessions cannot use these endpoints. A resource in another company returns the same 404 as a missing resource.

| Method and suffix | Request | Result |
| --- | --- | --- |
| GET (none) | No body | `{generation, active_revision_id, revisions}`. Up to 100 summaries, newest first |
| GET `/active` | No body | `{generation, active_revision_id, revision}`. Revision is null until first activation |
| GET `/{revision_uuid}` | No body | Same envelope with that historical revision |
| GET `/compare?base_revision=UUID&target_revision=UUID` | Two distinct revisions of this shipment | `{generation, active_revision_id, from, to, delta}`. Includes stops, profile, truck dimensions, graph and estimates for each side, with target-minus-base distance and duration |
| POST (none) | `{expected_generation, request_id, calculation}` | 201 with `{generation, active_revision_id, revision, replayed:false}`. Identical committed retry returns 200 and `replayed:true` |
| POST `/{revision_uuid}/approve` | `{expected_generation}` | 200 with `{generation, active_revision_id, revision}` |
| POST `/{revision_uuid}/activate` | `{expected_generation}` | Same envelope with new active revision |

Lists and compares omit geometry. Use the detail endpoint to overlay geometries via their existing B2 polyline6 contract. Each detail carries `id`, sequential `version`, ordered `stops`, the exact successful B2 `calculation`, current `state`, and chronological `audit`. Audit entries carry `state`, `generation`, `actor_account_id` and `occurred_at`; the first entry identifies the creator and proposal time. This differs from `calculation.calculated_at`, the time Valhalla's result was accepted. Actor IDs are opaque customer account identifiers resolved by the Gateway. They remain in history if membership later ends.

The proposal `calculation` uses the [B2 request contract](GATEWAY_ROUTING_API.md). The client supplies stops and vehicle options only. The service writes the verified B2 result, including graph ID, engine and source snapshot. Recalculation against a later graph always creates a new version. History and lifecycle actions on existing revisions continue with routing unconfigured or unreachable. Standalone B2 calculation does not store anything.

The shipment's route generation starts at zero and increases once for each successful mutation. A proposed revision is eligible for approval, an approved revision for activation. Activation supersedes the previous active revision in the same transaction and generation. Superseded revisions remain readable. There are no edit, reject, withdrawal, delete or reactivate operations. Use a new request UUID for each new proposal. Reusing a committed UUID with the same calculation and actor retrieves that revision, even if generation has changed. Reusing it with different content or another actor returns `ROUTE_REQUEST_CONFLICT`. Concurrent identical requests can use additional Valhalla capacity before a result commits, but can persist only one revision. Duplicate transitions with the original generation return `ROUTE_GENERATION_CONFLICT`. Refresh before retrying a stale command.

Other lifecycle errors include 409 `ROUTE_STATE_CONFLICT` and `ROUTE_HISTORY_LIMIT`, and 404 `ROUTE_RESOURCE_NOT_FOUND`. Invalid JSON, extra fields and invalid IDs return 400, and oversized requests return 413. Proposal provider errors use the B2 codes. Normalized route JSONB is capped at 1 MiB per revision and the request body at 8 KiB. A shipment can retain 100 versions for its lifetime. All audit entries are retained, with at most four state entries per version. Reaching the cap rejects new proposals. No automatic pruning or eviction is performed.

## Concurrency and release

B3 checks ownership and generation before issuing an upstream calculation, without a write lock. It then acquires a shipment row lock, checks the generation again and commits revision, audit and active head together. Other B3 writes serialize on the same shipment row. B3 never acquires the Cargo tenant advisory lock after taking that row lock. Ordinary Cargo may take its advisory lock first and wait for B3's short transaction. Route reads use one repeatable-read snapshot.

Migration 017 creates three empty tables with composite shipment ownership foreign keys, version/idempotency uniqueness, immutable revision and audit triggers, and a single head per shipment. The active head references both a revision and its activation audit. The migration neither rewrites nor backfills shipment rows. The foreign keys briefly lock the referenced shipment table while the existing migration runner applies the transactional DDL. Review ordinary migration lock contention before rollout. Preserve migration 017 and the new tables on binary rollback. The B2 binary ignores the additional schema and leaves historical revisions available to a subsequent B3 rollout. Disable B2 provider configuration to stop new calculations while leaving B3 history available. There is no automatic route publication or graph promotion.

The private routing CI exercises the entire lifecycle through customer-cookie HTTP calls, disposable PostgreSQL and real Valhalla 3.6.3 on the pinned synthetic roads. The PostgreSQL suite adds concurrent approvals/activations, forced rollback, obsolete generation, cross-tenant foreign keys, an offline read after changing graph releases, immutability and oversized storage rejection. The recorded run retained the original 2,830 m car revision and activated the 5,946 m truck revision at generation 6. [B3 fixture result](valhalla-b2/shipment-revisions-gateway.json) · [B2 geographic validation](valhalla-b2/README.md)
