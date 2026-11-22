# Trackium Lite — browser workspace

Open `https://<your-gateway>/app/` in a browser. The Gateway serves a standalone Trackium Lite manifest scoped to `/app/`. You can use this as a browser tab or add a shortcut where the browser supports it. The Lite entry loads no Minima SDK or bridge. Authenticated use requires the Gateway to be online. No service worker or offline tenant-data cache is provided.

1. Enter the tenant UUID and request owner approval. The owner approves the one-use challenge using the existing trusted operator workflow. Complete pairing in the same browser. Only the scoped HttpOnly session belongs in the browser. [Gateway pairing instructions](GATEWAY_SHIPMENTS_SIMULATION.md)
2. Open **Devices → Device details**. Use **Older observations** and **Newer observations** in **Returned telemetry history**. The Gateway supplies up to 20 events per page through its existing tenant-scoped device events API. Charts and the list show only the selected page. The device status, current position and raw snapshot above the history refer to the workspace snapshot at the time you opened the details.
3. The historical position plot shows individual eligible synthetic GPS observations. It leaves gaps between points. AOVX history remains unverified and uses Gateway receipt time. An unavailable physical position never becomes a current or historic marker. Planned shipment routes remain separately labelled on the workspace map.
4. Use **Disconnect and revoke** in Settings when finished. Going offline clears the displayed tenant data and any open history. After reconnecting, use **Retry session check**. A valid session can resume, while an expired or revoked one requires a new owner approval. History pages stay in memory only and are discarded when their dialog or session closes.

## Compatibility and acceptance

The supported pilot target is browser operation in current Chromium, tested in desktop and mobile layouts using local Playwright. Browser install prompts, physical Android/iOS devices, Safari, offline operation and Managed production onboarding are outside this local acceptance. The MDS package retains its separate manifest, static Preview and explicit Local Core workflow. This change uses the existing HTTPS API, scopes and CSRF controls with no storage migration.

The browser integration suite covers actual Gateway pairing, read-only scope rejection, tenant-isolated cursor requests, a 20+2 event history with missing GPS, return to the newer page, mobile layout, offline clearing, recovery and revoked session. The UI regression holds a cursor response across a session change to verify that late data is discarded. Existing ledger, outbox, proof status and restore tests remain the regressions for Gateway behavior.

Use the [Integritas test foundation](INTEGRITAS_PROOFS.md) for local proof evidence and the provider acceptance gates.

For email sign-in and company onboarding, use the [Lite customer workspace setup](CUSTOMER_WORKSPACE.md).

For a closed, mail-free demonstration, see [Minima demo access](MINIMA_DEMO_ACCESS.md).
