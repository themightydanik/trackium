# Trackium Core Android — prototype #1

One APK containing the BlackBear-derived Minima node and the existing native Trackium UI, integrated through Pandamonium's internal library API. Technical debug prototype; no public release or migrated wallet. Application ID: `tech.trackium.core.prototype`, version `0.1.0` (code 1).

This directory is a **standalone project** staged in `themightydanik/trackium` because `themightydanik/trackium-core-android` was unavailable when checked. Move the entire directory, including `gradle/`, `scripts/`, `sources.lock.json`, `LICENSE`, and notices, to the root of that repository when it is created. No sibling Trackium/Gateway build is required. Do not copy generated keystores, local.properties, build outputs or SDKs. No new public repository or release is created by this change.

## Build

Install JDK 21, Python 3, an Android SDK with platform 36/build-tools 35.0.0/platform-tools, and accept the Android SDK licences. Set `JAVA_HOME` and `ANDROID_HOME` for your machine (or ignored `local.properties` with `sdk.dir=...`).

```sh
./gradlew --no-daemon :app:assembleBlockDebug
./gradlew --no-daemon :app:testBlockDebugUnitTest :integrated-trackium:testDebugUnitTest :minimaapi:testDebugUnitTest :core-regression:test
./gradlew --no-daemon :app:lintBlockDebug :integrated-trackium:lintDebug
python3 scripts/verify-prototype.py
```

Gradle downloads the pinned wrapper/dependencies. Keets preparation downloads the pinned Node build tool, source and bare-kit artifacts into `KEETS_CACHE_DIR` (default Gradle home) and verifies their checksums. TLS certificate verification remains enabled; on a corporate proxy, trust the organisation CA in your local Java/Node stores, never disable TLS checks or commit a CA/private key. `--offline` requires a populated cache. Existing Keets verification is also run against the packaged APK.

Only `blockDebug` is enabled. A local debug keystore is generated in ignored `.local/`; its standard Android debug passwords are not production credentials. It is independent of BlackBear's production signing keys. No release signing configuration is supplied. ABIs: arm64-v8a, armeabi-v7a and x86_64 (the pinned Keets native artifact set); no unsupported x86.

Output: `app/build/outputs/apk/block/debug/app-block-debug.apk`. Keets makes the universal debug APK roughly 220 MB. It requires Android 9/API 28 or later. On API 28 the upstream runtime guard disables Keets, leaving the classic node transport; block key mode and low-RAM storage remain enabled. API 29+ Keets runtime/device compatibility still needs acceptance tests.

## Install and use

Use a disposable emulator or a test phone with **no funds**. Verify the downloaded APK checksum and signature before installing:

```sh
apksigner verify --verbose --print-certs app/build/outputs/apk/block/debug/app-block-debug.apk
adb -s YOUR_TEST_SERIAL install app/build/outputs/apk/block/debug/app-block-debug.apk
adb -s YOUR_TEST_SERIAL shell am start -n tech.trackium.core.prototype/com.eurobuddha.minimacore.StartActivity
```

Create a new disposable wallet in the host onboarding. Do not import BlackBear keys, seed phrases, wallet databases or production backups. The new package has its own UID/storage; Android does not replace BlackBear or the standalone `tech.trackium.cargo` APK. There is no sharedUserId or automatic import. Verify the package ID in Android's install dialog.

The initial **Trackium Core / Node** screen shows the node, network/synchronisation observations and upstream settings. Tap **Open Trackium** or its toolbar menu item. Trackium opens as a private native Activity in this same APK. Its Dashboard/Core screens observe the embedded node; errors while starting, stopped or locked require an explicit retry. Returning to the host leaves the node's foreground service running. Optional host PIN/biometric lock and screenshot protection apply to Trackium too.

Gateway settings start empty. To test business data, use an existing HTTPS Gateway and its established tenant/owner-controlled native pairing flow; review the displayed origin and scopes before confirming on the owner side. Tokens are stored through the reused Android Keystore/AES-GCM `SecureStore`, not in URLs, logs or source. Do not paste owner provisioning credentials into screenshots/issues. Trackium can read existing cargos/devices/Proof records after pairing; no AOVX readings are fabricated. No Gateway, Railway or PostgreSQL changes are needed or included.

Proof wallet publication, signed job reservation, address creation and all financial commands are unavailable in this prototype, including after enabling any saved standalone-client setting. Wallet/backup tools remain in the trusted host UI; do not use them with real funds for prototype acceptance.

**Coexistence limit:** installation/data are isolated from BlackBear, but both retain BlackBear's existing default P2P port 21001. Do not run both nodes simultaneously with default ports. Stop the other test node first; a collision should show the upstream diagnostic. This change intentionally does not alter network parameters.

## Validation and limitations

See [architecture](docs/TRACKIUM_CORE_ARCHITECTURE.md), [reuse/security/licences](docs/REUSE_AND_ENGINE_REVIEW.md), [test instructions and evidence](docs/VALIDATION.md) and [source pins](sources.lock.json). Smartphone, public Mainnet sync, physical tracker ingestion, wallet spending/recovery and production Gateway acceptance remain separate stages. A successful build or offline node test does not establish those properties.
