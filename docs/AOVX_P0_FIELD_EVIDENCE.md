# AOVX GL110-GL field incident

The owner confirmed TCP delivery through `autorack.proxy.rlwy.net:19001` to Gateway port `9000` on 26 November 2026. The field report records a position inconsistent with the device's independently reported location. The SIM was removed intentionally after the test. Begin with the retained evidence and keep the current TCP proxy and tracker settings.

## Evidence needed

The incident frames and operator authorization are required to establish the coordinate cause. A GNSS fix flag, a plausible timestamp, a passing checksum and an eligible projection do not independently establish that the reported position is physically correct. A position selected from the last decoded observation can also appear beside a failure for a different, newer packet.

On an approved private workstation, use the existing operator-only `GET /internal/aovx/packets` endpoint with the operator token supplied through the approved credential store, or a read-only PostgreSQL role. For exact packet retrieval and comparisons, use bound parameters in a read-only transaction:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT id, received_at, sha256, encode(raw_payload,'hex') AS frame_hex,
       aovx_message_id, aovx_sequence_number, aovx_checksum_status,
       aovx_parse_status, aovx_parse_error, aovx_processing_state, aovx_processing_error
  FROM gateway_packets
 WHERE aovx_device_id_bcd = :device_bcd
   AND received_at >= :utc_start AND received_at < :utc_end
 ORDER BY received_at, id;
ROLLBACK;
```

Use the field-report device BCD and UTC window for 26 November. Include the linked position packet, the latest failing packet if different, and adjacent frames with the same binding. On older deployed Gateways the operator API may omit processing state and error fields. The SQL query includes both. Check that each selected ID matches the incident report and that recomputing SHA-256 from the full bytes matches the journal before comparing decoder output. Keep raw frames, device identifiers, network addresses and precise positions out of public artifacts.

Decode copies against the exact Gateway commit and compare delimiting and escaping, decoded body length, checksum, message type, sequence, status bits, UTC measurement, and raw coordinate fields with the GL110-GL firmware documentation and vendor tool. The existing AL300-LA golden frame remains a regression check for its documented layout. It cannot establish that the incident frames use that layout. If the original bytes and vendor tool agree on an incorrect fix, investigate the hardware or firmware source of the fix. If they disagree with Gateway output, reproduce the differing field or projection before changing it. Do not guess coordinate signs, byte order, scaling or offsets.

## Diagnostic change and rollout

The tenant-scoped Device Lab now identifies the last received packet separately from the packet linked to the last decoded observation. It classifies recorded checksum failures, message decode errors, ingestion rejection and opaque unsupported messages. Diagnostic responses expose message type, packet reference and bounded categories. Detailed errors and raw frames remain behind the existing operator authorization. Pending packets retain their existing retry semantics.

The diagnostic change needs no migration or history rewrite. Migration 019 from the merged Core onboarding work is additive. Verify a controlled backup and recovery before enabling `DEVICE_ACTIVATION_ENABLED` or `CORE_DEVICE_ACCESS_ENABLED` on an approved deployment. Keep those flags off until the reviewed rollout gate is satisfied. Verify both readiness endpoints, the current TCP proxy and old bindings. Set `CORE_ANDROID_CERT_SHA256` from the actual pilot signature before checking Android domain verification. Test an authorized grant and its revocation before enabling any wider access.

To roll back, disable the affected flags and revert the application image after checking schema compatibility. Keep packet data, ownership tables, and migration history. Pause custody operations if an older binary cannot maintain the current registry. Reconcile claims, grants and revocations before restoring service from any older snapshot. Reinterpreting old coordinates is a separate, potentially irreversible operation requiring explicit approval and an audited correction plan. Preserve the original evidence and its lineage.

## Core-first linking design for separate review

Use a short-lived website challenge bound to the authenticated account. Core must sign confirmation with the existing active owner installation key for the specific registry device. The website user explicitly confirms the Core fingerprint before acceptance. Add account access to that same device through its existing Core-first workspace, without moving telemetry, creating a second registry claim or resetting previously issued grants. Keep a revocable, audited relationship between the Core owner and the website account. Test concurrent linking and revocation, role loss, challenge expiry and transfer before release. Do not use a serial, original activation card or an unbound bearer code as proof of current ownership.

## Repeat the physical check

After a reviewed correction is deployed, reinsert the SIM and leave the tracker outdoors at a known stationary point. Record a short UTC window and compare the next raw fix and vendor decode with the Gateway receipt time, Device Lab, Fleet Map and authorized Core map. Make sure packet and observation references are distinguishable. Repeat with movement, then with a temporary loss of mobile data to distinguish delayed or buffered samples from the current fix. Keep precise location evidence in the private operator record.
