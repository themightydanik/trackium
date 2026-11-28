# Trackium Maps M1.1 · regional roads

## Review decision

M1.1 builds on open PR #112 at `6a034c798b9c277d1a3a195bc85393c8b9a420f5`. M1 shipped the optional Leaflet/MapLibre layer and raster/Natural Earth fallback. Its 490 tiles were disconnected review windows. M1.1 extracts and verifies two contiguous rectangular releases and measures their route coverage. The backend uses local immutable XYZ, with an optional compact coverage manifest. Fleet selection, routing and physical-telemetry behavior use the existing contracts.

**Ready for regional technical review. Production pilot requires owner approval, target Railway storage and an actual capacity check.** Both tested routes have full sampled coverage at the measured zooms. The rectangles cover neither all Ukraine nor the full Poland–Ukraine border.

## Kyiv West outlier

The saved M1 route and a fresh Valhalla 3.6.3 query at [the recorded endpoints](maps-m1-1/evidence.json) have identical polyline6. The graph is the B1 Ukraine snapshot from Geofabrik dated 2026-11-24. At vertex 168, **50.444113 N, 30.278475 E**, the nearest visible feature under M1 rules is 26.7363 m away in native tile `15/19140/11049`. The source OSM extract has [way 1233301080](https://www.openstreetmap.org/way/1233301080) as `highway=track`, 0.0134 m from that point, with no explicit `oneway`, `access` or `motor_vehicle` tag in the pinned extract. The next raw highway candidates were a path at 15.34 m and a service road at 26.67 m. This is a geometric association. The processed MVT ID is a separate identifier.

The matching Protomaps 20261124 MVT line is present as `kind=path` (feature `35184524898180`). M1 removed that class both from paint and from the nearest-road comparison. Including it yields **0.0490 m at the same vertex**, with no geometry or snap change. Over the original 43 covered z15 vertices the p95 moves from 0.34 m to 0.16 m and the maximum from 26.74 m to 0.34 m at a different vertex. Checking all eight neighboring tiles leaves the original 26.74 m value, so the discrepancy is not explained by neighboring tile selection. The raw OSM and decoded MVT independently agree with the WGS84 point, which rules out a coordinate transform or polyline6 error for this vertex.

Classification is **other verified cause — style and measurement omitted an existing road feature**. M1.1 paints local paths as subdued dashed lines at MapLibre zoom 13 and above. A path symbol carries no promise of legal motor access. The change explains an apparent map offset. The separate 11.673 km detour and its 3167.968 s estimate remain outside this finding. Coarser tiles can omit tracks and simplify roads. We do not shift route geometry.

## Regional releases and route evidence

| Release | WGS84 bbox (west/south/east/north) | Approx. area | Native zoom | Files / road-bearing | Compressed tiles |
| --- | --- | ---: | --- | ---: | ---: |
| Kyiv → Zhytomyr | 28.55 / 50.16 / 30.62 / 50.54 | 6,200 km² | 8–13 | 968 / 946 | 13,375,212 B |
| Lviv → Rzeszów | 21.96 / 49.80 / 24.09 / 50.15 | 5,900 km² | 8–13 | 973 / 961 | 20,158,992 B |

All requested XYZ files were obtained at all six native zoom levels in both regions. Some tiles contain no displayable road and stay outside the road-bearing manifest. The boxes include city streets, urban approaches, agricultural areas and major roads where supplied by the extract. Higher display zooms overzoom z13. They do not add native z14/15 building or lane detail. The outlier review has a separate z13–15 detail fixture. Both regional datasets derive from the same Protomaps build 20261124, 139,733,387,110-byte archive, pinned ETag `"90ca41f437fcd495e58e2b905ac8840c-521"`. Protomaps build date and Geofabrik OSM snapshot date are independent. [Machine-readable checksums, inputs and measurements](maps-m1-1/evidence.json)

| Route, Valhalla 3.6.3 | Routed km / seconds | File and road vertices at z10/12/13 | Sampled road km and segments | Tile crossings z10/12/13 | p95 nearest road z10/12/13 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kyiv → Zhytomyr (Ukraine graph) | 140.329 / 5567.591 | 1278/1278 | 140.181 km, 1277/1277 | 6 / 28 / 53 | 5.43 / 1.54 / 0.80 m |
| Lviv → Rzeszów (arterial graph) | 170.284 / 7949.937 | 2239/2239 | 170.102 km, 2238/2238 | 8 / 34 / 67 | 6.79 / 1.80 / 0.94 m |

Actual loopback Valhalla used pinned B1 graph copies. Lviv → Rzeszów was rerun against the same graph with identical shape. Counts distinguish file presence, decoded road-bearing tiles, route vertices and segments. Length coverage weights polyline samples spaced at most 25 m, so its total differs slightly from the Valhalla route length. Road coverage means the sample's tile carries a displayable road. Nearest-road checks separately compare vertices to usable lines from the containing and adjacent tiles. Neither metric proves exact OSM edge agreement, carriageway direction, restrictions or routing quality. Distances are geometrical, and z10 simplification produces maxima of about 43 m and 38 m respectively. [B1 graph provenance](ADR_VALHALLA_FOUNDATION.md)

## Extraction, verify and package

Use the existing extractor with one of the [region configurations](../routing/maps/). It keeps five workers, checks each Range and the immutable ETag and archive length, and plans the full rectangular XYZ footprint with a tile count ceiling. Per invocation fetch budget is 1800 reads and 200 MiB. Each file is compressed, decoded and checked against the Gateway size constraint. Per-tile sidecars bind the bytes and road count to the archive and release. Atomic replacement prevents a partial file from being reused. Run one writer per output directory. Re-running the domestic export revalidated and reused **968 files** and fetched only the 16 KiB archive header. The offline verification command rejects mismatched metadata, out-of-region keys and corrupt material. It reports absent tiles separately.

`manifest.json` includes identity, bounds, zooms and sorted XYZ keys with bytes, SHA-256 and road count. `coverage.json` is a same-origin immutable asset containing release, native zoom limits and the road-bearing keys. Only the latter is served to the client. MapLibre uses the declared max zoom for overzoom. At idle, a bounded viewport check compares intersecting native tiles with that index and known fetch errors. An unindexed or incomplete viewport with roads shows partial coverage. A viewport without roads shows unavailable. Renderer failures are separate, and normal zooms below the dataset are a quiet geographic overview. The pinned bridge now resizes the GL canvas when Leaflet changes size, including fullscreen. It keeps the same canvas and does not reroute.

```sh
npm install --prefix /tmp/trackium-map-tools pmtiles@4.5.0 @mapbox/vector-tile@2.0.5 pbf@4.0.2
export NODE_PATH=/tmp/trackium-map-tools/node_modules
region=routing/maps/kyiv-zhytomyr.json
node scripts/extract-vector-pilot.mjs /tmp/trackium-pilot 20261124 "$region"
node scripts/extract-vector-pilot.mjs /tmp/trackium-pilot 20261124 "$region" --verify
TRACKIUM_ALIGNMENT_ZOOM=13 node scripts/check-vector-alignment.mjs /tmp/trackium-pilot /tmp/actual-route.json
```

Use the request endpoints and graph IDs in the evidence JSON to save original Valhalla route JSON using the [M1 loopback procedure](TRACKIUM_MAPS_M1.md#restore-and-reproduce). Add the pinned glyphs and OFL notice using the same M1 procedure. Add an attribution file for OSM/Protomaps and the ODbL license. Use the full derived tile tree when distributing the release, keep a copy of the source/manifest and satisfy ODbL share-alike and attribution requirements. The local package contains these notices, the exact declared tiles, glyphs and both manifests. It excludes resume sidecars. Sort member names, set tar owner/group and mtime to zero and use `gzip -n` for repeatable packaging. Neither regional archive is checked into GitHub. The locally built archives are about 14 MiB and 20 MiB. Their SHA-256 values are in the evidence JSON.

## Capacity and deployment

| Option | Assessment |
| --- | --- |
| Gateway + local immutable XYZ | Recommended for the first authorized pilot. Small archives fit readily in local storage, the existing checked handler stays same-origin, and moving serving off Oracle avoids placing that I/O beside the route process. Requires a Railway volume or an explicitly built local artifact in the Gateway image. Confirm real capacity, persistence, rollback storage and ingress throttles first. |
| Oracle static XYZ | Can reduce Railway storage but shares Oracle page cache, disk I/O and CPU with Valhalla. Railway cannot mount an Oracle filesystem by setting a directory env var. A future transport needs a separately approved reachable authenticated static origin and fixed, bounded tile-only requests, distinct from the existing routing mTLS bridge. |
| Regional PMTiles + Range | Good packaging candidate once file count or rollback storage grows. Requires an authenticated/same-origin Range-capable service or approved caching architecture, bounded Range reads and a tested client change. |
| CDN / object storage | Future only. Compare total bytes stored, requests (including Range), cache hits, egress and published limits before choosing a provider. No paid capacity is assumed. |

Cold extraction used 14.16 MB archive payload and 144 MiB peak local RSS for the domestic box, 21.30 MB and 218 MiB for the international box. These are extraction host measurements. The warm loopback tile handler returned 1600/1600 requests at concurrency 16 with p95 21.71 ms, 13.71 MB compressed body bytes, about 1.98 s process CPU in 1.20 s elapsed and 167 MiB process RSS. In that mixed local run, Valhalla p95 was 119.67 ms versus 57.59 ms with routing alone. No WAN, cold filesystem, proxy headers, or production contention is represented. The data are a reason to separate serving from routing initially. Sixteen in-flight requests are not sixteen users. Estimate user limits after measuring tiles/session, cache hit rate and requested route throughput. [Benchmark data](maps-m1-1/evidence.json)

Oracle is documented as 1 OCPU/6 GB with Valhalla capped at 4 GB. Actual free disk, available RAM, CPU, filesystem cache and egress quotas have not been measured in Production in this review. Do not count the remaining nominal RAM as available for a renderer. On the owner-authorized host, record `df -h`, `du -sh` for the graph and mounts, `free -h`, `vmstat 1`, `docker stats --no-stream`, CPU or memory pressure counters, tile latency and concurrent route p95 before and during a serving trial. Reserve two immutable releases plus scratch space. Use the OSM attribution and local glyphs over HTTPS. Gateway allows only the versioned public tile, glyph and manifest paths, bounds, 512 KiB files and 24 concurrent reads. MIME, gzip and immutable caching remain same-origin. Invalid paths, unavailable files and saturation produce 404/503. Keep credentials and tenant data outside the public tile tree.

**Rollout after approval.** Verify artifact checksums and actual target volume from the Gateway process. Mount the dataset read-only. Record previous image/release and configuration. Enable both `LITE_VECTOR_TILES_DIR` and `LITE_VECTOR_TILES_RELEASE` together. Verify manifest, sampled tile/glyph URLs and content type, map appearance, partial/overview behavior, route latency, and existing workspace access. Start with domestic pilot, then consider the cross-border package after the same checks. Restrict tile abuse at ingress, monitor read latency, 404/503, cache, egress and routing p95. Roll back by restoring the previous versioned pair or removing both settings to return to raster/Natural Earth. Do not reuse a release ID for changed bytes. No change to Railway, Oracle or the Production routing graph was made here.

## Browser evidence and remaining gates

Actual B1 Valhalla output is shown via the authorized-workspace browser fixture, normalized with the existing contract. Reported GPS and planned geometries were disabled for the alignment captures. Chromium software WebGL captured desktop and 320/390 px. Example desktop interactions to capture took about 1.8–2.7 s including a fixed 900 ms stabilization pause, with about 16–27 MB observed JS heap. The 390 px capture took 3.15 s and about 20 MB. These figures are not cold start, worker heap, GPU memory or a long-running benchmark. Android CI exercises the app shell on an emulator. Physical Android, weak-GPU pan/zoom and long-session soak remain deployment gates.

- [Kyiv Light](maps-m1-1/kyiv-center-1440.webp) · [Different zoom](maps-m1-1/kyiv-center-z14.webp) · [390 px Dark](maps-m1-1/kyiv-center-390.webp)
- [Kyiv West before](maps-m1-1/outlier-before-1440.webp) · [Kyiv West after](maps-m1-1/outlier-after-1440.webp)
- [Continuous corridor, fullscreen Dark](maps-m1-1/overview-1440.webp) · [Intercity detail](maps-m1-1/corridor-1440.webp)
- [320 px partial coverage](maps-m1-1/partial-ui-320.webp) · [Geographic fallback](maps-m1-1/fallback.webp) · [Selected shipment on mobile](maps-m1-1/kyiv-center-ui-390.webp)

Next map milestones require owner-approved target capacity evidence, a low-end Android soak and expansion of the signed regional catalog. Exact edge and restriction matching belongs to a separate routing validation.
