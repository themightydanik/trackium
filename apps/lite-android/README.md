# Trackium Lite — Android shell (review preview)

Issue #86. A **separate Android app** with application ID `tech.trackium.lite`, not the native BlackBear companion (`tech.trackium.cargo`) and not the integrated Minima node (`tech.trackium.core.prototype`). Its source is in `apps/lite-android` with isolated Gradle settings. Existing Cargo/Core projects are untouched.

The entry point is the existing **production HTTPS Lite workspace**:
`https://trackium-gateway-production.up.railway.app/app/`. The current premium DS1 UI, shipment flows, devices/Physical Device Lab and the Leaflet map are rendered by the live Gateway **only after** the premium Lite Web changes from PR #87 are separately deployed to Railway Production. A GitHub merge by itself does not update the running Gateway. The app asks users to **type their own** customer credentials on the server's sign-in page; it does not contain any password, account ID, tenant ID, OAuth token or private key. WebView first-party cookies use Android's sandboxed app storage. The server is authoritative for session expiry, membership, CSRF, and all company data; an Android package alone does not bypass these controls.

## Security boundaries

- Only the expected HTTPS host and Lite/asset/API paths are allowed. No third-party cookie access, mixed HTTP content, native JavaScript bridge, file/content access, geolocation permission, wallet RPC, embedded Minima node or arbitrary external navigation.
- User app data does not share a sandbox with Cargo or Core. Android backup is disabled.
- The Web Gateway is online-only. Native WebView state does not imply tracker connectivity or real GPS. With no SIM, GL110-GL should appear as a device with unavailable position and zero new pilot observations. There is no cross-tenant transfer of the 196 pre-cutover historical observations.
- **Known functional gap:** Android WebView's `blob:` proof exports and downloads are not implemented here. A toast explicitly reports the limitation; do not claim full Proof export parity yet. The existing browser-based Lite export remains available. Native download handling must be implemented safely and tested in a separate PR update, not by giving a generic JavaScript bridge access to cookies/credentials. Native file upload and notification parity are also not proven.
- Production company sign-in and device view are **not verified** by these source changes. A human operator must verify the actual account on an Android phone/emulator without sharing credentials or logging them.

## Build

The GitHub Actions [Lite Android Debug APK](../../.github/workflows/lite-android-debug.yml) workflow checks out the exact PR head commit, runs Java unit tests and assembles a debug-signed APK. Download the artifact `trackium-lite-android-debug`, unpack `trackium-lite-debug.apk`, and verify its SHA256SUMS. Android Studio is not required to install a debug APK.

Local: use JDK 21, Android SDK 36, build-tools 35.0.0 and from repository root run:

```sh
apps/android/gradlew -p apps/lite-android --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

The wrapper is reused **only as a build tool**, not as a module dependency. This project does not link or ship native MinimaAPI. A separate debug signing key may prevent a clean update over an older debug build. Do not clear Core/Cargo app storage or import a wallet to test Lite.

## Acceptance still required

1. CI installable artifact, APK signature and policy tests.
2. Android emulator/physical phone login as `trackium-demo` using a privately entered new password; verify `Trackium Physical Pilot` Owner and enrolled GL110-GL.
3. Check all Lite tabs, interactive map controls, Device Lab refresh/history, no GPS without received physical packets, navigation/back, safe-area/mobile layout, Light/Dark/System, network outage and session expiry.
4. Implement and verify secure proof JSON exports and any user-file upload workflows; notifications must be scoped and permissioned.
5. Confirm logout/revocation wipes active rendered tenant data and no cross-tenant records are accessible. Run independent instrumented UI tests; JVM URL-policy tests alone do not establish this.
6. Resolve release-signing, distribution/licence review and long-term origin configuration before any user-facing release.

**No Mainnet action, tracking command, production deploy, real phone claim or release approval is part of this branch.**
