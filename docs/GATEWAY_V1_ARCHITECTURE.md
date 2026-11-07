# Trackium Gateway v1 — Architecture Decision Record
Status: proposed for commercial pilot; implementation and hardware protocol verification pending.

## Product and deployment
Trackium has two operating modes using the **same** Gateway Core:
- **Free / self-hosted**: customer deploys and operates Gateway on a Linux VPS or suitable always-on host, then pairs it with the MiniDapp. Railway is a candidate for testing; Oracle Cloud Always Free is a fallback. Neither is guaranteed free or suitable for production until TCP ingress, storage, quotas and uptime are verified.
- **Managed / subscription**: Trackium operates the Gateway, provisions an isolated tenant, manages monitoring, backups, upgrades and support. The MiniDapp fetches a connection profile after authenticated pairing. A tenant is a logical isolation boundary, not necessarily a dedicated VM.

Device purchase, SIM connectivity and third-party infrastructure charges are separate from free software use. Both modes support identical evidence creation, export and independent verification.

## Trust boundaries and data flow
AOVX GL110-GL --cellular TCP/MQTT (firmware dependent)--> Gateway ingress --> durable raw packet journal --> validated device event --> per-tenant event queue --> proof engine --> Integritas adapter or direct Minima adapter --> confirmed on-chain commitment.

The Android app and Minima Core MiniDapp are clients, not mandatory 24/7 TCP receivers. A user-controlled Minima Core node may run the proof engine. Managed publishing may use a Trackium-operated node, but the resulting proofs must be independently verifiable and exportable. Gateway must never hold a customer's Minima private keys.

The Gateway does not make sensor readings inherently truthful: blockchain anchoring proves commitment/integrity relative to a recorded payload, not physical sensor authenticity. Unauthenticated or unsigned device messages remain a trust limitation.

## Components
1. **Protocol adapter**: receives and parses actual GL110-GL firmware packets; captures original bytes, source metadata and receive time. No assumption that all firmware emits JSON or exposes all sensor readings.
2. **Gateway Core**: authenticates devices where supported; deduplicates/reorders cautiously; isolates tenants; persists immutable raw records and normalized events; retries delivery; exposes authenticated HTTPS API.
3. **Proof Engine**: canonicalizes versioned events; calculates SHA3-256 commitments; batches where appropriate; journals publication attempts and confirmations; exports portable evidence bundles.
4. **Publication adapters**: Integritas API and direct Minima Core MDS, with explicit transaction confirmation. Never mistake accepted submission for final blockchain confirmation.
5. **Control plane**: tenant provisioning, pairing, subscription entitlement, device binding, gateway health, audit log. Central control plane must not be the only repository of customer telemetry or evidence.
6. **MiniDapp and Android**: configure, monitor, visualize, export and verify. MDS service.js must follow Minima runtime compatibility constraints.

## Pairing contract
A versioned Gateway Connection Profile contains gateway_id, mode, HTTPS API endpoint, tenant/device association, supported protocol versions and pairing status. A short-lived one-use pairing code exchanges for scoped credentials. Never publish credentials, secrets or raw location history on-chain. Distinguish device TCP endpoint from MiniDapp HTTPS endpoint. Support migration Managed <-> Self-Hosted without losing existing evidence.

## Commercial pilot acceptance gates
- Actual GL110-GL firmware: server configuration, network protocol, event types and sensor fields verified using captured packets.
- Continuous cellular ingress with realistic disconnect/reconnect, duplicate and out-of-order packets.
- Durable write before acknowledgement where protocol supports acknowledgement; restart recovery, retry and backpressure tests.
- Tenant isolation, credential rotation/revocation, encrypted transport where supported, secure operator access.
- Health dashboards, alarms, retention policy, backup and tested restore, deployment/rollback instructions.
- On-chain inclusion confirmation, independent evidence verification and full export.
- Device-to-tenant binding, event audit trail and explicit sensor trust limitations.
- End-to-end pilot rehearsal with actual hardware before deployment with a logistics company.

## Delivery plan (small PRs)
1. Architecture, protocol contracts and acceptance criteria (this ADR).
2. Gateway Core skeleton with configuration, health checks, durable storage schema, and fixture-based protocol adapter.
3. Real AOVX adapter from firmware-specific captured packets; device provisioning.
4. Event queue, canonicalization and evidence bundle; publication adapters and confirmation journal.
5. MiniDapp pairing, health and evidence UI; Android client integration.
6. Managed tenant provisioning, self-host installer, operations hardening and commercial pilot.

Do not delete or rewrite the legacy MiniDapp until the replacement passes an agreed migration checkpoint. Avoid expensive broad test runs in early PRs; require focused tests for changed code.

## Future: Trackium Live
Potential future product/mode for Android phones, wearables and everyday IoT. Keep device events versioned and adapters pluggable; do not implement Live-specific ingestion or features in Gateway v1.

## Open validation items
- GL110-GL firmware version, exact packet format and supported configuration commands.
- TCP versus MQTT ingress choice and transport authentication available on the device.
- Railway/Oracle deployment feasibility and costs for persistent ingress and storage.
- Integritas proof format and independent Minima verification procedure.
- Pilot availability, recovery, retention and support requirements to agree with first customer.
