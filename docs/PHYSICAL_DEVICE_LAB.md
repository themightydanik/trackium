# Physical Device Lab P1a

Scope for [Issue #79](https://github.com/themightydanik/trackium/issues/79) and [PR #80](https://github.com/themightydanik/trackium/pull/80). Local acceptance uses generated AOVX frames through the Gateway. See the [GL110-GL field checklist](AOVX_GL110_FIELD_ACCEPTANCE.md) for hardware steps.

## Audit of the draft

| Finding | Resolution |
| --- | --- |
| Stopping invalidated a render token but left fetch and its timeout active. Rapid restart could overlap requests. | One diagnostic request per open device panel. Cancel in-flight reads on stop, close, panel replacement, session change, navigation and page exit. Schedule the next poll after the previous request settles. |
| Background tabs continued to poll, including after recoverable errors. A packet receipt could be mistaken for TCP connectivity. | Hidden tabs pause monitoring and require an explicit restart. Retry transient errors at 30 seconds rather than 10. Permanent HTTP client errors stop the loop. No direct device socket state is asserted. A failed read clears the diagnostic and last-known marker. |
| Export used whichever 20-row history page happened to be open, mixed with a separately fetched snapshot. It included a device label, exact coordinates and the entire diagnostic object. An old export error could overwrite current UI status. | The user selects a receipt interval, reads a bounded server projection, and exports the same bounds with renewed authorization. The file has an explicit allowlist. Precise coordinates require opt-in. Errors from obsolete reads cannot change the current panel or download a file. |
| Source-pattern tests did not exercise authorization, browser request cancellation, exports or map behavior. | PostgreSQL/API and Chromium exercise the real workflows. |

## API and use

- Lite **Devices → Device details → Physical Device Lab**. Use **Read now** for a snapshot or **Start monitoring** for 10-second refresh cycles after a successful response. The field statuses distinguish packet receipt, normalization, reported device time, GNSS fix, buffering, clock lag and location eligibility.
- Existing `GET /v1/devices/{id}/diagnostics` adds `position.last_known`. Its coordinates, measurement UTC and receipt UTC are selected within the same statement as the conflict decision. The object is null when there is no eligible position. The stale flag indicates when measurement is older than 15 minutes.
- `GET /v1/devices/{id}/lab-history?from=…&to=…&limit=200` requires `read` and an authorized physical registry record. UTC ISO-8601 with milliseconds is required. Bounds are inclusive in Gateway receipt time and span at most seven days. The response is no-store, holds at most 200 observations and explicitly flags truncation. If truncated, narrow the selection to export. The read uses the existing tenant/device history index and bounded packet-link lookups. History survives revocation under the same tenant's historical access.
- Select a UTC period and **Load period**. The interactive Leaflet map uses bundled Natural Earth geographic vectors; the map uses no external network service. It shows discrete authorized observations, including valid buffered history, and a separate last-known marker from the Gateway. It draws no inferred path between observations. The receipt timeline preserves unknown and malformed observations. It labels raw CSQ and satellite codes only when their stored TLV format matches, and assigns no sensor scales.
- **Export period JSON** rereads the selected bounds with authorization. The file includes receipt/measured time, raw signal/satellite codes when present, parser revision, statuses and linked packet references. Coordinates are omitted unless selected. The export contains no device label, BCD, account or tenant ID, IP address, raw frame or credentials. Exact time and packet references can still be sensitive. Share with authorized recipients only.

## Rollout and next increment

No migration, write-path changes, external map dependency or Android changes. Reverting the application removes this panel and the additive API projection while leaving historical evidence in PostgreSQL. Each active panel performs one diagnostic read per cycle. Measure query latency at representative tenant volumes before wider rollout. Snapshot polling does not prove direct TCP connectivity, and reported positions remain unverified.

Next, implement bounded pagination and a measured-time view alongside receipt order. Evaluate a licensed detailed geographic basemap with privacy-preserving delivery and documented attribution. Add cadence/duplicate projections only from proven Gateway metadata. Hardware acceptance remains required for physical movement, connectivity gaps/backlog, clock stability and model-specific sensors. Stage future Android Core consumption using the same API contract. Device settings and commands remain separate phases with their own security and hardware gates.
