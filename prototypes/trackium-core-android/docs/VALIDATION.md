# Prototype validation

## Local automated checks

Environment: Linux cloud workspace, JDK 21.0.13, Gradle 8.11.1 (pinned wrapper SHA), AGP 8.10.1, SDK 36/build tools 35.0.0. Checks run on 2026-11-08.

| Check | Result |
| --- | --- |
| `:app:assembleBlockDebug` | PASS: one universal debug APK, exact pinned Keets bytes checked after packaging |
| `:app:testBlockDebugUnitTest` | PASS: 197 tests, including inherited host lifecycle/IPC/security coverage |
| `:integrated-trackium:testDebugUnitTest` | PASS: 14 tests (9 existing publisher/protocol, 4 adapter boundary tests, 1 locked Activity test) |
| `:minimaapi:testDebugUnitTest` | PASS: 58 SDK routing/direct transport/protocol tests |
| `:core-regression:test` | PASS: 27 tests against the preserved JAR (24 upstream object tests, 2 security regressions, 1 two-process startup/restart test) |
| `scripts/test-keets-artifacts.py` | PASS: 19 tests |
| `scripts/test-keets-preparation.py` | PASS: 9 tests |
| `scripts/verify-prototype.py` | PASS: exact Eurobuddha JAR checksum; imported-file delta report |
| `:integrated-trackium:lintDebug` | PASS: 0 errors, 3 warnings |
| `:app:lintBlockDebug` | **FAIL**: 15 MissingTranslation errors and 7018 warnings in retained host/dependency resources. No lint suppression/baseline or abortOnError bypass added. The 15 errors are app_name and existing host mode/restore/key-use strings missing ru/uk/zh translations. |
| `apksigner verify --verbose --print-certs` | PASS: APK v2 signature, independent CN=Android Debug certificate |
| Merged APK manifest | Prototype ID, API 28 minimum/35 target, no sharedUserId; allowBackup=false; private node service, Trackium Activity and export provider |

The original host uses a separate runtime localisation module; its small app/flavor resource sets still trigger Android lint's missing-translation rules. The branding replacement touches app_name, while the other missing entries are retained upstream resources. These findings remain visible; a broad localisation cleanup is outside this integration.

## Real Android runtime test on a disposable emulator

A fresh **Android 9/API 28 x86_64** AOSP emulator was booted using software emulation (`-accel off`, no KVM). Only the prototype and its instrumentation APK were installed; no BlackBear wallet or external Trackium APK was installed/imported. No physical phone was available.

`TrackiumCoreIntegrationTest` is opt-in and refuses non-emulator hardware, an unexpected package or an existing non-fixture wallet. The fresh phase creates a new disposable seed inside the emulator, never logs it, and configures offline node arguments only in that emulator's private preferences. Production source/default network parameters remain unchanged. Keets is off for this API 28 fixture, matching the upstream runtime limitation. No genesis, signing, mining, proof publication or Mainnet transaction occurs.

Fresh phase: **PASS, 1 test (133.259 seconds)**. It verifies:

- Real host foreground-service node startup and block-as-key-uses/SQL low-RAM flags.
- Actual `EmbeddedCorePort -> DirectNodeApi -> EmbeddedNodeTransport -> node` status read; no mocked backend in this test.
- Preservation of the real offline balance error when there is no chain tip (no fake balance/genesis).
- Pre-dispatch rejection of financial/private/batched commands and admin=false.
- Android Keystore/AES-GCM state written/read via separate SecureStore instances.
- Node-screen button opens the private Trackium Activity in the same package, then returns to host.
- Runtime package manifest separation and disabled backup/private node service/provider.

Restart phase: **PASS, 1 test (116.074 seconds)** on the same fixture after process stop; the public key and encrypted state survive. Final updated-APK restart phase: **PASS, 1 test (105.933 seconds)**, additionally verifying that the native UI displays the observed engine version. The JVM regression independently verifies **clean** node shutdown and two starts with the same database/public key. The Android fixture checks process-stop recovery; neither test signs or reuses a Winternitz leaf.

### Reproduce on a new emulator only

Create a **fresh disposable** API 28 x86_64 emulator with no wallets; choose its explicit serial. Never run this against a real phone or an emulator containing a valued wallet. Do not clear an existing wallet's data to satisfy the fixture. Build/install:

```sh
./gradlew --no-daemon :app:assembleBlockDebug :app:assembleBlockDebugAndroidTest
adb -s emulator-5554 install app/build/outputs/apk/block/debug/app-block-debug.apk
adb -s emulator-5554 install app/build/outputs/apk/androidTest/block/debug/app-block-debug-androidTest.apk
scripts/test-disposable-emulator.sh emulator-5554 fresh
scripts/test-disposable-emulator.sh emulator-5554 restart
```

The script never clears data. Fresh requires SEED_SET=false. Restart requires a marker written only by the successful fresh fixture; it force-stops only this prototype package. The fixture grants host storage permission on API 28 and exempts its foreground service from the disposable emulator's battery restrictions to avoid OS dialogs. This is test setup, not production permission auto-grant code. Native Trackium itself adds no permissions.

The test does not compare/install a BlackBear APK. Separate installation compatibility follows distinct package ID, debug signing/storage/Keystore namespace and no sharedUserId; runtime coexistence with an installed BlackBear and concurrent use of default P2P port 21001 remains a manual acceptance item.

## Still required before smartphone acceptance

- Fresh phone installation, optional PIN/biometric enable/lock/unlock, background limits, force-stop and reboot; inspect system permissions and notification behaviour.
- Real network synchronisation and peer diagnostics with disposable keys; API 29+ Keets testing, RAM/battery measurements.
- Owner-controlled HTTPS Gateway native pairing, tenant isolation and cargos/devices/Proof reads with a dedicated test tenant. No owner tokens in logs/screenshots.
- Wallet backup/recovery and transaction safety review in a separate disposable acceptance plan; no automatic financial actions are implemented here.
- Resolve retained host lint/localisation findings and transitive Keets/native redistribution licence/notice clearance before public distribution.

No public Mainnet, real Gateway pairing, physical tracker or working wallet claim is made by these tests.

## Debug artifact

Final local review artifact: `dist/trackium-core-0.1.0-debug.apk` (ignored by Git; no release upload).

- SHA256: `66ca2ca2d6f13c2265c1827fb6ca478afb37f2ab6334e0261724b328c9299361`.
- Debug signing certificate SHA256: `a2cc47b335637897c9a8ac8ad08ad75f01e31058d8f31c8ae5e3bf660b6fbcca`.
- A fresh local build generates its own debug keystore, so the APK/certificate hash will differ on another machine. Verify your own build rather than treating this as a production signing identity.
