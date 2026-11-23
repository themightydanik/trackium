# AOVX 0x0200 golden frame and position safety

Primary evidence is Dale's AOVX reply, the full wire frame pasted with the reply, the ConfigTool screenshot supplied in the task, and F9 in the [protocol extraction](AOVX_GAL_Series_Platform_Protocol_V3.0_exact_dump.md). The screenshot identifies an AL300-LA report. It displays 31.867795 N, 117.147473 E, Fix Yes, speed 0.0, time 26/11/23 01:11:30, mileage NULL, CSQ 31 and five satellites. The [golden fixture](../services/gateway/test/fixtures/aovx-manufacturer-0200.hex) contains the exact 233-byte wire frame, including delimiters and checksum. The SHA-256 of the decoded fixture bytes is `9a3c97d03b89ff387b126206f13decd0e775ba8e5b9b98151a04ab1a03181f3e`. The ConfigTool screenshot is in the task discussion.

| Area | Before | Manufacturer evidence | Change |
| --- | --- | --- | --- |
| TCP framing and checksum | 0x7E framing, AOVX escaping, length check and XOR passed to normalization | The 218-byte body passes with XOR 0x9A | Preserve TCP, raw journal, checksum policy and ACK behavior. Lock the exact frame in a test against the production decoder. |
| Coordinates | Unsigned big-endian integers kept raw; GPS null | Sample decodes as 31,867,795 and 117,147,473 millionths of a degree; F9 bits 2/3 select south/west | Signed decimal degrees with inclusive bounds and raw fields preserved. |
| Fix | Bit 1 recorded | F9 and manufacturer confirm bit 1; no fix may report (0,0) | No GPS without fix. Suppress (0,0) even with fix as a conservative missing-position rule. |
| Time | Raw BCD and receipt time only | Six-byte BCD represents UTC | Validate calendar and clock fields; store UTC measurement separately (two-digit years interpreted as 2000–2099). Invalid or future measurements have no GPS. Canonical event ordering and history cursor remain receipt-based. |
| Buffering | Bit 31 recorded, all physical locations suppressed | Bit 31 distinguishes buffered and real-time reports | Preserve valid buffered fixes in history. Last-known candidates require real-time status and receipt 0–5 minutes after measurement. This window is a Gateway policy. Select by measurement time; conflicting newest fixes in one second suppress the result. |
| Optional fields | Fixed prefix always included a six-byte mileage TLV | Golden report omits it; CSQ and satellites appear directly after BCD | Recognize the exact CSQ/satellite header pair at offset 28 and preserve the existing layout otherwise. Keep raw ancillary values only. |
| Shipment and proof | Unverified observations appended; synthetic samples alone can advance shipment state | Coordinate encoding and device-reported time do not authenticate the sender | Preserve the ledger and transactional outbox. Physical fixes do not trigger checkpoint, geofence, route or condition transitions or an Integritas proof request. |

The Lite map labels a current candidate as the last known unverified fix. History plots individual positions, including buffered ones, without interpolating movement. A valid buffered or older report cannot replace the last known fix. Device clocks may still reset or drift, and the golden frame alone does not establish GL110-GL hardware acceptance, clock stability or the meaning of ancillary sensor fields.

## Rollout and rollback

- No migration. New events use parser version `aovx-gal-v2`, with the existing `aovx-gal-v1` source and event identity. Existing raw rows, canonical hashes, proof evidence and exact replay links are preserved. Older v1 history retains its original GPS and time semantics.
- Before rollout, run Gateway unit and disposable PostgreSQL suites, the backup/restore drill and Chromium workspace regression. On authorized staging, inspect eligible, buffered and rejected fixes alongside raw lineage and separate receive and measurement timestamps.
- Roll back to the previous application revision if needed. It hides physical positions while retaining committed events, packet links and proofs. A rollback does not reparse or delete v2 rows.
