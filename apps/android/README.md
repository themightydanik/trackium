# Trackium Cargo Android

Native BlackBear 2.2.10 integration. Installation, exact dependency/source pins, security prerequisites, Gateway setup and limitations: [ANDROID_MINIMA_CORE.md](../../docs/ANDROID_MINIMA_CORE.md).

```sh
./gradlew :app:testDebugUnitTest :minimaapi:testDebugUnitTest :app:assembleDebug
```

Requires Android SDK 36/build-tools 35.0.0 and JDK 17+ (21 tested). APK: `app/build/outputs/apk/debug/app-debug.apk`. Evaluation debug build; no real wallet/Mainnet tests performed. Do not enable live publication with untrusted Core apps or wallet clones. SDK source is vendored with Apache-2.0 attribution in `minimaapi/SOURCE.json` and `minimaapi/LICENSE`.
