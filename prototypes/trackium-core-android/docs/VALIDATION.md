# Validation — stage 2

Local environment: Linux, JDK 21.0.13+9, Gradle 8.11.1 with retained distribution checksum, AGP 8.10.1, Android SDK 36/build-tools 35.0.0. Debug version 0.2.0 / code 2. Run `scripts/ci-debug.sh` on committed clean source to reproduce the checks and provenance artifact bundle. No second concurrent Gradle test invocation is used.

## Current local results

| Check | Result |
| --- | --- |
| Independent root extraction | PASS: initial tracked root tree matches PR #12 subtree `9186657ce49ca0476119f1c5c7836c33e37e0fca` exactly |
| Source/engine/wrapper/download/tool/manifest pins | PASS, no engine or native pin substituted |
| Captured licence evidence | PASS within recorded scope; release_blocked=true, --release refuses unresolved rights |
| app:testBlockDebugUnitTest | PASS: 197 tests |
| integrated-trackium:testDebugUnitTest | PASS: 14 tests |
| minimaapi:testDebugUnitTest | PASS: 58 tests |
| localization:testDebugUnitTest | PASS: 12 tests |
| integrated-history:testDebugUnitTest | PASS: 19 tests |
| core-regression:test | PASS: 27 tests against the exact shipped engine JAR |
| maxima-core:test | NO-SOURCE: module retained, no test sources |
| Python Keets artifact/preparation tests | PASS: 19 + 9 |
| Python source/legal manifest guard regressions | PASS: 5 |
| app:assembleBlockDebug / final Keets APK verification | PASS, real one-APK host + integrated Trackium |
| app:lintBlockDebug | PASS: **0 errors**, 7018 warnings. All 15 previous MissingTranslation errors fixed with actual ru/uk/zh main/flavor translations |
| integrated-trackium:lintDebug | PASS: 0 errors, 3 warnings |
| APK signature and package | PASS: v2 signature, Android Debug identity; package tech.trackium.core.prototype, debuggable; generated key excluded from artifacts |
| APK native page-size inspection | 21 ARM64 libraries have >=16-KiB PT_LOAD alignment; 2 retained libraries have 4-KiB alignment. 16-KiB-device acceptance blocked |

Total: **327 JVM/Robolectric + 33 Python tests**. Build evidence JSON records actual commit/JDK/run/APK/certificate hashes and test/lint totals. Do not manually copy a previous build hash into a new run's evidence. See CI_DEBUG_APK.md for Actions download and clean-source export rules. The source is ready for controlled phone testing, not phone-tested or public release-ready.

## What the tests establish

- Original host lifecycle/IPC/authentication tests and SDK routing/direct-transport tests remain intact.
- Trackium adapter rejects financial/private/parameterised/batched commands, background/locked/wrong-host access and late results after lock. Locked Activity avoids rendering encrypted/cached state.
- Shipped engine tests retain synchronized signing/counter boundaries and privileged transaction inspection/write classification. OfflineNodeProbe verifies refusal to overwrite an unsigned scratch transaction as non-ADMIN without signing/mining/posting anything.
- Two isolated JVM starts use the same disposable database and public key, validate block-as-key-uses/SQL low-RAM flags and complete clean shutdown. No peers/RPC/Mainnet publication or working wallet is involved.
- History and localisation regression suites now also run in the common CI script.
- Source/legal guards detect bad/missing checksums, unsafe paths and unresolved release clearance. They do not certify every transitive native licence or a full software supply-chain audit.

## Preserved prototype #1 Android-runtime evidence

PR #12's 0.1.0 prototype passed an opt-in disposable software Android 9/API 28 x86_64 emulator test: fresh phase 133.259 s, process-stop restart 116.074 s, final updated-APK restart with native UI engine-version assertion 105.933 s. That exercised actual host-service node, EmbeddedCorePort → DirectNodeApi → EmbeddedNodeTransport, private native navigation, forbidden-command refusal, Android Keystore state and public-key recovery. The offline chain correctly rejected balance when no tip existed.

Those historical runs are not relabelled as physical-phone or new stage-2 runtime tests. Node/adapter implementation is unchanged in stage 2; only translated resources/version/build/CI/docs/legal evidence changed. Stage-2 phone execution, API 29+ Keets, Mainnet synchronisation, live Gateway pairing and OEM background/reboot behaviour remain NOT RUN pending PHONE_ACCEPTANCE.md.

To rerun existing opt-in instrumentation on a **new disposable emulator only**:

```sh
./gradlew --no-daemon :app:assembleBlockDebug :app:assembleBlockDebugAndroidTest
adb -s emulator-5554 install app/build/outputs/apk/block/debug/app-block-debug.apk
adb -s emulator-5554 install app/build/outputs/apk/androidTest/block/debug/app-block-debug-androidTest.apk
scripts/test-disposable-emulator.sh emulator-5554 fresh
scripts/test-disposable-emulator.sh emulator-5554 restart
```

The fixture refuses real hardware, unexpected package or existing non-fixture wallet; it never clears data. Do not use it on a physical phone. No automated phone connection, Gateway credentials, boot-port override, production seed, wallet migration, funds transfer or Mainnet transaction occurs in CI. The parent PR/source remain intact until actual target-repository migration and CI are verified.
