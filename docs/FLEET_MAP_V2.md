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

Install Playwright and Chromium using the MiniDapp workflow setup or the existing local UI environment. Recorded selection-to-visible times were 117 ms at 1440 px, 67 ms at 768 px, 50 ms at 390 px and 44 ms at 320 px. Timing includes browser interaction, intercepted Gateway reads and DOM/Leaflet work. It samples a single headless run at each viewport. It does not measure physical Android, production traffic or road engine latency.

## Next stages

C2 can build route authoring around the existing shipment, ordered stops and B2 calculation contract. C3 can add proposal history and approval/activation controls around B3's generation checks and role restrictions. Physical Android interaction and production capacity acceptance remain separate.
