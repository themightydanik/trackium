# Fleet Map V2 · C1

Fleet Map is the initial page of the signed-in Lite company workspace and the first destination in Lite navigation. Existing deep links, Overview and shipment details remain available. It uses the same page in the dedicated Android Lite WebView. The fleet manifest sits alongside the map on desktop and flows below it at narrow widths. Map, shipment context and device observations remain keyboard accessible.

## Data and rendering

The existing Lite polling loop supplies the paginated shipment and device snapshot and preserves the Leaflet node through in-place updates. The road basemap uses the same-origin tile contract and attribution from PR #92, with local Natural Earth geography underneath. C1 leaves Gateway endpoints, authentication and PostgreSQL unchanged.

The selected shipment alone gets a bounded, customer-session GET to B3's `/v1/shipments/{id}/road-routes/active`. When there is no active version the UI reads the small revision list to distinguish unapproved/unactivated plans from empty history. The next existing poll can revalidate the selection after 15 seconds. There is one in-flight route request and one cached revision. Changing selection or leaving the map cancels this request. Logout, session expiration and tenant changes discard the selection and data. Older deployments or unavailable B3 reads show a recoverable route status. Stored revisions can be read while the calculation service is unavailable. The screen issues no route mutations or recalculations.

Planned checkpoints remain gold and dashed, independently of the mint calculated route. The map draws each decoded polyline6 leg independently and shows ordered road origin, waypoints and destination. The decoder bounds shape length, leg and vertex counts and rejects malformed data rather than drawing a substitute line. Immutable B3 versions keep decoded geometry and layer objects across snapshot refreshes. Blue position markers come only from the same Gateway eligible-location API used elsewhere in Lite. Observations retain synthetic or unverified provenance and stale markers are visually distinct. No position comes from road route or checkpoint data.

Use the manifest, object picker or a checkpoint popup to select a shipment. Use **Show on map** or **Fit shipment** to change the camera. Search and status filters apply to the current manifest page. Layer controls and viewport remain in place during background changes. The context panel shows distances, estimates, stop coordinates and graph provenance. Truck and static-data warnings apply to planning decisions. Company authorization and the existing network/session failure states remain authoritative.

## Evidence

The browser fixture exercises 25 shipments, 75 planned markers, three road-stop markers and one explicitly synthetic stale position. A two-leg road result is supplied at the API boundary. An additional Chromium test uses the real Gateway and PostgreSQL to read a saved revision through the authenticated customer workspace. B2/B3 engine and deployment evidence is separate. Android JVM and browser mobile-viewport tests do not establish physical WebView acceptance.

Desktop and mobile captures use the same synthetic dataset and geographic fallback. See [1440 px Light](fleet-map-c1/fleet-light-1440.png), [1440 px Dark](fleet-map-c1/fleet-dark-1440.png), [390 px Light](fleet-map-c1/fleet-light-390.png), and [390 px Dark](fleet-map-c1/fleet-dark-390.png).

Reproduce captures and measure elapsed Chromium time from keyboard shipment selection to the rendered active road status:

```sh
mkdir -p /tmp/trackium-fleet-captures
TRACKIUM_FLEET_SCREENSHOTS=/tmp/trackium-fleet-captures \
  node --test tests/minidapp/fleet-map.test.cjs
```

Install Playwright and Chromium using the MiniDapp workflow setup or the existing local UI environment. Recorded selection-to-visible times were 204 ms at 1440 px, 325 ms at 768 px, 212 ms at 390 px and 137 ms at 320 px. Timing includes browser interaction, intercepted Gateway reads and DOM/Leaflet work. It samples a single headless run at each viewport. It does not measure physical Android, production traffic or road engine latency.

## Next stages

C2 can build route authoring around the existing shipment, ordered stops and B2 calculation contract. C3 can add proposal history and approval/activation controls around B3's generation checks and role restrictions. Physical Android interaction and production capacity acceptance remain separate.

## C1 final map-legibility acceptance

Natural Earth country names use the dataset's label anchors and priority ranks. Leaflet projects the candidates into the current viewport and labels reserve non-overlapping padded boxes. Narrow canvases limit labels to five at zoom 4–5 and eight at closer zooms. The initial layout and subsequent map movement, zoom or resize drive placement. A stationary polling cycle retains the existing label nodes.

The fleet overview composites its neutral, thin planned paths and smaller stops in a single translucent Leaflet pane. Overlapping routes cannot add opacity across the pane. Selection further dims that pane, while the selected planned route stays gold and dashed above it. The solid mint B3 road route and its stops sit above both planned layers. All 25 plans and 75 checkpoints remain in the map and selectable. Layer toggles remain independent.

| Mobile viewport | Labels at the fixture route | Route and checkpoint evidence | Scroll and touch evidence |
| --- | --- | --- | --- |
| 320 px | 5 with no bounding-box intersections | 72 background and 3 selected planned stops, 3 road stops | 13 px clear above navigation after scrolling to the caption, both with no inset and a simulated 24 px inset |
| 390 px | 5 with no bounding-box intersections | 72 background and 3 selected planned stops, 3 road stops | 13 px clear above navigation after scrolling to the caption, both with no inset and a simulated 24 px inset |

Before the fix, aligning a map action to the viewport's lower edge put it behind the fixed bottom navigation at both widths. Fleet Map now reserves a scroll inset from the existing bar and safe-area values. The browser test uses actual hit testing, scroll alignment and taps on map zoom and device controls. Full-page captures show the fixed navigation at the initial viewport boundary. The scrolled viewport captures show the caption and controls above the bar.

- 320 px [Light](fleet-map-c1/fleet-light-320.png) · [Dark](fleet-map-c1/fleet-dark-320.png) · [Scrolled viewport with simulated safe area](fleet-map-c1/fleet-safe-area-320.png)
- 390 px [Light](fleet-map-c1/fleet-light-390.png) · [Dark](fleet-map-c1/fleet-dark-390.png) · [Scrolled viewport with simulated safe area](fleet-map-c1/fleet-safe-area-390.png)
- 1440 px [Light](fleet-map-c1/fleet-light-1440.png) · [Dark](fleet-map-c1/fleet-dark-1440.png)

The safe-area measurement uses a controlled CSS inset in Chromium. Physical handset cutouts and the production WebView remain separate acceptance checks.
