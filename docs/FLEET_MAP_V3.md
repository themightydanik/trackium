# Trackium Premium D2 · Fleet Map V3

## V2 audit and V3 decisions

D2 starts from main `ab3b164` with PR #109 and consumes the existing D1 semantic tokens.

| Area | V2 | V3 |
| --- | --- | --- |
| Layout | Two-column map and manifest with context below. | Desktop Fleet Explorer, primary map and Shipment Inspector on one row. Controls can collapse either side or expand the live map across the viewport. The mobile explorer starts closed and the docked inspector has collapsed and expanded states. Its contents scroll separately from the map. |
| Selection | List, map object picker and checkpoint popup update the same shipment selection. Search and status operate on the loaded manifest page. | The same controls and state drive V3. Selecting a shipment opens its inspector. The explicit fit action changes the camera. |
| Map and layers | One Leaflet host with independent planned paths, B3 road revision, and eligible observations. Natural Earth backs same-origin road tiles. | Same instance and layers. Local vector icons differentiate selected checkpoints and observations from the overview. A truck denotes an eligible observation from the selected shipment's linked device. Radio denotes another eligible reported location. Neither icon represents live speed or heading. |
| Inspector | Stops, B3 estimates and provenance, eligible positions and physical history. | Adds status, shipment identity and recent events from the loaded authorized snapshot. The shipment detail action still exposes the full record. Planner and version history remain accessible through the existing B2/B3 workflow. |

V3 adds presentation state to the existing tenant-scoped fleet view rather than adding a polling loop. The in-place reconciler retains the Leaflet host. A resize observer attached to the canvas invalidates Leaflet size only when dimensions change and disconnects on unload. Full screen uses the existing canvas in a viewport overlay, supports Escape and confines keyboard focus. This works without requesting native fullscreen support from WebView. The mobile inspector is docked in document flow to avoid interception of map gestures.

V2 already bounds the manifest to a page and composites background planned paths. V3 keeps small overview stop symbols and enriches only the selected stop markers. Clustering is deferred because the existing 25-shipment fixture remains legible at fleet zoom. Routes display ordered stops. No motion arrow is inferred from road geometry or a single GNSS sample.

## Preserved contracts

- Existing Gateway reads, workload budgets, access roles, tenant/session scope and active-route watches.
- B2 Valhalla calculation and B3 proposal, compare, approval and activation, including provenance and generation checks.
- Planned, preview, calculated and observed layers remain independent. Eligibility, stale styling, physical history and advisory deviation use the existing observation model.
- AOVX framing and ACK, custody transfer, GNSS and server-side eligibility, Integritas and Minima proof behavior remain unchanged.

See the [local asset catalog and licenses](visual-assets/README.md).

## Browser evidence

The captures use the existing explicitly synthetic shipment and route fixture with Natural Earth fallback. They contain no production coordinates or customer records. Mobile evidence comes from Chromium viewport and touch emulation. Native Android acceptance remains separate.

| Workspace | Light | Dark |
| --- | --- | --- |
| Desktop with selected shipment | [1440 px](fleet-map-v3/desktop-light.webp) | [1440 px](fleet-map-v3/desktop-dark.webp) |
| Desktop full screen | [1440 px](fleet-map-v3/desktop-full-screen-light.webp) | [1440 px](fleet-map-v3/desktop-full-screen-dark.webp) |
| Mobile collapsed inspector | [390 px](fleet-map-v3/mobile-collapsed-light.webp) | [390 px](fleet-map-v3/mobile-collapsed-dark.webp) |
| Mobile expanded inspector | [390 px](fleet-map-v3/mobile-inspector-light.webp) | [390 px](fleet-map-v3/mobile-inspector-dark.webp) |

Reproduce the captures and regression with Chromium and Playwright:

```sh
mkdir -p /tmp/fleet-map-v3
TRACKIUM_FLEET_V3_SCREENSHOTS=/tmp/fleet-map-v3 \
  node --test --test-name-pattern='Fleet Map V3 panels' tests/minidapp/fleet-map.test.cjs
```
