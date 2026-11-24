# Trackium Lite for Android

Issue #86. An independent Android application, `tech.trackium.lite`, for the first-party HTTPS Lite workspace. It uses the approved DS1 logo, premium Web interface and Light/Dark/System. Android 9 or later and an updated Android System WebView are required. There are no linked Cargo/Core modules, Minima node, wallet, tokens or embedded credentials.

## Architecture and security review

The WebView is the presentation host. The production Gateway serves the existing UI and owns HTTPS sessions, username/password login, CSRF, tenant authorization and the proof contract. This keeps the same Dashboard, Shipments, Devices, Lab, Leaflet map, Events, Integritas, company settings and in-workspace notifications. There is no separate mobile account DB or duplicate telemetry engine. The APK loads the version actually deployed at the Gateway. A GitHub merge or APK upgrade does not deploy Web changes.

| Draft finding | Review implementation |
| --- | --- |
| A main-frame policy also allowed API/assets, resource paths were broader than necessary, and foreign HTTPS was the only blocked resource class | Separate policies permit only the exact HTTPS Lite document and its known fragments for main navigation, plus the actual `/app/assets/` and `/v1/` resource mounts. Block external links/windows, Core and unexpected schemes. Cancel TLS and Safe Browsing errors. Service worker network loads are disabled. |
| Errors could replace the WebView with synthetic HTML, and Back/history and state had no stale-session handling | Native retry view hides tenant UI on top-level network/HTTP/TLS/renderer failures. After returning from background, the document reloads with first-party cookies and Gateway session validation. Raw WebView history/forms are not written to saved Activity state. Android Back closes a dialog/drawer, then navigates only within Lite. Foreground SPA connectivity, expiry and logout still use the existing Gateway flow. |
| Blob downloads ended at a placeholder toast | Both authenticated export actions send the already authorized JSON to a main-frame, exact-origin AndroidX WebMessage listener. It accepts only known evidence shapes with a 5 MiB UTF-8 bound, picks a fixed filename and opens Android's document picker. There is no generic bridge, filesystem path, export URL, native cookie read or secret retrieval API. Cancelling drops the pending payload. The browser download path stays available. |
| No Android fit/appearance acceptance | System bar, cutout and IME insets are applied on modern Android. The older platform uses its normal decor and resize handling. Rotation preserves the WebView and the DS1 preference remains first-party browser storage. No Android push service, location permission or native wallet/publisher UI is added. |

File/content navigation and uploads are disabled. Android backup and WebView debugging are disabled, including in the review APK. First-party sandboxed cookies stay within this app. TLS uses Android trust and normal Gateway certificates. The APK rejects unexpected redirects and no override is provided for TLS errors.

Native file export requires the Web JavaScript from this PR to be served after separate authorized rollout. Older production versions can display the legacy proof text fallback, and the existing browser can download JSON. A local Chromium check confirmed the existing strict CSP rejects using page fetch to recover stale `blob:` downloads. The app does not weaken that policy. The public Gateway was checked without any account credentials for the premium CSS and username login page only.

## Build and verify

From the repository root, using JDK 21, SDK platform 36 and build tools 35.0.0:

```sh
apps/android/gradlew -p apps/lite-android --no-daemon \
  :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest
```

The [Lite Android Debug APK workflow](../../.github/workflows/lite-android-debug.yml) checks out the PR head, writes the exact source SHA, APK digest, package badging and certificate details in the `trackium-lite-android-debug` artifact, then runs Android instrumentation in an offline emulator. Its artifact is debug-signed with a runner-specific certificate. Compare package ID, certificate and versionCode before installing over another Lite build. Certificates from different runners or local debug builds usually cannot update one another. Use a fresh emulator or test user/profile when the certificate differs. No production key or store release is included. Do not uninstall or clear existing Lite, Cargo or Core data to test this artifact.

- JVM tests cover the real Lite/resource paths, lookalikes, schemes and bounded JSON routing.
- Instrumentation covers Android's actual APK identity, JSON handling, offline retry, rotation and WebView setting isolation. The job explicitly disables emulator networking before opening the app. It does not authenticate to production.
- Gateway/Chromium tests use disposable PostgreSQL and exercise normal auth, tenant isolation, expiry, fixture transfer with empty pilot position/history, map/Device Lab and exact Integritas/diagnostic JSON dispatch. The Chromium message receiver is a test double and cannot establish Android SAF behavior.

## Manual Android acceptance

1. Verify/install the debug artifact and open Lite. Enter the separately supplied password on the established HTTPS sign-in page as `trackium-demo`. Do not capture or share it. Confirm `Trackium Physical Pilot` and Owner in Settings.
2. Verify the authorized GL110-GL in Devices and open Device Lab. With no fresh observations, the position stays unavailable and the original tenant's history is absent. Check the map and selected period without expecting synthetic fallback.
3. Check shipments, route editing, device views, filters/cursors, local notifications where enabled, Settings, all three themes, tap targets and keyboard behavior.
4. Check Integritas TEST_ONLY verification and use Android's picker to save a proof and a diagnostic export once the compatible Web release is served. Cancel once and confirm no file is created. Verify the exported file locally before sharing it.
5. Try Back from modal, drawer and page history, then rotate during an authenticated view. Test outage/retry, leaving and returning to Lite, session expiry and logout. Confirm the company data disappears after loss of authorization. Verify external URLs and uploads are blocked.

Production account access, the actual GL110-GL, hosted app networking on Android and real document-picker save need runtime acceptance separate from Chromium tests. Mainnet, production deploy, tracker configuration and existing Android apps are outside this change.
