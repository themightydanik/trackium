# PandaBear / BlackBear review and release — 2026-10-06

PandaBear **1.7.4-PandaBear** and the separate BlackBear **1.7.4-BlackBear** app use Android versionCode **69**, bundled core **1.1.2.31-rex3**. BlackBear names the block-mode app; PandaBear retains the classic wallet mode. See [the user explainer](PANDABEAR_BLACKBEAR.md). Earlier 1.7.3 builds were local review artifacts and are superseded for publication.

This review follows `HANDOFF_BLOCKASKEYUSES_2026-10-05.md`, the project graph, project memories and repository instructions. It covers the merged core fork, both Android flavors, the companion IPC SDK, PandaPools native and MDS, and AtomiX integration. Core changes are in the existing `core/minima-core/merge-1.1.2.31` worktree, not the unrelated primary checkout. Pre-existing graph/cache changes were preserved.

## Findings fixed

| Priority | Finding | Fix and evidence |
| --- | --- | --- |
| Critical | Custom `txnsign keyuses:` narrowed a decimal to int before checking capacity. `4294967296`, `-4294967296` and `0.5` could select leaf zero. | Exact integer conversion and per-key bounds before narrowing. All three reproduced against rex2 and rejected by rex3; the final valid legacy leaf still signs. |
| High | A signing refusal after temporary password unlock left the wallet decrypted. | `finally` relocks in `txnsign`, `sendsign`, `send` and multisig's temporary-unlock path. Real scratch-wallet capacity refusal reproduced before and passes after. |
| High | The SDK explicitly addressed `org.minimarex.minimacore`; preserving action names did not provide MinimaBlock compatibility. | Registration-only discovery of classic/block packages, then a single package pinned for all commands/files. Zero or two responders return an explicit failure. Commands never fan out. Four public SDK routing tests cover classic, block, both and neither. Updated AAR bundled in PandaPools 0.9.64 and AtomiX 0.1.71. |
| High | MDS still used 262143/262144 in the actual signing and confirmation paths despite its updated classification function. | Reuse per-key `capacityOfRow` at the signing boundary and confirmation; persist the larger floor. Tests exercise real signing/confirmation at block-mode uses 2342219, and preserve legacy exhaustion and restored-key quarantine. |
| High | Streaming MegaMMR import could wait indefinitely after rejection or report success after partial processing. A corrupt count could also drive a huge allocation before the heap guard. | Validate version/counts, bound initial table allocation, validate each batch, publish completion across threads on failure too, bound the wait to ten minutes, reset the acceptance timer per batch, and require the resulting tip to equal the batch's final block. Validate the IBD header before resetting chain state. Malformed count/truncation tests pass at 256 MB; a full live import was not performed. |
| High | Block restore prefilled 1000 and advised leaving it unchanged, although previously used indexes can exceed the current chain height. | Remove automatic prefilling; require explicit entry using the existing restore validation. Explain that the floor must exceed every previously used index and the old wallet must be stopped. |
| Medium | `coins max:` counted results before sendable/age/mempool filtering, potentially returning empty despite a later matching coin. | Apply existing filters before copying/counting candidates. Tests reproduce and verify sendable and coinage cases. Existing public overloads remain compatible. |
| Medium | MegaMMR search exceptions and successful token lookups could leak a database read lock. | `finally` releases in both loops, including early capped returns. Regression checks cover exception, cap and token lookup paths. |
| Medium | Low-RAM CoinDB performed unindexed per-candidate state lookups and tree/pruning queries. | Reuse the idempotent index pattern from TxPoWSqlDB for coinid, txpowtreeid and blockheight. H2 2.1.214 EXPLAIN confirms indexed access for all three. |
| Medium | Android's port probe raced startup and could warn about its own freshly started node. | Complete the existing asynchronous probe before starting the node; check the service instance's destruction state before starting. |
| Medium | Full AtomiX lint caught `BigInteger.longValueExact()` requiring API 31 despite minSdk 28. | Reuse the compatible BigDecimal exact-conversion pattern; test valid timestamps and overflow. Add the existing MinimaCore optional-camera manifest declaration to fix the other lint error. |

## Verification

- Core Gradle build: 244 tests, zero failures.
- Focused core harness: 18 checks, zero failures, actual APK H2 **2.1.214**, **256 MB heap**. Initial rex2 run reproduced five failures; final rex3 run passes.
- Existing SQL retention executable: 10 checks pass against H2 2.1.214.
- Android: 103 tests per flavor, both release builds and full flavor lint pass.
- SDK: four new routing tests pass (plus existing example test).
- PandaPools native: 299 tests, release build and full lint pass.
- AtomiX: 260 tests, release build and full lint pass.
- PandaPools MDS: 32 tests pass; versioned archive built by the existing build.sh, with dapp.conf first.
- All four APKs verify with family certificate SHA-256 `eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f`.
- Bundled core jar equals the core Gradle output; SHA-256 `618b5af13a7a6aed4f3e25d0b0b5c21ca5936a8006e6aa097abe341994ce7f1b`.

Logs and the focused harness are under `review/2026-10-06/`. Rerun focused checks with `bash review/2026-10-06/run-core-checks.sh`. The script uses the existing local Java 11 and H2 toolchain. Tests create scratch wallets only.

## Local artifacts

- `apks/base/dist/minima-core-ui-1.7.4.apk`
- `apks/base/dist/minima-block-1.7.4.apk`
- `apks/base/dist/minimaapi-1.7.4.aar`
- `apks/pandapools/dist/pandapools-0.9.64.apk`
- `apks/atomix/dist/AtomiX-0.1.71.apk`
- `mds/pandapools-mds/PandaPools_0.6.32.mds.zip`

APK/AAR checksum sidecars use the existing repository convention. The owner authorized source commits, pushes, GitHub releases and store publication. No device installation is part of this release. Publication results are recorded separately.

## Limits and operational requirements

No multi-day device soak, mainnet-sized import, or on-device broadcast integration was performed in this review. JVM routing tests simulate Android delivery. Full lint passes with existing non-fatal warnings. Import failures after chain reset can still leave a partial chain and require restart/retry, as the command reports; this is not a transactional importer.

Classic and block mode remain different key systems and packages. Drain pools/swaps before migration and restore with the matching mode. Older companion APKs still hard-target classic until rebuilt with the new SDK. Run one node at a time; the SDK refuses discovery when both reply and does not silently switch a selected node during a session. Node-launch shortcuts retain classic preference when both apps are installed and fall back to block on block-only installations.
