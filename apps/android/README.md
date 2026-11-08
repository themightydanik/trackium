# Trackium Cargo Android

Native BlackBear 2.2.10 integration. Installation, exact dependency/source pins, security prerequisites, Gateway setup and limitations: [ANDROID_MINIMA_CORE.md](../../docs/ANDROID_MINIMA_CORE.md).

```sh
./gradlew :app:testDebugUnitTest :minimaapi:testDebugUnitTest :app:assembleDebug
```

Requires Android SDK 36/build-tools 35.0.0 and JDK 17+ (21 tested). APK: `app/build/outputs/apk/debug/app-debug.apk`. Evaluation debug build; no real wallet/Mainnet tests performed. Do not enable live publication with untrusted Core apps or wallet clones. SDK source is vendored with Apache-2.0 attribution in `minimaapi/SOURCE.json` and `minimaapi/LICENSE`.

## Download and install without Android Studio

The [Android Debug APK workflow](https://github.com/themightydanik/trackium/actions/workflows/android-debug.yml) runs on PR updates affecting `apps/android/**` or the workflow itself. It also supports **Run workflow** with branch `feat/minima-proof-engine`. GitHub normally exposes manual dispatch only once the workflow is registered on the default branch; a newly added workflow can still run through the PR event, subject to repository Actions policy and fork approval. Do not merge just to enable manual dispatch.

Open a successful run → **Artifacts** → **trackium-android-debug** (GitHub sign-in may be required). Download and extract its ZIP. It contains `trackium-cargo-debug.apk`, `SHA256SUMS`, `BUILD_INFO.txt` with the exact checked-out commit, and `APK_BADGING.txt` read from the actual APK. Artifact retention is 14 days. PR builds check out the PR **head** commit, rather than an implicit merge commit. Compare the checksum from your download; different CI/local builds or fresh debug signing keys can produce different APK hashes.

Transfer the APK to an ordinary **Android 9+** phone, open it in the phone's file manager/browser and allow **Install unknown apps** for that source when Android asks. Install **Trackium Cargo**. Android Studio, a developer account and USB debugging are not required. Alternatively use `adb install trackium-cargo-debug.apk` from a computer with platform-tools. Package: `tech.trackium.cargo`; `minSdk=28`, `targetSdk=36`; no ABI-specific native libraries are bundled. OS/OEM or enterprise policy can still block sideloading.

Install the separately reviewed BlackBear 2.2.10 release, start/synchronize Core, register Trackium, grant Enable + ADMIN in Core Apps, then reconnect. Keep live/Mainnet switches disabled for initial discovery, permission, wallet observation and Gateway pairing tests. Device IPC, lifecycle and real signatures still require physical testing; no Mainnet transaction is run in CI. Only trusted enabled Core apps (including READ apps) and a single wallet instance are acceptable. See the full security and recovery instructions linked above before any publication.

This is a debug-signed evaluation APK. Each clean CI runner generates its own normal Android debug signing key; no signing key/keystore, API credentials or wallet is supplied, uploaded or committed. A later APK signed with another debug key may fail to update an installed copy. **Do not uninstall or clear data to force an update when a publication is unresolved**; preserve checkpoints and investigate. A stable release-signing/update process remains future work.

If GitHub Actions/API access is unavailable, build locally with **JDK 21**, Android command-line tools and `ANDROID_HOME` set to your SDK:

```sh
sdkmanager 'platforms;android-36' 'build-tools;35.0.0'
# Accept SDK licenses interactively if not already accepted.
sdkmanager --licenses
cd apps/android
./gradlew --no-daemon :app:testDebugUnitTest :minimaapi:testDebugUnitTest :app:assembleDebug
sha256sum app/build/outputs/apk/debug/app-debug.apk
git rev-parse HEAD
```

The CI workflow uses read-only repository permissions and pinned action revisions, with no browser/owner credentials, seed or Mainnet RPC access. It uploads an APK only after both unit-test tasks and assembly succeed.
