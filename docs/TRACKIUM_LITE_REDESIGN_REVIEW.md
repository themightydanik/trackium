# Trackium Lite redesign review

Baseline is PR #90 at `74ecd2a`, after the original polling stabilization. The earlier [stability audit](TRACKIUM_LITE_STABLE_OPERATIONS.md) documents the DOM and Leaflet churn. This pass changes the composition of the shared Lite workspace. The APK continues to load that workspace in its existing HTTPS WebView.

## Visual audit

The previous overview placed an evenly weighted KPI strip above the map and repeated the shipment cards below it. The new dispatch surface puts the geographic view beside an operational brief with counts and a lifecycle breakdown. The lower board summarizes active departures and recent events. Shipments are organized as a manifest with separate identity, checkpoint diagram and action areas. The device inventory groups sensor columns on phones. The map keeps its controls and device directory next to the canvas on wide screens. The event register surfaces warnings above the searchable chronology. Proofs show recorded test-evidence steps and keep identifiers behind a disclosure. Company settings and appearance/connection have separate groups. The sign-in view and empty states use authored local SVG illustrations.

Diagrams use only the records already loaded by the Gateway client. Shipment counts describe the returned page. Stops indicate planned or reached; measured points retain their provenance. Telemetry plots use discrete dated samples, including genuine zeros. An unavailable reading has no plotted point.

## Matched screenshots

The populated views use the same authenticated Chromium fixture and explicitly synthetic shipment, sensor history, events and TEST_ONLY proofs in both checkouts. These records are test-only and the screenshot harness never writes them to a Gateway. Login and the empty Physical Device Lab were captured in the local PostgreSQL-backed pilot browser scenario. The 390 px images are responsive browser views.

| View | Desktop before | Desktop after | Phone before | Phone after |
| --- | --- | --- | --- | --- |
| Overview | [Before](lite-redesign/before/dashboard-1440.webp) | [After](lite-redesign/after/dashboard-1440.webp) | [Before](lite-redesign/before/dashboard-390.webp) | [After](lite-redesign/after/dashboard-390.webp) |
| Shipments | [Before](lite-redesign/before/shipments-1440.webp) | [After](lite-redesign/after/shipments-1440.webp) | [Before](lite-redesign/before/shipments-390.webp) | [After](lite-redesign/after/shipments-390.webp) |
| Devices | [Before](lite-redesign/before/devices-1440.webp) | [After](lite-redesign/after/devices-1440.webp) | [Before](lite-redesign/before/devices-390.webp) | [After](lite-redesign/after/devices-390.webp) |
| Device detail | [Before](lite-redesign/before/device-detail-1440.webp) | [After](lite-redesign/after/device-detail-1440.webp) | [Before](lite-redesign/before/device-detail-390.webp) | [After](lite-redesign/after/device-detail-390.webp) |
| Sensor history | [Before](lite-redesign/before/sensor-charts-1440.webp) | [After](lite-redesign/after/sensor-charts-1440.webp) | [Before](lite-redesign/before/sensor-charts-390.webp) | [After](lite-redesign/after/sensor-charts-390.webp) |
| Physical Device Lab | | | [Before](lite-redesign/before/device-lab-390.webp) | [After](lite-redesign/after/device-lab-390.webp) |
| Map | [Before](lite-redesign/before/map-1440.webp) | [After](lite-redesign/after/map-1440.webp) | [Before](lite-redesign/before/map-390.webp) | [After](lite-redesign/after/map-390.webp) |
| Events | [Before](lite-redesign/before/events-1440.webp) | [After](lite-redesign/after/events-1440.webp) | [Before](lite-redesign/before/events-390.webp) | [After](lite-redesign/after/events-390.webp) |
| Proofs | [Before](lite-redesign/before/proofs-1440.webp) | [After](lite-redesign/after/proofs-1440.webp) | [Before](lite-redesign/before/proofs-390.webp) | [After](lite-redesign/after/proofs-390.webp) |
| Settings | [Before](lite-redesign/before/settings-1440.webp) | [After](lite-redesign/after/settings-1440.webp) | [Before](lite-redesign/before/settings-390.webp) | [After](lite-redesign/after/settings-390.webp) |
| Sign-in | | | [Before](lite-redesign/before/login-390.webp) | [After](lite-redesign/after/login-390.webp) |

Run `node tests/minidapp/capture-lite-redesign.cjs <checkout> <output-dir>` with Chromium and Playwright available. For the two pilot screens use `TRACKIUM_PREMIUM_SCREENSHOTS=<output-dir> node --test --test-name-pattern='Closed demo' tests/minidapp/server.integration.cjs` with disposable PostgreSQL.

## Original brief acceptance matrix

| Requirement | Implementation and evidence | Open acceptance |
| --- | --- | --- |
| Architecture, DS1, screen audit and polling root cause | Shared WebView shell and Gateway contracts reviewed. [Stability audit](TRACKIUM_LITE_STABLE_OPERATIONS.md) and this comparison cover both passes | Visual approval |
| Refresh without layout shifts | Retains focus, scroll, open dialog, filter and Leaflet viewport. Browser tests cover changed and unchanged polls, hidden tab, offline and reconnect | Authenticated Android resume and session revoke on a phone |
| Premium design, hierarchy, iconography and empty states | DS1 Light/Dark/System, authored SVG, visual route and proof sequences, lifecycle bars, discrete plots and illustrated login/empty states | Visual approval in each theme |
| Navigation and information architecture | Seven existing sections with handset quick navigation and drawer. Settings group appearance and connection separately | TalkBack traversal |
| Overview | Map, loaded fleet counts, lifecycle, dispatch board and recent event links | Visual approval on tenant with a larger dataset |
| Shipments | Manifest, filters, planned checkpoints, recorded progress, linked device and existing editor/confirmations | |
| Devices | Fleet counts, compact sensors, trust and timestamps, enrollment and available history | |
| Physical Device Lab | Device-to-Gateway flow, receive and measurement data, diagnostics, range filter, map and export. PostgreSQL browser scenario covers both empty and received-packet states | GL110-GL field acceptance |
| Map | Leaflet canvas, selector, device directory, planned route and position legend, popup and stable viewport | Road routing belongs to Issue #88 |
| Events / Alerts | Warning counts and visual highlight, searchable chronology, event/device/shipment links and delivery state | |
| Proofs | Integritas TEST_ONLY, recorded steps, verification, export and technical details. Existing native history access preserved | Live chain acceptance outside this change |
| Company / Settings | Existing membership, roles and sessions, appearance and optional notification controls. Pairing settings show connection and technical details separately | |
| APK experience | Same responsive workspace, existing shell identity, scoped HTTPS, rotation and offline instrumentation. Browser E2E checks bridge payloads | Real phone sign-in, Back/gestures, cutout, keyboard, foreground recovery and actual system picker |
| Access, data and security | No schema or API migration. PostgreSQL and Chromium exercise roles, CSRF, company isolation, evidence and empty pilot. No synthetic injection into product workspace | |
| Accessibility and responsiveness | Chromium checks 320/390/768/1024/1440, all themes, keyboard and 200% on the seven primary routes. Reduced-motion preferences used for captures | Manual contrast and TalkBack validation across all dialogs |
| Functional and visual regression | Gateway unit, PostgreSQL integration, Chromium/MiniDapp, Android unit and instrumentation. Matched captures above | Physical and authenticated Android scenarios above |
| Delivery / rollback | Review #89 first. Apply the complete static asset bundle together. Restore the previous bundle to roll back. APK retains its package and sign-in contract | Operator approval before deployment |

Use the [manual Web and Android checklist](TRACKIUM_LITE_STABLE_OPERATIONS.md#manual-acceptance) with the review build.
