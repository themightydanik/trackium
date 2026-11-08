# Reproducible debug procedure and Actions artifact

Run `scripts/ci-debug.sh` from a **committed, clean checkout** using JDK 21.0.13+9, Android SDK 36/build tools 35.0.0, Python 3, curl, tar, unzip and the pinned Gradle wrapper. Set JAVA_HOME/ANDROID_HOME; a writable `KEETS_CACHE_DIR` is optional. The script runs all six modules with test sources, the Java Maxima module (currently NO-SOURCE tests), 33 Python tests, source/checksum/legal evidence checks, host/Trackium lint, assembly, final native APK verification and v2 signature checks. It copies only the verified output and safe metadata into ignored `dist/`.

The workflow `.github/workflows/trackium-core-debug.yml` works at standalone root and, temporarily, in the original Trackium repository. It detects `settings.gradle` at root or `prototypes/trackium-core-android`. The identical workflow is staged at the parent repository root solely to validate migration and provide a downloadable artifact while the target repository is unavailable. It never deploys the Gateway or changes its workflow.

## Download

1. Open repository **Actions → Trackium Core debug APK**. Select a **successful** run for the intended branch/PR and verify its source commit. For the temporary host, use `themightydanik/trackium`, branch `feat/trackium-core-android-stage2`; the workflow is already inside the standalone source for relocation.
2. Download **trackium-core-debug-RUN_ID** from that run's Artifacts section (GitHub sign-in may be required). Retention is 14 days; artifacts are not GitHub Releases. Do not use an artifact from a cancelled/failed/unknown commit.
3. Unzip: `trackium-core-debug.apk`, `SHA256SUMS`, `apk-signature.txt`, `build-evidence.json`, `license-audit.json`. Verify SHA256 and the certificate with local Android build tools. Compare the source/run provenance and actual package ID `tech.trackium.core.prototype`.

```sh
gh run list --repo themightydanik/trackium --branch feat/trackium-core-android-stage2 --workflow trackium-core-debug.yml
gh run download RUN_ID --repo themightydanik/trackium --name trackium-core-debug-RUN_ID --dir /path/to/new/review-folder
cd /path/to/new/review-folder
sha256sum -c SHA256SUMS
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs trackium-core-debug.apk
```

After relocation substitute `themightydanik/trackium-core-android` and its branch. Each download should go to a new review folder. Expired artifacts require a new run, not a public Release.

## Identity, supply chain and scope

Actions and JDK patch are pinned; Gradle wrapper distribution/hash, the Android engine and Keets source/toolchain/native outputs retain checksum guards. Captured npm lock entries have registry URL/SRI checks and licence declarations; collected licence files are independently hashed. Maven coordinates are versioned but this project does **not** claim a complete independent Gradle dependency-verification/SBOM or native binary reproducibility attestation.

The runner generates a new standard Android **debug** key under ignored `.local/`, uses it only for this build and deletes it in an always-cleanup step. No keystore is cached/uploaded. Checkout does not persist Git credentials; the job has contents:read only and consumes no repository secrets/owner credentials. Test nodes use disposable offline data and do not sign/post Mainnet transactions. No phone/device test, real Gateway tenant/session, production wallet or deployment runs in CI.

Only five explicit safe artifact files are uploaded. No workspace directory, private key, node database, wallet backup, seed, Gateway token, emulator image or raw logcat is uploaded. Do not add caches or artifact globs over the project/test data without re-reviewing this boundary.

**Reproducible procedure is not byte-identical signed APKs.** Fresh debug keys/certificates change signatures and SHA256 between runs; timestamps/tooling may also differ. `build-evidence.json` identifies actual source commit, JDK, SDK build tools, APK/engine/signer hashes, test totals and lint summary. The packager refuses uncommitted source so its provenance does not silently name an older commit. No production signing identity or cross-run update compatibility is promised. Use the same artifact for one phone acceptance cycle.

## Release gate

`check-licenses.py` passes a debug evidence check while visibly reporting `release_blocked=true`. `check-licenses.py --release` must fail until the documented rights/NOTICE blockers are genuinely resolved. Green CI is not legal clearance, a security certification, a physical-phone result or Mainnet acceptance. There is no release/publish job or automatic merge.
