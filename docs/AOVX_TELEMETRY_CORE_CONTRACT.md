# AOVX → Gateway Telemetry Core contract

**Status:** Gateway contract for unverified AOVX observations, including shipment integration and the remaining hardware acceptance gates.

This document reconciles the AOVX GL110-GL observations with the current Gateway data model and the separate Trackium Core Android client. It documents the Gateway behavior and the evidence still required for real-device acceptance.

## 1. Terminology and ownership

There are two different components called “Core” in the project:

- **Gateway Telemetry Core** is the backend domain layer in `themightydanik/trackium`: tenant-scoped device registry, normalized telemetry, shipment state, immutable cargo events, outbox and Proof Engine. It runs with the Gateway/PostgreSQL service.
- **Trackium Core Android** is the separate `themightydanik/trackium-core-android` application. It embeds the pinned Minima node host and provides a native client for the Gateway. It is not a second backend, does not own the Gateway database and must not duplicate server-side telemetry or publication policy.

The intended data path is therefore:

```text
AOVX GL110-GL
  → Gateway TCP ingress
  → AOVX frame validation + protocol adapter
  → durable raw packet journal
  → tenant/device binding + normalized telemetry
  → shipment state and immutable cargo events
  → transactional outbox
  → policy-gated Proof Engine
  → approved Minima publication adapter
  → confirmed commitment

Trackium Core Android / MiniDapp
  → authenticated tenant-scoped Gateway API
  → reads and explicitly authorized client workflows
  → optional owner-controlled Minima publication path
```

The Android client consumes canonical Gateway event/proof data; it does not independently reinterpret raw tracker frames or create a competing canonical event history. The Android proof protocol explicitly states that Gateway creates canonical events and the client preserves their exact UTF-8 bytes.

## 2. Verified AOVX protocol facts and limits

The repository contains an exact text extraction of the manufacturer workbook `AOVX_GAL_Series_Platform_Protocol_V3.0_2025.03.05` in [AOVX_GAL_Series_Platform_Protocol_V3.0_exact_dump.md](AOVX_GAL_Series_Platform_Protocol_V3.0_exact_dump.md). Treat that workbook as the primary protocol reference for the fields it actually specifies. It is a GAL-series platform protocol document; it does not, by itself, prove the exact firmware/provisioning behavior of every GL110-GL V1.2 unit.

For message `0x0200`, the workbook documents:

- Message header fields: message ID (2 bytes), body properties (2), device ID (6), sequence number (2).
- Device ID is the last 12 IMEI digits encoded as BCD. This is an identifier, not cryptographic device authentication.
- The body begins with alarm (4), status (4), latitude (4), longitude (4), altitude (2), speed (2), direction (2), and a six-byte BCD time field.
- Following fields are variable/report-mask controlled: mileage, cellular signal, GNSS satellite count, base-station records, firmware, Bluetooth, Wi-Fi, sensor, battery, device information and assistant information. The workbook describes their layouts and some units, but not every conversion needed for a normalized product value.
- Status bit 31 distinguishes real-time (0) from buffered (1); bits 29–27 encode network mode; bit 16 in the alarm word is motion alarm; status bit 4 identifies sampled data; status bits 3 and 2 encode longitude/latitude hemisphere; status bit 1 indicates GNSS fix. Reserved bits must remain uninterpreted.
- The workbook describes the AOVX frame delimiters and escaping: `0x7E` is the start/end flag, and occurrences of `0x7E` and `0x7D` inside the frame are escaped as `0x7D 0x02` and `0x7D 0x01`, respectively. It specifies the receive order as unescape, verify checksum, then parse.
- Sensor extension data includes a data type and field mask. Data type 0 is periodic sampling; several trigger types are enumerated. The documented sensor record widths include Light (2), Temperature (2), Humidity (2), Accelerometer (6), and optional limit/barometer/reserved fields. Barometer is documented in hPa. Battery voltage is documented in mV; optional charge status and percentage are enumerated.

The current parser intentionally retains raw bytes for fields where scale, signedness, byte order or conversion is not established. In particular, do not invent coordinate scale, altitude/speed units, mileage scale, cellular RSSI scale, temperature/humidity scale or accelerometer units. Do not turn an unset GNSS-fix bit or zero raw coordinates into a location. Preserve the six-byte device timestamp as BCD until the device timezone/UTC rule is established; the workbook does not establish a timezone in the extracted message definition.

Observed TLV tag assignments and exact envelope patterns in the capture are implementation evidence, not a substitute for the workbook's model/configuration caveats. Keep unknown, malformed and unsupported extensions opaque and retain their original bytes.

### Current capture evidence

The captured device `944063243931` delivered 50 structurally valid `0x0200` packets in the analyzed sample. The Gateway persisted and parsed them. The sample contained four receive-time groups (the 15-minute boundary is an analysis heuristic), with within-group median arrival intervals around 34 seconds. Exact frame repetitions occurred across groups. One sample timestamp/sequence appeared with two different status words while the rest of the decoded measurement body matched.

These observations prove successful TCP frame ingestion, raw persistence and current parser operation for this capture. They do **not** prove device authentication, GPS fix, correct physical sensor units, the cause of repeated delivery, or a protocol-defined buffering cycle. The status variant must not be discarded merely because the timestamp and sequence match.

## 3. Current implementation boundary

The current backend has two distinct persistence paths:

1. **Raw AOVX journal.** With `TCP_PROTOCOL=aovx`, the TCP receiver extracts framed packets, runs the current AOVX envelope/parser path and persists the original payload plus parsed metadata in `gateway_packets`. `gateway_aovx_device_observations` is an operational observation index keyed by the BCD device identifier. It is not a tenant-owned device registry and is not an authenticated device state model. The receiver currently does not implement a verified AOVX registration/authentication/ACK exchange.
2. **Normalized telemetry and shipment pipeline.** The `telemetry_events` schema supports fixture/simulator events and unverified AOVX events from bound physical devices. The `ingestSynthetic` transaction creates telemetry events, calls the shared shipment telemetry handler, and can append immutable `cargo_events` plus `cargo_outbox` rows. The proof engine consumes approved cargo events; it must not receive every raw packet.

AOVX packet processing is restart-recoverable: raw persistence happens first, pending packets are replayed by a bounded worker, and event creation plus packet-to-event linking is transactional. Unbound/revoked/disabled packets remain raw only. Device time is retained as raw BCD, while event ordering uses Gateway receive time. GPS and sensor measurements remain unnormalized. A new logical AOVX event and its packet link commit with the existing shipment handler’s ledger and outbox writes when the device has an active shipment. Exact repeats add only packet links. Missing measurements do not advance checkpoints or change condition state. Outbox rows are subject to the existing proof approval policy.

Relevant implementation references:

- [Gateway runtime wiring](../services/gateway/src/cargo/runtime.js)
- [AOVX message parser](../services/gateway/src/aovx/messages.js)
- [Raw journal](../services/gateway/src/journal.js)
- [Synthetic ingestion transaction](../services/gateway/src/cargo/ingestion.js)
- [Shipment event chain and outbox](../services/gateway/src/cargo/shipments.js)
- [Telemetry Core v1](TELEMETRY_CORE_V1.md)
- [Shipment/simulation pipeline](GATEWAY_SHIPMENTS_SIMULATION.md)
- [Gateway architecture ADR](GATEWAY_V1_ARCHITECTURE.md)
- [Trackium Core Android architecture](https://github.com/themightydanik/trackium-core-android/blob/main/docs/TRACKIUM_CORE_ARCHITECTURE.md)
- [Android Gateway client](https://github.com/themightydanik/trackium-core-android/blob/main/integrated/trackium/src/main/java/tech/trackium/cargo/NativeGateway.kt)

## 4. Trust and identity contract

Keep these identities separate:

| Identity | Meaning | Must not be confused with |
| --- | --- | --- |
| AOVX BCD device ID | Protocol-reported last 12 IMEI digits | Authentication, ownership or tenant membership |
| Gateway `telemetry_devices.id` | Server-generated tenant-local UUID | Manufacturer identity |
| Hardware credential / proof | Authentication only if the exact firmware and provisioning process support it and it is verified | IMEI, TCP source IP, SIM presence or a parsed packet |
| Android native session | Owner-approved, tenant-scoped client session with request PoP | Tracker authentication |
| Minima publisher identity | Explicitly authorized proof publisher | Device identity or shipment owner by implication |

A future AOVX adapter must resolve the protocol identifier through an explicit server-side enrollment/binding record. It must not create a tenant, assign ownership or reassign a device based solely on a packet's BCD identifier. The current evidence has not established a device-held secret, certificate, challenge-response capability, or secure manufacturing identity for this exact unit. Until one is verified, physical packets may be recorded as **unverified physical-source observations**, not authenticated-device telemetry.

The words `physical`, `real`, `registered` and `online` must not be used as synonyms for authenticated, owner-approved or currently reachable.

## 5. Normalization and time contract

The adapter must preserve the original raw packet and parsed raw fields alongside any normalized values. Normalization is allowed only where the protocol definition and tests establish the conversion.

Minimum event provenance should distinguish:

- `source`: protocol/adapter and version (for example, an AOVX GL-series adapter version), not fixture/simulator source.
- `trust`: `synthetic`, `unverified` or a future explicitly justified authenticated level.
- `raw_packet_id`: link to the immutable raw journal row.
- `device_identifier`: the protocol identifier, separately bound to a tenant-local device UUID.
- `received_at`: Gateway receive time.
- `device_time_raw`: original six BCD timestamp bytes/digits.
- `event_time_basis`: whether the event time is based on verified device time or Gateway receive time.
- `parser_version` and protocol/model profile.
- `raw_status`, delivery mode (real-time/buffered), GNSS-fix flag, sampled flag, alarm bits and raw extension values.
- Normalized measurements only when their units and transformations are verified; otherwise keep raw values and mark them unnormalized.

Do not apply a UTC assumption to the device BCD clock. Until timezone and clock behavior are established, Gateway receive time is the only unambiguous instant for server ordering. If a receive-time fallback is used for the existing non-null `occurred_at` field, it must be explicitly labeled as receive-time-based; it must not be presented as the device's occurrence time. Once the device-time rule is verified, a later additive migration can store the resolved instant without rewriting the original raw timestamp.

For state reduction, preserve both event time and receive time. An older buffered event may be appended to history, but it must not move the current device/shipment state backwards. Do not silently drop out-of-order events.

## 6. Duplicate and replay contract

The capture demonstrates both exact repeated frames and a same-sample/different-status case. It does not identify whether repetition originates in tracker buffering, application retries or an intermediary. TCP retransmission is not a sufficient explanation for repeated application frames already delivered to the Node stream.

The implementation must use separate concepts:

1. **Packet observation:** every received frame is durably recorded with its own receive time and raw bytes. Exact repeats remain observable in the raw journal.
2. **Logical telemetry sample:** an idempotent domain representation may be linked to one or more packet observations, but its identity rules must be versioned and tested against sequence wrap, timestamp ambiguity, status changes and extension changes.
3. **Derived cargo event:** a shipment transition/condition event is created only when domain rules say the new observation changes meaningful shipment state. A packet replay must not create another checkpoint visit, duplicate cargo event or proof job.

Do not deduplicate solely by device timestamp, sequence number, or device ID. Do not discard status variants. The first implementation should preserve variant observations and make duplicate classification explicit; it must not collapse a status-only variant until the domain meaning of every differing status bit is understood. Exact-frame idempotency may prevent duplicate logical effects while retaining each raw observation.

## 7. Database and migration boundary

Do not rewrite applied migrations `001_telemetry.sql` through `005_native_android.sql`. Migration `007_aovx_telemetry_ingestion.sql` adds physical telemetry provenance and packet links. The shipment integration uses those fields and needs no further schema changes.

The telemetry and shipment persistence contract is to:

- represent protocol source, parser version, trust/provenance and physical identity binding without weakening tenant composite foreign keys;
- link real telemetry to `gateway_packets` while keeping fixture/simulator provenance separate;
- enforce tenant/device/source idempotency at the database boundary;
- preserve immutable raw observations and allow one logical sample to reference multiple packet observations if required;
- represent event-time basis and raw device time without fabricating UTC;
- maintain the existing append-only `cargo_events` hash chain and transactional `cargo_outbox`;
- avoid changing existing tenants, keys, sessions, shipments, proofs or previously stored canonical bytes.

The implementation should reuse the existing shipment telemetry domain handler where its semantics fit. It must not create a parallel shipment state machine or move tenant authorization into the Android client.

## 8. Blockchain boundary

Raw packets are not blockchain events. The Gateway must select and canonicalize meaningful domain events, retain their provenance/trust, and apply the existing explicit approval/publication policy. The proof commitment should reference the canonical cargo event (or an explicitly versioned aggregate), not every incoming frame or a mutable device-status row.

A buffered replay, duplicate packet, parser retry or device heartbeat must not automatically produce a new on-chain transaction. Existing owner approval, publisher ownership, checkpoint-before-post, retry/reorg handling and confirmation requirements remain authoritative. Mainnet publication remains disabled unless the operator separately authorizes it.

## 9. Implementation sequence and acceptance gates

### A. Protocol adapter contract and vectors

- Keep manufacturer-documented structure separate from observed firmware-specific TLV patterns.
- Add tests for frame escaping/unescaping, fragmented/coalesced TCP chunks, malformed lengths, checksum mismatch and unsupported message IDs.
- Verify the checksum algorithm independently; an observed XOR match is not sufficient by itself.
- Keep unknown fields opaque and raw values lossless.
- Do not send device ACKs or configuration commands until the exact message response semantics and persistence-before-ACK behavior are verified.

### B. Device enrollment and provenance

- Obtain exact GL110-GL V1.2 firmware, provisioning, network, registration/authentication and recovery documentation.
- Verify whether the device can prove possession of a protected credential. If it cannot, document the weaker provenance level and do not claim authenticated hardware.
- Add explicit BCD identifier ↔ tenant-local device binding, enrollment/transfer/revocation policy and audit trail.
- Test foreign-tenant, unbound identifier, replay, cloned identifier and ownership-transfer cases.

### C. Real telemetry transaction

- Add an additive migration and AOVX adapter that links a raw packet observation to a normalized telemetry event.
- Reuse the existing transaction/event/outbox path where possible; make processing restart-safe and idempotent after a crash between raw persistence and normalization.
- Preserve receive-time order and device-time uncertainty. Prevent older buffered samples from regressing current state.
- Test exact repeats, cross-batch repeats, same timestamp/sequence with status variants, out-of-order delivery and sequence wrap.
- Do not infer sensor units or GPS coordinates until the relevant conversion is documented and verified against a known physical reference.

### D. Real-device acceptance

- Verify tracker provisioning and connection against the exact model/firmware, not only a generic GAL protocol workbook.
- Demonstrate reconnect, buffer replay, duplicate delivery, delayed/out-of-order samples, database restart and bounded backpressure.
- Confirm durable raw persistence before any protocol ACK, if ACK is supported.
- Keep synthetic fixtures, unverified physical observations and authenticated physical telemetry visibly distinct.
- Demonstrate tenant isolation and proof export/independent verification before any pilot claim.

**No production acceptance is implied by unit tests, offline captures, parser success, Railway health checks, or an Android build.** Real hardware, authenticated enrollment, database recovery and any Mainnet publication each require their own explicit acceptance.

## 10. Relationship to the decentralized roadmap

This contract supplies concrete protocol and ingestion evidence for the hardware/telemetry work in [decentralized architecture audit and roadmap PR #11](https://github.com/themightydanik/trackium/pull/11), particularly P0.3 (hardware identity/firmware contract) and the later real-adapter stage. The roadmap audit PR may remain separately reviewable; this document does not silently mark any proposed roadmap gate complete.
