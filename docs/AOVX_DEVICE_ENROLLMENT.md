# AOVX device enrollment (manual owner binding)

This stage adds an explicit tenant-owned mapping between an AOVX protocol identifier and an existing physical device record. It does **not** authenticate the tracker, decode more fields, or ingest packets into normalized telemetry.

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

This table is an enrollment registry only. The TCP ingress path does not yet consult it to create `telemetry_events`; unbound or spoofed packet observations remain in the raw journal and cannot become normalized telemetry or cargo events through this change. The next stage will use this binding as one required lookup, while preserving `unverified` provenance until a device authentication mechanism is actually established.
