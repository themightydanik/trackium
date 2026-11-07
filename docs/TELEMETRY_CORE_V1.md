# Telemetry Core v1

Telemetry Core extends the existing Node/PostgreSQL Gateway for both Free/self-hosted and Managed use. It adds an administrative device registry, normalized synthetic events, tenant-scoped read APIs and canonical event bytes. It does not implement a device protocol, blockchain publishing, pairing UI or production delivery guarantees. The legacy MiniDapp is unchanged.

## Trust and data paths

- TCP port 9000 still uses temporary newline framing and writes **only** `gateway_packets`. JSON-looking TCP data is never normalized automatically. Neither a payload device ID nor the socket address authenticates a device.
- Operator CLI -> tenant and scoped credential -> authenticated device registration -> server-generated UUID and immutable tenant binding. A `real` registration is an **unverified registry entry**, not proof of ownership or physical device authentication. There is no device reassignment/transfer endpoint in v1.
- Explicitly enabled fixture HTTP endpoint -> enabled `synthetic` registry entry -> validation -> fixture provenance + normalized event in one transaction. Every such event has `source=fixture-v1` and `trust=synthetic`. The database also prevents fixture events from referencing a `real` device. Fixture ingestion never creates devices, changes tenants or sets the TCP raw-packet reference.
- Authenticated read API -> tenant taken from the credential -> parameterized tenant-filtered queries. No global device listing or client-controlled tenant selector exists. This boundary is shared by Free and Managed deployments; billing/entitlement is not implemented.

## Schema and migration

Gateway startup first initializes the original journal, then applies `services/gateway/migrations/001_telemetry.sql`. The migration is transactional, protected by an advisory lock, recorded with SHA-256 in `gateway_schema_migrations`, and rejected if an applied migration's checksum changes. Existing raw rows and columns are not modified or backfilled. Do not edit an applied migration; add a subsequent version/runner entry for future changes. Take a backup before deployment and test upgrades against your own data. Rollback of this application version means reverting application code and retaining the additive tables; no destructive down migration is supplied.

New tables:

| Table | Purpose |
| --- | --- |
| `telemetry_tenants` | Tenant identities, provisioned by the operator |
| `telemetry_api_keys` | SHA-256 hashes of random 256-bit bearer tokens, scopes and revocation time |
| `telemetry_devices` | Server UUID, tenant, label, synthetic/real mode, enabled state |
| `telemetry_device_bindings` | Immutable administrative tenant assignment; no transfer workflow |
| `telemetry_fixture_inputs` | Accepted initial fixture request bytes and receipt time |
| `telemetry_events` | Append-only through the API: normalized payload, event time, canonical bytes/hash and provenance |

`telemetry_events` **is the telemetry history**; a `(tenant_id, device_id, occurred_at DESC, id DESC)` index supports history and latest queries. Composite foreign keys prevent cross-tenant device/provenance references. `raw_packet_id` is a reserved nullable FK to the unchanged raw journal and is constrained to NULL for v1 fixture events. A future authenticated real adapter will require a new migration and explicit trust policy.

## Authentication and provisioning

No API keys are supplied by default. The operator CLI requires direct database access and is not exposed over HTTP. From `services/gateway`, with `DATABASE_URL` set securely:

```sh
mkdir -p /tmp/trackium-credentials
chmod 700 /tmp/trackium-credentials
npm run telemetry:admin -- create-tenant --name='Example tenant' --out=/tmp/trackium-credentials/admin.json
# Use the tenant_id from that private file; issue separate least-privilege keys:
npm run telemetry:admin -- issue-key --tenant=TENANT_UUID --scopes=read --out=/tmp/trackium-credentials/read.json
npm run telemetry:admin -- issue-key --tenant=TENANT_UUID --scopes=fixture --out=/tmp/trackium-credentials/fixture.json
npm run telemetry:admin -- revoke-key --id=KEY_UUID
```

The CLI writes a new file with mode 0600 and refuses output inside the checkout/application directory. It does not print tokens. Keep the files outside source control, copy credentials securely, and delete temporary copies when no longer needed. A failed output write revokes the newly issued key. `create-tenant` initially grants `read,admin,fixture`; replace this bootstrap key with separate scoped keys and revoke it when appropriate. `admin` permits registration/disablement only within that key's tenant; it does not implicitly grant read or fixture access. Revocation affects subsequent authentication checks; an already authenticated in-flight request may complete.

In Compose, use the same CLI with `docker compose -f compose.yml exec gateway node src/telemetry/admin.js ... --out=/tmp/key.json`; extract that file securely and remove it from the container after use. Do not pass tokens on the command line or paste them into shared logs. Direct database operators are privileged across tenants.

## API contract

All `/v1/` routes require `Authorization: Bearer <token>`. Health endpoints retain their existing behavior. Responses are JSON with `Cache-Control: no-store`; write requests require `Content-Type: application/json`, valid UTF-8 and at most 16 KiB. Unknown fields, unsupported schema versions and client-supplied identity/trust fields are rejected. Errors return `{ "error": "..." }`: 400 validation, 401 absent/invalid/revoked key, 403 scope/device policy, 404 absent or foreign-tenant device/disabled fixture endpoint, 409 conflicting replay, 413 oversized body, 415 content type, 503 database/service failure. Database details and credentials are not returned.

| Method and route | Scope | Result |
| --- | --- | --- |
| `POST /v1/devices` | admin | Register `{ "label": "fixture", "mode": "synthetic" }` or mode `real`; server assigns UUID and tenant; 201 |
| `PATCH /v1/devices/:id` | admin | `{ "enabled": false }` disables further fixture ingestion; retained history remains readable |
| `GET /v1/devices?limit=100&cursor=UUID` | read | `{ devices, next_cursor }`, ordered by UUID, maximum 200 |
| `GET /v1/devices/:id` | read | Registry entry |
| `GET /v1/devices/:id/location` | read | Latest non-null GPS by event time, or `location: null`; includes `trust` |
| `GET /v1/devices/:id/status` | read | Registry mode/enabled, last event time, reported status and trust |
| `GET /v1/devices/:id/events` | read | `{ events, next_cursor }`; optional `limit`, `cursor`, `from`, `to` |
| `POST /v1/fixtures/devices/:id/events` | fixture | Synthetic event only; requires `ENABLE_FIXTURE_ADAPTER=true`; 201 new / 200 identical replay |

Fixture support defaults to false, including Compose. Configure it explicitly in `.env` and recreate the gateway for synthetic tests. It must not be used as a real device ingestion endpoint. Unknown routes and methods return 404. There is no public endpoint for tenant creation or API-key issuance.

History is sorted by `occurred_at DESC, id DESC`. `from`/`to` are inclusive UTC timestamps with milliseconds; `cursor` is an opaque keyset cursor for the same device and filters. Equal event times have a deterministic UUID tie-break, not a physical arrival order. Pagination is not a snapshot: new/backdated events may appear during browsing. A newer event without GPS updates status but does not erase the last known location. Reported `offline`/`moving` states come from synthetic input; the server does not infer connectivity or assert sensor truth.

## Normalized event v1 and canonical bytes

Fixture input example:

```json
{
  "schema_version": 1,
  "source_event_id": "fixture-0001",
  "occurred_at": "2026-11-07T12:00:00.000Z",
  "gps": { "latitude": 50.45, "longitude": 30.52, "accuracy_m": 5 },
  "temperature_c": 21.5,
  "humidity_pct": 45,
  "battery_pct": 90,
  "status": "stationary",
  "extra": { "door_open": false }
}
```

- `source_event_id` is required, nonempty, at most 128 characters, without control characters. It identifies an event only inside this device/source/tenant namespace; it is not device authentication.
- `occurred_at` is required, exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ` (years 0001–9999). Receipt time is assigned by PostgreSQL separately. Synthetic clock skew/future timestamps are allowed and untrusted.
- `gps` is optional/null. If present, latitude and longitude are required, WGS84 decimal degrees in [-90,90]/[-180,180]. Optional altitude [-12000,100000] metres, accuracy [0,100000] metres, speed [0,400] m/s, heading [0,359.999999] degrees normalize to null when absent.
- Optional temperature [-100,150] Celsius, humidity and battery [0,100] percent normalize to null. These are software validation bounds, not a GL110-GL specification. Finite numbers only; numeric strings are rejected.
- Status is `unknown` (default), `stationary`, `moving`, `alarm` or `offline`.
- `extra` defaults to `{}`: at most 32 ASCII identifier keys (up to 64 characters), scalar/null values, strings up to 256 characters, finite numbers within JS safe-integer magnitude. Nested objects, arrays, reserved prototype keys, NUL and malformed Unicode are rejected. Additional sensor units/meaning must be agreed by a future versioned adapter.

Normalization adds the server tenant/device IDs, `source`, `trust`, `canonical_format=trackium-json-v1`, and explicit null defaults. Canonicalization recursively sorts object keys in JavaScript UTF-16 order, preserves array order, uses ECMAScript JSON number/string serialization, normalizes negative zero to zero, emits no whitespace, and uses UTF-8 bytes. This is a bounded application-specific format, **not a claim of RFC 8785 conformance**. The exact canonical string is stored and exposed with its SHA-256 checksum; do not reconstruct bytes from PostgreSQL JSONB ordering. Receipt time and database event UUID are excluded so replay is stable.

A device-row lock serializes fixture ingestion for one device. The deduplication key is `(tenant_id, device_id, source, source_event_id)`. Identical normalized content returns the existing event without another provenance row. Reusing that key with changed content returns 409. Different source IDs are distinct even if sensor readings match. Validation failures are not stored; failure inserting an event rolls back its fixture provenance. No automatic backfill or normalization of existing TCP data occurs.

The checksum prepares stable inputs for a future Proof Engine; it is neither a Minima commitment nor a signature, proof of authenticity, on-chain timestamp or completed evidence format.

## Validation and remaining security work

```sh
npm ci
npm test
# Explicit separate PostgreSQL integration suite; uses and cleans a unique schema.
# TEST_DATABASE_URL must point to a disposable database with CREATE SCHEMA permission.
TEST_DATABASE_URL='postgres://user:password@127.0.0.1/testdb' npm run test:integration
```

Tests cover schema/canonical bytes, identity injection, global Gateway limits/lifecycle regression, repeated/concurrent migration, preserved raw journal, tenant isolation on each API path, scopes/revocation, fixture opt-in and real-device refusal, concurrent duplicate/conflicting events, history/status/location, request limits, cross-tenant database FKs, transaction rollback and TCP separation. Test credentials are generated in memory, never committed.

The API is ready for **local authenticated MiniDapp client development against synthetic data**. No UI, pairing exchange, CORS policy or cross-origin browser integration is implemented or validated. A MiniDapp must carry only its own scoped tenant credential, respect `trust`, and use HTTPS before remote access. Compose remains localhost-only. Do not expose fixture or admin endpoints publicly as a production service.

Further work includes verified GL110-GL framing/fixtures, device authentication and ownership provisioning, ACK/retry/deduplication semantics, tenant transfer and credential lifecycle, TLS/reverse-proxy hardening, rate/retention/tenant quotas, backup/restore and monitoring. API isolation is enforced in application queries plus composite FKs; PostgreSQL RLS, separate database roles and protection against a compromised Gateway/database administrator are not provided. High-entropy bearer keys are hashed at rest but not automatically expiring. There is no durable pre-database queue or production readiness claim.
