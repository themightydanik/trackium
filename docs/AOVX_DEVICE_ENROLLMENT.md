# AOVX device enrollment (manual owner binding)

This stage adds an explicit tenant-owned mapping between an AOVX protocol identifier and an existing physical device record. It does **not** authenticate the tracker or establish physical measurement units. The subsequent AOVX ingestion stage converts eligible 0x0200 observations into tenant-scoped telemetry with unverified provenance.

## Prerequisites

Create a physical device under the authenticated tenant:

```http
POST /v1/devices
Authorization: Bearer <tenant-admin-key>
Content-Type: application/json

{"label":"AOVX GL110-GL","mode":"real"}
```

The returned server-generated `id` is the tenant-local Trackium device UUID. The AOVX identifier is the 12 decimal digits decoded from the protocol's six-byte BCD device identifier; do not send the IMEI in another format or include punctuation.

## Create a binding

Requires the tenant's `admin` scope:

```http
POST /v1/aovx/devices
Authorization: Bearer <tenant-admin-key>
Content-Type: application/json

{"device_id":"<tenant-local-device-uuid>","device_id_bcd":"944063243931"}
```

The API only accepts an enabled `mode=real`, `identity_kind=physical` device in the authenticated tenant. The BCD identifier must be exactly 12 decimal digits. A BCD identifier can have only one active binding globally; a physical Trackium device can have only one active AOVX binding.

The response has `trust: "unverified"`. This means an owner/admin has associated an identifier with a tenant record; it does **not** prove that a packet came from the genuine tracker. The BCD identifier is not a secret or cryptographic credential.

## List and revoke

- `GET /v1/aovx/devices` requires `read` and returns only the authenticated tenant's bindings, including revoked history.
- `DELETE /v1/aovx/devices/<12-decimal-digit-id>` requires `admin` and revokes that tenant's active binding. Revocation is retained as history; it does not delete raw packet observations.

A revoked identifier may later be explicitly rebound. A duplicate active identifier, foreign-tenant device, synthetic device, disabled device, malformed identifier, or non-admin mutation is rejected.

## Persistence and next stage

Migration `006_aovx_device_enrollment.sql` is additive. It does not rewrite prior migrations or existing device records. Composite foreign keys preserve tenant ownership; partial unique indexes prevent concurrent active cross-tenant claims.

The AOVX adapter consults this binding before creating a `telemetry_events` row. It only processes structurally valid 0x0200 messages whose observed XOR-candidate checksum matches, and it records that checksum algorithm as unconfirmed. Every raw packet remains in `gateway_packets`; exact repeated frames link to one logical telemetry event through `telemetry_aovx_packet_events`. Unbound, revoked, disabled, malformed and checksum-mismatched packets do not create tenant telemetry. Event time uses Gateway receive time; the original six-byte device BCD time is retained without UTC conversion. GPS and sensor measurements remain null/un-normalized until their scales and conversions are verified. This ingestion stage does not invoke shipment state handling or create cargo events/proofs.
