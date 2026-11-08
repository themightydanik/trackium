# Reuse, engine decision and distribution review

## Pinned sources

| Source | Commit | Use |
| --- | --- | --- |
| `eurobuddha/minima-core-android` | `bc39f8f7a3c09cff55d1639ee8947b66325817b5` | Android host, BlackBear block profile/JAR, internal Pandamonium SDK/transport, History, lifecycle/security/backup UI, localisation, Maxima/Keets |
| `themightydanik/minima-core` | `c2a54a2e46b2c3a4fd541b80e7d7f5e7afe7d4da` | Engine comparison; seven object/serialization regression test classes |
| `spartacusrex-minima/minima-core` | `c2a54a2e46b2c3a4fd541b80e7d7f5e7afe7d4da` | Identical Java source comparison |
| `themightydanik/trackium` | `196b3dd5848e35844acfeffccf8f984030d7bee3` | Existing native Android UI, Gateway/pairing, encrypted storage, protocol/publisher tests |

No source repository above was edited. `UPSTREAM_NOTICES/import-hashes.json` records original imported file hashes; `derived-changes.json` identifies modifications/omissions. New code and configuration are reviewable as the files absent from that original manifest. Copying this directory into its own repository preserves these references. The archived `UPSTREAM_NOTICES/sources.lock.json` is upstream provenance for the wider integrated ecosystem, **not** a claim that all those modules ship here.

## Why the engine was not replaced

The two Java forks resolve to the same source commit and report `1.1.2.31`. The Android host ships `1.1.2.31-euro4`, SHA256 `f8dc2d7b60c327c8016ba072cb68cc6e5981a41eb4514808693ffbbc8d56e6e0`. Its existing Android H2/heap/IPC/key-safety fixes must not be discarded by rebuilding the older source. No Java engine or protocol modification is part of this prototype.

Inspection of the actual JAR (javap/reflection and executable tests), upstream patch notes and older `CommandRunner` source established:

- `Wallet.signData` and its counter-update method `updateUses` retain synchronized boundaries. Tests verify the modifiers; this is a regression check, not a formal proof of every key-use path.
- The older forks' write-command classification omits `txnlist`, `txnexport`, `txnstate`, `txncreate`; the Android JAR denies these to unrestricted READ callers. `NodeSafetyTest` checks the shipped binary.
- `txnimport` is a deliberate exception: import to a new named row is allowed, while overwriting an existing row requires ADMIN. `OfflineNodeProbe` creates an unsigned scratch row in an isolated test database, attempts a non-ADMIN overwrite and verifies refusal before blob parsing and preservation of the existing row. It does not sign/post a transaction.
- Existing Android source protects RPC with a password, validates external IPC callers, serialises sensitive work, preserves low-RAM/block mode, disables Android backup of seed/wallet data and uses safe service restart/shutdown. Those implementations are imported without relaxing checks.

Seven engine object/serialization test classes run against the **actual shipped JAR**, not a different source build. An isolated JVM starts the node twice with the same disposable database, verifies status and block/SQL low-RAM flags, compares a public key after restart and waits for clean shutdown. No genesis/mining, peers, RPC, real wallet imports or Mainnet transaction is used. This validates selected compatibility properties; it is not an exhaustive security audit or public Mainnet test.

## Modified integration surface

- New package/brand/version and local debug signing; debug-only variant; supported Keets ABI filters.
- Root build adds Kotlin and the Trackium library; machine-specific JDK path removed; all checksum/TLS checks retained and an engine checksum guard added.
- Node screen initially selected, native Open Trackium button/menu added.
- Block `PandamoniumHooks` installs the existing internal transport plus Trackium's host app-lock guard and secure-screen registration.
- `DirectNodeApi` accepts the exact prototype host ID; standalone `MinimaAPI` rejects it.
- Existing Trackium UI/controller made a library singleton under the host Application. Standalone BlackBear transport removed; a fixed-read-only in-process adapter replaces it. Financial publication and job reservation are disabled; no address allocation on wallet overview. Existing Gateway and encrypted state implementation reused.
- Trackium Activity/provider are private, use prototype authority and secure windows; no new permissions or remote bridges.

No Gateway, Railway, PostgreSQL, AOVX code or existing standalone Android application is edited. No legacy wallet MiniDapp assets or Pandamonium DeFi modules are bundled.

## Licences and remaining distribution work

The original Apache 2.0 licence is retained as `LICENSE`; original source copyright notices remain. Modified files are listed in the provenance report and described above. Eurobuddha explicitly describes its Android fork as Apache 2.0. The Java fork root is also Apache 2.0. These licences do not transfer trademarks or imply official Minima/BlackBear endorsement.

The existing Trackium repository has no explicit top-level distribution licence at the pinned commit. Reuse here follows the repository owner's request; this does not establish permission for third parties to relicense it. Agree a project licence/attribution policy before an independent public release.

Selected runtime dependency terms to preserve when redistributing:

| Component | Terms / source |
| --- | --- |
| AndroidX, Material, web3j | Apache 2.0; pinned Gradle coordinates/catalog |
| Bouncy Castle 1.69 | Bouncy Castle licence (MIT-style); `bouncycastle.org/licence.html` |
| H2 2.1.214 | MPL 2.0 or EPL 1.0 dual licence; `h2database.com/html/license.html` |
| ZXing / zxing-android-embedded | Apache 2.0 |
| AndroidSVG | Apache 2.0 |
| bare-kit | Upstream `holepunchto/bare-kit` reports Apache 2.0; prebuilt AAR does not include a full licence inventory |
| Keets source/worklet and bundled native addons | Source revision and checksums pinned in `scripts/keets-dependencies.lock.json`; **licence clearance incomplete**, see below |
| JUnit, Robolectric, Mockito, Kotlin/Gradle/Android build tools | Development/test dependencies, not automatically a runtime redistribution grant; preserve their respective notices in any distributed tooling |

The downloaded pinned Keets source archive contains no root LICENSE file; GitHub licence endpoint for `eurobuddha/keets` returned 404. Its pinned prebuilt native addon/runtime bundle contains multiple third-party components. Checksum verification establishes bytes/provenance, **not licence permission**. A complete transitive native licence/NOTICE inventory and clarification of Keets source redistribution rights remain a blocker to a public release. No public release/repository is created by this task; the debug artifact is for the requested technical review. Do not label the entire APK Apache-licensed based only on the host root licence. Keep this limitation when moving the project.

## Unconfirmed functions

Physical-phone lifecycle/background limits, full Mainnet synchronisation/interoperability, real Gateway pairing/tenant reads, tracker ingestion, safe production spending, wallet import/backup restoration, API 29+ Keets runtime and Play policy acceptance are not certified. The prototype retains upstream wallet/backup code but does not test it with working keys. Test with fresh disposable data only. Default P2P port remains 21001, so concurrent BlackBear operation needs separate operational planning.
