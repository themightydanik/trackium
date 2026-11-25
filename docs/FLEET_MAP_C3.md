# Fleet Map · C3 route lifecycle

Select a shipment in Fleet Map to read its authoritative route history. The route planner starts with a C2 draft. Calculate a preview, then use **Propose route** and review the shipment, stops, vehicle settings, estimate and road graph in the confirmation dialog. Gateway recalculates the proposal. The preview is a planning reference and its geometry is never submitted to B3. The resulting revision has its own calculation timestamp and graph provenance.

| Company role | Inspect and compare | Propose | Approve or activate |
| --- | --- | --- | --- |
| Owner or Admin | Yes | Yes | Yes |
| Dispatcher | Yes | Yes | No |
| Viewer | Yes | No | No |

Read and write permissions use the existing scopes and cookie session. Gateway enforces roles, tenant and shipment ownership, and CSRF. **Approve** leaves the active route in place. **Activate** shows the new and current version, distance and time deltas, graph and any truck caveat before confirmation. The active route remains a planning layer. Checkpoints, observed GPS, Cargo events and proofs are independent.

## API, concurrency and cache

The eligible selected shipment reuses C1's throttled request scheduler to read the B3 revision list and active route. Both responses must agree on generation and active ID before controls use them. The list is capped by B3 at 100 revisions. Revision detail and compare fetch on explicit action. Comparison holds two decoded histories, with the B2/B3 bounds enforced per revision. Higher-priority mint remains the current route. The comparison overlays use terracotta dashes and blue dots below mint. Version changes clear stale inspection and comparisons. Selection, session and role changes cancel reads and clear their views.

All writes use the authoritative generation captured when the operator opens the confirmation. The modal and mutation controller exclude double submission. Generation and state conflicts refresh authority and require a new decision. The UI never invokes an automatic mutation retry. [B3 routes and errors](SHIPMENT_ROAD_ROUTES.md)

Each proposal receives a request UUID. An uncertain response keeps that UUID, the exact original B2 request and the original generation in memory. Retry requires a new confirmation and sends the same payload, even if the draft has since changed. An idempotent replay is reported as a recovered proposal. The client never assumes an aborted HTTP request failed to commit. One unresolved proposal is retained per active session. It must be reconciled on its original shipment before starting another. Reload, logout, company switch and role change discard browser memory. After losing that context, inspect server history before resubmitting manually. Unknown approval/activation outcomes refresh the list and active route. They offer no automatic retry.

## Evidence

The private integration uses Chromium with real Dispatcher, Owner and Admin sessions, PostgreSQL and the pinned Valhalla 3.6.3 synthetic road fixture. It exercises a committed proposal whose response is lost, the exact retry, conflicting approval, competing activations, supersession and offline read. It compares the preserved shipment/checkpoints, events, proof list and eligible location before and after the lifecycle. The graph fixture validates integration and distinct car/truck calculations. It does not establish regional coverage or legal HGV clearance.

The browser suite also tests read-only access, ordered comparison, camera layer isolation and viewport widths 1440, 768, 390 and 320 px. [Desktop Light](fleet-map-c3/lifecycle-1440-light.png) · [Desktop Dark](fleet-map-c3/lifecycle-1440-dark.png) · [Mobile Light](fleet-map-c3/lifecycle-390-light.png) · [Mobile Dark](fleet-map-c3/lifecycle-390-dark.png). Captures are synthetic.

Use `TRACKIUM_LIFECYCLE_SCREENSHOTS=/path/to/output node --test tests/minidapp/route-lifecycle.test.cjs` with the existing Chromium tooling to reproduce the captures. The private test runs in the existing Gateway routing workflow. Physical Android acceptance, production topology and geographic coverage remain separate. C3 adds no database migrations or Gateway endpoints.
