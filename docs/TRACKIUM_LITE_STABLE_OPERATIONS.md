# Trackium Lite operations workspace

## UX audit and changes

Polling reused the manual refresh path. It set a loading flag, inserted a `Refreshing…` row in the document flow, and replaced the main DOM at the beginning and end of each successful fetch. That also destroyed the Leaflet instance. The redesign uses a permanent Gateway status and timestamp in the header. A successful background snapshot reconciles existing DOM records by stable identifiers and updates only changed map layers. Search inputs, selection, scroll, dialogs, expanded details and viewport belong to the current view. An authorization failure still clears protected data. Polling pauses on hidden pages and revalidates on return.

| Screen | Workspace hierarchy | Existing contract |
| --- | --- | --- |
| Overview | Company heading, distinct operational metrics, large map, active work and recent activity | Cargo summary and tenant device list |
| Shipments | Search and filters, route and recorded checkpoint progress, linked actions | Existing shipment lifecycle, route editor and approval dialogs |
| Devices | Scannable device list with source, measurement and observation state | Tenant device, history and enrollment APIs |
| Physical Device Lab | Receipt and measurement separated, map/history, signals and diagnostic details | Existing bounded diagnostics, history and export |
| Map | Real Leaflet map, shipment/device selector and distinct route and position layers | Planned checkpoints and eligible reported positions |
| Events | Timeline and highlighted alerts with source and links | Existing immutable cargo events |
| Proofs | Integritas status, verification, export, technical details | Existing Integritas and evidence endpoints. TEST_ONLY is explicit. Native proof history stays read-only in Lite |
| Settings | Appearance, company access and existing connection or notification settings | Existing customer roles and session actions |
| Login | Approved branding, sign-in first, company entry paths below | Existing password/user identifier, pairing and recovery |

DS1 supplies color and theme tokens. Icons are inline, authored SVG. The workspace has no dependency on a new graphics service. Charts and progress are backed by returned records. A registered tracker with no observations shows unavailable data. Physical provenance remains unverified. The map performs no road routing.

## Before and after

Chromium screenshots use the same local PostgreSQL-backed Physical Pilot fixture with a registered GL110-GL and no physical samples. The 390 px captures are browser phone viewports.

| Screen | Width | Before | After |
| --- | ---: | --- | --- |
| Overview | 1440 | [Before](lite-stability/before/dashboard-1440.webp) | [After](lite-stability/after/dashboard-1440.webp) |
| Shipments | 1024 | [Before](lite-stability/before/shipments-1024.webp) | [After](lite-stability/after/shipments-1024.webp) |
| Devices | 768 | [Before](lite-stability/before/devices-768.webp) | [After](lite-stability/after/devices-768.webp) |
| Physical Device Lab | 390 | [Before](lite-stability/before/device-lab-390.webp) | [After](lite-stability/after/device-lab-390.webp) |
| Map | 1440 | [Before](lite-stability/before/map-1440.webp) | [After](lite-stability/after/map-1440.webp) |
| Events | 768 | [Before](lite-stability/before/events-768.webp) | [After](lite-stability/after/events-768.webp) |
| Proofs | 1024 | [Before](lite-stability/before/proofs-1024.webp) | [After](lite-stability/after/proofs-1024.webp) |
| Settings | 320 | [Before](lite-stability/before/settings-320.webp) | [After](lite-stability/after/settings-320.webp) |
| Login | 390 | [Before](lite-stability/before/login-390.webp) | [After](lite-stability/after/login-390.webp) |

## Verification and rollout

Run Gateway `npm test` and `npm run test:integration` in `services/gateway` with a disposable PostgreSQL database. Run `node --test --test-concurrency=1 tests/minidapp/*.test.cjs tests/minidapp/server.integration.cjs` from the repository root with the same test database and the Playwright/Chromium dependencies. The Android commands are `apps/android/gradlew -p apps/lite-android :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest` and the offline emulator steps in the APK workflow.

Review PR #89 first, then retarget this change to main if required. No database migration or API version change is needed. Roll out the Web assets together so the polling callbacks and renderers use the same version. The Android build can follow. Its WebView uses a bounded resume authorization check with updated Web assets and falls back to a full reload with older assets. A Web rollback restores the previous static asset bundle. Review Android debug signing compatibility before installing over an earlier build. Keep application data intact if package signatures differ.

### Manual acceptance

- [ ] Sign in with an authorized account. Verify the expected company, role, devices and shipment access before testing other views.
- [ ] At 320, 390, 768, 1024 and 1440 px, check navigation, dialogs, tables, focus, zoomed text and Light, Dark and System themes.
- [ ] Focus a filter, scroll, pan the map and open a popup. Let polls complete before and after a real record change. Confirm stable focus, scroll and viewport.
- [ ] Disconnect and reconnect. Check the Gateway status and protected workspace reauthorization. Revoke the session while the application is away, then verify protected information stays hidden on return.
- [ ] In the GL110-GL lab, compare Gateway receipt and device UTC measurement. For a registered device without packets, check that GPS and readings remain unavailable.
- [ ] Verify a TEST_ONLY Integritas proof and export the evidence. On Android, save with the system picker and reopen the JSON. Cancel a second export.
- [ ] On Android, check launch, cutout and system bars, keyboard and rotation. Open a dialog and use Back, then background and resume the workspace. Retry after losing the network. Verify logout and cross-company denial.
