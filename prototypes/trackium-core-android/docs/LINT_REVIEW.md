# Host lint and Android compatibility review

Stage 2 `:app:lintBlockDebug` passes with **0 errors and 7018 warnings**; `:integrated-trackium:lintDebug` passes with 0 errors/3 warnings. No baseline, global suppression, disabled check or abortOnError bypass is introduced. Eleven main strings plus four block-flavor overrides now have real ru/uk/zh translations, including the restore/key-use safety warnings and mode-switch explanation. Node/crypto/network/lifecycle code is unchanged.

## Security and API findings needing attention

| Finding | Assessment and acceptance requirement |
| --- | --- |
| TrustAllX509TrustManager (3) | Lint identifies empty checkClientTrusted/checkServerTrusted implementations inside Bouncy Castle bcpkix 1.69. This is dependency code, not a newly installed global trust manager. Trackium NativeGateway uses credential-free HTTPS origins, default HttpsURLConnection trust/hostname checking and no custom TrustManager/HostnameVerifier; source search finds no global override in host/SDK/Trackium. This does **not** prove every dependency call path is safe. Trace dependency reachability and review an engine-compatible dependency update before production; do not dismiss as a false positive or weaken TLS. |
| InlinedApi (3) | SDK/service use RECEIVER_EXPORTED/RECEIVER_NOT_EXPORTED flags introduced in API 33 while minSdk=28. Dynamic receiver behaviour/security semantics must be validated across API 28/32/33+, including host caller identity/pinning checks. The prior API 28 emulator result is one data point, not proof of every OEM/OS combination. Do not remove flags or IPC authentication to silence this warning. |
| ScopedStorage (2) | Retained host READ/WRITE_EXTERNAL_STORAGE does not grant modern media access on Android 13+. Trackium adds no permissions and keeps state in private/noBackup storage. Test permission denial, SAF/export/backup interactions separately; do not add broad storage access merely for deployment. |
| BatteryLife / WakelockTimeout | The full node deliberately uses foreground service, alarms and wake locks. Verify release on shutdown and measure actual background/battery/thermal behaviour; OEM restrictions can stop the service. No unconditional exemption or battery policy change is made here. |
| StaticFieldLeak (2) | Existing ChatFileDelivery and host MainActivity references can retain Context/views. Profile retained Activity memory after navigation/rotation/background; do not claim long-run RAM stability based on a short test. |
| DiscouragedApi / PrivateResource / NonConstantResourceId | Existing reflection/resource usage may change with Android/AndroidX/AGP. Revalidate before tooling upgrades; fixed current dependency versions do not establish future compatibility. |
| ExifInterface / GradleDependency / AndroidGradlePluginVersion | These are dependency/tooling maintenance warnings, not a complete CVE scan. Review upgrades together with node/backup/IPC regression tests rather than automatically replacing the engine. |

No first-party trust-all TLS code or new exported administrative endpoint was added. The inherited host still has privileged Wallet/Terminal and external IPC guarded by its original authentication; the bundled Trackium capability is a narrower read-only trusted-code boundary, not a process sandbox. Public redistribution also remains blocked by [licence review](LICENSE_AUDIT.md).

## Native page-size and runtime compatibility

Inspection of the packaged ARM64 ELF PT_LOAD alignments found 21 library files at >=16 KiB alignment and **two at 4 KiB**: `libbare-tcp.2.0.4.so`, `libsodium-native.4.3.3.so`. The latter are pinned upstream outputs and remain byte-identical. A zipalign-only change does not rebuild ELF segment alignment. Android 15+ devices can use 16-KiB pages; installation/runtime compatibility there is unconfirmed and blocked for this acceptance round. First phone acceptance uses 4096-byte pages, checked via `adb shell getconf PAGESIZE`. Rebuilding/removing native dependencies requires a separate upstream-compatible pin/security/licence review.

The APK includes arm64-v8a/armeabi-v7a/x86_64, minSdk 28 and targetSdk 35. The retained manifest override lets the host install on API 28 while bare-kit itself requires API 29; upstream runtime gating avoids touching Keets on API 28. API 29+ Keets execution, modern notification/foreground-service policy, receiver flags, and OEM reboot behaviour need actual device tests. Success of API 28's classic transport cannot certify API 29+ Keets or 16-KiB devices.

## Remaining warning inventory

Most warnings are unused dynamic localisation resources (6576), hardcoded UI text (212), layout/typography/accessibility and performance hints. Removing dynamically looked-up translations based only on UnusedResources would be unsafe. They are retained for focused follow-up rather than bulk-deleted or suppressed. Full machine-readable counts: `lint-warning-counts.json`; the complete local/CI lint report remains in app/build/reports.

| Lint ID | Warnings |
| --- | ---: |
| AndroidGradlePluginVersion | 3 |
| ApplySharedPref | 9 |
| Autofill | 18 |
| BatteryLife | 1 |
| ClickableViewAccessibility | 1 |
| ContentDescription | 1 |
| DefaultLocale | 10 |
| DiscouragedApi | 1 |
| ExifInterface | 1 |
| GradleDependency | 3 |
| HardcodedText | 212 |
| InefficientWeight | 1 |
| InflateParams | 3 |
| InlinedApi | 3 |
| LabelFor | 1 |
| NonConstantResourceId | 12 |
| NotifyDataSetChanged | 4 |
| ObsoleteSdkInt | 1 |
| Overdraw | 40 |
| PluralsCandidate | 31 |
| PrivateResource | 2 |
| RtlEnabled | 1 |
| RtlSymmetry | 1 |
| ScopedStorage | 2 |
| SetTextI18n | 11 |
| SmallSp | 1 |
| StaticFieldLeak | 2 |
| TextFields | 4 |
| TrustAllX509TrustManager | 3 |
| TypographyDashes | 10 |
| TypographyEllipsis | 22 |
| TypographyFractions | 8 |
| Typos | 10 |
| UnusedAttribute | 1 |
| UnusedResources | 6576 |
| UsableSpace | 1 |
| UseCompoundDrawables | 1 |
| UseTomlInstead | 4 |
| UselessParent | 1 |
| WakelockTimeout | 1 |
