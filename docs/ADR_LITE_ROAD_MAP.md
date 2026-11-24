# ADR · Trackium Lite road basemap and routing boundary

**Status:** proposed in PR A for Issue #88. Based on main `6594f72` with PRs #89 and #91. The Android shell already restricts subresources to the approved HTTPS origin and permits `/app/assets/`. Core premium Issue #11 remains open. Later Core and Android milestones retain their own acceptance.

## Decisions

1. **Leaflet and self-hosted XYZ raster for PR A.** Reuse the polling-stable Leaflet instance and redraw individual overlays with its existing keyed reconciliation. Serve read-only, versioned-in-operations tile sets from the existing Gateway origin. A street layer is opt-in, with street zoom and an overview switch. The geographic overview stays visible below the road layer where imagery is absent. Dark styling affects the road raster only. Geographic attribution and OSM attribution follow the visible layers.
2. **Valhalla candidate for PR B.** Use an independently configured private service and server-owned validation. Test truck costing against cases with known OSM restrictions before making any HGV claim. Routing requests must use a configured origin, never a caller URL. Keep provider keys on the server. This PR contains no routing calls.
3. **Separate raster, route and telemetry contracts.** Basemap coordinates request public map images. The provider receives no tenant IDs, positions, waypoints or tokens from Trackium in PR A. Planned checkpoint lines retain their dashed style and existing provenance. Calculated routes and observed histories will have separate geometries and legends. Existing shipment and tracking semantics are required for future integrations.

### Display engine

| Candidate | Strength | Trade-off |
| --- | --- | --- |
| Leaflet (BSD-2-Clause) | Existing renderer, no WebGL dependency, straightforward same-origin raster, existing keyboard/popup/viewport logic | At fleet scale, use a bounded viewport feed plus clustering or Canvas instead of one SVG marker per observation. Test real device/GPU before changing renderer |
| MapLibre GL JS (BSD-3-Clause) | WebGL vector tiles, native clustering of GeoJSON sources, style expressions and labels that adapt across zoom and themes | WebGL and memory vary across Android WebViews. Requires styles, sprites, glyphs and vector tile origin compatibility. Benchmark 1k/5k devices, long histories, viewport update and rotation before migration |

[Leaflet reference](https://leafletjs.com/reference.html) · [MapLibre GL JS reference](https://maplibre.org/maplibre-gl-js/docs/)

### Routing engine candidates

| Engine | Fleet fit | Operational implications |
| --- | --- | --- |
| Valhalla (MIT) | Turn-by-turn, waypoints, alternative requests, dynamic truck costing including height, width, length, weight and axle load. Availability of alternatives depends on route and engine | Generate graph tiles from extracts covering connected regions. Benchmark graph build vs runtime costs separately. Use source-date and engine-version metadata |
| OSRM (BSD-2-Clause) | Fast car routes and alternatives, maneuvers, nearest and map matching. Lua profiles applied when building data | Separate graph/profile work is needed for varying truck dimensions. Per-request vehicle enforcement needs validation beyond stock car routing |
| GraphHopper (Apache-2.0 engine) | OSM routes, maneuvers, map matching and flexible custom models. Hosted API has separate plans and capabilities | Evaluate flexible vs preprocessed modes and truck restrictions with a reproducible profile. Review hosted API rights, quotas and data processing separately |

[Valhalla turn-by-turn API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) · [OSRM HTTP API](https://project-osrm.org/docs/v5.24.0/api/) · [GraphHopper engine](https://github.com/graphhopper/graphhopper) · [GraphHopper hosted API](https://docs.graphhopper.com/)

OSM access, dimensions, axle loads, hazardous goods and time restrictions are incomplete in some areas. A truck-costed path is planning assistance. Validate route legality against local restrictions. Car fallback requires an explicitly different profile, rather than implied truck suitability. Cross-border routes require connected extracts on both sides, unified graph builds and coverage tests.

## Data, costs and operations

- Geofabrik offers Germany and connected Europe PBF extracts and replication updates. Extracts refresh periodically, typically daily. Record the exact upstream timestamp, build parameters, dependencies, file hash and licence for each release. Build a separate snapshot and verify major cities, border crossings, attribution and maximum zoom before switching read-only mounts. Use the previous release for rollback. [Germany extract and updates](https://download.geofabrik.de/europe/germany.html) · [Europe extracts](https://download.geofabrik.de/europe.html)
- OSM data is ODbL. Include visible linked attribution when serving the Produced Work and comply with any obligations for a derived database. Contracted tiles require an agreement covering commercial use, server-side caching or redistribution, attribution, and availability. Do not configure the OSM Foundation public tile service for this deployment. [Attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) · [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- The PR accepts an exported 256×256 PNG XYZ tree. Raster tile count grows by up to 4× per additional zoom at fixed footprint. Render only intended coverage, prioritize the pilot area and keep a storage budget; building full-Europe street raster pyramids preemptively is poor value. Self-host raster generation off the Gateway using a renderer such as OpenStreetMap Carto/Mapnik and export XYZ; for a commercial supplier use licensed downloadable/mirrorable imagery. Hosted tile and routing prices depend on region, request/egress quota and contract; no provider or price has been selected.
- Separately measure map generation CPU, peak RSS, extract and output disk, gateway tile hit/miss and egress, and routing graph build time, disk, RSS and route throughput. Start sizing the pilot with explicit budgets (for example 4 vCPU/16 GiB build runner and storage sized after a coverage sample); these are evaluation envelopes, not Germany or Europe requirements. Evaluate cold versus warm p95 for border/urban routes, low-end Android memory, sparse coverage, stale graph and service failures. Europe sizing requires measurements on the target extract and hardware. Production resource allocation and provider spend require operator approval.
- Gateway tile requests are same-origin GETs for public cartography. The tile handler accepts only in-range XYZ files under the configured mount, checks size and PNG IHDR, limits concurrent reads, and uses no outbound network. Use an immutable, read-only operator mount outside the application tree. Keep all application/tenant secrets outside it. Serve scoped cache/edge rate limits when enabling real coverage, monitor 404/503 and byte/latency metrics without tenant identifiers, and respect cache TTL during tile publication. Missing/unavailable tiles leave the geographic overview usable. Roll back by removing the two tile environment variables and restoring the previous static bundle if needed.

### Try locally

Set `ENABLE_WEB_WORKSPACE=true`, `LITE_ROAD_TILES_DIR=/absolute/read-only/xyz` and optionally `LITE_ROAD_TILES_MAX_ZOOM=18` (1–19). Keep the normal Gateway authentication and Web deployment settings. Put images at `<dir>/<z>/<x>/<y>.png` in XYZ order (flip TMS Y on export). With no configured mount, the existing geographic overview is used. The browser test uses a checked-in, licensed Berlin street tile and can use a larger local set via `TRACKIUM_ROAD_TEST_TILES`. The fixture is never loaded by a running Gateway unless explicitly mounted.

### Review evidence

[Berlin street map in desktop Chromium](lite-road-review/berlin-1440.webp) · [390 px Chromium viewport](lite-road-review/berlin-390.webp). The cartography is OSM-derived. The marker in the review screenshots is a synthetic browser fixture, marked synthetic in its popup. The captures use a small local Berlin tile set rendered from the same source extract as the checked-in tile. They establish street-level rendering and attribution; they do not establish European coverage or Android field acceptance.

Local HTTP smoke on one warm fixture served 200 GETs with eight requests in flight, zero errors and 17.4 ms p95. This measures the fixture handler on loopback, not deployment capacity. Browser checks cover loading, attribution, switching layer, and viewport retention through polling at desktop and phone widths.

## Follow-on contracts and acceptance

- **B, routing and versions:** implement tenant- and shipment-scoped proposed/approved/active versions, optimistic revisions, permissions, audit and an explicit activation boundary. Keep existing Shipment API and checkpoint model. Validate coordinate ranges, timeouts, response sizes, waypoint counts, provider errors, maneuvers and profile assertions. Benchmark bounded requests and prove real road routing against a pinned graph.
- **C, Fleet Map V2 / Route Editor:** first Lite screen after auth, list/map/panel synchronization, accessible editor and alternatives. Add viewport queries/clustering and actual stress evidence instead of expanding the polling feed. Confirm theme/rotation on Android.
- **D, GPS/history:** preserve observation time, Gateway receipt, age, trust and tenant boundaries. Match only quality-gated samples. Treat missing/ambiguous samples as unavailable and validate out-of-order and buffered cases before real deviation alerts. Persist no inferred trajectory as physical history.
- **E, navigation:** model the active session and maneuver progress, reroute after qualified deviations only. Evaluate native permission/background requirements with actual Android hardware. Maintain the Lite WebView origin/export rules.
- **F, acceptance:** verify capacity, failure recovery, licensing, screenshots, browser and instrumented Android flows, and real GL110-GL pilot acceptance.
- **Optional independent Core contract:** portable route/waypoint geometry and maneuver schema; independently deployed engine and owner-authorized position source. Core maintains independent node, proof engine and telemetry boundaries. Road data and route computation do not depend on Integritas or Lite SaaS login.
