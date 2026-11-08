# Trackium Core Android

Standalone technical prototype: one APK with the preserved BlackBear-derived Minima node and native Trackium, integrated through Pandamonium's internal Android library API. Current debug version **0.2.0 / code 2**, application ID **tech.trackium.core.prototype**. No second APK, WebView, MDS substitution or automatic wallet migration.

The intended GitHub repository `themightydanik/trackium-core-android` is not yet accessible. The complete root project is prepared locally and mirrored temporarily in the main Trackium repository's separate `feat/trackium-core-android-stage2` branch under `prototypes/trackium-core-android`. [Exact transfer commands](docs/REPOSITORY_TRANSFER.md) preserve the verified PR #12 tree and keep PR #12/source intact. No new repository, public Release, backend copy, Gateway deployment or automatic merge is created.

## Build and verify

Requirements: JDK 21.0.13+9, Android SDK platform 36/build tools 35.0.0/platform-tools and accepted SDK licences; Python 3, curl, tar and unzip. Set JAVA_HOME and ANDROID_HOME (or ignored local.properties sdk.dir). Use a writable KEETS_CACHE_DIR if the default Gradle cache is unavailable.

```sh
# Source must be committed/clean for APK provenance export.
scripts/ci-debug.sh
```

The same script is used by [GitHub Actions](.github/workflows/trackium-core-debug.yml): source/checksum/legal evidence checks, all JVM/Robolectric/Python tests, host/Trackium lint, `assembleBlockDebug`, pinned native APK verification and debug-signature verification. Output: `dist/trackium-core-debug.apk`, SHA256SUMS, certificate report, build-evidence.json and licence-audit.json. Raw Gradle output remains `app/build/outputs/apk/block/debug/app-block-debug.apk`. [Download/CI instructions](docs/CI_DEBUG_APK.md).

Only blockDebug is enabled. A temporary/local standard Android debug key is generated in ignored `.local/`; CI never caches/uploads it and removes it after the job. Separate runs have different signing identities/hashes: reproducible build procedure does **not** mean byte-identical signed APKs or cross-run update compatibility. No production signing credentials are used.

Gradle wrapper/source/engine/Keets/toolchain/native checksums and TLS certificate checks remain enabled. Behind a corporate proxy, trust the organisation CA locally; never disable TLS or commit CA/private keys. Keets uses pinned Node/npm and verified source/runtime caches. An offline build requires pre-populating those caches.

## Controlled phone test

Read [docs/PHONE_ACCEPTANCE.md](docs/PHONE_ACCEPTANCE.md) before installing. Use a test phone with fresh empty keys; no BlackBear seed import, real funds, signing, transfers or Mainnet proof publication. APK is ~220 MiB, min API 28, target API 35, arm64-v8a/armeabi-v7a/x86_64. First acceptance requires **4096-byte memory pages**; two pinned ARM64 dependencies are not confirmed compatible with 16-KiB pages. API 28 runs classic transport with upstream Keets runtime gating; API 29+ Keets needs device acceptance.

Both this prototype and BlackBear retain default P2P port **21001**. Never run both nodes concurrently during tests; stop one without deleting its data. Separate package/UID/storage/Keystore means no replacement of BlackBear or the existing standalone Trackium APK. Actual co-install/OEM/reboot behaviour remains in the phone checklist.

Open Trackium from the initial Node screen's button/menu. It is a private Activity in the host process. The adapter allows exact status/balance/network/peers/block observations only, follows foreground/unlocked lifecycle and rejects financial/private/batched commands before dispatch. Publication/job reservation is hard-disabled regardless of saved switches. Host Wallet/Terminal/backup remain privileged upstream features; the whole host is not a read-only wallet.

Gateway origin/tenant start empty. Use only a test HTTPS tenant and owner-confirmed native pairing; owner credentials stay on the operator's trusted computer, never in APK/logs/Actions. Android Keystore/AES-GCM protects Trackium state. No Gateway/Railway/PostgreSQL/AOVX changes are included.

## Evidence and limits

Local stage-2 build: **327 JVM/Robolectric tests and 33 Python tests pass; host lint 0 errors/7018 warnings; Trackium lint 0 errors/3 warnings**. All 15 MissingTranslation errors fixed through ru/uk/zh strings, without suppressions. [Lint/security/API review](docs/LINT_REVIEW.md) documents remaining dependency TLS, receiver API, storage, wake-lock and native compatibility findings.

[Architecture](docs/TRACKIUM_CORE_ARCHITECTURE.md), [engine/reuse review](docs/REUSE_AND_ENGINE_REVIEW.md), [validation](docs/VALIDATION.md) and [source pins](sources.lock.json) describe the retained engine and tests. Prior prototype #1 emulator tests demonstrated real node/adapter/native navigation and state recovery; no physical phone or public Mainnet acceptance is claimed for stage 2.

**Public release is blocked:** [licence audit](docs/LICENSE_AUDIT.md) captures MIT/Apache/ISC evidence and all 21 native package licence texts, but Keets grant/attribution, native transitive/runtime notices and explicit Trackium distribution terms remain unresolved. Green CI and downloadable debug review artifacts do not clear these blockers. No GitHub Release or Play publication is performed.
