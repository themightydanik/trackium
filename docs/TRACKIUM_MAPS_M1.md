# Trackium Maps M1 · vector roads and route alignment

## Decision

Baseline `4cf8913` includes Fleet Map V3 and Premium D3. Fleet, Overview and the reported-position views reuse the Leaflet host. Keyed layers keep planned stops, B2 previews, active and historical B3 geometry, observed positions and popups separate. Theme and fleet state survive a background refresh. The existing local Natural Earth geometry shows national context. The opt-in raster mount supplies street imagery only where pre-rendered tiles exist. Its PNG pairs duplicate a pyramid for both themes and cannot adapt labels and classes dynamically.

| Approach | Finding |
| --- | --- |
| Leaflet + MapLibre | Selected. Chromium rendered real vector roads and local Noto glyphs under the existing interactive Leaflet pane. The camera and overlay DOM survive both manual and system paint changes. MapLibre handles vector clipping, collision-aware labels and road widths. |
| Full migration | Unnecessary for M1. It would move projection, popup, focus, route picking, compare, gesture and persistence paths. The hybrid passed the compatibility tests without taking those paths over. |
| Raster | Retained. It works without WebGL and is an optional backing layer when a matching local raster mount is configured. Natural Earth remains at the bottom. |
| OpenMapTiles / TileServer GL | A viable alternate producer/server pair. It requires a different schema contract and more runtime components than needed for this review. |
| Protomaps PMTiles | Selected as the offline acquisition format. Export an immutable local XYZ tree from fixed archive ranges. This avoids a runtime Range proxy or a live Internet tile dependency. A regional PMTiles server such as Martin remains an option once data size warrants it. |

MapLibre GL JS 4.7.1 uses its pinned CSP build and one same-origin worker. The ISC Leaflet adapter 0.1.0 maintains the camera synchronization. The renderer and stylesheet are lazy-loaded only when a configured vector basemap is mounted. Its pane sits above raster and Natural Earth and below all operational Leaflet overlays, with no pointer handling. Light and Dark are Trackium palettes with cased road classes, land, water, green and industrial areas, buildings, boundaries, city labels and street names. There are no sprites or external style URLs. Theme changes update paint properties without replacing the source or resetting the camera. Missing vector roads reveal the backing map. A slow load, network failure, unavailable WebGL or context loss retains map actions and presents basemap-specific status. Switching to Geographic overview is always available.

## Data, provenance and alignment

The Protomaps OSM build is `20261124` at `https://build.protomaps.com/20261124.pmtiles`, archive size 139,733,387,110 bytes and ETag `90ca41f437fcd495e58e2b905ac8840c-521`. The extraction validates byte ranges and consistent archive identity, and writes a per-tile checksum manifest. The operator should retain the manifest, publish an immutable mount and use a new release ID for an update. This date identifies the archive build. Its exact OSM replication instant was not independently established. The review export included 490 tiles at native zoom 8–15 across eight small windows, occupying 36,544,306 compressed bytes plus about 824 KiB of glyphs. Review manifest SHA-256 `a71d6992d198473332ce011067fe23de54b7abe5eeeab850f6f6f4141c893059`. A tiling window does not imply regional or national availability.

Two real loopback Valhalla 3.6.3 processes used the same image digest pinned in the B1 release files. The Ukraine graph `44850cd34dc802e77101349be1d44df3f0641c7f5856aed3eeb188d2aedc40f6` used Geofabrik Ukraine snapshot 2026-11-24. The arterial graph `6a707e47f877bd471dce66baa5fb0e1e54d4a1bfe6a0f2c49156eb1f9d992f29` is the existing multi-country pilot with cutoff 2026-11-25 UTC. Input dates/checksums and graph construction are recorded in the B1 manifests. This review ran local graph copies. [B1 manifest procedures](ADR_VALHALLA_FOUNDATION.md)

Valhalla polyline6 preserves WGS84 latitude then longitude through the bounded validator and Leaflet renderer. MapLibre camera coordinates and MVT-decoded GeoJSON use longitude then latitude. Both render with Web Mercator. The adapter compensates for the 256/512 pixel zoom convention via MapLibre zoom = Leaflet zoom − 1. The route is never moved or rounded to match a raster or tile boundary. MVT clipping and quantization, source edits, generalization, and the graph's vehicle eligibility can legitimately differ. The checker converts decoded tile coordinates back to WGS84 and measures point-to-segment distance on a local tangent plane. It uses the nearest displayed road, so zero distance is neither an edge-ID match nor road-use validation.

| Auto route | Valhalla distance / seconds | Vertices covered at native z15 | p95 / max nearest road distance |
| --- | ---: | ---: | ---: |
| Kyiv, central streets | 1.653 km / 147.126 | 60/60 | 0.11 / 0.20 m |
| Kyiv, western approach | 11.673 km / 3167.968 | 43/173 | 0.34 / 26.74 m |
| Lviv, central streets | 1.554 km / 129.948 | 67/67 | 0.14 / 0.29 m |
| Warsaw, arterial approach | 8.947 km / 558.501 | 97/235 | 0.31 / 0.38 m |
| Berlin | 2.793 km / 267.300 | 85/183 | 0.22 / 0.30 m |
| Essen | 1.439 km / 113.695 | 76/76 | 0.21 / 0.28 m |
| Lviv → Rzeszów, sampled border approach and city tiles | 170.284 km / 7949.937 | 135/2239 | 0.15 / 0.30 m |

The Kyiv West outlier and detour remain unresolved. Compare the relevant OSM source revisions, road restrictions, graph snap and tile feature selection before making a route-quality claim for this stretch. Unmounted vertices are excluded from the distance metrics. Whole-route visual alignment, junction-level lane correctness, alternate embodiments of the graph, and full national basemap coverage are outside the verified sample.

## Security, licensing and operations

The Gateway reads only bounded, local, versioned XYZ MVT and Noto glyph paths. It validates canonical XYZ bounds, rejects paths outside the mount, requires regular files, caps each response at 512 KiB on disk and limits 24 concurrent reads per process. The handler fetches no arbitrary URL and proxies no Oracle endpoint. The file tree is public cartography, isolated from tenant data. Use a read-only, trusted build mount, validate compressed and decoded size during release review and use edge rate controls before opening a larger dataset. Responses use same-origin resource policy and immutable caching for the release URL. Existing Gateway CSP is sufficient. No keys or remote glyph, sprite or style loads are needed. The glyph route uses an ASCII font alias accepted by the existing Android TrustedOrigin path rules.

Visible map attribution links to OpenStreetMap contributors and Protomaps. OSM is ODbL 1.0. Retain input and release manifests and satisfy derivative database obligations if distributing the tile tree. This PR includes screenshots and a synthetic one-tile regression fixture. It does not distribute the OSM tile export. Renderer and bridge licenses and locked checksums are in `tools/`. Noto glyphs come from the Protomaps asset commit `028c18f713baecad011301ff7a69acc39bcc2ae7` under OFL 1.1. Keep the license with redistributed glyphs. [Protomaps attribution](https://docs.protomaps.com/basemaps/attribution) · [OSM attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) · [Vendor lock](../tools/web-vendor-lock.json)

The renderer, worker, CSS and adapter total 1,158,828 uncompressed bytes, loaded only for a configured map. The sample extraction took 512 range requests and 39.54 MB of archive payload. Later browser capture timings, from interacting with the object picker after the fixture opened, were roughly 0.8–1.3 s desktop and 1.5–1.6 s at mobile widths on Chromium software WebGL. These include UI automation and local transport, and do not represent a cold or WAN load. Observed page JS heap was roughly 18–23 MB, excluding GPU, decoded tile memory and worker memory. Physical Android, weak GPU frame-rate, long-run memory and commercial traffic are pending.

An Oracle VM with 1 OCPU and 6 GB RAM hosting a Valhalla container capped at 4 GB has under 2 GB theoretical RAM headroom before the OS and filesystem cache. The 35 MiB tile pilot fits easily on disk. Runtime XYZ delivery needs bounded file reads only. For Ukraine at z15, a latitude-50 footprint implies roughly one million intersecting z15 tiles before clipping. Including parent zooms and assuming 5–25 kB per compressed tile gives a planning range of roughly 6–33 GB. This is an estimate, sensitive to language, building coverage and urban density. Germany, Poland and expanded Europe require separate regional builds and a measured storage and egress forecast. The 139.7 GB world archive is unsuitable as a default mount. Build/extract on an authorized local machine. Start with a regional pilot on a read-only mount, measure hit rate, p95, resident memory, 404/503 and egress, and keep rollback space for the previous release. Confirm Oracle disk, RAM, CPU, quotas and a same-origin delivery path before any production decision. No service or configuration changes were made to Oracle or Railway.

## Restore and reproduce

1. Install review-only tools in a temporary directory. Set `NODE_PATH` to its `node_modules`. Export the pilot with the script below.
2. Populate `glyphs/` with the pinned Noto Sans Regular PBF ranges used here. Use the source path `fonts/Noto%20Sans%20Regular/<range>.pbf` from the asset commit above. Ranges are 0–255, 256–511, 512–767, 768–1023, 1024–1279, 1280–1535, 1792–2047, 8192–8447 and 8448–8703. Filenames use ASCII hyphens. Include additional ranges if names in a broader release use them.
3. Run the existing Gateway locally with `ENABLE_WEB_WORKSPACE=true`, `LITE_VECTOR_TILES_DIR=/absolute/pilot` and `LITE_VECTOR_TILES_RELEASE=20261124`. Open Fleet Map and use the existing picker, zoom and theme controls. Optional raster variables are unchanged. Clear both vector variables or select the previous immutable release to roll back.
4. Run Valhalla 3.6.3 from the B1 build, bound to loopback. Save its actual JSON `/route` responses. Use the checker below. In the screenshots, actual routes were normalized by the existing B2 contract and displayed via an isolated B3 browser fixture. No synthetic GPS marker is visible in the alignment views.
5. Run the focused Chromium vector/basemap tests and build the MiniDapp. General regression and Android shell checks are delegated to CI. Standalone MiniDapp retains geographic fallback and does not package the optional Gateway-served renderer binaries.

```sh
npm install --prefix /tmp/trackium-map-tools pmtiles@4.5.0 @mapbox/vector-tile@2.0.5 pbf@4.0.2
export NODE_PATH=/tmp/trackium-map-tools/node_modules
node scripts/extract-vector-pilot.mjs /tmp/trackium-map-pilot 20261124
curl -fsS http://127.0.0.1:8002/route -H 'Content-Type: application/json' \
  -d '{"locations":[{"lat":50.4504,"lon":30.5236},{"lat":50.4402,"lon":30.5164}],"costing":"auto","units":"kilometers"}' \
  > /tmp/kyiv-route.json
node scripts/check-vector-alignment.mjs /tmp/trackium-map-pilot /tmp/kyiv-route.json
node --test tests/minidapp/vector-basemap.test.cjs tests/minidapp/road-basemap.test.cjs
```

## Chromium evidence

Mint is actual Valhalla road geometry and dashed gold is planned checkpoints. Only the mounted samples are shown. Compare the same Kyiv viewport with [geographic fallback](maps-m1/before-kyiv-1440-light.webp) and [vector roads](maps-m1/kyiv-1440-light.webp).

| Road window | Light | Dark |
| --- | --- | --- |
| Kyiv | [Street alignment](maps-m1/kyiv-1440-light.webp) | [Street alignment](maps-m1/kyiv-1440-dark.webp) |
| Kyiv west | [Approach](maps-m1/kyivWest-1440-light.webp) | [Approach](maps-m1/kyivWest-1440-dark.webp) |
| Lviv | [Street alignment](maps-m1/lviv-1440-light.webp) | [Street alignment](maps-m1/lviv-1440-dark.webp) |
| Warsaw | [Arterial approach](maps-m1/warsaw-1440-light.webp) | [Arterial approach](maps-m1/warsaw-1440-dark.webp) |
| Berlin | [Street alignment](maps-m1/berlin-1440-light.webp) | [Street alignment](maps-m1/berlin-1440-dark.webp) |
| Essen | [Street alignment](maps-m1/essen-1440-light.webp) | [Street alignment](maps-m1/essen-1440-dark.webp) |
| Lviv → Rzeszów | [Intercity detail](maps-m1/corridor-1440-light.webp) | [Intercity detail](maps-m1/corridor-1440-dark.webp) |

[Fleet workspace](maps-m1/workspace-1440-light.webp) · [Full screen](maps-m1/fullscreen-1440-light.webp) · [390 Light](maps-m1/kyiv-390-light.webp) · [390 Dark](maps-m1/kyiv-390-dark.webp) · [320 Dark](maps-m1/kyiv-320-dark.webp) · [Mobile inspector](maps-m1/inspector-390-dark.webp).
