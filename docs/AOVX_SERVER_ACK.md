# AOVX TCP delivery acknowledgements

## Evidence and conformance

The review checked the original AOVX Protocol V3.0 PDF, Platform Protocol V3.0 workbook, AT Commands V3.1 PDF and V2.0.9 v11 release notes. Protocol PDF §2.3 defines framing and the plain header. Section 3.4 Table 29 defines the five-byte reply body. Section 3.7 defines transparent sensor reports. The workbook references below refer to the original sheets.

| Source | Requirement | Gateway status |
|---|---|---|
| Introduction A19:E24 | Start/end 7E. Escape 7E and 7D after checksum generation. Decode escapes before validating inbound frames. | Implemented. Stream framing handles split and coalesced TCP input. Preserve checksum-mismatched frames when the envelope can be decoded, withhold ACK. |
| Introduction A19:E24 and existing manufacturer golden frame | Checksum covers header and body, before escaping. | Implemented as XOR, validated against the known-good manufacturer wire fixture. Several illustrative workbook rows have inconsistent bytes. |
| 0x0200 and 0x0900 rows 5–8, 11 and 22–26 / 29–33 | Two-byte message ID, two-byte properties, six-byte BCD identity, two-byte sequence. Properties bits 9–0 give body length. Upper bits reserve encryption/sub-package fields and default to zero. | Implemented for the plain header. ACK validates decimal BCD, zero upper bits and exact frame length. Encrypted and segmented variants are outside this profile. BCD is routing metadata with no hardware authentication. |
| Introduction A6:D16 and 0x8001 B2:U22 | Respond to 0x0200 and 0x0900 with 0x8001. Reply carries its own server sequence, source sequence, source message ID and result. | Implemented behind default-off `AOVX_SERVER_ACK_ENABLED`. Response uses the receiving socket and echoes the device identity and correlation fields. |
| 0x0200 B5:BL8 and status rows 11–19 | Basic information, alarm/status, coordinate and time fields, extensions. | Implemented for the existing v2 GNSS layout, with partial extension support. GNSS interpretation, trust, event semantics and custody checks are unchanged. |
| 0x0900 B5:AV8 and rows 9, 13–20, 28–37 | Additional information and transparent sensor data. | Partial. Require the 25-byte base prefix, validate envelope and archive the remainder as opaque. Send the transport ACK after storage. Sensor subtype and extension decoding remain outside this change. |
| Introduction A6:D16 and individual message sheets | Configuration and registration-related messages. | Existing inbound parsing and explicit operator configuration paths remain separate. This change adds no automatic registration reply, configuration command or ACK for another message ID. |
| 0x8001 S12:W17 | Result 0 Success, 1 Fail, 2 Wrong message, 3 Not support, 4 Alarm confirmed. | Result 0 implemented for durable delivery. Vendor confirmation required for device retry or flash behavior with the other results. No automatic negative ACK or alarm confirmation. |

### Wire examples and discrepancies

| Source sample | Length (declared / displayed) | XOR (printed / calculated) | Regression policy |
|---|---:|---|---|
| Workbook 0x0200 row 8 | 76 / 225 | 29 / 46 | Use only the fixed prefix with regenerated length and XOR. Test the unmodified 28-byte PDF §2.3.1 frame separately. |
| Workbook 0x0900 row 8 | 15 / 32 | 3F / 25 | Use the displayed body with regenerated length and XOR. Its subtype 41 is outside the PDF's described 53/54 family. The unmodified PDF §3.7 sensor frame is a separate test. |
| Workbook 0x8001 row 8 | 5 / 5 | B9 / BC | Preserve the illustrated fields and compute XOR. The unmodified PDF §3.4 Table 29 ACK is also checked byte-for-byte. |

Two Bluetooth examples in PDF §3.7 declare 122 and 81 body bytes while displaying 107 and 66. Strict framing rejects both. The same section contains a length- and XOR-valid sensor example. AT Commands V3.1 §5.5 describes sensor reporting. The v11 release notes mention sleep behavior around server responses and blind-spot reporting. Neither document specifies ACK retry timing or the effect of each negative result on flash retention. Private incident frames stay outside this repository and CI.

## ACK and storage semantics

| Input | Journal and response |
|---|---|
| Valid plain 0x0200 with at least its 28-byte basic report, or valid plain 0x0900 with at least its 25-byte base prefix | Wait for PostgreSQL to return success from COMMIT on the raw journal transaction. An extension normalization error does not suppress transport ACK. Send one success ACK on the same socket. The 0x0900 sensor body stays raw. |
| Repeated eligible frame, including on reconnect | Persist the arrival and ACK it again. Existing 0x0200 event deduplication still determines logical telemetry and packet links. No catch-up ACK is sent for historical journal entries. |
| GNSS Unfix, delayed or buffered packet, or rejected tenant/custody decision | ACK the eligible persisted report. Independently apply the existing ingestion, quarantine and replay rules. The transport ACK does not create or validate a position, shipment event, proof, or tenant permission. |
| Invalid XOR, identity, reserved flags or supported body structure, or checksum-valid unsupported message | No automatic response. Preserve the raw frame if the existing framing path can journal it. Avoid a negative result whose retry behavior is unknown. |
| Incomplete or structurally invalid frame | No ACK. Existing frame sizing and connection limits apply. |
| PostgreSQL write rejected | No ACK. Close that connection, preserve already committed rows and allow device retry. No subsequent queued write on the failed connection. |
| Socket closes during persistence | The raw write may finish. The ACK is not routed to a new connection. A later eligible retry is journaled and acknowledged on its own session. A clean TCP half-close allows queued ACKs to drain. |

The journal commit remains the delivery boundary. Normalization can still reject a report or defer processing. The ACK path uses an explicit transaction with `SET LOCAL synchronous_commit = 'on'` before the insert and waits for `COMMIT` to return. This overrides an asynchronous session default for that transaction. Confirm `SHOW fsync` returns `on`, ensure storage honors flushes, and account for configured synchronous replicas in the latency budget. Per-process counters count complete frame candidates, successful ACK socket writes and failures, recent duplicate raw digests, opaque unsupported message types, ingestion rejections in the immediate path, and socket disconnects. The duplicate window covers the latest 4,096 distinct persisted digests in this process. A socket write callback measures local handoff and does not establish receipt or flash removal on the device. Logs emit aggregate counts once a minute and at shutdown without device, coordinate, or payload dimensions.

## Controlled rollout and rollback

1. Review the PR, confirm exact firmware and wire behavior, and obtain explicit deployment authorization. Rehearse against disposable PostgreSQL and an approved field unit or vendor test bench. Verify the existing TCP proxy, ingress, journal commit settings, and rollback image. Measure the time from complete frame receipt through durable commit and ACK under representative bursts, against the timeout confirmed by AOVX or measured on the approved firmware. Keep activation and configuration policies as currently approved.
2. Use the reviewed image with `AOVX_SERVER_ACK_ENABLED=false` first. Verify API readiness, unchanged TCP framing and raw retention. Enabling ACK changes the whole AOVX listener. Confirm the connected population is approved for the pilot.
3. After operator authorization, set `AOVX_SERVER_ACK_ENABLED=true` with `TCP_PROTOCOL=aovx` and TCP enabled. Verify readiness mode `aovx-frame-ack`. Compare journal commits and ACK frames on the same connection, then measure retries, reconnects, and corpus size. Inspect custody rejections independently. No tracker configuration commands are needed.
4. Stop or revert if successful writes and ACKs diverge, the report queue grows, or ACKed frames disappear from the journal. Roll back by setting the flag false first, then confirm `aovx-frame-capture-only`. Revert the image if necessary. Keep journal rows, event links, binding and custody history. ACKs already accepted by devices cannot be undone. A flag-off rollback may restore the previous flash retry behavior.

## GNSS and open vendor questions

According to the supplied engineering update, AOVX's decoder reproduces the reported coordinates and faulty dates. AOVX associates similar issues with Galileo and is investigating with Quectel. The supplied update does not identify V2.0.9 v11 as a GNSS anomaly fix. Missing transport ACKs can contribute to retained or repeated reports; they do not explain coordinate or timestamp contents.

For future geographic plausibility, evaluate a separate advisory signal beside the immutable observation. Compare receipt and measurement time, consecutive eligible fixes, implied movement and independently documented coarse network-region hints. Keep the source and uncertainty of each signal. Validate against known physical observations before proposing thresholds. Do not infer or replace coordinates from a route or a cell region. This PR leaves the parser, history and map policies intact.

Ask AOVX for corrected complete 0x0200, 0x0900 and 0x8001 wire vectors, expected ACK timeout and retry behavior, handling of each negative result, and whether another body/header variant requires acknowledgements. Ask AOVX and Quectel for a reproducible explanation and a firmware-specific fix or interpretation of the anomalous Galileo coordinates and BCD dates.
