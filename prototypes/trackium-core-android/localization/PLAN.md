# Four-language bear release

## Current Atelier/Salon integration checkpoint — 1.9.93/164, 2026-10-19

This section supersedes the older source-version and completion-count snapshots
below. The active goal remains incomplete. No final integration release has been
installed or published. The Fold's last verified working build is 1.9.85; this
checkpoint performs no device changes.

- Both full native apps are imported into Pandamonium, with FILTR/art assets and
  the common manual English, Simplified Chinese, Russian and Ukrainian selector.
  Menu identities 17/18, Pandamonium-only dependencies, non-exported activities and
  separate providers remain present. Salon uses the host MaxChat node/media.
- Current host verification: 848 passing tests across Atelier (305), Salon (373),
  shared localization (12) and Pandamonium host (158). The prior real Chrome FILTR
  and Salon page four-language checks still apply to the unchanged browser assets.
  Host/browser checks do not prove Fold acceptance.
- 6843 catalogue messages validate in all four languages. All 21 pinned imports
  reproduce. The direct-transport guard and release Java compilation pass.
- Salon full backup now validates before writes and saves the key, draft and hosting
  list together, activating the new key only after checked persistence. Corrupt
  saved data cannot silently produce an incomplete backup. Restored content survives
  returning to Edit. Review: `docs/SALON_BACKUP_PERSISTENCE_REVIEW.txt`.

- Salon setup now captures its account/draft/node/hosting lifetime, checks every
  continuation and saves pending mints before dispatch. Unconfirmed attempts resume
  balance reads only; an explicit four-language confirmation can allow another
  attempt without sending anything. Inputs remain intact across language changes.
  Review: `docs/SALON_CLAIM_REVIEW.txt`.

- Salon's durable outbox now freezes sender, payload, route and destination, owns
  attempt completion in SQLite, and keeps uncertain chain sends out of automatic
  retry. Additive schema-5 migration preserves history; older pending rows receive
  an explicit four-language review path. See `docs/SALON_OUTBOX_REVIEW.txt` for
  migration compatibility, verification and limits.

- Salon hosting tests and SFTP trust now retain the original account/destination,
  reject stale consent and commit pins before retrying. The 2 GB Salon test heap
  supports the complete suite. Review: `docs/SALON_HOSTING_CHECKS_REVIEW.txt`.

- Salon foreground inbox/tip/key callbacks now retain account and node ownership,
  validate complete reads and consume replies once. Startup/reconnect/restore
  begin reads after key readiness. Review: `docs/SALON_NODE_CALLBACKS_REVIEW.txt`.

- Atelier hosting tests now retain saved destinations, reject stale trust consent and
  check fingerprint persistence before retry. Host navigation stays inside Pandamonium.
  The native active-label audit completed, including the remaining NFT reclassification
  toast in all four languages. Review: `docs/ATELIER_HOSTING_CHECKS_REVIEW.txt`.

- All three signed 1.9.93/code164 candidates were built from 27c23e5 and verified
  against the existing certificate, actual APK metadata, all four packaged languages,
  Keets bundle/native runtime, and Pandamonium's creative classes/assets/providers.
  Versioned APKs and SHA256 sidecars are in `apks/base/dist`. Details and hashes:
  `docs/ATELIER_SALON_CANDIDATE_1.9.93.txt`. No install or publication occurred.

Remaining before accepting the full goal:

1. Run the authorized Fold navigation, four-language visual/retained-input, WebView,
   notification and lock acceptance checks while preserving owner data. Never run
   disposable test fixtures on the owner device or operate on the S10+.
2. Source 27c23e5 is committed and pushed to the fork. Any final publication remains subject to the
   established acceptance gate and uses GitHub, PandaApps and eurobuddha.com only.


## Scope

PandaBear, BlackBear and Pandamonium: English (`en`), Simplified Chinese (`zh-Hans`), Russian (`ru`) and Ukrainian (`uk`, Українська). Ukrainian explicitly authorized on 2026-10-16. Users choose the language; retain their choice. Language changes must preserve wallet state, edited input, active operations and app lock behavior.

Baseline: `9def96e6801a9bef261611e45349f28a1eb6ae1c` (all three 1.9.41 tags and fork/ui/full-redesign verified). Installed candidate: 1.9.51/vc122. New Atelier/Salon integration source: 1.9.52/vc123 (in progress). Isolated branch: feature/bear-languages-2026-10-16.

## Current release status — 2026-10-18

Use this section for current status. The dated entries below record earlier checkpoints.

- **Source:** 1.9.51/vc122 adds NFT tab-strip scrolling and Studio unstamped collection read fixes to the reviewed 1.9.50 metadata fixes. Baseline 1.9.41 and bundled node remain unchanged.
- **Languages:** explicit, remembered English, Simplified Chinese, Russian and Ukrainian; 5,337 catalogue messages per language across all 19 integrations. Full visual/state acceptance remains pending.
- **Review and tests:** no blocking finding in the 1.9.51 patch. All 25 host tasks pass (2,687 tests; four modules have no tests). Import reproduction, direct transport and catalogue checks pass. The new guarded NFT/Studio UI tests compile with the Atomix fixture group excluded; the full instrumentation compile is blocked by pre-existing obsolete OtcDb calls. No device instrumentation was run on the owner Fold.
- **Builds:** all three signed 1.9.50/vc121 candidates were installed on Fold R3GL805K7MB, user 0, with data preserved. Signed 1.9.51/vc122 candidates are now verified and staged in `apks/base/dist`, built from `80ef5fc`. Original signing certificates, package/version metadata, 16 KiB alignment, non-debuggable arm64 packaging and all four language resources are verified. The owner reconnected Fold R3GL805K7MB; all three 1.9.51/vc122 updates are now installed and PackageManager-verified for user 0. App data was preserved and S10+ untouched. Evidence: `build/localization/fold-1.9.51-install-validation.json`. Evidence: `build/localization/bear-1.9.51-validation.json` and `signed-candidates-1.9.51-validation.json`.
- **Device acceptance:** only Fold R3GL805K7MB is authorized. Its reported tab snap-back has a confirmed layout feedback loop. Studio reproduces the reported error text on valid unstamped/unsupported collection state; the owner's precise failing response has not been captured. Confirm both on the Fold after updating. Remaining language, app lock, accessibility and populated minimaWallet acceptance are still pending. Disposable emulator fixtures must never run on the owner device.
- **Delivery:** signed versioned APKs and SHA256 sidecars belong in `/Users/eurobuddha/Projects/minima/apks/base/dist`. Publication destinations remain GitHub fork `eurobuddha/minima-core-android`, PandaApps and eurobuddha.com only. No public release of these multilingual candidates has occurred.

## Proven sources

Reuse Parlons commit `41c9b0a967d9a2393a047bae6b13fa5ad9a3d5c5`, inspected in maxima/build/account-import:

- chatshared/com/eurobuddha/maxima/app/i18n/Language.java
- chatshared/com/eurobuddha/maxima/app/i18n/LanguageDialog.java
- chatshared/com/eurobuddha/maxima/app/i18n/NotificationLabels.java
- localization/android/test/com/eurobuddha/maxima/app/i18n/LanguageTest.java
- tools/localization/generate.cjs

The shared Android library adapts namespaces, preference ownership, channel IDs and four-language catalogs. Native bindings retain views and refresh only application labels. Raw user text, amounts, protocol values and cryptographic material remain literal. Details and source hashes: provenance.json.

Build inputs reuse base/app/libs/bare-kit.aar v2.5.5, keets.bundle and jniLibs, with hashes in build/localization/build-input-hashes.json. The established scripts/fetch-bare-kit.sh and scripts/pack-keets-worklet.sh were inspected before reusing their existing outputs.

## Completion gates

- [x] Verify final pushed 1.9.41 baseline and graph/memories.
- [x] Add shared four-language foundation and run inherited unit tests.
- [x] Connect launcher, explicit selector, main tabs and overflow menu.
- [ ] Translate core onboarding, lock, wallet, send/receive, backup/recovery, node/status, parameters, logs, apps and chat UI, including dialogs, errors, plurals and notifications.
- [ ] Translate Pandamonium embedded ethwallet, atomix, pandapools, futurecash-next, pandadex, casino, blockexplorer, filez, history, vestr, entropy, terminalide, mail, UTXO Wallet, NFT Wallet, minimaWallet, miniMall, miniMall Studio and miniMall Inbox; preserve importer reproducibility.
- [ ] Audit hardcoded text and display-only formatting; exclude protocol/debug/raw user data explicitly. Review the bundled node source too wherever locale-sensitive formatting can reach command or persisted values.
- [ ] Exercise all four selections, persistence and switching on the authorized Fold only, preserving installed data and wallet state. Verify app lock, retained inputs, dialogs and long labels. Keep disposable fixture guards intact; use host tests for additional API coverage.
- [ ] Review code, run relevant regression tests, verify imports and direct transports.
- [x] Build initial signed candidates for all three apps; verify certificates, package/version metadata, packaged language resources and SHA256 sidecars in apks/base/dist.
- [ ] Rebuild and verify final accepted release APKs after remaining changes; copy final versioned artifacts and SHA256 sidecars to apks/base/dist.
- [ ] Commit/push only to fork; publication destinations, if publishing, are GitHub, PandaApps and eurobuddha.com. Never Apple App Store/Google Play.

This is an in-progress implementation, not a completed translation or release.

## Pandamonium acceptance checklist

The user reiterated on 2026-10-16: every integrated app must follow the same language switch. Each module needs complete app-owned text coverage, retained-input checks, and a visual check in all four languages. Translation must include its dialogs, errors and notification labels, while names supplied by users and protocol data stay unchanged.

- [ ] ETH Wallet (`integrated/ethwallet`)
- [ ] AtomiX (`integrated/atomix`)
- [ ] PandaPools (`integrated/pandapools`)
- [ ] Future Cash Next (`integrated/futurecash-next`)
- [ ] PandaDEX (`integrated/pandadex`)
- [ ] Zero Edge Casino (`integrated/casino`)
- [ ] Minima Explorer (`integrated/blockexplorer`)
- [ ] Filez (`integrated/filez`)
- [ ] History (`integrated/history`, embedded tab)
- [ ] Minima Vestr (`integrated/vestr`)
- [ ] Entropy (`integrated/entropy`)
- [ ] Terminal IDE (`integrated/terminalide`)
- [ ] MinimaMail (`integrated/mail`)
- [ ] UTXO Wallet (`integrated/utxo`)
- [ ] NFT Wallet (`integrated/NFTwallet`)
- [ ] minimaWallet (`integrated/wallet`)
- [ ] miniMall (`integrated/merchshop`)
- [ ] miniMall Studio (`integrated/merchstudio`)
- [ ] miniMall Inbox (`integrated/merchinbox`)

The shared drawer and every integrated activity must preserve state during switching. Update the reviewed importer adapters alongside snapshots. The importer defaults to ROOT.parent; isolated worktrees set `PANDAMONIUM_SOURCE_ROOT=/Users/eurobuddha/Projects/minima/apks/base/build/multilingual-2026-10-16/build/localization/pinned-sources`. Preserve the pinned snapshots. Baseline verification found omitted 1.9.32 adaptations for the AtomiX persistent menu and PandaPools shared codec. These are now reproduced by the existing navigation/direct adapters without changing the integrated app sources.

## Shared implementation rules

The `:localization` Android library owns `Language`, `LanguageDialog`, generated resources and the single saved choice. Integrated apps depend on that library; they must not initialize another language store or choose a device language automatically.

- Author all four translations in `localization/catalog.json`; run `node tools/localization/generate.cjs` and `--check`.
- Keep dynamic application labels as `Language.Message` via `Language.msg`, `count` or `join`; use `Language.setText`, `hint`, `description` and `error` at the final view boundary. Do not stringify messages early or infer translation keys from visible user text.
- XML bindings use `android:tag="l10n:text=resource_name;hint=resource_name"`. Do not tag an initial placeholder that an existing render method replaces with a dynamic value: it would overwrite that value when the screen starts.
- `LanguageDialog` retains the existing Material dialog and uses view attachment for label binding so caller on-show PIN validation handlers remain intact. Single-choice row positions remain stable while labels change.
- Every activity must handle `locale|layoutDirection|screenLayout`; refresh display labels and toolbar titles without restarting screens or operations. Keep a module's existing configuration flags too. Preserve custom navigation tags on Pandamonium headers.
- Audit locale-sensitive formatting separately from display translations. Candidate sites are recorded in `build/localization/locale-format-audit.json` (205 candidates, not 205 defects). Commands, amounts passed to protocols, identifiers and stored data must remain locale-independent.

Foundation tests use `LanguageScreensTest` with `-e bearLanguagesDisposable true` on a fresh `ranchu` emulator. They verify the chooser and saved Ukrainian selection, all four launcher translations with the same activity, PIN draft/validation preservation, and unchanged auto-lock minute values. They do not start a node or create a wallet. Full core and integrated-screen coverage is still required.

Importer verification from this worktree:

```sh
PANDAMONIUM_SOURCE_ROOT=/Users/eurobuddha/Projects/minima/apks/base/build/multilingual-2026-10-16/build/localization/pinned-sources python3 scripts/import-pandamonium.py --verify
python3 scripts/verify-pandamonium-transport.py
```

Both pass after reproducing the pre-existing 1.9.32 adapters. The foundation snapshot is historical. The current drawer integration now adds the shared localization dependency and locale/layoutDirection/screenLayout flags to every embedded activity, and binds AtomiX's rebuilding navigation button through the existing importer adapter.

## Expanded Pandamonium scope — user instructions, 2026-10-16

Add the existing native UTXO Wallet (`apks/utxo`), NFT Wallet (`apks/NFTwallet`), and minimaWallet (`apks/wallet`). Initialize minimaWallet using the Pandamonium node's seed and the classic key-use value chosen during creation. Provide an in-app path to reset/change minimaWallet's seed and key uses. Existing seed/history and counter safety must be preserved; sharing classic signing keys requires coordinated ongoing reservations, not only copying a starting number. Do not reset a used seed's counters downward.

Add miniMall (`apks/merchshop`), miniMall Studio (`apks/merchstudio`), and miniMall Inbox (`apks/merchinbox`), grouped elegantly under a single Mall navigation entry. These are the established product names from the user's naming memory. All six additional apps must participate in the shared English, Simplified Chinese, Russian and Ukrainian language choice, alongside the original 13.

These additions are authorized and all six are now imported alongside the original 13 apps. Current verification reproduces all 19 modules from pinned sources. The six standalone repositories remain unchanged. Source integration and Fold runtime acceptance are tracked separately above.

Current source versions found: UTXO 0.4.33, NFT Wallet 0.1.13, minimaWallet 0.2.21; miniMall 0.4.4, Studio 0.3.4, Inbox 0.5.3. Older August memories about unreleased Studio 0.3.1 are stale: the inspected Studio source is clean at 0.3.4, commit 69aa5d8b0a80fb123f267b1957c490e6257a2a47.

## Drawer and onboarding checkpoint

The shared drawer now exposes the four-language selector; bindings update its mode label and accessibility labels. New-wallet seed display and confirmation screens, validation dialogs, and keyboard dismissal label are translated. Recovery seed contents and typed values remain literal.

The catalog has 98 messages in each language. Current JVM checks: 9 passed. All three variants compile; Pandamonium debug and test APKs assemble. Eight device checks passed on the disposable API 36.1 emulator, including the prior four foundation checks, unchanged generated seed words, unchanged typed seed/cursor with a translated validation dialog, the built manifests for all original 13 modules, and the shared drawer selector with an Explorer search draft. See build/localization/device-drawer-onboarding.log. Full core and integrated app text coverage, new wallet/Mall integrations, final signing and release remain pending.


## UTXO integration and dual-key audit checkpoint

UTXO Wallet 0.4.33 (source c3e69c4ff11a1af7b410e7a873bc675c79a5ae90) is now the 14th imported native library. The importer preserves source provenance, uses DirectNodeApi/DirectNodeEvents, isolates its history in pandamonium_utxo_history.db, and adds its existing launcher artwork to the allowlisted drawer. The original 13 snapshots were verified unchanged when UTXO was added. All 14 currently reproduce through the importer, including the subsequent Future Cash adapter below.

The user additionally requested Future Cash Next to inspect classic keys AND the block-as-key-uses set. The bundled Future Cash auditor now classifies every returned key by its own shape (64x3 classic, 128x4 block), displays both counts and all returned rows, checks known reuse for both families, and confines spend-count estimates/recovery-count recommendations to classic keys. Unknown shapes, inconsistent capacities, malformed evidence, missing rows and address-derivation mismatches cannot count as a complete audit. Partial audits retain prior risky addresses and rescue destinations. Old cached audits require a fresh audit after this upgrade.

Reuse sources: apks/pandapools/app/src/main/java/com/eurobuddha/pandapools/KeyUses.java and KeyUsesTest.java; the existing Future Cash KeyAudit/Audit/AuditRunner/AuditApi and tests; node source /Volumes/PandaWrX2TB/Projects/minima/core/minima-core/merge-1.1.2.31/src/org/minima/{objects/keys/TreeKey.java,database/wallet/KeyRow.java,database/wallet/Wallet.java,system/commands/base/block.java}; local KeyUses backend response code. This works on keys the node reports; it does not derive an absent family from the seed. Linking minimaWallet's separate public-key set remains part of its pending integration. No standalone Future Cash repository or live wallet was changed.

Validation: 52 Future Cash unit tests, 121 Pandamonium unit tests, 21 embedded-transport unit tests; 3 device checks on the owned stopped-node emulator (all 14 manifest configuration flags, Explorer drawer/draft, UTXO selected coins and all Send fields/cursor across four languages). No funds or seed used. Emulator stopped afterwards. Import reproducibility, transport guard and git diff checks pass. Evidence: build/localization/utxo-dual-key-validation.json. APK from the UTXO device run predates the final Future Cash adapter; signed release builds remain pending.

Remaining: five new imports, the single Mall entry, coordinated minimaWallet seed/key-use lifecycle, full core and all 19 integrated-app translation coverage (including new Future Cash labels), visual/lifecycle checks, signed builds and publication. All work remains uncommitted and unpublished.


## Audit runtime and Mall import checkpoint

Future Cash's summary card now agrees with the evidence gate: partial/stale audits cannot show a clean result; classic-counter warnings and stored risky addresses remain visible. The clean-result copy says no known reuse was found in checked keys. A packaged-app regression uses synthetic public keys on the stopped-node disposable emulator to check mixed-family rows, partial evidence, classic-counter risk, persisted risk after reopening, and a complete result. All 52 Future Cash and 121 host unit tests pass. Four device checks pass, including the existing Explorer/UTXO state checks and locale configuration for all 17 imported modules. See build/localization/dual-key-device-validation.json. The emulator is stopped.

miniMall 0.4.4, Studio 0.3.4 and Inbox 0.5.3 are now imported, with one miniMall drawer entry and native hub. The hub descriptions have four-language bindings; the generated resource references compile. Adaptations isolate the three databases, tag notifications, constrain imported shop paths and size, validate payment command arguments and dispatch commands through the main handler. All 17 snapshots reproduce through the importer and the transport guard passes. These Mall changes still need dedicated boundary/unit tests, hub and app runtime checks, full financial-flow review and text localization before release approval. External .shop opening into Pandamonium also needs review; the imported non-exported activity cannot receive external VIEW intents, while its in-app document picker remains available.

Remaining new imports: NFT Wallet and minimaWallet. minimaWallet shared-seed/classic-counter coordination and reset/change-seed paths are pending. All remaining core and integrated text translation, broad validation, signing, commit/push and authorized publication remain pending. No live node, seed or funds were used; no release was published.


## Mall verification and History localization checkpoint

Mall integration boundary checks now pass: 15 unit tests cover command dispatch/release, unsafe payment arguments, exact decimal/reference preservation, namespaced shop storage and traversal/symlink containment. Three device checks cover the single hub identity, all four hub languages without activity recreation, all three Mall activities opening in the shared drawer with the node stopped, and independent database/bookmark values. The Ukrainian hub screenshot was inspected and fits. Internal Mall app text translation, deeper financial-flow review and external .shop routing remain pending.

History now uses the shared Language/LanguageDialog bindings throughout its search, sync status, menu, transaction details, ownership labels, split/consolidation labels and import/export notices. Display dates and relative time follow the selected language. The app name and asset names remain literal. Forty-seven messages/plurals were added, giving 149 catalog entries in each of four languages. Model storage, SQL, sync algorithms and JSON/CSV schema/value formatting remain unchanged. The source adapter scripts/adapt-pandamonium-history-languages.py runs after the existing navigation adapter.

Validation: both existing History token/transaction unit tests pass. A disposable-emulator test switches the same open transaction dialog and activity through all four languages, preserves the search/cursor, checks menu labels and exports the synthetic transaction to both JSON and CSV in each language. Amount precision, asset name, transaction ID and raw direction are unchanged. Russian/Chinese screenshots were inspected; copyable rows now inherit the native dialog text colour for readable contrast. This exercises the retained History component through its declared activity; final full-host-tab lifecycle and large-font/API-below-33 checks still remain.

All17 snapshots and provenance reproduce. Catalog, transport guard and whitespace checks pass. Evidence: build/localization/history-malls-validation.json. Emulator5562 is stopped; no live node, seed, funds or owner devices were used. No commit/push/signing/publication in this checkpoint.

Next integration source inspection begun: apks/NFTwallet0.1.13vc113 HEAD0cf4d1eee1044de638ee57091ac458f151e9dfe6. Read manifest/build/CLAUDE, full NodeApi, MintService, Notifier, BootReceiver, HeartbeatReceiver and MintWorker. MainActivity, mint driver/engine/store and tests still need inspection before implementation. Confirmed FG_ID3101 collides with Future Cash GuardianService; alerts also need tags. Resource prefix must be lowercase for the NFTwallet folder; its HistoryDb must be isolated. No NFT source modifications or import performed.


## NFT Wallet integration checkpoint

Imported apks/NFTwallet 0.1.13 vc113 at 0cf4d1eee1044de638ee57091ac458f151e9dfe6. Inspected the donor build/manifest, NodeApi, MainActivity, SettingsDialog, MintService/driver/engine, LocalStore, StateNft and StateNftActions, transaction builder/chain/utilities, distribution manager/job, image tools/sanitizer and existing tests; read the relevant send/mint validation call paths. Reused the current snapshot importer, direct API/events, navigation and language configuration. Resource prefixes now lowercase folder names so NFTwallet generates valid Android resources. All previous17 snapshots stayed byte-identical during import.

Dedicated NFT Wallet drawer entry; pandamonium_nft_history.db; foreground ID7501; tagged atomic alert IDs. Existing NFT prefs and mint state machine are reused. Command setup now runs on the main handler. The existing strict Boolean-status gate rejects failed/incomplete results before callers can advance, preserving the own:true compatibility retry. Transfer departure requires a complete valid coin list. The mint balance check now rejects null/malformed rows using the existing CmdChain rule. Settings describe the embedded node.

Validation: 67 unit tests (59 donor tests plus8 boundary regressions), all18 snapshot/provenance verification, transport guard and diff check pass. Three disposable-emulator checks pass: all18 module locale flags; NFT selection/send values/cursor; cached mint draft/amount/cursor through en,zh-Hans,ru,uk without activity recreation or node startup. The final malformed-row tightening was verified by its JVM regression and rebuilt APK after the device run. Emulator5562 stopped. Evidence: build/localization/nft-validation.json.

Remaining: minimaWallet import with shared initial seed, classic key-use coordination and seed/reset paths; full NFT and other app/core text coverage. Before release, review NFT metadata/transfer budgets against larger block-mode signatures (the donor assumes an8400-character creator signature), and complete financial-flow/interrupted-operation/lifecycle review. No live seed, funds, standalone donor edits, signing, commit/push or publication occurred.


## minimaWallet library and seed-counter checkpoint

Imported `apks/wallet` 0.2.21 at `7802aba475679ed9fe04dce9c480e834248d98a8` as the 19th reproducible library. The previous 18 snapshots remain byte-identical. The library uses the host's existing node jar, replacing the donor's duplicate 47 node classes; 39 were identical and the eight differences were inspected. Its derivation is explicitly classic 64x3 regardless of the node's global block mode. Existing transaction byte round-trips and signature verification pass with the host jar.

Reused Parlons `walletshared/com/eurobuddha/wallet/PrefsKeyUses.java` for process-wide locking and namespaces, with isolated mirror files, nonnegative validation and classic exhaustion checks. The production SeedVault selects a namespace from a full hash of the canonical seed. Create/open/import/restore select the candidate counter before making the session visible; a starting count raises all64 classic keys. Re-importing a seed preserves its higher counters. Vault handles are tied to an unlocked generation and revoked by lock/reopen/seed replacement. Trust is published only after persistence succeeds; uncertain blob writes lock the session. AddressBook caches now use one file per seed, preventing an old derivation worker from overwriting another seed's cache.

54 JVM tests pass (40 donor plus14 integration/lifecycle cases), including independent instances, either mirror failing, stale restores, seed switching, all64 counters, expired handles, failed trust writes and uncertain SharedPreferences commit behavior. All19 snapshot/provenance checks, direct transport guard and diff checks pass. Evidence: `build/localization/wallet-counter-validation.json`; source provenance: `localization/wallet-provenance.json`.

This is an imported-library checkpoint. minimaWallet is not yet linked into the host app or drawer. Still required: shared initial node seed and creation floor UI; coordination with node-owned classic signing counters; seed-change controls; strict backup payload/container validation; review and cancellation of stale UI/network callbacks; Future Cash access to its public key set; full localization and runtime/device validation. All other release gates remain open. No live seed/funds/node/device, signing of release APKs, commit/push or publication occurred.


## minimaWallet node-counter coordination checkpoint

The host now links the minimaWallet library and installs its node-readiness/app-lock gate. `EmbeddedWallet` checks startup, shutdown/restore, database identity, key readiness and open wallet state under the node database read lock and wallet monitor. `NodeKeyUses` reconciles classic counters against validated node rows, reserves locally before advancing an owned node key, verifies the compare-and-set result and flushes with H2 CHECKPOINT SYNC before returning a leaf. Confirmed absence remains a local key; SQL failures and malformed rows refuse signing. No node keys or owner seeds were generated/read by this validation.

67 wallet JVM tests pass, including real temporary H2/node Wallet concurrent signature checks, reopen persistence, failed query/update/flush/local mirror, exhausted and malformed counters, and readiness/database replacement gates. Pandamonium debug assembly passes. All19 importer snapshots/provenance reproduce and diff check passes. Evidence: `build/localization/wallet-node-coordination-validation.json`. This supersedes the earlier statement that the wallet is not a host dependency; no drawer entry or device validation yet.

Future Cash Next dual-family support remains in the candidate: classic64x3 and block128x4 rows are classified independently, witness-confirmed reuse covers both, classic recovery estimates remain separate, and incomplete evidence cannot authorize a complete result. Its current52-test suite is passing (Gradle reported UP-TO-DATE on the latest check). It currently covers node-returned keys. Connecting minimaWallet's separately derived classic public keys remains a release requirement.

Still required before release: shared node-seed setup and creation floor UI, seed/reset controls, strict VaultBlob/container validation, asynchronous setup and stale callback fencing, public-key audit integration, full four-language coverage and runtime/lifecycle checks. No signed release, commit, push or publication occurred.


## minimaWallet backup and reauthentication checkpoint

The v1 portable format and existing AES-GCM/PBKDF2 implementation are retained. VaultBlob now validates the complete schema before applying any counters: correct version/types, nonempty phrase, nonnegative exact integer counts and canonical indices; duplicate fields/indices, malformed UTF-8 and unexpected arrays/objects are rejected through the bundled JSONParser container factory. Exhausted/higher stored counts remain preserved. The bounded input reader reuses PandaDEX MinimaAPIResponse's loop with a4MiB container cap; v1 salt/nonce/tag lengths and KDF work (up to1,000,000 iterations; existing writer210,000 unchanged) are checked before decryption. Stored hexadecimal containers are bounded before decoding.

Settings now verifies the passphrase through the existing decrypt/parse path without reopening the vault. This avoids revoking the active transaction factory's generation during seed reveal, biometric setup or passphrase changes. Actual reopen/lock/seed replacement still revokes old handles. Node/counter unavailability has its own unlock exception and retry message; a stopped node is no longer reported as a damaged backup.

All78 wallet JVM tests pass, including11 new input/authentication regressions, and the Pandamonium debug APK builds. All19 import snapshots/provenance reproduce, other18 remain unchanged, and transport/diff checks pass. Evidence: build/localization/wallet-backup-validation.json. No new device tests or release signing/publication in this checkpoint.

Next implementation remains shared-node-seed setup and classic creation-floor controls, seed replacement, stale callback/operation fencing and asynchronous expensive work, minimaWallet public keys in Future Cash, full four-language inner-screen coverage and release validation. Do not repeat completed audit/backup checks without a new change; proceed with these open implementation tasks. Goal remains active.


## minimaWallet shared-seed setup, controls and background work

Default first setup now offers the Pandamonium node seed and a classic key-use floor. EmbeddedWallet reads the seed internally under the existing node readiness/database/wallet guards and verifies phrase-derived bytes against the node SeedRow. SeedVault.importNodeSeed derives/reconciles the64classic keys outside the long node monitor, then rechecks the node phrase before committing the encrypted vault under that monitor. Seed changes during setup refuse the commit. Higher counts are never lowered and block-based key positions remain separate.

Settings offers authenticated replacement with the node seed, a different imported seed or a newly generated seed. It reuses the donor forms and confirmation flow, clears biometric enrollment after seed setup, and keeps prior seed-specific counters. Classic floor controls now remain available after the vault becomes trusted. Node transport and late callbacks are bound to a captured session identity through the existing DirectNodeApi authorization callback. Lock/reopen/replacement invalidates old identities; signing confirmations and Settings confirmations reject old sessions. Connection teardown releases old wallet/core references and file callbacks; address derivation uses a captured book/session.

Setup, generated-seed creation, typed/biometric unlock and manual floor updates now run on one session-owned WalletWork executor, with main-handler completion (HistoryScreen pattern). Duplicate operations are refused until completion delivery; a recreated screen observes the same operation. Background completion or a requested lock leaves the vault locked, and clears the background marker so a later explicit unlock succeeds. Other expensive Settings/backup/transaction operations still need runtime review and possible worker migration.

Validation:91wallet JVMtests pass (13new tests cover shared seed/floor behavior, seed changes mid-setup, session revocation, DirectNodeApi queue guards/late reply cancellation, worker exclusivity/replaced observers/errors). Host Pandamonium debug assembly, all19 importer/provenance, transport and diff checks pass. Other18snapshots unchanged. Evidence: build/localization/wallet-setup-validation.json.

No setup device checks, full wallet text localization or drawer entry yet. Before enabling: exercise actual lifecycle/background behavior and unavailable node during startMain/completion, review sensitive dialogs on auto-lock, complete remaining worker/error handling, connect minimaWallet public keys to FutureCash, translate wallet and all remaining integrated/core screens, then signed release gates. No owner seed/live node/funds/device, release signing, commit/push or publication occurred. The prior node-mode question is not blocking: minimaWallet explicitly uses classic keys while the host retains its selected mode.


## minimaWallet setup language checkpoint

Added70wallet messages in English, Simplified Chinese, Russian and Ukrainian (219total catalog entries). `scripts/adapt-pandamonium-wallet-languages.py` reuses Language, LanguageDialog and the History adapter pattern. Onboarding, import/generated-seed prompts, unlock, seed replacement choices, status banners, tab names and classic floor controls carry live CharSequence bindings. Seeds, passwords, numeric inputs and protocol values remain literal. Corrected the inherited seed-backup wording and floor warnings; floor errors now state the actual inclusive upper bound262143.

All91wallet JVMtests and9localization tests pass. Allthree bear debug builds pass. Five disposable-emulator tests pass: four wallet tests cover import draft/cursors/open confirmation, hidden node seed input, retained unlock passphrase and retained floor dialog input; the fifth checks configuration flags for all19integrated modules. No seed was imported and no node was started. Screenshots inspected for Russian import, Ukrainian/Chinese confirmation and Russian/Ukrainian floor dialogs; labels/buttons fit. Emulator5562 stopped. All19 importer snapshots/provenance reproduce; other18imports unchanged. Evidence: `build/localization/wallet-languages-validation.json`.

This completes setup language binding/device validation, not the whole wallet integration. Next: remaining wallet inner screens and financial dialogs/translations, unavailable-node/startMain and background lifecycle recovery, sensitive dialog dismissal, remaining expensive operations, minimaWallet public keys in FutureCash and drawer enablement. All other app translations and final release gates remain open. Do not repeat completed FutureCash or setup checks unless affected by new work. No release signing, commit/push or publishing occurred.


## minimaWallet balances, transfer, receive and history language checkpoint

Added82messages/plurals in allfour languages (301total catalog entries,152wallet entries). `scripts/adapt-pandamonium-wallet-tabs-languages.py` adapts BalancesView, SendView, ReceiveView and HistoryView after the setup adapter. Visible labels and composed transaction/history details use live messages. Sender draft inputs, mode/token selection, receive address/index and QR bitmap remain unchanged during language changes. History direction IDs and exported CSV/JSON values/date formats stay literal; display dates use Language.stamp. Send/split/consolidation review math, selection, key-use checks and actual transaction builders are retained. Native plural categories now handle coin counts correctly in English/Russian/Ukrainian; token names are labelled Token and identifiers Token ID.

Validation:91wallet JVMtests and9localization tests pass; allthree debug APKs build. Four disposable device cases pass: all3transfer forms plus open dry-run reviews, receive index/address/QR retention, token metadata/amount retention, history filter/details and byte-identical CSV/JSON across all4languages. Transfer/history cases passed again after plural correction; filter test uses the actual chip tap handler. Tests use synthetic public addresses/coins and counters that refuse writes; no seed import, signing, broadcasting or live node. All19import snapshots/provenance reproduce; other18unchanged. Transport/catalog/diff checks pass. Inspected Russian send, Chinese split, Ukrainian consolidation and history screenshots, including corrected Russian/Ukrainian count forms. Isolated tab fixtures intentionally omit the host header/insets; complete host layout/large-font review remains separate. Emulator5562 stopped. Evidence: build/localization/wallet-tabs-validation.json.

Next wallet translation work: Settings/backup, NFT tab, remaining MainActivity and biometric text, and lower-layer error messages currently shown raw. Then finish the previously recorded unavailable-node/startMain recovery, background/lifecycle and sensitive-dialog work, expensive operations, extra public-key audit integration and drawer entry. Full other app/core translations and signed release/publication gates remain open. No commit, push, release signing or publishing in this checkpoint.


## Wallet backup/session language checkpoint — 2026-10-16

Added scripts/adapt-pandamonium-wallet-settings-languages.py after the existing wallet tab adapter. Reuses SettingsView dialogs, LanguageDialog/bindings and the host BiometricUnlock localization pattern.56new entries,357catalog total,208wallet entries. Seed reveal authentication, encrypted export/restore prompts, passphrase change, biometric controls and auto-lock labels are translated in all4languages. Timeout labels preserve the SessionPolicy durations. Password fields and existing listeners remain in place. The biometric platform prompt resolves labels when opened.

Corrected explanatory copy: backup restore needs the file and its password; changing the local password leaves existing exported backups on their original password; the biometric CryptoObject prompt requires strong biometrics and does not offer device PIN. Key-use/crypto/backup algorithms were retained. Existing main-thread expensive operations and session/sensitive-dialog concerns remain release gates.

Validation:91wallet and9localization JVMtests pass; all3debug builds pass.5device checks pass on the stopped-node disposable emulator: password-change/export/authentication drafts, timeout index and actual30minute selection, platform PromptInfo labels/authenticator configuration. Inspected Russian password-change, Chinese export and Ukrainian timeout screenshots. No biometric enrollment, seed reveal, backup export/restore, node or transaction was performed. All19imports reproduce, other18snapshots unchanged; transport/catalog/diff checks pass. Evidence build/localization/wallet-settings-validation.json. Emulator stopped.

Next: remaining Settings Security/node/diagnostics/historic-coin recovery, NFT tab, residual MainActivity/lower-layer errors; then the recorded wallet runtime/session/background/sensitive-dialog and expensive-work gates, extra minimaWallet public keys in FutureCash and drawer integration. Other core/app translations, lifecycle/accessibility/API<33 checks, signing and GitHub/PandaApps/eurobuddha publication remain. Nothing committed or published in this checkpoint.


## Remaining wallet Settings and NFT evidence checkpoint — 2026-10-16

Added scripts/adapt-pandamonium-wallet-settings-details-languages.py after the existing Settings adapter.66new messages,423catalog total,274wallet entries. Settings security/counter warnings, node status, design labels, diagnostics and historic-coin recovery now use all4languages. Reuses Language.TextBuilder for live diagnostic/recovery prose; raw response fields/JSON, coin proof input, addresses and copied commands stay literal. Updated standalone-pairing instructions to embedded-node behavior and removed the inaccurate promise that reinstalling alone restores counters. Fresh-seed confirmation preserves known higher counters in its wording.

Three new device cases passed: both safety dialogs retain identity without trusting/opening the vault; rendered Settings retains the coin-proof draft/cursor and resync command; diagnostic report and copied text preserve exact raw JSON/amounts/IDs/non-English metadata across all4languages. Inspected Russian backup attestation, Ukrainian unused-seed warning and Chinese diagnostic screenshots. No node, seed, coin import, signing or resync was performed.

Inspected the complete NftView.java gallery/viewer/details/item-send/collection-send/confirmation/retry paths and MainActivity.confirmSignAndPublish. Found false confirmation when the coin response was missing/malformed. Reused integrated/NFTwallet StateNftActions.watchDeparture and Util.isValidHexId checks via scripts/adapt-pandamonium-wallet.py; wallet NodeApi passes false status results, so added an explicit Boolean.TRUE status gate. The pending list changes only after every row validates. New NftConfirmationEvidenceTest exercises the real polling path with null/missing/failed/string-status/malformed payloads plus partial and complete valid responses.

Validation:92wallet JVMtests and9localization tests pass; all3debug builds pass, Pandamonium rebuilt after the NFT fix; all19imports reproduce, other18snapshots unchanged; transport/catalog/diff checks pass. Evidence build/localization/wallet-settings-details-validation.json. Emulator stopped. No release signing, commit/push or publication.

Next: translate NFT tab using the inspected existing dialogs and MainActivity confirmation bridge (currently String, needs CharSequence live binding like SendView). Read Nft.java and transaction NFT tests before adapting its metadata/send review composition; donor has no NftView UI tests. Keep literal collection names/artwork/state/coin IDs. Remaining NFT runtime concerns include the poll-timeout retry claim and stale session/batch behavior; do not treat the targeted evidence fix as complete NFT flow approval. Remaining wallet runtime/expensive/sensitive-dialog/public-key audit and drawer requirements, other app/core translations and final release gates persist.


## Wallet NFT language checkpoint — 2026-10-16

Added scripts/adapt-pandamonium-wallet-nft-languages.py using the existing NftView gallery/browser/viewer/recipient/collection flow, SendView live review composition, Language.TextBuilder and LanguageDialog.65new NFT entries include3native plurals;488catalog total in English, Simplified Chinese, Russian and Ukrainian. Gallery status, accessibility descriptions, details, item/collection reviews, progress and reports carry live bindings. MainActivity.confirmSignAndPublish now accepts CharSequence and retains dynamic body/key-use/button text; scanner prompt resolves the selected language. Metadata, IDs, amounts, state, recipient, artwork and transaction builders stay literal/unchanged. Nft.java and TxnFactory NFT state-preservation tests were read before adaptation.

Corrected inherited report copy: hiding the confirmation dialog stops that watcher, and a timeout does not prove coins safe to resend. The retry implementation and stale-session/batch behavior still require runtime review. A separate inherited detail label calls every StateNFT a locked edition; reuse Nft.isLockedScript to distinguish legacy scripts in a subsequent correction. The fluent LanguageDialog chain must remain assigned to the base AlertDialog.Builder type because inherited setView returns the base builder.

Validation:92wallet and9localization JVMtests pass; all3debug builds and Pandamonium testAPK build pass.4device cases pass on the disposable stopped-node emulator: selected gallery artwork/viewer/dialog identity and details/clipboard; recipient draft/cursor; collection review skipped-item counts/self-send/recipient/key uses; common single-item signing review. Allfour languages exercised; confirmations cancelled before signing. Inspected Chinese details, Russian recipient and Ukrainian collection review screenshots. Isolated fixture lacks host header/insets; full host layout and large-font checks remain separate. All19import snapshots/provenance reproduce; catalog/transport/diff checks pass. Emulator5562 stopped. Evidence build/localization/wallet-nft-validation.json.

FutureCash dual-key implementation and recorded52passing unit tests remain unchanged: node-returned classic64x3 and block128x4 keys are audited together, with separate capacities, classic-only recovery estimate and witness-reuse checks for both. Extra independently derived minimaWallet public keys remain an integration requirement. No release signing, commit/push or publication occurred.

Next: residual MainActivity/lower-layer text, wallet unavailable-node/background/session/sensitive-dialog/expensive-work checks, NFT retry and legacy label correction, extra audit keys and drawer entry. Other core/integrated translations and signed release/publication gates remain open. Goal active.


## minimaWallet public keys in Future Cash — 2026-10-16

Completed the previously open public-key connection. scripts/adapt-pandamonium-wallet-audit.py runs after the language adapters and preserves pinned standalone donors. New PublicAuditKeys reuses the seed namespace, NodeKeyUses public-key derivation cache and PrefsKeyUses MAX-on-read mirrors. The encrypted blob and public descriptor are written in the same SharedPreferences commit during setup, restore, password changes, sync and unlock. Reads never decrypt or derive keys. A configured vault with missing/corrupt/incomplete metadata refuses the audit until refreshed; no configured wallet yields an empty additional set. Untrusted counts stay unknown. All64base keys and every recorded higher index are included.

FutureCash now depends on the existing integrated-wallet module and Cfg provides the public snapshot. AuditKeySet combines it with node keys, deduplicating shared valid classic keys using MAX counts as NodeKeyUses does; node block keys stay separate. Contradictory valid families for one public key are rejected. No counter is advanced by an audit. AuditRunner checks this combined set through the existing chunked endpoints and verifies that the wallet snapshot did not change during the request. Changes preserve discovered risks but cannot publish a complete result. The wallet-keys-v1 cache version rejects earlier snapshots; seed/trust/count/key-list changes invalidate even a fresh result, and offline re-confirmation compares the combined set.

Validation:102wallet and63FutureCash JVMtests pass (21new regressions). Actual vault create/unlock/password-change/backup-import paths publish correct descriptors; backup attestation preserves the restored count. Mock HTTP runner tests prove all3sets requested, missing wallet results remain partial, and in-flight changes reject completion. Two guarded Android tests pass using isolated preference namespaces and a deliberately nondecryptable fixture vault: all64keys and mirrored MAX are read while locked; counter changes/missing metadata revoke fresh audit permission. No owner node/seed/funds/device was used. The Android checks did not derive keys, sign, make network requests or perform transactions; the existing JVM suite uses disposable synthetic signing fixtures. Emulator5562 stopped.

All3debug builds pass, Pandamonium rebuilt after the final family-conflict guard. All19import snapshots/provenance reproduce, other17unchanged; catalog remains488messages in4languages; transport/catalog/diff checks pass. Evidence build/localization/wallet-audit-validation.json. This supersedes earlier notes that extra minimaWallet public keys remain unconnected. No commit, push, release signing or publication occurred.

Next: finish wallet runtime/node-unavailable/background/session/sensitive-dialog and expensive-work checks, remaining MainActivity/lower-layer text, NFT retry/legacy-label correctness and drawer entry. Other core/integrated inner translations, accessibility/API/lifecycle validation and signed publication gates remain. Goal active; this checkpoint is concrete progress, not release completion.


## Wallet interruption, dialog cleanup and NFT sessions — 2026-10-16

Added scripts/adapt-pandamonium-wallet-runtime.py after the public-audit adapter. WalletDialog subclasses the existing LanguageDialog (shared class made extensible; translation behavior unchanged), and WalletDialogs tracks wallet alerts/fullscreen NFT dialogs without replacing their on-show/on-dismiss listeners. stopWalletConnection revokes the connection then dismisses its dialogs. Seed dialogs use the existing ETH Wallet/Parlons FLAG_SECURE pattern, close/clear visible text on pause and disable text selection; seed entry/generation/verification and unlock windows also set FLAG_SECURE. Public wallet/onboarding screens clear that activity flag. Returning with a closed vault and existing wallet references now shows unlock and clears dialogs.

Settings no longer crashes while constructing/refreshing if NodeKeyUses.currentUses cannot reach the node. It shows translated unavailability, retains other controls and recovers on refresh; floor and shared-signing reviews refuse to open when counters are unavailable. Main setup failures clear connections and return to unlock; background address derivation catches recoverable failures. Two new four-language messages bring the catalog to490 (276wallet +65NFT entries).

Connection authorization now checks identity against a volatile mUiSession, so stopping/rebuilding the connection revokes old callbacks even when the vault generation stays open. NftView reuses SettingsView's captured session supplier in collection reviews, sequential resolve/build/publish/finish callbacks, confirmation polling, retries and reports. A queued poll cannot dereference the cleared node before the dialog's asynchronous dismiss listener runs. Three new JVMcases prove a revoked batch cannot start, a delayed input reply cannot build/sign, and a delayed publish reply cannot continue. The existing confirmation-evidence regression also covers a revoked queued poll. Legacy StateNFT details now use Nft.isLockedScript before claiming locked edition.

Validation:105wallet and9localization JVMtests pass. All3debug builds pass, Pandamonium rebuilt after the final identity/volatile guard. Seven disposable device cases pass:5new cases cover unavailable Settings/main/reviews and recovery, startup failure cleanup, protected/nonselectable seed dialog cleared on pause, language-preserved dialog draft followed by locked-resume cleanup/revoked authorization, and protected seed-entry/unlock windows retaining draft/cursor across all4languages. Existing password-draft and NFT gallery/viewer/details language cases rerun and pass. Empty disposable vault, synthetic counter failures and literal display/import drafts only; no seed import, node, owner data/device or financial operation. Emulator5562 stopped. All19import snapshots/provenance reproduce; other18unchanged; transport/catalog/diff checks pass. Evidence build/localization/wallet-runtime-validation.json.

Next: migrate remaining expensive Settings authentication/backup/restore/signing work onto the existing session worker and validate background/biometric/rotation behavior; repair NFT timeout retry to obtain fresh chain evidence instead of cached act.coins(); finish residual MainActivity/lower-layer texts and then enable the wallet drawer entry. Other core/app inner translations and final accessibility/API/lifecycle/signing/publication remain. Public-key FutureCash integration is complete from the prior checkpoint (63tests), do not redo it without new changes. No release signing, commit/push or publication. Goal active with concrete progress.


## NFT retry evidence and renewed review — 2026-10-16

Added scripts/adapt-pandamonium-wallet-retry.py after the wallet runtime adapter. Reused integrated/wallet/src/main/java/com/eurobuddha/wallet/NftView.java collection review, pending state and confirmation watcher; integrated/wallet/src/main/java/com/eurobuddha/wallet/comms/NodeLink.java coinsRelevant read; integrated/wallet/src/main/java/com/eurobuddha/wallet/MainActivity.java JSON parser and existing byte-exact input resolution; and integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/StateNftActions.java departure validation pattern. The inspected standalone donor at /Users/eurobuddha/Projects/minima/apks/wallet/app/src/main/java/com/eurobuddha/wallet/NftView.java retries cached act.coins() directly and expires pending entries after ten minutes. It remains pinned and unchanged; the adapter makes the minimum integrated change around those paths.

Timeout and cached gallery refresh no longer release pending coins. Ten minutes enables a review entry in collection tiles and the fullscreen viewer; the collection action and fifteen-minute timeout report also reach the fresh query. A successful Boolean status, complete array, valid unique IDs, matching ownership/token and stamped locked state are required. Malformed or failed replies retain pending state. Requested coins genuinely absent from the validated reply are removed; present coins stay pending until the new review is explicitly approved. Cancelling does not release them. Pending snapshots and captured session authorization reject stale replies/reviews. The existing byte-exact coinexport and signing/counter code remain unchanged. The review explains that the prior transaction may still confirm. Existing confirmation polling now rejects duplicate IDs and compares hex IDs without case-sensitive false departures.

Validation:111wallet and9localization JVM tests pass, including6new retry regressions. Three device cases pass: fresh-review text/recipient/pending state across all4languages, reachable review actions from aged pending tiles/viewer, and the existing collection review. The first device launch suffered a BIND APPLICATION ANR before test results while emulator CPU pressure was high; retained logs exclude it from passing evidence. The unchanged rerun passed all3 in46.151seconds. All3debug builds pass. All19import snapshots/provenance reproduce, other18unchanged; catalog/transport/diff checks pass. Catalog492 entries (67NFT). Evidence build/localization/wallet-retry-validation.json. Emulator5562 stopped; no owner node, wallet, seed, funds or device used.

The latest user request for Future Cash Next to audit classic and blocksaskeyuses keys is already implemented in Pandamonium. Rechecked KeyAudit/DualKeyAuditTest and prior63test evidence; public-audit source hashes match the recorded checkpoint. Per-key shapes/capacities remain separate, witness reuse applies to both families, classic spend-count estimation remains classic-only, and incomplete evidence cannot authorize a complete audit. Independently derived minimaWallet keys remain included. Expanded graph query terms: future cash audit keys classic block. No new FutureCash implementation was needed.

Next: finish expensive Settings work through WalletWork, wider lifecycle/biometric/rotation checks, residual MainActivity/lower-layer text and wallet drawer entry, then remaining core and integrated inner translations and final accessibility/API/signing/publication gates. The NFT timeout/cached-retry item is now complete. Pending tracking remains scoped to this process; this checkpoint does not claim durable transfer tracking or real transaction tests. All work remains uncommitted/unpublished; goal active.


## Wallet Settings work and biometric session guards — 2026-10-17

Added scripts/adapt-pandamonium-wallet-settings-work.py after the retry adapter. Reuses WalletWork/WalletSession and existing History file-stream pattern. Authentication, counter/trust persistence, backup read/encryption/write, restore and password replacement now run on the session worker. UI delivery waits for foreground and validates connection plus the post-operation vault generation. Each Activity retains its own error, so a later job cannot overwrite a paused result. Expired file-picker returns are rejected before work starts. Password fields clear after submission; seed text is read only during authorized foreground completion.

Biometric requests reject old, revoked, paused and destroyed callbacks before storage/decryption. Synchronization serializes callback storage with background credential invalidation. Successful seed restore/password change disables the previous biometric credential. Vault algorithms, counter MAX rules and transaction construction remain unchanged. Actual transaction signing and keystore preparation are not claimed migrated by this checkpoint.

Validation:125wallet and9localization JVM tests pass, including10new authenticated-worker and4biometric lifecycle/race cases. Four Android cases pass on the identity-verified Bears AVD at emulator-5580: responsive translated progress, deferred paused completion, lock-before-return and expired deferred-file authorization. Initial test launch had BIND APPLICATION ANR before tests and is excluded. Port5562 had been reassigned to another AVD; its install was rejected as booting and the retry was interrupted before installation. Subsequent work used5580 with an enforced AVD identity assertion. No owner device/node/seed/funds used. All3debug builds pass; final Pandamonium/testAPK rebuilt. All19imports reproduce; other18unchanged. Catalog494 entries,278wallet and67NFT. Evidence build/localization/wallet-settings-work-validation.json. Emulator stopped.

Future Cash Next already audits node classic and blocksaskeyuses keys plus minimaWallet public keys. Re-read KeyAudit.java/DualKeyAuditTest.java and graph memory query_20261016_224545; all public-audit checkpoint hashes still match the63-test evidence. No new audit implementation needed. Next: transaction signing worker paths, wider lifecycle/rotation checks, residual wallet text/drawer, remaining core and19app translations, accessibility/API checks, signed releases and authorized publication. No commit, push or publication; goal active.


## Wallet signing on the session worker — 2026-10-17

Added scripts/adapt-pandamonium-wallet-signing-work.py after Settings work. Reused WalletWork, MainActivity.runAuthenticatedWalletWork, SeedVault authorization/reservation and the existing gate→build→finally snapshot ordering from standalone/integrated MainActivity, SendView and NftView. Compared ETH Wallet's worker broadcast flow; retained the wallet's existing guarded NodeLink publishing sequence.

Send/split/consolidate, individual NFT sends and sequential collection items now build/sign on WalletWork after explicit review approval. The helper checks the captured connection before the gate; the existing vault generation token guards counters and delivery. Snapshot failure cannot mask the original build failure; a completed signature still reaches delivery when the vault remains authorized. Paused results wait for foreground; locked/replaced results cannot publish. Builders capture the reviewed factory and token ID instead of reading mutable Activity/selection state on the worker. Send input-resolution and broadcast callbacks now reuse a captured connection guard. Collection pending reads remain on the main thread; existing sequential publishing/stop-after-current behavior remains.

Validation:134wallet and9localization JVM tests pass;9new cases cover queue ordering, gate refusal, partial build/snapshot errors, replacement before work, approval-before-build, delivery-before-publish, revoked results, captured collection factory and stale send resolution. Two Android cases pass on identity-verified emulator5580: actual signing dispatcher runs a synthetic callback off-main, keeps the same progress dialog through4languages and returns to main; send/split/consolidate drafts, cursors, review labels, amounts, key uses and recipient survive all4languages. Tests do not sign or broadcast. The public-review fixture now supplies an explicit UI connection while its vault gate/counters still prohibit signing. Pandamonium and test APK build; other2flavors unchanged from previous passing builds. All19import snapshots reproduce; other18unchanged; transport/catalog/diff checks pass. Catalog494messages. Evidence build/localization/wallet-signing-work-validation.json. Emulator stopped. A test-only syncKeyUses override initially omitted the varargs parameter; corrected before the successful build/run. An initial Gradle command used the wrong module name; correct integrated-wallet task passed.

FutureCash public-audit source hashes remain unchanged from the63-test checkpoint. No release signing, commit, push or publication. Remaining wallet work: residual MainActivity/lower-layer translations, initialization/keystore performance review, broader rotation/lifecycle checks and drawer entry. Then finish remaining core and19app inner translations, formatting/accessibility/API checks and signed versioned releases to GitHub fork, PandaApps and eurobuddha.com. Goal active with concrete progress.


## Wallet errors in four languages — 2026-10-17

Added85catalog messages:579total,363wallet and67NFT. Reused Parlons SystemMessages.java and SystemMessagesTest.java from maxima/build/account-import: explicit fixed lookup, anchored numeric/data templates, literal immutable arguments and diagnostic recursion limited to8. Exact source hashes are in localization/wallet-provenance.json. New localization/wallet-errors.json declares81fixed failure strings and25templates; scripts/adapt-pandamonium-wallet-error-languages.py generates WalletMessages and adapts only MainActivity/SettingsView/SendView/NftView display boundaries. Exception messages, types, command strings, token metadata, JSON, counters, cryptography and transaction code remain unchanged. Unknown diagnostics stay literal. Captured amounts/hex/counters are not parsed or reformatted. Only declared diagnostic captures recurse; addresses and raw node-error details stay literal.

Covers vault/password/counter/signing guards, backup I/O, coin selection and preparation, token integrity and node transport failures. Review corrected over-specific grouped wording: missing payloads are distinct from oversized files, signing reservations and node rows keep distinct meanings, and token-descriptor wording applies to fungible tokens and NFTs. A direct UI-label scan found only the Minima Wallet brand, CSV and the internal wrong-passphrase sentinel comparison. This scan does not prove whole-app coverage by itself; final wallet coverage/lifecycle checks remain.

Validation:139wallet and9localization JVMtests pass, including5new cases covering every mapping/template, unknown/malformed text, raw amounts, bounded recursion and a real CoinSelector failure without signing. One guarded Android case passes: an open error dialog switches all4languages in place, preserving draft/cursor, numeric spelling and literal multilingual/HTML-like diagnostic data. All3debug builds and testAPK pass. All19imports reproduce; other18snapshots unchanged; transport/catalog/diff checks pass. Evidence build/localization/wallet-error-languages-validation.json. Test-only APIs were adjusted to match the donor's readAllBytes/JSONObject.keys compatibility. No owner data/device, node, seed or transaction used. Bears emulator5580 stopped.

Source update: live standalone wallet changed to0.2.22 at0b601b8f62d88f0948d8d72bbb565be515f4c7ed during this work, adding SweepFlow/SweepPlanTest and editing Settings/NftView. Import stopped on the lock mismatch before replacing snapshots. The exact pinned0.2.21/7802aba475679ed9fe04dce9c480e834248d98a8 commit was reconstructed under build/localization/pinned-sources/wallet; all locked provenance and source hashes match. Other18 entries in this overlay reference the unchanged original donor directories. Current importer commands MUST set PANDAMONIUM_SOURCE_ROOT to this worktree's build/localization/pinned-sources. No donor code or active donor checkout was changed. Review the new standalone sweep feature for compatibility separately; do not silently adopt it or repeat verification against the moving live wallet.

Remaining: wallet initialization/keystore performance and final text/rotation/lifecycle coverage, drawer entry; then remaining core and19integrated app translations, locale-sensitive formatting, accessibility/API checks and signed versioned release publication. FutureCash classic/block plus independent wallet audit hashes still match the63-test checkpoint. No commit, push, release signing or publication; goal active.


## Shared restore and resync languages — 2026-10-17

Added 46 messages, bringing the four-language catalog to 625. RestoreWalletSyncActivity now reuses NewWalletRestoreActivity's Language/logger validation pattern. The classic, block and Pandamonium warnings retain their distinct meaning, including incompatible address derivation and the requirement for a floor above every previously used signing index. Pandamonium's mode descriptor reuses the drawer label. Seed text, key-use input, host and cursor stay literal.

SeedSyncActivity uses LanguageDialog and live bindings for confirmations, errors, progress, elapsed time and interrupted-operation summaries. Persisted Resync/Restore/Seed restore names and raw node logs remain unchanged. Interrupted restores now retain their correct heading and hide host-resync-only controls. ResyncJob, ResyncSession and ResyncLauncher are byte-identical to HEAD, including validation, command construction, password redaction, restart and persistence behavior.

SeedSyncServiceActivity reuses LanguageDialog for its progress title/message with an indeterminate indicator. Key-generation counts and MegaMMR host updates bind in place. Timeout and error prompts translate while raw node errors remain literal. The progress window dismisses on destruction, and late error UI refuses a destroyed activity. No node command or key derivation changed. Debug-only SeedSyncHarnessActivity reuses the StartupHarnessActivity service boundary and prohibits real foreground services, binding and node navigation.

Validation: 33 existing resync/startup-mode JVM tests and 9 localization tests pass. Twelve Android cases pass across all three Bears: 3 screen tests plus 1 seed-sync progress test per flavor. They cover all four languages, draft/cursor preservation, variant-specific restore warnings and limits, open confirmations, host errors, interrupted operation names, unchanged raw logs, recreation, and progress stages without repeated service/key work. No owner data/device, real node, seed restoration, key creation, signing or transaction was used. Ukrainian confirmation and progress screenshots were visually inspected and fit. All three debug and test APKs pass; all 19 pinned imports reproduce; catalog, transport and diff checks pass. Evidence: build/localization/restore-resync-languages-validation.json. Disposable emulator 5580 is stopped. No failed test runs in this batch.

Future Cash Next's classic/block and independent wallet audit source hashes still match its 63-test checkpoint. The wallet donor remains pinned to 0.2.21 using build/localization/pinned-sources; the live standalone 0.2.22 sweep update was not adopted. No release signing, commit, push or publication. Remaining work includes shared backup/vault/startup and other core screens; remaining integrated-app text; wallet initialization/keystore performance, final lifecycle/rotation checks and drawer entry; formatting/accessibility/API checks; signed versioned releases to GitHub fork, PandaApps and eurobuddha.com. Goal remains active.


## Shared backup and private-key vault languages — 2026-10-17

Added 116 messages, bringing the catalog to 741 in English, Simplified Chinese, Russian and Ukrainian. BackupActivity, BackupCreateActivity, RestoreFileActivity and VaultActivity now reuse Language/LanguageDialog for headers, rows, warnings, validation, progress and confirmation dialogs. NodeKeys.Status.message returns a live CharSequence; its readiness values and node reads are unchanged. PasswordField uses live hints, errors and show/hide accessibility labels. Existing catalog entries are reused where their full English text and meaning match, including menu.backup, Restore, Unlock and Working. File dates use the established Language.stamp binding; file names, paths, node sizes, passwords, seeds and the RESTORE confirmation token remain literal.

SeedSyncActivity.launchError is now a public static display helper reused by file restore and vault rebuild; it also maps the two known restore-in-progress refusals. ResyncJob, ResyncSession, ResyncLauncher, BackupRun, NodeFiles and VaultCommands remain byte-identical to HEAD. Import/export/delete, command validation, counter limits, retention and byte-copy safeguards are unchanged.

Review found an existing reveal-toggle bug: visible password variation 0x90 still contains the password bit 0x80, so the old bit test could not hide it on a second tap. Kept PasswordField's existing input-type/cursor logic and compared TYPE_MASK_VARIATION with TYPE_TEXT_VARIATION_PASSWORD instead. Android SDK constants were verified locally; Entropy's LastWordView reveal implementation was inspected as a sibling candidate. All four language tests now exercise show–hide–show, translated accessibility labels and cursor preservation.

Validation: 63 existing backup/resync JVM tests and 9 localization tests pass. Twelve new Android cases pass across all three Bears, plus all six existing BackupScreensTest cases on Classic. They cover blocked hub rows, live gates, password drafts and errors, reveal controls, export warnings, selected file preservation, the exact typed RESTORE token, refusal of REST, delete warnings without deletion, vault password/rebuild dialogs, and retained Activity FLAG_SECURE. Only a synthetic file was created on the identity-verified Bears emulator; bytes were checked and the file removed. No owner data/device, real node, seed restoration, key creation, signing or transaction was used. No screenshots were taken of the secure screens and no visual screenshot claim is made. All three debug and instrumentation builds pass; all 19 pinned imports reproduce; catalog/transport/diff checks pass. Evidence: build/localization/backup-vault-languages-validation.json. Emulator 5580 is stopped.

Initial test issues were corrected: the test referenced a new hub title instead of the reused menu.backup ID; the first runtime check incorrectly expected a null transformation for visible single-line text. The corrected assertions verify the actual password variation and masking. Initial logs are retained and excluded from the final 18-case result.

The worktree remains on feature/bear-languages-2026-10-16 at 9def96e6801a9bef261611e45349f28a1eb6ae1c, candidate 1.9.42/113. Future Cash Next's classic/block and independent-wallet audit hashes still match its 63-test checkpoint. Keep PANDAMONIUM_SOURCE_ROOT pointing to build/localization/pinned-sources; standalone wallet remains pinned to 0.2.21 and the live 0.2.22 sweep feature has not been adopted.

Next work: remaining core startup and node/wallet/chat screens, known lower-layer core diagnostics; remaining integrated-app inner translations; minimaWallet drawer entry and final lifecycle/initialization checks; locale formatting, accessibility and older-API validation; signed versioned releases in the established dist directory and publication to the GitHub fork, PandaApps and eurobuddha.com. No commit, push, release signing or publication yet. Goal remains active with concrete progress.


## Shared startup and parameter languages — 2026-10-17

Added 39 catalog messages (780 total) in English, Simplified Chinese, Russian and Ukrainian. StartServiceActivity reuses the live LanguageDialog and indeterminate ProgressBar construction already exercised in SeedSyncServiceActivity. Waiting, startup failure, timeout and service-connection retry dialogs retain their existing cancellation, binding, polling, retry and navigation behavior. The debug-only StartupHarnessActivity adds a synthetic service rejection and handles locale changes like the real activity; it never starts or binds a real service.

ParamsActivity now binds toolbar, all 18 XML labels, classic/block mode warnings, RPC copy labels, saved confirmation, restart confirmation and validation errors. Flags and raw extra arguments are literal; the RPC password is neither translated nor regenerated by a language switch. The existing blocked/managed flag lists, parameter parser, preference names and save-before-confirmation behavior are retained. StartupMode is byte-identical to the baseline. Platform yes/no resource labels use the same live message binding. No service or command implementation changed in this batch.

Validation: 3 existing StartupMode JVM tests plus 9 localization JVM tests pass. Fifteen new Android cases (5 per Bear, each switching through all four languages) pass, plus all four existing StartupLifecycleTest cases on Classic. Checks cover the same activity, open progress/error/timeout/retry dialogs, single service binding/start counts, retry after synthetic rejection, preserved draft/cursor/toggles/credential, literal blocked flags, managed classic-mode flag refusal, persisted settings and cancelled restart. Tests snapshot/restore only parameter preferences. They never approve restart or use an owner device, real node, seed, signing or transaction. All three debug and instrumentation builds, 19 pinned imports, catalog/transport/diff checks pass. No screenshots were taken; full visual/large-font checks remain open. Evidence: build/localization/startup-params-languages-validation.json. Disposable emulator 5580 stopped after checks.

Future Cash Next classic and block-as-keyuses audit plus minimaWallet public-audit source hashes still match the 63-test checkpoint. The graph query used actual vocabulary [future, cash, classic, block, key, audit, pandamonium]; its broad result points to Audit/AuditRunner, while the saved checkpoint and source hashes establish the working-tree status. No key-audit rewrite or new key creation was needed.

Candidate 1.9.42/113 remains uncommitted and unpublished on feature/bear-languages-2026-10-16 at 9def96e6801a9bef261611e45349f28a1eb6ae1c. Keep the pinned donor root; wallet remains 0.2.21 despite live 0.2.22. Remaining work: core node/wallet/chat/diagnostic text, other integrated-app inner translations, minimaWallet drawer and final lifecycle/initialization checks, locale formatting, older API/large-font/visual validation, signing and publication to GitHub fork/PandaApps/eurobuddha.com. Goal remains active.


## Core terminal, logs and pending languages — 2026-10-17

Added 17 catalog messages (797 total) in English, Simplified Chinese, Russian and Ukrainian. Both TerminalActivity and TerminalView bind their welcome/help banner separately from the raw transcript, reusing Parlons portal/ide/terminal/TerminalView.banner and appendEntry's live TextView binding. The existing ASCII banner and node version remain literal. Command text, JSON replies, append/truncation behavior and MinimaCMD execution are unchanged. The core terminal's runCMD and appendText method bodies were compared byte-for-byte with HEAD.

Reused Parlons portal/ide/BaseView's Language.apply immediately after inflation. This fixes labels on pages created after the host activity's onStart, including the terminal and pending placeholder. Core LogsView now translates pause/resume, clear/share, filter hint, log-share subject/chooser title and chip labels. Chip tags and generated logs commands remain their exact protocol keys. Raw log lines, substring filter, paused buffer and share payload remain literal. LogsActivity reuses TerminalActivity's toolbar and KeyboardInsets; the filter has its own full-width row and buttons can grow for long labels. Logs uses adjustResize like Terminal.

Review found an existing terminal input defect in both implementations: the layout requested IME Send while the listener only accepted Done/Enter, and unhandled IME actions cleared the draft. Reused the early action check from the inspected Parlons terminal, accepted Send, and retained drafts for unrelated actions. Guarded tests intercept runCMD and verify exact submitted text; no node command is executed.

Validation: 2 LogBuffer JVM tests and 9 localization JVM tests pass. Nine Android language cases pass (3 per Bear, each through all four languages), covering live terminal banner, raw output/draft/cursor, IME Send, unrelated IME action, late-inflated terminal/pending labels, paused logs, chip key/state preservation and exact share intent payload. Four keyboard checks pass on Classic: terminal portrait, landscape, embedded main-tab layout, and logs filter/actions. Keyboard checks never submit commands or share. All three final debug and instrumentation builds pass, as do all 19 pinned imports and catalog/transport/diff checks. The Ukrainian terminal/log screenshots were inspected. The first screenshot exposed the banner theme font overriding XML monospace; programmatic Typeface.MONOSPACE was restored, asserted, and all nine cases rerun. Earlier passing logs are retained separately from the final runs. Only the disposable Bears emulator and synthetic data were used; it is stopped after validation.

Evidence: build/localization/diagnostics-languages-validation.json. Future Cash's classic/block and minimaWallet public-audit sources still match the 63-test checkpoint. Keep the pinned donor root; wallet stays at 0.2.21. Candidate 1.9.42/113 remains uncommitted, unsigned for release and unpublished on feature/bear-languages-2026-10-16 at 9def96e6801a9bef261611e45349f28a1eb6ae1c.

Remaining: core node/wallet/apps/chat and known lower-layer diagnostic text; remaining integrated-app inner translations; minimaWallet drawer and final lifecycle/initialization checks; formatting, older API, accessibility and full visual coverage; signed artifacts in the established dist directory and publication to GitHub fork, PandaApps and eurobuddha.com. Goal remains active.


## Home dashboard and app permissions languages — 2026-10-17

Added 26 messages (823 total) in English, Simplified Chinese, Russian and Ukrainian. HomeView uses the existing Language.stamp date binding and StartupMode caption selection; displayed key counts, peers and connection values remain literal. Reused Parlons portal/ide BaseView.languageChanged, TerminalAdapter propagation and IdeActivity tab refresh for Internal/External tabs without resetting selection. AppsView uses the existing LanguageDialog and XML bindings for permission controls. AppsAdapter and IntegratedAppsAdapter bind labels and accessibility descriptions, preserving app names, package IDs, switch state and permission writes. External-row badges now sit below the package name, and internal state labels can wrap.

Review fixes: the dashboard now uses its existing readiness check to show Waiting for node instead of an unconditional Online badge. Recycled rows reset the name and icon before PackageManager lookup, preventing stale identity when an app is absent. Missing packages retain their raw package name in the dialog title. AppsAdapter uses an instance inflater; AppsView dismisses its permission dialog on host destruction. ReceiverDB and CoalescingRefresh remain byte-identical to HEAD.

Validation: 10 RequestWork and 3 StartupMode JVM tests plus 9 localization JVM tests pass. Nine Android language cases pass, three per Bear through all four languages. They cover dashboard value preservation and captions, tab selection, switch state, recycled missing-app identity, live date formatting, permission dialog state and database values. All three debug and instrumentation APK builds and all 19 pinned imports pass; catalog, transport and diff checks pass. Inspected Ukrainian dashboard, permission dialog, external list and Pandamonium internal list screenshots: labels fit and controls remain readable. The dedicated emulator used synthetic records only and was stopped with process exit0.

Evidence: build/localization/home-apps-languages-validation.json. Future Cash's classic/block and minimaWallet public-audit source hashes still match the 63-test checkpoint. Candidate 1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining: core wallet/chat and lower-layer diagnostics; other integrated-app inner text; minimaWallet drawer and final lifecycle/initialization checks; older API/accessibility/full visual coverage; signed builds and publication to GitHub fork, PandaApps and eurobuddha.com. Goal remains active.


## Core balance, receive and coin languages — 2026-10-17

Added 46 messages (869 total) in English, Simplified Chinese, Russian and Ukrainian. Reused Parlons portal/wallet/ReceiveView and CoinDetailDialog live labels, the shared LanguageDialog, Language.TextBuilder and Language.since, and the core BaseView XML binding. BalanceView and BalanceAdapter now translate summary labels, count plurals, update age and accessibility descriptions; expanded details and token order persist. ReceiveActivity/ReceiveView bind toolbar/buttons/QR description and copy feedback. CoinsDialog and CoinDetailDialog translate headings, status, count/sum/footer warnings, field labels and copy controls while retaining dialogs. Coin/state JSON, token names, amounts, identifiers and clipboard values remain literal. Format and CoalescingRefresh are byte-identical to HEAD; command construction and QR generation are retained.

The receive page is scrollable and its actions can grow for translated labels. Initial screenshot review exposed long balance summaries squeezing token names out of the row. Reused the existing bounded text-column pattern from app rows: name/amount above a wrapping summary. Added measured readable-name-width and no-ellipsis checks and reran all12 Android cases after rebuilding. Initial passing logs and the defective screenshot remain separately named before-layout-review.

Validation: 8 Format and 10 RequestWork JVM tests plus 9 localization JVM tests pass. Twelve final Android cases pass, four per Bear across all four languages: retained balance values/order/expansion, plural/raw count handling, non-clipped token rows, open coin/error/empty dialogs, exact clipboard token/coin IDs and raw JSON, unchanged receive QR bitmap/address and intercepted rotation. The fixture never starts a node or imports a seed. All three final debug/test builds, all19 pinned imports, catalog/transport/XML/diff checks pass. Ukrainian balance/coin/detail/receive screenshots were inspected; the final balance row is readable. Dedicated Bears emulator stopped after validation.

Evidence: build/localization/core-wallet-languages-validation.json. Future Cash source hashes still match the 63-test classic/block/minimaWallet public-audit checkpoint. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining: core send/chat and lower-layer diagnostics (including token-name fallback provenance); remaining integrated-app inner text; minimaWallet drawer/initialization/lifecycle checks; API/accessibility/full visual coverage; signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.

Graph expansion used balance, receive, wallet, language, coin. The broad traversal led to node command/wallet types rather than current UI bindings, so current sources and pinned sibling implementations were used for the actual change.


## Core send languages and token-name provenance — 2026-10-17

Added 18 messages (887 total) in English, Simplified Chinese, Russian and Ukrainian. SendActivity toolbar/scanner prompt, SendView form/max/scan descriptions, validation and confirmation dialogs, sendable label and transaction status now use existing Language bindings and LanguageDialog. Inputs, cursor, chosen token and open confirmation survive switching; amounts, addresses, node error reasons and token names remain literal. Button heights can grow with translated labels. The existing node callback body was moved into onSendResult so the actual presentation logic can be tested with synthetic replies. Send command construction and Feedback classification are retained. Confirmation windows are dismissed on host destruction and late replies do not reopen UI.

Reused core main/views/balance/tokens/TokenMeta.java instead of the duplicate send-name parsers. Added the exact Parlons portal/wallet/TokenMeta nameProvided distinction: real names including Token remain literal; missing names use the existing wallet.token message. Applied the same provenance to balance rows, coin titles and spinner/dropdown bindings. This fixes null/plain/nested/structured token metadata crashes and the incorrect Error - no token name label. Missing balance selections now show a translated no-balance error instead of dereferencing null. Reused Parlons portal/wallet/Util.isValidHexId as Format.isValidTokenId before send confirmation and coin queries, rejecting whitespace, semicolons and other command syntax in supplied IDs. All original Format methods are byte-identical to HEAD after removing this added guard; Feedback, MinimaCMD and CoalescingRefresh are unchanged.

Validation: 8 existing Format tests, 3 new token-name/ID tests and 9 localization tests pass. Final device runs pass 27 cases (5 send +4 wallet per Bear), plus 1 Ukrainian send keyboard check on Classic. Cases cover all 4 languages, draft/cursor/token preservation, exact captured confirmation arguments, cancel behavior, malformed IDs/no-balance/invalid amount-address rejection, name fallback vs literal Token, Max/QR cleaning, raw node errors, accepted-result clearing, late result suppression and the real SendActivity toolbar. No node, seed, camera or transaction was used; submissions and scan requests are intercepted. The first Classic run had 8 passes and 1 test-only failure caused by asserting before AlertDialog's asynchronous button callback; corrected to Espresso's click/idle, retained the log, rebuilt and reran. Ukrainian form and confirmation screenshots were inspected. All 3 debug and final test builds, all 19 pinned imports and catalog/XML/transport/diff checks pass. Emulator stopped after validation.

Evidence: build/localization/send-languages-validation.json. Future Cash dual-family/public-wallet audit sources still match the 63-test checkpoint. Candidate 1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining: core chat and lower-layer diagnostics; remaining integrated inner text; minimaWallet drawer/initialization/lifecycle checks; older API/accessibility/full visual coverage; signed versioned artifacts and publication to GitHub fork/PandaApps/eurobuddha.com. Goal remains active.


## Chat list, contact dialogs and typed previews — 2026-10-17

Added53 messages (940total) in English, Simplified Chinese, Russian and Ukrainian. ChatView now uses LanguageDialog for contact menus, creation, rename/delete, identity and saved-contact picker; custom layouts bind application-owned labels and hints. Drafts, cursor selections, validation errors and open sheets survive switching. Dialogs are owned/dismissed by ChatView; pending scan fields clear on dismissal, listeners detach on destruction, and stale read callbacks cannot open a picker after its parent has closed. Recognized QR results clear stale address-validation errors without submitting the form. List dates use the selected language.

Reused Parlons chatshared/i18n/ChatPreview.java with namespace/resource substitutions. Its parsed media/contact labels translate while bodies, captions, filenames and exact payment data remain literal; outgoing Parlons previews compose a translated prefix around that literal or typed content. ChatDb retains raw last body and existing state in the read result rather than producing English labels inside SQL; no schema/write migration. MaxChatThreads retains raw body and outgoing metadata. Synthetic text such as 📷 Photo remains user text. Visual review caught an existing broken emoji avatar: reused CloudChatsPage.oneLine offsetByCodePoints boundary for the first character, with multilingual/emoji assertions.

Validation:9 localization JVM tests and12 final Android cases (4per Bear, through all4languages) pass. Cases cover live dialog drafts/cursors/errors, scanner draft routing and cleanup, no-node identity state, display-name save/restore, contact filtering, raw/type-specific previews, literal payment values, local clear-versus-delete/cancel semantics, listener/dialog cleanup and Unicode initials. First run failed from incorrect XML resource tags; fixed and verified all152 XML bindings. The next12 passed but screenshots exposed the avatar bug; retained those earlier logs/screenshots, fixed it, rebuilt and reran all12. The final scan screenshot exposed a stale invalid-address marker after a valid scan; cleared it for both recognized formats, added assertions and reran all12 on the final build. Final Ukrainian list/new-chat/identity screenshots reviewed. All3 final debug/test builds, all19 pinned integrations, catalogue/transport/diff checks pass. ChatSchema and MaxChat remain byte-identical to HEAD; FutureCash audit checkpoint hashes unchanged. Dedicated emulator stopped after tests. Only disposable public fixtures were used, no owner device/data, node, seed, network contact action, signing or transfer.

Evidence:build/localization/chat-list-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:ChatThreadActivity/MaxThreadActivity, photo and voice screens, core lower-layer diagnostics; remaining integrated inner translations; minimaWallet drawer/initialization/final lifecycle; older API/accessibility/full visual coverage; signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Conversation screens and media labels — 2026-10-17

Added51 messages (991total) in English, Simplified Chinese, Russian and Ukrainian. Native and Parlons conversation screens now translate dates, typed attachment labels, fallback titles, contact/attachment menus, payment/rename/delete sheets and feedback. Photo viewer menus/status and voice recording labels translate. Open dialogs, drafts, cursor selections, payment amounts/addresses, literal contact names, raw messages/links/transaction IDs and photo zoom survive switching. Dates bind from timestamps; recycled raw text clears old translation bindings. Reused the Parlons typed-preview helper and stable audio-duration formatting. Native photo callbacks now verify the image-view tag, matching the existing MaxThread implementation. Owned dialogs close with their Activity, stale read/image callbacks are ignored, and voice timer callbacks also stop when the dialog window detaches.

Validation:9 localization JVM tests and12 final Android cases (4per Bear, each exercising all4languages) pass. The initial4 Classic cases exposed AppCompat toolbar title/menu ownership: titles now explicitly pass through the support ActionBar, while menus populate through Activity lifecycle callbacks. Retained the failed log, rebuilt all3 debug/test APKs and reran all12 successfully. Ukrainian payment/messages/Parlons/photo screenshots reviewed. Copy assertions retain exact links, message text and transaction IDs; the photo screenshot contains the Android clipboard overlay from the earlier copy check. All19 pinned imports and diff checks pass; FutureCash audit checkpoint hashes still match. ChatSchema, ChatAudio, ChatImages, ChatPhoto and VoiceNote remain byte-identical to HEAD. No send/payment command or protocol change. Voice duration formatting preserves original serialized digits.

Only reserved disposable SQLite fixtures and a local image were used. No owner device/data, live node, seed, signing, payment or real peer transfer. Microphone recording and real gallery/share actions were not exercised. Dedicated emulator5580 was identity checked and stopped; launcher exited0.

Evidence:build/localization/chat-thread-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:core lower-layer diagnostics, other integrated inner text, minimaWallet drawer/initialization/final lifecycle, older API/accessibility/full visual coverage, signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## minimaWallet drawer and sensitive-screen return — 2026-10-17

minimaWallet now appears in the existing allowlisted drawer and Internal Apps list, using its imported launcher artwork. Appended destination16 preserves previous indices and saved class-name ordering; existing visibility controls, non-exported Activity and stopped-node gate apply. Reused wallet goToTab's FrameLayout replacement pattern for a stable outer screen container. Setup/unlock/main view replacements retain the same host drawer instead of detaching it. The wallet menu sits in the existing host brand header, avoiding an extra menu row. Importer adaptation reproduces this container.

Validation:214 JVM checks pass (3drawer-order,139wallet,63FutureCash,9localization), all3 debug builds and Pandamonium instrumentation build pass, and15 final Android cases pass. Cases exercise the actual four-language drawer selector, literal seed-entry drafts and selections, setup/unlock/welcome transitions, one retained drawer, enable/disable and saved order, stopped-node gate, non-exported wallet Activity, and the existing setup/runtime/tab suites. All19 pinned imports and direct-transport/diff checks pass. FutureCash audit checkpoint hashes still match. Drawer screenshot reviewed; initial scroll position shows the earlier apps, while tests assert the wallet row after ordering it first. No owner device/data, live node, imported seed, signing or transfer used.

The first15cases passed, then an added return-to-seed-entry check reproduced screenshot protection loss (1of2failed): the host's general policy cleared FLAG_SECURE on resume. The wallet now reports whether its current screen is sensitive through the existing Pandamonium variant hook, so the host preserves seed/unlock protection on return and on general screenshot-setting changes. The corrected final15cases passed; earlier logs retained. All wallet cryptographic/session/counter implementations remain unchanged. Dedicated emulator5580 stopped, launcher exited0.

Evidence:build/localization/wallet-navigation-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:wallet initialization/keystore performance, rotation/final lifecycle; broader screenshot-policy review of public-screen transitions when screenshots are globally disabled (existing clearFlags behavior may need adjustment); remaining core diagnostics and integrated inner translations; older API/accessibility/full visual coverage; signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Wallet startup worker and screenshot preference — 2026-10-17

Moved initial WalletCore/AddressBook/TxnFactory and primary receive-address preparation onto the existing session-owned WalletWork executor. Captured vault generation is checked before and after preparation and before installing views; failures return to protected unlock. Preparation uses application context. Existing address derivation, caches, session/counter implementation and remaining64-key derivation logic are unchanged. A newly created Activity with an already-open session gets an empty stable content container before work begins, so the host can install its drawer during resume. Existing form screens remain attached while the working dialog is shown.

Closed the screenshot-preference gap noted in the preceding checkpoint. Wallet screens now use the existing host screenshot preference supplier for every transition: secret screens always protect their window, and public screens preserve the user's general disallow choice. The host's existing screenshotsAllowed helper is the single preference lookup for both paths, matching the prior release default-off/debug default-on policy. No private data is stored by this bridge.

Validation:143wallet+9localization JVM checks pass (4new startup queue/generation/counter-failure checks), all3 debug builds and Pandamonium instrumentation build pass, and19 final Android cases pass. The new4 exercise real Activity startup dispatch with synthetic delayed failure, UI and four-language working-dialog responsiveness, recreation during pending work, an already-open synthetic session/drawer, and global screenshot preference transitions; the previous15 drawer/setup/runtime/tab checks also pass. Initial18passed, then code review found the warm-session empty-content case; added a placeholder plus regression and final19passed. Prior log retained. Tests fail synthetic preparation before deriving a key; they do not benchmark real key derivation or import/create a seed. Session/preference fixtures restored. All19 pinned imports, direct-transport guard and diff checks pass. FutureCash audit checkpoint hashes still match. Dedicated emulator5580 stopped with launcher exit0.

Evidence:build/localization/wallet-startup-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:optional biometric keystore responsiveness review and populated-wallet rotation/final lifecycle; remaining core diagnostics and integrated inner translations, including FutureCash audit presentation; older API/accessibility/full visual checks; signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Future Cash audit and payment languages — 2026-10-17

Added 62 messages (1053 total) in English, Simplified Chinese, Russian and Ukrainian. Future Cash's tabs, node banner, audit summary, key details, stake list and payment form now reuse the shared live Language bindings. Classic counters and block-key leaf positions remain distinct, unknown/partial evidence stays visibly incomplete, and original public addresses, amounts and saved diagnostic strings remain literal. Existing audit/cache/guardian algorithms and the public minimaWallet key bridge are unchanged.

Payment inputs and cursor selections now survive status redraws, tab changes, theme changes and language switching. The selected unlock preset is retained. Queued work captures the delay with the amount and recipient instead of reading a later edit. Successful submission clears only the matching submitted draft; new edits remain. The existing Ui builders accept CharSequence, bind messages and restyle retained inputs. Unlock presets use the existing wallet's horizontal scrolling approach. Visual review exposed button bottoms clipped by centered horizontal rows with asymmetric margins; setting the existing button layout gravity to TOP fixed this, with explicit on-device bounds checks.

Validation: 63 Future Cash and 9 localization JVM tests pass. All 3 debug builds and the Pandamonium instrumentation build pass. Six final Android cases pass, including the prior dual-family audit case and 5 new cases covering all 4 languages, live partial-audit warnings, raw public evidence/errors, draft and cursor preservation, matching-only completion clearing, stake maturity labels and absence of a collect action for risky payouts. Initial4 passed; after completing stake labels and success clearing,6 passed; after visual alignment correction, final6 passed with button-bounds assertions. Earlier logs retained. Chinese/Ukrainian audit and Russian/Ukrainian payment screenshots reviewed; final Ukrainian audit and Russian payment screenshots confirm the clipping fix. All19 pinned imports, direct-transport/catalog/diff checks pass. Wallet/public-key audit checkpoint hashes still match. Dedicated emulator5580 was identity checked and stopped with launcher exit0. No owner data/device, live node, seed, signing or transfer used; payment completion tests invoke only the UI completion handler with public fixtures.

Evidence: build/localization/future-languages-validation.json. Canonical adapter: scripts/adapt-pandamonium-future-languages.py. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining Future Cash text: Guardian hero/daemon/safe/risk/recover/harden panels; rescue/reset dialogs; activity log presentation, Help and notifications/lower-layer errors. Other integrated inner translations, optional wallet biometric keystore responsiveness and populated-wallet lifecycle checks, older API/accessibility checks, signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication remain pending. Goal stays active.


## Future Cash Guardian, rescue and Help languages — 2026-10-17

Added 98 messages (1151 total) in English, Simplified Chinese, Russian and Ukrainian. The remaining MainActivity panels now use shared live bindings: Guardian status/daemon, safe and risky stakes, rescue setup, recovery/hardening, activity controls and all five Help cards. Dynamic amounts/counts and full destination addresses remain literal values inside translated messages. Stored diagnostics/logs and transaction command strings remain unchanged. The remaining English strings in MainActivity are raw stored rescue log entries, the MINIMA ticker, the checkaddress command and the existing error-condition substring.

Rescue and reset dialogs reuse LanguageDialog and MaxThreadActivity's owned-dialog cleanup. Cancel retains the existing pending-start semantics; Activity destruction dismisses owned windows. Dialog themes reuse the UTXO colorSurfaceContainerHigh override with Future Cash's palette. Safe/risk/rescue action groups use existing vertical containers so longer labels fit. Rescue fields and selections survive live language changes in dark and light modes.

Checked Audit.usable() and corrected two misleading Help statements: safe auto-collection must be explicitly enabled; an offline audit fallback requires the matching readable key snapshots and has a 24-hour cap. The Help now states the 30-minute freshness interval, minimaWallet snapshot check, subsequent combined node/wallet comparison, and inability of local checks to detect reuse by another seed copy. No audit or collection algorithm changed.

Validation: 63 Future Cash and 9 localization JVM tests pass, all3 debug builds and the Pandamonium instrumentation build pass, and10 final Android cases pass. Four new cases cover 8 Guardian priority states, live safe/risk/daemon values, rescue drafts and cancel/button/back semantics in both themes, Help and reset-dialog bindings, raw log retention, and Activity-owned dialog cleanup. Previous6 audit/payment cases remain green. Initial run had9passes and1 test-only failure: cancel() posts its callback, so the immediate assertion was too early. Added an idle boundary, retained the initial log, and reran all10. Explicit palette assertions pass. Ukrainian dark/light rescue, Guardian and Help screenshots reviewed. All19 pinned imports and catalog/transport/diff checks pass. Wallet/public-key audit checkpoint source hashes match. Dedicated emulator5580 was identity checked and stopped with launcher exit0.

Evidence: build/localization/future-panels-validation.json. Canonical adapter: scripts/adapt-pandamonium-future-panels.py. Only disposable public fixtures were used; no owner data/device, seed, live node, signing, rescue, collection or transfer. Recovery/hardening worker actions were not executed; their UI text was adapted while the underlying financial implementation remained unchanged. Candidate1.9.42/113 is uncommitted, unsigned for release and unpublished. Remaining Future Cash language work: notification channels/status and lower-layer error/log presentation. Visual follow-up: keep the selected horizontal tab visible when translated labels grow; Help can be partly outside the viewport after programmatic selection. The light-dialog fixture changes Design mode and chrome without rebuilding the underlying cards, so its mixed background is a fixture artifact; use the real theme-toggle path in later visual checks. Material dialogs apply their normal elevation tint over the configured surface colors. Remaining broader work: other integrated inner translations, wallet biometric keystore responsiveness and populated-wallet lifecycle, older API/accessibility coverage, signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Future Cash notifications and selected tabs — 2026-10-17

Added21 messages (1172total) across English, Simplified Chinese, Russian and Ukrainian. Reused the complete wallet diagnostic generator, extracted as build_source, for9 fixed Future Cash notifications/reasons and6 literal-capture templates. The generated WalletMessages remains byte-identical to its preceding checkpoint. Amount strings and unknown diagnostics stay literal; nested known reasons use the existing eight-level limit. Notifications reuse existing IDs/tags/channels. Channel renaming preserves user importance/sound/vibration and other settings. The active foreground notice refreshes on Service configuration changes only after foreground startup succeeded; inactive service fixtures cannot create it. Existing posted historical alerts retain their posting language.

The selected tab now uses PandaDEX's requestRectangleOnScreen without moving input focus or replacing the payment draft. A real Russian Help clipping regression survived a bounded frame wait and an expanded request rectangle. Reading Android36.1 HorizontalScrollView showed that its request-rectangle clamp ignores padding. Changed the strip's horizontal16dp padding to equivalent outer margins; all selected labels now fit. Kept the bounded layout wait in the regression. Initial failures and intermediate attempts remain recorded. Rescue visual fixtures now use the real theme toggle, so cards and dialogs share the selected palette. Screenshot capture reuses the wallet tests'350ms render settle; a final focused rerun confirmed the Help image after the prior capture showed the preceding frame.

Validation:143wallet+67FutureCash+9localization JVM cases pass (219total), all3 debug builds and Pandamonium test APK pass, and13 final Android cases pass. An additional focused screenshot/tab rerun passes. Coverage includes classic/block audit presentation, payment drafts/cursors, Help/rescue, actual posted alerts with exact leading-zero amounts, unknown diagnostics, user channel settings, foreground tag/ID separation, auto-collect status and inactive-service guards. All19 pinned imports,1172-message catalog, transport and diff checks pass. All wallet/public-audit financial checkpoint hashes remain unchanged. Only disposable public fixtures used; no owner device/data, live node, seed, signing or transfer. Dedicated emulator5580 stopped with launcher exit0.

Evidence:build/localization/future-notices-validation.json. Canonical adapter:scripts/adapt-pandamonium-future-notices.py. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:Future Cash lower-layer errors and log presentation; other integrated inner translations; wallet optional biometric keystore responsiveness/populated-wallet lifecycle; older API/accessibility and final release checks; signed versioned builds and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Future Cash error display — 2026-10-17

Added74 messages (1246total) across English, Simplified Chinese, Russian and Ukrainian. Reused FutureMessages and the unchanged wallet/Parlons explicit message generator. Lookup now covers71 fixed strings and18 templates including prior notifications. Reviewed full Wallet, Node, Tx, AuditRunner and AuditApi plus Guardian manual-payment/collection paths. Mapped app-owned local-node, minimaWallet snapshot, audit connection, address setup/retirement, sweep, validation and transaction-stage failures. Tx.stage is an exact six-command allowlist expressed as explicit fixed/template entries; unknown stages do not match. Unknown diagnostics, amounts, counts, block numbers and node-returned error details remain literal. The message that an unreadable transaction reply may still represent success is preserved in each language.

Applied lookup at only two display boundaries: MainActivity.toast for String errors, and auditCard's stored-error display. Typed Language.Message toasts remain intact. Stored diagnostics and exception/callback contracts are unchanged. The importer was regenerated in a disposable directory and only the expected MainActivity, FutureMessages and FutureMessagesTest files copied. All19 pinned import outputs and source lock reproduce. Financial files Wallet/Tx/Node/Guardian/AuditRunner/AuditApi/Audit/Cfg/KeyAudit match their before hashes; the earlier wallet/public-audit checkpoint also matches.

Validation:69 Future Cash+9 localization JVM cases pass (78total), all3 debug builds and the Pandamonium test APK pass, and14 Android cases pass. Two new JVM regressions verify nested audit errors, literal node-error captures even when they match known app text, leading-zero block numbers, malformed numbers and unknown stages. One new device case checks six stored audit failures in all4languages, live bindings without replacing the card, unchanged stored raw text, and the paused-audit warning. Existing dual-family/payment/rescue/tab/notification checks pass. Ukrainian audit-error screenshot reviewed. No owner device/data, live node, seed, signing or transfer used; actual transaction failures were not triggered. Dedicated emulator5580 stopped, launcher exit0.

Evidence:build/localization/future-errors-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Remaining:Future Cash Activity log presentation (raw source log strings reviewed in Guardian, Wallet, Audit, GuardianService and Cfg); other integrated inner translations; optional wallet biometric keystore responsiveness/populated-wallet lifecycle; older API/accessibility/final release checks; signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Future Cash Activity log languages — 2026-10-17

Added58 messages (1304total):57 Activity-log descriptions/field layouts plus the missing-address placeholder, in English, Simplified Chinese, Russian and Ukrainian. Read the complete relevant log writers in Guardian/Wallet/Audit/GuardianService/MainActivity and Cfg storage, then reused FutureMessages at the two existing renderActivity text boundaries. Its combined lookup now has93 fixed strings and53 templates. Known log descriptions and address-field labels translate live, including rescue states, audit warnings, retries, reorgs and uncertain outcomes. The existing two-line layout and severity colors remain. Stored JSON logs, amounts/counts/blocks, full public identifiers and unrecognized diagnostics remain literal.

Reused Node.validAddr's exact hexadecimal/Mx forms as an additional capture kind in the shared generator. This separates an address from a following error even when that error contains further separators. Specific log layouts precede generic transaction-stage wrappers; nested known application failures translate, while captured raw node errors retain their original value. Unknown, malformed or truncated layouts fall back to raw text. Generated WalletMessages is byte-identical to its earlier checkpoint. The missing-address sentinel in key details now uses a translated ordinary label; actual addresses retain the existing complete-value copy handler. Unused Ui.timeAgo and Design.label have no callers in the imported module/host; their English strings do not reach these screens.

Validation:143wallet+70FutureCash+9localization JVM cases pass (222total), all3 final debug builds and the Pandamonium instrumentation build pass, and15 Android cases pass. New JVM coverage checks log-field priority, nested transaction failures with separators, exact captured addresses/IDs, and malformed-field fallback. New Android case checks live descriptions/field labels, leading-zero amounts and block numbers, raw unknown text, severity color and byte-identical stored records through all4languages. Existing dual-family case now checks the translated unavailable-address placeholder remains unchecked. Existing audit/payment/rescue/tab/notification checks remain green. Ukrainian Activity screenshot reviewed. All19 pinned imports, catalog, transport and diff checks pass. Nine financial/audit source files and earlier wallet/public-audit hashes remain unchanged. No owner device/data, live node, seed, signing or transfer. Dedicated emulator5580 stopped; launcher exit0.

Evidence:build/localization/future-log-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished. Future Cash's reviewed MainActivity panels, dialogs, notifications, application errors and known Activity log records now follow the language selector. Full release acceptance still needs broader API/accessibility/lifecycle checks and completion of the remaining integrated apps. Other pending work:wallet biometric keystore responsiveness/populated-wallet lifecycle, core residual diagnostics, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Goal remains active.


## Minima Explorer languages — 2026-10-17

Read the complete imported Explorer MainActivity.java, Util.java, NodeApi.java, Design.java, layout and package dependencies, the standalone blockexplorer guidance, History's canonical language adapter, and existing shared drawer/History device checks. Graph query located Explorer's detail/search relationships. Reused shared Language text/date descriptors through scripts/adapt-pandamonium-explorer-languages.py; localization/explorer-labels.json reuses existing exact messages and adds50 new entries (1354total), all in English, Simplified Chinese, Russian and Ukrainian. The adapter is registered after FutureNotices in the canonical importer.

Home statistics, chain-list rows/footer, search guidance, offline banner, block/transaction/address detail, confirmation callbacks, raw-JSON controls and theme accessibility descriptions now follow the selector. Dates reuse History's timestamp/relative bindings. Page and search views stay in place; amounts, public IDs/addresses, token names, state data, commands, cached JSON and clipboard payloads stay literal. NodeApi and Design are byte-identical to the baseline; Util's non-date parsers/formatters are unchanged. The unavailable-node title now reflects embedded-node readiness.

Validation:9localization JVM tests pass, all3debug builds and Pandamonium instrumentation build pass, and7final Android cases pass on the dedicated stopped-node emulator. Five new Explorer cases cover retained search/cursor/page identity, expanded JSON and exact copy bytes, typed/date labels, late on-chain and absent-chain callbacks, coin/state rendering, address navigation/back stack, recycled rows/footer states, and late home-stat results with visible list rows. Existing shared drawer selector and all19activity retention manifest cases pass. Initial6passed; additional visible-stat case brought the suite to7. Visual review caught the long Russian transaction-count label splitting a word; compact native abbreviations and the Chinese counter label were adjusted, then all3builds and7cases reran. Home captures in all4languages and Ukrainian raw-JSON, Chinese/Ukrainian block and Russian transaction captures reviewed. Clipboard toasts queued by earlier tests can briefly retain their original language; clean home/raw views provide unobstructed layout evidence.

All19pinned imports, catalog, transport and diff checks pass. Nine FutureCash financial/audit source files and earlier wallet/public-key audit hashes remain unchanged. No owner data/device, live node, seed, signing or transfer used. Dedicated emulator5580 was identity checked and stopped; launcher exit0. Evidence:build/localization/explorer-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished; goal active.

Remaining: other integrated apps' inner translations, residual core diagnostics, broader API/accessibility/lifecycle and wallet keystore responsiveness checks, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Existing Explorer all-digit search overflow and theme recreation state behavior were observed during inspection; no changes to those paths in this display checkpoint, retain for the wider acceptance review.


## Terminal IDE navigation and console languages — 2026-10-17

Read standalone Terminal IDE guidance and the full imported MainActivity, BaseView, TerminalAdapter, LogsView, TerminalView, SessionExport, NodeApi, OutputFormatter, CommandRegistry, Suggest, ParamDocs, HelpStore, HistoryDB and CaretEditText, plus main/console layouts and dependencies. Graph vocabulary expansion [terminal,ide,editor,logs,activity] yielded a broad truncated traversal; a source-filtered graph inspection then located319Terminal IDE nodes and652internal relationships. Reused shared Language/LanguageDialog, core terminal's banner bindings, ChatThreadActivity's retained menu/configuration refresh, FutureCash's Activity-owned dialog cleanup and the proven wallet/SystemMessages diagnostic generator.

Canonical scripts/adapt-pandamonium-terminal-languages.py adds71new messages (1425total) in all4languages. Navigation tabs/menu/subtitle, console controls/banner, history/favorites/dialogs, export actions/local failures, existing risky-command warning text, pending/completion/failure/timing labels and accessibility descriptions follow the selector. Existing command names, parameter syntax, amounts, diagnostic bodies, history/favorite values and export snapshots remain literal. Tabs are scrollable for longer native labels.

The shared plain-text binding cannot preserve multicolor output spans, so the minimal TerminalLabel adapter reuses the existing OutputFormatter and refreshes its retained text view on configuration changes. Literal SpannedString snapshots keep JSON colors. A selected unchanged prefix retains selection positions; external replacement clears the prior display binding. Selection-mode changes preserve that binding. The helper is owned by the view rather than a global callback collection. Dialogs reuse LanguageDialog and are dismissed with their Activity. The existing transport, command classifier, autocomplete parser and database APIs are unchanged.

Validation:9localization JVM cases pass; all3debug builds and Pandamonium instrumentation build pass. Five final Android cases pass, using stopped-node captured callbacks and public fixtures. Coverage includes draft/cursor/Activity identity, saved literal favorites, retained dialogs and submenu labels, late raw JSON with color spans, selected text and completed status, direct raw errors, three warning gates and cancellation, export snapshots/UTF-8 file bytes, oversized Unicode clipboard rejection, autocomplete marker/highlight/row retention, pending/offline/timeout labels and banner width. Initial4cases passed; the added completion test initially failed because its fixture left the caret at the start. The fixture now positions it after the command and asserts the highlight before switching; final5pass. Visual review found CJK box-drawing glyphs wrapping; changed only the decorative border to ASCII and added a one-line-width assertion. Russian/Ukrainian/Chinese favorite-dialog and all4console screenshots reviewed. A focused one-case rerun adds a4.5second wait for the selection instruction toast, giving unobstructed selection-bar captures without changing production behavior. Bundled help prose visible in completion rows remains English and is explicitly pending.

All19pinned imports, catalog, transport and diff checks pass. Fourteen Terminal IDE parser/transport/raw-log/database/editor/transaction source files are byte-identical to baseline; nine FutureCash financial/audit files and earlier wallet/public-key audit hashes remain unchanged. No owner data/device, live node, seed, signing, transfer or external share used. Dedicated emulator5580 stopped after identity check, launcher exit0. Evidence:build/localization/terminal-validation.json. Candidate1.9.42/113 remains uncommitted, unsigned for release and unpublished; goal active.

Next: Terminal IDE script editor/library, transaction workbench and bundled115command help pages/parameter descriptions. ParamDocs parses English (optional)/Examples markers, so preserve the canonical help data/parser and localize its display boundary. Then remaining integrated apps/core diagnostics and full API/accessibility/lifecycle/signing/publication gates. Publication remains GitHub fork, PandaApps and eurobuddha.com only.


## Terminal IDE script library and editor — 2026-10-17

The 1.9.42/113 candidate now translates the script library and editor controls, template choices, relative timestamps, lint messages, validation errors, execution-result labels and deployment prompts in English, Simplified Chinese, Russian and Ukrainian. This adds 75 messages, bringing the catalog to 1500. Canonical adaptation: `scripts/adapt-pandamonium-terminal-editor-languages.py`; mapping/specification: `localization/terminal-editor-labels.json` and `terminal-editor-messages.json`.

Reuse evidence: inspected complete imported `ide/ScriptsView.java`, `ScriptEditorActivity.java`, `ScriptDB.java`, `Templates.java`, `LintEngine.java`, `KissVm.java`, `KissHighlighter.java`, editor/library/deploy layouts, NodeApi and TerminalAdapter. Consulted standalone Terminal IDE guidance. Reused the existing Language/LanguageDialog bindings, Language.TextBuilder/relative dates, MainActivity's owned-dialog lifecycle and options-menu creation, and the wallet/SystemMessages diagnostic generator. Graph query expanded from actual vocabulary to [script, editor, lint, template]; the traversal located the editor's LintEngine/Lint and ScriptDB/Script relationships, alongside generic editor matches. Source inspection supplied the implementation details.

The existing script engine, saved source, test inputs, JSON validation, command construction, syntax highlighting and templates are unchanged. Editor result text has one color per result; using the existing plain-text binding and TextView text color retains that behavior without introducing another view helper. Raw returned errors, addresses, code, variables and traces remain literal. The lint display mapper recognizes three fixed messages and seven parameterized messages; raw engine errors and exceptions stay unchanged. Script names already stored, and current generated names/template source comments, remain data rather than being retranslated on a language switch.

Device testing found an existing toolbar problem: ScriptEditorActivity added menu items in onCreate after setSupportActionBar, and AppCompat later cleared them. Reused MainActivity.onCreateOptionsMenu to keep the reference/docs links available. A focused test actually opens the reference menu after startup and checks the retained translated dialog through all four languages. Bundled reference prose itself is still pending translation.

Validation: all three debug builds and Pandamonium test APK compile; Pandamonium rebuilt after the menu fix. Nine localization JVM tests pass. Five editor Android cases pass, plus one focused menu/fallback case (six distinct cases). Coverage includes retained Activity/draft/cursor/input values and colors, database persistence, exact captured run/deploy commands, delayed result translation with literal raw values, lint branches, semicolon/invalid JSON rejection, untranslated server errors, trackall default/retention and captured deployment script, library row/adapter identity, all seven template labels, delete cancellation, node-script display and malformed entries, dialog dismissal, offline/empty/failure states and reference-menu operation. Initial device run found the menu defect plus two fixture timing errors; fixtures now wait for asynchronous dialog callbacks before asserting. A test-only resource ID typo was also corrected.

Visual review covered editor inputs in all four languages and Chinese/Russian/Ukrainian lint/deployment dialogs. Controls and long explanations fit on the dedicated API36 device; twelve captures are saved in `build/localization/editor-screenshots`. Older APIs, enlarged fonts and broader accessibility remain release gates.

All 19 pinned imports reproduce. Catalog, transport and diff checks pass. Ten terminal engine/transport/storage/parser/template files match baseline byte for byte; nine Future Cash financial/audit hashes and the wallet public-audit checkpoint also match. No owner data/device, live node, seed, actual script deployment, signing, transfer or external link was used. Emulator5580 was stopped after its AVD identity check; launcher exited0. Evidence: `build/localization/editor-validation.json`.

Next: translate Terminal IDE's transaction workbench, then bundled KISS reference/command help and parameter descriptions without changing canonical parser inputs. Existing generated default names/template comments also need a deliberate localized-creation/display treatment if included in the remaining prose pass. Continue the other integrated apps and residual core surfaces, then full acceptance/signing/publication. Candidate remains uncommitted, unsigned for release and unpublished. Goal remains active. Destinations remain GitHub fork, PandaApps and eurobuddha.com only.


## Terminal IDE transaction workbench — 2026-10-17

Translated the workbench's actions, output/state/sign/post/import/delete dialogs, validation text, balance and validity summaries, pending-transaction lists, change calculation/failure warnings and export status in all four languages. Added 85 messages (1585 total). Canonical adaptation: `scripts/adapt-pandamonium-terminal-txn-languages.py`; mapping: `localization/terminal-txn-labels.json`. Source remains based on 1.9.41 commit9def96e6801a9bef261611e45349f28a1eb6ae1c, candidate1.9.42/113.

Read complete TxnView and its two layouts, BaseView, existing SessionExport, the editor's status/dialog patterns, the standalone sibling transaction code, Future Cash's unreadable-row handling and the local node's txncheck command. Reused shared Language/LanguageDialog, Activity-owned dialogs, editor TextBuilder/status binding, the workbench's existing ID validator and the console's byte-limited clipboard helper. Graph lessons refreshed:46memories,45useful/1dead end. Expanded query from exact graph vocabulary [txn,change,output,sign,post] was broad/truncated; source-filtered graph inspection located28TxnView nodes and76internal relationships. Direct source inspection supplied behavioral details.

Review fixes:
- Check previously bypassed txnId() validation; it now uses the same validator as the other actions. A reply for a previous edited ID cannot replace the current summary.
- Export previously wrote unbounded data directly to the clipboard; it now uses SessionExport.copy. Oversized data is rejected with an error and leaves the previous clipboard intact. A dedicated file-export path for large transaction data remains a follow-up.
- Unreadable coin rows no longer crash the picker/summary. Missing or unreadable change differences, or missing token IDs in change rows, abort calculation and clear its in-flight gate. Negative differences are explicitly rejected instead of being reported as balanced.
- Current txncheck returns valid.signatures as an array and allsignaturesvalid as the aggregate boolean. Confirmed in the complete local core command and in the actual bundled minima.jar via javap. The summary now uses the aggregate, supports a legacy boolean, and shows ? when neither is available instead of displaying an invented false verdict.

Command strings, transaction IDs, amounts, token IDs, addresses, state values, public keys, burn values and import/export data remain literal. The existing change sequence, cancellation gate, positive-remainder amounts, storestate flags and explicit confirmation actions are retained. Uniform status/summary colors use native TextView color with shared plain bindings. Node error bodies remain literal; known local unavailable/timeout notices use the existing mapper.

Validation: all three final debug builds, Pandamonium instrumentation build and9localization JVM cases pass. Eight final Android cases pass. The earlier six-case run and focused status case also passed before the additional review fixes. Final coverage includes retained Activity, dialog, draft/cursor and checkbox state; exact captured output/state/sign/post/import/delete commands; no auto:true post; input picker100-row cap; invalid output and invalid Check ID rejection; change double-tap/cancel and sequential partial failure; precision-preserving summaries; stale-ID callback suppression; compact pending lists; exact clipboard bytes and oversized Unicode rejection; completed/pending/offline/error state changes; malformed/null/missing/negative change rows; and current/legacy/unknown signature-result shapes. No real command reached an embedded node.

Twelve screenshots cover output dialogs, summaries and partial-change failure text. Representative Chinese, Russian, Ukrainian and English captures were reviewed. Translated text and literal decimal precision fit the API36 screen; existing horizontal action rows remain scrollable. Some captures contain already-queued validation toasts from preceding fixtures; these do not obscure the reviewed controls. Older APIs, font scaling and broader accessibility remain release gates.

All19pinned imports reproduce. Catalog, transport and diff checks pass. Nine unchanged terminal engine/transport/storage/parser/template files match baseline byte for byte; nine Future Cash financial/audit hashes and wallet public-audit checkpoint hashes also match. No owner device/data, live node, seed, signing, posting or transfer used. Dedicated emulator5580 stopped after identity check; launcher exit0. Evidence: `build/localization/txn-validation.json`.

Next: Terminal KISS reference,115bundled command-help pages/parameter descriptions, and generated default script names/template comments. Preserve canonical parser inputs; localize their display. During that prose pass, correct the English workbench help's claim that all listed rules are enforced automatically: this is still a manual workbench with explicit user actions. Then remaining integrated apps/core labels and full release acceptance, signing and publication. Candidate remains uncommitted, unsigned for release and unpublished; goal active. Publication destinations remain the GitHub fork, PandaApps and eurobuddha.com only.


## Terminal KISS reference and template prose — 2026-10-17

Added ten messages (1595 total) for the complete KISS quick reference, six template comments, untitled scripts, copies and node imports. Reused the existing selectable reference TextView, weak Language binding, Activity-owned LanguageDialog, canonical Templates.ALL, shared template-choice labels and existing ScriptDB flows. Canonical adapter: `scripts/adapt-pandamonium-terminal-reference-languages.py`. Source references inspected: standalone/integrated assets/kissvm.txt, Templates.java, ScriptsView.java, ScriptEditorActivity.java, HelpStore.java, ParamDocs.java, ScriptDB.java, Language.java and existing editor tests/adapters. Graph lessons refreshed (47 memories,46 useful/1 dead end), expanded exact vocabulary [help,store,param,docs,reference,kiss]; traversal produced six mostly broad nodes, including KissHighlighter and CommandRegistry.Param. Direct source supplied the relevant behavior.

The reference now updates in the same open dialog. New template names and comments capture the chosen language when created. User-entered names, previously saved source, imported source and duplicated source remain literal across subsequent language changes. TemplateText replaces only the donor's leading comment; importer assertions require exact canonical English comments and reject translated comment delimiters. Executable KISS text is unchanged. The English transaction workbench help now says “Rules to follow” instead of promising automatic enforcement. Its adapter still recognizes the original donor wording.

Validation: all three debug variants and instrumentation APK build;9 shared-language JVM cases;3 device cases pass. Device coverage includes retained reference dialog/selectable body and editor draft/cursor, literal syntax/examples in all4 languages, all28 combinations of7templates×4languages through the real creation dialog, stored-content preservation, unchanged flattened executable code, exact English template source, raw custom names, copies and node imports. Editor launches during creation tests were intercepted with Android ActivityMonitor; no embedded node or actual deployment ran. Eight top/end reference captures were collected and reviewed across the languages. All19 pinned imports reproduce; catalog, transport and diff checks pass. Nine terminal core files, canonical help/assets/HelpStore, nine Future Cash financial/audit files and wallet public-audit hashes remain unchanged. Dedicated emulator5580 stopped after identity check, launcher exit0. Evidence: `build/localization/reference-validation.json`.

### Code review

Summary: The change follows existing binding and storage paths. It localizes newly generated prose without modifying executable templates or rewriting saved user content. Donor drift and comment delimiters are checked during import.

Findings: Minor wording mismatch found during screenshot review: Russian/Ukrainian reference prose used a different label for Run than the editor button. Corrected both and added a runtime assertion that the reference includes the actual button label. Initial and final three-case device runs pass. The added label assertion initially used a nonexistent resource name; corrected it to read the actual button TextView. One intervening run used the older test APK and is retained only as an intermediate log, not final evidence. No unresolved defect identified in this checkpoint. Technical guidance is translated from the pinned donor; this checkpoint does not establish new live-chain evidence for its claims. The115 command-help pages and parameter descriptions remain English and require a separate display layer so canonical parser inputs stay stable.

Verdict: Approve this checkpoint. The multilingual release remains incomplete, uncommitted, unsigned for release and unpublished. Next: the115 command-help pages/parameter descriptions, then remaining integrated-app text and full release acceptance, signing and publication to GitHub fork/PandaApps/eurobuddha.com only.


## Terminal command help: summaries and first pages — 2026-10-17

All115 command summaries now translate, including descriptions in completion rows and help listings. Added12full pages (block,burn,getaddress,newaddress,checkaddress,mempool,healthcheck,status,random,coinexport,coinimport,help) and10parameter descriptions. Added135 messages (1730total). Canonical mapping: `localization/terminal-help.json`; adapter: `scripts/adapt-pandamonium-terminal-help-languages.py`. The103remaining full pages total80675characters and still require translated display and parameter descriptions.

Read complete HelpStore, ParamDocs, Suggest, TerminalView, TerminalLabel, existing console tests and fixed message generator. Compared the Parlons portal HelpStore/ParamDocs/Suggest: exact matches after package renaming. Reused TerminalLabel suppliers, owned LanguageDialog, Language.setText, ParamDocs.stripParams and the existing fixed lookup generator. Graph lessons refreshed:48memories,47useful/1dead end. Source-filtered graph inspection found48help/parser/suggestion nodes with82internal relationships. Existing graph vocabulary expansion from the preceding checkpoint [help,store,param,docs,reference,kiss] had led mostly to broad nodes; direct source paths supplied the useful connections.

The canonical help.json, HelpStore, ParamDocs, CommandRegistry and Suggest remain unchanged. Required/optional detection always parses the original English text. Displayed summaries keep literal parameter prefixes; descriptions translate only at rendering. Completion items, token offsets, inserts, ordering, required flags, user input and unknown node replies remain literal. Full help dialogs update in place. Help output captures the callback as a JSON string before refreshing language, so later mutations cannot alter the result. The renderer now accepts standalone help commands only and leaves failed replies as raw JSON, preserving their errors.

Review found the inherited getaddress page claimed every address had classic262144 capacity. Read local getaddress/keys/Wallet/KeyRow plus host StartupMode, then verified the ACTUAL bundled minima.jar using javap: TreeKey.createDefault chooses128×4 when USE_BLOCK_AS_KEYUSES is true and64×3otherwise; KeyRow.toJSON exposes size/depth/uses/maxuses; getDefaultAddress chooses an existing default address. The separately checked-out core source is older and cannot establish the new key behavior. Corrected displayed getaddress prose in all4languages to direct users to the individual key's capacity/use position via keys action:list. Removed its misleading automatic “then wipe keys” follow-on. Canonical parser text stays unchanged; an explicit sourceOverrides entry validates the original page and maps it to the corrected display. No node command, key creation or seed access occurred. Public bytecode evidence: `build/localization/help-key-shapes.txt`. The untranslated keys full page repeats this classic-only claim and must receive the same evidence-based correction when translated.

Validation: all3debug variants and instrumentation APK build;9shared-language JVM tests;8console/help Android cases pass, including3new cases. Initial8case run passed before the getaddress correction; final8case run passed afterward. Tests enumerate all115summaries, assert exact English prefixes/source except the explicit corrected getaddress page, preserve every page's example block, retain cached parser maps and identical completion data across4languages, verify required coinimport data versus optional track/status clean, retain dialog/row/input/cursor identity, test real Tab insertion, and assert callback mutation cannot change output. Unknown commands, non-help prefixes, chained commands, failed replies and unknown full help remain literal. Existing console tests continue covering raw spans/selection, favorites, risk confirmation and exports. Eight help dialog/output screenshots were collected, with representative captures reviewed across all4languages. All19pinned imports reproduce; catalog/transport/diff checks pass. A resource-only final correction caused the temporary regeneration script's changed-file assertion to report an empty diff; corrected that expectation and confirmed the authoritative importer verifier passes. No generated Java change was needed for that wording edit.

TenTerminalcore/parser/storage/template/completion files and canonical help assets/HelpStore match the prior baseline/checkpoint. NineFutureCash financial/audit hashes and wallet public-audit checkpoint hashes match. Dedicated emulator5580 stopped after identity check, launcherexit0. Evidence: `build/localization/help-validation.json`. No owner device/data or live signing, posting, transfer or deployment used.

### Code review

Summary: Display localization reuses existing lookup/binding paths and retains canonical parser/completion behavior. Successful help outputs use immutable captured input to rerender translated text; raw failures are no longer obscured.

Findings resolved: failed help replies could hide errors behind a bundled page; loose startsWith(help) detection could misclassify another command or a command chain; classic-only getaddress capacity wording was wrong for the bundled block-key mode. Added regressions for these paths and immutable snapshots. No unresolved defect identified in this checkpoint; the103remaining full pages and broader acceptance remain explicit unfinished work.

Verdict: Approve this checkpoint. The release remains active, uncommitted, unsigned for release and unpublished. Next: remaining command help/parameter descriptions, then other integrated-app text and full release acceptance, signing and publication to GitHub fork/PandaApps/eurobuddha.com only.


## Terminal key and transaction command help — 2026-10-17

Added full help for keys, txncreate, txninput, txnoutput, txnstate, txnsign, txnbasics, txncheck, txnpost, txnexport, txnimport, txnlist and txndelete in all four languages. This adds58messages and47parameter descriptions:1788catalog messages,25full pages,57parameter descriptions and all115summaries now translate.90full pages remain. Candidate remains1.9.42/113 from1.9.41 commit9def96e6801a9bef261611e45349f28a1eb6ae1c.

Reused `localization/terminal-help.json`, `scripts/adapt-pandamonium-terminal-help-languages.py` and the existing TerminalLanguagesTest. Read the13canonical pages and their generated translations; the existing pinned importer regenerated only HelpText.java. No new display/parser architecture. Examples, command identifiers, parameter names, amounts, addresses and quoted string data stay verbatim. Canonical help.json/HelpStore/ParamDocs/Suggest and the other terminal engine/storage files stay unchanged.

Review corrected the keys page's universal classic262144capacity claim using the already verified bundled TreeKey shapes. It now directs users to individual size/depth/uses/maxuses via keys action:list. Removed an incomplete donor sentence from the displayed txninput page. Review also found stale custom-signing guidance: the shipped txnsign implementation requires keyuses for classic custom signing but permits omission in blockaskeyuses mode. Read actual bundled txnsign and block bytecode: supplied values are whole nonnegative integers below capacity; block selection combines current block, saved block position and supplied lower bound, then checks capacity. Corrected full txnsign help and its keyuses completion description in all four languages. The original parser assets remain intact through explicit sourceOverrides. Public bytecode evidence: `build/localization/help-custom-signing.txt`. No signing code changed or executed.

Validation: all3debug variants and instrumentation APK build;9localization JVM tests pass;9console/help Android cases pass. Expanded the existing enumeration to25pages and all their recognized parameter descriptions, preserving115summary/parser/completion fingerprints across4languages and exact example suffixes. Tests cover corrected English display exceptions, required/optional flags, retained dialog/input/cursor, and the longer signing page scrolling from top to every final example. Eight top/end signing captures were collected and reviewed across the four languages. All19pinned imports reproduce; catalog/transport/diff checks pass. Ten terminal core files, canonical help assets, nine Future Cash financial/audit hashes and wallet public-audit checkpoint hashes match. Dedicated emulator5580 stopped after identity check; launcherexit0. No owner device/data, live node, seed, signing, posting or transfer used. Evidence: `build/localization/help-transactions-validation.json`.

The user's Future Cash request was rechecked against graph memories and current KeyAudit/DualKeyAuditTest. Both classic64x3 and block128x4 families are already included in the Pandamonium candidate, with separate capacity handling, classic-only count estimates, confirmed reuse checks for both and incomplete-evidence gates. Wallet-audit checkpoint hashes still match. Standalone donors remain unchanged. No new Future Cash test run was needed for this documentation-only checkpoint.

### Code review

Summary: The additional pages reuse the validated display layer and preserve canonical command data. Corrected key-mode guidance is based on the actual bundled node rather than the older sibling core checkout.

Findings resolved: MINOR — inherited keys help claimed a classic-only capacity; custom-signing help described classic counter behavior for block mode; txninput contained a dangling sentence. The display corrections are explicit and tested. No unresolved defect identified in this checkpoint.

Verdict: Approve this checkpoint. The complete multilingual release remains active, uncommitted, unsigned for release and unpublished. Continue the90remaining full help pages and other integrated-app translations, then full acceptance, signed versioned builds and publication to the GitHub fork, PandaApps and eurobuddha.com only.


## Terminal recovery, coin and remaining transaction help — 2026-10-17

Added27full help pages: backup,balance,coincheck,coinnotify,coins,cointrack,decryptbackup,history,reset,restore,restoresync,vault,sign,verify,seedrandom,hash,convert,txnaddamount,txnauto,txnclear,txncoinlock,txnlock,txnmine,txnminepost,txnmmr,txnscript,txnview. All four languages included. Added122catalog entries and108parameter descriptions;1910messages total,52full pages and165parameter descriptions. All115summaries remain translated.63full pages totaling56037source characters remain.

Reused the existing terminal-help catalog/spec, fixed lookup generator, HelpText and TerminalLanguagesTest; generated only HelpText.java from pinned imports. Read the27canonical pages and their translated text. Existing full-source reuse evidence remains in preceding checkpoints. No parser, command-building, signing, storage or node change. Duplicate source lines reuse existing translation resources; duplicate parameter headings preserve the canonical parser's first-header behavior. Literal JSON examples and {port:value}/{script:proof} forms remain data.

Display corrections based on source review:
- reset no longer describes classic262144exhaustion as a usable maximum or implies default1000is always safe. Guidance distinguishes the key's own capacity and use position. Actual bundled reset delegates seed recovery to archive; archive uses default1000; the previously inspected TreeKey and signing code establish family capacities. No reset/recovery was executed.
- sign's example now includes the required publickey parameter, confirmed in bundled runCommand/getValidParams.
- txnview's inherited full-page title incorrectly said txnimport; displayed title corrected. decryptbackup's header whitespace normalized.
- vault prose now distinguishes phrase-based key restoration from password unlocking rather than universally requiring the phrase for unlocking.
- restoresync's help described a configurable keyuses argument, but bundled getValidParams omits it and CommandRunner rejects unlisted arguments. Display now says this parameter is rejected by this bundled node and that it uses the default increment256. The node binary and canonical parser assets are unchanged. This is an explicitly documented inherited command limitation, not a claim that the parameter was implemented.

Used javap on actual bundled reset/archive/vault/restoresync/sign/CommandRunner; saved public evidence in `build/localization/help-recovery-evidence.txt`. Explicit sourceOverrides preserve and validate the original help while mapping it to corrected display. Aside from the corrected sign example, all example suffixes remain byte-for-byte identical.

Validation: all3debug variants and Pandamonium test APK build,9localization JVM cases and10console/help Android cases pass. Expanded page/parameter enumeration across4languages; all115canonical summaries/parser maps/completion fingerprints remain unchanged. Added the existing retained-dialog scroll harness for vault help; checks draft/cursor/dialog identity and reaches the final examples without executing a command. Eight vault top/end captures reviewed across all4languages. All19pinned imports reproduce; catalog/transport/diff checks pass. Ten terminal core files/canonical assets, nine Future Cash financial/audit files, wallet public-audit checkpoint and bundled node jar hashes are unchanged. Dedicated emulator5580 stopped after identity check, launcherexit0. No owner device/data, real node, seed, signing, recovery, posting or transfer used. Evidence: `build/localization/help-wallet-validation.json`.

### Code review

Summary: The display-only extension reuses the tested lookup and binding paths. It preserves command data and exposes verified limitations in inherited help.

Findings resolved: MINOR — reset capacity/default wording, missing publickey in sign example, incorrect txnview title, ambiguous vault unlocking guidance, and unsupported restoresync keyuses documentation. The source-based overrides and example exception are covered by runtime tests. No unresolved defect found in this display checkpoint; the restoresync engine limitation remains documented and the1.9.41baseline binary is preserved.

Verdict: Approve this checkpoint. Full multilingual release remains active, uncommitted, unsigned for release and unpublished. Continue63remaining help pages, remaining integrated-app/core text, then full acceptance, signed versioned artifacts and publication to GitHub fork/PandaApps/eurobuddha.com only. Ukrainian remains explicitly authorized.


## Terminal network and diagnostics help — 2026-10-17

Added29full pages in English, Simplified Chinese, Russian and Ukrainian: automine,benchmark,connect,debugflag,disconnect,hashtest,incentivecash,jniminingtest,jnitest,logs,maths,message,network,p2pstate,peers,ping,printmmr,printtree,quit,rpc,scanchain,slavenode,systemcheck,test,timemilli,trace,tutorial,webhooks,whitepaper. Added84messages and64parameter descriptions. Catalog1994;81full pages,229parameter descriptions and all115summaries translate.34full pages remain.

Reused `localization/terminal-help.json`, the existing help adapter/generator and TerminalLanguagesTest. Read all29canonical pages and translated prose. Only the generated HelpText mapping changed in the imported modules; canonical assets/parser, command construction and node binary are unchanged. URLs, parameter names, processor IDs, numbers and existing examples stay literal except the three corrected benchmark example sets.

Review found copied noncetest titles and hashtest/benchmark examples in benchmark,jniminingtest,jnitest. Compared the actual bundled classes' valid parameters, default values and response fields using javap. Corrected displayed titles, examples, defaults and results: benchmark uses hashes default1000 and returns Java/JNI millitime; jniminingtest uses maxattempts default1000000 and returns comparison details; jnitest uses maxattempts default1000 and returns JNI result details. All three reject amount, which is supported by hashtest; the corrected full pages say so and omit that unsupported parameter section. Shared hashtest parameter descriptions remain unchanged. The original canonical parser inputs and donor pages are retained via sourceOverrides.

Also corrected printmmr's leaf-row documentation from1to0. Bundled MMR.addEntry inserts leaves at row0 and MMREntry.toJSON writes the stored row without shifting it. Saved public evidence for the benchmarks and MMR classes in `build/localization/help-diagnostics-evidence.txt`. No benchmark, JNI mining, network change, RPC enablement or other node operation was executed.

Validation: all3debug variants and instrumentation APK build;9localization JVM tests pass. Existing10console/help Android cases pass with expanded enumeration across81pages and their recognized parameter descriptions in4languages, preserving115parser/completion fingerprints and example suffixes except explicit corrected examples. Extended the existing retained-help-dialog case to peers: language changes preserve dialog/draft and scroll to the final examples without calling the fixture node or opening URLs. Eight peers top/end captures reviewed across4languages. All19pinned imports reproduce; catalog/transport/diff checks pass. Ten terminal core/parser/storage files, canonical help assets, nine Future Cash financial/audit files, wallet public-audit checkpoint and node jar hashes remain unchanged. Dedicated emulator5580 stopped after identity check; launcherexit0. No owner data/device, node, seed, signing, transfer or external network action used. Evidence: `build/localization/help-network-validation.json`.

### Code review

Summary: Additional help content uses the established display lookup and live bindings. Explicit source overrides correct verified inherited documentation errors while retaining parser inputs.

Findings resolved: MINOR — benchmark commands had copied titles/examples, wrong defaults and return descriptions, and unsupported amount sections; printmmr described leaf row1instead of0. Tests cover corrected titles/examples and preserve canonical data. No unresolved defect identified in this checkpoint.

Verdict: Approve this checkpoint. Full multilingual release remains active, uncommitted, unsigned for release and unpublished. Remaining34pages: archive,consolidate,consolidatefrom,constructfrom,createfrom,createtokenfrom,megammr,megammrsync,mmrcreate,mmrproof,multisig,multisigread,mysql,mysqlcoins,newscript,postfrom,rawfrom,rawtxnfrom,removescript,runscript,scripts,send,sendfrom,sendnosign,sendpoll,sendpost,sendsign,sendview,signfrom,sphincs,tokencreate,tokens,tokenvalidate,txpow. Then remaining integrated-app/core text, full acceptance, signed versioned builds and publication to GitHub fork/PandaApps/eurobuddha.com only.

## Terminal sending and token help — 2026-10-17

Added 11 full help pages in English, Simplified Chinese, Russian and Ukrainian: send, sendnosign, sendpoll, sendpost, sendsign, sendview, consolidate, tokencreate, tokens, tokenvalidate and txpow. Added 63 messages and 78 parameter descriptions. The catalog now has 2057 messages; 92 full pages, 307 parameter descriptions and all 115 summaries translate. There are 23 full pages left.

Reused `localization/terminal-help.json`, `scripts/adapt-pandamonium-terminal-help-languages.py`, the existing generator and `TerminalLanguagesTest.java`. Read all selected canonical pages in the integrated assets and the matching terminalide donor; reviewed HelpStore, ParamDocs and their callers. Only generated HelpText changed among the imported sources. Command examples, parameter headers, JSON literals, file paths and numbers remain unchanged across all four languages. A source check verified these invariants for every new page. Canonical help assets and parser inputs are unchanged.

### Code review

Summary: The existing display mapping and retained-dialog language bindings cover the additional help without changing transaction execution. No financial operations were exercised.

MINOR — `tokens` contained copied key-management descriptions for import/export. The actual bundled `org.minima.system.commands.search.tokens` class imports Token data through TxPoWSearcher.importToken and exports the selected token as MiniData. Corrected the displayed full page and action description in all languages using explicit source overrides. Saved javap evidence in `build/localization/help-tokens-evidence.txt`; preserved the node binary and donor inputs. Tests assert the corrected English descriptions and reject the copied key-management wording.

Validation: All three debug variants and the instrumentation APK build successfully. Nine shared-language JVM tests and all ten Terminal Android cases pass. The existing suite now enumerates all 92 translated pages and their recognized parameter descriptions, preserving all 115 parser/completion fingerprints. Extended its retained-dialog case to cover peers, send and tokens in four languages; the draft survives, text remains selectable, final examples are reachable, and no fixture command is executed. Reviewed 16 send/tokens top/end screenshots. All 19 pinned imports reproduce. Catalog, transport and diff checks pass. Terminal core files, canonical help assets, nine Future Cash financial/audit files, wallet public-audit checkpoint and node jar remain unchanged. Dedicated emulator 5580 stopped after identity verification; launcher exited 0.

Verdict: Approve this checkpoint. Evidence: `build/localization/help-sending-validation.json`. No owner devices, data, seed, node, signing or transfers were used. The complete multilingual release remains active, uncommitted, unsigned for release and unpublished. Remaining full pages: archive, consolidatefrom, constructfrom, createfrom, createtokenfrom, megammr, megammrsync, mmrcreate, mmrproof, multisig, multisigread, mysql, mysqlcoins, newscript, postfrom, rawfrom, rawtxnfrom, removescript, runscript, scripts, sendfrom, signfrom, sphincs. Then remaining integrated-app/core text, full acceptance, signed versioned builds and publication to the GitHub fork, PandaApps and eurobuddha.com only.

## Terminal custom-key, script and MMR help — 2026-10-17

Added 16 full pages in English, Simplified Chinese, Russian and Ukrainian: consolidatefrom, constructfrom, createfrom, createtokenfrom, postfrom, rawfrom, rawtxnfrom, sendfrom, signfrom, mmrcreate, mmrproof, newscript, removescript, runscript, scripts and sphincs. Added 75 messages and 81 parameter descriptions. Catalog: 2132 messages; 108 full pages, 388 parameter descriptions and all 115 summaries translate. Seven full pages remain.

Reuse: read the matching canonical help entries in the terminalide donor and integration; retained the existing terminal-help mapping, generator, display adapter, parser and test harness. Generated HelpText is the only changed imported module file. Examples, parameter headers and numbers match across all four languages. Original examples remain literal except the two verified repairs below; canonical parser assets are unchanged.

### Code review

Summary: These additions continue the established display-only localization. The node binary, transaction construction/execution and wallet behavior are unchanged. The help now distinguishes wrapper requirements from the delegated signer rules.

MINOR — Four custom-key wrappers described keyuses solely as a signature count. The actual bundled consolidatefrom, createtokenfrom, sendfrom and signfrom all require getNumberParam(keyuses) and delegate to txnsign publickey:custom. Re-read their call sites, txnsign validation and block.getCurrentBlockAsKeyUses. Corrected their help and shared parameter description: the argument is required, selects the next unused leaf in classic mode, and supplies a lower bound in blockaskeyuses mode alongside the current block and saved position. Values must be non-negative integers below capacity. The guidance retains the no-reuse warning and explains that TreeKey.createDefault follows the node mode, which must match the signing key/address. Rechecked the saved TreeKey bytecode evidence (classic64x3, block128x4) against the unchanged node jar checkpoint.

MINOR — rawtxnfrom displayed a rawfrom example with JSON coin objects and no scripts array. Bundled rawtxnfrom iterates input coinid strings and a separate array of script strings. Corrected its example to those exact types, preserving the existing public sample values, outputs and state.

MINOR — removescript had a malformed heading (a carriage return instead of the initial r); corrected only its displayed heading. SPHINCS verify was described as signing, its file help described only writing, and its example combined signature/file alternatives with a pipe. The bundled SPHINCS branch calls verifySignature, reads file if supplied, otherwise reads signature; corrected its prose and split the example into the two supported forms. Saved public bytecode evidence in `build/localization/help-construction-evidence.txt`; originals are retained via explicit source overrides.

Validation: All three debug variants and the instrumentation APK build. Nine shared-language JVM tests and all ten Terminal Android tests pass. Existing enumeration covers 108 pages and recognized descriptions in four languages while preserving all 115 parser/completion fingerprints. Tests cover repaired examples, required key-use guidance, JSON/KISS literals and unknown-text behavior. Extended retained-dialog coverage to sendfrom, rawtxnfrom and sphincs, retaining peers/send/tokens coverage. Drafts remain intact, text stays selectable, final examples are reachable and the fixture receives no commands. Reviewed 24 new top/end captures in four languages. All 19 pinned imports reproduce; catalog, transport and diff checks pass. Core parser/storage, canonical help assets, nine Future Cash financial/audit files, wallet public-audit checkpoint and node jar hashes are unchanged. Only the dedicated emulator 5580 was used; it was stopped after identity verification and its launcher exited 0.

Verdict: Approve this checkpoint. Evidence: `build/localization/help-construction-validation.json`. No owner device/data, real node, seed, signing or transfer used. Full release remains active, uncommitted, unsigned for release and unpublished. Remaining help pages: archive, megammr, megammrsync, multisig, multisigread, mysql and mysqlcoins. Then remaining integrated-app/core text, full acceptance, signed versioned builds and publication to the GitHub fork, PandaApps and eurobuddha.com only.

## Terminal help complete — 2026-10-17

Added the final seven full help pages in English, Simplified Chinese, Russian and Ukrainian: archive, megammr, megammrsync, multisig, multisigread, mysql and mysqlcoins. All 115 bundled command summaries and full pages now translate, along with 467 parameter descriptions. Added 68 catalog entries; total 2200. This completes the bundled terminal help text, not the full multilingual release.

Reuse: read the seven canonical pages in apks/terminalide/app/src/main/assets/help.json and verified they match the integrated asset. Reused the existing terminal-help catalog, fixed-message generator, display adapter and TerminalLanguagesTest. Only generated HelpText changed among imported sources; canonical parser assets and node binary are unchanged.

### Code review

Summary: Display-only translations preserve command names, parameter names, sample values and command execution. Parameter headers, numeric values and example text match across the four translations. The source text is retained through explicit overrides for verified corrections.

MINOR — archive and megammrsync described 262144 as the maximum for normal keys. Reused the established recovery guidance from the translated reset page: choose a restored use position from known previous usage, do not assume 1000 is safe, stay below the key's own maxuses, and distinguish classic 64x3 from block keys. mysql now carries the same recovery guidance. Checked actual bundled archive, megammrsync and mysql bytecode: keyuses defaults to 1000. mysql used the node's NUMBER_GETADDRESS_KEYS constant, initialized to 64, while its help said 80; corrected the displayed default. Existing recovery/TreeKey evidence remains applicable to the unchanged jar.

MINOR — multisigread examples invoked multisig; corrected their command prefix after checking the bundled class's getkey/list/spend/view/post paths. mysql rawexport example used a gzip filename; corrected to raw.dat. mysqlcoins query example supplied only a WHERE expression and another example placed command parameters inside the SQL string. Actual code passes query directly as a complete SQL statement, prefixes where with SELECT * FROM coins WHERE, and separately handles address/spent/limit. Corrected the examples to those supported forms. No database or node command was executed. Public bytecode evidence is in build/localization/help-final-evidence.txt.

Validation: all three debug variants and the instrumentation APK build; nine shared-language JVM tests and ten Terminal Android tests pass. Existing enumeration now checks all 115pages and every recognized parameter description in four languages while preserving the 115 canonical parser/completion fingerprints. Existing retained-dialog tests now also exercise archive, mysql and multisigread. Reviewed 24 top/end captures in four languages; text stays selectable, final examples are reachable and the typed draft is retained. Fixture callbacks remain empty. All19pinned imports reproduce; catalog/transport/diff checks pass. Core parser/storage, canonical assets, nine Future Cash financial/audit files, wallet public-audit files and node jar hashes are unchanged. Only dedicated emulator 5580 was used, then stopped after identity verification; launcher exit 0.

Verdict: Approve this help checkpoint. Evidence: build/localization/help-final-validation.json. No owner devices/data, real node, seed, signing or transaction used. The broader goal remains active, uncommitted, unsigned for release and unpublished. Remaining: integrated-app/core text coverage and full acceptance, followed by signed versioned release APKs and publication to GitHub fork, PandaApps and eurobuddha.com only.

## ETH Wallet UI language bindings — 2026-10-17

Added 106 messages in English, Simplified Chinese, Russian and Ukrainian. Catalog total: 2306. Setup, source/import warnings, home labels, send/review/fee tiers, receive/export text, token menus and settings use the shared language bindings. Raw addresses, amounts, token symbols and remote error details remain literal. Local engine error text still needs coverage.

Reuse: read apks/ethwallet MainActivity and the integrated MainActivity, Design, KeyVault, EthWallet, EthRpc, EthTx, TokenStore, EthNet and IconLoader; reused localization LanguageDialog, Explorer/Terminal adapters and the existing KeyVault failure regression. The adapter changes only integrated ETH MainActivity and Design. Seven wallet/network/transaction/storage source hashes remain unchanged. The dialog wrapper preserves caller dismissal callbacks and releases owned dialogs when the activity is destroyed. Fee multipliers, validation, signing, storage and FLAG_SECURE remain intact.

### Code review

Summary: This checkpoint translates display text through existing descriptors and retains form state. Four Android tests cover source choice, editable dialogs, send drafts, confirmation recipient spans, tier selection and dismissal cleanup. The initial three failures were assertions before queued dismissal callbacks; corrected test sequencing and unchanged production code passed all four cases. Ten JVM tests (nine shared language and one KeyVault) pass. All three debug variants and the instrumentation APK build, all 19 pinned imports reproduce, and catalog/transport/diff checks pass.

MINOR — Secondary text uses the donor Design.DIM/DIM2 colors on a light native dialog. The 12 reviewed captures show complete labels and full confirmation recipient/fee warnings, but secondary-text contrast needs correction during accessibility acceptance. Populated home, menus, receive/export warning, rotation/background and secure-dialog behavior still require device acceptance. No claim of complete ETH localization or release readiness.

Verdict: Approve with remaining acceptance work recorded. Evidence: build/localization/eth-validation.json. Device tests used only the dedicated disposable emulator and public fixtures; a known public test key was used in memory for the send draft, with no vault persistence, real key, node, RPC, signing or broadcast. Emulator 5580 stopped after identity verification; launcher exit 0. Future Cash financial/audit and minimaWallet public-audit hashes and the node jar remain unchanged. The existing Future Cash report files total 70 passing tests; they were inspected, not rerun in this checkpoint.

Future Cash requested upgrade is already present in this Pandamonium candidate: mixed classic 64x3 and block-as-keyuses 128x4 auditing, separate capacities, classic-only counter heuristic, confirmed reuse for both, incomplete evidence guards and minimaWallet public-key inclusion. Standalone donor remains unchanged.

The wider release goal remains active, uncommitted, unsigned for release and unpublished. Next: ETH local error text/clipboard and remaining acceptance, other integrated-app translations and full acceptance, signed versioned builds and publication to GitHub fork, PandaApps and eurobuddha.com only.

## ETH Wallet diagnostics and acceptance — 2026-10-17

Added 11 local diagnostic messages, bringing the catalog to 2317 in English, Simplified Chinese, Russian and Ukrainian. Reused the wallet error generator for three fixed failures and eight templates. Remote/library details, addresses and numeric captures remain literal. Display mapping does not alter gas limits, retries, validation or signing. The sensitive clipboard label uses the existing localized label.

Reused the Future Cash dark Material dialog attributes and minimaWallet ORIGINAL_DARK warning color. ETH secondary text now uses #9A9AA8; warning text uses #FF5B5B. The warning contrast measured 5.093:1 against the rendered modal background in all four languages. Interactive pills, scan/max actions and fee choices have 48dp minimum touch heights.

### Code review

Summary: Display changes retain the existing wallet, storage, RPC and transaction behavior. Seven engine/storage source hashes, nine Future Cash financial/audit hashes, minimaWallet public-audit sources and the node jar match the previous checkpoint. The 19 pinned imports reproduce. Catalog and diff checks pass.

Findings: The earlier secondary-text contrast issue is resolved. Visual review also caught insufficient red warning contrast against the rendered Material elevation overlay; the final color correction passes measurement and two targeted device regressions. No unresolved finding in this change. Real derivation and biometric/keystore acceptance remain separate release work.

Verdict: Approve this checkpoint. Fourteen JVM tests pass (nine shared localization and five ETH), and seven Android cases pass. After the final warning-color correction, confirmation and home/menu cases pass again. All three debug variants built; Pandamonium and its instrumentation APK rebuilt after the color adjustment. Existing Future Cash reports total 70 passing tests; they were inspected, not rerun.

Device coverage includes populated home/settings, receive/export warnings, retained source/input/send/fee state, full confirmation recipient, dialog cleanup and secure-window behavior across background/resume. Reviewed 28 captures plus four corrected confirmation captures. Tests used only the disposable Bear emulator and public fixtures. No owner data, live node, real seed, RPC, signing, broadcast, vault persistence or credential approval was used. Secure windows were not captured. Emulator 5580 stopped after identity verification; launcher 46580 exited 0.

Evidence: build/localization/eth-complete-validation.json. Future Cash mixed classic/block-as-keyuses auditing remains implemented in the Pandamonium candidate; the standalone donor is unchanged. The wider release remains active, uncommitted, unsigned for release and unpublished. Next: remaining integrated apps, full acceptance and authorized signed publication.

## Entropy languages and secure host integration — 2026-10-17

Added 87 messages (66 interface labels/templates, 14 fixed diagnostic messages and seven diagnostic templates) in English, Simplified Chinese, Russian and Ukrainian. Catalog total: 2404. Dice mode/length, source status, security warnings, collection progress, completed summaries, per-roll audit labels, last-word calculator, candidate status and local self-test failures use retained text descriptors. BIP39 words, input values, dice data, verification commands and unknown diagnostics stay literal. The two existing pages remain alive during language changes; tab titles refresh using the Terminal IDE pattern.

Reuse: read the donor apks/entropy README and SECURITY-REVIEW plus the complete integrated MainActivity, DiceView, LastWordView, Ui, MainPager, BaseView, Theme, Bip39, RollEngine, NodeApi, DiceRollView and Bip39Test. Compared donor implementations with integrated sources: UI/calculation code matched except resource prefixes. Reused shared Language bindings/TextBuilder, the Terminal IDE tab refresh, wallet/ETH diagnostic generator and regression patterns, and the existing minimaWallet requiresSecureScreen policy. The six engine/support sources and BIP39 wordlist hash remain unchanged. No dependency added.

### Code review

Summary: Changes are confined to display bindings, layout colors/tab sizing, and the necessary host screenshot-policy correction. Raw seed words and audit values never enter translation-key lookup. Engine exceptions and calculation code remain unchanged. The 19 pinned imports reproduce; catalog and diff checks pass. ETH/Future Cash financial sources, minimaWallet public-audit sources and node jar still match their prior checkpoints.

CRITICAL — resolved: The host's general screenshot policy cleared Entropy's FLAG_SECURE at resume when screenshots were allowed (including the debug default). All four first device cases caught this before their data operations. The existing PandamoniumHooks.requiresSecureScreen now includes Entropy while its explicit demo mode is off. A regression verifies protection after background/resume and a general screenshot-toggle update. Explicit donor demo behavior is preserved; tests never enable it.

MINOR — resolved: Subtitle and inactive-tab text used #5A6080 against #0A0E1A (3.14:1). They now reuse Entropy Theme.dim's #8A93AD (6.29:1); a targeted device case verifies the actual colors and label layout in all four languages.

Verdict: Approve this checkpoint. Seventeen JVM tests pass: five existing BIP39 parity tests, three diagnostic tests and nine shared localization tests. All three debug variants build. Five device cases pass for typed draft/cursor retention, physical roll history/progress, public last-word candidates/chosen word, the known public completed dice vector/audit, and self-test blocking plus label layout. After the final color-only change, Pandamonium and instrumentation rebuild and the targeted failure/layout/color case passes again. The old broad integration test's screenshot expectations were aligned with sensitive screens and compile; that full node-starting test was not run.

Tests used only Bears_Languages_API36/emulator-5580 with public deterministic fixtures and no node, owner data, random generation, network, vault persistence, signing or transfer. No secure window was captured or capture protection bypassed. Layout was checked on device by asserting no ellipsis and enough height for rendered text; this is not a screenshot-based visual review or full font-scale acceptance. Emulator stopped after identity verification; launcher 43414 exited 0.

Evidence: build/localization/entropy-validation.json. Wider release remains active, uncommitted, unsigned for release and unpublished. Continue remaining integrated-app translations and full acceptance, then signed versioned builds and the authorized GitHub fork/PandaApps/eurobuddha.com publication.

## Filez languages and retained file operations — 2026-10-17

Added 63 messages in English, Simplified Chinese, Russian and Ukrainian. Catalog total: 2467. File browser listing, real plural item counts, metadata dates, menus, rename/new-folder/delete/detail dialogs, import/export/backup status, clipboard messages, node banners and accessibility labels now use the shared localization system. Paths, filenames, extension values, node errors and typed drafts stay literal. No operation starts merely because language changes.

Reuse: read the complete native Filez MainActivity, NodeApi, Util, FileEntry, FilezDesign, layouts/themes/build configuration and donor counterparts under apks/filez. Integrated NodeApi already uses the guarded DirectNodeApi file bridge, SAF streaming and captured import directory; these are preserved. Reused shared LanguageDialog for retained inputs/buttons and wrapping titles, ETH retained-dialog ownership/dark Material colors, Terminal IDE menu-title refresh, and the wallet local-diagnostic generator. No donor tests existed. NodeApi/Util/FileEntry hashes match the pre-change snapshot; import/export stream and path validation logic remain unchanged.

### Code Review

Summary: Display-only adaptation preserves existing command identifiers and data, retains dialog inputs, cleans up owned dialogs/menus at destruction and distinguishes local missing-error fallbacks from literal node responses. All 19 pinned imports reproduce; diff checks pass. Node jar, Entropy engine, ETH/Future Cash financial files and minimaWallet public-audit sources match prior checkpoints.

MINOR — resolved: Initial screenshots showed popup labels clipped after switching language despite correct MenuItem titles. Android cached the previous popup width. The correction dismisses/re-shows only the popup window, preserving original translation descriptors, items and action listeners; the internal dismiss temporarily suppresses ownership cleanup. A rendering regression checks each actual popup TextView for zero clipping ellipses in all four languages. Updated screenshots show complete labels. Literal trailing dots in the export label remain intentional.

Verdict: Approve this checkpoint. Nine shared localization JVM tests pass and all three debug variants build. Six disposable-emulator cases pass: listing/date/count/path retention; main/entry menu labels/actions; rename draft/cursor and delete target retention; detail path/raw node response; byte-exact export between temporary fixture files while changing languages; local fallback versus raw remote errors. After the menu correction Pandamonium and instrumentation rebuild and the targeted menu case passes again. Twenty-four captures reviewed; eight menu captures re-reviewed after correction. Full font-scale and real node/document-picker acceptance remain wider release work.

Tests used only Bears_Languages_API36/emulator-5580, fake node callbacks, mixed-script public filenames and temporary cache fixture bytes. No owner data/devices, node, seed, keys, vault, signing, network or transfer. A queued startup no-node toast is visible in some captures. Emulator stopped after identity verification; launcher 24540 exited 0.

Evidence: build/localization/filez-validation.json. Release remains active, uncommitted, unsigned for release and unpublished. Continue remaining integrated apps, full acceptance and signed versioned publication to GitHub fork/PandaApps/eurobuddha.com only.

## Vestr languages and retained contract inputs — 2026-10-17

Added 98 messages (90 UI/plural labels and eight transport notices) in English, Simplified Chinese, Russian and Ukrainian. Catalog total: 2565. Ten transport diagnostic mappings reuse two existing resources. Creator/Collector/About, contract cards and details, create/calculator forms, grace choices, amount/status messages, relative dates, localized timestamps, node banners and native picker buttons now follow the manual selector. Token metadata, addresses, amounts, password drafts, IDs and remote error text stay literal; only an absent token-name fallback is translated. Native choice positions and associated IDs stay unchanged.

Reuse: inspected donor apks/vestr/README.md; complete MainActivity/MainPager/BaseView/SubActivity/AboutView/CreatorView/CollectorView/ContractUi/CalculatorActivity/CreateContractActivity/ContractDetailActivity, contract model/scripts/math, TxnBuilder, NodeApi, Util, token metadata and NodeApiResponseTest. Compared donor and integrated Java sources; existing integration changes are resource prefixes, DirectNodeApi/events, lifecycle and embedded-node guidance. Reused shared Language bindings, core TokenSpinnerAdapter bound-row pattern, Util.tokenName provenance checks, wallet diagnostic generator, and platform native picker saved state. Read local SDK android-36.1 DatePickerDialog/TimePickerDialog/Dialog saved-state implementations before the picker correction. NodeApi, VestingContract, Contract, TxnBuilder, Util, Coin, TokenBalance, TokenMeta and ImageLoader hashes remain unchanged. Reviewed creation and collection diffs: validation ordering, command strings, arithmetic, state ports, cleanup and callbacks remain the existing implementation.

### Code Review

Summary: Display bindings preserve user drafts and financial data. Text helpers accept CharSequence; actual protocol/command values remain strings and numbers. Relative time uses existing units/rounding with native plural categories. Detail label/value columns are bounded so long token names do not erase labels. No new dependency. Nine engine/support hashes, all prior financial checkpoints and node jar match. All 19 pinned imports reproduce; catalog and diff checks pass.

MINOR — resolved: Android's open calendar updated its header but retained an English month/day grid after a language change. The shared SubActivity retains dialog factories, saves native picker state, dismisses only the old window and restores the same unconfirmed values/callbacks into a newly localized picker. No confirmation callback runs during this refresh. On destruction, owned pickers are dismissed. Device checks retain 2030-01-02 and 14:37 across all four languages and verify cancel leaves the form date uncommitted. Corrected screenshots show localized month/week grids.

MINOR — resolved: Secondary/footer/navigation text #6A6A78 had 3.41:1 contrast on #15151F. It now uses existing #9A9AA8 (6.53:1); error text uses the established #FF5B5B. Corrected list/About captures reviewed. The final screenshot also exposed the startup DirectNodeApi stopped-node notice; all eight command-transport notices now have explicit local mappings. Remote onResult error strings remain literal.

Verdict: Approve this checkpoint. Eleven JVM tests pass (two existing response-boundary tests plus nine shared localization tests). Six Android cases passed initially, then all six passed again after the picker/color correction (17.446s): retained pages/contracts, calculator draft/dates/grace/result, pending create validation and fields, detail amount/burn retention plus fake rejected collection cleanup, native picker state/cancel, and literal metadata/grace semantics. After transport completion, two targeted cases pass (2.117s), including a selected custom-token name and its exact ID plus address/amount/burn/password/cursor retention. All three debug variants build on the final catalog. Twenty-one public fixture captures reviewed, with 13 corrected captures reviewed after calendar/color changes. No password-draft screen was captured. Initial build failure from duplicate Language.setText wrapping was corrected in the canonical adapter before device work.

Tests used only Bears_Languages_API36/emulator-5580 with a null embedded backend, fake node callbacks, synthetic contract JSON and public fixture values. Create stopped at a rejected fake checkaddress; collection rejected fake txncreate and verified recorded fake cleanup. No real command, node, funds, seed, vault, signing, network or owner data/devices used. Emulator stopped after identity verification; launcher 90501 exited 0.

Evidence: build/localization/vestr-validation.json. Real contract operations and full font-scale/accessibility acceptance are not claimed. Release remains active, uncommitted, unsigned for release and unpublished. Continue the remaining integrated apps, ensure shared transport notices are covered during full acceptance, then complete signed versioned publication to GitHub fork/PandaApps/eurobuddha.com only.


## Minima Mail languages and retained message inputs — 2026-10-17

Added 179 Mail messages, help paragraphs and diagnostic templates in English, Simplified Chinese, Russian and Ukrainian; shared catalog 2744. The current integration translates navigation, compose/reply, contacts, delivery status, identity and backup, payments, notifications, help and local diagnostics. Literal subject/contact/token/message/address data remain literal; display helpers retain Language.Message descriptors. Relative/date display reuses Language.since/stamp and native notification plurals. Seed/password fields and compose/payment drafts are not rebuilt on language selection.

Reuse: read donor apks/mail/README.md and MainActivity comparison, integrated MainActivity, Design, Util, IdentityRecord/Store, NodeApi, CommsDb, CommsScanner, CommsTransport, SendPin, MailMessage/MailText, crypto and image helpers and existing tests. Reused shared Language and LanguageDialog, Filez retained popup menu/re-measure behavior, wallet diagnostic generator and the DirectNodeApi failure map already verified for Vestr. Twenty-one comms/identity/support file hashes remain unchanged, including encryption, wire serialization, database, send-pinning, scanner and backup crypto. MainActivity retains the existing command construction, amount/address validation, image size limits, callbacks and statuses.

### Code Review

Summary: Canonical adapter and 19-app importer reproduce the changes. Dialog ownership uses decor attach/detach listeners so it does not replace the existing payment-sheet onDismiss cleanup. Menus keep their original items and callbacks while their window is remeasured for new labels. Recognized local diagnostics use bounded lookup; unknown diagnostic text remains literal. Node-returned payment error details remain literal. No new dependency.

MINOR — resolved: Conversation actions were anchored to the whole content container and appeared at the top of the screen. Reused the attachment popup's view anchor pattern to anchor to the tapped dots button. Corrected Russian/Ukrainian captures show the popup below that button with full labels.

MINOR — resolved: Existing paper-theme accent/secondary text and white-on-orange buttons lacked contrast. Paper small accent text is now #9B4A00, secondary #6E6A63 and on-orange ink #1A1000; dark secondary #9A9AA8 and error #FF5B5B follow the established palette. Native dialogs follow the selected Mail light/dark mode.

MAJOR — resolved: The backup passphrase dialog lacked the protection already applied to the seed dialog. Applied the existing FLAG_SECURE window pattern. The retained dialog stays protected through all four languages. Tests keep the seed dialog empty and never capture seed/password dialogs.

Verdict: Approve this checkpoint. Eighteen JVM tests pass (9 Mail, including three diagnostic cases, plus nine shared language tests). Six initial Android cases pass in 24.29s;two focused cases pass in 9.885s after popup/password corrections;one additional dark status/payment-confirmation case passes in 4.574s. The seven distinct cases cover retained recipient/subject/body/cursor/attachment targets, contact and backup fields/cancel, payment token/amount/address/note/cursor and dismissal cleanup, settings/help/identity/channel names, raw conversation content/status/date/popup labels, protected empty seed dialog, and dark payment confirmation. All three final debug variants build; all 19 imports and resource/diff checks pass.

Visual evidence: 32 public fixture captures generated; 14 selected captures inspected across all four languages, including corrected menu placement and light/dark payment dialogs. No seed or password captures. The final three nested crypto diagnostic labels were checked with the JVM and all three builds after emulator testing; no redundant device rerun. No real node, identity derivation, signing/encryption, transfer, backup, owner data or owner device was used. Only Bears_Languages_API36/emulator-5580; stopped after identity verification, launcher 27792 exit 0.

Evidence: build/localization/mail-validation.json. This is a display/lifecycle checkpoint; live delivery/backup and full font-scale/accessibility/older API acceptance are not claimed. The complete release remains active, uncommitted, unsigned for release and unpublished. Continue UTXO/NFT/Casino/malls/AtomiX/PandaPools/PandaDEX localization, remaining wallet acceptance and final signed versioned publication to GitHub fork, PandaApps and eurobuddha.com only.


## UTXO Send/Receive languages — 2026-10-17

Added 67 messages in English, Simplified Chinese, Russian and Ukrainian; shared catalog 2811. UTXO shell tabs, design labels, Send/Receive forms, validation, transaction preview and known local diagnostics now use retained native bindings. Language changes retitle existing tabs without notifying the pager or refreshing the coin/send state, so they cannot trigger change-address rotation or burn-field clearing. Full recipient/change/coin identifiers and raw token names stay literal. The existing verify-change warning still uses its raw semantic tag for its red color. Label/value columns wrap independently.

Reuse: read standalone apks/utxo README and compare SendView, ReceiveView, MainPager, BaseView, Design, TxnBuilder and TxnUtil with integrated copies. Read integrated MainActivity, NodeApi, CoinLoader, WalletView, BalancesView and HistoryView; reused shared Language/LanguageDialog and Vestr/Filez retained bindings plus wallet diagnostic generator. No standalone UTXO files changed. Twenty-two existing integrated Java files remain byte-for-byte unchanged, including TxnBuilder, TxnUtil, NodeApi, CoinLoader, HistoryDb, coin/token models and distribution engine. The importer reproduces all 19 pinned modules.

### Code Review

Summary: This display adaptation preserves amount/address/burn validation, transaction construction, persistence and command callbacks. Shared LanguageDialog gained a constructor forwarding an explicit theme to its existing Material builder; existing callers retain their original constructor. UTXO tracks dialogs until dismissal and destroys owned windows with its Activity. Language selection does not rebuild fields or issue commands.

MINOR — resolved: Light dialog actions used low-contrast orange. The explicit selected theme and darker #B93D0B action text now keep light actions readable. Dark error text uses the established #FF5B5B. Static Send labels follow the selected palette; Max/Next/style controls have 48dp minimum targets. Review found one CoinLoader invalid-reply message outside the initial mapping; it is now translated at display only.

MAJOR — inherited follow-up: SendView.fetchChange writes an asynchronous getaddress response without checking whether the user edited the field while it was pending. The current display adaptation preserves that existing code. Inspect existing request-generation/edit guards and add a focused late-response regression before final UTXO acceptance.

Validation: 12 JVM tests pass (3 UTXO diagnostic cases and 9 shared language checks). Five initial emulator cases pass in 20.755s. After the dialog correction, three confirmation cases pass in 13.234s, including the third appearance mode; six distinct Android cases total. Across four languages the tests retain fields/cursor/selected coin/current tab, confirmation amount/change/burn/identifiers/raw token name, inline validation/progress and cached receive QR. Confirmation sends only a fake checkaddress request and stops at Cancel; language changes issue no requests. All three final debug variants build. Catalog, importer and diff checks pass.

Visual review: 28 public captures generated (20 final unique files); eight viewings across seven named captures, covering English/Chinese/Russian/Ukrainian, Send, Receive and all three confirmation palettes. Complete identifiers and translated action labels are readable in inspected captures. An English startup toast visible briefly after switching languages was created before the switch; new diagnostics use the selected language. Only Bears_Languages_API36/emulator-5580 was used; stopped after identity verification, launcher 6640 exit0. No real node, seed, signing, transfer, owner data or owner device.

Evidence: build/localization/utxo-send-validation.json. Continue UTXO wallet list, balance details, tools/distribution and history translations plus the late change-address callback follow-up. NFT/Casino/malls/AtomiX/PandaPools/PandaDEX inner localization, remaining wallet/full acceptance, signed versioned artifacts and publication remain. Candidate1.9.42vc113 is uncommitted and unpublished; the full goal remains active.


## UTXO wallet, balances and tool dialogs — 2026-10-17

Added 81 messages in English, Simplified Chinese, Russian and Ukrainian (catalog 2892). Wallet selection/plurals, address cards, copy labels, retained Tools popup, balance details, Split/Consolidate/Distribute/Untrack dialogs and their local validations now use shared language bindings. Token-name provenance distinguishes missing metadata from literal names such as “Token” and “Send”; raw model fields, amounts, metadata and stored transaction records remain unchanged. A ticker with a missing name now gets a translated fallback in its secondary label too. The selection summary occupies its own row; weighted action widths and explicit Material button padding keep the four language labels on one line at the tested size.

Reuse: core TokenNamesTest/TokenMeta provenance, Filez retained menu labels and existing shared Language/LanguageDialog; UtxoLanguagesTest disposable guards. The late SendView change-address callback uses the previously inspected core request-generation pattern. Manual edits/restored drafts and newer NEXT requests invalidate old callbacks; language changes keep an unedited current request valid. Stale failures cannot clear a newer request's loading state.

### Code Review

Summary: Reviewed the canonical adapters and generated wallet/balance/tool paths. This scope changes visible labels, layout and name provenance, plus the isolated late-response guard. Sixteen original UTXO Java files remain byte-for-byte unchanged, including transaction construction, distribution scheduling, history persistence, node transport, coin loading and token balances. All 19 pinned imports reproduce.

MAJOR — resolved: An old getaddress response could overwrite a manually edited/restored change address. Three delayed-callback emulator cases now cover manual edits, restored drafts, request ordering, stale errors and language changes.

MINOR — resolved: Missing-name fallback beside a ticker remained English; it now binds the fallback while preserving authored names. Light balance accents use readable accentText. Visual review found Russian Tools wrapping inside a word because Material theme padding exceeded the requested XML padding; the explicit native padding and weighted widths fix the inspected four-language layout.

Validation: 15 JVM tests pass (6 UTXO and 9 shared). Thirteen distinct Android cases are verified: initial run passed ten, with three new cases failing only on an immediate Cancel/dismiss assertion. Those assertions now wait for Android to process dismissal; all three rerun cases pass. The final button-layout case also passes in all four languages. Existing Send/Receive/confirmation tests and three delayed-callback cases pass. Tests retain coin selection, collapsed cards, popup item IDs/actions, dialog identity, input values/cursors, literal metadata and full identifiers; financial dialogs stop at Cancel and locale changes issue no fake-node commands. All three debug variants build, with final UTXO layout changes rebuilt in Pandamonium. Catalog/importer/diff checks pass. Public emulator screenshots inspected across all four languages, dark wallet/tool screens and light balance/token-detail screens; no owner devices, data, node, seed, keys or funds used.

Verdict: Approve this wallet/balance/tool scope. UTXO history and distribution progress/errors remain unfinished, as do the other remaining integrated apps and full release acceptance. Signed/versioned release builds and publication are still pending. Evidence: build/localization/utxo-wallet-validation.json. Candidate 1.9.42 vc113 remains uncommitted and unpublished; the goal is active.


## UTXO history and distribution languages — 2026-10-17

Completed the remaining UTXO history/distribution display adaptation in English, Simplified Chinese, Russian and Ukrainian. Added 47 messages (shared catalog 2939), reusing History labels, plural descriptions, dates and copy rows. Local posting/posted/unknown/failed states remain distinct. Stored action/error strings translate only when displayed; token names, amounts, JSON, addresses, transaction/coin identifiers and database status IDs remain literal. Distribution progress and known nested diagnostics now translate too. The status view clears a distribution-owned running label once the job ends while retaining unrelated tool messages.

Reuse: scripts/adapt-pandamonium-history-languages.py, the existing wallet/Parlons fixed diagnostic generator, and UTXO standalone/integrated HistoryView, NodeTx, HistoryDb, DistributeManager and DistributeJob. All those donor files were compared/read. Before adaptation the differences were only UTXO resource prefixes and the integrated database name. Thirteen original UTXO Java files remain byte-identical, including HistoryDb, DistributeJob, TxnBuilder, TxnUtil and NodeApi. NodeTx and DistributeManager match the donor byte-for-byte after removing only their adapted display methods/imports; HistoryView fetch/paging code is unchanged. All 19 pinned imports reproduce.

### Code Review

Summary: Retained bindings change history text without rebuilding dialogs or requesting data. Existing scroll containers keep full copyable identifiers. Raw persistence, command strings, financial calculations, distribution retries and confirmation matching remain unchanged.

MAJOR — resolved during validation: Diagnostic captures are strings; the shared catalog reserves {count} for numeric formatting. The first new local-history fixture exposed a format exception for a split action. The five diagnostic templates now use literal quantity placeholders. An Android regression renders every new diagnostic pattern in all four languages, including nested failures and literal Unicode/metacharacters/transaction IDs.

MINOR — resolved: WalletView could retain “Distribute running” after the job ended. A small display-ownership flag now clears only stale distribution progress; the emulator verifies unrelated tool status survives refresh.

Validation: 19 JVM tests pass (10 UTXO and 9 shared). Four new distinct Android cases pass: two on the initial run, and the corrected local-history case plus comprehensive diagnostic-rendering case on the targeted rerun. Across all UTXO checkpoints, 17 distinct Android cases are verified. History fixtures exercise the actual database and dialogs, preserve raw stored fields across all language switches, and copy full coin/TxPoW IDs. Distribution uses an in-memory public job fixture; no job is persisted and no transaction is posted. All three debug variants build after the correction. Catalog/importer/diff checks pass. Twelve public captures saved; five visually reviewed across all four languages, light confirmed-history and dark local-history/progress views. Existing startup toasts created before language selection retain their old text until dismissed. Only the dedicated emulator was used and it was stopped; launcher23068 exit0.

Verdict: Approve this UTXO history/distribution scope. Evidence: build/localization/utxo-history-validation.json. Next: NFT wallet, Casino, malls, AtomiX, PandaPools and PandaDEX inner localization; remaining wallet/lifecycle/release acceptance, signed/versioned release artifacts and authorized publication. Candidate 1.9.42 vc113 remains uncommitted and unpublished; the full goal stays active.


## NFT wallet shell, settings and receive languages — 2026-10-17

Localized the NFT wallet's seven tab titles, shell descriptions, Settings sheet, shared sheet controls, Receive labels/address-safety reports and selected shell notices in English, Simplified Chinese, Russian and Ukrainian. Added 34 messages (shared catalog 2973). Custom sheets accept the existing immutable Language.Message values. Locale changes retitle tabs in place and retain dialogs, radio controls, send fields, mint forms/metadata, cursors, selected coins and QR drawables. No refresh, address request or mint operation is triggered by a language switch.

Reuse: read the standalone NFTwallet README and imported MainActivity/MainPager/BaseView/Sheet/SettingsDialog/ReceiveView/Design/Format/CoinDetailDialog/NodeApi/LocalStore plus relevant MintView form code, DistributeJob and Format tests. Reused the UTXO language adapter, MainActivity retained tabs/dialog ownership, disposable emulator fixture guards and shared Language bindings. Kept NFT's custom Sheet layout and existing callbacks. The adapter follows the existing NFT safety adaptations in the pinned import pipeline. Forty-one of 49 original NFT production Java files remain byte-identical, including mint/transaction engines, state-NFT actions, storage, node transport and Format. Other completed feature sources and prior financial/audit hashes match their checkpoints.

### Code Review

Summary: Reviewed the eight adapted production files, canonical adapter, catalog/XML bindings and emulator fixture. Changes affect labels, accessibility descriptions, light accent text and owned-dialog cleanup. Protocol commands, amounts, metadata, persisted IDs and financial algorithms are preserved.

MINOR — resolved during device validation: Dialog ownership was initially registered only after window attachment. The three sheet/settings tests observed no tracked dialog immediately after show. Reusing the full UTXO pattern now registers ownership synchronously and keeps attach/detach cleanup; activity destruction dismisses owned sheets. All six Android cases pass after this correction, including callback execution exactly once and dialog dismissal on activity destruction.

Validation: 76 existing JVM cases pass (67 NFT and 9 shared). Six new Android cases pass across all four languages: retained Send draft/selection/tabs, Mint form and literal metadata/cursor, Receive QR/safety report/full address and clipboard, dark Settings, light Settings, and custom sheet/progress identity/callback/lifecycle. Fixture guards require the dedicated emulator, no node instance, no seed, no mint rows and no persisted distribution job. All three debug variants build; Pandamonium was rebuilt after the final NFT-only lifecycle correction. All 19 pinned imports reproduce. Catalog and whitespace checks pass. Twelve public captures saved; five reviewed across all four languages and dark/light settings/receive views. No clipping in the inspected body/action labels; tabs scroll through the existing chevrons. Some captures contain the existing initial unavailable-node toast, whose diagnostic translation remains part of the unfinished NFT scope. The dedicated emulator was stopped, launcher71029 exit0.

Verdict: Approve this shell/settings/receive scope. Evidence: build/localization/nft-shell-validation.json. NFT gallery/mint/send/coin/history/balance/tools/diagnostic inner text remains, followed by Casino, malls, AtomiX, PandaPools and PandaDEX. Remaining wallet/lifecycle/release acceptance, signing and publication are still pending. Future Cash's classic and block-key audit remains implemented and its financial hashes are unchanged. Candidate 1.9.42 vc113 remains uncommitted and unpublished; the full goal stays active.


## NFT balances and token/coin details — 2026-10-17

Localized NFT balance cards/search/hidden-token controls, token sheets, contract labels and expansion controls, coin explorer rows, full coin/state-port sheets and metadata-link confirmation. Added 45 messages (shared catalog 3018). Reused UTXO name provenance so missing token names translate while literal names such as Token and Send remain unchanged. Token metadata, amounts, identifiers, scripts, state values and raw coin JSON stay literal. Clipboard actions copy full values, including state data longer than the display preview. Settings hidden-token names use the same display helper.

Reuse: inspected the existing NFT BalancesView, CoinDetailDialog, Util, Coin, TokenMeta, TokenBalance and HiddenTokens, their guards/tests and NftViewer callers. Reused scripts/adapt-pandamonium-utxo-wallet-languages.py, its complete name-provenance helper/UtxoText and UtxoTokenNamesTest. Adapted the existing NFT Sheet factories and shared Language bindings. NftViewer was read but remains for the gallery/viewer scope. Copied the three parser/provenance cases into canonical scripts/pandamonium-tests/NFTwallet, preserving raw metadata assertions.

### Code Review

Summary: Reviewed the canonical adapter, generated balance/coin/detail/name paths, resource bindings and test fixtures. Thirty-seven of 49 original NFT production Java files remain byte-identical, including all transaction/mint/state engines, node transport, storage and Format. Coin and TokenMeta match the donor after removing only their new display-provenance fields/assignments. Util validators, extraction and amount helpers match the donor exactly. All other completed feature financial/audit checkpoints and the node jar remain unchanged.

MINOR — resolved: The donor CLEAN_LIGHT theme used white text on orange primary buttons, with contrast 2.75:1. Reused UTXO's black on-accent text, raising contrast to 7.63:1. The final device check measures the actual clickable Send button and confirms that Close/Receive/Send are fully visible and single-line in all four languages. An intermediate test selected the literal token title Send; requiring a clickable action corrected the test ambiguity. No unresolved finding in this reviewed scope.

Validation: 79 JVM tests pass (70 NFT, including three reused name-provenance cases, and nine shared language cases). All 11 NFT Android cases pass: six shell cases plus five new balance/search, delayed contract/coin reply, raw coin/state clipboard, hidden-token/settings and metadata-link confirmation cases. The targeted action-layout case passed before the color adjustment and again after the final contrast fix/test-selector correction. Language changes preserve view/dialog identity, search cursors, expanded contract source, literal token names/metadata, exact amounts and full IDs without fake-node requests. An explicit Unhide action retains its normal read refresh; no signing, transfer, bury, mint or external-browser action runs. All three debug variants build; Pandamonium was rebuilt after the final NFT-only color change. All 19 pinned imports reproduce; catalogue/whitespace checks pass. Twenty public captures saved, ten inspected across four languages and dark/light views. Final token-sheet captures are unobstructed by earlier clipboard overlays. Dedicated emulator stopped; launcher41676 exit0.

Verdict: Approve this balance/detail scope. Evidence: build/localization/nft-details-validation.json. Next: NFT gallery/viewer, mint, send, coins/tools/history and diagnostics; then remaining Casino, malls, AtomiX, PandaPools and PandaDEX localization and full release acceptance. Candidate 1.9.42 vc113 remains uncommitted and unpublished; signing, versioned release builds and authorized publication are pending. The full goal stays active.


## NFT gallery and fullscreen viewer — 2026-10-17

Localized gallery tabs/search/empty states, collection counts and actions, item details, favourites and the fullscreen viewer. Added 30 messages (shared catalog 3048). Display-only names distinguish literal Collection/Send from missing metadata. Raw model names, collection IDs, state and transaction arguments remain unchanged. Single-image viewers now retain live port/token captions and use the activity's existing dialog lifecycle tracking.

Reuse: read GalleryView, NftViewer, StateNft metadata parsing, ZoomImageView, ImageLoader, Identicon, NftText and their callers. Reused scripts/adapt-pandamonium-wallet-nft-languages.py, NFT detail bindings and UTXO's token-name provenance. Inspected wallet/NftView's collection grouping and viewer bindings. Copied UTXO Identicon's existing hex-input guard; kept the NFT renderer and glyphs. The canonical adapter changes six NFT display files and reproduces from pinned inputs.

### Code Review

Summary: Language changes update retained labels and do not rerun image loading, rebuild lists, reset zoom, alter favourites, switch items or invoke node requests. Raw names remain separate from translated labels used in sheets. Thirty-four of 49 original NFT production Java files remain byte-identical, including transaction/mint/state engines, node transport, storage and Format. Completed feature financial hashes, wallet public-key audit and node jar remain unchanged.

MAJOR — resolved: NftViewer.openSingle uses an empty token ID; its generated placeholder seed was #-1, causing Identicon's hexadecimal parser to throw before an uncached image could open. Reused the existing UTXO sanitizer. A regression test compares NFT and UTXO bitmap output for null, empty, malformed and valid seeds, and opens a standalone viewer without cached art.

MINOR — resolved: GalleryView checked the open collection only inside the StateNFT branch, so unrelated regular NFTs remained in its grid and viewer. Moved the existing exact-token check before both branches. The mixed regular/collection fixture now asserts that only the three selected collection items reach the viewer.

MINOR — resolved: The fullscreen dialog did not account for Android navigation-bar insets, covering the edition/status line. Reused app/utils/SystemBars.pad inset maths on the top/bottom overlays, preserving the image view size and zoom. Initial local and physical-screen bounds checks did not detect system-bar occlusion; the final assertion subtracts the system-bar inset, and final screenshots show the caption and actions.

MINOR — resolved during review: Retained the existing NFT caption fallback for an empty standalone title. Added a regression assertion. Translation controls use the existing 48dp minimum target convention and weighted viewer actions to accommodate longer labels.

Validation: 79 JVM tests pass (70 NFT, nine shared language); seven new Android cases pass. The eleven prior shell/detail cases are unchanged and previously passed, for 18 distinct NFT Android cases overall. The new cases check collection membership, literal/missing names, search cursor, delayed token replies, persisted favourite keys, full clipboard values, viewer item/zoom matrix/drawable/chrome retention, unstamped transfer disabling, translated action visibility and dialog cleanup. All four languages were exercised. All three debug variants build; Pandamonium was rebuilt after the final NFT-only caption and system-bar padding corrections. All 19 pinned imports reproduce. Twenty-four public captures saved and fourteen inspected; the four final viewer captures are unobstructed and include the edition/status caption. Dedicated emulator stopped; launchers94500 and70886 exit0.

Verdict: Approve this gallery/viewer scope. Evidence: build/localization/nft-gallery-validation.json. Next: NFT mint/send/coins/tools/history/diagnostics, then the remaining Casino, malls, AtomiX, PandaPools and PandaDEX localization and release acceptance. Candidate 1.9.42 vc113 remains uncommitted and unpublished. Signing and authorized publication to GitHub, PandaApps and eurobuddha.com remain pending. The full goal stays active.


## NFT Send languages and delayed-review guards — 2026-10-17

Localized quick send, coin control, token picker, validation notes, review sheets and progress/outcome displays in all four authorized languages. Added 20 messages (3068 total), reusing existing UTXO messages for shared concepts. Full recipient/change addresses and input coin IDs now appear in review and can be copied. Missing token names use display-only language bindings; literal names and exact monetary values remain literal. Sheet actions use the established 48dp minimum target.

Reuse: inspected NFT SendView, its XML, NodeApi, TxnBuilder, Sheet, token models and callers; UTXO SendView/idRow, adapt-pandamonium-utxo-languages.py, UtxoChangeAddressTest and UtxoMessagesTest; minimaWallet's captured-token review; core display-generation and Future Cash matching-success patterns. Reused UTXO change-address generation checks, full-ID rows, wrapping, message generator and tests. Adapted the existing NFT seven-field snapshot to reject stale checks/confirmations, plus selected coin ID/token/amount/sendability snapshots. No new dependencies.

### Code Review

Summary: Review now binds to the draft and token that were checked. Locale changes preserve fields, cursor, token, selection and dialog identity without rechecking the address. Raw commands, stored names/errors and the transaction builder remain unchanged. Thirty-three of the original 49 NFT production Java files remain byte-identical; node transport, transaction/mint engines, storage and Format remain unchanged. Other completed apps' engine hashes, the public minimaWallet audit and node jar still match their checkpoints.

MAJOR — resolved: quick send read mutable quickTokenid at submission, which could differ from the reviewed token. Capture it before validation and pass it through review to the command. Draft/selection snapshots reject changed confirmations; request generations ignore superseded replies. Tests cover token changes during checks and after review, changed selected coins, all editable quick fields, superseded callbacks and the exact public-fixture command.

MAJOR — resolved: delayed getaddress responses could overwrite manual/restored change addresses. Reused UTXO generation checks, preserving an unedited request across language changes. All three adapted regressions pass.

MAJOR — resolved: a delayed success cleared a newly edited draft. Reused matching-draft clearing; the quick-send completion fixture retains its new token, amount and cursor. Expert completion uses the same guard without changing history recording or transaction construction.

MINOR — resolved: NFT review only displayed shortened identifiers despite asking the user to verify them. Reused UTXO full-ID rows and red unrecognised-change labels. Full clipboard values, exact amount/change/burn and visible action bounds pass in both themes and all four languages.

MINOR — resolved during visual review: the main activity displayed known node transport errors in English. Its diagnostic boundary now uses the existing explicit NftMessages mapper; unknown diagnostics remain literal. Screenshots wait for transient startup/clipboard overlays to clear.

Validation: 82 JVM tests pass (73 NFT, nine shared language). All 17 Android cases pass: 11 new send/change cases plus the six existing NFT shell cases. Together with the unchanged five detail and seven gallery cases, 29 distinct NFT Android cases are verified. Initial17 had5 test failures (three one-pixel bounds differences, two dialog-attachment assumptions); the first correction removed bounds failures, then explicit attachment boundaries fixed the two remaining fixture failures. No app guards were weakened. All three debug variants build, with Pandamonium rebuilt after the final NFT-only changes. All19 pinned imports reproduce; catalog/transport/diff checks pass. Twelve final public-fixture captures saved, five inspected across four languages/dark/light. Dedicated emulator stopped after identity verification; launcher70199 exit0. No owner device/data, real node, seed, signing, minting or transfer was used.

Verdict: Approve this Send scope. Evidence: build/localization/nft-send-validation.json. Next: NFT state actions/mint/coins/tools/history/remaining diagnostics, then the remaining integrated app translations and release acceptance. Candidate1.9.42vc113 remains uncommitted and unpublished. Signed versioned releases to GitHub, PandaApps and eurobuddha.com remain pending; full goal stays active.


## NFT state-action languages and collection-action layout — 2026-10-17

Localized StateNFT transfer/burial forms, safety refusals, progress and batch summaries in English, Simplified Chinese, Russian and Ukrainian. Added 50 messages (3118 total). Typed collection confirmation remains a literal name; raw IDs, addresses, token amounts, state and command builders are unchanged. Display-only fallback names remain live when switching language in a single-item action. Address drafts, cursor position and dialog identity survive switching. Scan actions have a translated accessibility label and a 48dp target.

Reuse: read integrated and standalone NFT StateNftActions, StateNft, CmdChain, Sheet, wallet guards/departure tests and callers in NftViewer, CoinDetailDialog, GalleryView, BalancesView and MintView. Reused Sheet's live CharSequence binding, the existing Language generator, NftText provenance and NftMessages diagnostics. NftViewer and CoinDetailDialog now pass live display names; the raw typed-confirmation name is preserved. Source command skeletons and StateNft transfer/bury builder calls match the standalone donor exactly.

### Code Review

Summary: Presentation slice validated; the surrounding financial completion lifecycle still requires changes before release. Thirty-two of the original49 NFT production Java files remain byte-identical, including StateNft, CmdChain, TxnBuilder, MintEngine, MintDriver, NodeApi, LocalStore and Format. Protected completed-app engine hashes, Future Cash public audit and node jar remain unchanged.

MAJOR — required before release: StateNftActions.gatherAndBury skips malformed/unsafe entries and treats a missing array as empty, then invokes onDone. buryNext also invokes onDone after any tally of posts, including failures, before confirmation. MintView's callback marks the row BURIED and stops the engine. A missing list, skipped coins or partial batch can therefore falsely finalize the mint. Fix evidence and the mint/burial pause lifecycle together; do not merely guard the final callback while allowing the mint engine to race the burial. The current language tests intentionally exercise only valid empty lists and summary branches; they do not claim this bug is fixed.

MINOR — resolved: after the earlier 48dp Sheet action-target change, Android's default baseline alignment clipped a multiline collection-action button by8px. Compared standalone/integrated Sheet and GalleryView's caller; disabled baseline alignment in the existing horizontal row. Kept the gallery test's full visible-height and physical-bound assertions unchanged and added public captures. The next19 passed; visual review then exposed awkward Russian word breaks in the three-action row. Reused the existing vertical panel arrangement for three or more actions, retaining side-by-side pairs. The final19 pass with readable full-width labels.

Validation:82 JVM tests pass (73NFT,9shared). All19 Android cases pass (7new state-action,5existing details,7existing gallery);36 distinct NFT Android cases are now verified across completed slices. No correct destructive confirmation was submitted and fake nodes reject write commands. All3 debug variants build; Pandamonium rebuilt after the Sheet-only corrections. All19 pinned imports reproduce, catalog/transport/diff checks pass.16 final public captures saved;6 inspected across all4 languages/light/dark. Dedicated emulator5580 stopped after identity check; launcher54968 exit0. No owner device/data, real node, seed, signing, minting or transfer used.

Follow-up reuse lead: an additional BFS with [statenft,mint,bury,collection,coin,state] found mds/statenft-suite/README.md L1 and its Android MainActivity BURY screen. Read the burial methods in mds/statenft-suite/android/app/src/main/java/com/eurobuddha/statenft/MainActivity.java (renderBury, buryOwnedCoins, buryOne, markBuriedWhenEmpty, runBury), the BURY skip in its MintEngine and minidapp/engine.js enginePhaseBury. markBuriedWhenEmpty polls a complete owned-coin list before marking BURIED; it is the closest candidate. Its bounded-list dependencies/callers/tests and mint concurrency still need full inspection before reuse. Do not copy its state-stripping fallback into the integrated wallet without verifying locked-edition constraints. Current integrated MintEngine, MintDriver and LocalStore were also read completely during follow-up investigation; no engine changes were made.

Verdict: Request changes before release for burial completion/evidence. Presentation and button-layout slice passes its checks. Evidence:build/localization/nft-actions-validation.json. Next: fix the burial evidence and mint lifecycle, then NFT mint/coins/tools/history/diagnostics and the remaining integrated apps. Candidate1.9.42vc113 remains uncommitted/unpublished. Goal stays active; signed releases to GitHub, PandaApps and eurobuddha.com remain pending.


## NFT collection burial evidence and mint lifecycle — 2026-10-17

Collection burial now persists all intended inputs before signing, validates each txnpost receipt, then polls each exact graveyard output for matching token, amount, preserved state, storestate and unspent status. Only after all outputs match and a complete owned-coin list is empty does it commit BURIED and remove the journal. Missing/malformed lists, partial failures, unknown acknowledgements and stale watchers cannot finalize a collection. Reopening can verify saved receipts without signing those inputs again. The journal contains public IDs, amounts and state hashes only.

Reuse: read StateNFT Suite MainActivity burial methods and bounded-list dependencies, LocalStore, Android/MiniDapp BURY dispatch, integrated NFT StateNft/CmdChain/MintEngine/MintDriver/LocalStore/NodeApi and callers/tests, and UTXO TxnUtil/NodeTx. Reused the bounded polling cadence, existing StateNft.buryCommands with preserve=true, CmdChain balance gate, preference storage, response wrapper handling and Language binding. The donor's empty-list coercion and absence-only completion cannot establish burial, so a small strict BurialEvidence helper plus public journal is necessary. Core txnpost, coins, Coin/Transaction serialization and output-ID derivation were inspected. Actual bundled-jar javap confirms txnpost response=TxPoW.toJSON, transaction state at body.txn.state, output IDs derived from first input/index, tokenamount as string, storestate/spent as Boolean. State, destination and amount must be checked separately from coin ID.

The shared MintDriver now refuses burial while a live tick owns the operation, releases only closed hosts and ignores stale completion callbacks using a generation. Paused BURY rows are skipped by engine/progress/service work. Late LocalStore upserts cannot undo BURY/BURIED. MintView's callback refreshes instead of marking whichever mutable progressRowId happens to be selected. Paused/completed screens suppress resume, re-post and image prompts and show live four-language explanations. Transfer collection list parsing also rejects incomplete replies. Nine messages added,3127 total.

### Code Review

Summary: the collection completion and mint-pause bugs identified in the prior checkpoint are addressed with explicit evidence and persistence boundaries. StateNft command builders remain unchanged.26 of the original49 NFT production files remain byte-identical. Protected completed-app engines, Future Cash dual-key/minimaWallet public audit and node jar remain unchanged.

MAJOR — remaining before release: single-item StateNftActions.watchDeparture still uses input absence as confirmation. It needs destination/output/state evidence and review of interaction with unfinished mint collections. This checkpoint does not claim those paths are corrected. Unknown collection post acknowledgements deliberately remain pending; the UI must not claim success without recovery evidence.

Validation:104 JVM cases pass (95NFT,9shared), including22 new receipt/persistence/partial-failure/lifecycle cases. Early completion tests failed because the fixture's owned() getter shadowed its zero-argument varargs reply; renamed getter ownedCommand(), added a queued-reply assertion and removed temporary diagnostics. No production success criteria were weakened.38 Android cases pass, including2 new paused/completed display cases across4 languages. All3 debug variants and AndroidTest build. All19 pinned imports reproduce; catalog/transport/diff checks pass.8 public captures saved;5 inspected. No correct destructive confirmation was submitted on-device; JVM flows use fake nodes and public transaction fixtures. No owner device/data, real node/seed/signing/minting/transfer used. Dedicated emulator5580 stopped after identity check; launcher76564 exit0.

Verdict: collection fix passes its scoped checks; request changes before financial release for the remaining single-item evidence/lifecycle path. Evidence:build/localization/nft-burial-validation.json. Candidate1.9.42vc113 remains uncommitted/unpublished; goal stays active. Signed releases to GitHub, PandaApps and eurobuddha.com remain pending.


## NFT individual output confirmation and unfinished mint guard — 2026-10-17

Individual StateNFT transfer and burial no longer report success from input absence. They validate the txnpost input/output receipt and poll the exact output for the expected destination, token, amount, storestate, unspent status and preserved state hash. A missing acknowledgement, wrong recipient, empty/malformed reply, changed state, spent output or destroyed host cannot display success. Polling remains bounded to20 checks at20-second intervals. Mx addresses use exact matching against the receipt miniaddress; the validated receipt's canonical hex address is used for subsequent chain verification.

Before either individual action starts, LocalStore checks the matching collection's phase. Only a completed mint (DONE/BURIED) or an externally received collection without a local mint record may depart. An unfinished, paused or unknown phase, or corrupt collection storage, refuses the action without node commands or storage changes. The same guard protects collection transfer. This prevents the mint's firstFree index calculation from reusing an index after a still-minting item leaves. Full collection burial retains its separate explicit pause flow.

Reuse: graph vocabulary [statenft,transfer,coin,mint,state] found StateNft at apks/NFTwallet/app/src/main/java/com/eurobuddha/nftwallet/StateNft.java L11, StateNFT Suite MainActivity TRANSFER L46, and core Coin L19. Direct source evidence: inspected integrated StateNftActions and complete relevant StateNft command builders, BurialEvidence receipt/state checks, LocalStore journal reader, MintEngine.phaseStamp, existing DepartureEvidenceTest/WalletGuardsTest, NFT sender/receive address callers and UTXO TxnUtil/DistributeManager matching. Reused the builders unchanged and extended BurialEvidence's proven receipt/confirmation checks with a destination argument; no new dependency or address codec. Standalone sources remain unchanged.

### Code Review

Summary: the single-item absence-only confirmation and unfinished-mint departure issues from the prior checkpoint are fixed. Unknown outcomes stay unconfirmed. The new guard rechecks at submission rather than trusting a previously opened dialog. Three messages are live-bound in all4 languages;3130 total.26 original NFT production files and all protected completed-app engine/Future Cash/node-jar hashes remain unchanged.

Validation:112 JVM tests pass (103NFT,9shared). The old absence-only regression was replaced by4 intended-output cases, and5 flow/store tests were added (net+8). They cover both command paths, balance-before-sign order, correct Mx/hex destination, altered state, lost acknowledgements, malformed replies, polling timeout, destroyed hosts and immutable store refusals. All3 debug variants plus AndroidTest build.12 affected Android tests pass (7existing state actions,2burial lifecycle displays,3new refusals/unknown-result displays);41 distinct NFT device cases have passed across completed slices. The device tests issue no transaction commands; JVM chains use fake nodes.12 public captures saved;6 inspected across4 languages. All19 pinned imports reproduce; catalog/transport/diff checks pass. Dedicated emulator5580 stopped after identity check; launcher22988 exit0. No owner device/data, real node/seed/signing/minting/transfer used.

Limit: an intended output already spent onward before its first poll cannot be proven with the current unspent lookup and remains unconfirmed. Missing single-item post receipts are not recovered or persisted by this watcher. These cases cannot be promoted to success from missing inputs.

Next localization reuse lead: read MintView lines1–430 and1480–1674, plus MintService and Notifier completely and the existing NFT Send adapter. Mint forms are cached and refresh deliberately preserves focused drafts. Continue by reading the remaining MintView body and complete presentation adapter before adapting its CharSequence helpers; keep user metadata and protocol phase values literal in storage. No mint-presentation changes were made in this checkpoint.

Verdict: scoped fix passes review and regressions. Remaining release work includes NFT mint/coins/tools/history/diagnostics and other integrated-app translations, wallet/release acceptance, signing, versioned artifacts and authorized publication. Candidate1.9.42vc113 remains uncommitted/unpublished. Evidence:build/localization/nft-departure-validation.json. Goal turn: progress; goal stays active.


## NFT mint forms, progress and notifications — 2026-10-17

Mint token, NFT and collection forms now use the remembered language selection, including review cards, validation, image status, phase labels, local engine diagnostics and mint notifications. Cached form objects, focus/cursors, image-mode selections and user metadata remain intact. Collection names, custom metadata labels/values, URLs, IDs and captured numeric values stay literal. Stored protocol phase values remain canonical. Long phase labels scroll horizontally and mode controls have a48dp minimum touch height. A stuck collection no longer also displays the fully-minted success note.

Reuse: inspected integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/MintView.java, MintDriver.java, MintService.java, Notifier.java, NftMessages.java and NftText.java; the relevant StateNft/MintEngine message and transaction-boundary callers; scripts/adapt-pandamonium-nft-send-languages.py and the complete build_source in scripts/adapt-pandamonium-wallet-error-languages.py. Reused that Parlons-derived fixed/pattern diagnostic generator, the existing Language weak bindings and the Future Cash GuardianService.onConfigurationChanged foreground-only notification refresh. Tests reuse NftShellLanguagesTest's guarded fake node, NftMessagesTest's message inspection and FutureNotificationLanguagesTest's attached service fixture without service startup. No new dependencies. Standalone sources remain unchanged.

The catalog contains3329 messages (+199). Mint lookup maps180 fixed inputs and43 bounded patterns, reusing existing exact resources. Unknown diagnostics fall through to NftMessages; diagnostic recursion remains bounded. The installer was corrected to skip plural-dictionary English entries when indexing existing strings; its first failed attempt wrote no production/catalog files.

### Code Review

Summary: this presentation slice passes validation. It preserves mint command construction and financial engines, apart from the explicit stuck-success display correction.25 of49 original NFT production files are still byte-identical. The wider mint release needs the callback corrections below before approval.

#### MAJOR — Progress image callback can select a different collection
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/MintView.java, pickProgressImages/saveProgressImage.
Problem: asynchronous image selection/compression eventually looks up mutable progressRowId. Navigation can change that ID before the result arrives. The save also needs a fresh guard against completed, burial-paused or already-stamped items.
Fix: capture the selected row ID, pass it into the save path, validate the fresh row/item and prevent stale results from changing another collection. Reuse existing NFT send captured-state guards and LocalStore burial-preservation checks. Not fixed in this presentation checkpoint.

#### MAJOR — Collection creator callback consumes mutable draft state
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/MintView.java, onReviewCollection/startCollection.
Problem: reviewed scalar fields are captured, but colEmbedMode and colImages are read only after getaddress returns. A changed form may therefore mint unreviewed images/mode; the callback also clears the current draft.
Fix: capture the reviewed mode/images and form identity, gate the delayed callback on that immutable review, and clear only its matching draft. Reuse the existing SendView snapshot/generation boundary. Not fixed in this presentation checkpoint.

Validation:117 JVM tests pass (108NFT,9shared), including5 new message-boundary tests for nested failures, literal name/ID capture, exact numeric spelling, strict patterns and bounded recursion. All3debug variants and AndroidTest build; tests were rebuilt after adding coverage.15 Android tests pass (6mint,1notification,2existing burial,6existing shell);48 distinct NFT Android cases have passed across completed slices. Forms/reviews retain views, cursors and literal CREATE/DONE/MOVE/STAMP user content across all4languages with no fixture commands after setup. Progress fixtures preserve raw storage and never confirm a mint. The attached service fixture checks foreground-only refresh, exact collection name, progress and unchanged channel settings without onCreate or node startup.36 public captures saved;6 reviewed across4languages. Some captures include an earlier node-unavailable toast; mint content and actions remain readable. Remaining activity diagnostics still need their own review.

All19 pinned source imports reproduce. Catalog/transport/diff checks pass. Completed app engines, nine Future Cash financial/audit files, minimaWallet public-audit sources and node jar remain unchanged. The requested Future Cash mixed classic64x3/block128x4 audit remains implemented; current stored Future Cash reports total70passing tests, inspected rather than rerun. Dedicated emulator5580 stopped after identity verification; launcher16357 and runner12846 exited0. No owner device/data, real node, seed, signing, minting or transfer used.

Verdict: presentation checks pass; request changes before release for the two callback findings. Next: fix those callback boundaries, then NFT coins/tools/history/distribution and remaining diagnostics, remaining integrated-app translations and release acceptance/signing/publication. Candidate1.9.42vc113 remains uncommitted and unpublished. Evidence: build/localization/nft-mint-validation.json. Goal turn: progress; goal stays active.

## NFT delayed mint callbacks and create retry guards — 2026-10-17

Collection confirmation now captures the reviewed form, field values, image mode, icon state and a copy of the artwork map. It rechecks the snapshot before requesting creator identity and when the reply arrives. Edited drafts, navigation, replaced forms, destroyed hosts, older requests, duplicate replies and failed identity responses cannot create a row or clear a new draft. Successful creation uses the captured images/mode. Form-owned image and icon work cannot refill a replacement form after a successful mint.

Progress image selection captures the original LocalStore row ID. Saving goes through MintDriver's existing operation lock and a fresh strict storage read. A live engine operation, missing/duplicate/corrupt row, wrong mode, invalid item index, completed/burial-paused/stuck phase, a newer image or an already-stamped item refuses the save. The selected row alone is updated; NEEDIMAGES changes to STAMP only when every item has an image or is already stamped. Failed or partial saves are reported and never announced as full success. A successful save says only that images were saved. The UI hides pick actions on completed/stuck/stamped items.

The same navigation bug was present in the re-post confirmation. It now retains the original row and uses the same operation lock. Resetting a retry requires that exact row to still be a posted, parked CREATE attempt with no known token ID. An advanced/paused/completed record, an overlapping operation or a duplicate confirmation cannot reset it. The existing explicit duplicate-mint warning remains.

Reuse: read scripts/adapt-pandamonium-nft-send-languages.py, including captured fields, selection and request generations; integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/MintView.java, MintDriver.java, LocalStore.java and NodeApi.java; scripts/pandamonium-sources/NFTwallet/burial-store.inc; relevant MintEngine tick/persistence callers and existing BurialLifecycleTest. Sibling searches included /Users/eurobuddha/Projects/minima/apks/utxo/app/src/main/java/com/eurobuddha/utxo/SendView.java and /Users/eurobuddha/Projects/minima/apks/NFTwallet/app/src/main/java/com/eurobuddha/nftwallet/MintView.java; the standalone NFT callbacks were unguarded. Reused the integrated SendView snapshot/generation approach, MintDriver live-operation lock, LocalStore strict collection reader and existing JVM preference/fake-node fixtures. No new dependency or transaction builder was introduced.

### Code Review

Summary: both major callback findings from the previous mint checkpoint are addressed. Review of adjacent confirmation code also found and fixed the re-post collection-ID issue. Every callback now validates its intended draft/record before its relevant mutation. Existing signed-mint and transaction construction remain unchanged. Image mutations wait for the engine to be idle by refusing with an explicit retry notice; they are not automatically queued. Existing image size limits remain.

Validation:130 JVM tests pass (121NFT,9shared), with13 new tests covering actual private creator-callback execution and actual LocalStore updates against public preference fixtures. They check snapshot image contents, changed fields/modes/form identity, failed identities, dead hosts, superseded and duplicate callbacks, record selection, complete/paused/stamped/newer-image refusals, invalid storage, busy engine guards, persistence failure reporting and guarded explicit retry. All3debug variants plus AndroidTest build.19 Android cases pass:4 new callback tests plus15 mint/notification/burial/shell cases. The image callback test runs real compression on an8x8public PNG, switches the selected collection before completion, verifies only the original row changes, and deletes the fixture afterward. The re-post UI test changes the displayed collection beneath the original confirmation and verifies only the original posted flag resets. Creator-delay tests preserve edited fields, cursor, mode and artwork across all4languages. Fake nodes intercept every command; only getaddress or a refused public block lookup is allowed, never signing/posting.52 distinct NFT Android cases have passed across completed slices.

Catalog3333(+4). All19pinned imports reproduce; catalog/transport/diff checks pass.25of49 original NFT production files, completed-app engine hashes, nine Future Cash financial/audit files, minimaWallet public-audit hashes and node jar remain unchanged.36public mint captures retained from the final run; selected changed progress and review captures inspected. Dedicated emulator5580 stopped after identity verification; launcher53951exit0 and runner99656exit0. No owner data/device, real node/seed/signing/minting/transfer used.

Verdict: scoped callback fixes pass. Broader release remains incomplete: NFT coins/tools/history/distribution and other integrated-app localization, wallet/release acceptance, signing, versioned artifacts, commits and publication remain. Next reuse lead: NFT WalletView/WalletTools have corresponding translated integrated/utxo implementations; only their file inventory and label sites were inspected here, not their complete implementations. Read them fully before adapting. Candidate1.9.42vc113 remains uncommitted/unpublished. Evidence: build/localization/nft-mint-guards-validation.json. Goal turn: progress; goal remains active.

## NFT coin-list languages and retained menus — 2026-10-17

The NFT Coins tab now follows the remembered English, Simplified Chinese, Russian and Ukrainian selector for its selection count, tools menu, address copy action, coin counts, contract/empty/watch/pending labels and missing token-name fallback. Literal token metadata, amounts and full clipboard addresses remain unchanged. The two-row selection bar and equal-weight amount/name columns reuse UTXO's tested layout; copy and coin targets are at least48dp. Locale changes preserve selected IDs, collapsed address cards, their view instances and the same popup/menu actions. The popup is remeasured after relabeling and dismissed with the Activity. The selected tab is revealed after translated labels are laid out, without selecting the tab again or reloading its content.

Reuse: read NFTwallet WalletView, its layout, MainActivity selection/configuration/lifecycle callers, BaseView, NftText/Coin and relevant CoinDetailDialog/WalletTools boundaries; compared the full standalone NFT source after resource-prefix adaptation. Read the UTXO WalletView differences, complete wallet-language adapter and UtxoWalletLanguagesTest; reused its retained popup helper directly, existing catalog/plural entries and two-row XML adaptation. NftShellLanguagesTest supplies the guarded fake-node/public-fixture harness. Also read Future Cash MainActivity.buildTabs, adapt-pandamonium-future-notices.py and its selected-tab regression, plus the referenced PandaDEX requestRectangleOnScreen helper. Reused the Future Cash layout listener, adapting its selected-tab check to TabLayout and avoiding the existing arrow-control variable names. NFT confirmation/sendability gating, confirmed-first sorting and long-press coin details are preserved. No new dependencies or catalog entries.

### Code Review

Summary: This change is confined to NFT coin-list presentation and popup lifecycle. Every changed production file and adapter was reviewed against its pre-change snapshot. Transaction commands, node data parsing, selection mutations, sorting and NFT tool engines are unchanged. The clipboard path resolves the translated label to String before crossing the Android process boundary, following CoinDetailDialog.

Findings: MINOR — screenshots exposed selected-tab clipping after longer Russian/Ukrainian labels changed the strip width. Fixed using the existing Future Cash layout/reveal behavior and added an exact visible-width regression. No unresolved blocking findings in this display scope. WalletTools dialog/status strings and DistributeManager progress still require their planned translation pass; this checkpoint does not claim those surfaces are translated.

Validation:121NFT and9shared localization JVM reports pass (130total); all3debug variants and Pandamonium AndroidTest build pass.13Android cases pass:2new coin-list cases,6shell/lifecycle cases and5token/coin-detail cases. New cases switch through all4languages while preserving the actual popup, selection, collapsed-card identity, literal names and amounts; verify translated missing-name fallback, contract/pending/watch labels, rejection of pending/watch selection, exact address clipboard, Clear behavior, long-press coin details and popup destruction and full selected-tab visibility after every language change. Eight public coin-list/menu captures retained; four reviewed across all4languages. A transient stopped-node toast from initial Activity startup remains in some captures; no live node is present. Total54distinct NFT Android cases across completed slices.

All19pinned imports reproduce; catalog3333, transport and diff checks pass.24of49 original NFT production files, completed-app engine hashes, nine Future Cash financial/audit files, minimaWallet public-audit hashes and node jar remain unchanged. Future Cash's requested classic64x3/block128x4 audit remains implemented in the candidate; its stored70passing tests were inspected, not rerun. Dedicated emulator5580 stopped after identity verification, launcher87234exit0 and runner40069exit0. No owner device/data, live node, seed, signing or transfer used.

Verdict: Approve this coin-list display scope. Evidence:build/localization/nft-wallet-validation.json. Next: NFT tools/status/history/distribution diagnostics, then Casino/malls/AtomiX/PandaPools/PandaDEX inner translations, remaining wallet/release acceptance, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42vc113 remains uncommitted and unpublished; the full goal remains active.

## NFT wallet tools and distribution languages — 2026-10-17

NFT Split, Consolidate, Distribute and Untrack sheets, input hints, validation/status messages and distribution progress now follow English, Simplified Chinese, Russian and Ukrainian. Existing UTXO catalog entries are reused; one missing nothing-to-consolidate message brings the catalog to3334. Tool inputs use the NFT theme's explicit text/hint colors. Numeric values, cursor positions, selected coin records and distribution job data stay unchanged during language selection. Finished jobs now release their running-status line while unrelated tool messages remain visible.

Reuse: read the full NFT WalletTools, DistributeManager, DistributeJob and HistoryView; relevant WalletView, Sheet, NodeApi and TxnBuilder boundaries; UTXO wallet/history language adapters and tool/distribution tests. Reused the UTXO message bindings, status ownership flag and existing utxo-history-messages.json fixed/pattern specification through the existing NftMessages generator. Kept NFT's Sheet dialogs, transaction/persistence strings and execution paths. NftShellLanguagesTest supplies the disposable fake-node fixture; reused UTXO's retained-input and in-memory distribution checks. No new dependencies. History translation remains separate because NFT's filters, exports and ownership badges differ from UTXO.

### Code Review

Summary: The display changes preserve command construction, batching, persistence and metadata values. The inspected surrounding transaction code has inherited correctness gaps that must be fixed before release. Passing language tests do not establish that those financial paths are ready to ship.

#### MAJOR — Tool confirmations can combine different selection snapshots
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/WalletTools.java, doSplit/mergeSelected/doDistribute and runBuilder.
Problem: each sheet captures sel, but later execution reads act.selectedTokenid(); a changed selection can pair old inputs with a new token ID. Delayed address callbacks lack the reviewed-draft/selection guard already used by SendView, and late success unconditionally clears the current selection.
Fix: reuse the tested SendView/MintView captured-input and generation checks; validate captured/live coin fields and token before starting and before delayed submission. Clear only the matching submitted selection. Add delayed-dialog/address/success regressions.

#### MAJOR — Rejected or uncertain transaction replies can be reported incorrectly
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnBuilder.java, run/addInput/addOutput/sign/fail; NodeApi.java cmdInner response/timeout.
Correction (2026-10-17 transaction checkpoint): NodeApi.checked already rejects status:false and malformed envelopes before the caller receives them, after the own:true compatibility retry. The claim about rejected replies was incorrect. The remaining issue is incomplete status:true receipts being treated as posted, and uncertain timeout/transport outcomes being treated as failed; see the corrected review below.
Fix: reuse proven command-result checks and UTXO unknown-outcome handling, preserving receipt validation and safe recovery. Audit all three TxnBuilder callers (Send, tools, distribution) before enabling a release. Do not infer non-posting from a lost reply.

#### MAJOR — Distribution expires before checking an already-confirmed change coin
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/DistributeManager.java, onCoinsUpdated.
Problem: a job resumed more than20blocks later aborts before findChangeCoin, even when its intended change coin is available. The UTXO sibling already checks for the coin before expiry. Exact change-output matching, fallback identity and job persistence also need verification with the transaction-result fix.
Fix: reuse the proven UTXO ordering with regressions for resumed confirmed change and genuinely missing change; retain NFT confirmation gating.

Validation:124NFT and9shared localization JVM reports pass (133total). All3debug variants and Pandamonium AndroidTest build pass.13Android cases pass:5new tool/progress/diagnostic cases,2coin-screen cases and6shell cases. New cases cover Split/Distribute inputs and cursors in dark/light across4languages; retained Merge/Untrack/automatic-consolidation confirmations canceled without commands; untouched in-memory distribution JSON and no persisted job; terminal progress cleanup versus unrelated status; strict known diagnostic patterns and literal captures.32public tool/progress captures retained, six reviewed across4languages and both themes. Some captures include a transient stopped-node toast from Activity startup; no live node is present. Total59distinct NFT Android cases across completed slices. These tests submit no transactions and do not exercise real financial completion.

All19pinned imports reproduce; catalog/transport/diff checks pass.22of49 original NFT production files, completed-app engine hashes, nine Future Cash financial/audit files, minimaWallet public-audit hashes and node jar remain unchanged. Dedicated emulator5580 stopped after identity verification; launcher60372exit0 and runner40254exit0. No owner device/data, live node, seed, signing or transfer used.

Verdict: Request changes before release for the financial findings above; the tool-language display scope is validated. Evidence:build/localization/nft-tools-validation.json. Next: fix rejected/unknown transaction results, stale tool confirmations and distribution recovery; finish NFT history/residual diagnostics, then Casino/malls/AtomiX/PandaPools/PandaDEX, remaining wallet/release acceptance, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42vc113 remains uncommitted and unpublished; the full goal remains active.

## NFT transaction burn and delayed distribution resume — 2026-10-17

The NFT wallet now charges the requested Minima burn once. Its expert send already subtracts the burn from change; TxnBuilder no longer adds a second burn transaction using another wallet coin. A saved distribution now looks for its confirmed, spendable change coin before applying the 20-block expiry, so reopening later can continue the remaining batch.

Reuse: inspected integrated/NFTwallet TxnBuilder, NodeApi, DistributeManager, DistributeJob, Coin, HistoryDb and SendView's burn/review/submission paths; the complete UTXO TxnBuilder and corresponding distribution heartbeat; standalone apks/utxo TxnBuilder and README; core/Minima txnsign, txnpost and Transaction.getBurn. Reused the UTXO sign command/comment and confirmed-change-before-expiry block directly. The existing NFT confirmed/sendable/token/coin-ID checks remain. The adapter reads these small sections from the pinned UTXO import and preserves them in regeneration; no dependencies were added. Reused NodeApiResponseTest's real-wrapper/mocked-transport fixture and BurialLifecycleTest's in-memory preferences for the new regressions.

### Code Review

Summary: These two fixes are validated. The rest of the financial review remains open. This checkpoint corrects the previous claim that status:false reaches TxnBuilder's success callback: NodeApi.checked already rejects failed and malformed envelopes, after the own:true compatibility retry. The earlier review inspected cmdInner without following that outer wrapper. Tests now exercise real NodeApi dispatch through create/input/output/sign rejection, and confirm it never reports posted or advances past a rejected build stage.

#### MAJOR — Resolved: duplicate burn charge
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnBuilder.java:109.
The previous extra txnpostburn parameter asked the node to build a separate burn transaction after the caller had already reserved the burn in its selected inputs. Reused the sibling's command without the extra parameter. Both change and maximum-send regressions failed before this fix and now pass; zero-burn and token output cases pass too.

#### MAJOR — Resolved: confirmed distribution change ignored after expiry
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/DistributeManager.java:98.
A saved job at block100 now resumes from its exact confirmed change coin at block200. Regressions cover missing change at blocks0/120/121, unconfirmed or unspendable coins, wrong token, wrong coin ID, and overlapping heartbeats. The resumed batch spends only the prior change coin and leaves already-funded recipients alone.

#### MAJOR — Still open: uncertain posting and incomplete receipts
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnBuilder.java:118.
A status:true reply without a usable receipt still reaches onPosted with a local-ID fallback; transport loss or timeout still reaches onFailed and cleanup. Distribution may advance recipients or retry based on that classification. Add strict receipt matching and an explicit durable unknown outcome across SendView, WalletTools and DistributeManager. A lost reply cannot prove that the node did not post. The UTXO default onUnknown-to-onFailed fallback and address/amount-only recovery must not be copied without checking their evidence requirements.

#### MAJOR — Still open: stale selection and distribution evidence
WalletTools still mixes a captured coin list with current token selection and lacks delayed-address/submitted-selection guards. DistributeManager.changeCoinId still falls back to the last output, findChangeCoin can fall back to address/amount, and the initial in-flight job is not persisted before submission. These need fixes before release. The timeout-ordering fix does not resolve these separate issues.

Validation: the new nine-case regression suite reproduced three failures before the production changes (two burn cases and delayed resume); all nine now pass. The complete NFT suite passes133tests, shared localization9, and the UTXO donor suite10, with zero failures/errors/skips. All three debug variants and Pandamonium AndroidTest compile successfully (26seconds). All19pinned imports and provenance reproduce. Catalog3334 in four languages, direct-transport guard and git diff checks pass. No UI text changed, so no new emulator run or screenshot capture was needed; the prior59distinct NFT Android cases remain historical evidence, not rerun here.

Twenty-one of49 original NFT production files remain byte-identical. Completed-app protected hashes, nine Future Cash financial/audit files, minimaWallet public-audit files and the node jar match the prior checkpoint. Future Cash's requested classic and blocksaskeyuses audit remains implemented in this Pandamonium candidate; its stored70passing tests were checked, not rerun. No owner data/device, real node, seed, transaction signature or transfer was used.

Verdict: Approve these two fixes; request changes before the full release for the remaining financial findings. Evidence:build/localization/nft-transaction-validation.json. Next: uncertain-outcome/receipt recovery and stale tool selection, NFT history/residual diagnostics, remaining Casino/malls/AtomiX/PandaPools/PandaDEX translations, wallet/release acceptance, then signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42vc113 remains uncommitted and unpublished; the full goal stays active.

## NFT transaction outcomes and receipt checks — 2026-10-17

Custom NFT wallet transfers now preserve an explicit unknown outcome when signing/posting times out, loses its reply, returns an oversized reply, or returns an incomplete receipt. Send and Tools record that state and keep the draft/selection. A distribution saves an uncertain marker before its builder starts, preserves its remaining recipients, and stays paused across restarts. A failed marker write prevents the builder from running. Verified receipts must match every input and intended output, including token, human/raw amounts, IDs, multiplicity and addresses. The change output comes from the matched intended output; the unchecked last-output fallback is removed.

Reuse: inspected NFTwallet NodeApi, TxnBuilder, TransactionEvidence/BurialEvidence, DistributeManager, DistributeJob, HistoryDb, TxnUtil, NodeTx, SendView, WalletTools, MainActivity callers and HistoryView; UTXO TxnBuilder/HistoryDb/distribution behavior and Vestr builder; DirectNodeApi/LocalJson, BurialLocalStore journal, wallet signing adapter, core Coin.toJSON/history/txpow commands and existing NFT tests. Reused BurialEvidence validation/address rules and the real-NodeApi transport fixture, in-memory preference fixture and existing Android language guards. A small multi-input/output matcher is necessary because BurialEvidence verifies one-input/one-output stateful NFT transfers. No new dependency. Existing UTXO partial-match/elapsed-time failure recovery was not suitable evidence of a transaction outcome. The Send warning reuses FutureCashMainActivity's selected-view requestRectangleOnScreen behavior so a longer translation stays visible without clearing the draft.

### Code Review

Summary: The custom-builder receipt/outcome boundary and automatic distribution pause are improved and tested. These changes do not finish transaction recovery. Unknown outcomes remain release blockers until the exact pending intent is durable, visible and protected against duplicate manual submission.

#### MAJOR — Open: durable pending intent and recovery
Files: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnUtil.java, HistoryDb.java, HistoryView.java, SendView.java and WalletTools.java.
The full frozen intent currently lives only in the builder. History stores incomplete coin evidence and does not check insert success; the History UI shows node history rather than unresolved local records. Send/Tools can still be retried manually. Persist the exact public intent before signing, confirm that write succeeded, lock unresolved inputs/intents, and expose evidence-based recovery. Core history returns relevant TxPoWs and is not proof of chain inclusion; verify txpow onchain separately. Absence or elapsed time cannot establish failure.

#### MAJOR — Open: distribution recovery and legacy fallback
Files: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/DistributeJob.java and DistributeManager.java.
The new marker prevents an uncertain batch from automatically advancing or retrying after restart. It does not yet save the full pending batch intent/receipt needed to resolve that pause. Corrupt saved JSON is still treated as no job, and legacy jobs can still find change by address/amount when no exact coin ID exists. Add durable exact batch evidence and fail-closed loading/recovery before release.

#### MAJOR — Open: native sends and stale Tools actions
Files: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/NodeApi.java, SendView.java and WalletTools.java.
NodeApi's compatibility default routes onUnknown to onError for callers that have not adopted the new callback. Native quicksend/automatic consolidation still need explicit unknown handling and durable receipt/intent evidence. Tools still needs guards around captured selections, token changes, delayed address callbacks and late selection clearing. The new builder snapshot validates the selection at start but does not finish those UI guards.

Validation: 156 NFT JVM tests and nine shared localization tests pass, with zero failures/errors/skips; 23 NFT cases were added. Three debug variants and Pandamonium AndroidTest build successfully. Before the final visibility change, 21 Android cases passed (two outcome, eight Send, five Tools, six Shell). After that change and clearing the observed emulator System UI ANR dialog, the 16 affected outcome/Send/Shell cases pass in 183 seconds. There are 61 distinct NFT Android cases cumulatively; this does not mean all 61 were rerun here. The screenshot review still found queued stopped-node toasts covering the warning, so only the test fixture wait was increased from five to 30 seconds; the AndroidTest APK rebuilt (36 seconds), and the two outcome cases passed again with unchanged assertions. Eight final public-fixture screenshots were captured and reviewed in English, Simplified Chinese, Russian and Ukrainian. The long Send warning is fully visible in each language. Installed app/test APK hashes match final built artifacts. All 19 pinned imports reproduce, 3,338 catalog messages validate in four languages, transport checks and git diff checks pass.

The first streaming install began before the earlier build had finished and timed out while reading a changing APK. After the final visibility build completed, a complete-file installation also timed out and a subsequent APK hash read timed out. The dedicated emulator was restarted; installed files were compared with the finished build before the final run. The first run after restart exited before test initialization; Android recorded BIND APPLICATION ANR, with no app Java exception in the scoped log. That failure record was preserved before retrying the unchanged APKs. The retry ran all 16 cases but had five failures: one screenshot-helper assertion and four null clipboard reads. Window inspection then showed a System UI ANR dialog holding focus; its UI hierarchy was saved. The existing PandamoniumIntegrationTest wake/unlock setup was reused, and the observed Close app button dismissed that platform dialog. The same 16 tests were rerun without changing production code or weakening assertions. APK identity and final test completion were verified afterward. No release artifact was published from either failed install attempt.

Nineteen of 49 original NFT production files remain byte-identical. Completed-app protected engine hashes, nine Future Cash financial/audit files, minimaWallet public-audit sources and the node jar match the previous checkpoint. Future Cash Next's classic and blocksaskeyuses audit remains implemented in this candidate; its stored 70 passing tests were checked, not rerun. Only the disposable Bears_Languages_API36 emulator-5580 was used and it was stopped afterward. No owner device/data, live node, seed, signature or transfer was used.

Verdict: Request changes before release for the remaining financial findings. Evidence: build/localization/nft-outcome-validation.json. Next: durable pending intent/recovery and retry guards, native send outcome handling and stale Tools selection; NFT history/residual diagnostics; remaining Casino/malls/AtomiX/PandaPools/PandaDEX translations; wallet/release acceptance; then signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication. Candidate 1.9.42 vc113 remains uncommitted and unpublished; the full goal stays active.


## NFT durable transaction journal — 2026-10-17

Custom NFT transfers now save their validated public inputs, outputs, token and burn before issuing any command. HistoryDb v5 reserves inputs in a SQLite transaction, acknowledges POSTING before signing, and saves a strict public receipt before reporting POSTED. Uncertain outcomes and failed writes retain their reservations across restart. The journal stores no signatures or witness data. Display rows no longer overwrite a colliding ID; failed display-row insertion prevents a new custom build. Quick Send and automatic consolidation refuse to use a token with an existing custom reservation, including Minima reservations when a token send burns Minima.

Reuse: inspected the current NFT HistoryDb, TxnUtil, TransactionEvidence, TxnBuilder and its SendView/WalletTools/DistributeManager callers, BurialLocalStore public evidence journal, PandaDEX Pending and PendingIntegrityTest, PandaDEX MakerConfig and MinimaAPIResponse full-input JSON validation, and UTXO history recovery. Reused the existing SQLite helper and upgrade path, TransactionEvidence validation, PandaDEX acknowledged pre-post boundary, and existing Robolectric Android33 configuration. The UTXO partial-overlap/time-based recovery does not establish an exact transaction outcome and was not copied. No dependency added.

### Code Review

Summary: custom transaction reservations and persistence failures now have checked behavior and real SQLite regression coverage. This is an intermediate checkpoint, not release approval.

#### MAJOR — Open: confirmation and recovery do not release reservations
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/HistoryDb.java:246.
POSTED and UNKNOWN are deliberately retained. A verified complete history match and independent on-chain confirmation must drive a recovery/archive transition before this can ship. Elapsed time or absence from a query cannot establish failure.

#### MAJOR — Open: native admission is a read guard only
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnUtil.java:16.
Quick Send and automatic consolidation check existing custom reservations but do not reserve their own inputs atomically. Native-first and concurrent paths remain unresolved. Their own durable intent and uncertain-outcome handling, other stateful NFT paths and legacy records still need integration.

Validation: 172 NFT and nine localization JVM tests pass with zero failures/errors/skips. Sixteen added cases include ten real SQLite/Robolectric checks for reopen, migration, damaged evidence, display-row collision, SQL-trigger rollback and simultaneous reservations; four builder persistence checks; and two native-entry guards. All three debug variants and Pandamonium AndroidTest build in 77 seconds. All19 pinned imports reproduce. Catalog3339 in four languages, direct-transport and diff checks pass. No emulator or UI test was run in this checkpoint; the prior61distinct NFT Android cases remain historical evidence. Eighteen of49 original NFT production files remain byte-identical. Protected completed-app files, Future Cash financial/audit files, minimaWallet public-audit files and the node jar match the previous checkpoint.

Verdict: Request changes before release for the open recovery and native admission work, distribution saved-state validation and stale Tools selections. Evidence: build/localization/nft-journal-validation.json. Future Cash classic plus blocksaskeyuses support remains implemented and unchanged. Candidate1.9.42vc113 remains uncommitted, unsigned for release and unpublished. Remaining translations, device/wallet acceptance and GitHub fork/PandaApps/eurobuddha.com publication remain part of the active goal.


## NFT exact transaction recovery — 2026-10-17

A new activity-owned TransactionRecovery polls only when a new block is observed and an attempt is POSTING, UNKNOWN or POSTED. It scans at most four history pages per poll and retains its offset across polls. Each candidate must match all saved inputs and intended outputs through TransactionEvidence. Only then does it query txpow onchain:<matched-id>. Completion requires found:true, a valid nonzero block ID, integer block/tip/depth values, depth=tip-block, and at least three confirmations (the inspected node GlobalParams default). A missing, malformed, shallow or failed reply never establishes failure or releases coins. The mined ID may differ from the accepted pre-mining ID.

HistoryDb commits the public matched receipt, inclusion evidence, CONFIRMED phase and visible local-history status in one SQLite transaction. Any failed write or missing display row rolls the transaction back, retaining the reservation. Confirmed evidence survives restart, unlocks the custom reservation and cannot be downgraded by late send callbacks. No signatures or witness are persisted. Activity destruction closes recovery before closing its node client. A single oversized history entry is skipped within the bounded scan budget while keeping every unresolved reservation, so older usable evidence can still be reached; a later complete scan retries the opaque entry.

Reuse: read the existing NFT HistoryDb, HistoryView, TransactionEvidence, TxnBuilder, MainActivity lifecycle, NodeApi and complete recovery test fixtures; UTXO HistoryDb resolver/reconciliation; PandaDEX Pending.reconcile; BurialEvidence; local Minima reference and core history/txpow commands plus GlobalParams.MINIMA_CONFIRM_DEPTH. Reused the complete input/output matcher, existing SQLite journal and transactions, bounded history query/shrink pattern, NodeApi callback dispatch, and Robolectric Android33 setup. UTXO partial input/output matches and elapsed-time failure inference are unsuitable for confirmation. PandaDEX recovery depends on order-specific schemas; only its acknowledged durable evidence boundary applies here. No dependency added.

### Code Review

Summary: confirmed custom transfers now have a checked recovery path. No absence or timeout releases funds. This resolves the previous lack of a confirmation transition, but is not approval of all transaction paths or the release.

#### MAJOR — Resolved: confirmed custom reservations never released
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/HistoryDb.java:277.
The exact receipt plus separate chain inclusion now settle the attempt and history row atomically. Regression cases cover close/reopen, changed mined ID, shallow/malformed/missing evidence, partial mismatches, both table write failures, missing display row, late status callbacks and corrupt stored inclusion.

#### MAJOR — Resolved: oversized entry starved older recovery candidates
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TransactionRecovery.java.
A targeted regression failed before the fix: after shrinking to one row, the scan stopped forever at the same oversized entry. It now advances past that opaque row within the four-page budget without changing any attempt outcome, reaches the older complete match, and only then confirms after separate chain evidence.

#### MAJOR — Open: native admission and unfinished transaction recovery paths
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/TxnUtil.java:16.
Quick Send/consolidation still only check existing custom reservations; their own durable intent and atomic admission are required. Interrupted PREPARED attempts, distribution recovery/validation, other stateful paths, legacy records and stale Tools selections also remain. HistoryView currently renders node rows and must expose pending/recovered local attempts and their recovery state.

Validation:184 NFT plus nine localization JVM cases pass with zero failures/errors/skips;12 new recovery cases. The specific oversized-entry regression failed before its fix, then passed in the full suite. Three debug variants plus Pandamonium AndroidTest build in55seconds. All19 pinned imports reproduce; catalog3339 in four languages, transport and diff checks pass. No emulator or device tests ran here: prior61distinct NFT Android cases are historical evidence only. Eighteen of49 original NFT production files remain byte-identical. Protected app files, nine Future Cash audit/financial files, wallet public-audit sources and the node jar match the prior checkpoint.

Verdict: Request changes before release for the remaining transaction paths and acceptance work. Evidence:build/localization/nft-recovery-validation.json. Future Cash classic plus blocksaskeyuses support remains unchanged. Candidate1.9.42vc113 remains uncommitted, unsigned for release and unpublished. Four-language integrated-app coverage, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication remain part of the active goal.


## NFT prepared native Quick Send — 2026-10-17

Quick Send now uses the node's existing sendnosign/sendview/sendsign/sendpost sequence. It validates the unsigned recipient, exact amount, equal splits, token and fee; checks each change address against the default simple wallet script; and freezes the node-selected public inputs, outputs and transaction IDs. Main token inputs and separate Minima burn inputs are reserved atomically in the existing SQLite journal before signing. The signed file must match that frozen transaction before posting. A complete matching public receipt must persist before the UI reports success. Uncertain replies preserve the draft, retain reservations and never automatically sign or post again when the language changes. A late success clears only the original unchanged draft.

Reuse: inspected complete NFT SendView, PreparedSend, PreparedSendEvidence, TransactionEvidence, HistoryDb, TxnUtil, WalletTools and their tests; related UTXO native consolidation/recovery and wallet factory candidates; node sendnosign, sendview, sendsign, sendpost, send, consolidate, checkaddress, scripts, transaction JSON and wallet default-address paths; DirectNodeApi, MinimaCMD and EmbeddedNodeTransport. Reused native coin selection, the exact public receipt matcher, atomic journal, existing callback dispatch and Robolectric fixtures. No dependency added. checkaddress relevant:true also includes watched scripts, so it is insufficient for owned-change validation; bounded scripts address queries require default:true, simple:true and a public key.

The inspected node send dryrun path can sign a separate token burn transaction. It therefore cannot be used to obtain an unsigned token-burn plan. sendnosign explicitly disables burn signing; this was checked against the actual bundled node JAR bytecode, saved in build/localization/nft-prepared-unsigned-bytecode.log. No live node or signing command was executed during validation. Automatic Minima consolidation has a reusable evidence validator but is not connected to this preparation flow yet.

### Code Review

Summary: native Quick Send now has checked public intent, atomic main/burn reservation and complete receipt handling. This checkpoint does not approve the remaining financial paths for release.

#### MAJOR — Resolved for Quick Send: native-first and concurrent input admission
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/PreparedSend.java.
Unsigned preparation precedes atomic prepareAttempt. Main and companion burn input IDs share the existing reservation boundary, including conflicts with custom Minima transactions. Display or reservation persistence failure prevents signing. Tests cover burn-only transactions with zero change outputs, overlap between the main and burn transactions, independently corrupted receipts and exact recovery of paired transactions.

#### MAJOR — Open: pre-post interruption and signed-file lifecycle
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/PreparedSend.java.
The current conservative phase changes to POSTING before sendsign. A signing timeout can retain a reservation even though sendpost was never called. Move the durable posting boundary to immediately before broadcast and finish restart handling for PREPARED attempts, while protecting late callbacks and key-use accounting. Prepared/signed local files are retained; define their safe recovery and cleanup lifecycle before release. Do not infer a broadcast failure from elapsed time or absence from history.

#### MAJOR — Open: remaining financial paths and history
Files: WalletTools.java, DistributeManager.java, DistributeJob.java and HistoryView.java under integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/.
Automatic consolidation still has only a read guard. Distribution must consume confirmed recovery and validate saved batch state; stale Tools selections, other stateful operations and legacy records need the same checked boundaries. History must expose local pending/recovered attempts. The Quick Send entry retains its broad token-level unresolved guard; revisit it once all native paths reserve their inputs atomically.

Validation: 202 NFT and nine shared localization JVM cases pass, with zero failures, errors or skips. Eighteen added cases comprise nine prepared-evidence cases, eight mocked-node flow cases and one real SQLite paired-transaction reservation/recovery case. All three debug variants and Pandamonium AndroidTest build in 3m39s. All 19 pinned imports reproduce; catalogue 3,339 in four languages, direct transport and diff checks pass. Four focused Android cases pass, including the new uncertain Quick Send draft/language case; 62 distinct NFT Android cases have passed cumulatively, not all rerun here. These cases use public fixtures, in-memory history acknowledgements and fake node callbacks. No new screenshots were required because displayed messages and layout were unchanged.

Device setup encountered platform failures before instrumentation: the app installation command timed out although the installed APK hash matched; both app/test installed hashes were subsequently verified. The System UI and then Pixel Launcher ANR dialogs were identified through window focus and fresh UI hierarchies; their observed Close app buttons were used. A redundant installed-hash read also timed out. The instrumentation-only continuation used the previously verified installed APKs and checked that their local artifacts were unchanged. No app production code or assertions were changed to bypass these platform failures. The dedicated Bears_Languages_API36 emulator-5580 was identity checked and stopped after testing. No owner device/data, live node, seed, signature, mint or transfer was used. Platform startup/resource stability remains an acceptance item.

Eighteen of 49 original NFT production files remain byte-identical. Protected completed-app engine files, nine Future Cash financial/audit files, minimaWallet public-audit sources and the bundled node JAR match the prior checkpoint. Future Cash classic64x3 and blocksaskeyuses128x4 support remains implemented; its saved 70 passing JVM results were inspected, not rerun here.

Verdict: Request changes before release for the remaining interruption/consolidation/distribution/Tools/history work and acceptance. Evidence: build/localization/nft-prepared-send-validation.json (194 source hashes). Candidate 1.9.42 vc113 remains uncommitted, unsigned for release and unpublished. Casino/malls/AtomiX/PandaPools/PandaDEX translations, wallet/device acceptance, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication remain part of the active goal.


## NFT interrupted transaction preparation — 2026-10-17

Quick Send now keeps its exact public intent PREPARED while sendsign creates the signed file and sendview verifies it. POSTING is acknowledged immediately before sendpost. A timeout, malformed signed-file path or mismatched signed transaction before that boundary stops the flow, saves NOT_SUBMITTED and cannot reach broadcast through a late callback. Posting timeouts still remain UNKNOWN and retain all inputs. Failed persistence never silently releases a reservation. Signing uses already consumed are never reset; the new interruption message states this in English, Simplified Chinese, Russian and Ukrainian.

HistoryDb v6 adds a validated process/helper owner to the existing journal. The v5 migration preserves intent, receipt and history rows. On opening a database, an earlier process's PREPARED attempts become NOT_SUBMITTED with their history error message in one SQLite transaction. The current process's other helpers are preserved. Activity destruction stops NodeApi callbacks first, then abandons only that helper's PREPARED attempts. A live client cannot request this release; a closed helper cannot accept new preparation or move it to POSTING. POSTING, UNKNOWN and POSTED evidence is never released by restart or activity cleanup. No elapsed-time or missing-chain-evidence inference was introduced.

Reuse: read the current NFT HistoryDb, transaction-journal.inc, PreparedSend, PreparedSendEvidence, TxnBuilder, NodeApi, MainActivity lifecycle and complete related regression fixtures. Searched the NFT/UTXO/wallet/PandaDEX modules and the standalone apks/NFTwallet and apks/pandadex sources. Reused PandaDEX Pending.intentResult/beforePost and DexTxn.checkAndPost's acknowledged posting boundary, the existing SQLite journal/atomic confirmation pattern and NodeApi closed-client callback guard. No existing candidate distinguished process-abandoned NFT preparation from another live helper, so the minimum added state is one validated owner column containing a process nonce and helper nonce. No dependency or financial key derivation changed.

Graph vocabulary: transaction, pending, prepared, recovery, session. The depth 2 BFS returned 1,842 nodes and was truncated at 1,200 tokens; it identified Pending and sendnosign paths, which were then checked against complete relevant local source. Saved graph lessons and the 194-source-hash checkpoint were verified first. The actual bundled sendsign bytecode was inspected and saved in build/localization/nft-interrupted-sendsign-bytecode.log: it signs the main/burn transactions and writes the resulting file without broadcasting. No live signing command was executed.

### Code Review

#### Summary
Interrupted preparation now has an explicit release path, while possible broadcasts retain their durable evidence. Review also found and fixed a closure race and an availability problem with damaged restart records. This approves this portion of the transaction flow, not the remaining wallet paths or the release.

#### MAJOR — Resolved: activity closure could admit an orphan reservation
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/HistoryDb.java.
A preparation could pass the initial closed flag, pause, then insert after the owner had closed and released its work. The new coordinated two-thread SQLite regression failed before the fix. The closed check is now repeated inside the admission transaction. The regression then passed with the full suite.

#### MAJOR — Resolved: corrupt restart evidence could prevent history opening
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/HistoryDb.java.
Recovery failure now rolls back and retains the original record while allowing the database to open for history display. Financial operations continue to validate the journal and fail closed. A real SQLite regression verifies unchanged malformed evidence, readable history and refusal of a replacement attempt.

#### MAJOR — Open: remaining native and stateful paths
Files: WalletTools.java, DistributeManager.java, DistributeJob.java and HistoryView.java under integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/.
Automatic consolidation still needs atomic intent admission; distribution needs confirmed-recovery integration and saved-state validation; stale Tools selections and other stateful/legacy paths remain. History must expose local pending/recovered rows, including display rows interrupted before unsigned inputs were known. Prepared/signed node files are retained; their cleanup/recovery lifecycle remains to finish. If activity-close persistence fails, reservations remain until a later process-open recovery can succeed.

Validation: 213 NFT plus nine shared localization JVM tests pass (222 total), zero failures/errors/skips. Eleven added cases cover pre-post timeout/late-callback behavior, real SQLite migration, prior-process nonce recovery, concurrent live helpers, closed-owner admission, atomic phase/display rollback, missing history, damaged owner/evidence and the demonstrated closure race. Prior-process recovery is simulated with persisted public owner nonces and database reopen; no owner app process or node was used. All three final debug variants and Pandamonium AndroidTest build. All 19 pinned imports reproduce. Catalogue: 3,340 messages in four languages, direct-transport and diff checks pass.

Three focused Android cases pass: reviewed Quick Send/late success, uncertain broadcast across language changes, and the new interrupted-signing case with a late valid reply. The last case preserves literal draft fields, issues only one mocked signing request and zero posting requests, and checks the complete visible translated message in all four languages. Four public-fixture screenshots were captured and reviewed. There are 63 distinct NFT Android cases cumulatively, not all rerun here. The fixture's history remains in memory, including activity cleanup. Installed app/test APK hashes match the final build. The dedicated Bears_Languages_API36/emulator-5580 reused the earlier proven 6,144 MB/host-graphics setup, was identity checked and stopped after testing. No owner device/data, live node, seed, real signing, mint or transfer was used.

Eighteen of 49 original NFT production files, protected completed-app engines, nine Future Cash financial/audit files, minimaWallet public-audit sources and the node JAR remain unchanged from their protected checkpoints. Future Cash classic and blocksaskeyuses support remains implemented; its existing 70 passing JVM results are historical evidence, not rerun here.

#### Verdict
Request changes before release for the remaining financial paths, translations and acceptance. Evidence: build/localization/nft-interrupted-preparation-validation.json, with 194 source hashes. Candidate 1.9.42 vc113 remains uncommitted, unsigned for release and unpublished. Casino/malls/AtomiX/PandaPools/PandaDEX translations, wallet/device acceptance, signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication remain part of the active goal.

## NFT native consolidation admission — 2026-10-17

Automatic Minima consolidation now obtains the node's native selection with `consolidate tokenid:0x00 burn:0 maxcoins:20 maxsigs:5 dryrun:true`, validates a frozen copy, verifies every output is a default wallet address, and reserves the selected inputs atomically through the existing TxnBuilder and HistoryDb journal before creating or signing the custom transaction. Non-Minima requests, nonempty transaction state, nonzero linkhash, missing state flags, changed economics and malformed evidence are rejected. Possible broadcasts retain their reservations and cannot be repeated by a late callback.

The builder now preserves optional `storestate` flags in frozen intents, commands, public receipts and restart validation. Existing callers retain their default behavior. Native consolidation's two split outputs, optional rounding remainder and optional change output are preserved, including the change output's false state flag. The reconstructed transaction gets its own transaction/output identifiers; the native preview ID is not reused. Quick Send also retains flags supplied by its unsigned plan.

Reuse: inspected the complete relevant PreparedSendEvidence, TransactionEvidence, TxnBuilder, PreparedSendFlowTest, TransactionJournalTest, Coin and TxnUtil implementations; WalletTools callers and the existing NftTools/NftSend fake-node Android fixtures; standalone apks/utxo WalletTools; and the node's consolidate/send/sendview/txnoutput implementations. Reused the existing unsigned-plan validation, default-address checks, custom builder, atomic input journal, public receipt validation and test fixtures. The standalone UTXO consolidation only records inputs after sending, so it cannot provide pre-sign admission. The small PreparedConsolidation adapter connects the existing pieces without adding a dependency. The actual bundled node bytecode confirms dryrun skips main signing and posting. Its separate token-burn path is excluded by requiring Minima and burn zero.

### Code Review

#### Summary
The previous native one-shot command bypassed atomic reservation. The replacement preserves native coin selection and all output amounts/flags while using the existing journaled builder. Review covers this consolidation path and its optional output-state persistence, not the entire release.

#### MAJOR — Resolved: automatic consolidation could bypass input admission
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/WalletTools.java. Native dry-run selection now enters TxnBuilder's atomic reservation before txncreate and its acknowledged POSTING boundary before signing/posting. Real SQLite coverage verifies conflicts, restart evidence, exact confirmation and subsequent release.

#### MAJOR — Open: remaining wallet paths and release acceptance
Files: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/DistributeManager.java, DistributeJob.java, WalletTools.java and HistoryView.java. Distribution confirmed recovery/saved-state validation, stale Tools selections, other stateful/legacy paths, local pending-history display and localization, and prepared/signed-file lifecycle remain. The inspected sendnosign source omits send's rounding-remainder output; Quick Send correctly rejects an unsigned plan whose recipient total differs, but nonexact split compatibility still needs resolution. Do not weaken that exact-total check.

#### Validation
223 NFT plus nine shared localization JVM tests pass, zero failures/errors/skips (232 total). Ten added cases exercise native selection including remainder/change, persistence boundaries, non-Minima refusal, query/post timeouts, late callbacks, frozen ownership checks, changed output flags and real SQLite restart/confirmation. All three debug variants and Pandamonium AndroidTest build. All 19 pinned imports reproduce. The unchanged catalogue contains 3,340 messages in English, Simplified Chinese, Russian and Ukrainian; direct-transport and diff checks pass.

The initial Android run found a test-fixture field-name error in both new cases; it was corrected from history to the existing historyDb field, with the initial failure log preserved. Three focused Android cases then pass using fake nodes and in-memory history: successful native consolidation, uncertain native consolidation, and the existing reviewed Quick Send case. The two new cases run the actual Tools confirmation path, preserve a newly selected coin through results and language switches, and ensure no repeated signing request. There are 65 distinct NFT Android cases cumulatively; the full historical suite was not rerun. No new layout or catalogue text was introduced, so this checkpoint adds no screenshots. Installed app/test APK hashes match the final build. Only the identity-checked disposable Bears_Languages_API36 emulator-5580 was used and it was stopped afterward. No owner device/data, live node, seed, real signing, minting or transfer was used.

Protected completed-app engines, nine Future Cash financial/audit files, minimaWallet public-audit sources and the node JAR match their checkpoints; 18 of 49 original NFT production files remain unchanged. Future Cash classic and blocksaskeyuses support remains implemented, with its 70 passing JVM results preserved as historical evidence.

#### Verdict
Request changes before release for the open wallet work, remaining integrated-app translations and acceptance. Evidence: build/localization/nft-consolidation-validation.json. Candidate 1.9.42 vc113 remains uncommitted, unsigned for release and unpublished. Signed versioned artifacts and GitHub fork/PandaApps/eurobuddha.com publication remain part of the active goal.

## NFT Tools selection review — 2026-10-17

Split, selected-coin Merge, Distribute and Untrack now retain a frozen copy of the reviewed coin fields and token. Their confirmation checks refuse a changed selection before starting work; Split/Merge/Distribute check again after asynchronous address lookup. An abandoned distribution lookup releases its start reservation. Each dialog review accepts at most one confirmation. Untrack retains its reviewed watch-only targets throughout the batch. Successful Split/Merge/Untrack replies clear only the matching submitted selection, preserving coins selected afterward.

The existing SendView selection comparison was extracted into TxnUtil and extended to include raw amounts, address forms, confirmation and spent state as well as coin/token IDs, displayed amounts and sendability. Send uses the same check. Tools derive the token from the frozen reviewed coins rather than reading a later live selection token. Unchanged coin refreshes remain valid; split rounding and totals remain exact. A concise Tools review warning is translated into all four languages.

Reuse: read NFT WalletTools, TxnUtil, Coin, SendView selection/confirmation/submission paths, Sheet action dispatch, MainActivity selection lifecycle, DistributeManager start/reserve/callback paths and the complete relevant transaction fixtures. Compared the standalone apks/utxo and apks/NFTwallet WalletTools implementations; they have the same missing selection checks. Reused the tested SendView snapshot comparison, the existing immutable transaction-intent boundary and builder result handling, NodeApi at-most-once callback fixture, and NftTools/NftSend disposable-device fixtures. The minimal additions are a private Tools review copy/acceptance check and a shared selection snapshot helper; no dependency, wallet derivation or journal schema changed.

Graph: refreshed 83 memories (81 useful, one dead end, one corrected). Expanded vocabulary: wallet selection review snapshot send distribute. BFS depth2 returned674nodes, truncated at1200tokens. Relevant current MainActivity/SendView/Tools source was then read directly. The preceding199source hashes and HEAD9def96e6801a9bef261611e45349f28a1eb6ae1c were verified before changes.

### Code Review

#### Summary
The reviewed input values now survive asynchronous UI work without being substituted by a later live selection. The shared Send guard also catches changed raw amounts and confirmation/spent flags. This approves the selection-confirmation changes; other wallet paths and release acceptance remain open.

#### MAJOR — Resolved: Tools mixed captured coins with a later selected token
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/WalletTools.java. A dialog captured the coin list but read selectedTokenid at submission, and delayed address callbacks could continue after the user changed selection. Frozen reviewed fields plus checks before confirmation and after lookup now prevent those paths. Distribute receives independent coin objects for its later asynchronous first-batch build.

#### MAJOR — Resolved: successful old Tools operations cleared a new selection
File: integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/WalletTools.java. Success now compares the submitted public coin fields with the current selection before clearing. Unknown outcomes retain their prior handling. Untrack freezes command-bound IDs and preserves a new selection through completion.

#### MAJOR — Open: remaining financial paths and release coverage
Distribution confirmed-recovery integration and saved-state/legacy validation, local pending-history display/localization, other stateful paths and prepared/signed-file lifecycle remain. Quick Send nonexact split compatibility still needs resolution; preserve its strict recipient-total check. Casino, malls, AtomiX, PandaPools and PandaDEX translations, wallet/device acceptance, signed release artifacts and publication remain.

#### Validation
233 NFT plus nine localization JVM cases pass (242 total), with zero failures/errors/skips. Ten added cases cover edited and originally unspendable selections, delayed callbacks, exact split remainder, frozen token/coins through refresh and distribution handoff, reservation cancellation, matching-only selection clearing, watch-only Untrack, closed/repeated confirmation and Send raw/confirmation/spent checks. All three debug variants and Pandamonium AndroidTest build. All19 pinned imports reproduce. Catalogue3341 messages in English, Simplified Chinese, Russian and Ukrainian; transport and diff checks pass.

The first Android run passed four cases and exposed a timing issue in the combined dialog fixture: it opened and confirmed before a rendered frame. The test now waits for the dialog, asserts the click was handled and checks dismissal before opening the next tool. The focused rerun passes; the initial log is retained. Five distinct Android cases therefore pass across the initial run and focused rerun (six executions), using fake nodes/in-memory history: three new actual Tools dialog/async/success cases, existing uncertain native consolidation, and existing stale Send confirmation. The new warning is fully visible in all four languages; four public screenshots were captured and reviewed. There are68distinct NFT Android cases cumulatively; the historical suite was not rerun in full. Installed APK hashes match the build. The identity-checked Bears_Languages_API36/emulator-5580 (6144MB, host graphics) was stopped afterward. No owner device/data, live node, seed, real signing, minting or transfer was used.

Protected completed-app engines, Future Cash financial/audit sources, minimaWallet public-audit sources and the node JAR remain unchanged;18of49 original NFT production files remain byte-identical. Future Cash classic and blocksaskeyuses audit support remains implemented and unchanged.

#### Verdict
Request changes before release for the remaining work above. Evidence: build/localization/nft-tool-review-validation.json. Candidate1.9.42vc113 remains uncommitted, unsigned for release and unpublished. GitHub fork, PandaApps and eurobuddha.com remain the authorized publication destinations.

## NFT History languages — 2026-10-17

Reused `scripts/adapt-pandamonium-utxo-history-languages.py`, `scripts/adapt-pandamonium-history-languages.py`, the existing History catalog, retained NFT `Sheet` bindings and MintView's horizontal control strip. Inspected the standalone NFT HistoryView/NodeTx and current integrated callers before adapting them. The graph expansion `history filter export transaction display` returned a broad, truncated set; the concrete implementation was established from those source files.

The new `scripts/adapt-pandamonium-nft-history-languages.py` binds NFT History's list, empty/loading/older labels, direction filters, export dialog/chooser/toasts, transaction detail and ownership labels, copy labels, displayed dates and split/consolidation counts in English, Simplified Chinese, Russian and Ukrainian. Long filter names use a scrollable strip with 48dp controls. Only seven new catalog entries were needed (3348 total); the rest reuse existing translations. Literal names, amounts, addresses and full transaction IDs remain literal. The CSV/JSON field names, raw directions, export timestamps, escaping and serialized content remain unchanged. Language changes retain the active filter and open dialogs without querying the node.

Validation: 233 NFT + 9 localization JVM tests pass; all three debug variants and Pandamonium AndroidTest build (3m5s). Three new Android cases cover retained details/full-ID copying, retained filters/export dialogs, and byte-identical CSV/JSON payloads across all four languages with literal comma/quote/Chinese/Ukrainian token names. Export choosers are intercepted before any external activity opens. Eight detail/filter captures were inspected. There are now 71 distinct NFT Android cases across saved checkpoints. All19 pinned imports reproduce; catalog, transport and diff checks pass. The installed main/test APK hashes match local outputs. Only the guarded Bears_Languages_API36 emulator-5580 was used and it was stopped afterward.

Review verdict: approve this display/localization checkpoint. History fetching, ownership classification/cache, persistence, export serialization and transaction economics were not changed. Full release still requires local pending/recovered history presentation, distribution recovery/saved-state validation, Quick Send nonexact split compatibility, signed-file lifecycle, wallet acceptance, remaining integrated-app translations and release signing/publication. History OWN_CACHE invalidation after wallet/session changes remains unvalidated. Earlier Tools selection checks are preserved; per-operation ownership of asynchronous status updates remains to review because an older callback can replace newer status text.

Protected completed-app engines, Future Cash financial/audit sources, minimaWallet public-audit sources and the node JAR remain unchanged;16of49 original NFT production files remain byte-identical. Future Cash classic and blocksaskeyuses support remains implemented with its prior70JVM results preserved. This checkpoint is uncommitted and unpublished. Evidence: `build/localization/nft-history-validation.json` (205 source hashes).

Initial Android run: two cases passed and the export case failed an overstrict no-requests assertion after all locale payload comparisons passed (46.007s). MainActivity.onResume intentionally reloads read-only state after returning from the intercepted chooser. The corrected test allows only the exact existing read commands and records them; the focused export rerun passed (13.921s), with the production APK unchanged. The test-only build passed in38s. Both initial and final logs are preserved; four executions cover three distinct passing cases. Separate retained-detail/filter language tests continue to require zero node requests. The seven pre-existing stopped-node toasts in the screenshot set are unobscuring fixture artifacts; visual evidence covers one API36 device, standard font size and dark theme.

## Casino shell, House and Play languages — 2026-10-17

Reused the shared Language and LanguageDialog implementation, the wallet diagnostic mapper generator (derived from Parlons SystemMessages), the NFT retained-tab lifecycle, and Casino's existing Ui helpers. Read the complete Casino MainActivity, Ui/MainPager/BaseView, House/Play/MyBets/History/ResultOverlay and animation views, plus their Game/Bet/Coin/Currency/NodeApi/SecretStore/Theme/TimeoutClaims dependencies and existing timeout/storage tests. The graph query expanded to casino/play/house/currency/view; its bounded result linked Currency and HouseView but was too broad to establish the full UI behavior, so concrete sources were read directly.

Added `scripts/adapt-pandamonium-casino-languages.py`, `localization/casino-messages.json` and generated CasinoMessages. The shell/header, tabs, sound/currency descriptions, House form/presets/summary, Play cards/picks/actions/status and empty activity-log dialog now retain translated descriptors in English, Simplified Chinese, Russian and Ukrainian. Amounts, currency/token identities, state ports, game enums and stored labels stay raw. Language switches relabel existing pages; they do not invoke buildTabs, refresh, node reads, secret generation or bet actions. The title tabs scroll to accommodate longer translated names. Existing dialogs are retained and dismissed with the owning activity.46catalog messages were added (3394total); existing History/Close/node-status labels were reused.

Validation:26Casino unit tests,9localization tests and5WalletMessagesTest source regressions pass. The wallet run was deliberately limited to that reused mapper suite; earlier full-wallet results remain historical. All three debug variants and Pandamonium AndroidTest build in2m31s; a test-only assertion correction for the existing uppercase House label compiled in43s before device execution. Three Android cases cover the House amount/cursor/game in both currencies, Play picks and disabled in-flight guards, canonical game/state data, and a retained empty log dialog/nested status. Every language-only pass asserts zero fake-node requests; there is no live node, betting, signing, seed or owner-device access. Eight House/Play captures were visually reviewed. APK hashes matched the installed disposable app/test packages. All19pinned imports reproduce; catalog/transport/diff checks pass. Only Bears_Languages_API36 emulator-5580 was used, then stopped.

Review verdict: approve this shell/House/Play display checkpoint.27of32original Casino Java files remain byte-identical, including contract, transactions, secret storage, currency calculations and auto-processing. Other completed-app engines, NFT sources, Future Cash dual-family/public-key audit, minimaWallet public-audit sources and the node JAR remain unchanged. This is not full Casino or release approval: My Bets body/statuses, history/results/animations, background notifications, detailed logs and lower-layer diagnostics remain to translate. Casino financial/callback/state review, wider font-scale/accessibility/API acceptance, NFT remaining recovery paths, other integrated apps, signing, commits and publication remain required. Candidate1.9.42vc113 remains uncommitted and unpublished. Evidence: `build/localization/casino-shell-validation.json` (215source hashes).

## Casino active bets, history and results — 2026-10-17

Extended the existing Casino language adapter, CasinoMessages mapper and shared Language bindings to MyBetsView, HistoryView, ResultOverlay and CoinFlipView. Read those files completely, compared their standalone Casino originals (only resource namespaces differed for MyBets/History), and inspected Game/Bet/Currency/ResolvedBet/SecretStore, the timeout tests, retained-screen tests, shared Language implementation/tests and NFT history adapter. Graph vocabulary expansion used casino/history/result/overlay; the 803-node query was truncated at 1100 tokens and was too broad to prove behavior, so implementation decisions came from the concrete sources. Also read CasinoService, TimeoutAlerts, AutoProcessWorker, AutoProcessor, OfferKeepAlive, CmdChain, CasinoHygiene, CasinoTxn and Util in preparation for the remaining diagnostics/notification work; those financial/background sources were not changed in this checkpoint.

Added 42 catalog entries (3436 total): role/phase/pick labels, timeout countdowns, actions and payout status, history captions/net/older-row counts, localized display dates, result text and coin glyphs. Existing game/state labels remain canonical in persistence and engine APIs. History still filters by currency, sums all stored rows, and renders at most 250. The strict age > timeout boundary is unchanged. Language switches retain the existing cards, animation objects, controls and result overlay. Coin glyph strings are resolved at initialization/configuration changes and cached for drawing; review removed resource lookups from every animation frame. No currency calculation, node command, transaction, secret storage, settlement timer or celebration logic changed.

Validation: 26 Casino and 9 shared-localization JVM tests pass. All three debug variants and Pandamonium AndroidTest build successfully (initial 2m19s; final review-fix build 1m16s). Test expectations were corrected before device execution to match the existing MINIMA caption and native amount-without-suffix convention. Seven distinct Android cases pass: four new cases plus three inherited shell regressions. The initial seven-case run passed six cases; the active-animation assertion failed because this emulator had animator_duration_scale=0. With explicit enabled/running prerequisites and scale1, the active-animation case passed. The result fixture then failed its new start assertion because ActivityScenario waited for idle until the 1100ms reveal had finished. Reusing ResultOverlay’s layout-listener timing lets the fixture switch language inside the running reveal; its focused rerun passes. The original scale0 was restored after each run. This reached ten executions across seven distinct cases; both initial failure logs are retained. The two timing corrections were test-only; production/APK hashes stayed unchanged during those corrections. Screenshot review then found the final Ukrainian outcome word clipped by the wrap-width result card. Reused Ui.card’s match-width/wrap-height sizing with 20dp side margins, and added per-language last-line height checks. The three debug builds and AndroidTest rebuilt in17s, all19imports reproduce again, and the focused result case passes on the final APK. Total:11executions across7distinct cases. Earlier passing non-result cases remain valid for the unchanged screens; the final production delta is only the result-card sizing. New checks cover retained active-bet animation and claim eligibility at ages 10/11, house cancel and settled-player status, raw history records, separate Minima/USD totals and the 250-row render cap, and a retained result overlay with unchanged animation and settled face. Language-only passes assert zero fake-node requests. Nine new active/history/result captures were visually reviewed after correcting the clipped result text; coverage is one API36 emulator at standard font scale and dark theme. App/test installed hashes match the completed builds. All 19 pinned imports reproduce; catalog, transport and diff checks pass. Only Bears_Languages_API36/emulator-5580 was used, then stopped. No owner devices, live node, seed, signing, actual bet or transfer was used.

Review verdict: approve this display checkpoint. 23 of Casino's 32 original Java files remain byte-identical, including its financial/background engines. Previously completed app sources and protected engines, Future Cash dual-key/public-audit changes, minimaWallet public audit and node JAR are unchanged. Casino notifications, full activity log and lower-level diagnostics still need localization. Broader device/font-scale/accessibility acceptance, remaining integrated apps, NFT recovery follow-ups, release signing, commit/push and publication remain open. Candidate 1.9.42/vc113 is uncommitted and unpublished. Evidence: `build/localization/casino-results-validation.json` (220 source hashes).

## Casino notifications, activity log and diagnostics — 2026-10-17

Reused the existing Casino language adapter and the Future Cash notification pattern. Added 42 messages (3,478 total) in English, Simplified Chinese, Russian and Ukrainian. `CasinoMessages` now handles 92 fixed labels and 32 explicit patterns, including pending confirmations, timeout summaries, results and known command failures. Node error text, addresses, amounts, heights and currency identifiers remain literal.

The retained activity-log dialog uses `Language.TextBuilder` over a display snapshot. Raw deque entries, timestamps, its 60-entry cap, pending descriptions and pending types remain unchanged. Notification channel IDs and settings are preserved; language changes rename existing channels and refresh only an active foreground notice. Timeout-claim coin-ID deduplication and dismissal behavior remain unchanged. Historical/dismissed alerts are not reposted.

Validation: 32 Casino plus 9 shared-language JVM tests pass. All three debug APK variants and Pandamonium AndroidTest build successfully. Six guarded disposable-emulator cases pass (three new, three inherited; ten distinct Casino Android cases cumulatively). Checks cover active/inactive service notification behavior without starting the service or node, exact values, channel settings, immutable tap intents, timeout deduplication/dismissal, retained log dialogs and unchanged raw pending state. Four log screenshots were reviewed. The initial JVM fixture compile failure used an unavailable `Files.readString` API; it was corrected to the existing Future Cash/wallet UTF-8 `Files.readAllBytes` pattern before the passing build.

All 19 pinned source imports verify. Twenty-one of the 32 original Casino Java files remain byte-identical. Prior protected mail/Vestr/entropy/ETH/file-I/O/UTXO/NFT sources, Future Cash dual-key financial code, the wallet public audit checkpoint and node JAR hashes are unchanged. Evidence: `build/localization/casino-notices-validation.json` (226 source hashes).

Review: no blocking issue found in this presentation change. This does not certify unchanged Casino transaction algorithms. Broader financial-flow, font-scale/accessibility and API/device acceptance remain, along with malls/AtomiX/PandaPools/PandaDEX translations, listed NFT recovery/compatibility work, release signing, commits and publication. No owner device, seed, node, funds, real bet or transfer was used. Disposable emulator stopped. Still uncommitted and unpublished.

## miniMall Shop languages — 2026-10-17

Reused the standalone Shop's existing pages, cart and database, and the tested Mail `Language`/`LanguageDialog` display adaptation. Inspected the full Shop activity, Catalog/ShopStore/Design/Util, node transport, message/database/crypto dependencies and existing regression tests; compared the standalone activity with the embedded version. The graph vocabulary query `mall merch shop studio inbox minimall` returned 246 nodes, truncated to 1,300 tokens; concrete source inspection established behavior.

Added 111 messages (3,589 total) in English, Simplified Chinese, Russian and Ukrainian. Home/storefront/product/NFT/checkout/order/chat labels, status chips, time labels, dialogs, notifications and known local diagnostics now use the shared selector. Arbitrary catalog names, product descriptions, currency names, shipping labels, addresses, IDs and chat content remain literal. The adapter changes presentation boundaries without rebuilding the page stack or checkout on language changes. Existing cart calculations, shipping choices, protocol constants, serialized order fields and payment calls are retained. Seed-entry uses the existing Mail `FLAG_SECURE` dialog protection. Back/order/vendor controls and quantity buttons reuse 48dp targets and translated accessibility labels.

Validation: seven existing Shop JVM regressions (storage isolation, command argument validation and handler ordering) plus nine shared-language JVM tests pass. All three debug variants and Pandamonium AndroidTest build. Six distinct guarded disposable-emulator tests pass (five initial cases, then three affected cases after review; eight executions): cart/navigation/catalog persistence; checkout draft, shipping and exact total retention; payment confirmation retention without paying; NFT token/edition/address retention; raw order/chat/status and notification-channel settings; empty home and secure seed dialog; generated enquiry titles translated only in enquiry records while stored summaries remain unchanged. Eight checkout/NFT screenshots reviewed. Small label text now reuses Mail’s brighter dark-theme colour; checkout and NFT screens were captured again after this review fix. No real node, seed, signing, payment or owner device was used. Seed-dialog contents were not captured.

All 19 pinned imports verify. Only MainActivity and Design changed among original mall files; ShopMessages is generated separately. Shop catalog/store/database/crypto/transport files and both Studio/Inbox source trees remain byte-identical. Prior protected engines, Future Cash dual-key audit, wallet public audit and node JAR hashes remain unchanged. Evidence: `build/localization/mall-shop-validation.json` (232 source hashes). Disposable emulator stopped.

Review: no blocking issue found in the language binding change. Existing delayed wallet-address callbacks can rebuild checkout, and payment retry/receipt and legacy recovery behavior remain outside this presentation check. Broader lifecycle/font-scale/accessibility/API acceptance remains. Mall Studio/Inbox, AtomiX, PandaPools and PandaDEX translations, the recorded NFT follow-ups, signing, commits and publication remain. Still uncommitted and unpublished.

## miniMall Inbox languages — 2026-10-17

Reused the Shop/Mail explicit Language.msg/setText/hint/description/since/TextBuilder bindings and owned LanguageDialog pattern. Read the complete integrated Inbox MainActivity/Design/Util, CmdChain, NodeApi/MerchDb/MerchMessage/CommsTransport and existing tests, plus the standalone MainActivity diff. Existing graph references to the mall family and MerchDb guided direct source inspection. No standalone donor changes. Added66 catalog messages (3655 total), reusing compatible existing labels. scripts/adapt-pandamonium-mall-inbox-languages.py reproduces the integrated output.

Orders, filters, delivery details, NFT send confirmation, reply hints/prefixes, Vendor Card, seed dialog, notifications and local diagnostics now follow English/Chinese/Russian/Ukrainian. Filters and status values remain canonical; products, shop names, chat, addresses, references and exact amounts remain literal. CSV bytes retain the original headers/status codes/yes-no/date format. Language changes keep the Activity, page, reply text/cursor, dialogs and callbacks; they do not rescan or send. Seed entry uses FLAG_SECURE before showing. Status actions use two rows and secondary labels reuse Shop/Mail's improved dark contrast. Existing notification channel settings are preserved.

Screenshot review found faint text on a light Vendor Card dialog. Reused Filez/ETH's fixed dark Material palette in both resource qualifiers. Review also exposed shared Android assets: Inbox's optional shop.json lookup was reading the buyer Shop's Demo Roastery catalog. Its optional branding lookup is now pm_merchinbox_shop.json; the adapter renames an Inbox-owned shop.json if one exists. With the current donor there is none, so Inbox uses its translated Orders heading. Shop's own asset stays unchanged. The final device test asserts the default Inbox heading and separately verifies a literal custom shop name.

Validation: all three debug variants plus Pandamonium AndroidTest build; 4 Inbox JVM and9 shared-language JVM cases pass. Four distinct guarded Android cases pass on the final APK in all four languages. Nine case executions total: initial4 (one fixture heading assumption failed), corrected orders/CSV case1 passed, final4 after palette/asset fixes passed. The failure is preserved in mall-inbox-preparation-device.log; correction in mall-inbox-fixture-device.log; final in mall-inbox-layout-device.log. Eight final screenshots (order + public Vendor Card in four languages) reviewed. Public fixtures only; no owner device/data, live node, seed, signing or transfers. Installed hashes verified and disposable emulator stopped.

Review verdict: approve this presentation slice; request changes before full release for inherited financial behavior. MainActivity.watchDeparture/watchBundleDeparture currently interpret absent response arrays as no live coins; the NodeApi passes generic failed command envelopes to these callbacks. Reuse the NFT Wallet's strict evidence checks before treating delivery as confirmed. Existing collection/post markers and CommsTransport pending:true/empty receipt acceptance also need the already-established durable outcome/recovery treatment. Existing scan/status refresh can rebuild a reply view; language switching does not. These paths were not certified by presentation tests. Studio translations, remaining integrated apps, broader lifecycle/API/font-scale/accessibility and financial acceptance, signing/commit/push/publication remain open.

Protected previous-app engines, Future Cash dual-key/public-audit sources, minimaWallet public-audit sources and node JAR remain unchanged. Candidate1.9.42/vc113 remains uncommitted and unpublished. Evidence: build/localization/mall-inbox-validation.json (240 tracked source hashes).

## miniMall Studio languages — 2026-10-17

Reused scripts/adapt-pandamonium-mall-shop-languages.py and scripts/adapt-pandamonium-mall-inbox-languages.py, their generated Language/LanguageDialog bindings and fixed dark Material palette. Read Studio's full MainActivity, Design, Catalog, TokenBalance/TokenMeta and existing transport/payment-argument tests; compared the standalone MainActivity. The graph's mall-family references and saved Inbox checkpoint guided inspection. No standalone donor changes.

Studio now translates gallery, product/listing editors, collection controls and dialogs, shop/shipping headings, preview, chooser and local diagnostics in English, Chinese, Russian and Ukrainian. Language changes retain the existing Activity, stack, edit fields, cursor and dialog callbacks. User names/descriptions/shipping labels, exact prices, currency codes, canonical bundle defaults and .shop schema remain literal. The adapter changes only MainActivity, Design, StudioMessages and two theme files. Icon controls have descriptions and 48dp targets. Header/stats text can wrap, and secondary text uses the reviewed contrast color.

Visual review caught unsuitable reuse of person-name and About-the-app translations. Studio now has product/shop-specific name/about resources. Final catalog:3748 messages,93 added in this checkpoint;111 Studio aliases. All three debug variants and AndroidTest compile at1.9.42/vc113.13 JVM cases pass (4Studio+9shared language). Four guarded Android cases cover product/shipping drafts and cursors, NFT metadata/price/stepper, retained collection dialogs/callbacks and intercepted .shop export. Export bytes are identical in all four languages, preserving exact prices and raw fields. Nine case executions: initial4 (one test asserted before Android's posted dialog callback), corrected collection1 passed, final4 after context-label corrections passed. Initial failure preserved; no production callback fix was needed. Eight final product/bundle screenshots reviewed. Public fixtures only, no owner device/data, live node, seed, signing or transfer. Disposable emulator identity checked and stopped.

### Review

Presentation verdict: approve after the context-label correction. These checks do not certify inherited catalog/financial lifecycle behavior. Before release, review/fix failed or malformed balance/coin replies clearing listings, collection refresh removing #ALL bundle entries, photo callbacks rebuilding a different product editor, and the export worker reading mutable UI-owned catalog state. The existing .shop export's integer conversion for very large edition supplies also needs boundary validation. Prior Inbox strict-confirmation/durable-delivery, NFT transaction/recovery and wallet acceptance gates remain open. AtomiX, PandaPools and PandaDEX translations, broader API/accessibility checks, signing, commit, push and publication remain.

Future Cash's9 protected financial sources and the9-file minimaWallet public-audit checkpoint are unchanged. Classic + blocksaskeyuses support remains implemented/tested. Candidate1.9.42 remains uncommitted and unpublished. Evidence: build/localization/mall-studio-validation.json.

## miniMall Studio refresh integrity — 2026-10-17

Previous goal turn was progress: Studio language bindings and validation were saved. Revalidated HEAD9def96e6801a9bef261611e45349f28a1eb6ae1c and the Studio graph/checkpoint before this work. Reused the exact coin identity/amount parser and state-shape/duplicate-port validation from scripts/pandamonium-sources/NFTwallet/BurialEvidence.java, the strict Boolean-status gate in integrated/NFTwallet/src/main/java/com/eurobuddha/nftwallet/NodeApi.java and its real-wrapper Mockito tests. Read Studio's MainActivity, NodeApi, Util, StateNft, TokenBalance and ImageLoader ownership guards; checked the standalone mall/NFT candidates and the node's balance/tokens response fields. Balance-specific field validation adapts those proven gates to aggregate rows, which do not have coin IDs.

Added scripts/adapt-pandamonium-mall-studio-refresh.py and canonical StudioData.java. A whole balance/coin response is validated before any editable listing state changes. Missing/failed replies, malformed rows/state, duplicate IDs/ports/edition indices and mismatched token IDs preserve the prior catalog. A successful empty array still removes vanished listings. Positive edition indices are bounded before integer conversion; hostile large values cannot crash a callback midway. The Studio wrapper rejects non-Boolean or false status and suppresses late responses after release.

Collection refresh now retains #ALL bundle edits while listable pieces remain, preserves per-piece edits across coin-ID changes and invalidates cached artwork when its source changes. Callbacks for removed collection objects and token records for departed holdings cannot resurrect listings. Cached immutable token records are reused when a collection returns. New balance maps are published before follow-up token/coin requests, including immediate callbacks.

Photo results mutate the model on the UI thread and check product identity, request generation, lifetime and continued membership. Existing product image/caption views update in place, retaining typed text and cursor. Another product's editor is never rebuilt; deleted products and superseded requests ignore late results.

Validation:22 JVM cases pass (13Studio+9language). Nine Android cases passed: five new actual Activity/refresh/photo-worker regressions plus the four existing Studio language/export cases. After adding strict state validation, the two affected collection cases passed again;11 executions total, no failures. Main/test APK hashes verified on named disposable emulator5580. All19 pinned imports reproduce. Initial full build covered all three debug variants; final Studio-only changes rebuilt Pandamonium and AndroidTest. Catalog remains3748. Eight language regression screenshots captured; prior reviewed layout remains unchanged. No owner devices/data, real node, seed, signing, transfers or external sharing used. Test-generated photo/export files removed; emulator stopped.

### Review

Approve this refresh/photo slice. Failed refreshes retain last-known data; that is not proof the NFTs remain available. Remaining Studio release work: freeze an immutable export snapshot before background image/file work; validate large edition counts before serializing int fields; review export eligibility after an unsuccessful refresh. Existing Inbox strict-confirmation/durable-delivery and broader wallet/NFT transaction acceptance gates remain. AtomiX, PandaPools and PandaDEX translations, broader API/accessibility, signed builds, commit/push and authorized publication remain open. No standalone donor, prior app engine, Future Cash dual-key/public-audit source or node JAR changed.

Evidence: build/localization/studio-refresh-validation.json. Candidate1.9.42/vc113 remains uncommitted/unpublished.


## miniMall Studio export integrity — 2026-10-17

Revalidated HEAD 9def96e6801a9bef261611e45349f28a1eb6ae1c and the preceding graph/refresh checkpoint. Reused the existing schema-v3 serializer in integrated/merchstudio/MainActivity, NFT Wallet's scripts/pandamonium-sources/NFTwallet/tool-review.inc literal snapshot pattern, and app/src/main/java/com/eurobuddha/minimacore/main/backup/NodeFiles.java temporary-write/sync/atomic-move ordering. Read the standalone Studio donor, buyer Catalog.java signed-int count fields, NodeFiles callers/tests, and original image resolution/FileProvider paths. NodeFiles.replaceFrom is package-private and guarded for node storage, so Studio adapts its ordering to app-cache exports without changing node file access.

New canonical ShopExport.java and export-flow.inc, applied by adapt-pandamonium-mall-studio-export.py, freeze schema fields and image descriptors on the UI thread before image work. The worker does not read or mutate live product/listing/collection models. Exact price strings, shipping text, metadata, image identities, file name and share subject are captured together. The image decoder, identicon fallback and byte budgets are preserved. Each export uses a new cache/shops/export-* directory and its readable slug.shop name. Atomic rename makes only complete files shareable; an old content URI is not overwritten by a later same-name export. Completion updates export buttons in retained pages without replacing the current editor/cursor, and destroyed Activities do not launch a chooser.

Wallet and collection verification is revoked when refresh begins and restored only after a complete valid response. NFT export requires a connected node, validated wallet data, a known token record, and verified collection coins where applicable. Failed refreshes retain edits but cannot authorize a fresh NFT export. Typed-only shops remain exportable independently. Exact positive integer conversion rejects counts outside the existing buyer format's 1..2147483647 range. Studio StateNft.firstInt previously wrapped JSON numeric metadata through Number.intValue; it now parses exact bounded integers, returning unknown for invalid/nonpositive values. Export rejects unknown collection supply. This is the only additional original mall engine file changed in this slice; 113 baseline mall files remain unchanged.

Validation: 28 JVM cases pass (19 Studio, including 6 new export/count cases, plus 9 locale). All three debug variants build. Thirteen Android cases pass in 17.813 seconds: four existing language cases, five refresh/photo cases and four new export regressions. The tests intercept sharing, mutate product/name/price/image/shipping/currency and collection fields while the worker is queued, verify original payload/subject/directory, retained editor/cursor, distinct URIs and unchanged previous bytes, reject failed/unverified refreshes and count overflow, and compare exported bytes across all four languages. No real node, seed, owner device, signing or external sharing is involved. Initial unit compilation used an unavailable Android-stub Files.readString API; it was corrected before the passing run. All 19 pinned imports reproduce; generator, transport and diff checks pass. Catalog 3750. Main/test installed hashes verified; eight unchanged-layout regression captures saved; named disposable emulator stopped. Future Cash dual-key/public-audit sources and all other protected engines/node JAR remain byte-identical.

### Code Review

Summary: the export now owns immutable input and uses stable, complete files. Strict bounds preserve existing .shop readers; callback completion preserves navigation. Reviewed the adapter, canonical helper/flow, generated MainActivity/StateNft, fixtures, tests and the two messages in all four languages.

Findings: the mutable worker reads, reused share filename, unchecked numeric conversions and export-after-failed-refresh paths are addressed. No remaining critical or major finding in this export slice. Exported wallet data remains a last-known snapshot, not proof of future availability or delivery.

Verdict: Approve this slice. Broader Inbox receipt/recovery and NFT/wallet financial/lifecycle gates remain open. AtomiX, PandaPools and PandaDEX inner translations, broader device/API/accessibility acceptance, release signing, commit/push and authorized publication remain. Candidate 1.9.42/vc113 remains uncommitted and unpublished.

Evidence: build/localization/studio-export-validation.json (265 source hashes). Four new Android cases bring distinct mall cases to 23. Next: continue remaining integrated-app localization and the existing transaction release gates; do not redo the completed Future Cash dual-key or Studio export work.


## AtomiX shell and wallet languages — 2026-10-17

Reused integrated/atomix/MainActivity.java, Design.java and existing dialog drawables, scripts/adapt-pandamonium-eth-languages.py and the ETH dialog/key-protection pattern, and shared Language/LanguageDialog. Reviewed standalone apks/atomix guidance and matching UI code, NodeApi offline states, IdentityWatch, TradingContext and database/test fixtures. The canonical adapter scripts/adapt-pandamonium-atomix-languages.py scopes substitutions to reviewed UI methods. Added 66 messages (3816 total), with 73 aliases including seven existing shared messages.

Navigation, header, wallet, receive/manual-send/review, key export, welcome and currency choice now bind to all four languages. Dialogs and draft fields remain in place; recipients, amounts, fees and protocol values remain literal. Header and wallet actions wrap in two rows. Existing dialog drawables preserve dark/light surfaces. Secondary text and selected currency controls have clearer contrast. Key reveal sets FLAG_SECURE before showing, and clipboard content is marked sensitive. Language changes do not switch the trading currency or restart financial workers.

Validation: 260 existing AtomiX JVM tests plus 9 locale tests pass. All three debug variants and Pandamonium AndroidTest build. Six distinct Android cases pass, covering both themes, retained drafts/cursors/asset choice, full review/receive values, modal dismissal, welcome/currency preferences, mismatch identifiers and secure key-copy behavior. Initial two test-only failures were assertions before queued click/dismiss callbacks; idle boundaries fixed the fixture. Final grammar-only resource update rebuilt all variants and reran the affected wallet case successfully (13 total executions including the preserved initial run). Main/test installed hashes verified. Clean Ukrainian light and Chinese dark wallet screenshots reviewed; final Ukrainian send and Russian review screens were reviewed previously. No private-key screenshots, real seed, owner data/device, node, signing or transfer. The guarded disposable emulator was stopped.

All 19 pinned imports reproduce; generator/transport/diff checks pass. Only MainActivity, Design and themes changed among original AtomiX files; 45 original Java helpers/engines remain unchanged. Protected prior app sources, Future Cash dual-family/public-key audit, minimaWallet public audit and node JAR hashes match. Future Cash classic and blocksaskeyuses support remains implemented and tested; no repeated implementation was needed.

### Code Review

Summary: Approve the shell/wallet presentation checkpoint. It reuses existing locale bindings and dialog ownership, preserving user data and callback semantics. No outstanding critical/major finding in this slice. Wider AtomiX release review remains open: IdentityWatch notification still recommends clearing storage/reinstalling despite sharing the Pandamonium node, and the raw EthWallet error boundary needs inspection for secret-bearing exceptions.

Remaining AtomiX text: swap/guided/sweep, market, activity/history/diagnostics, OTC, consolidation/write resolution, services and lower-level errors. PandaPools/PandaDEX translation, existing NFT/wallet/Inbox financial gates, API/accessibility checks, release signing, commit/push and GitHub fork/PandaApps/eurobuddha.com publication remain pending. Candidate1.9.42/vc113 is uncommitted and unpublished. Evidence: build/localization/atomix-languages-validation.json (271 protected source hashes). This checkpoint is progress, not completion of the active release goal.


## AtomiX notices and safe key replies — 2026-10-17

Reused scripts/adapt-pandamonium-future-notices.py, the wallet diagnostic generator and integrated/ethwallet/eth/EthWallet.java exact-width validation. Read complete AtomiX IdentityWatch/EthWallet, service lifecycle and notifier callers, existing IdentityWatch/ETH encoding regressions, NodeApi response handling and Casino notification/message fixtures. Canonical adapter scripts/adapt-pandamonium-atomix-notices.py generates AtomixMessages from localization/atomix-messages.json. Sixty new messages (3876 total) cover 36 fixed notices and 24 templates, preserving literal amounts, full addresses, currencies, feed names, IDs and unknown diagnostic captures. No swap/OTC financial engine or wire/log format was translated.

Foreground status, offline alerts, swap completion/refund/gas notices, identity alarms, OTC notices and known decline reasons now display in all four languages. Existing IDs/tags, notification importance, sounds, vibration and offline deduplication remain. NotificationLabels updates existing channel names through the global selector even while AtomiX is closed. Service configuration changes refresh only an already-active foreground notification; the stored raw status is retained, including an in-progress republish. Historical event notices retain their posting language.

Resolved findings: IdentityWatch's old reinstall-and-clear-storage advice was unsafe for Pandamonium's shared node. The alarm now stops new trades and directs users to recovery information while explicitly warning against clearing shared storage. EthWallet formerly accepted short hex and could echo secret-bearing parse/transport errors into the wallet screen. The shared derive/probe boundary now requires Boolean status true, a string of exactly 32 bytes of hex, and a scalar within the secp256k1 range. It uses the pinned web3j curve order, stages credentials before assignment, preserves an existing key on invalid replies, and returns fixed safe errors. Probe never changes the active key. No key derivation algorithm, seed, transaction or settlement policy was changed.

Validation: 269 AtomiX JVM cases plus nine locale cases pass (nine new cases cover key shapes/range/envelopes, retained credentials, secret-free errors, fixed/template capture integrity and shared-storage guidance). All three debug variants and Pandamonium AndroidTest build. Nine distinct Android cases pass: six existing wallet/dialog cases plus three notification/error cases. Real NotificationManager assertions cover all four languages, unchanged channel settings, active/inactive foreground refresh, immutable tap intents, full gas amounts/addresses, BigText, offline deduplication/cancellation and retained wallet error views. Two full runs each passed eight of nine cases while the isolated foreground case passed. Actual-notice diagnostics found stale PandaPools/PandaDEX test notices in the system group; logcat reported cancellation of queued AtomiX ID4101. The guarded fixture now clears this seedless test package's notices and waits for cancellation before each case. All nine then passed. Twenty-eight total executions; both failed runs retained. Only public scalar1/2 and synthetic values were used; no owner data/device, real seed, node, signing or transfer. Installed main/test hashes verified and guarded emulator stopped.

All 19 pinned imports reproduce; catalog/transport/diff checks pass. Forty-two original AtomiX Java files remain byte-identical. SwapService changes are notice lifecycle/display only, IdentityWatch changes are recovery text only, and EthWallet changes are the reviewed key boundary. Other protected engines, Future Cash dual-key/public audit, minimaWallet public audit and the node JAR remain unchanged.

### Code Review

Summary: Approve this notification/key-boundary slice. The two major findings (unsafe shared-storage advice and acceptance/exposure of malformed key material) are addressed with direct regressions. The expanded UI capture mapper leaves unknown diagnostics and captured values literal. The notification test isolation fix is restricted to the explicitly guarded seedless emulator. Both failed runs remain in evidence; production notice behavior was not weakened to satisfy the tests.

Remaining AtomiX: swap/guided/sweep, market, activity/history/diagnostics, OTC, consolidation/write resolution and residual backend error text; broader financial and lifecycle review. Remaining release: PandaPools/PandaDEX inner translations, existing NFT/wallet/Inbox financial gates, API/accessibility checks, signed versioned artifacts, commits/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Evidence: build/localization/atomix-notices-validation.json (283 source hashes). Active goal remains in progress.


## AtomiX OTC languages and retained drafts — 2026-10-17

Reused AtomiX MainActivity's existing swap draft/focus guard, Language/LanguageDialog bindings, notification message mapper and AtomixLanguagesTest harness. Inspected standalone and integrated OTC forms, OtcOffer/OtcDb/OtcController, TradingContext, provider/deal callers and existing tests. Canonical adapter scripts/adapt-pandamonium-atomix-otc.py runs after the notice adapter. It adds 54 catalog messages (3930 total), with 55 aliases including common.cancel. Five fixed backend messages join the existing map (41 fixed, 24 templates). Known OTC labels/statuses/funds errors now follow English, Chinese, Russian and Ukrainian. Amounts, prices, currencies, provider keys and unknown statuses remain literal. Stored values and wire strings are unchanged.

The inline availability fields previously lost unsubmitted edits when periodic refresh rebuilt the screen. They now retain exact draft strings separately from published preferences, and use the existing swap focus pattern to keep the current input and cursor while editing. Changing language rebinds labels in place. Leaving and returning to OTC restores drafts. A genuine identity mismatch bypasses this new editing guard and still displays the halted screen. Publish/withdraw leave the editing guard through the existing action paths. These drafts remain Activity-local; actual currency switch still recreates the Activity and reads that currency's preferences.

Long translated deal actions use full-width 48dp rows. Availability actions share their row width. Offer/counter dialogs retain their fields, cursors, values and cancellation callbacks. Provider labels retain full-key clipboard behavior. No new dependency, trade execution, DB schema or financial formula was introduced.

Validation: 269 AtomiX and nine localization JVM cases pass; all three debug variants and Pandamonium AndroidTest build. Nine Android cases pass in44.411seconds: six existing shell/dialog cases and three new OTC cases, giving12 distinct AtomiX cases cumulatively. New cases cover all four languages and both modes, focused background refresh, tab navigation, identity mismatch, offer/counter draft retention/cancel, unchanged local deal records/messages, funds display, unknown statuses and full public-key copying. No positive trade action was submitted. Ten OTC screenshots captured; Ukrainian daylight availability/counter and Russian onyx deal/provider layouts reviewed. The counter fixture changes palette without rebuilding dimmed background cards; this mixed background is a fixture artifact. Main/test installed hashes match and the guarded seedless emulator is stopped.

All19 pinned imports reproduce; catalog/transport/diff checks pass. Forty-two original AtomiX Java files, all previous protected engines, Future Cash dual-family/public audit, minimaWallet public audit and node JAR remain unchanged. Future Cash's requested classic64x3 + blocksaskeyuses128x4 support was rechecked in KeyAudit.java and DualKeyAuditTest.java plus graph notes. Stored70-test Future Cash reports pass; they were inspected, not rerun. Evidence: build/localization/atomix-otc-validation.json (286 source hashes).

### Code Review

Summary: Approve this OTC translation/draft slice. Display descriptors preserve raw values, and the retained-draft fix has direct Android regressions. Broader trading approval remains open.

MAJOR existing issue — integrated/atomix/.../MainActivity.java renderOtcDeals uses current ccy() for all stored deals while OtcDb stores d.currency. Old deals can be labelled with the newly selected currency. Before release, review initiator execution and controller accept/counter guards and apply the established currency isolation pattern; the responder's otcLpDeal already rejects a different nonempty currency. This checkpoint does not claim the financial path is safe after currency changes. Also review finite numeric input, publish state before confirmation, and callbacks after Activity destruction in the broader financial pass.

Remaining: AtomiX swap/guided/sweep, market/editor, activity/history/diagnostics, consolidation/write resolution and backend text; PandaPools/PandaDEX inner translations; existing NFT/wallet/Inbox financial gates; API/accessibility checks; signed versioned artifacts, commits/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted, unsigned for release and unpublished. Active goal remains in progress.


## AtomiX saved-currency isolation — 2026-10-17

Previous goal turn was progress; verified all286 prior checkpoint hashes before editing. Reused SwapEngine.otcLpDeal's existing saved-currency check, TradingContext's market mappings, AtomiX's initiator and sealed-message paths, Mockito GateTest fixtures and AtomixOtcLanguagesTest. Read complete integrated OtcController/OtcDb/OtcMessage and relevant engine, Activity/service initialization and currency switch callers; compared standalone AtomiX/usdtSwap and the MiniDapp OTC implementation/tests. The MDS code shares the responder guard but does not supply a complete initiator currency fix. Canonical adapter: scripts/adapt-pandamonium-atomix-currency.py.

Fixed the reviewed major defect: stored OTC deals were displayed and actionable under the newly selected currency, and initiator execution lacked the responder's saved-currency check. Deal labels now use their saved market; other-market actions are hidden with switch guidance. Unknown currency stays explicit and disables new trading actions. OtcDb no longer assigns the current market when updating an existing legacy row with missing currency. New controller-created deals are stamped with the controller's captured market.

Controllers reject wrong/unknown market actions, stale sessions, incoming transitions before dedup, and execution against a fresh DB row in another market. Sealed messages capture the correct market channel before crypto work. The engine checks the saved currency and its Minima token; the responder also rejects unknown attribution. Initiator helpers receive the already-checked market explicitly, eliminating a selection change between entry validation and dispatch. Async secret/block/queued ETH work rechecks the selection, and persisted swap labels use the captured market. The Minima sell reservation is released on rejection. Existing claim/refund paths and wire payload/schema remain unchanged.

Validation:282 AtomiX +9 localization JVM cases pass (13new currency regressions). Cases cover strict key mapping, inactive/unknown actions before mutation, stale controllers, fresh DB currency, valid execution, inbound dedup, channel capture during sealing, both markets and directions, mismatched engine tokens, secret/block callback races, dispatch-time races, and the responder's unknown-currency gate. Initial JVM compilation failed only on the new canonical test's standalone import; corrected to the integrated package and retained the log. All3 debug variants and Pandamonium AndroidTest build.

Eleven Android cases passed in54.456seconds: nine previous shell/OTC cases plus two currency cases. They verify mixed-market labels/action availability in all4languages, real SQLite legacy-null preservation, and rejection of a counter dialog confirmed after switching market without changing terms/status/messages. Visual review found that unknown rows were told to switch to an unidentified market; a fourth new catalog message now states that trading actions are disabled. Both affected cases passed again against final installed builds;13executions total,14distinct AtomiX cases cumulatively. Ukrainian final screenshots reviewed for both market selections. Only public fixtures and unique local rows were used; no owner data/device, real node, seed, signing or broadcast. Installed hashes verified and guarded emulator stopped.

All19 pinned imports reproduce; catalog3934, transport and diff checks pass. Thirty-seven original AtomiX Java files remain byte-identical; the five reviewed engine/model files now join the protected checkpoint. Future Cash dual-key/public audit, minimaWallet audit, other protected engines and node JAR remain unchanged. Evidence: build/localization/atomix-currency-validation.json (295source hashes).

### Code Review

Summary: Approve the saved-deal currency-isolation changes. The major wrong-market display/action/initiator issue, the dispatch race and legacy-restamping issue have direct regressions. Message routing remains bound to the captured market. Unknown metadata cannot authorise a fresh liability; it remains visible. Recovery code is unchanged. This does not claim a complete trading safety audit.

Remaining financial review: finite OTC numeric input, fresh consent/state across Activity/service controllers, OtcBook scan/offer context, responder async lock boundaries, publish confirmation and callback lifecycle. Remaining language/release work: AtomiX swap/guided/sweep, market/editor, activity/history/diagnostics, consolidation/write resolution and residual errors; PandaPools/PandaDEX inner translations; existing NFT/wallet/Inbox financial gates; API/accessibility checks; signed versioned artifacts, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted, unsigned for release and unpublished. Goal active with concrete progress.


## AtomiX OTC finite amounts and settlement grain — 2026-10-17

Previous turn was progress; verified all295 currency checkpoint hashes. Reused Order.finite/validPos, MinimaHtlc.isDecimal/positive/grain, the MDS OTC finite num helper and existing AmountGrainTest/GateTest/RoutingOrderTest fixtures. Read current controller, offer parser, engine entry/responder checks and UI callers plus sibling MiniDapp validation. Canonical adapter scripts/adapt-pandamonium-atomix-amounts.py follows the currency adapter. No dependencies or catalog messages added (3934total).

Fixed non-finite OTC input: Double.parseDouble accepted NaN/infinity, which could bypass <=0 checks and later reach BigDecimal formatting or execution. Offer sizes now reuse the tested finite-positive boundary for parsing, liquidity/caps and the controller's own availability. Unknown sides have no cap. Terms require positive plain decimal strings, finite values/product, and nonzero settlement after the existing six-decimal grain. Stored malformed terms cannot be accepted or initiated; both responder checks reject invalid terms and zero-funded legs before the existing amount tolerance. Wire/storage strings and quote arithmetic are retained for valid input.

OTC UI parsing handles non-finite values before formatting. Oversized availability cannot update published preferences; its exact draft/cursor remains. Empty/zero sides still represent off when the other side is positive. Offer/counter forms validate their existing normalized decimal values before submission, and funds errors reuse the four-language mapper. Other MainActivity numeric parsing remains unchanged.

Validation:291 AtomiX +9 localization JVM cases pass. Nine new cases cover malformed/NaN/infinity/negative/zero/hex/exponent/overflow input, exact decimal and settlement boundaries, legacy/two-sided malformed offers, outbound rejection before mutation/send, incoming rejection before persistence/dedup, invalid stored agreements, engine/responder boundaries and zero-funded tiny legs. The last case proves zero cannot exploit the existing 0.00001 comparison tolerance. Existing currency guards and normal trading tests remain green. All3debug variants and Pandamonium AndroidTest build.

Twelve Android cases pass: eleven existing currency/OTC/shell cases plus one oversized-availability regression, giving15distinct AtomiX cases cumulatively. Across all4languages, a340-digit input remains an unchanged draft with its cursor, and cannot alter saved settings; malformed funds checks give translated errors while normal leading-zero decimal input remains valid. Existing public fixture tests verify records/callbacks and language switching. Only mocked chains/crypto/transport and seedless emulator fixtures used; no owner data/device, real seed, node, signing or trade broadcast. Installed hashes verified and guarded emulator stopped.

All19pinned imports reproduce; catalog/transport/diff checks pass. Thirty-six original AtomiX Java files remain byte-identical, with OtcOffer now included in the protected modified sources. Future Cash dual-key/public audit, minimaWallet public audit, other protected engines and node JAR remain unchanged. Evidence: build/localization/atomix-amounts-validation.json (300source hashes).

### Code Review

Summary: Approve this finite-input and zero-settlement fix. Invalid values are rejected before mutation or new liabilities, while the established decimal/grain behavior is reused. Strict wire whitespace rejection avoids validating trimmed text that downstream BigDecimal would otherwise interpret differently. This does not complete the wider OTC financial review.

Remaining financial review: state/consent freshness across controllers, OtcBook scan/offer market context, responder async lock boundaries, publish confirmation and lifecycle; positive-amount tolerance and maximum-chain-amount limits are separate checks. Remaining language/release work: AtomiX swap/guided/sweep, market/editor, activity/history/diagnostics, consolidation/write resolution and residual errors; PandaPools/PandaDEX inner translations; existing NFT/wallet/Inbox gates; API/accessibility validation; signed versioned artifacts, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted, unsigned for release and unpublished. Goal active with concrete progress.


## AtomiX market, ladder editor and trade-entry languages — 2026-10-17

Previous turn made progress by saving the finite-OTC checkpoint. Revalidated all300 prior source hashes before this change. Reused scripts/adapt-pandamonium-atomix-languages.py and adapt-pandamonium-atomix-otc.py for scoped display bindings, LanguageDialog for in-place updates, and adapt-pandamonium-wallet-error-languages.py for fixed/template mapping. Read the integrated MainActivity market/editor/take callers, standalone and integrated PriceOracle, and existing AtomixMessages/Android tests. Graph query expanded to price/oracle/order/ladder and confirmed Order, MainActivity, applyPeg, publish and take-dialog source locations. No dependencies added; canonical adapter follows the amount adapter.

Added80 English, Simplified Chinese, Russian and Ukrainian messages (4014total). Market labels, order count, maker tag, spread and remaining levels, ladder fields/warnings/previews, and buy/sell entry now update in place. Price, currency, amounts, keys and unknown diagnostics remain literal. The reused MarketMessages generator maps6fixed statuses and19patterns, including scientific oracle prices, missing data and stale-spread descriptions; raw stored/logged status strings and PriceOracle remain unchanged. Preview quantities now show the actual currency instead of the ambiguous M suffix.

Peg help now reflects the existing behavior: stale last-good pricing widens the spread; unusable data or the hard12-hour ceiling withdraws the order. mxUSDT parity has its own accurate explanation. Long editor parameter hints have full-width fields and persistent labels. Clear-level controls have translated accessibility descriptions and48dp targets. Trade entry scrolls for longer translations. Visual review found that filled hints disappeared and ask price/amount visually touched; added persistent field labels and corrected the quote spacing before the final rerun.

Validation:295AtomiX +9localization JVM tests pass, including4new mapper cases for every fixed/template, scientific notation, negative age, nested raw errors and unknown data. All3debug variants and Pandamonium AndroidTest build; final build12seconds. Initial9Android cases pass in45.435seconds (6inherited shell cases plus3new market cases); after visual fixes, reran the3affected cases successfully. Twelve executions,9distinct this checkpoint,18distinct AtomiX cases cumulatively. New tests preserve all32editor values/cursors in both markets and both themes through all4languages without changing settings, preserve buy/sell drafts and quotes/full-key copying, retain book objects/raw errors, and verify cancel/modal/timer cleanup. Oracle fetches are disabled before launch and restored afterward; no real node, seed, owner device, publication, signing or trade was used.

Final installed APK hashes verified. Twelve final screenshots retained, with Ukrainian dark book/light trade/editor/levels visually reviewed. The trade screenshot includes an Android clipboard overlay from copying the public fixture key in the previous case. All19pinned imports reproduce; generation, direct transport and diff checks pass. Thirty-six original AtomiX Java files remain byte-identical. Other protected engines, Future Cash dual-family audit, minimaWallet public audit and node JAR remain unchanged. Evidence:build/localization/atomix-market-validation.json (307source hashes).

### Code Review

Verdict: approve this market presentation change. Locale updates preserve the existing views and inputs; only explicit display text is mapped. The two visible layout issues were fixed and rechecked. This is not full financial/release approval. Existing oversized market editor/autofill inputs still need finite validation before formatting/saving. No arithmetic, order sanitization, feed state, publishing or settlement algorithm changed.

Remaining: AtomiX Swap/guided/sweep, activity/history/diagnostics, consolidation/write resolution and residual errors; the prior OTC financial review; PandaPools/PandaDEX inner translations; outstanding Inbox/NFT/wallet release gates; broader API/font-scale/accessibility checks; signed versioned artifacts, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active with concrete progress.


## AtomiX market draft validation — 2026-10-17

Previous turn was progress: market/editor translations and evidence were saved. Revalidated all307 prior source hashes. Read Order normalizers, PriceOracle peg formulas/guards, MainActivity decimalInput/trimSig, sendDialog's retained validation handler, OTC amount guards, and standalone RoutingOrder/PegLevels tests. The graph's saved Order/MainActivity/PriceOracle paths continue to apply. Reused those existing decimal, finite-value, ladder-clamp and dialog patterns. A small MarketDraft boundary is needed because Order.sanitize drops malformed levels after parsing, while the editor must reject a bad draft without silently turning a side off. OTC validation requires positive settled amounts and cannot directly validate blank rows, zero sizes or signed skew.

Added a pure validator through scripts/adapt-pandamonium-atomix-market-inputs.py and scripts/pandamonium-sources/atomix/MarketDraft.java. It checks all8parameter fields and24level fields, non-finite numbers, underflowed nonzero input, price/amount products, totals and generated ladder arithmetic. The exact10-significant-digit trimSig rounding is also checked: a finite near-maximum value can otherwise round outside the double range before entering a field or saved preference. The adapter asserts the source formatter precision so drift cannot silently change this assumption. Blank fields, zero-sized/off sides, signed skew and existing level/skew/reprice clamps remain supported.

Manual and peg auto-fill validate before replacing rows; the peg checks the actual captured oracle price again before writes. Invalid Save retains the dialog, raw values/cursors, existing preferences and order state. The successful-save body is unchanged after whitespace normalization, including sanitization, arming and publish opt-in behavior. Validation errors use one new message in all4languages (4015catalog total). Reused Future Cash's post-layout requestRectangleOnScreen pattern so a Save error stays visible through language changes without moving input focus; ordinary edits stop the forced error reveal.

Validation:303AtomiX +9localization JVM tests pass (8new numeric cases). All3debug variants and Pandamonium AndroidTest build; final rounding build7seconds. Twelve distinct Android cases exercised (9inherited shell/market plus3new input cases),21distinct AtomiX cumulatively. Initial12-case run:11passed,1failed because the validation error was outside the viewport. Preserved that log, fixed layout timing, then4affected cases passed in 23.305seconds. After the rounding boundary regression, reran those4again successfully. Twenty executions in total. Checks cover every field's oversized value, partial decimals, underflow, unchanged settings after rejected Save, translated visible errors/cursors, retained manual/peg rows on calculation overflow, rounded preference overflow, and a valid local Save/clear through all4languages. No real node, owner device/data, seed, signing, trade or published order was used. Oracle/network activity was isolated by the existing seedless fixture.

All19pinned imports reproduce; catalog, direct-transport and diff checks pass. Final installed APK hashes verified; final error/editor screenshots reviewed. Disposable emulator was stopped after its identity check. Thirty-six original AtomiX Java files, all protected financial engines, Future Cash dual-key/public audit, minimaWallet audit and the node JAR remain unchanged. Evidence:build/localization/atomix-market-inputs-validation.json (313source hashes).

### Code Review

Verdict: approve this draft-validation fix. Invalid data is rejected before order/preference mutation, and all generated arithmetic is checked before replacing fields. The failed visibility check and rounding boundary were corrected and retested. Scope is editor admission and display safety; existing background restore/peg state, wire data, six-decimal settlement limits, maximum chain amounts, confirmation semantics and the prior broader financial review remain separate release gates.

Remaining: AtomiX Swap/guided/sweep, activity/history/diagnostics, consolidation/write resolution and residual errors; prior OTC financial review; PandaPools/PandaDEX inner translations; existing Inbox/NFT/wallet release gates; broader API/accessibility; signed versioned builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active with concrete progress.


## AtomiX history languages — 2026-10-17

Previous turn was progress: market-input validation and its graph checkpoint were saved. Revalidated313 prior source hashes. Graph query expanded with swap/history/activity/trade/atomix/language and identified MainActivity history/card methods and SwapDb. Read the current history/cards/status/countdown/export methods, MarketChartView, SwapDb row/storage APIs, SwapVisibilityTest, the market adapter/tests, and the proven Parlons/shared Language bindings. Reused existing language messages, relative-time bindings, retained dialogs and the same filtering/CSV helpers.

Added44 messages in English, Simplified Chinese, Russian and Ukrainian (4059total). History cards, roles, statuses, refund units, hidden-count links, history tabs, chart empty states and export notices update in place. Raw values, unknown states, public identifiers, protocol statuses and CSV fields remain literal. Counterparty copying retains the full key. History actions use aligned full-width48dp controls; empty chart captions use wrapping text while actual numeric plots retain MarketChartView. Only MainActivity changed among original AtomiX production files.

Validation:303AtomiX +9localization JVM tests pass; all3debug variants and Pandamonium AndroidTest build (final9seconds). Four new Android cases cover7states/both themes/all4languages, literal values, full-key copy, retained hide/report dialogs, hide cancellation/confirmation, market labels and block-versus-time refunds, and byte-identical CSV exports including formula-escaping. Initial4cases:2pass,2fail because a button callback assertion ran before dispatch and the test expected12.34 instead of the unchanged12.3 compact format. Corrected those assertions; the2affected cases then passed. Six executions,25distinct AtomiX cases cumulatively. Failed log retained. Initial and final screenshots reviewed; final APK installation hashes verified; disposable emulator stopped. All19pinned imports, generator, direct transport and diff checks pass. Thirty-six original AtomiX Java files and every protected prior engine/audit/node hash remain unchanged. Evidence:build/localization/atomix-history-validation.json (316sources).

### Code Review

Summary: display bindings use the existing immutable messages and retain callbacks. CSV serialization and IO compare unchanged after excluding translated toasts; device exports are byte-identical across all four languages.
Findings: no new blocking finding within this display change. Known backend diagnostics and prior financial/lifecycle gates remain open.
Verdict: approve this history localization change; the overall release remains incomplete.

Remaining: AtomiX swap/guided/sweep, diagnostic report text, consolidation/write resolution and residual errors; PandaPools/PandaDEX inner translations; prior financial/wallet/Inbox/NFT and API/accessibility gates; signed versioned builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## AtomiX guided swap languages — 2026-10-17

Previous turn was progress: history translations and evidence were saved. Verified316 checkpoint hashes. Reused graph-located MainActivity/SwapDb paths. Inspected guided swap, single/sweep review, slippage, stage rendering, quote/routing methods and the existing SwapOrderBookTest plus standalone RoutingOrderTest. Reused shared Parlons-derived Language/LanguageDialog, prior history role labels and the existing AtomiX adapter parser; retained all calculations and callbacks.

Added64 messages in all4languages (4123total). Guided amount cards, price/depth/fee text, buy/sell selectors, no-quote help, stages, single and partial/multi-part reviews, validation notices and custom slippage translate in place. Amount fields and direction flip have translated accessibility descriptions; flip/slippage controls have48dp targets. Slippage options sit below their label; stage text wraps. Existing raw amounts, keys, plan data, clipboard contents and unknown diagnostics remain literal. Eighteen calculation/execution/stage-selection methods compare byte-identical, including buildSweepPlan, bestMakers, computeUsdt/Minima, startSwap, startSweep and confirmation progression.

Validation: all3debug variants and Pandamonium AndroidTest build;303AtomiX +9localization JVM tests pass. Four new Android cases passed in43.586seconds: both markets/directions/themes, both editable amount fields and cursors, retained single reviews with full maker keys, partial buy and multi-part sell reviews, unchanged plan snapshots, copy-key action, slippage draft cancellation and local setting save. No swap/sweep submission, real node, owner device/data, seed or signature was used. Visual review found a plural-form issue in the gas-payment note; changed to a count label and reran the affected sweep case successfully. Five executions;29distinct AtomiX cases cumulatively. Eleven screenshots retained; representative final layouts reviewed. Final APK installation hashes verified; disposable emulator stopped.

All19pinned imports reproduce; catalog/direct-transport/diff checks pass. Thirty-six original AtomiX Java files and all prior protected engine/audit/node hashes remain unchanged. Evidence:build/localization/atomix-swap-validation.json (319source hashes), atomix-swap-protected-methods.json.

### Code Review

Summary: immutable display arguments and retained dialogs preserve raw drafts, quotes and financial callbacks. The original six-decimal calculations, routing, state selection and trade submission remain unchanged.
Findings: no new blocking issue in these display changes. Prior numeric admission/async-state/financial acceptance gates remain open; presentation tests do not certify a live trade.
Verdict: approve this localization change; overall release incomplete.

Remaining: AtomiX running swap/sweep progress, diagnostic content, consolidation/write resolution and residual errors; PandaPools/PandaDEX inner translations; existing financial/wallet/Inbox/NFT and API/accessibility gates; signed versioned builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## AtomiX operation and consolidation languages — 2026-10-17

Previous turn was progress. Rechecked the graph memory for the latest explicit Future Cash request and read KeyAudit.java: both CLASSIC64x3 and BLOCK128x4 audit families are already implemented and tested in the Pandamonium integration. Protected FutureCash/public-wallet-audit hashes remain unchanged. Release is still pending.

Reused scripts/adapt-pandamonium-wallet-error-languages.py and the AtomiX market adapter after inspecting operation callbacks, consolidation, MinimaHtlc, NodeApi and existing fixture tests. Added38 messages in English/Chinese/Russian/Ukrainian (4161total); generated OperationMessages handles11fixed statuses and18patterns, falling back to existing MarketMessages. Captured keys, transaction IDs and diagnostics remain literal. Swap/sweep progress, consolidation consent, preview title, preflight errors and submission outcomes translate at display boundaries. Raw status values, error callback strings, preview JSON, confirmation gates, token snapshots and persistence remain unchanged. Seventeen protected execution/calculation methods compare byte-identical; startSweep changes only the preparation toast. Original AtomiX engine files remain unchanged.

Validation:307AtomiX+9localization JVM tests passed, including4new mapping cases. All3debug builds and AndroidTest passed in32seconds. Four new Android cases cover both status panels, retained consolidation review for both markets/themes/all4languages, literal preview JSON and no-sign dryrun, four preflight failures with gate release/no persistence mutation. Initial four-case run had3passes/1layout-assertion failure; a diagnostic-only run reproduced it. Screenshot and line measurements showed trailing whitespace was counted beyond visible text. Corrected the test to Layout.getLineMax; the affected review case passed. Six executions,33distinct cumulative AtomiX Android cases. No production layout change was needed. Final installed APK hashes verified, screenshots saved/reviewed, disposable emulator stopped. No owner device/data, node, seed, signature or transaction was used.

All19pinned imports reproduce; catalog/transport/diff checks pass. Evidence build/localization/atomix-operation-validation.json (326source hashes). Preserved failed test logs and diagnostic screenshots.

### Code Review

Summary: message mappings affect display only; existing market fallback and literal diagnostic arguments are preserved. Callback/persistence/signing paths remain intact.
Findings: no new blocking issue in this change. Tests use public read-only fixtures and do not certify actual consolidation or trade execution.
Verdict: approve these display changes; release remains incomplete.

Remaining: AtomiX diagnostics, interrupted-write resolution, coin breakdown and residual errors; PandaPools/PandaDEX inner translations; existing financial/wallet/Inbox/NFT/API/accessibility gates; signed versioned builds, commit/push and authorized GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## AtomiX interrupted-write recovery — 2026-10-17

Previous turn was progress: operation/consolidation translations. Verified326 checkpoint hashes. Read integrated AtomiX WriteSafety/NodeApi and all14 original WriteSafetyTest cases, the identical standalone WriteSafety donor, PandaPools NodeApi acknowledgement implementation and ReserveRecoveryTest. Also inspected minimaWallet NftView.pendingSnapshot/pendingUnchanged and its reviewed retry callback plus NFT LocalStore expected-journal gate.

Reused PandaPools commitWriteAcknowledgement in AtomiX WriteSafety, retaining synchronization and restoring all four pending fields after a failed clear. A process latch now prevents new signing if the clear or rollback cannot be saved. Late replies cannot silently release a failed acknowledgement. A successfully saved explicit acknowledgement clears the latch. Added a reviewed-write identity argument to NodeApi/MainActivity: an old dialog cannot clear a newer active or interrupted write. No node command is issued by acknowledgement.

Fourteen new messages in all4languages (4175total) translate recovery entry, all4cause descriptions, command/age, consent and outcomes. Reused the established message mapper (2fixed/6patterns, bounded recursion, literal command data). Display text no longer asserts that callback failure means likely completion or that missing records exonerate the node; it states uncertainty and asks the user to inspect transactions/balances. Raw stored/logged legacy descriptions remain unchanged. Recovery action has48dp minimum height.

Validation:317AtomiX+9locale JVM tests pass, including6new persistence/consent tests and4mapper tests. All3debug variants/AndroidTest passed; final build14seconds. Four new Android cases passed in18.003seconds: four causes/alllanguages with retained evidence and cancel, explicit clear preserving unrelated settings, stale consent against newer active write, stale consent against newer interrupted write. Tests use only local public markers with stopped workers, no node dispatch, seed, signature or transfer. Four screenshots saved; Ukrainian callback/stopped dialogs reviewed. Final APK hashes verified; disposable emulator stopped, launcher terminal0.

Code-review clarification renamed a mock-persistence test and removed its simulated-static-reset step: it proves in-memory evidence/guard retention, not disk survival after process death. Affected JVM suite reran successfully. All19pinned snapshots reproduce; catalog/transport/diff checks pass. FutureCash public-wallet-audit and node jar unchanged. Two formerly protected original AtomiX Java files intentionally changed (WriteSafety and NodeApi);34original Java files remain unchanged. All changes are generated by the importer adapter. Evidence build/localization/atomix-recovery-validation.json (337source hashes).

### Code Review

Summary: failed acknowledgement stays paused, old consent is tied to its reviewed marker, and translated recovery text reflects uncertain outcomes.
Findings fixed: a failed SharedPreferences.commit could remove the marker from memory and permit a later write; an old dialog could clear a newer interrupted marker. Reused the tested PandaPools persistence guard and minimaWallet expected-state pattern. No remaining blocking finding in this change. Physical disk-failure survival and real transaction outcomes are not certified by these tests.
Verdict: approve this recovery change; overall release incomplete.

Remaining: AtomiX diagnostic report content, coin breakdown and residual errors; PandaPools/PandaDEX inner translations; existing financial/wallet/Inbox/NFT/API/accessibility gates; signed versioned builds, commit/push and authorized GitHub fork/PandaApps/eurobuddha.com publication. Candidate1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## AtomiX diagnostic reports and coin breakdown — 2026-10-17

Previous turn was progress: recovery localization and acknowledgement fixes. Verified337source hashes. Inspected MainActivity.minimaCoinDump/showReport/checkNow, MinimaHtlc tokenBalance/guardedCoinRead/coinAmount/broadcast callbacks, SwapEngine inspect/reportInspection/recordedTxnSummary, the submission-before-acknowledgement path, refund sweep and responder POSTED handling, InspectionStatusTest and existing report UI tests. Reused Language.TextBuilder from identity/OTC displays and the established diagnostic mapper.

Added47messages in all4languages (4222total): report direction/status, hashlock, lookup depth/failure, own/counterparty legs, lock/refund timing, bounded-scan caveats, secret availability, recorded transactions, RPC failure and coin breakdown/read-limit fallback. ReportMessages has28fixed phrases (including6existing status aliases) and17templates. Nested known status text translates; raw amounts, token symbols, addresses, hashes, event identifiers, warnings and unknown diagnostics stay literal. Both reports use immutable language bindings, preserving the existing selectable text and scroll views.

Corrected a misleading financial diagnostic: recordedTxnSummary(0) asserted nothing was locked and nothing needed refunding. The code saves the row/secret before broadcast and only records a transaction id in PostCb.ok; a lost reply can therefore leave zero recorded IDs after broadcast. New summary states that the outcome requires on-chain verification. Updated the existing regression that wrongly required the reassurance. SwapEngine is byte-identical otherwise (including settlement/signing/refund logic).

Validation:321AtomiX+9locale JVM tests passed, including4new mapper cases; existing4InspectionStatus tests pass with corrected evidence expectation. All3debug variants and AndroidTest build passed in22seconds. A test-APK-only rebuild included the inspected existing tidyAmount behavior (leading zeros preserved). Four new Android cases passed in21.847seconds: retained nested reports/full IDs/raw warning text/both themes, coin breakdown for both markets/full addresses/tokenamount sum, oversized replies stopping before coin reads and opening consolidation review without signing, and literal read failure without coin query. Seven screenshots saved; representative layouts reviewed. Final APK installation hashes verified; disposable emulator stopped and launcher terminal0. No owner device/data, node, seed, signature or transfer.

All19pinned imports reproduce; catalog/transport/diff checks pass. All34remaining original AtomiX Java files, previous recovery guards, FutureCash/public-wallet-audit and node jar unchanged. Evidence build/localization/atomix-report-validation.json (346source hashes).

### Code Review

Summary: display-only localization preserves raw evidence; the zero-acknowledgement summary now matches the actual broadcast/callback lifecycle.
Finding fixed: absent local transaction IDs were presented as proof that funds were never locked. The corrected summary requires chain verification; source and regression agree. No new blocking finding in this change. Public-fixture UI tests do not certify real settlement.
Verdict: approve these diagnostic changes; release remains incomplete.

Remaining: AtomiX residual labels/errors and financial gates; PandaPools/PandaDEX inner translations; existing wallet/Inbox/NFT/API/accessibility gates; signed versioned builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Residual MainActivity inventory: identity error toast~698, halted toast~1140, raw node-no-answer balance placeholder~721, swap-card error text~3346. Larger existing financial gates remain separate. Candidate1.9.42/vc113 is still uncommitted and unpublished. Goal active.


## AtomiX guided swap amount entry — 2026-10-17

Previous checkpoint completed diagnostic reports and corrected missing-transaction evidence. Rechecked all 346 source hashes. Inspected standalone AtomiX MainActivity conversion/slippage methods and the integrated MarketDraft, MinimaHtlc.grain/isDecimal, OTC amount adapter, SwapEngine initiator methods, MainActivity quote/review/take/startLeg/sweep paths, MarketDraftTest, AmountGrainTest and AtomixSwapLanguagesTest. Reused MarketDraft.number unchanged, existing MinimaHtlc.grain unchanged, and the market editor's post-show validation listener.

Changes are contained in MainActivity through adapt-pandamonium-atomix-swap-inputs.py. Guided quotes reject malformed, nonfinite, underflowed and zero-after-grain amounts, invalid prices and overflowed/zero results. ComputeUsdt/computeMinima use the existing six-decimal input grain so previews and review agree with executable precision. The buy review shows the grained outgoing USDT amount. Maker-take confirms the same grained input used by its preview; invalid values, below-minimum or over-cap entries preserve the dialog and selection. Review/CTA/sweep admission rejects invalid targets; sweep quotes, capacity and total checks reject nonfinite arithmetic. Existing floor-on-sell and ceil-on-target-buy rules remain.

Slippage parsing reuses checked plain decimals. Invalid/empty entries keep the dialog, draft, selection and saved preferences; translated inline validation stays bound during language changes. Valid values retain the existing 0.1–50 percent clamp. NaN/Infinity cannot be saved through the setter. Invalid/out-of-range stored floats read as the existing 4.2 percent default without rewriting storage.

Validation:321 AtomiX + 9 locale JVM tests pass. All 3 debug variants and AndroidTest build passed in 11 seconds. Nine Android cases pass: 5 new amount/draft/preference cases plus all 4 existing swap language/review/sweep/slippage cases. New cases cover plain syntax, zero-grain and overflow boundaries, direction-specific rounding, all 4 languages retaining invalid drafts/cursors/preferences, maker cap/minimum rejection without submission, no plans for invalid targets/slippage, grained review amounts, damaged preferences and retained clamp behavior. Three Ukrainian screenshots inspected. APK installation hashes verified; only disposable emulator-5580/Bears_Languages_API36 used, then stopped. No owner devices/data, node, seed, signature or transfer.

All 19 pinned imports reproduce; catalog (4,222 messages), transport and diff checks pass. Only 2 of the 346 prior tracked sources changed (MainActivity and adapter registration), plus the 2 new adapter/test sources, total 348. FutureCash classic/block key audit, minimaWallet public-key audit, SwapEngine, all other protected engines and node jar remain unchanged. Evidence:build/localization/atomix-swap-inputs-validation.json.

### Code Review

Summary: reused existing decimal checks, grain and retained-dialog pattern; no engine/wire changes. Quotes and review now agree on executable precision, and invalid forms preserve user state.
Findings fixed: zero-value rounded legs could be quoted; huge decimal input could reach double-based planning; invalid slippage silently became a default and closed the dialog. Source and public-fixture regressions cover these changes. No new blocking issue found in this bounded change.
Verdict: approve this input change. Engine-level admission, consent freshness and real settlement remain separate release gates; no financial execution is certified by these UI fixtures.

Remaining: AtomiX residual labels/errors and remaining financial gates; PandaPools/PandaDEX inner translations; wallet/Inbox/NFT/API/accessibility gates; signed versioned builds, commit/push and publication to GitHub fork/PandaApps/eurobuddha.com. Candidate 1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## AtomiX remaining message boundaries — 2026-10-17

Previous turn made progress: guided swap amount validation and retained invalid drafts. Revalidated all 348 checkpoint source hashes. Reused AtomixMessages and its declared fixed-message tests, the existing halted OTC message, ETH-key fixed safe error pattern, Language.join and TextBuilder. Read raw balance callers, Util.fmt5/tidyAmount, swapErrorNote, SwapDb event storage/normalization and existing history/report fixtures.

Added two messages in all four languages (4,224 total): missing node balance response and trading identity creation failure. MainActivity differs from the prior checkpoint at exactly five display boundaries: identity error, halted warning, wallet balance placeholder, coin-report balance placeholder and known swap-error note. Raw balance strings and event notes stay unchanged; unknown diagnostics remain literal. Identity failures now display a fixed safe message instead of an exception that could contain key material. AtomixMessages has 44 fixed entries and the same 24 templates.

Validation: 321 AtomiX + 9 locale JVM tests pass; all three debug variants and AndroidTest passed in 22 seconds. Four distinct Android cases pass (three new), five executions total. The first run passed balance/report checks but failed fixture cleanup because the test used a 0x-prefixed hash while SwapDb stores bare hashes. Corrected only the test cleanup to match the inspected normalization; rebuilt the test APK in 2 seconds and reran only that case, passing in 4.263 seconds. The original failure log is retained. Checks cover both markets/themes, all four languages, unchanged raw balance/numeric formatting, retained view/report bindings, translated known errors, literal unknown errors and unchanged stored notes. Five screenshots saved; light missing-balance card, known error and full coin report inspected. Final installed APK hashes verified; disposable emulator stopped. No owner devices/data, real node, seed, signing or transfers.

All 19 pinned imports reproduce; catalog/transport/diff checks pass. All protected engine and node-jar hashes, FutureCash classic/block audit and minimaWallet public-key audit remain unchanged. Evidence: build/localization/atomix-residual-validation.json (349 source hashes).

### Code Review

Summary: five explicit display replacements preserve underlying financial values and diagnostic evidence. Exact before/after comparison proves the bounded MainActivity change.
Findings: no new blocking issue in this change. The test cleanup mismatch was corrected after inspecting SwapDb.norm; production database code was unchanged. The existing full-fixture settlement limitations still apply.
Verdict: approve these display changes; the overall release remains incomplete.

### Next work: PandaPools and PandaDEX

Queried the existing graph with its actual vocabulary: panda, pools, dex, localization, language (1,200-token traversal, truncated; no broad completeness claim). Located PandaPools MainActivity at app/src/main/java/com/eurobuddha/pandapools/MainActivity.java:L42, PoolsView:L26, MyLpView:L33, SwapView:L29. Read PandaDEX AGENTS.md: preserve native parity and never automate the real-device composite interop gate. No changes to either app yet; reuse inspection is still in progress.

PandaPools integrated UI inventory: MainActivity 550 lines, MainPager 52, Ui 133, BaseView 44, PoolsView 196, SwapView 432, MyLpView 1,927, WalletView 559, ActivityView 520. MainActivity still sets the LIQUIDITY POOLS subtitle directly. Need read complete relevant candidates, resources, callers and tests before editing. Continue with shell/navigation and all inner tabs, then PandaDEX. AtomiX financial admission/consent gates, wallet/Inbox/NFT/API/accessibility checks and signed versioned builds/publication remain outstanding. Candidate 1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## PandaPools shell and registry languages — 2026-10-17

Previous turn made progress: remaining AtomiX display messages and graph discovery of PandaPools entry points. Revalidated all 349 source hashes. Read the complete PandaPools MainActivity, MainPager, BaseView, Ui, PoolsView, Pool and PoolRepository; relevant VirtualCurve/PoolRouter aggregate methods, NodeApi lifecycle, layouts, Casino retained-page adapter and tests, Language binding/update API, shared-copy callers and standalone candidates. Standalone Ui, MainPager, Pool and PoolRepository matched the inspected integrated files exactly. The earlier graph traversal located the actual native entry points; no MDS parity substitution.

Reused Casino/Parlons bindings and resource generation. Added 43 messages in four languages (4,267 total), including a pool-count plural. PandaPools now retains its existing five pages while translating tab titles, header, node availability, theme action/guard, scan controls/status/errors, empty states, individual/combined pool cards, reserve/price/depth/fee labels, and shared identifier copy feedback. Token names, identifiers, amounts and captured node errors remain literal. Language changes rebind titles and views without rebuilding pages or refreshing discovery. XML action targets are at least 48dp. Existing theme recreation behavior is unchanged.

Five existing Java files and two layouts changed. All 141 other baseline files remain byte-identical, including the transaction, pool, router, covenant, recovery, persistence and node code. MainPager only widens titles to CharSequence; BaseView binds tagged XML after inflation. Ui copies the same full value and resolves the application label at click time. Pool card computation is unchanged; only its labels and composed display values use language bindings.

Validation: 302 PandaPools + 9 locale JVM tests pass, including two new fixed-label/literal-data tests. Initial test compilation failed because PandaPools' own Files class shadowed java.nio.file.Files; qualified the test API, retained the failed log, then all three debug variants and AndroidTest passed in 16 seconds. Four new Android cases passed in 23.679 seconds: all three themes retain page identities, Swap draft/cursor and selected tab; individual/combined cards preserve fixture reserves/prices/totals and literal token names; full pool and transaction identifiers copy exactly with translated labels; empty/error states and raw diagnostics rebind across all four languages. Counting repository recorded no language-triggered scans. Nine screenshots saved; representative shell/card layouts inspected. Installed hashes verified; isolated emulator stopped. No owner devices/data, real node, seed, signatures or transfers.

All 19 pinned imports reproduce; catalog/transport/diff checks pass. AtomiX, all prior protected engines, FutureCash dual-key/public-wallet audit and node jar unchanged. Evidence: build/localization/pools-languages-validation.json (363 tracked source hashes plus 141 unchanged PandaPools baseline files).

### Code Review

Summary: explicit application-text bindings preserve user token names and financial values. Existing pages, listeners, drafts and selection remain in place on language changes; the callback does not request a pool refresh.
Findings: no new blocking issue in this bounded shell/registry change. Test file-reader name collision corrected; production filesystem code unchanged. Tests cover display and state retention, not financial execution.
Verdict: approve this checkpoint; the full multilingual release remains incomplete.

Remaining: PandaPools Swap, My LP, Wallet, Activity, dialogs, exports and keeper notifications; PandaDEX inner screens; previously documented AtomiX financial/consent, wallet/Inbox/NFT/API/accessibility gates; signed versioned builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication. Candidate 1.9.42/vc113 remains uncommitted and unpublished. Goal active.


## PandaPools Swap languages — 2026-10-17

Previous checkpoint completed the shell and registry. Revalidated all 363 prior source hashes. Latest user request about Future Cash was checked against graph memories and DualKeyAuditTest: already implemented in the Pandamonium candidate, ten dedicated tests passing in the existing report; all public-wallet audit hashes remain unchanged. Do not redo this completed work. No standalone donor edits.

Read SwapView, MarketPrice, PoolRouter and its full tests, ActivityLog status logic, NodeApi uncertain-write text, the Swap XML, shared LanguageDialog, Casino dialog lifecycle adapter, PoolsView wrapping and existing device fixtures. Standalone MarketPrice, ActivityLog and PoolRouter match exactly; SwapView differs only by imported resource names before this change. Reused these proven blocks. New scripts/adapt-pandamonium-pools-swap-languages.py runs at the end of the existing pools language adapter.

Added 44 messages in all four languages (4,311 total): pay/receive, pool/depth counts, balance, market comparison, quote/routing/cap/fee, confirmation, posting/error/submitted feedback and inline activity status. Pool counts and confirmation depths use plurals. Review dialogs reuse LanguageDialog and Casino lifecycle tracking, retaining their route/direction, listeners and open state. Existing inputs, cursor, token names and numeric formatting remain unchanged. Literal token assignments explicitly clear the placeholder binding, including a real token named token. Language changes do not recompute quotes, fetch markets or scan pools. Quote rows reuse PoolsView's wrapping widths. Inline activity summaries no longer clip at three lines; status columns have a 150dp cap. No stored activity, transaction callbacks, funding/routing, covenant, recovery, market fetch or node code changed.

Validation: 302 PandaPools + 9 localization JVM cases pass. All three debug builds and AndroidTest pass in 18 seconds. Four new Android cases pass in 22.852 seconds: both directions and an eight-pool capped route retain draft/cursor/row identities and the open review through all languages; market at/above/below/unavailable states preserve captured values without fetching; ten evidence/status fixtures retain raw summaries and chain decisions; empty/error/posting/submitted states retain full identifiers and raw diagnostics. No valid swap approval, node, seed, signature, broadcast or owner device/data. Six screenshots saved; representative review/quote/activity layouts inspected. A final XML whitespace cleanup rebuild passed in two seconds and produced the exact same app/test APK hashes as those installed and tested. All 19 pinned imports reproduce. Catalog, transport and diff checks pass. Emulator stopped and launcher terminal 0.

Evidence: build/localization/pools-swap-validation.json, 367 source hashes, 139 unchanged PandaPools baseline files and all prior protected engine/public-audit hashes preserved. Mapper now has 69 fixed labels. Four new Android cases bring cumulative PandaPools coverage to eight.

### Code Review

Summary: display changes use existing retained bindings and keep raw identifiers, captured values and persistence intact. Dialog references are removed on dismissal and dismissed on activity destruction. Activity status pluralization preserves the existing failed/verified-depth priority.
Findings: XML serialization introduced trailing whitespace; adapter corrected and imports/build hashes rechecked. No blocking issue found in this bounded translation change. Financial execution and broader consent freshness remain outside this display test coverage.
Verdict: approve this checkpoint; the full multilingual release remains incomplete.

Next: PandaPools My LP, Wallet, Activity tab, remaining dialogs, export and keeper text; PandaDEX inner localization; earlier financial/consent/evidence/API/accessibility gates. Signed versioned builds, commit/push and publication remain outstanding. Baseline 1.9.41 commit 9def96e6801a9bef261611e45349f28a1eb6ae1c; candidate 1.9.42/vc113. Publish only GitHub fork eurobuddha/minima-core-android, PandaApps and eurobuddha.com. No S23 or owner data, no minimaDesk, no subagents. Goal active.


## PandaPools Wallet and Activity languages; Fold-only constraint — 2026-10-17

Previous turn made progress on Swap. Revalidated all 367 prior source hashes. Read complete WalletView/ActivityView, TokenBalance and its tests, ActivityTimeline tests, PoolActivity tests, relevant HistoryEntry/ActivityLog/PoolHistorySync display methods, both layouts, PandaAddrBook/Coin, shared Language date/text builders, History and AtomiX report adapters, and existing UI copy code. Standalone ActivityView matches after resource-prefix adaptation; WalletView differs additionally only by the previously adapted embedded-node instruction. TokenBalance, HistoryEntry, PoolHistorySync, ActivityTimeline and WalletTools match standalone sources.

Added 98 messages in four languages (4,409 total). Reused History date/direction bindings, AtomiX immutable report composition, shared LanguageDialog and existing clipboard logic. Wallet now translates balance cards, receive/actions, breakdown/freshness, detail/coin tags/errors and links. Raw metadata (including a token named Sendable), numeric precision, coin IDs, amounts and token IDs remain literal. Activity translates personal/public scopes, pending receipts, details, verified statuses and explicitly unverified local observations, keeping exact hashes, transaction/submission times and persisted evidence unchanged. Existing dynamic pages/dialogs are retained across language changes. Ui.copy extracts the existing clipboard body so copy-all reads the current result on every tap instead of replacing its own listener and capturing the first result. Public data only; no secret clipboard path changed.

Validation: 302 PandaPools + 9 localization JVM tests pass. Three debug variants and AndroidTest built in 11 seconds. All 19 pinned imports reproduce; catalog/transport/diff checks pass. 136 remaining PandaPools baseline files, all previously protected financial/evidence engines, FutureCash public/dual-key audit and node jar are unchanged. New mapper:154 fixed labels and4 patterns. Evidence build/localization/pools-wallet-activity-validation.json includes372 source hashes.

Five new Android cases were run before the device instruction: four passed (balances/token detail/receive copy; current coin report and repeated copy; all unverified observation kinds; failed balance read preserving cached amounts and timestamp). Receipt/detail test passed its first multilingual receipt portion, then failed its test-helper count because it dismissed one dialog and opened another in the same UI callback before the asynchronous dismiss callback removed the old reference. Corrected test to wait for idle between dialogs; corrected AndroidTest built in2seconds. Production source unchanged by this fix. The corrected case has NOT been rerun. Do not claim all five pass. Device log retains the failure. Seven intended screenshots exist only partially inside the now-stopped emulator and were not pulled, so no visual review is claimed here.

### Authoritative device instruction

User said: “adb device connected”, then “only work on the fold”. Effective immediately, target ONLY Fold serial R3GL805K7MB, verified model SM-F971B, Android API37. The emulator was stopped immediately, launcher returned0, and no rerun was started. All other physical devices and emulators are excluded; prior emulator authorization is superseded. Read-only Fold inventory confirmed installed com.eurobuddha.pandamonium version1.9.41-Pandamonium/versionCode112. No Fold app install, launch, state/data change or node action occurred. The other connected phone was not operated. Use --user0 for personal-profile package listings; Samsung's other profile is restricted. ADB commands need escalation to access the existing server in this environment; do not reset the global ADB server.

The current disposable instrumentation fixtures disable AppLock and assume no seed/node plus ranchu hardware. Do NOT run them on the owner Fold or remove these guards to make them run. Continue host build/review work; further device validation must preserve Fold app data, wallet state and signing identity. Do not install a debug APK over the signed1.9.41 production app.

### Code Review

Summary: adapters change display composition, copy refresh behavior and layout widths; persisted schemas, coin classification, node command strings, transaction evidence and balance arithmetic are preserved. Unknown diagnostics and raw token metadata stay literal.
Findings: initial Unicode-punctuation adapter match corrected before generation. Coin-list copy no longer captures a stale first result. One device-test timing assertion corrected but not rerun due to the new device restriction; visual review pending.
Verdict: request remaining device/visual validation before calling this checkpoint release-ready.

Next: finish PandaPools My LP, WalletTools/recovery, export/keeper translations and PandaDEX inner screens; prior financial/consent/evidence/accessibility gates. Complete data-preserving validation on Fold only. Signed versioned1.9.42/vc113 builds, commit/push and GitHub fork/PandaApps/eurobuddha.com publication remain outstanding. Goal active; no release claimed.


## PandaPools wallet tools and reviewed recovery — 2026-10-17

Device constraint remains ONLY Fold R3GL805K7MB / SM-F971B. No ADB operation, emulator, other device, install, launch, app-data change or node action occurred this turn. Owner Fold remains untouched.

Revalidated all372 prior checkpoint sources before editing. Read WalletTools, NodeApi recovery/dispatch/callbacks, AtomiX recovery adapter and WriteAcknowledgementTest, PandaPools failed-clear regression, tracked MainActivity dialogs and LanguageDialog. Reused AtomiX expected-marker consent check and existing PandaPools durable clear/rollback latch; reused tracked themed language dialogs. Added15 catalog messages (4,424 total;168 fixed PandaPools labels) for node checks, consolidation review/results and interrupted-write recovery. Raw commands, token names/IDs, stored English receipts and transaction admission logic are preserved.

Recovery fix: capture the reviewed pending-write marker and node when opening the dialog; refuse acknowledgement if that marker changed or a write is active. Failed preference commits retain the existing process latch and rollback path. Six JVM regressions cover matching reviews, stale/removed/new markers, active writes, missing consent, failed-save latch preservation, failed commits and throwing rollback. No new dependencies.

Validation:308 PandaPools +9 localization JVM tests pass (317). All three debug variants and AndroidTest compile. All19 pinned imports reproduce; catalog, transport and diff checks pass.134 remaining baseline PandaPools files and all previously protected financial/audit engines and node jar remain unchanged. Evidence: build/localization/pools-tools-validation.json,377 source hashes. No current device-test or visual-validation claim.

### Code Review
Summary: reviewed the generated WalletTools, NodeApi, MainActivity dialog overload, mapper/resources and new regression tests. Recovery consent is now tied to the reviewed marker; storage failure behavior and financial command paths remain intact.
Findings: no additional correctness issue found in this change. Dialog theme/layout/language retention still needs Fold validation; previous receipt-test timing correction remains unexecuted.
Verdict: host checks pass; request remaining Fold validation before release.

Outstanding goal work unchanged: remaining integrated-app translations and financial/evidence review, safe Fold validation, signed versioned release, commit/push and publication to GitHub fork/PandaApps/eurobuddha.com. No release claimed.


## PandaPools My LP overview languages — 2026-10-17

Previous goal turn made progress (wallet-tool translations and reviewed-write recovery guard). This turn revalidated377 source hashes. Device constraint remains ONLY Fold R3GL805K7MB / SM-F971B. No ADB, emulator, phone install, launch, data change or node action occurred.

Read MyLpView overview/cards and shared helpers, backup/interrupted-withdrawal/collection cards and discoverability handlers, LpStore, PoolTest, shared Language/LanguageDialog, existing Wallet/Activity adapter, XML and relevant callers. Compared standalone MyLpView to integrated: equivalent after resource IDs and embedded file-provider authority. Reused existing calculations/ownership/storage/actions and native Language bindings. Added58 messages (4,482 total;215 fixed PandaPools mappings) for summary, pending creation, pool value/fee/age/health cards, owner-signing pause, missing reserves, closed-pool list and navigation buttons. Full pool/owner identifiers and raw token names/amounts remain literal. Closed-pool dialog uses tracked LanguageDialog and immutable TextBuilder; existing restore/bring-back callbacks remain unchanged. Buttons retain their actions and get48dp minimum height.

Initial adapter's regex incorrectly consumed a literal plus sign in priceMove; compiler caught it before any device execution. Fixed by tokenizing Java strings/comments before joining adjacent string literals. Comment text is preserved. Corrected generated source was reviewed, including exact price/fee/IL math, original positive/negative sign expression, raw metadata and callbacks. No financial/storage engine changes.

Validation:308 PandaPools +9 localization JVM tests pass (317). Three debug variants and AndroidTest compile in16seconds. All19 pinned imports reproduce; catalog/transport/diff checks pass.132 remaining baseline PandaPools files and prior protected financial/audit engines/node jar unchanged. Evidence: build/localization/pools-lp-validation.json,380 source hashes. No device-test or visual-validation claim.

### Code Review
Summary: display bindings retain existing calculations, node commands, pool ownership and recovery actions. Language-aware closed-pool dialog preserves captured identifiers.
Findings: malformed literal expression from initial generation corrected; no further change defect identified in source/build checks. Fold visual/language-switch validation still pending.
Verdict: host checks pass; request safe Fold validation before release.

Next: My LP backup/proofless/interrupted-withdrawal/pending-collection cards and discoverability/republish, financial forms, recovery/export/calculator, detailed owner-key messages, PandaDEX; prior financial/evidence/accessibility gates. Previous disposable tests remain emulator-guarded; do not remove their guards or run on owner app. Need a data-preserving Fold validation path. Signed versioned release and commit/push/publication to GitHub fork/PandaApps/eurobuddha.com remain outstanding. Goal active.


## PandaPools My LP notices and backup results — 2026-10-17

Previous turn made progress (My LP overview). Revalidated380 source hashes. Fold-only constraint unchanged: ONLY R3GL805K7MB / SM-F971B. No device/emulator/ADB operation, install, launch, node, wallet or app-data change this turn.

Read current backup/proofless/interrupted-withdrawal/pending-collection/discovery/republish handlers, complete BackupState and BackupStateTest, PendingCollect, ExitStore state/record paths, CollectSweeper and CollectSweeperTest, PoolManager.refresh/ownerSignPost, doBackup, existing recovery guide and ActivityLog confirmation distinction. Standalone MyLpView had already been compared to pinned/integrated source; current financial engines stay unchanged. Reused native Language bindings, current guide's signing-state/proof requirements, existing verified-export cleanup, and existing transaction-label resource.

Added37 messages (4,519 total;250 fixed PandaPools mappings) covering the remaining overview notices, discovery/republish and doBackup results. Language-aware info dialog retains selectable message text; backup action buttons share width and republish remains wrapped/reachable. Raw public addresses/TxPoW IDs, persisted states/diagnostics and command strings stay literal; known diagnostics use the existing mapper at display boundaries. Clipboard label IDs remain raw, translated only by Ui.copy.

Correctness: Back up again no longer clears backup_proofless before a save. The only clearing call remains in clearProoflessWithProofs after the existing read-back verification; cancellation/failure retains the reminder. Copy now reflects actual evidence: BackupState only knows its verified recipe-export record, not external wallet backups; a changed recipe digest is described as changed, not proof that every older backup is unusable; absence of local reserves does not establish a successful withdrawal; a queued collection and submitted refresh do not establish confirmation; fresh reserve age only suggests discoverability. Backup success no longer promises that seed plus a filled-in counter safely reconstructs owner signing. It reuses the current guide: current complete wallet backup, recipes, known current signing state, stop other signing copies, and available archive/fresh proofs as needed. Removed the default64-address assumption from visible collection recovery advice. No signing/admission/storage engine changed.

Validation:308 PandaPools +9 localization JVM pass (317), including existing backup read-back/digest and collection-state suites. All three debug variants and AndroidTest compile in33seconds. All19 pinned imports reproduce; catalog/transport/diff checks pass.132 remaining PandaPools baseline files and previously protected financial/audit engines/node jar unchanged. Evidence build/localization/pools-notices-validation.json has381 source hashes. No new device execution or visual claim; cancellation marker fix checked in source only, pending Fold behavior test.

### Code Review
Summary: reviewed each generated view change and source adapter. New notices preserve captured IDs/diagnostics and distinguish pending from verified state; file selection/serialization/read-back and all transaction callbacks remain unchanged. The only behavior change removes premature reminder cleanup.
Findings: preserved clipboard String label IDs during generation before compilation. No additional defect identified by source and host checks. Fold layout/language-switch and save-cancellation behavior remain unverified.
Verdict: host checks pass; request safe Fold validation before release.

Next: My LP create/add/migrate/close forms, recovery/restore dialogs, export/calculator, detailed OwnerKeyRecovery/backup diagnostics, PandaDEX and earlier financial/evidence/accessibility gates. Need data-preserving Fold validation; keep all disposable fixture guards. Signed versioned release, commit/push and GitHub fork/PandaApps/eurobuddha.com publication remain outstanding. Goal active.


## PandaPools recovery dialogs and report bindings — 2026-10-17

Previous turn made progress (notices/backup results). Revalidated381 source hashes. ONLY Fold R3GL805K7MB / SM-F971B remains authorized for device work. No device, emulator, ADB, install, launch, node, wallet or app-data operation occurred.

Read recovery/archive/signing-confirmation/file-check/restore/result/guide sections, ArchiveNode validation/transport, OwnPoolStore acknowledgement, RestoreExit submission/cap/refusal paths, related refusal tests, BackupCheck read-only command boundary, Language/TextBuilder tests and AtomiX report adapter/tests. Reused scripts/adapt-pandamonium-atomix-report.py line composition, existing native LanguageDialog, shared copy helper and existing Save/Copy resources. No new dependencies.

Added54 messages (4,573 total;297 fixed PandaPools labels and5 patterns). Recovery menu labels, archive settings, owner-key picker/confirmation, save-after-create prompt, backup-check wrapper, restore confirmation/results and recovery guide now bind translated messages. Actual archive input, selected keys/files, command strings and callback ordering are unchanged. Raw backend reports/logs remain intact; PoolsMessages.report composes translated recognized lines while preserving unknown text, CR/LF separators, blank lines and full identifiers. Copy reads the current displayed report using Ui.copy. Existing lowercase backup-check clipboard alias already localizes its caption; an attempted redundant alias addition stopped on an assertion before changing anything, so no extra mutation/rebuild was required.

Corrected display claims: save-after-create is submitted/pending rather than already live; restore confirmation describes attempted withdrawals and known checks without promising safe signing or inevitable unrecoverability; submitted withdrawal callbacks are not presented as confirmed wallet receipt. Restore result computes notSubmitted=max(skipped,verified.size()-withdrawn), so pools outside MAX_PER_RUN remain counted. Backend cap, signing/withdrawal authority, counters, file checks and persistence are unchanged. A display-only mapper converts legacy “Withdrawn ✓ <id>” progress to submitted wording, preserving the original raw log and IDs.

Validation:310 PandaPools +9 localization JVM pass (319). Two new tests reuse AtomiX literal-evidence checks: submitted state/identifier preservation through multiline reports, and unknown text/whitespace/CRLF/blank lines/null-empty handling. All three debug variants and AndroidTest compile in25seconds. All19 pinned imports reproduce; catalog/transport/diff checks pass.132 baseline PandaPools files and prior protected financial/audit engines/node jar unchanged. Evidence build/localization/pools-recovery-validation.json has384 source hashes. No device/visual claim.

### Code Review
Summary: reviewed generated dialog/report changes. Current-language copy reads the rendered text; messages snapshot report contents while raw logs and identifiers remain intact. Existing state transitions and action callbacks are preserved.
Findings: report Copy uses wallet.copy and existing Ui clipboard alias. Detailed backend diagnostics remain untranslated unless already recognized. Fold lifecycle/layout/form retention and result-count behavior require device validation.
Verdict: host checks pass; request safe Fold validation before release.

Next: My LP create/add/migrate/close/collection forms, statements/calculator, detailed BackupCheck/Recovery/OwnerKeyRecovery/RestoreExit diagnostics, PandaDEX and earlier financial/evidence/accessibility gates. Preserve all disposable fixture guards. Signed versioned release, commit/push and publication to GitHub fork/PandaApps/eurobuddha.com remain outstanding. Goal active.


## PandaPools create-pool languages; Fold only — 2026-10-17

Revalidated384 source hashes at start. User restriction remains ONLY Fold R3GL805K7MB / SM-F971B. Read-only serial-specific adb get-state returned device. No emulator or other device operated; no Fold install, launch, app data, node, wallet or signing changes. Keep disposable fixture guards and never install debug over the signed owner app.

Reused scripts/adapt-pandamonium-pools-swap-languages.py, shared Language/TextBuilder and LanguageDialog with existing hint/draft and immutable-composition tests. Read complete create flow in integrated MyLpView and verified identical create section in build/localization/pinned-sources/pandapools/app/src/main/java/com/eurobuddha/pandapools/MyLpView.java. Read PoolManager creation admission and preserved all math, rounding, guards, node commands, callbacks, persisted receipts and source tags. The adapter binds views in place and changes only hints, never input text or check state. Existing shared Create/Back/Cancel/Error/Continue resources are reused.

Added53 messages (4,626 total), with31 exact local create labels in localization/pools-create-messages.json. Local mapping avoids applying generic labels to unrelated raw strings. New scripts/adapt-pandamonium-pools-create-languages.py is appended after recovery adapter; tokens distinguish Java strings/comments and literal plus signs. Global PoolsMessages mapping unchanged. My LP create obligations, token selection, priced/manual forms, input hints, balance/price previews, confirmation and submission status now bind all four languages. Unknown oracle source labels, token names, amounts and IDs remain literal.

Backup copy now asks for both recipe and current complete wallet backup and does not promise seed-only/counter-based recovery. Keep-alive interval uses PoolRefresher.REFRESH_BLOCKS. Battery exemption no longer promises uninterrupted execution; no-token message describes the balance read instead of assuming definite wallet emptiness; review describes reference price instead of exact market matching; submission wording explicitly awaits confirmation. Underlying finance and acknowledgement behavior unchanged.

Validation:310 PandaPools +9 localization JVM pass (319). All three debug variants and AndroidTest compile in 23seconds. All19 pinned imports reproduce; catalogue, transport and diff checks pass.132 remaining baseline PandaPools files, all prior protected finance/audit files and node jar unchanged. Evidence build/localization/pools-create-validation.json has386 source hashes. No device execution or visual claim.

### Code Review
Summary: reviewed generated create flow and shared bindings. Language changes retain existing views, listeners and immutable preview snapshots. Arithmetic and persistence unchanged.
Findings: Fold form/layout/language-switch validation remains pending. Separately, a MAJOR pre-existing release blocker was verified: collectAfterClose queues payout immediately after posting and runs sweeper after20s; CollectSweeper clears on zero coins without confirming withdrawal or payout arrival. RestoreExit also queues at posting. A pre-confirmation empty address can lose durable tracking. This checkpoint does not fix the collection engine; inspect existing durable evidence patterns and add meaningful delayed-arrival tests before changing it.
Verdict: create display host checks pass; release blocked pending collection fix and remaining release validation.

Next: fix collection completion evidence after reuse inspection; localize add/migrate/close/collect, statements/calculator and detailed recovery diagnostics; PandaDEX and earlier financial/accessibility work; safe Fold validation; signed versioned release, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. Goal remains active.


## PandaPools withdrawal collection evidence — 2026-10-17

Previous turn made progress (create forms). Revalidated386 source hashes. Fold-only restriction remains R3GL805K7MB / SM-F971B. No ADB, device, emulator, install, launch, wallet, node or signing operation occurred.

Reuse inspection: read PendingCollect, CollectSweeper, PoolManager close/forward/signing, TxPost, ActivityLog identity/confirmation, ReceiptRecovery, HistorySync/HistoryDb, worker caller and existing collection/transaction tests. Standalone apks/pandapools PendingCollect, CollectSweeper, TxPost and ActivityLog were identical to the imported candidates. Reused NFTwallet TransactionRecovery bounded history scan, TransactionEvidence.inclusion strict block/tip/depth check and existing Mockito5.12 host test harness. Read local core txnlist/TxnRow, txnsign/txnbasics/txnpost and TxPoWGenerator identity handling: txnlist returns the named row's transactionid, txnbasics calculates it and mining changes the TxPoW ID. No node jar or standalone donor mutation.

Added explicit scripts/adapt-pandamonium-pools-collection.py after language adaptations; canonical CollectionEvidence.java and CollectConfirmation.java under scripts/pandamonium-sources/pandapools. A close-only TxPost.BeforePost hook runs after existing txncheck and before txnpost. It reads the exact draft handle and commits immutable transaction identity to PendingCollect. Failed read/save refuses broadcast; signing admission, command math, owner exemptions and transaction queue remain unchanged. The journal therefore survives a crash/lost post reply before UI callbacks can add tracking.

PendingCollect retains all expected transaction IDs for an address, including multiple withdrawals. History matching uses exact transaction equality, with a four-page bounded scan and persisted cursor for background recovery; ActivityLog.observeHistory also supplies candidates. Candidate IDs alone cannot clear. CollectSweeper requires fresh onchain evidence for every expected withdrawal (depth>=3 and consistent tip/block/nonzero block ID), then re-reads payout balance. Clearing compares the complete original persisted snapshot so a newer withdrawal or changed evidence cannot be erased by a stale callback. Failed commits restore old memory state. Attempts preserve journal fields.

Strict balance parsing rejects missing/non-object rows, negative/fractional/overflowing counts and invalid status; uncertain signability is retried rather than reported stranded. Existing forwarding still runs for present funds, even while evidence is pending. Older entries without transaction identity remain unresolved, not falsely completed. The immediate completion status now reports confirmed withdrawal plus empty tracked payout, not proof of receipt into the wallet. Four messages localized in all languages; catalogue4,630, fixed Pools labels301.

Validation:326 PandaPools +9 localization JVM pass (335), including16 new cases covering delayed arrival/restart, partial funds, all-receipt confirmation, wrong/reorged evidence, changed final balance, new withdrawal vs stale callback, legacy entries, failed clear/save, unavailable preferences, exact draft handle, malformed counts, strict inclusion, bounded/resumable history and the actual PoolManager.close→TxPost pipeline before an uncertain reply. First run stopped on the expected catalogue-count assertion; updated297→301. The full-pipeline test initially expected immediate coin release; corrected to assert the existing reservation after ambiguous post. Production reservation logic was never changed. Final all-three-debug and AndroidTest builds succeed in25seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass.

Six baseline files intentionally changed: PoolManager,TxPost,PendingCollect,CollectSweeper,ActivityLog and PandaPools build.gradle (existing Mockito version for host tests). Original hashes preserved in evidence;126 other baseline files and all prior protected finance/audit files/node jar unchanged. New checkpoint build/localization/pools-collection-validation.json records399 source hashes and reviewed_collection_changes.

### Code Review
Summary: premature empty-address completion is fixed in host tests; public transaction identity is journalled before broadcasting and chain evidence is checked before clearing. No additional signatures are requested by the journal or resolver.
Findings: legacy or explicitly rejected journal records remain pending because absence cannot prove delivery. Review precise rejection/reconciliation behavior before release, especially an earlier ambiguous attempt sharing the same transaction ID. Available funds still forward. Background/runtime chain evidence and Fold behavior remain unverified.
Verdict: host repair checks pass; release validation and reconciliation work remain.

Next: review explicit rejection/reconciliation handling; add/migrate/close/collection form languages, statements/calculator, detailed recovery diagnostics, PandaDEX and earlier financial/accessibility checks; safe Fold validation; signed versioned builds, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. Goal remains active.


## PandaPools liquidity forms and migration collection — 2026-10-17

Previous turn made progress (durable collection evidence). Revalidated399 source hashes. Only Fold R3GL805K7MB remains authorized; no ADB/device/emulator operation, install, launch, wallet, node or signing operation this turn.

Read the complete MyLpView add/migrate/close/collect/announce/refresh region and compared it with build/localization/pinned-sources/pandapools/app/src/main/java/com/eurobuddha/pandapools/MyLpView.java: identical except the reviewed collection completion label. Reused scripts/adapt-pandamonium-pools-create-languages.py, shared LanguageDialog/text/hint bindings, existing scroll wrapper and action resources. Read PoolManager migrate/buildMigrate: returned reserves go to the same owner payout address, so the same reviewed durable journal hook must cover migration too.

Added32 messages (4,662 total), with21 local fixed labels in localization/pools-liquidity-messages.json. New scripts/adapt-pandamonium-pools-liquidity-languages.py is appended after the create adapter. Add, migrate, withdrawal and collection forms/statuses plus reannounce/refresh submission statuses now bind all four languages. Dynamic token names, amounts, IDs and payout addresses stay literal. Known diagnostics bind through PoolsMessages; unknown node diagnostics remain literal. Add and migrate custom forms use existing wrapScroll. Inputs and existing listeners are retained; no typed field is rebound. Add starts with a translated prompt, and its preview explicitly describes an estimate recalculated from live reserves before submission.

Withdrawal review now distinguishes the last shown reserves, a live reread, payout address, confirmation and collection. Posted callbacks say submitted/waiting; reannounce and refresh no longer assert confirmation. Raw ActivityLog receipts, financial calculations/rounding, owner guards, retry predicates, pool persistence and callback order are unchanged.

Extended scripts/adapt-pandamonium-pools-collection.py to pass the existing CollectConfirmation.beforePost hook in buildMigrate, using its captured payout address. This reuses the close path's durable transaction identity and existing all-receipt confirmation checks; migration's returned reserves now enter background collection tracking before broadcast. No new signing operation or new production dependency. Existing collection tests cover multiple transaction identities on one address and stale completion callbacks; this specific migration path has source/build validation and still needs safe runtime validation.

Rejection policy review: read local core txnpost.runCommand/postTxn. It hands work to the miner before serializing the final reply. A generic failure also cannot disprove an earlier accepted attempt with the same transaction hash. Therefore no automatic deletion from generic rejection or absent history was added. Legacy/unresolved evidence remains visible and available funds still forward. There is no new manual discard path; retain this as a documented limitation rather than falsely marking delivery complete.

Validation:326 PandaPools +9 localization JVM pass (335), including the16 collection regression cases. All three debug variants and AndroidTest compile in24seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass.126 untouched PandaPools baseline files and all earlier protected finance/audit files/node jar unchanged. PoolManager and its adapter are the only updated reviewed collection sources. Checkpoint build/localization/pools-liquidity-validation.json has401 source hashes. No device or visual claim.

### Code Review
Summary: generated form bindings preserve literal financial values and raw drafts; submitted status text accurately describes pending confirmation. Migration reuses the tested journal barrier and confirmation resolver.
Findings: no additional source/build defect identified. Detailed backend errors and statement/calculator surfaces remain untranslated. Fold lifecycle/layout and actual migration/background collection require runtime validation. Unknown historical/rejected records remain pending by design.
Verdict: host checks pass; release remains incomplete.

Next: statements/export/calculator and detailed recovery/keeper diagnostics, PandaDEX and earlier financial/accessibility checks; safe Fold validation; signed versioned release, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. Goal active.


## PandaPools calculator and statement controls — 2026-10-17

Previous goal turn was a scope acknowledgement and read-only Fold connection check, with no implementation progress. Revalidated all401 prior source hashes and proceeded with the next available implementation. Only Fold R3GL805K7MB is authorized. No device operation this implementation turn.

Reuse: read complete PoolCalcDialog and PoolCalc/PoolCalcTest; standalone apks/pandapools/app calculator is byte-identical to the pre-edit imported one. Read MyLpView statement callbacks, complete ExportWriter, relevant statement tests (missing reserves, own transactions, numeric CSV and formula escaping), shared Language/LanguageDialog and binding tests, existing create/liquidity adapters and dialog tracking. Reused that shared binding system and exact calculator/CSV engines.

Added53 messages (4,715 total) via localization/pools-calculator-messages.json and scripts/adapt-pandamonium-pools-calculator-languages.py, appended to the pinned import adapter. Calculator headings, fields, results, explanatory notes, chips and canvas labels now resolve English/Chinese/Russian/Ukrainian. Retained existing fields, raw values, watcher wiring and financial math; locale refresh changes bound labels without recomputing input values. Token-symbol edits now update all associated field labels as well as results. Blank symbols use a nested translated fallback while literal typed symbols remain literal. Canvas invalidates on configuration changes. Price chips have48dp minimum targets. Calculator uses MainActivity's existing tracked LanguageDialog; inspected both callers are MainActivity-backed MyLP views.

Statement dialog, building/failure/saved statuses, save/share actions, subject and summary now translate. The dialog scrolls through the existing wrapper. CSV remains unchanged, including stable English schema, numeric conventions and injection protection. ExportWriter, PoolStatement, their tests and PoolCalc remain byte-identical. Text now accurately says reserves come from the latest scan and incomplete history/reserves can leave figures incomplete. Calculator help states its fixed-price fee assumption, fixed-K reserve movement and magnitude of slope; it does not promise actual future returns.

Validation:326 PandaPools +9 localization JVM pass (335), including8 existing calculator tests and existing statement/CSV tests. All three debug APK variants and AndroidTest compile in29seconds. All19 pinned imports reproduce; catalogue, transport and diff checks pass.125 untouched PandaPools baseline files and all previously protected financial/audit files/node jar retain their recorded hashes.404 source hashes saved in build/localization/pools-calculator-validation.json. No extra tests added for display-only bindings; no device/visual validation claimed.

### Code Review
Summary: shared immutable text bindings preserve entered values and financial algorithms; generated changes are limited to the calculator and statement UI plus language assets/adapters. Callback order, persistence and raw CSV output remain unchanged.
Findings: no new source/build defect found. Calculator canvas/long-label layout, raw draft retention and export interactions still require safe Fold validation. Existing broader financial and lifecycle issues listed in the plan remain open.
Verdict: host checks pass for this increment; release remains incomplete.

Next: detailed PandaPools recovery/keeper diagnostics, PandaDEX, outstanding financial/accessibility review, safe Fold runtime validation, signed versioned releases, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. No commits, signing or publication in this turn. Goal active.


## PandaPools owner-key and backup-check diagnostics — 2026-10-17

Previous turn made progress (calculator/statement translations). Revalidated404 source hashes. Fold R3GL805K7MB only; no device/emulator operation this turn.

Reuse: read OwnerKeyRecovery reason/message/classification, complete BackupCheck and its read-only tests, complete RestoreExit, Recovery restore callbacks, PoolKeepAliveService and shared NotificationLabels. Compared OwnerKeyRecovery/BackupCheck/RestoreExit with standalone apks/pandapools/app: all byte-identical before changes. Reused scripts/adapt-pandamonium-wallet-error-languages.py diagnostic generator, existing PoolsMessages.report and recovery adapter, prior literal-preservation tests and ReserveRecoveryTest.reply for mock node callbacks. No new dependency.

Added46 messages (4,761 total),24 fixed labels and27 diagnostic patterns (totals325 fixed/32patterns). All six actual OwnerKeyRecovery refusal reasons translate, including full/flattened/key-only forms, with full exact IDs/counters and bounded nested diagnostics. Backup-check version, recipe/script findings, reserve visibility, key counts, counter warnings, proofs, derivation indexes and summary translate. Unknown diagnostics and saved note payloads remain literal arguments. Readability failure now says the key counter could not be established, rather than claiming the key is absent. The summary reports checked recipe details, not proven recoverability; missing local coins do not establish spending; no-counter and regression warnings remain explicit.

Review found that report line breaks in untrusted backup notes, invalid addresses or node errors could masquerade as translated check findings. Reused existing org.json JSONObject.quote in BackupCheck for these five display expressions: note, three error callbacks, and invalid address header. Valid hexadecimal addresses stay literal/unquoted. JSON quoting is reversible and does not change backup input, stored data, command arguments, callback counts, signing checks, proof checks or the read-only command allowlist. Original BackupCheck hash retained separately; only its report formatting changed.

Nine new JVM tests cover all six real Blocked.message() variants, flattened progress, optional pool address and signing envelope, exact counters/full IDs, safe summary resources, unknown diagnostics, bounded recursion, CRLF/blank-line composition, and actual BackupCheck callbacks with malicious multiline notes/errors/invalid addresses. The latter round-trip escaped payloads through JSON and prove no injected positive key-count translation occurs; mock commands are all read-only, and invalid-address path issues none. Initial report test exposed the generic flattened owner-key envelope matching an empty paragraph before an indented key label. Moved specific templates ahead of envelopes; final tests pass. No backend decision was weakened.

Validation:335 PandaPools +9 localization JVM pass (344), including9 new diagnostic/report cases. All three debug variants and AndroidTest compile (final incremental build5seconds; preceding full resource rebuild19seconds). All19 pinned imports reproduce; catalogue/transport/diff checks pass.124 untouched PandaPools baseline files plus previous reviewed financial/recovery/collection/audit changes and node jar retain hashes. Evidence build/localization/pools-diagnostics-validation.json has407source hashes. No device/visual claim.

### Code Review
Summary: explicit application templates translate at existing display boundaries; raw identifiers and numeric evidence remain immutable. Backup report escaping prevents external text from becoming an application check-result line.
Findings: matching-precedence defect caught by the new test is fixed. No additional source/build defect found in this increment. Remaining RestoreExit/Recovery/ReserveRecovery diagnostics and keeper/stranding notifications are not yet translated; safe Fold layout/lifecycle/copy validation remains open.
Verdict: host checks pass for this increment; full release remains incomplete.

Next: remaining PandaPools diagnostics/notifications, PandaDEX, outstanding financial/accessibility checks, safe Fold runtime validation, signed versioned builds, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. No commits, signing or publication in this turn. Goal active.


## PandaPools keeper notifications — 2026-10-17

Previous turn made progress (owner-key/backup reports). Revalidated407 source hashes. Fold R3GL805K7MB only; no device/emulator operation this turn.

Reuse: read complete StrandingWatch and its13 threshold/rate-limit/identity tests, PoolKeepAliveService, shared NotificationLabels and its preference-preservation test, AtomiX notice adapter/service configuration hook, and equivalent GuardianService/CasinoService hooks. Compared with pinned standalone sources: only the pre-existing Pandamonium notification tag adaptation differed before this change. Reused AtomiX's active-service refresh guard and existing-channel lookup; no new notification framework or dependency.

Added13 messages (4,774 total). New scripts/adapt-pandamonium-pools-keeper-languages.py binds foreground maintenance text, both channel labels/descriptions, three warning titles, four bodies and actions. Shared NotificationLabels now updates existing pp_keepalive/pp_stranding labels. Existing channel objects are reused, preserving user sound/vibration/importance settings. Service configuration changes synchronize Language, refresh channel labels and replace only its already-active foreground notification; they never run a maintenance pass or start foreground work. onDestroy clears its existing started flag. OS notification update exceptions leave the old notification in place.

Wording is evidence-based: reserve age may require archive recovery or affect discovery; it does not establish irrecoverability, lack of earnings, or why a refresh was missed. Quarantined wording covers both unconfirmed state and failed confirmation persistence. Numeric ages/thresholds and full addresses remain literal. Notification IDs/tags, pending intents, action targets, signing gates, warning thresholds, quiet periods, scheduling and keep-alive work are unchanged. Verified the full scheduling/decision sections against pinned sources after normalizing only the existing notification tag.

Validation:335 PandaPools +9 localization JVM pass (344), all three debug variants and AndroidTest compile in24seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass.122 untouched PandaPools baseline files and prior reviewed financial/recovery/collection/report changes, public audit and node jar retain hashes. Evidence build/localization/pools-keeper-validation.json has410source hashes. No extra tests added for these display bindings; no device/visual claim.

### Code Review
Summary: locale-aware notification text reuses existing service lifecycle and notification channels; maintenance and signing decisions remain unchanged.
Findings: no source/build defect identified. Fold notification layout, channel retention and foreground configuration refresh need runtime validation. Posted reserve-warning alerts retain event-time text until normal replacement; new alerts use the selected language, while ongoing foreground notification/channel labels refresh.
Verdict: host checks pass for this increment; release remains incomplete.

Next: remaining RestoreExit/Recovery/ReserveRecovery progress/errors and residual PandaPools labels; PandaDEX; outstanding financial/accessibility checks; safe Fold runtime validation; signed versioned builds, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. No commits, signing or publication in this turn. Goal active.


## PandaPools restore progress and refusals — 2026-10-17

Previous turn made progress (keeper notifications). Revalidated410 source hashes. Fold R3GL805K7MB only; no device/emulator operation this turn.

Reuse: read complete ReserveRecovery and RestoreExitRefusalTest plus ExitStore lifetime-limit lookup and current MyLpView recovery message/report call sites; RestoreExit/Recovery complete flows and diagnostic generator were read in the prior increment and their protected hashes remain unchanged. Reused the existing fixed/pattern diagnostic catalogue, immutable captures and bounded nested diagnostics. No new production helper, dependency, callback type or backend change.

Added29 messages (4,803 total),13fixed/16patterns (totals338fixed/48patterns). RestoreExit no-pool, lifetime limit, unreadable/unavailable/exhausted keys, counter regression, missing recorded count, unknown/recent reserves, batch limit, preparing/unknown/failed/skipped withdrawal and pending/failed collection text now translate. Recovery invalid/empty backup, skipped recipe/covenant, verification/save/tracking failures and verified-ID save failure translate. Raw numeric capacities preserve comma grouping, including262,144 and268,435,456. Raw full identifiers, unknown node errors and stored diagnostic strings are unchanged.

Wording keeps uncertainty explicit: recent reserve recreation may indicate another signing wallet copy, not proof of one; submission is not receipt in the wallet; ambiguous replies stay unknown. Signing and withdrawal limits, freshness checks, persistence, commands, callback order and backend receipts are unchanged.

Five new PoolsRestoreMessagesTest cases reuse the actual RestoreExit.refusal function and existing pure-test pool setup. They cover classic/block capacities, regressed/unreadable counters, accepted healthy state, absent recorded counter, recent/unknown ages and threshold boundary, nested skipped-reason full IDs/counters, uncertain replies and collection state, literal recipe identifiers and unknown diagnostics.

Validation:340 PandaPools +9 localization JVM pass (349), all three debug variants and AndroidTest compile in21seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass.122 baseline PandaPools files and all earlier protected financial/audit files, reviewed collection/report fixes and node jar unchanged. Evidence build/localization/pools-restore-validation.json has412source hashes. No device/visual validation claimed.

### Code Review
Summary: restore translations bind at existing display boundaries without changing raw records or eligibility decisions. Tests exercise actual refusal output and preserve evidence through nested diagnostics.
Findings: no source/build defect identified in this increment. ReserveRecovery still combines an address, main status and joined notes; its multiline display path and external multiline restore diagnostics need review before claiming complete coverage. Fold layout and live-switch validation remain open.
Verdict: host checks pass for this increment; release remains incomplete.

Next: ReserveRecovery multiline diagnostics and residual PandaPools labels, PandaDEX, outstanding financial/accessibility checks, safe Fold runtime validation, signed versioned releases, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. No commits, signing or publication in this turn. Goal active.


## PandaPools reserve reports and immutable restore logs — 2026-10-17

Previous turn made progress (restore refusals). Revalidated412 source hashes. Fold R3GL805K7MB only; no device/emulator operation this turn.

Reuse: read complete ReserveRecovery, Recovery restore callbacks/callers, PoolRefresher.reserveCoin identity validation, MyLpView restore-log composition, existing ReserveRecoveryTest harness and AtomiX report adapter. Reused AtomiX Language.TextBuilder, existing PoolsMessages.report/diagnostic generator, and JSON quoting already used in BackupCheck. No new dependency or report framework.

Added22 messages (4,825 total),15 fixed aliases/13patterns (totals353fixed/61patterns). Reserve verification/incomplete status, archive support/list/export/missing reserves, proof rejection/import failure, count/ID/node-reply errors now translate. Known internally generated read errors have explicit raw and JSON-quoted aliases; unknown quoted node payloads remain literal. Full IDs and counters retain exact representation.

ReserveRecovery joins application diagnostic notes with newlines instead of spaces, with a newline after the main incomplete status. Six external node/archive error payloads use reversible JSONObject.quote, preventing their line breaks from becoming report findings. Recovery quotes malformed imported addresses before displaying them; valid hexadecimal IDs stay unquoted. No proof data, validation condition, coin selection, command, callback order, persistence or signing decision changed. Original Recovery/ReserveRecovery hashes retained separately; changes are reporting only.

MyLpView now reuses AtomiX's immutable Language.TextBuilder for the restore log. Recovery's application-generated multiline report is translated once at receipt; automatic-withdrawal messages are translated as whole messages so nested raw error payloads never get reparsed as report lines. Completed UI receives log.build() snapshots; language switching can rebind the report without rebuilding recovery state. This also prevents later appends from altering an already-built report.

Five new PoolsReserveReportTest cases reuse the actual ReserveRecoveryTest harness: verified live reserves with no import/archive calls; archive outage remains incomplete; hostile multiline node errors cannot inject submitted/verified results and round-trip through JSON; rejected proofs still issue no imports; immutable progress snapshots preserve uncertain-withdrawal payloads as literal data. Existing proof, count, callback and read-only/collection tests also pass.

Validation:345 PandaPools +9 localization JVM pass (354), all three debug variants and AndroidTest compile in22seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass.120 untouched PandaPools baseline files plus previous reviewed financial/recovery/collection/report changes, public audit and node jar unchanged. Evidence build/localization/pools-reserves-validation.json has417source hashes. No device/visual claim.

### Code Review
Summary: report boundaries now preserve provenance: application-generated lines translate, while external node strings remain quoted payloads and completed logs are immutable snapshots. Recovery algorithms and command sequencing are intact.
Findings: no source/build defect identified in this increment. Residual text audit and safe Fold report/layout/lifecycle testing remain. A first UI-literal scan found only two SwapView toast strings and the PandaPools brand; inspect the toast helper before calling those untranslated, since existing helpers may resolve them.
Verdict: host checks pass for this increment; release remains incomplete.

Next: residual PandaPools text audit; PandaDEX; outstanding financial/accessibility checks; safe Fold runtime validation; signed versioned builds, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com. No commits, signing or publication this turn. Goal active.


## PandaPools saved activity descriptions — 2026-10-17

Previous goal turn was no progress (Fold restriction acknowledgement and read-only connection check). This turn revalidated all417 checkpoint source hashes, then completed the stored-receipt display gap. No device operation this turn; Fold R3GL805K7MB remains the only permitted device.

Reuse: inspected the standalone apks/pandapools ActivityLog.java and ActivityView.java; integrated ActivityLog persistence, callers in SwapView/MyLpView/RestoreExit/WalletTools; existing PoolsMessages generator, Language.Message, and retained wallet/activity adapter and tests. Standalone source also displays raw summaries. Reused existing immutable Language.Message and Language.setText bindings. The small receipt parser is specific to action types and known receipt formats because general diagnostic lookup cannot establish repeated token-name identity; a regex back-reference preserves both occurrences literally. No new dependency or storage format.

Added8 resource messages in English, Simplified Chinese, Russian and Ukrainian (4,833 total). Existing Consolidate resource reused. Both Activity pending cards and Swap recent activity bind translated descriptions. Recorded CREATE/DEPOSIT/MIGRATE/CLOSE/CONSOLIDATE types constrain matching; raw swaps and unknown descriptions remain literal. Full liquidity summaries require matching repeated token labels and numeric/missing-amount fields; short attempt forms require an existing failure diagnostic, including uncertain outcomes. Token names, exact decimal strings, missing amounts and full IDs are literal immutable arguments. The withdrawal description no longer asserts that funds have arrived back in the wallet; independent receipt status still supplies confirmation evidence.

Five new JVM cases cover all liquidity formats, multilingual/delimiter/newline-containing token names, full identifiers, exact decimals, failed and uncertain status preservation, restored addresses, consolidation names, mismatched/unknown/swapped descriptions, and missing amounts. ActivityLog and all receipt producers, transaction/collection/recovery algorithms, persisted data and confirmation checks unchanged.

Validation:350 PandaPools +9 localization JVM tests pass (359); all3debug variants and AndroidTest compile in27seconds; all19 pinned imports reproduce; 4language catalogue, transport and diff checks pass.120 untouched Pools baseline files and all reviewed recovery/collection/report hashes, public-key audit and node jar remain unchanged. Evidence build/localization/pools-receipts-validation.json has419 source hashes. No runtime/visual claim; no signing/commit/publication.

### Code Review
Summary: scoped to display parsing and immutable localization bindings; raw receipt data and confirmation state are preserved. Pattern back-references prevent token-name delimiter text from being treated as application wording.
Findings: no blocking defect found in this increment. Short failure forms necessarily retain their entire token-name payload as literal content. Safe Fold layout/language-switch validation remains pending.
Verdict: approve this source increment with host validation; full release remains incomplete.

Next: residual PandaPools backend diagnostic coverage, PandaDEX inner translations, previously recorded financial/accessibility checks, safe Fold runtime validation, signed versioned artifacts, commit/push and publication to GitHub fork/PandaApps/eurobuddha.com. No work on other devices or emulators.


## PandaDEX retained shell and activity log — 2026-10-18

Previous goal turn made progress (PandaPools saved receipt descriptions). Revalidated all419 checkpoint source hashes. No device operations; Fold R3GL805K7MB only.

Reuse: standalone apks/pandadex AGENTS.md and MainActivity chrome/lifecycle, integrated MainActivity chrome/log/ready/status callers, Design.pill, existing BalanceDisplayTest/ReceiptPresentationTest; Casino language adapter, shared Language.Message/TextBuilder/LanguageDialog, wallet diagnostic generator and Future Cash selected-tab scrolling. Graph query expanded from exact vocabulary [pandadex, language, activity, trade, localization]; results included PandaDEX and Parlons AppLanguage but mixed Swift/Android sources, so source inspection determined the implementation. No new dependency or transaction framework.

Added27 messages/30 exact aliases; catalogue4,860 messages in English, Simplified Chinese, Russian and Ukrainian. Navigation, node readiness, theme accessibility description, known readiness warnings, log headings/close control translate. Reused immutable display messages for raw timestamped activity lines; unknown node payloads remain whole literal data. Stored log order/timestamps/truncation/Bundle schema and live stage fields remain unchanged. Language configuration callback only rebinds views, without repainting/rebuilding forms or issuing node calls. Header status is a second row; scrollable tabs and48dp targets accommodate longer translations. Active tab reveal reuses Future Cash requestRectangleOnScreen behavior without focus movement. Expanded log retains its original dismissal lifecycle and scroll behavior.

Four JVM tests cover all exact aliases, actual nodeLabel/uncertain-write constants, timestamp preservation, hostile multiline unknown payloads/fullIDs/exact decimals, and immutable log snapshots. Initial compile caught Files.readString unavailable under this Android compile surface; corrected to the existing Files.readAllBytes pattern.705 PandaDEX +9 localization JVM tests pass (714), all3debug variants and AndroidTest compile in51seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass. Import recheck was rerun read-only after automatic approval review timed out on the command saving its log; successful read-only output is recorded in evidence.

PandaDEX baseline188files recorded in build/localization/dex-original-hashes.json. Only MainActivity changes;187 baseline files (including all engines, services, receipt/storage/signing logic and existing tests) unchanged. All previous protected files, reviewed recovery/collection/report changes, public-key audit and node jar unchanged. Evidence build/localization/dex-shell-validation.json includes425source hashes. No device/visual claim, signing, commit or publication.

### Code Review
Summary: retained views and immutable bindings follow the existing localization implementation; transaction objects, callbacks, input fields and raw state remain intact. Diff reviewed against git baseline; only shell/log/toast bindings and layout/configuration hook changed.
Findings: no source/build blocker found for this increment. Fold layout/focus and live language-switch verification remain pending. Inner tabs and dynamic descriptions are not yet translated.
Verdict: approve this source increment with host validation; full release remains incomplete.

Next: PandaDEX Trade/Chart/Tape/Orders/Assets/Maker text and notifications; residual PandaPools diagnostics; earlier financial/accessibility work; safe Fold runtime validation; signed versioned builds, commit/push and publication only GitHub fork/PandaApps/eurobuddha.com.


## Local work-in-progress commit requested — 2026-10-18

The user requested an immediate local commit of all work so far. This checkpoint preserves the complete multilingual Bear implementation on feature/bear-languages-2026-10-16, based on 9def96e (1.9.41/vc112), with candidate version1.9.42/vc113. English, Simplified Chinese, Russian and Ukrainian are authorized. The last fully checked increment is PandaDEX shell:714 JVM tests pass, all3debug variants and AndroidTest compile, all19 pinned imports reproduce. Evidence:build/localization/dex-shell-validation.json.

Since that checkpoint, PandaDEX TradeView display bindings and62 catalogue messages were added (4,922 total;74 exact DEX aliases/22 patterns). Catalogue generation and pinned regeneration succeeded, but the new TradeView bindings have NOT yet been built/tested. The pending work includes trade-message tests, reviewing the TradeView diff, the remaining PandaDEX screens/notifications, residual diagnostic/financial/accessibility checks, safe Fold-only runtime validation, signed installers and publication. No release completion or signing claim accompanies this WIP commit. Only Fold R3GL805K7MB may be used; preserve its installed owner app, wallet, node and data. No other devices/emulators.

No push or publication is included in this local checkpoint. Approved eventual destinations remain GitHub fork, PandaApps and eurobuddha.com only. Build artifacts and local validation logs stay in the established ignored build/dist directories.


## PandaDEX trading screen and local commits — 2026-10-18

Previous goal turn made progress (PandaDEX shell). Revalidated425 source hashes. User explicitly requested a local commit of all work so far; committed1,086 files as f1c8232f1c219984a34c3c83c46b4f4c4b7ac697, WIP: preserve multilingual Bear and integrated app implementation. Worktree was clean after that commit. No push/publication. This increment adds regression tests and completes host validation of the TradeView changes saved in that WIP commit. No device use; Fold R3GL805K7MB only.

Reuse: read all786lines of TradeView, confirmed exact byte equality with standalone apks/pandadex TradeView; inspected existing Pending.Row descriptions/status, OrdersTab stale/unresolved messages, MainActivity node/readiness helpers, PriceMath and Util formatting; complete ReceiptPresentationTest and PriceDisplayTest. Reused PandaPools Swap label/hint/retained-message binding, existing DexMessages generator, Language.join and literal captures. Existing decimal input filters, listeners and calculators preserved.

Added62 messages (4,922 total),44 fixed aliases and22 patterns (74DEX exact aliases total). Ticker/stat labels, order book sources, buy/sell controls, price/amount hints, totals, GTC and advanced controls/help, quote progress/refusals, last-trade ages, open orders and receipt evidence states translate. Existing amount precision and raw numeric strings preserved. Input text is never language-bound. Minimum48dp targets and a heading above tick choices accommodate longer labels; edit/cancel icons have translated accessibility descriptions. MainActivity transaction confirmation/action dialogs are a later scope and are not claimed complete.

Five tests reuse actual Pending.Row receipts, original receipt test factory and TradeView.amountText: action/phase/lock preservation, buy/sell identity and exact six-decimal prices, legacy/unreadable evidence, downward-rounded book/pool amounts, nested age/clock translations and hostile unknown diagnostics.710 PandaDEX +9localization JVM pass (719). All3debug variants and AndroidTest compile in1m12s. All19 pinned imports reproduce; catalogue/transport/new-diff checks pass.

Reviewed full TradeView diff. Eight existing methods are byte-identical to standalone:applyPercent,levelPrice,cumMax,requestDepth,depthKey,amountText,revealEntryAboveKeyboard,onDetachedFromWindow. submit() is identical after removing its one busy-label binding wrapper. No routing, rounding, coin selection, quote callback, order ownership, unresolved-action guard, persistence or signing changes.186 original DEX files remain unchanged; other protected engines/public-key audit/nodejar unchanged. Evidence build/localization/dex-trade-validation.json has429source hashes. Fold runtime/visual checks still pending.

### Code Review
Summary: translation is applied at display boundaries; existing forms, financial calculations and receipt evidence remain authoritative. Exact numeric captures and nested status resources keep accepted submission distinct from on-chain confirmation.
Findings: no blocking source/build defect identified in this increment. Device layout/input/lifecycle validation remains pending. Existing input sanitization and transaction algorithms were not redesigned.
Verdict: approve this increment with host validation. Full release incomplete; second local commit will preserve the added tests and checkpoint documentation.

Next: PandaDEX transaction dialogs and Chart/Tape/Orders/Assets/Maker/notifications, residual diagnostics and earlier financial/accessibility findings, safe Fold validation, signed versioned deliverables, commit/push and authorized publication to GitHub fork/PandaApps/eurobuddha.com.


## PandaDEX charts and trade history — 2026-10-18

The preceding status-only turn verified the clean local commits; this turn continued implementation. Reused the existing shared Language messages/date stamps, DexMessages generator, PandaPools canvas invalidation, and the standalone PandaDEX ChartTab/CandleView/TapeTab implementations. Read the existing CandlesTest, InclusionTimeTest, ChainReview status rules, TradeExport time labels and correction archive producers. Source worktree remains feature/bear-languages-2026-10-16, based on 1.9.41; candidate 1.9.42/vc113. Ukrainian remains explicitly authorized. Fold only; no device activity this increment.

Added 40 catalogue messages (4,962 total; 109 exact DEX aliases and 22 existing patterns). Translated chart intervals, OHLCV readouts, personal and market trade history, time basis, maker/taker and liquidity source labels, accounting/evidence status, correction history, reasons and missing-coordinate labels. Dates use the selected language. Literal values, IDs and stored/exported evidence remain unchanged. The chart empty state uses a wrapping TextView; interval choices have 48dp targets. A configuration change invalidates only the canvas and refreshes bound labels, preserving the crosshair and interval. Clearing an empty chart also clears its obsolete readout.

Five regression tests exercise actual Candle aggregation, TapeTab metadata/correction formatting and original totals: observed versus inclusion-block time, excluded/superseded versus legacy accounting, exact amount and identifier preservation (including multilingual/unusual literal content), missing/null correction values, and immutable candle snapshots. Review caught null archived values becoming blank; corrected them to retain the unknown label and added coverage. 715 PandaDEX + 9 localization JVM tests pass (724). All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue and transport checks pass. No owner Fold install or launch.

### Code Review

Summary: display bindings preserve raw evidence, calculations, selected candle and interval. Full changed source, generated aliases and four-language catalogue reviewed. Chart drawing gets localized dates and bounded label positions; ordinary TextViews wrap the empty message and readouts.
Findings: no blocking source/build defect found in this increment. Device layout, large-font and live switching evidence remains pending. Dynamic application-generated evidence notes still need translation coverage; this is not complete PandaDEX localization.
Verdict: approve this increment with host validation. CandleView setData/selected/touch logic and TapeTab label/totals are byte-identical to the donor; 183 other DEX source files, protected engines/reviewed recovery fixes, public-key audit and node JAR remain unchanged.

Evidence: build/localization/dex-history-validation.json, with 435 source hashes. Next: remaining PandaDEX dialogs, Orders/OwnerHistory, Assets, Maker, notifications and diagnostics; remaining financial/accessibility findings; safe Fold runtime validation; signed versioned builds and publication to the authorized GitHub fork, PandaApps and eurobuddha.com.


## PandaDEX orders and operation history — 2026-10-18

Previous goal turn made progress and committed chart/history work as 38adfff. Revalidated all 435 tracked source hashes and the clean worktree before this increment. Reused the standalone OrdersTab, OwnerHistoryView, OwnerReceipt, Order5 and their existing receipt tests, plus the shared LanguageDialog, immutable messages/date stamps and PandaPools retained-dialog adaptation. No standalone donor edits.

Added 67 messages (5,029 catalogue entries), with 159 exact DEX aliases and 37 patterns. Open orders, receipt states, owner operations and pagination, order ages/expiry, personal trade volume/P&L and export actions translate. Edit-price and cancel-all dialogs retain the existing input, callbacks and confirmation-time guards. Dates follow the selected language; exact amounts, signs, IDs, stored receipts and exports remain literal. Edit/cancel icons have translated descriptions and 48dp targets. Cancellation wording still distinguishes submitted requests from block-confirmed outcomes, and maker pause/remaining tracked orders remain explicit.

Six new tests use actual owner receipt states and Order5 age labels, checking moved/missing/unconfirmed inclusion, all operation outcomes, observed versus block timestamps, absence of repeat-check times, unknown/stale order ages, exact P&L signs and amount strings, excluded trade rows, cancellation consent snapshots, and unknown diagnostic payloads. 721 PandaDEX + 9 localization JVM tests pass (730). All three debug variants and AndroidTest compile; all 19 pinned imports reproduce. Catalogue, transport and diff checks pass. No device activity; Fold R3GL805K7MB remains the only authorized device.

### Code Review

Summary: translated display text uses the existing state and evidence. Source comparison confirms cancellation sequencing, confirmation-time ownership checks, price-input filtering and relock arithmetic, trade volume/P&L calculations, and owner-history pagination are unchanged. No backend receipt, ownership, storage or signing changes. Protected engines, public-key audit and node JAR remain unchanged; 181 original DEX files remain untouched.
Findings: no blocking source/build defect identified. Fold runtime verification of long labels, large fonts, retained inputs and pagination remains pending. Translation and signed release work remain incomplete.
Verdict: approve this increment with host validation.

Evidence: build/localization/dex-orders-validation.json (440 source hashes). Next: trade quote/confirmation dialogs, export flow, Assets, Maker, notifications and dynamic diagnostics; remaining financial/accessibility findings; safe Fold runtime validation; signed versioned deliverables and authorized publication to the GitHub fork, PandaApps and eurobuddha.com.


## PandaDEX trade quotes and unresolved-trade review — 2026-10-18

Previous goal turn made progress and committed order/history translations as 62ea9f0. Revalidated all 440 tracked hashes and clean worktree. Reused the standalone confirmSweep/confirmComposite quote assembly, the complete existing PandaPools report-line binding, shared LanguageDialog, and SweepPlannerTest/CompositeRouterTest fixtures. Quote assembly was moved unchanged into two display helpers; transaction callbacks remain in the original methods.

Added 41 messages (5,070 total; 178 exact DEX aliases, 62 patterns). Sweep and mixed book/pool confirmations translate buy/sell direction, average/effective/worst prices, source counts and amounts, price impact, partial fills and remaining limit orders. Existing number formatting is retained. Unresolved-trade review keeps the exact transaction reference and warnings about unproven submission and a remaining order not restored after restart. Order/trade progress and receipt failure messages translate without changing stored strings or recovery behavior.

Six regression tests use actual routing fixtures: best-price sweep with partial fill, minimum remainder and resting amount, mixed buy/sell token direction, book-only and pool-only liquidity, immutable display snapshots, line separators and unknown literal content, posted-versus-confirmed wording, and unknown multiline diagnostic preservation. 727 PandaDEX + 9 localization JVM tests pass (736). All three debug variants and AndroidTest compile; all 19 pinned imports reproduce. Catalogue/transport/diff checks pass. No device activity; Fold R3GL805K7MB only.

### Code Review

Summary: quote formatting and the entire positive-button execution callback are byte-identical to their prior bodies. The existing report helper is used only for internally generated quote lines; unknown diagnostics are never split through it. Display snapshots contain immutable values. Full MainActivity diff, generated lookup additions, adapter and tests reviewed.
Findings: no blocking source/build defect introduced in this increment. Both transaction reconciliation paths, pending-state persistence/cleanup, rest queue and pool-impact calculation remain unchanged. All 181 protected DEX baseline files and other protected engines/public-key audit/node JAR are unchanged. Fold dialog layout, large-font behavior and live switching still require runtime validation.
Verdict: approve this increment with host validation; the full release remains incomplete.

Evidence: build/localization/dex-quotes-validation.json (443 source hashes). Next: export, Assets, Maker, notifications and dynamic diagnostics; remaining financial/accessibility findings; safe Fold runtime validation; signed versioned builds and publication to the authorized GitHub fork, PandaApps and eurobuddha.com.


## PandaDEX Assets and interrupted-write recovery — 2026-10-18

Previous goal turn made progress and committed quote/review translations as f52d66d. Revalidated 443 tracked source hashes and the clean worktree. Inspected standalone AssetsTab, TradeExportSession/Writer, balance parsing/tests, NodeApi recovery and command dispatch, MakerConfig persistence, MakerSnapshotWriteTest and MakerWithdrawalDurabilityTest. Assets, exporter and export session matched the donor exactly. Reused shared display bindings and PandaPools NodeApi/PoolsReviewedWriteTest; the recovery helper is copied byte-for-byte, with only test package/class names adapted. Export translation remains next after the recovery defects found in this review.

Added 24 messages (5,094 total; 205 exact DEX aliases, 67 patterns), reusing existing shared recovery/copy/age resources. Assets translates available funds, confirmed/locked/unconfirmed balances, saved/current orders, receive placeholders, bridge help, ages and recovery dialogs. Raw address and copied command text stay literal. Balance parsing, valuation and existing age arithmetic are unchanged. Recovery/copy controls have 48dp targets.

### Code Review

Summary: Assets display now follows the shared language choice. Three recovery defects were repaired using the existing implementation and persistence boundaries.

- MAJOR, resolved — an old acknowledgement dialog could clear a newer pending write. Capture the NodeApi, marker and displayed details when the dialog opens; reject a changed connection/marker. The copied details now match the reviewed command. NodeApi accepts only the reviewed marker and refuses active writes.
- MAJOR, resolved — a failed SharedPreferences clear can still alter memory. Reused PandaPools' process latch and marker rollback, keeping signing blocked until the clear succeeds durably.
- MAJOR, resolved — recovery ignored a failed maker-disarm save. Reused MakerConfig.reload/saveUserAction and require success before clearing the safety pause; latest tracked orders are retained.

Validation: six inherited reviewed-write tests exercise stale/missing consent, active writes, failed clear, throwing rollback and latch retention. Five new tests cover actual balance categories/unknown-versus-zero, connection placeholders, exact amounts/command text, failed maker disarm and reloading latest prepared-order tracking. 738 PandaDEX + 9 localization JVM tests pass (747). All three debug variants and AndroidTest compile; all 19 pinned imports reproduce. Catalogue, transport and diff checks pass. No device use; Fold R3GL805K7MB only.

The reviewed NodeApi recovery section exactly matches PandaPools. Command dispatch, balance parsing, asset valuation and age calculations are byte-identical to their previous bodies. 179 original DEX files and all other protected engine/public-key audit/node-JAR hashes are unchanged. NodeApi's old hash and reviewed replacement are saved separately, preserving the original baseline. Fold runtime/visual validation remains pending.

Verdict: approve this increment with host validation. Full signed release remains incomplete. Evidence: build/localization/dex-assets-validation.json (450 source hashes). Next: export, Maker, notifications and dynamic diagnostics; remaining financial/accessibility findings; safe Fold validation; signed versioned deliverables and publication to GitHub fork, PandaApps and eurobuddha.com.


## PandaDEX export presentation — 2026-10-18

Previous turn confirmed a clean local checkpoint (6f7e145) without implementation progress. Continued the existing export workflow after inspecting TradeExportSession, TradeExportWriter, TradeExportFilesTest, report totals and display callers, shared LanguageDialog, generated DexMessages and importer adapters. Session, writer and files engine match standalone PandaDEX byte-for-byte. Reused the shared retained dialog and whole-message formatter; only title/body/button bindings changed in MainActivity.

Added 24 messages (5,118 total; 225 exact DEX aliases, 72 patterns) for preparation, save/cancel results, interrupted exports, partial destinations, unsaved local status and completed-write cloud-upload warnings. Displayed count and signed decimal totals come from the original writer. Unknown nested diagnostics remain whole. The local-status warning is matched before the preparation-error envelope so both warnings are retained. Export journal values, archive schemas/content, provider writes, snapshot calculations, ownership, retry/cancellation rules and callbacks are unchanged.

### Code Review

Summary: narrow presentation change using the existing retained language bindings. No new findings in the changed production code. Session/export engine, 179 original DEX files and all protected engine/public-key audit/node-JAR hashes remain unchanged, including the reviewed write-recovery repairs.

Validation: five new tests use real report totals/writer descriptions, covering excluded rechecks, decimal signs, zero/single/multiple records, immutable displays, nested local-save/cloud warnings, unknown diagnostics and malformed totals. An initial test expected nine MxUSD decimals; inspection confirmed the existing eight-decimal ROUND_DOWN rule and the expectation was corrected without changing the exporter. 743 PandaDEX + 9 localization JVM tests pass (752). All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue, transport and diff checks pass. No device use; Fold R3GL805K7MB only.

Verdict: approve this increment with host validation. Device presentation/provider behaviour is still unverified. Full signed release remains incomplete. Evidence: build/localization/dex-export-validation.json (453 source hashes). Remaining work: Maker, notifications and dynamic diagnostics; outstanding financial/accessibility review; safe Fold validation; signed versioned builds and authorized publication to the GitHub fork, PandaApps and eurobuddha.com.


## PandaDEX retained Maker screen — 2026-10-18

Previous turn made progress and committed export presentation as 25910b8. Revalidated all 453 checkpoint source hashes and a clean worktree. Read the complete MakerTab, MakerStatus, MarketPrice and MakerStatusTest; the production files match standalone PandaDEX. Reused the existing TradeView display/hint bindings, shared Language.TextBuilder, AtomiX market editor catalogue and the original MakerStatusTest fixtures.

Added 64 messages (5,182 total; 277 exact DEX aliases, 96 patterns), including shared AtomiX labels for price/mid/step/level/size/skew/reprice/none. Maker editor descriptions, feed age/quarantine/staleness, preview sides and crossed-price warning, paused/recovery labels and rung status now follow the remembered language. Status composition keeps tones, raw rung/order IDs and unknown diagnostics literal; the bound display is an immutable snapshot. The title and long safety state use separate full-width rows. Numeric fields, switch, action and clear controls have 48dp targets; rung inputs and clear buttons have translated accessibility labels.

### Code Review

Summary: presentation-only adaptation of the existing retained editor. No findings in the changed production code. The numeric filter, values, focus listener and all 23 inspected input/math/lifecycle methods remain byte-identical after excluding the intended hint binding. The Maker engine, settings, ladder, status decisions and feed calculations remain untouched. All 178 other original DEX files and all protected engine/public-key audit/node-JAR hashes are unchanged, including the reviewed recovery repairs.

Validation: six tests use actual MakerStatus lines/fixtures and MarketPrice snapshots. They distinguish current/stale/absent orders, unverified reprices, reduced/unknown/different funding, retained withdrawal instructions with current/stale/missing observations, immutable displays with raw IDs/diagnostics, feed age/widening/withdrawal/quarantine and exact preview numbers. 749 PandaDEX + 9 localization JVM tests pass (758). All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue, transport and diff checks pass. No device use; Fold R3GL805K7MB only.

Verdict: approve this increment with host validation. Safe Fold runtime validation remains necessary for drafts/focus, long text, accessibility and switching. Full signed release remains incomplete. Evidence: build/localization/dex-maker-validation.json (457 source hashes). Next: MainActivity Maker publish/funding/apply confirmation dialogs and progress messages (already read, not changed); notification/dynamic diagnostic coverage; remaining financial/accessibility review; safe Fold validation; signed builds and authorized publication.


## PandaDEX Maker consent and funding choices — 2026-10-18

Previous turn made progress and committed the retained Maker editor as 0932f76. Revalidated all 457 checkpoint source hashes and a clean worktree. Read publishMaker, makerFundingHint, prepareMakerFundingUtxos, splitMakerFunding/postMakerSelfSplit, applyMakerEdits, withdrawLadder, appendUnavailable, MakerConfig.storageFailureMessage and existing quote/order dialog adapters. Reused shared LanguageDialog, DexMessages.quote for internally generated consent text, original commitment/shortage/hint/edit assembly and original split execution.

Added 59 messages (5,241 total; 314 exact DEX aliases, 130 patterns) covering publish side/amount commitments, manual versus pegged operation, background-check limitations, available/locked/unconfirmed funds, split preparation/results, each edit type and storage/conflict warnings. Callback bodies for publish/apply and split execution/withdrawal remain unchanged. Read-only message assembly was extracted into testable helpers. No unknown node diagnostic is split into lines.

### Code Review

Summary: translated consent retains exact amounts and the original risks. One existing dialog defect was repaired.

- MAJOR, resolved — prepareMakerFundingUtxos set both a message and list items. The actual AppCompat 1.7.1 AlertController.setupContent bytecode shows that a non-null message skips attaching mListView; the asset choices were hidden. Reused the existing list-only dialog, then a separate retained confirmation with the selected immutable amount, coin count and original split warning. The final action rechecks readiness and the active-maker guard before calling the unchanged split path. Cancel remains available in both dialogs.

Validation: six cases cover actual MakerLadder commitments, one-sided publication, all unavailable-fund combinations, distinct reprice/repost/create/cancel previews, both asset choices and their separate confirmation calls, and nested storage/unknown diagnostic warnings. The dialog test mocks only Android dialog construction/Activity and exercises the real list/selection/confirmation methods, stopping before the action. 755 PandaDEX + 9 localization JVM tests pass (764). All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue, transport and diff checks pass. All 178 original DEX baseline files and all protected engine/public-key audit/node-JAR hashes remain unchanged. No device use; Fold R3GL805K7MB only.

Verdict: approve this increment with host validation. Full Fold rendering, switching, and the final action lifecycle remain unverified. Evidence: build/localization/dex-maker-dialog-validation.json (460 source hashes). Full signed release is incomplete. Next: notification and dynamic diagnostic coverage, remaining financial/accessibility review, safe Fold validation, signed versioned builds and authorized publication.


## PandaDEX notifications and watcher labels — 2026-10-18

Previous turn made progress and committed Maker consent/funding fixes as 40374d4. Revalidated all 460 checkpoint source hashes and a clean worktree. Read complete Notifier, DexKeepAliveService and PandaPools PoolKeepAliveService, notification callers/receipt gates, shared NotificationLabels/Language and AtomiX channel/notification refresh patterns. Notifier and DexKeepAliveService matched standalone PandaDEX. Reused PandaPools' exact onConfigurationChanged method, AtomiX's title/body binding and existing-channel rename pattern, and shared NotificationLabels entries.

Added 26 messages (5,267 total; 330 exact DEX aliases, 142 patterns). Partial/full fills retain buy/sell direction and original decimal formatting; verified order creation stays distinct from confirming trade proceeds. Recovery alerts preserve retained evidence/storage failure meaning and unknown nested diagnostic payloads. The foreground watcher updates its label after a configuration change only while started; it does not start a maintenance pass. Existing channel objects are renamed, retaining user importance/sound/vibration settings. Shared channel-label refresh also covers an inactive watcher.

### Code Review

Summary: presentation-only notification adaptation. No new findings in changed production code. Foreground lifecycle, scheduling, pass gates, wallet identity, settlement, persistence-before-notification ordering, deduplication, pending intents and notification IDs remain unchanged. All 176 other original DEX baseline files and all protected engine/public-key audit/node-JAR hashes are unchanged.

Validation: four new tests exercise real Notifier.fill/alert calls with mocked Android builders, checking both directions and partial/full titles, matching compact/expanded amounts, actual notify invocation, creation versus confirming proceeds, nested errors and retained recovery warnings. 759 PandaDEX + 9 localization JVM tests pass (768). All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue, transport and diff checks pass. No device use; Fold R3GL805K7MB only.

Verdict: approve this increment with host validation. Safe Fold notification/permission/channel preference validation is pending. The existing AppCompat path below API33 needs compatibility review for service notification refresh, because the current refresh hook follows platform configuration delivery. Previously delivered event alerts are not rebuilt when switching languages. Full signed release remains incomplete. Evidence: build/localization/dex-notice-validation.json (465 source hashes). Next: dynamic engine/evidence diagnostic coverage and remaining financial/accessibility review; safe Fold validation; signed versioned deliverables and authorized publication.


## Explicit service language refresh — 2026-10-18

Previous turn verified local commits but made no implementation progress. Revalidated all 465 checkpoint source hashes before editing. Read graph memory and queried graph vocabulary [language, parlons, notification, service, refresh]; broad traversal did not identify the Android callback gap, so source evidence was decisive. Parlons desktop Language.java supplies CopyOnWriteArrayList addIfAbsent/remove/listener dispatch; DesktopExplain.java supplies lifecycle cleanup, and DesktopLanguageTest exercises real retained draft state. Android's AppCompatDelegate documentation confirms the API32-and-earlier activity-context limitation (https://developer.android.com/reference/kotlin/androidx/appcompat/app/AppCompatDelegate).

Shared Language now dispatches an explicit callback on a changed language, isolates a failing callback, skips removed listeners and avoids recursive duplicate delivery. Six services register after successful foreground promotion and unregister in onDestroy: AtomiX, Future Cash, Casino, NFTwallet, PandaPools and PandaDEX. Their existing active-state guards and notification builders are reused. An import adapter runs last so pinned sources reproduce. NFTwallet preserves its current fgText when refreshing; the old stateText recomputation could replace a paused-needs-image status with progress. The replacement reuses AtomiX's direct current-status notification refresh.

### Code Review

Summary: inspected all changed code. Financial methods, node calls, timers, pass gates, identity checks and settlement are unchanged. Listener callbacks only refresh channels and existing notifications; removed/inactive services do not restart work. Existing channel settings and notification IDs remain. No outstanding finding in this increment. This does not establish full release readiness.

Validation: three shared callback tests cover explicit selection without a platform configuration event, all four languages, duplicate registration, repeated selection, removal during dispatch, a failing listener, continued view refresh and nested selection. Two MintService tests exercise the real refresh method with Android notification builders mocked, preserving paused status and proving no mint-engine calls beyond read-only progress. 1779 JVM tests pass across six affected modules and localization. All three debug variants and AndroidTest compile. All 19 pinned imports reproduce; catalogue (5267 messages/four languages), direct-transport and diff checks pass. All protected baseline/recovery/public-wallet-audit hashes and node JAR remain unchanged. No device interaction.

Verdict: approve this increment with host validation. Safe Fold rendering/notification/channel checks remain; API28–32 has source and host-test coverage, not device runtime evidence. Existing delivered event alerts remain in their original language. Core MinimaService still has startup/body/stopped strings and no immediate notification refresh; inspect and adapt next. Remaining engine diagnostics, financial/accessibility validation and signed release/publishing work also remain. Evidence: build/localization/service-language-validation.json (471 source hashes).

## Core notification and main-screen labels — 2026-10-18

Candidate is now 1.9.43/versionCode114. The repository pre-commit hook requires a versionCode bump whenever app/src changes; the initial commit was blocked at113, then metadata was bumped and all builds/tests rerun. Previous goal turn made progress as cb0acc7. Revalidated its 471 recorded source hashes and clean worktree. Read MinimaService notification/lifecycle/event callers, MainActivity dialogs/footer/actions, shared NotificationLabels, LanguageDialog, Language and their tests, and Parlons MaximaService build/updateNotification. Reused the proven explicit language callback and active-service guard, Parlons notification refresh without startForeground, existing channel rename pattern, ParamsActivity LanguageDialog, Shop dialog ownership/cleanup and shared immutable text/date bindings.

Added 16 messages (5283 total/four languages) for the core notification body, balance change, shutdown/restart, peer dialog, scanner prompt, reset warning and classic/block key-use footer. Startup notification reuses startup.starting. Cached block ID and timestamp supply the notification during language refresh, without a new node request or foreground promotion. Register only after successful foreground promotion; remove onDestroy and ignore late block callbacks after service destruction. Existing notification channel objects are renamed and retained on shutdown; only notification 1 is cancelled, preserving the user's channel settings.

MainActivity uses retained LanguageDialog controls for peer input and destructive reset confirmation. Reset still requires the original positive-button callback and preserves the complete seed/key-use backup warning. Wipe/restart actions and peer command remain unchanged. Shutdown progress is relabelled in place, with dialogs dismissed when the host is destroyed. Footer labels carry immutable cached values and locale-aware display time; language switching does not request keys/block again.

### Code Review

Summary: inspected changed production/test files and all 16 translations. No outstanding finding in this increment. Core data deletion (wipeData), event transport, command strings, node scheduling, seed handling and wallet state are unchanged. The notification listener cannot restart a stopped service. Mockito 5.12.0 is added only to app testImplementation, reusing the existing shared/integrated/Parlons host-test dependency. No production dependency added.

Validation: seven new JVM tests exercise real service notification control flow and builders with Android boundaries mocked; check startup versus cached-block text, literal block/timestamp preservation, active/stopped guards, OS refusal, successful-start registration, classic/block footer values without commands, and retained shutdown dialogs. All app variant tests pass: classic 129, block 129, Pandamonium 132; shared localization 12 (402 executions). All three debug builds and AndroidTest compile. First compile caught an unqualified this inside the node event listener; corrected to MinimaService.this before successful validation. Catalogue/diff checks and all protected engine, recovery, public-wallet-audit and node-JAR hashes pass. Integrated sources/adapters were unchanged; previous 19-import reproducibility evidence still applies. No device interaction.

Verdict: approve this increment with host validation. Fold rendering and actual notification/channel lifecycle checks remain; no reset/wipe/sign/send action was executed. Remaining engine diagnostics, financial/accessibility validation and signed build/publication work remain. Evidence: build/localization/core-language-validation.json (476 source hashes).


## Inbox delivery coin-list evidence — 2026-10-18

Previous turn made progress as abee8d4 (candidate1.9.43vc114). Revalidated all476 source hashes and clean worktree. Read the graph's miniMall Inbox review and current MainActivity delivery/lookup/polling/submission callers, complete NodeApi, CmdChain, Util, relevant StateNft functions, MerchDb metadata writer and the matching standalone/pinned source. Read NFTwallet BurialEvidence, departure-flow.inc and BurialEvidenceTest/DepartureEvidenceTest. Reused only the tested strict coin-list/ID/amount methods in DeliveryCoinList, generated directly from the NFT source with a different exception message. Util ID/amount validators are identical. No standalone donor change.

All four Inbox delivery read boundaries now reject null, false/string-status, missing/non-array responses, malformed rows, duplicate IDs, wrong tokens and invalid/missing IDs, addresses or token amounts. Initial lookup failures report unconfirmed evidence; polling failures retain the existing bounded retry policy and do not mark delivery. Hex coin IDs compare case-insensitively. Delayed reads and callbacks stop after host destruction. One new error label is available in all four languages (5284 total messages). Import adapter runs after existing adapters and reproduces the extraction and wiring.

### Code Review

Summary: this fixes the false-empty read defect. Submission loops, transaction commands, marking/persistence routines and protected financial modules are unchanged. No new issue found in the changed read-boundary code. Existing exact-output confirmation and durable recovery defects remain release blockers, now represented explicitly in release_blockers rather than only buried in historical limitations.

MAJOR remaining: valid absence plus an old nftposted marker still does not prove the buyer received the intended NFT; current completion paths can mark delivery on that basis. NFT Wallet's receipt/confirmed checks and departure-flow.inc provide the next reuse source, including destination/amount/state checks. Inbox needs durable intent and receipt handling for restart/retry, including unknown post outcomes and legacy markers.

MAJOR remaining: MerchDb.setMeta discards insertWithOnConflict's result, while posted/sent metadata is relied on for retry and completion. Review checked persistence and recovery before adding receipt storage. Ordinary-NFT CommsTransport acceptance and draft-refresh findings also remain from prior review; not re-certified here.

Validation: six new JVM cases exercise actual MainActivity lookup and polling callbacks with mocked Android/node/executor boundaries, including every malformed-reply category, legacy posted markers, retained in-flight state, closed hosts and hex-case changes. Reused validator accepts valid empty and populated snapshots as data; tests do not claim empty means delivery. 10 Inbox +12 shared language tests pass (22). All three debug builds and AndroidTest compile. All19 pinned imports reproduce; catalogue, direct transport and diff checks pass. All35 originally untouched Inbox files, all other protected/reviewed hashes, public-wallet-audit sources and node JAR unchanged. No device, node, wallet or signing operation.

Verdict: approve this read-boundary increment; request changes before financial release for the remaining evidence/durability gates. Evidence:build/localization/inbox-coin-evidence-validation.json (480 source hashes). Next: reuse exact-output receipt checks with durable intent/recovery in Inbox, then reconcile remaining AtomiX/NFT gates and complete safe Fold acceptance/signing/publication. Candidate remains1.9.43vc114.


## Inbox checked delivery storage — 2026-10-18

The previous status turn made no implementation progress; it confirmed 13 clean local commits through2c39084. Revalidated all480 source hashes. Graph expansion [inbox,receipt,journal,burial] matched mostly unrelated Mail/chat nodes; the saved Inbox checkpoint and actual files were more useful. Read current MainActivity delivery callers, complete MerchDb, standalone MerchDb metadata methods, NFTwallet LocalStore burialJournal/saveBurialJournal/completeBurial and StateNftActions collection burial, DexDb.claimOwnerTurn, existing Inbox callback tests and casino/Shop failure tests. No standalone donor changed.

Reused Inbox's existing SQLite insert and the checked result idiom in DexDb.claimOwnerTurn, adding MerchDb.setMetaChecked without changing the MetaStore interface or other callers. Both StateNFT post-record paths now wait for the I/O write result before releasing the transaction queue and starting their existing confirmation watcher. markSentAndMaybeAdvance stops before success or status advancement on write failure/exception. Executor rejection is handled. Failed storage keeps the line in nftSending in this host, with a four-language instruction to inspect the transaction before sending again. Auto-delivery notifications now show supplied Language.Message details, so this warning is not replaced by the generic retry prompt. Late callbacks after host destruction do not report success or start another queued transaction.

### Code Review

Summary: checked persistence fixes the ignored-result boundary and removes the race between nftposted persistence and polling. Seven failure-injection JVM cases cover actual database result/exception handling, both real post-record callers, completion failures/success sequencing, rejected executors and closed hosts. These are mocked-boundary tests, not a real SQLite power-loss or restart test.

MAJOR remaining: input absence plus legacy nftposted still does not prove the intended recipient received the exact output. Full NFT receipt/confirmed checks and a pre-signing durable journal are required. The current in-memory line lock does not survive host recreation and is not presented as restart recovery. Unknown post failures, ordinary-NFT acceptance and draft refresh remain to be reconciled. Do not publish the financial release on the strength of this increment.

Validation:17 Inbox+12 shared language JVM tests pass (29), all3debug and AndroidTest compile in 23s, all19 pinned imports reproduce,5285 four-language catalogue messages validate, direct transport/diff checks pass.34 originally untouched Inbox files and112 other/original mall map entries remain unchanged; the sole database addition is now in reviewed_inbox_storage_changes. All other protected/reviewed maps, wallet audit sources and node JAR remain unchanged. No device, funds, signing or publication operation. Candidate remains1.9.43vc114.

Verdict: approve this storage-result increment; request changes before release for exact-output and restart recovery. Evidence:build/localization/inbox-storage-validation.json (484 source hashes). Next: reuse NFTwallet BurialEvidence and durable journal flow for Inbox exact receipts before submission and recovery.


## Inbox StateNFT receipts and restart recovery — 2026-10-18

Previous turn made progress as27e1eb8. Revalidated484 source hashes and clean worktree. Continued from the graph memory/source findings, read the complete local Minima reference (large tool output was reread in bounded ranges), complete NFTwallet BurialEvidence and departure-flow.inc, relevant HistoryDb reservation/phase/recovery methods, complete TransactionRecovery, strict storedObject/txpow/inclusion helpers, receipt/journal tests, Inbox CmdChain/StateNft/NodeApi and all order-delivery callers. Reused those implementations and the established Robolectric SQLite testing pattern. No standalone donor or node-JAR change.

DeliveryEvidence is generated from BurialEvidence plus the exact stored-object, txpow-ID and three-confirmation inclusion checks from TransactionEvidence. It binds one input/output, token, token amount, recipient (hex or Mx) and the full state digest. DeliveryJournal adapts NFT Wallet's transactional reservations and phase transitions to a new Inbox SQLite table (schema3), binding each frozen line/collection to the original order, counterparty, destination, item snapshot and line identity. Payment token/amount are rechecked using MerchDb.recordPayment's gate even when an order lifecycle status was edited. All original collection inputs are frozen before the first signature. Multiple helpers/orders cannot claim a reserved input. Closed owners' PREPARED work can be safely reclaimed; POSTING/UNKNOWN/POSTED cannot be released by retrying.

DeliveryFlow preserves StateNft.transferCommands and CmdChain's pre-sign balance gate, but separates the final post: intent is committed before preparation/signing, then POSTING is committed before sending txnpost. Receipt loss, malformed/empty acknowledgements and timeouts keep the input reserved. Known receipts require txpow onchain proof with nonzero block identity, depth>=3 and consistent tip/block. Unknown receipts are recovered from exact matching history transactions with the same inclusion gate. Recovery uses four-entry pages, four-page batches, an oversized-response shrink path and20 bounded polling attempts. No recovery path sends an unknown transfer again. Confirmed recipient outputs may have been spent afterward; inclusion proves the intended original transfer without relying on the sender's current UTXO list.

The old stateful missing-input completion, submission and departure loops are removed. Stateful Sent UI, automatic skip and all-lines completion read the validated journal. Legacy posted/sent markers remain preserved and unconfirmed; they cannot initiate a replacement transfer or become fabricated receipts. Reopening an existing attempt presents Resume delivery, with an explicit translated explanation that pending/unknown transfers are checked without sending again. Three new strings in all4languages;5288 catalogue messages.

### Code Review

Summary: exact receipts and durable reservation/phase evidence replace the prior unsafe absence rule. Review added payment-token/amount revalidation, safe abandoned-preparation release and the Resume UI. Tests cover SQLite failures/rollback, database reopen/schema migration, active competing helpers/orders, malformed persisted evidence, stale order identity, all original collection members, exact recipient/amount/state checks, shallow/missing inclusion, unknown-response recovery and lost callbacks after host closure. Old tests targeting the removed departure helpers were replaced by controller/journal tests; the original shared validator and plain-NFT checked-write tests remain. No production CmdChain, StateNft, transport, financial engine, wallet audit or node changes.

Validation:35 Inbox+12 shared language tests pass (47). This includes10 real SQLite journal tests,9 actual controller tests with mocked node/command execution and6 reused exact-evidence cases. All3debug and AndroidTest compiled in28s; final additional regression tests passed in6s. All19 pinned imports reproduce; catalogue/direct transport/diff checks pass.34 original Inbox files and112 mall protected-map entries remain unchanged; all other protected/reviewed maps and wallet-audit/node hashes remain unchanged.499 source hashes recorded in build/localization/inbox-delivery-validation.json. Candidate remains1.9.43vc114. No device/funds/signing/publication operation.

MAJOR remaining, separate paths: ordinary NFT CommsTransport acceptance still permits an empty receipt fallback; inspect pending responses and durable delivery handling there. Async order refresh still rebuilds the unsent reply form. These replace the now-resolved StateNFT blockers in the current checkpoint. Older AtomiX/NFT findings and safe Fold acceptance still need reconciliation before final signed publication.

Verdict: approve this StateNFT receipt/recovery increment; request changes before the full release for the remaining paths and runtime acceptance.


## Inbox reply drafts and refresh ownership — 2026-10-18

The user-requested local checkpoint 36a9587 saved this increment as work in progress with three failing callback tests. The failures were uninitialized mock Activity lifecycle methods, not passing production evidence. Reused the existing InboxCoinEvidenceTest.Host isFinishing/isDestroyed stubs; all three tests now pass without weakening their draft, transport or navigation assertions.

Reused AtomiX MainActivity.rememberOtcDraft and its focus-deferred render pattern after reading the relevant callers, watcher and editor setup. Current Inbox, pinned standalone Inbox, Mail/Shop and Parlons searches found no compatible per-order saved-state helper. ReplyDrafts adds order keys, exact raw text/selection, Bundle restoration, and submission identity/revision checks. Incoming order refreshes wait while the editor has focus, preserving its EditText and composing span. New fields restore the raw draft rather than binding it to translated text; language bindings remain on hints and labels. Identity setup and scans use the same current-order refresh helper. Navigation to another order is preserved when a previous save finishes.

The send button retains the draft until insertChat succeeds. A false return, exception or rejected executor preserves text and allows retry. Duplicate submissions for the same order are suppressed while that local write is pending. Successful local saves clear only the submitted revision; subsequent edits, including edits back to the identical string, survive. This acknowledges local persistence, not network confirmation. Closed hosts suppress UI callbacks. No transport, financial engine, schema, donor source or node-JAR changes.

### Code Review

Summary: draft and asynchronous view ownership are explicit and match the existing AtomiX pattern. Six real EditText/Bundle tests cover Unicode, cursor selection, composition, focus, navigation/rebuild state, duplicate clicks, save failures, changed revisions and host closure. Three MainActivity callback tests cover the actual focused-refresh boundary, failed writes preventing transport, successful writes preserving another visible order, and newer drafts surviving late success. Shared language tests cover bound hint changes leaving raw user text untouched.

Validation: 44 Inbox + 12 shared tests pass (56). All three debug variants and the Pandamonium Android test APK compile in 26 seconds. All 19 pinned imports reproduce; transport, catalogue and diff checks pass. The catalogue has 5289 messages in all four authorized languages. 506 source hashes are recorded in build/localization/inbox-drafts-validation.json. All protected engine maps, wallet-audit hashes and the node JAR remain unchanged; the reviewed MainActivity hash is updated for this scoped change. Candidate remains 1.9.43/vc114. No Fold operation, release signing, push or publication occurred.

Verdict: approve this draft-preservation increment. The full release still requires the ordinary NFT pending/receipt path, reconciliation of earlier AtomiX/NFT findings, safe Fold acceptance and signed publication.


## Ordinary Inbox NFT receipts and mined-header recovery — 2026-10-18

Previous turn made progress as f372f91. Revalidated the clean worktree and 506-source checkpoint. Read the current Inbox sendNft, full CommsTransport, NodeApi, DeliveryFlow and DeliveryJournal; NFT Wallet PreparedSend, PreparedSendEvidence, TransactionEvidence, TransactionRecovery, Coin, TxnUtil, relevant TxnBuilder data classes and HistoryDb reservation/phase methods, and their evidence/flow tests. Checked native sendnosign/state/change construction, sendsign file output and sendpost mining behavior in the local core source. The proven building block is reused directly: Inbox now depends on the already integrated NFT Wallet module and calls a small public OrderPaymentEvidence entry point. The original wallet evidence classes and financial engines are unchanged.

The wrapper preserves the requested recipient form (including Mx), quantity, zero burn, native input selection and wallet-owned change. It verifies the exact order-reference hex stamp at state port 1 and a state-storing recipient output before saving the intent. Commands use a generated file handle and the existing restricted signedtransaction filename shape. The signed file is viewed and checked against the frozen intent and reference before any post.

PlainDeliveryJournal adapts the existing SQLite reservation/phase pattern to an order-bound table (schema 4). Paid token/amount, current lifecycle status, counterparty, items and destination are rechecked through DeliveryJournal.fresh. The exact input/output intent is committed before signing; POSTING is committed before sendpost. Both journal types check the other's reserved input IDs in the same database transaction, preventing an ordinary and stateful attempt from claiming the same coin. Closed owners' never-posted work can be reclaimed. Posting/unknown/posted work remains reserved across restart. False, pending, empty or lost post results never become delivered. Old marker-only records are retained but remain unconfirmed and cannot authorize another transfer.

Native sendpost returns the TxPoW before mineTxPoWAsync. Its mined header can have a different TxPoW ID. Review therefore extended both the ordinary and stateful controllers to search bounded history for the exact saved transaction when the returned ID has no sufficient chain proof. Only an exact receipt with three-confirmation inclusion is committed as confirmed. Recovery is read-only, uses four-entry/four-page batches with oversized-response shrinking, and stops after 20 polling attempts. MainActivity Sent labels, automatic skips and all-lines advancement use the validated journal. Existing translated Resume and unconfirmed controls cover the new path; no new catalogue strings.

### Code Review

Summary: direct reuse keeps the wallet's multi-input, amount-scale, destination, change, receipt and inclusion checks intact. Durable order binding and shared reservations protect the new host. Review found and fixed the pre-mining-header recovery issue in both delivery paths. Transport and signing error ambiguity is handled conservatively: after POSTING, any uncertain error stays reserved. Pre-sign and pre-post database failures stop the workflow.

Validation: 60 Inbox, 240 NFT Wallet, and 12 shared language tests pass (312). Twenty-one new cases cover ordinary request/reference evidence, Mx recipients, missing/extra outputs, database failures, both-direction reservation conflicts, abandoned versus live owners, stale order identity, schema 3 migration, lost callbacks, changed signed references, shallow inclusion, bounded polling and changed mined headers. No node, signing or funds operation occurs in these tests. All three debug apps and the Pandamonium Android test APK compile in 32 seconds. All 19 pinned imports reproduce; catalogue/direct transport/diff checks pass. 521 source hashes are recorded in build/localization/inbox-plain-validation.json. All protected maps, original NFT Wallet evidence sources, wallet-audit hashes and node JAR remain unchanged; reviewed Inbox journal/controller/schema/MainActivity hashes are updated for this scoped change. Candidate remains 1.9.43/vc114. No device operation, release signing, push or publication.

Verdict: approve the ordinary NFT delivery and mined-header recovery increment. The recorded Inbox receipt and draft blockers are resolved. This does not prove full release completion: earlier AtomiX/NFT findings still need source reconciliation, followed by safe Fold acceptance and final signed publication.


## NFT History ownership and release checklist reconciliation — 2026-10-18

Previous turn made progress as c635ce2. Revalidated all 521 saved source hashes and clean Git status. Current-source review confirmed the old static OWN_CACHE in NFT History still existed: it could survive wallet/session changes, and a missing response became a cached negative. Read the complete relevant HistoryView badge path and callers, BaseView/MainActivity lifecycle and address-pool refresh, standalone NFT Wallet's identical implementation, sibling UTXO SendView and History search results, NFT PreparedSendEvidence's strict reply checking, and the native checkaddress response contract. The existing lookup is reused directly. Its response shape differs from scripts/default-address evidence, so the minimal adapter validates status, Boolean relevance and the requested hex/Mx address at this existing display boundary.

Removed the process-wide cache and local-address shortcut. Every newly opened address detail asks the current node. Malformed/failed/mismatched replies use the existing translated UNVERIFIED label; a valid explicit false uses NOT YOURS. Hex comparisons remain case-insensitive and Mx comparisons case-sensitive. The node relevance meaning is unchanged; the badge does not certify spendability. Existing NodeApi host-lifecycle callback filtering remains unchanged. No signing, journal, transaction, seed or persisted history behavior changed.

### Code Review

Summary: this closes a confirmed stale display and false-negative issue with a smaller lifetime and explicit reply validation. Five regressions invoke the actual private HistoryView callback and cover repeated opens, new HistoryView instances, valid true/false replies, malformed/failed replies, address forms, command-injection rejection and timeouts. The tests mock transport and label objects; they do not replace Fold visual acceptance.

Validation: all 245 NFT Wallet JVM tests pass. Pandamonium debug builds in 27 seconds. All 19 pinned imports reproduce; catalogue and diff checks pass. All 19 modules declare the shared localization dependency, have locale/layoutDirection/screenLayout handling on their activities, and contain Language bindings. These checks prove integration hooks, not complete inner-text or visual coverage. The catalogue remains 5289 messages in four languages. All protected financial maps, wallet audit and node hashes remain unchanged. 524 sources are recorded in build/localization/nft-ownership-validation.json. Candidate remains 1.9.43/vc114. No device operation, signing, push or publication.

Verdict: approve this ownership display fix. Current release checklist now distinguishes completed source hooks and Inbox work from the remaining text, financial-flow and Fold acceptance reviews. Earlier dated limitations remain historical evidence.

## Local work checkpoint — 2026-10-18

Saved at the user's request before further implementation. NFT distribution now persists the pending batch intent, waits for the matching confirmed journal receipt before advancing recipients, validates saved schema-2 jobs, holds legacy/malformed jobs for review, and gives one live controller ownership. Canonical importer sources and generated copies match.

Validation observed for this checkpoint: `:integrated-NFTwallet:testDebugUnitTest` completed successfully in 24 seconds; 252 tests across 37 suites, zero failures, errors or skips. Log: `build/localization/nft-distribution-tests.log`. This is an in-progress checkpoint, not release approval. Dedicated saved-job parser and exhausted-retry regressions, final code review, pinned-import verification and full candidate builds remain pending for this increment. The previous detailed validation remains `nft-ownership-validation.json`; it predates these distribution changes.

Candidate remains 1.9.43/vc114. No device operation, signing, push or publication was performed for this checkpoint. The current release checklist above remains open.


## NFT distribution confirmation and restart validation — 2026-10-18

Implementation checkpoint: 5b93bcb. Distribution uses the existing HistoryDb transaction journal and TransactionEvidence receipt checks, preserving the UTXO batch/change flow. A posted batch retains its pending recipients until the exact journal attempt is confirmed. Confirmed progress is saved before the next batch. Subsequent batches require the exact confirmed change coin. One live controller owns the job; callbacks after close cannot advance it. Schema-2 saved plans validate types, bounds, frozen recipients, token and economics. Legacy or unreadable records remain preserved for review; no automatic migration invents confirmation evidence.

### Code Review

Summary: reviewed DistributeJob, DistributeManager, the lifecycle hook and adapter, the existing journal/builder boundaries, and controller/parser regressions. No additional blocking finding was identified in the reviewed paths. Uncertain or missing journal evidence remains held; it does not authorize retries. Exhausted retries are persisted before clearing, so failed removal and restart cannot create another batch.

Validation: 258 NFT Wallet and 12 shared localization JVM cases pass (270 total, zero failures/errors/skips). The distribution cases include confirmed restart, failed saves/clears, concurrent controllers, late callbacks, malformed/altered saved plans, repeated recipients, Unicode names and exhausted retries. All three debug variants and the Pandamonium instrumentation APK build; instrumentation was compiled, not run. All 19 pinned imports reproduce, direct transport verification passes, and 5289 catalogue messages validate across four languages. Protected financial source maps, minimaWallet audit hashes and the node JAR remain unchanged. Detailed checkpoint: build/localization/nft-distribution-validation.json (529 source hashes).

Verdict: approve this scoped confirmation/restart increment. Legacy-job reconciliation remains a compatibility limitation; malformed records remain held. These host tests do not establish real-chain execution or Fold acceptance. Candidate remains 1.9.43/vc114. No device changes, signing, push or publication. The remaining release checklist is still open.


## NFT local activity history — 2026-10-18

Previous turn completed distribution validation in 2e8a862. Current-source review confirmed that NFT History rendered only loadNodeTx, hiding its persisted local audit rows. Read the current full HistoryView and HistoryDb, transaction recovery/recording, journal tests, shared language bindings, and UTXO HistoryView/local-row helpers and localization tests. Reused UTXO's local row and detail presentation with NFT Wallet's existing Sheet/copy helpers. Its input-overlap resolver and dismiss/delete action do not fit the exact NFT journal contract and were not imported.

LocalHistory is a read-only projection of the existing local rows and validated attempts. Journal phases override stale display status. Missing/unreadable journal evidence stays unverified. Exact confirmed rows are suppressed from the local section only once their transaction ID is present in downloaded node history; the database records remain intact. Tapping reloads the outcome before opening details. No retry, delete or financial mutation is exposed. Amounts and token names remain literal; local amount labels do not claim a completed debit. Inputs are labelled as inputs, not spent inputs. The existing 1000-row History display bound also applies to local records; older records remain stored.

Added eight labels in English, Simplified Chinese, Russian and Ukrainian, and clarified that export uses filtered downloaded on-chain history. Status and detail labels use rebindable Language messages; export payloads and node parsing are unchanged. No database schema, transaction journal, recovery, signing or ownership-check implementation changed.

### Code Review

Summary: local pending and interrupted activity is now visible without weakening the evidence needed to call it confirmed. No blocking issue identified in the changed presentation/projection paths. Validated the six phases, corrupt journal fallback, legacy records, exact duplicate suppression, database reopen and fresh details. Widget doubles exercise the actual render/click methods; they are not visual acceptance.

Validation: 266 NFT Wallet plus 12 shared localization JVM cases pass (278 total, zero failures/errors/skips). All three debug APKs and the Pandamonium instrumentation APK build. All 19 pinned imports reproduce; direct transport and catalogue checks pass (5297 messages/four languages). Protected financial maps, minimaWallet audit and node-JAR hashes remain unchanged. The prior fresh ownership snippet remains byte-identical. Evidence: build/localization/nft-local-history-validation.json (537 source hashes).

Verdict: approve this scoped local History increment. Read-only ADB check of authorized Fold R3GL805K7MB returned device not found; no package/device data was changed. Remaining review, Fold acceptance, signed versioned artifacts and publication remain open. Candidate remains 1.9.43/vc114; no signing, push or publication.


## Signed multilingual candidates — 2026-10-18

Built all three release variants from clean source commit 4bc8b62535623438023ae9f12fefc179c487cd34 using the existing app/build.gradle family signing configuration and locally configured credentials. No signing keys or passwords were copied or printed. Reused the established dist candidate naming. The original 1.9.41/vc112 APKs remain in apks/base/app/build/outputs/apk/{classic,block,pandamonium}/release and were verified before comparison.

All three 1.9.43/vc114 candidates pass apksigner verification and match the original 1.9.41 family certificate (SHA-256 eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f). Verified each APK's package ID/version, non-debuggable release metadata, ARM64-only native libraries and 16 KiB ZIP alignment. Inspected the compiled resources: all 5297 catalogue entries are present in each of the default English, Simplified Chinese, Russian and Ukrainian configurations, and the manifest points to a locale-config declaring en/zh-Hans/ru/uk. Android's release resource-path shortening was resolved through the resource table rather than assuming a res/xml filename. This proves packaging, not translation quality or runtime acceptance.

Release Gradle tasks completed successfully in 1m41s, including vital lint. All 537 checkpoint source hashes remain unchanged. Detailed evidence: build/localization/signed-candidates-validation.json; baseline signature evidence: build/localization/release-baseline-signatures.json; build log: build/localization/signed-candidates-build.log.

Versioned signed candidates and SHA256 sidecars are now in /Users/eurobuddha/Projects/minima/apks/base/dist:
- minima-core-PandaBear-1.9.43-candidate.apk
- minima-core-BlackBear-1.9.43-candidate.apk
- minima-core-Pandamonium-1.9.43-candidate.apk

A colocated bear-languages-1.9.43-candidate.json records source commit, signatures, hashes and pending gates. These candidates have not been installed or published. Remaining source review and Fold acceptance still apply; rebuild final artifacts after any implementation changes. The last authorized Fold check returned device not found. No other device was used.

Current-source reconciliation confirms the remaining NFT notes are substantive: WalletTools callback status writes lack per-operation ownership, unlike SendView's generation checks; PreparedSendEvidence.quick requires exact equal split totals while the bundled sendnosign rounding behavior remains to resolve; PreparedSend has no terminal unsigned/signed-file cleanup. Preserve exact economics and recovery evidence when addressing those paths.


## NFT Tools status ownership — 2026-10-18

The previous turn produced signed candidates from code commit 4bc8b62 and pushed evidence as 105b9dc. Current-source inspection confirmed WalletTools asynchronous callbacks still wrote directly to one status callback. Reused SendView's generation equality check and the existing ToolReviewTest/PreparedSendFlowTest callback fixtures. Read the current Tools, its WalletView caller, TxnBuilder and PreparedConsolidation callback boundaries, selection review adapter and snippet, and corresponding standalone NFT/UTXO paths and tests. The standalone Tools paths have the same unowned status writes.

Each accepted Review now claims a generation for its display status and passes the same callback through Split, selected Merge, native consolidation, Distribute and recursive Untrack. Opening or cancelling an unaccepted dialog does not claim ownership. Validation messages can claim their review's status. Older asynchronous replies retain financial history updates, existing reservation cleanup, matching-only selection clearing and reload behavior, but cannot overwrite a newer accepted review's message. Closed hosts suppress display status. Language messages pass through unchanged and remain rebindable. No transaction calculation, command, signature, database schema or journal transition changed.

### Code Review

Summary: the display update now has the same explicit ownership boundary as the existing asynchronous Send review. No blocking finding in this increment. Reviewed every changed source/test/adapter and the call chain. Existing callback outcome and native-admission tests were adapted to private helper signatures; assertions were preserved.

Validation: 273 NFT Wallet plus 12 shared localization JVM tests pass (285 total, zero failures/errors/skips). Seven new regressions cover stale posted/failed/unknown callbacks, delayed address errors, changed-selection warnings, cancelled newer reviews, native consolidation, recursive Untrack and closed hosts. They verify history effects and distribution cleanup continue. Pandamonium debug and instrumentation APK compile in 40 seconds; instrumentation was not run. All 19 pinned imports reproduce, transport/catalogue/diff checks pass; catalogue remains 5297/four languages. Other two debug variants remain unchanged from the preceding validation. All protected financial maps, minimaWallet audit and node-JAR hashes match. Evidence: build/localization/nft-tool-status-validation.json (539 source hashes).

Verdict: approve this scoped callback-status fix. Quick Send nonexact split compatibility and unsigned/signed-file lifecycle remain open, alongside other app reviews and Fold acceptance. Existing signed candidates in base/dist still describe source 4bc8b62 and must be rebuilt before final release. No device operation, new signing or APK publication occurred in this increment.


## Quick Send exact split amounts — 2026-10-18

The local and fork feature branch were clean at bd08ee3 before this increment. Current-source inspection confirmed that sendnosign divides every requested amount by split without retaining a rounding remainder; send does retain one. Read core/Minima/src/org/minima/system/commands/send/sendnosign.java in full, send.java's output construction, Token scaling and MiniNumber decimal limits; checked the bundled node JAR's multi parser with javap. Also inspected the current and standalone NFT SendView, current WalletTools.doSplit and its ToolReviewTest remainder regression, minimaWallet's separate split caller, PreparedSend/Evidence, their complete tests and importer adapters. Graph vocabulary [nft, send, split, transaction, prepared, wallet] and BFS located the node send/transaction sources; current files establish the fix.

Reused WalletTools.doSplit's round-down calculation with the exact remainder added to the final coin. Quick Send uses sendnosign's existing multi list with split:1, preserving node input selection, default change and separate token-burn transaction. Multi-coin amounts are frozen before the unsigned command; quote validation checks every amount against the same frozen decimal precision, as well as the exact total. Minima uses the node's 44 decimal places. Tokens require known precision from 0 through 44; insufficient amounts or unavailable/invalid precision stop before files/history/signatures. One-coin sends and the Inbox evidence entry point retain their existing behavior. The original intent/reservation-before-signing and exact signed/post receipt checks remain intact. The four-language confirmation explains that the last coin includes any rounding remainder. No node JAR or standalone donor changed.

### Code Review

Summary: the fix restores non-divisible Quick Send amounts while keeping exact recipient, amount, change, fee and transaction checks. Read every changed Java source, test, catalogue entry and generated resource diff. Existing source adapters copy both canonical files; no new importer layer is needed.

Findings: no blocking finding in this scoped increment. Unknown token precision deliberately refuses a multi-coin send rather than guessing; a later valid balance refresh can supply it. The confirmation row wraps its translated value, but final Fold visual/large-font acceptance remains outstanding. Transaction-file lifecycle is a separate existing review item.

Validation: 280 NFT Wallet, 60 Inbox and 12 shared localization JVM cases pass (352 total; zero failures/errors/skips). Seven new tests cover known remainders, smallest supported unit, all split counts, exact native/token fees, underpayment and unequal redistribution, absent precision, metadata changes during preparation, altered signed outputs and late post replies. The existing equal-split and Inbox cases still pass. All three debug APKs and the Pandamonium instrumentation APK compile (BUILD SUCCESSFUL in 51 seconds); instrumentation was not run. All 19 pinned imports reproduce; catalogue (5297 messages/four languages), direct transport and diff checks pass. The protected financial maps, minimaWallet audit sources and node JAR match. Five historical catalogue/resource hashes are explicitly superseded by this reviewed single-message change. Evidence: build/localization/nft-quick-split-validation.json (541 source hashes).

Verdict: approve this scoped split fix. The first Gradle invocation used colon-separated module names and failed before running tests; the successful invocation used the declared integrated-NFTwallet/integrated-merchinbox names. Last read-only Fold R3GL805K7MB check returned device not found. No other device, live node, key or funds were used. Existing signed 1.9.43 candidate APKs remain from 4bc8b62 and require a final rebuild; remaining reviews, Fold acceptance and authorized release publication are still open.


## Quick Send temporary-file lifecycle — 2026-10-18

The preceding goal turn made progress as a2a2c39; this increment began with its clean worktree. Read the original graph review note query_20261017_134634_bear_release_checkpoint__nft_native_quick_send_dur.md and current NFT/Inbox flows and recovery. Inspected core sendsign/sendpost and MiniFile.createBaseFile, shared DirectNodeApi and its tests, EmbeddedNodeTransport, MinimaReceiver's FILE actions and guards, NodeFiles path/delete helpers, Filez's complete NodeApi wrapper, and current/sibling usages. No existing NFT temporary-file cleanup was present. Reused the existing Filez FileCommand transport, serialized host mutation queue and canonical base-folder guards; added a narrow NFT wrapper and lifecycle calls through the existing prepared-send adapter.

### Defined lifecycle

- An unsigned file becomes eligible only after the node acknowledges its creation. A signed file becomes eligible only after it is viewed and matches the saved exact intent.
- After a complete posted receipt is persisted, or a definite pre-post failure is acknowledged (including NOT_SUBMITTED when reserved), request best-effort removal of that attempt's eligible files. File removal never triggers another send or changes the reported financial result.
- Any transport-unknown preparation/signing/read, unknown post, failed journal outcome write, closed/interrupted host or process loss retains the files. A command may still be executing. Unknown/unverified signed files are retained. Cleanup errors also leave files available for manual inspection through existing Filez. There is no age-based purge, directory sweep, automatic re-signing or replay after restart.
- Recovery continues to use persisted intents/receipts and chain inclusion; file presence, deletion or age supplies no transfer evidence and never releases a reservation. Older leftover files are deliberately not swept because ownership/current use is not established.
- The narrow wrapper accepts only nft_send_<32 lowercase hex>.txn and signedtransaction-<1..20 digits>.txn. It requires a successful matching stat reply, an existing non-directory with a positive size and the exact canonical root path before requesting deletion. Alias, malformed, missing and directory replies cause no deletion. The host rechecks base containment and protected directories when executing the existing file action. These operations use the existing trusted local file namespace; no new external file endpoint is exposed.

### Code Review

Summary: the normal completed-flow file buildup is addressed without using cleanup as financial evidence. Reviewed every changed source/adapter/snippet/test and its existing host file call chain. No blocking finding in this increment. Cleanup is best-effort; retained interruption/unknown files are an explicit conservative policy, not a pending automatic purge requirement. The Inbox flow remains conservative and retains its files; its read-only recovery was inspected and is unchanged. The earlier NFT file-lifecycle review item is now defined and covered for both normal completion and retention paths.

Validation: 288 NFT Wallet, 21 direct API and 12 shared localization JVM cases pass (321 total; zero failures/errors/skips). Eight new regressions cover persisted receipt ordering, definite pre-post failure, unverified signed contents, unknown replies at all stages, late replies, failed journal acknowledgements, cleanup exceptions/failure replies, exact names, malformed/directory/alias stats, duplicate replies and closed hosts. These use synthetic callbacks and verify deletion requests, not device filesystem effects. Pandamonium debug and instrumentation APK compile (BUILD SUCCESSFUL in 37 seconds); instrumentation was not run. PandaBear/BlackBear binaries and their inputs remain unchanged from a2a2c39. All19 pinned imports reproduce; catalogue5297/four languages, direct transport and diff checks pass. All protected financial maps, minimaWallet audit sources and the node JAR match. The two PreparedSend hashes from the previous scoped review are explicitly superseded. Evidence: build/localization/nft-prepared-files-validation.json (544 source hashes).

Verdict: approve this scoped lifecycle change. No device, live node, seed or funds were used. Existing signed 1.9.43 candidates remain at4bc8b62 and require final rebuilding. Other app reviews, Fold acceptance and authorized release publication remain open.


## AtomiX OTC board market capture — 2026-10-18

The previous source checkpoint is b26e1bc, verified clean and identical to the GitHub fork branch before this increment. The intervening status reply verified saved work; this increment resumes implementation. Reused OtcMessage's captured TradingContext pattern in the existing currency adapter. Inspected integrated OtcBook/OtcOffer/OtcController, TradingContext, MainActivity/service scan callers, CommsTransport, CommsIdentity, existing currency/amount guards and their tests. Standalone apks/atomix has the same scan bug; apks/usdtSwap uses a single fixed board and cannot supply a multi-market guard. The new regressions reuse SwapOrderBookTest's synthetic signed-coin verifier and OtcCurrencyGuardTest's mocked transport/controller fixtures.

- OtcBook captures one market for notification and coin reads. A selection mismatch before the read, on its reply or after verification rejects the scan. It cannot reread the newly selected board halfway through an old scan.
- Verified offers receive local scan provenance. The marker is neither serialized nor read from peer JSON. OtcController rejects unknown/wrong-market offers or an inactive controller before persistence or sending. The seven signed JSON fields remain unchanged.
- Valid matching offers still use the existing proposal path in both markets. Notification registration failure still permits a read of the captured market. Signature filtering, freshest-per-signer selection and withdrawal tombstones are retained.
- The existing translated market error covers all four languages. No catalogue or wire-protocol change. The canonical currency adapter and generated sources reproduce; existing invalid-amount fixtures now carry a valid local market so they continue to exercise amount validation.

### Code Review

Summary: the scan no longer combines two selected markets, and an offer cannot acquire the proposal controller's market by assumption. Read the full changed production code, adapter, new test and modified amount fixture; checked callers, serialized fields, failure paths and existing message translation. No blocking finding in this bounded change.

Validation: 330 AtomiX plus 12 shared localization JVM cases pass (342 total; zero failures/errors/skips), including nine new regression methods covering both markets, notification success/failure, delayed reads, switches during verification, JSON provenance forgery, signature filtering, withdrawals, read failure, proposal rejection and matching-market dispatch. Pandamonium debug and AndroidTest APKs compile (10 seconds); instrumentation was not run. All 19 pinned imports reproduce; 5297 messages in four languages, direct transport and diff checks pass. Evidence: build/localization/atomix-board-validation.json (547 source hashes). OtcBook is explicitly removed from the unchanged AtomiX map and recorded as reviewed; every other protected map, minimaWallet audit source and node JAR still matches. PandaBear/BlackBear sources and debug artifacts remain unchanged.

Verdict: approve this scoped market-attribution fix. This does not establish offer freshness across a switch away and back, consent freshness across controllers, ordinary SwapOrderBook scan/publish safety, responder asynchronous locking or broadcast confirmation; those remain in the AtomiX review. No live funds, node or keys were used. The explicit read-only ADB check for Fold R3GL805K7MB returned device not found; no other device was accessed. Final Fold acceptance, other app reviews, final signed rebuild and publication remain outstanding. Existing signed candidates were built from 4bc8b62 and require rebuilding.


## AtomiX ordinary order market context — 2026-10-18

Previous goal turn: progress, committed/pushed as 7992bda. This increment began with that clean worktree. Reused OtcBook/OtcMessage market capture and PublishGate generation checks; inspected current Order, SwapOrderBook, SwapTake, initiating engine paths, foreground/background publish and scan callers, currency switching, transport, config codec and tests. Standalone atomix has the same active-address rereads; single-market usdtSwap supplies no multi-market protection. The new canonical order-context adapter preserves the signed order/config codecs, signature verification, freshest/tombstone merge and existing balance-read failure fallback.

- Locally created orders retain their creation market. Parsing peer JSON clears that attribution; a verified board scan supplies it. Ordinary trade entry rejects unknown or mismatched maker markets before secret generation, persistence or locking. OTC execution keeps its existing explicit saved-deal market checks.
- Scans use one captured board through notification/read/verification. Publication uses the order's market for balance lookup and destination. Foreground/background callers pass their existing generation through ladder preparation and the balance callback; superseded requests stop before signing/posting. A change during signing also cancels before transport admission. Late success cannot update the current market's success stamp or armed order.
- Currency switching bumps the existing publish generation. Delayed oracle callbacks recheck both market and generation before starting publication. A completed buy sends its hashlock notification to the maker's original market even if the selected market changes before the callback or during sealing.
- Two new messages cover changed-market failures and stopped sweeps in English, Simplified Chinese, Russian and Ukrainian. Exact display mappings cover scan/publish/update/withdraw/swap wrappers; other captured diagnostics remain literal. Catalogue: 5299 messages. All preceding translations are byte-for-byte unchanged as JSON values.

### Code Review

Summary: the verified scan market now survives into ordinary trade dispatch, while delayed publications retain their caller's intent generation. Reviewed changed sources/adapter/tests and the relevant callers, config and transport boundaries. No blocking finding in this increment. The signed order still has only mpk/eth/cid/ts/bal/pairs; local attribution never enters the wire payload.

Validation: 342 AtomiX plus 12 shared localization JVM cases pass (354 total; zero failures/errors/skips), including 12 new methods covering both markets, scan boundaries, wire forgery, tombstones, delayed balance success/failure, stale preparation, changes during signing, late results, valid publication, both trade directions and post-lock handshakes. All three debug APKs and Pandamonium AndroidTest APK compile; instrumentation was not run. All 19 pinned imports reproduce; catalogue, transport and diff checks pass. The 1.9.41 baseline remains an ancestor. Evidence: build/localization/atomix-order-context-validation.json (553 source hashes). Three changed AtomiX files are moved from the unchanged map to reviewed changes. Explicitly superseded shared-adapter/catalogue/service hashes are recorded; all other protected sources, minimaWallet audit sources and the node JAR match.

Verdict: approve these market-attribution and pre-admission checks. This does not cancel a command already admitted to SignGate/node queues, prove chain inclusion, fix consent freshness across controllers, prove scan freshness after switching away and back, or certify responder/coin-preparation async locking. Those remain release review work, along with OTC publication context and host teardown. No live keys, funds or device were used. Fold acceptance, other app reviews, final signed builds and authorized publication remain open. Existing signed candidates are from 4bc8b62 and require rebuilding with the newer catalogue and source.


## AtomiX queued publication validity — 2026-10-18

Previous goal turn made progress as 0dffcfb; this turn verified that clean source checkpoint. Inspected SignGate and its tests, CommsTransport, NodeApi/WriteSafety and their callbacks, ordinary/OTC publish callers, PandaDEX CommandSession and guarded NodeApi, DirectNodeApi.Request and tests, EmbeddedNodeTransport dispatch, and standalone atomix/usdtSwap transports. Reused the existing PandaDEX fail-closed BooleanSupplier guard and DirectNodeApi guarded Command overload. No host, shared API, node JAR or signing-queue implementation changes.

- Ordinary and OTC publications retain their market/generation guard through SignGate, NodeApi admission and the shared mutation worker's Request.begin boundary. An edit, withdrawal or currency switch can stop work still queued before execution. Invalid/missing/throwing guards fail before the durable marker when caught at admission; the signing slot is released.
- OTC publication captures the destination before signing and rejects stale success callbacks. Explicit OTC edits and withdrawals now bump the existing generation. Other messages, including post-lock notifications and negotiation traffic, retain their existing unguarded publication-generation behavior.
- The earlier suspicion about pending:true being reported successful was disproved in the current real call chain: WriteSafety.completeReply and NodeApi already reject it and retain the write pause. CommsTransport now also enforces that boundary defensively; it no longer contains an apparent pending-success branch. This is not proof of chain inclusion or of every status:true result's transaction shape.
- The new OTC error uses the existing four-language OperationMessages mapping. Catalogue remains 5299. The signed payload formats are unchanged.

### Code Review

Summary: queued stale board publications now use the same dispatch boundary already used by PandaDEX. Read changed production/adapter/test code and its queue/persistence call chain. No blocking finding in this increment.

Validation: 352 AtomiX, 21 direct API and 12 shared localization JVM cases pass (385 total, zero failures/errors/skips). Ten new methods exercise the real publication → SignGate → NodeApi → DirectNodeApi.Request path against synthetic host work and preferences: both boards/markets, cancellation in both queues, invalid guards, unchanged success, changes during signing, post-execution late/duplicate replies, pending/incomplete replies, timeout recovery, ordinary-message continuity and input/node rejection. Pandamonium debug and AndroidTest APK compile (13 seconds); instrumentation was not run. All 19 pinned imports reproduce; catalogue/transport/diff checks pass. Evidence: build/localization/atomix-publish-queue-validation.json (557 source hashes). The changed transport is moved out of the unchanged map; explicitly superseded scoped hashes are recorded. All other protected sources, wallet audit and node JAR match. PandaBear/BlackBear source/artifacts remain unchanged from 0dffcfb.

Verdict: approve this dispatch-guard change. Work already executing cannot be cancelled by a later edit and keeps its late reply. A cancellation delivered by the shared queue still follows the existing incomplete-transport-result contract: the durable write pause remains for explicit review. These guards do not automatically acknowledge that pause or claim a node rejection. Receipt/chain confirmation, OTC consent freshness, responder/host lifecycle, and other app reviews remain open. The read-only ADB check for Fold R3GL805K7MB returned device not found; no other device was accessed. Final Fold acceptance, signed rebuilds and GitHub/PandaApps/eurobuddha.com publication remain outstanding. Older signed candidates still require rebuilding.


## Refreshed signed four-language candidates — 2026-10-18

Previous goal turn made progress as eb82bff. Built all three release variants from that clean committed source, after verifying all 557 checkpoint hashes and the unchanged node JAR. Re-read the graph's prior signed-candidate recipe and reused app/build.gradle's existing family signing configuration and /private/tmp/verify-bear-signed-candidates.py. Adapted only the source checkpoint/build-log references and archive-before-replace delivery. No credentials or signing material were copied or printed.

The fork's current Bear release tags still end at 1.9.41 and point to 9def96e6801a9bef261611e45349f28a1eb6ae1c. Revalidated the retained 1.9.41 APK hashes before comparing signatures. All refreshed APKs are 1.9.43/vc114, non-debuggable, ARM64-only, with verified v2 signatures matching the original family certificate (SHA256 eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f), correct package IDs and 16 KiB ZIP alignment. Compiled resource tables contain all 5299 catalogue entries for default English, Simplified Chinese, Russian and Ukrainian. Each manifest references a locale config declaring en/zh-Hans/ru/uk. These checks establish packaging and signing; runtime state retention, visual acceptance and translation completeness remain separate.

Release tasks, including vital lint, passed in 25 seconds. No production source changed during this refresh. Evidence: build/localization/signed-candidates-refresh-validation.json; build log: build/localization/signed-candidates-refresh-build.log; verifier snapshot: build/localization/verify-signed-candidates-refresh.py. The earlier signed-candidates-validation.json remains historical evidence for source 4bc8b62.

Current candidates in /Users/eurobuddha/Projects/minima/apks/base/dist:

| APK | SHA256 |
| --- | --- |
| minima-core-PandaBear-1.9.43-candidate.apk | 9161155c8dcf4b7810733e9cbf1e4496b14476f316d2fc2bb0fddabd0335a75d |
| minima-core-BlackBear-1.9.43-candidate.apk | 4fac6880813e32e0e3d13c499ca7d5b747186638273bbb2ceb98041d02369786 |
| minima-core-Pandamonium-1.9.43-candidate.apk | 5f54381e7c0955d21bc65356acdc95786f7d786a6958ac8a3846bfd69936b91b |

Each has a .apk.sha256 sidecar. The colocated bear-languages-1.9.43-candidate.json records current source, signatures, hashes and pending gates. All three new APKs were verified before replacing any dist candidate. The prior 4bc8b62 APKs/checksums/manifest are preserved and re-hashed under dist/candidate-archive/1.9.43-4bc8b6253562; the archive includes a manifest pointing at those preserved files plus the original manifest.

Packaging review: approve the refreshed local candidates. They have not been installed or published. Receipt/chain and consent/lifecycle reviews, Shop/remaining app text, minimaWallet runtime checks, Fold-only acceptance and final authorized publication are still open. If implementation changes again, rebuild the final artifacts. This refresh completes the current signed-build checkpoint, not the overall release goal.


## Studio export error language coverage — 2026-10-18

Audited lower-layer literal errors against the current generated message lookups and their callers. The wallet seed/counter/vault errors are already mapped at the display boundary. Future Cash's audit snapshot exceptions are converted to its existing translated wallet-audit failure; Filez's stream-open error already uses FilezMessages. These are narrow verified paths, not complete module coverage.

Two Studio export failures were missing: `Invalid shop filename` and `Cannot create export folder`. Reused StudioMessages, its ShopMessages donor, the bounded wallet message generator adapted from Parlons SystemMessages, and the existing ShopExportTest fixtures. Added only two exact message lookups and English/Chinese/Russian/Ukrainian catalogue entries. The importer reproduces the generated lookup. ShopExport, its validation, file writes, product data and Activity export flow remain unchanged.

### Code Review

Summary: reviewed the adapter, generated lookup, four generated resource files, catalogue and both copies of the export test. The actual filename and folder-creation failures now produce language descriptors while their original exception text stays intact. Unrecognized diagnostics remain literal. Existing export snapshot, count, directory containment and file-preservation checks still pass.

Findings: no blocking issue in this increment. This review does not close the outstanding device, financial or complete text-coverage gates.

Validation: 21 Studio and 12 shared localization JVM tests passed, zero failures/errors/skips; two new regression cases. All three debug variants compile. All 19 pinned imports reproduce, catalogue generation and direct transport verification pass, and git diff --check is clean. The catalogue has 5301 entries in each language. The 557-source validation map changes only the expected nine files; protected engines, wallet audit and node JAR match. Evidence: `build/localization/studio-export-language-validation.json`. Verdict: approve this translation change.

Fold R3GL805K7MB remains unavailable to ADB. No device data was changed. Signed 1.9.43 candidates still correspond to eb82bff and require rebuilding after this source checkpoint. Full language/runtime acceptance and authorized publication remain open.


## Full host regression and refreshed signed candidates — 2026-10-18

Source checkpoint `14703cc3d797f46b40bceeb4920715e06e3eacab` was clean and already pushed. Ran all existing JVM test tasks for the 19 integrated modules, minimaapi, localization, all three Bear debug variants, and maxima-core. The run passed in 1m51s: **2541 executions, zero failures, errors or skips**, recorded from 372 JUnit reports. This includes repeat executions of shared app tests across variants; it is not a distinct-case count. Explorer, Filez, Terminal IDE and maxima-core report NO-SOURCE and have no JVM cases. Up-to-date Gradle results were retained where valid. Evidence: `build/localization/full-host-regression-validation.json` with task results, log/report hashes and source tree. This is host regression evidence, not full UI or live-node acceptance.

Built all three signed 1.9.43/vc114 release candidates in 24s, including vital lint. Reused the existing signed-candidate verifier, adapting only the expected source/checkpoint, previous-candidate commit and evidence filenames. All 557 recorded source hashes match. The preserved 1.9.41 APKs are unchanged. Each current APK verifies with v2 signatures and the same family certificate as 1.9.41; package ID, release version, non-debuggable status, arm64-v8a ABI, 16KiB ZIP alignment, four declared locales and all 5301 compiled catalogue resources per language were checked. ZIP alignment is not an ELF page-alignment claim.

Current artifacts are `/Users/eurobuddha/Projects/minima/apks/base/dist/minima-core-{PandaBear,BlackBear,Pandamonium}-1.9.43-candidate.apk`, each with a SHA256 sidecar. Old eb82bff candidates are preserved in `dist/candidate-archive/1.9.43-eb82bff4ce4a`; earlier 4bc8b625 candidates remain in their own archive. Current manifest: `dist/bear-languages-1.9.43-candidate.json`. Evidence: `build/localization/signed-candidates-host-regression-validation.json`; verifier: `build/localization/verify-signed-candidates-host-regression.py`.

SHA256:
- PandaBear: `d57dd25fc99a03dda30e1bd57d7b85198268c3e1fab742dfa659808b972e529c`
- BlackBear: `40f1746871ad91d812ae18d47a5c7f78063f7c8d434a835a6547e0580141b95d`
- Pandamonium: `bfcfd66830f0b02c94fd672a2c1f373cac81d4037952131e176d12aa3b096162`

The read-only ADB check again returned device not found for Fold R3GL805K7MB. No other device, owner state, seed or counter was accessed. Final Fold/language acceptance, the outstanding reviews above, and GitHub/PandaApps/eurobuddha.com publication remain open. These are signed candidates, not an accepted published release.


## Current locale-format audit — 2026-10-18

The preceding goal turn made progress with full host regression and refreshed signed candidates. This turn inspected current formatting sites instead of treating the old 205-row inventory as current. The fresh Java scan finds 192 lines: 12 default-locale hexadecimal formatters, 17 explicit-locale String.format calls, three explicit-US NumberFormat display calls, and 160 default case-conversion sites still needing caller review. The first 32 numeric sites have explicit locale or locale-invariant hexadecimal behavior. This does not establish complete text/formatting coverage.

Reused `app/src/test/java/com/eurobuddha/minimacore/FormatTest.java` against the existing compiled app classes under en-GB, zh-CN, ru-RU and uk-UA: eight tests pass per locale (32 executions). The host-only LocaleAmountProbe uses six existing amount vectors and the actual shipped node JAR. All 24 MiniNumber text, serialized-byte and read-back checks match the ROOT baseline; 2048 lower/upper hexadecimal checks cover every byte under each locale. No node, wallet, signing, device or network operation ran. Existing full-suite reports remain untouched.

Read MiniNumber source/serialization, the bundled MySQLConnect bytecode, remaining String.format sites in local node source, and selected date/export callers. Wallet HistoryView's fixed-English formatter is used only by CSV/JSON export; the inspected NFT/History date formatters likewise serve exports. Filez's old formatDate helper is unused, while visible dates use Language.stamp. Other date consumers remain to be reviewed.

**Open inherited finding:** `MySQLConnect.searchCoins` formats Double result values with default-locale `%f`; the inspected bundled bytecode confirms this. The formatter produces `1,250000` under Russian/Ukrainian and `1.250000` under English/Chinese for 1.25. The node JAR's Git blob is identical to 1.9.41 (`24a063e587c7dc0da083df5ddcf5615cee209488`); no node replacement was made. None of the three signed APK DEX files contains the standard MySQL/MariaDB driver descriptors checked. That limits the evident runtime path but does not prove all dynamic reachability; the optional MySQL result-format issue remains open for disposition. Four SqlDB formatters substitute literal `%s` paths; MiniFormat's human-readable helpers still need consumer review before broader signoff.

Evidence: `build/localization/locale-format-current-audit.json`, `amount-locale-{en,zh-Hans,ru,uk}.log`, `LocaleAmountProbe.java`, `locale-amount-probe.log`, and `node-mysql-format-bytecode.txt`. All 557 source checkpoint hashes still match. No production source changed; signed candidates from 14703cc remain current. Fold R3GL805K7MB is still unavailable. Case-conversion/date review, complete language/runtime acceptance and authorized publication remain outstanding.


## Locale-dependent node-health fix and casing review — 2026-10-18

Reviewed the source contexts of all 160 case-conversion sites in the current inventory: identifiers/lookup keys, image detection, website token matching, display/search, BIP39 input, KISS completion, metadata validation and diagnostics. No defect caused by switching among the four supported languages was identified in these case conversions. An isolated host probe passed 1152 ASCII, identifier, diagnostic and contextual Unicode comparisons. This is not exhaustive Unicode or Android runtime validation. Evidence: `build/localization/locale-case-review.json` and `LocaleCaseProbe.java`.

Date/export callers retain fixed locales for interchange filenames and CSV/JSON data; Casino/PandaDEX short log clocks are display-only. MiniFormat's node consumers include status/backup/log presentation. Following its status sizes exposed a real consumer bug: MiniFormat emits `950,0 MB` under Russian/Ukrainian, but NodeHealth.bytes parsed only a dot and returned zero, suppressing the database-size health signal. The two new regression methods failed against the original parser, including actual shipped-node output yielding zero instead of 996147200 bytes.

Reused `NodeHealth.bytes`, its existing real-status fixture and classification tests, and the shipped node formatter. The sibling base parser is identical; no compatible comma-aware helper was found in the searched base, Parlons or Future Cash sources. The minimal adaptation accepts only the node's one-decimal comma form, then uses the existing parser and unit multipliers. Grouping-like/mixed comma input remains unknown. Health thresholds, timing, owner data and the node JAR are unchanged. The repository pre-commit rule requires a core-source version bump: candidates are now **1.9.44/vc115**.

### Code Review

Summary: reviewed the parser change, version metadata, tests and NodeHealthMonitor read/classify/update caller. The guard is confined to MiniFormat's known decimal-comma grammar; all original dot-format behavior remains. Two new methods use the actual bundled formatter under en/zh/ru/uk, cover read/classification and rejected grouped/mixed forms. No blocking finding in this increment. Verdict: approve.

All 396 core test executions pass (131 PandaBear, 131 BlackBear, 134 Pandamonium). All three signed release builds complete with vital lint in 23 seconds. The prior full 2541 host suite remains historical evidence for the unchanged integrations; it is not relabeled as a current full-suite run. The current 559-source map changes only app/build.gradle and adds explicit hashes for NodeHealth and its test; protected sources and node JAR match. Evidence: `build/localization/node-health-locale-validation.json`, before-fix failing report, and `node-health-locale-build.log`. Signed APK verification and copy to established dist follow the source commit.

The inherited optional MySQL result-format finding remains separate and unchanged. Current case/date source review does not close complete text, Fold, wallet/financial or final-release acceptance. Fold was not accessed and remains required for runtime acceptance. Publication remains pending.


## Signed 1.9.44 health-fix candidates — 2026-10-18

Committed/pushed source `9f155da9394023abe218d6571cdc322421bab3f3` includes the locale-safe node-health size parser and version 1.9.44/vc115. All three APKs passed the existing release verification recipe, adapted for the new version, 559-source checkpoint and unique output filenames. Certificates match 1.9.41; package/version, non-debuggable status, arm64-v8a ABI, 16KiB ZIP alignment, declared en/zh-Hans/ru/uk locales and all 5301 compiled messages per language were verified. Final dist APK hashes and sidecars were checked after copy.

Artifacts: `/Users/eurobuddha/Projects/minima/apks/base/dist/minima-core-{PandaBear,BlackBear,Pandamonium}-1.9.44-candidate.apk`. Manifest: `bear-languages-1.9.44-candidate.json`; evidence: `build/localization/signed-candidates-1.9.44-validation.json`; reusable recipe snapshot: `build/localization/verify-signed-candidates-1.9.44.py`. All 1.9.43 artifacts are preserved under their original versioned names, and their manifest points to the superseding 1.9.44 candidate manifest. No public release or device installation occurred.

SHA256:
- PandaBear: `74ea96e0fb78ed7f15334c1162737da0a49967a8901c58c7eebfa4f3d57b9f1d`
- BlackBear: `67f5fe9527b4188df1f95d166413ed93a5afe1ff07cf10eb3d51b09b52d9151f`
- Pandamonium: `146770369fe4a389908f035fb5d2cd31fb60d4a9d56d275bc40ff7e8db16f11c`

The health regression is fixed in all three variants; 396 core test executions pass. The static casing review is recorded for all 160 inventoried sites. Android runtime/state/visual acceptance on Fold, full app-owned text coverage, remaining financial reviews and the optional inherited MySQL result-format disposition remain open. These candidates are not yet approved for publication.

## Core chat diagnostic localization — 2026-10-18

Reused `scripts/adapt-pandamonium-wallet-error-languages.py` and its tested Parlons-derived descriptor mapper. Inspected the original Parlons `build/account-import/chatshared/com/eurobuddha/maxima/app/i18n/SystemMessages.java` dispatch and tests, WalletMessages tests, shared Language.Message, and the actual chat/photo/transport error producers and UI callers. The graph vocabulary query (chat/media/language/parlons) returned broad historical sources; the existing 1.9.44 graph memory and current files established the working baseline.

Added 13 fixed and six patterned diagnostics plus a generic null-error fallback: 20 catalogue entries in English, Simplified Chinese, Russian and Ukrainian (5,321 total). `tools/localization/chat-messages.py` calls the existing generator; `generate.cjs --check` now also verifies the generated ChatMessages class. Seven UI boundaries in ChatView, ChatThreadActivity, ChatImageActivity and MaxThreadActivity translate known failures. Captured addresses, sizes and unfamiliar platform/node diagnostics remain literal; no chat message content is passed through this lookup. Original exceptions, node commands, media encoding, send/retry/storage behavior and node JAR remain unchanged. The core-source commit hook requires version 1.9.45/vc116.

Validation: 572 JVM test executions pass (PandaBear138, BlackBear138, Pandamonium141, localization12, wallet143), including seven new cases run in every core variant. Tests cover all declared mappings, literal captures, unknown text and malformed numeric near-matches, actual ChatPhoto open/decode failures, actual empty-media rejection, and MediaService's real size-limit error under all four JVM locales. Initial test-only failures used an unavailable Android Files method and Android's stub org.json; the final tests use the existing readAllBytes and bundled Minima JSON parser. All three release builds and vital lint pass (42 seconds). All19 pinned imports reproduce; catalogue, transport and diff checks pass. The 568-source checkpoint, protected financial maps, wallet-audit nine-source map and node JAR hashes match expected changes. Evidence: `build/localization/chat-diagnostics-validation.json` and `chat-diagnostics-build.log`. The earlier full host-suite evidence remains historical.

### Code Review

Summary: reviewed every changed source/spec/resource and the generator's dependency and display callers. Changes are confined to diagnostic descriptors and their display boundaries; literal captures never recurse. No blocking finding in this increment. Verdict: approve this localization change; full release acceptance remains open.

Separate MAJOR pre-existing finding: `MaxThreadActivity` restores a failed outgoing message with unconditional `input.setText(text)` in a delayed UI callback. A newer draft can be overwritten. Before fixing, inspect ChatEngine.send persistence/retry semantics and reuse the proven draft revision guards from Parlons or integrated Inbox; do not add automatic duplicate resend. This finding remains open and is not fixed by translating the error.

Fold R3GL805K7MB is unavailable (`device not found` after an authorized serial-specific ADB check). No other device, emulator, owner wallet, seed, counter or AppLock was touched. Fold state/visual/accessibility acceptance, remaining financial reviews, optional inherited MySQL formatting disposition and final publication remain pending. Current candidates must not be described as accepted public releases.


## Signed 1.9.45 chat-diagnostic candidates — 2026-10-18

Source `37d7194fe1993b623223a84c8475cf180ebb6af1` is committed, pushed to the authorized fork feature branch and remote-verified. All three signed candidates passed the existing APK verification recipe adapted for 1.9.45/vc116 and the 568-source checkpoint. Certificates match 1.9.41; package/version, non-debuggable status, arm64-v8a ABI, 16KiB ZIP alignment, four declared languages and all 5,321 compiled catalogue resources per language were verified. This is ZIP alignment verification, not a claim about native ELF page sizes.

Files are in `/Users/eurobuddha/Projects/minima/apks/base/dist/minima-core-{PandaBear,BlackBear,Pandamonium}-1.9.45-candidate.apk`, with checked SHA256 sidecars. Existing 1.9.44 APKs remain preserved and their manifest links to the newer candidate. Evidence: `build/localization/signed-candidates-1.9.45-validation.json`; recipe: `verify-signed-candidates-1.9.45.py`; dist manifest: `bear-languages-1.9.45-candidate.json`.

- PandaBear: `ca8d67786217813b9aba1a116f9f0394ea2248b61fe69ef245690f12ac252f02`
- BlackBear: `f3cf453c963bf8d097ea325e89393f8be9e6c5aa453a99ec9249bc1fa12bb1de`
- Pandamonium: `eaec0a17ef34fa0d38b6b171b6eebb46114bcc3b230686cb3e8233379a84bbb8`

572 JVM test executions pass. No device installation or public release occurred. Fold acceptance, the separately identified draft overwrite fix, remaining financial reviews and final acceptance/publication are still open.

## Chat composer late-failure guard — 2026-10-18

Closed the source-level draft overwrite finding recorded with 1.9.45. A send exception previously called `input.setText(text)` unconditionally, so an old background send could replace a newer draft. Reused the revision/identity checks, exact raw text and selection capture, and closed-host guard from `integrated/merchinbox/src/main/java/com/eurobuddha/merchinbox/ReplyDrafts.java` and its InboxReplyDraftTest/InboxReplyCallbackTest coverage. Also inspected standalone Parlons ChatActivity/CloudChatActivity send paths and current ChatEngine.send, record/persist, delivery and retry callers. Normal network delivery failure returns an entry with a receipt state; the engine keeps its existing retry behavior. Exception restoration is a distinct UI path.

The minimal `maxchat/SendDraft.java` adaptation owns one composer, snapshots the raw text/selection, clears immediately as before, and restores only if no subsequent text revision occurred. Typing then deleting back to blank counts as a new revision. Ticket ownership and one-time completion reject foreign/repeated callbacks. Closing detaches the watcher; activity send-result UI callbacks also check finishing/destroyed state. Outgoing text retains the existing trim policy. No new send, resend, persistence, receipt or protocol behavior was introduced.

Validation: all501 JVM test executions pass (PandaBear146, BlackBear146, Pandamonium149, Inbox60). Eight new cases run in every core variant: exact Unicode/spacing/selection restoration, preserving a newer Editable, edits back to blank, out-of-order failures, identical retyped text, blank and closed-host behavior, foreign/repeated tickets and invalid selection clamping. Core tests use mocked EditText/TextWatcher boundaries and do not prove Android keyboard/IME behavior; reused Inbox tests exercise their original real EditText behavior under Robolectric. All three release builds and vital lint pass in45seconds. All19 pinned imports reproduce; catalogue/transport/diff checks pass. The570-source checkpoint changes only the activity and version source and adds the helper/test; protected financial, wallet-audit, node and chat-transport hashes remain unchanged. Evidence: `build/localization/chat-draft-validation.json`, `chat-draft-build.log`.

### Code Review

Summary: reviewed the full helper, activity diff, test harness and original draft guard. The guard operates on the UI thread and ignores stale tickets even when current text looks unchanged. No blocking finding in this increment. Verdict: approve the source fix. Fold validation is still required for runtime acceptance.

Version is1.9.46/vc117 under the core-source commit rule. Fold R3GL805K7MB still reports device not found. No owner app/data/wallet/seed/counter or other device was used. Remaining financial reviews, complete app-owned text/accessibility acceptance, optional inherited MySQL disposition and final publication remain open. Earlier signed candidates stay preserved; 1.9.46 artifacts are verified separately after this source checkpoint.


## Signed 1.9.46 draft-guard candidates — 2026-10-18

Source `ab92c21158e73184561a5bcb7123bacdd9b6d010` is committed, pushed to the authorized fork and remote-verified. All three signed APKs passed certificate comparison with 1.9.41, package/version117 metadata, non-debuggable and arm64 ABI checks, 16KiB ZIP alignment and four-language resource checks (5,321 catalogue entries per language). All570 checkpoint source hashes match. ZIP alignment verification does not establish ELF page-size compatibility.

Artifacts: `/Users/eurobuddha/Projects/minima/apks/base/dist/minima-core-{PandaBear,BlackBear,Pandamonium}-1.9.46-candidate.apk`, with verified SHA256 sidecars. Manifest: `bear-languages-1.9.46-candidate.json`; verification evidence and recipe are `build/localization/signed-candidates-1.9.46-validation.json` and `verify-signed-candidates-1.9.46.py`. Existing1.9.45 artifacts remain preserved; their manifest links to1.9.46.

- PandaBear: `91ac4a0ea7162941c56a7173bb08ae837825410bf98418e377c1a220b2a5af70`
- BlackBear: `4ffd67bc7d368c8a886c943142f0ac50b3eba73d4b18f5273ac912fbe4e2ecba`
- Pandamonium: `cba8a31c27edf5326efc3f90aa9dfc4ee6e96ff3a352efac97ae523afd189765`

The delayed-failure draft overwrite has a source fix and passing regression coverage across all three variants (501 total test executions). Runtime keyboard, selection, language-switch, accessibility and layout acceptance remain pending on Fold. Financial review follow-ups, optional inherited MySQL formatting disposition and final release/publication also remain open. No installation or public release occurred.

## AtomiX send acknowledgement validation — 2026-10-18

Confirmed and fixed the positive-send-reply gap left open by the publication-queue review. Previously `status:true` with no response or a missing/empty TxPoW ID could clear NodeApi's durable interrupted-write marker and invoke CommsTransport.onSent. This could falsely mark an offer/message posted and permit a subsequent write without a usable acknowledgement.

Reuse: inspected standalone atomix/usdtSwap CommsTransport and atomix WriteSafety (same weak acknowledgement), current CommsTransport/NodeApi/WriteSafety, publication callers, SignGate and the real PublishQueueTest host fixture. Reused NFT Wallet TransactionEvidence.txpow/BurialEvidence.id's typed/nonzero ID checks and AtomiX MinimaHtlc.confirmationDepth's 64-hex-character TxPoW grammar. The node send command returns its TxPoW directly in response after queueing/mining work; this acknowledgement does not prove chain inclusion. PandaPools TxPost was also checked; its transaction-check flow is a different boundary and was not substituted for send.

`WriteSafety.completeReply(command, reply)` now requires a usable acknowledgement for a positive non-dry-run send. The response must be an object containing a nonzero 32-byte hexadecimal string ID; present pending/dryrun flags must be false Booleans. Requested dry-run previews, other command contracts and definite rejection replies keep their existing behavior. Both NodeApi sites use the same command-aware validation, including replies arriving after timeout, before resolving the persisted marker. CommsTransport uses that same check and returns the exact validated ID. Incomplete replies retain the existing translated uncertainty message, review marker and write pause. No automatic acknowledgement, retry or chain-confirmation claim was added.

The canonical `scripts/adapt-pandamonium-atomix-send-receipt.py` preserves this change through pinned imports. Four new PublishQueueTest methods exercise the full publication -> SignGate -> NodeApi -> DirectNodeApi path: 25 malformed/ambiguous reply forms across ordinary and OTC publication, exact valid ID preservation and separate preview contracts, late malformed replies after timeout, and an already queued second publication blocked before node dispatch. The checks verify preserved marker/reason, restart-style latch recovery, no onSent callback and no second backend request. Existing valid late-acknowledgement and definite-rejection tests remain green.

Validation: 665 JVM test executions pass (AtomiX 356, NFT Wallet 288, shared node API 21); Pandamonium debug Java compilation succeeds. Initial combined run completed in 34 seconds; final AtomiX queue regression run completed in 4 seconds. All 19 pinned imports, transport wiring, catalogue and diff checks pass. The 571-source checkpoint changes only the reviewed transport/adapter/test files; prior protected financial and wallet-audit maps and node JAR remain unchanged outside the explicit reviewed updates. Evidence: `build/localization/atomix-send-receipt-validation.json`, `atomix-send-receipt-build.log`, `atomix-send-receipt-queue-test.log`.

### Code Review

Summary: reviewed the changed receipt helper, both marker-resolution call sites, transport callback, import order and synthetic full-path tests. A malformed positive reply is classified before the signing gate can dispatch its next queued write. No blocking finding in this increment. Verdict: approve the send acknowledgement fix. Full transaction-intent matching and mined chain inclusion remain separate requirements; this change does not claim to complete all AtomiX receipt review.

This change affects Pandamonium's AtomiX integration. No core app source/version or PandaBear/BlackBear implementation changed, and no new installers were created. Existing 1.9.46 Pandamonium candidates predate this fix and require rebuilding before publication. Remaining work includes AtomiX transaction/chain evidence, OTC consent and responder/host lifecycle reviews, Shop follow-ups, Fold runtime acceptance and final signed release/publication. No owner wallet/node operations or device access occurred during this review.

## AtomiX chain-inclusion evidence — 2026-10-18

The existing depth parser accepted found=true plus a confirmation count without a block ID or consistent block/tip heights. That incomplete shape could reach SwapEngine's terminal settlement callback. Reused `integrated/nftwallet/.../TransactionEvidence.inclusion` and `whole`, BurialEvidence's typed/nonzero ID pattern, and TransactionRecoveryTest's missing/malformed/inconsistent inclusion cases. Inspected current and standalone AtomiX MinimaHtlc, SwapEngine.confirmPendingMinima, the existing MinimaReceiptTest, PandaPools ActivityLog's identical weak parser, the native txpow onchain implementation and matching bundled-node bytecode fields.

The node onchain response has found, block, blockid, tip and confirmations; it does not echo a transaction ID. The request-specific callback supplies that query context. Do not invent a required txpowid response field. AtomiX claim/refund commands already use `txnpost ... mine:true`; native txnpost/send define that as synchronous mining. The asynchronous pre-mining receipt issue seen in other integrations must not be assumed to apply to these claim/refund commands.

MinimaHtlc.confirmedDepth now requires Boolean status/found, a nonzero 32-byte hexadecimal block ID, bounded unsigned integer strings, a positive block height, and tip minus block equal to confirmations. Missing, mistyped, inconsistent or overflowing evidence returns unknown (-1). The existing SwapEngine settlement threshold remains two confirmations; the parser also returns valid shallower depths so the controller can keep waiting. Other transaction checks, signatures, commands, retry timing, database writes and node JAR remain unchanged.

Two new regression methods extend the existing receipt suite. One preserves depth behavior at 0/1/2/3/max-int and rejects overflow. The other sends 48 malformed/missing/inconsistent reply variants through both the parser and the actual settlement callback, verifying no terminal status or event write. The original valid fixture now includes the node's complete reply fields. These are host tests with synthetic evidence; no live chain claim is made.

Validation: 646 JVM test executions pass (AtomiX 358, NFT Wallet 288), and Pandamonium debug Java compilation succeeds in 11 seconds. All 19 pinned imports, transport, catalogue and diff checks pass. The initial import check caught the new canonical test using its donor package import; corrected it to the established integrated test namespace, then verification passed. The 575-source checkpoint explicitly moves MinimaHtlc from the unchanged financial inventory into reviewed changes and records its prior hash. Every other protected financial/audit source and the node JAR retain their expected hashes. Evidence: `build/localization/atomix-chain-evidence-validation.json`, `atomix-chain-evidence-build.log`, and `node-txpow-onchain-bytecode.txt`.

### Code Review

Summary: reviewed the parser and all changed test/adapter files, the native response contract, and the settlement callback. This change rejects incomplete evidence while preserving AtomiX's existing threshold and retry behavior. No blocking finding in this increment. Verdict: approve this evidence check. It does not establish complete transaction-intent matching or close the outstanding OTC consent and responder/host lifecycle reviews.

Existing 1.9.46 Pandamonium candidates still predate these integration fixes and need rebuilding before publication. No version bump, installer, installation or owner node/wallet operation occurred in this increment. Remaining work includes OTC consent freshness, responder/host lifecycle, Shop follow-ups, Fold runtime/accessibility acceptance and final signed publication. OTC accept currently consumes the Deal object held by its UI; its persisted-state freshness check remains to be reviewed next.

## AtomiX OTC consent and callback freshness — 2026-10-18

Closed the stale-deal finding: Accept, Counter and Reject previously consumed the mutable Deal held by the view and could replace newer persisted state. Instance-level synchronization also allowed the activity and service controllers to reserve the same agreement independently. Delayed send/execution callbacks could act on changed terms or overwrite a later attempt.

Reuse sources inspected: `integrated/atomix/src/main/java/com/eurobuddha/atomix/swap/OtcController.java`, `OtcDb.java`, `OtcMessage.java`, the initiator entry in `SwapEngine.java`, and the OTC rendering/dialog/result paths in `integrated/atomix/src/main/java/com/eurobuddha/atomix/MainActivity.java`. Standalone `apks/atomix/app/src/main/java/com/eurobuddha/atomix/swap/OtcController.java` and `apks/usdtSwap/app/src/main/java/com/eurobuddha/usdtswap/swap/OtcController.java` contain the same unguarded updates. Reused the transactional read/check/write pattern from `integrated/nftwallet/src/main/java/com/eurobuddha/nftwallet/HistoryDb.java` (prepareAttempt/markAttempt) and real SQLite/concurrent-helper fixture from `integrated/nftwallet/src/test/java/com/eurobuddha/nftwallet/TransactionJournalTest.java`. AtomiX's existing currency, amount, proposal and message tests remain in use.

OtcDb now separates insert-only creation from checked updates. Updates compare the complete reviewed snapshot inside a SQLite transaction, preserve immutable deal identity/market, and advance the existing updated timestamp monotonically. This also rejects stale snapshots after terms change and then return to the same values. No schema migration is needed. Unknown legacy currency is preserved on updates; new deals require an explicit supported market. Pruning checks the snapshot and removes the deal and message thread atomically. Every production controller write now uses these guarded operations.

Accept/Counter/Reject copy the reviewed snapshot rather than modifying the UI's object. Execution reserves that exact agreement before invoking the engine, across separate helpers/controllers. Its callbacks can update only their own reserved snapshot; stale or duplicate callbacks cannot overwrite a later attempt or recreate a removed deal. Incoming ACCEPT/EXECUTE must carry the standing side, amount and price; COUNTER cannot reopen an agreed/executing deal. EXECUTE-before-ACCEPT still works for an LP's outstanding matching counter. A rejection cannot cancel an execution already reserved. Existing wire fields, settlement amounts, chain commands and SwapEngine implementation remain unchanged.

The stale-deal notice uses the existing AtomixMessages/Parlons lookup and has English, Simplified Chinese, Russian and Ukrainian translations (5,337 catalogue entries). The existing OTC success refresh is reused for stale-deal errors, with the same current-tab/open-dialog guards and retained availability drafts. Canonical adapter: `scripts/adapt-pandamonium-atomix-consent.py`; implementation snippets: `scripts/pandamonium-sources/atomix/otc-{store,actions,execute}.inc`; canonical regression suite: `scripts/pandamonium-tests/atomix/src/test/java/com/eurobuddha/atomix/swap/OtcConsentTest.java`.

Validation: 671 JVM test executions pass (AtomiX 371, NFT Wallet 288, localization 12), including 13 new SQLite/controller regressions. These cover stale actions across changed/terminal/deleted/restored terms, all persisted consent fields, two concurrent controllers, delayed/duplicate callbacks, valid outbound paths in both markets/directions, matching and mismatched inbound terms, expiry races, reopening, monotonic revisions and transactional rollback. The first compile identified an old proposal fixture using upsertDeal; it now models createDeal and the persisted read. Review also retained explicit no-insert assertions for malformed proposals. The final combined build passed in 10 seconds; the final AtomiX test run passed in 7 seconds and the UI compile in 2 seconds. Earlier combined validation completed in 37 seconds. All 19 pinned imports, transport wiring, catalogue and diff checks pass. The 582-source checkpoint preserves protected financial/audit files outside the explicitly reviewed changes and the original node JAR. Evidence: `build/localization/atomix-consent-validation.json`, `atomix-consent-build.log`, `atomix-consent-final-test.log`, `atomix-consent-ui-build.log`.

### Code Review

Summary: reviewed all changed production, adapter, snippet, translation and test files, the existing callers and SQLite transaction boundaries. The checks use persisted consent and work across controller instances. The UI retains its existing refresh/draft behavior. No unresolved blocking finding in this increment.

Findings resolved before checkpoint: one proposal fixture still called the removed unconditional database API; malformed-proposal tests also needed to keep their no-insert assertion alongside the new no-update assertion. Both were corrected and rerun.

Verdict: approve this consent-freshness increment. The tests use real host SQLite with mocked transport/engines; they do not establish device behavior, live settlement or complete responder/receipt safety. The existing engine error classification/recovery contract is unchanged and remains part of the outstanding review.

No owner node, wallet, seed, counter or device operation occurred. Fold R3GL805K7MB reports device not found. Version remains 1.9.46/vc117; no new installers were made. Existing candidate APKs remain preserved and require rebuilding for the current source/catalogue. Remaining work: AtomiX receipt/responder/host lifecycle and Shop follow-ups, Fold runtime/state/accessibility acceptance, optional inherited MySQL disposition, final signed rebuild and authorized publication.

## Prepare signed 1.9.47 candidates — 2026-10-18

Version 1.9.47/vc118 includes the committed AtomiX send-acknowledgement, chain-evidence and OTC-consent fixes and the 5,322-message four-language catalogue. Reused the existing app/build.gradle variant/signing configuration and build/localization/verify-signed-candidates-1.9.46.py verification recipe. The original 1.9.41 APK hashes and signing certificates were rechecked; all three tags and the base checkout still resolve to 9def96e6801a9bef261611e45349f28a1eb6ae1c. The authorized GitHub release list ends at the three 1.9.41 releases; no local 1.9.47 artifact exists.

Only release metadata changes in application code. No signing credentials, node library, key modes, package identifiers or financial implementation are changed. Prior candidates remain preserved. Full host regression and all three release builds will run from this source checkpoint; artifact verification is recorded separately after the build. Remaining reviews and Fold runtime acceptance remain open. This entry does not claim a completed or published release.

## Signed 1.9.47 candidates and full host regression — 2026-10-18

All three signed candidates now contain pushed source `40096aa75381088def980d3e0d1fd6b26025c964`, including the recent AtomiX acknowledgement, chain evidence and persisted-consent fixes. Version is 1.9.47/vc118. The source-only version change leaves the final 1.9.41 node JAR, key modes, package identities and all 582 reviewed source hashes intact except the recorded app/build.gradle version update.

The established full regression ran 25 test tasks: 2,611 passing cases, zero failures/errors/skips. Gradle reports four tasks with no test source and records reused up-to-date results explicitly; this count is not a claim that every module has host tests or that Android runtime acceptance is complete. All three release builds and vital lint completed in 2m15s. Evidence: `build/localization/bear-1.9.47-validation.json` and `bear-1.9.47-build.log`.

Reused `build/localization/verify-signed-candidates-1.9.46.py` as `verify-signed-candidates-1.9.47.py`, updating version/checkpoint and remaining-work metadata. Verified all three APKs before adding any dist artifacts: v2 signature, original 1.9.41 family certificate, package/version metadata, non-debuggable status, arm64 ABI, 16KiB ZIP alignment, four declared locales, all 5,322 catalogue resource names per locale and all 582 source hashes. ZIP alignment is not an ELF page-size claim. The original 1.9.41 APK hashes and certificates were independently rechecked against the existing files.

Artifacts: `/Users/eurobuddha/Projects/minima/apks/base/dist/minima-core-{PandaBear,BlackBear,Pandamonium}-1.9.47-candidate.apk`, each with a verified `.apk.sha256` sidecar. Manifest: `bear-languages-1.9.47-candidate.json`; artifact evidence: `build/localization/signed-candidates-1.9.47-validation.json`. Previous 1.9.46 APKs retain their original hashes, and their manifest links to the new candidates.

- PandaBear: `f200c7f87a7ef68fe0702b06067577a7a124076eaef3ffb7336e1ebf67d73535`
- BlackBear: `74353447f57972a6c241b9b257bb36d4dfd9fe5b9cb38272f5b39888ea010c64`
- Pandamonium: `d1aa2306d2cd36e9518c1ec4ebb7ef0a33bfd4e0db39a0e7032ec9439211ad8b`

### Code Review

Summary: application changes are limited to version metadata. Reviewed the reused verification recipe's diff, full test-task states, resulting APK metadata/signatures/resources and copied artifact hashes. No new runtime implementation or signing configuration was introduced. Verdict: approve this candidate-build checkpoint.

No installation or public release occurred. Fold R3GL805K7MB remains unavailable. Remaining requirements are the recorded AtomiX transaction/responder/host and Shop follow-ups, remaining text-coverage checks, data-preserving Fold language/state/accessibility and minimaWallet acceptance, optional inherited MySQL disposition, and final accepted publication to the authorized destinations. These builds are candidates, not a declaration that the goal is complete.

## miniMall checkout address refresh — 2026-10-18

Fixed the delayed checkout-refresh finding. The existing getaddress success and error callbacks rebuilt the checkout page, which recreated the address/note inputs and reset shipping to the first option. That could discard a draft even though a language change itself preserved the page.

Reuse: inspected `integrated/merchshop/src/main/java/com/eurobuddha/merchshop/MainActivity.java` (checkout builder, wallet row, both address-read paths, navigation, confirmation/order/payment paths), its Catalog and main-thread NodeApi callbacks, and the equivalent standalone `apks/merchshop/app/src/main/java/com/eurobuddha/merchshop/MainActivity.java` (same rebuilding behavior). Reused the tagged-view update pattern from `integrated/merchstudio/src/main/java/com/eurobuddha/merchstudio/MainActivity.java` / `scripts/adapt-pandamonium-mall-studio-refresh.py` and the public checkout fixtures in `app/src/androidTestPandamonium/java/com/eurobuddha/merchshop/MallShopLanguagesTest.java`. Real EditText/selection/composition assertions follow `integrated/merchinbox/src/test/java/com/eurobuddha/merchinbox/InboxReplyDraftTest.java`.

The wallet row now has a stable tag. An address callback replaces only that row at the same parent/index with the same layout parameters. The checkout page, address and note Editables, selected shipping, total, cart and focus stay intact. Physical-only checkouts, other visible pages and finishing/destroyed hosts are left alone. The pairing address callback also refreshes this row, so the displayed/copyable destination reflects the updated address. No form snapshots or new draft store are introduced.

Canonical adapter: `scripts/adapt-pandamonium-shop-checkout.py`. Four new host regressions in `scripts/pandamonium-tests/merchshop/src/test/java/com/eurobuddha/merchshop/CheckoutRefreshTest.java` exercise the actual checkout builder and address callbacks with real Android views under Robolectric. They cover all four selected languages, exact Unicode/whitespace and Editable identity, selection/composition/focus, mixed-cart shipping/total, NFT-only note and clipboard, physical-only checkout, another page and a closing host. The fixture never calls MainActivity.onCreate or starts identity/node/payment work. Its initial toast/clipboard tests exposed missing Language.initialize in the fixture; adding the normal library initialization fixed that setup error.

Validation: all 11 Shop host tests pass (four new cases plus seven existing storage/payment-argument/threading cases), and Pandamonium debug compilation passes in the same six-second run. All 19 pinned imports, catalogue (5,322 messages per language), direct transport and diff checks pass. Evidence: `build/localization/shop-checkout-validation.json` and `shop-checkout-build.log`. The checkpoint verifies that confirmAndPlace/placeOrder/retryPayment are byte-identical to the prior commit, as are the protected node, wallet, database, transport and financial sources outside this explicitly reviewed UI change.

### Code Review

Summary: reviewed the complete changed activity blocks, adapter, test configuration and canonical/generated test files. This is a targeted UI refresh using the existing main-thread callback contract. It preserves form identity instead of reconstructing input. No unresolved blocking finding in this increment. Verdict: approve the checkout refresh fix. Host tests do not establish physical-device IME/visual behavior or payment receipt/retry safety.

No owner device, node, wallet, seed, key counter, signing or payment operation occurred. Existing 1.9.47 candidates remain preserved. Only the Pandamonium candidate needs rebuilding for this integration change; PandaBear/BlackBear implementation and the shared catalogue are unchanged. Shop durable payment admission, uncertain-result reconciliation, persistence and callback lifecycle are still to be reviewed, alongside the recorded AtomiX follow-ups, text coverage, Fold acceptance and final signed publication.


## miniMall original order context — 2026-10-18

The Shop now captures the vendor address alongside its existing assembled MerchMessage before scheduling work. Encryption uses that message's recipient, and the subsequent payment uses its exact amount and token. Neither callback reads the currently open catalog. Payment retries require the original per-order vendor address: a reimported shop or another open catalog cannot replace it. Retry callbacks also retain the original reference and payment strings. Missing-address advice now asks the buyer to review the order with the seller before paying again, in all four languages.

Reuse sources inspected: integrated/merchshop MainActivity, Catalog, ShopStore; integrated/merchshop/src/main/java/com/eurobuddha/comms/{MerchDb,MerchMessage,CommsTransport,NodeApi,CryptoProvider}.java; minimaapi DirectNodeApi; the standalone apks/merchshop MainActivity payment/retry paths; AtomiX WriteSafety and its send-receipt adapter. The implementation reuses Shop's already assembled order and per-order vendoraddr metadata unchanged. No schema, protocol, amount formatting, cryptography or new dependency was introduced. Canonical adapter: scripts/adapt-pandamonium-shop-order-context.py. The language adapter keeps the pinned donor's old literal separate from the corrected catalog text.

Four new OrderContextTest cases reuse CheckoutRefreshTest's real activity fixture and PaymentArgumentsTest's command capture. They check delayed work after catalog mutation/removal/replacement, exact decimal and Unicode payload retention, original retry reference after callback delay, missing/nullable address, and all four missing-address translations. No Activity.onCreate, real identity, node, wallet or payment is started. All 15 Shop tests pass; Pandamonium debug compilation passes. All 19 pinned imports reproduce; transport, catalog (5,322 messages in each language), and whitespace checks pass. Evidence: build/localization/shop-order-context-validation.json and shop-order-context-build.log.

### Code Review

Summary: the increment removes mutable catalog reads from delayed payment paths and unsafe destination fallback. Full changed source, adapters, resources and tests reviewed. No unresolved finding in this recipient-binding increment. Verdict: approve this checkpoint; release remains incomplete.

Known payment-review findings remain open: CommsTransport currently treats pending:true as sent and collapses timeouts into ordinary failure; the UI offers retry without durable admission or receipt reconciliation. DirectNodeApi does not provide an application-level duplicate-payment guard. Order/address persistence is not atomic and its results are unchecked. Success/error UI callbacks can also affect a different or closing page. These need a coherent durable payment flow using the existing proven wallet/AtomiX patterns, including safe retries for definite rejections, before publication. These findings are not claimed fixed by this checkpoint.

The Fold R3GL805K7MB was checked and is not connected. No other device was used. Existing signed 1.9.47 APKs and checksums are preserved. Because the shared language catalog changed, all three signed candidates now need rebuilding for current source. The original 1.9.41 baseline and node JAR remain unchanged. Full goal and outstanding acceptance/release gates remain open.


## miniMall durable buyer payments — 2026-10-18

Replaced the buyer's untracked direct send/retry with the existing Inbox prepared native-send sequence. The order and original vendor address now commit in one SQLite transaction before the encrypted order is dispatched. A strict typed, nonzero send acknowledgement permits payment preparation; bare/pending/malformed replies cannot start payment. An old unpaid flag alone cannot authorize another send.

The new Shop PaymentJournal adapts Inbox PlainDeliveryJournal's owner/handle, transaction-bound reservation and phase rules. It binds the original recipient, item payload, amount, token, currency and counterparty to the persisted buyer order. It saves verified native inputs/outputs before signing and POSTING before broadcasting. Known pre-post failures may retry; POSTING, UNKNOWN and POSTED survive closing/reopening and can only use read-only recovery. Concurrent helpers/orders cannot reserve the same input. Paid or advanced orders cannot prepare/post another payment. The version-3 Shop schema adds only its payment table; migration retains existing orders and original addresses.

PaymentFlow reuses Inbox PlainDeliveryFlow and the existing public NFT Wallet OrderPaymentEvidence directly. It builds with sendnosign, verifies the exact recipient/amount/token/reference and owned change, saves the intent, signs, verifies the signed transaction and posts. It checks a saved receipt or bounded, paginated history against that exact intent and requires the existing three-block inclusion proof before displaying confirmation. A mined header may differ from the original pre-mining ID. Error, timeout, process death and malformed post replies never turn into permission to send again. History recovery retains the donor's bounded scan; absence from the scanned window is not proof of failure and does not release a payment.

Reuse inspected: scripts/pandamonium-sources/merchinbox/{PlainDeliveryFlow,PlainDeliveryJournal,DeliveryJournal}.java and their InboxPlainFixture/JournalTest/FlowTest; integrated/NFTwallet OrderPaymentEvidence, TransactionEvidence and PreparedSend; AtomiX WriteSafety.sendReceipt; the standalone apks/merchshop order/payment paths; Shop MerchDb, NodeApi, CommsTransport, MainActivity, existing context/checkout/argument/threading tests. DirectNodeApi and the native send source were inspected to avoid treating an application timeout as a definite rejection. NFT Wallet's guarded prepared-file cleanup is adapted unchanged apart from the Shop filename prefix, public access and wrapper lifecycle predicate. Completed verified files can be discarded; uncertain files remain available for inspection. No node, signing implementation, shared DirectNodeApi, wallet derivation, amount formatting or standalone app was changed.

Canonical sources: scripts/pandamonium-sources/merchshop/ and scripts/adapt-pandamonium-shop-payment.py. The Shop module depends directly on the already bundled NFT Wallet evidence library, following Inbox's existing dependency. Payment UI updates replace only the tagged status section and retain the order-reply Editable, composition, selection and focus across all four languages. Callback navigation is confined to its original checkout or matching order page. Eight new messages bring the shared catalogue to 5,330 entries per language. Legacy unresolved payments without a saved transaction cannot be safely auto-retried; their order page asks for review with the seller.

Validation: 42 Shop cases, 60 Inbox cases and 288 NFT Wallet cases pass (390 total); Pandamonium debug compilation passes. Cases cover atomic order/address rollback, duplicate order IDs, changed economics/recipient, concurrent reservations, paid status before posting, migration, restart, late/closed-host callback, pending/malformed ACK, exact native Minima/token payments, changed signed reference, shallow chain proof, mined-header changes, bounded recovery without another sign/post, verified cleanup paths and retained multilingual reply drafts. Public fixtures and mocked node/file commands only; no Activity.onCreate identity setup, owner node, wallet, keys, counters, files or funds were used. Final build log records up-to-date reuse for unchanged Inbox/NFT tasks rather than claiming fresh executions. All 19 pinned imports reproduce; catalogue, direct transport and whitespace checks pass. Evidence: build/localization/shop-payment-validation.json and shop-payment-build.log. The checkpoint also corrects the inherited stale catalog_messages count in the new ledger; older historical ledgers remain intact.

### Code Review

Summary: full changed source/adapters/tests/resources reviewed against the original buyer flow and reused payment journal. Address binding, exact economics and durable admission precede signing/posting. Recovery never replays an unknown transaction. UI refreshes preserve drafts and all monetary/protocol values remain literal. Findings corrected during review: a whole-page status refresh would discard a reply draft; an already-paid order could still offer preparation; and a payment check dialog incorrectly said it was sending. Verdict: approve this source checkpoint. Physical Fold acceptance and final release gates remain open.

All signed 1.9.47 candidate APKs/checksums remain unchanged and require a final rebuild for current source. The original 1.9.41 baseline, node JAR and protected wallet/audit sources remain unchanged. No publication occurred. Remaining work is the recorded AtomiX review, text coverage/formatting disposition, Fold UI/lifecycle acceptance and final signed release/publication; this checkpoint completes the recorded Shop durable payment implementation and host regressions.


## AtomiX Minima responder context and queued signing — 2026-10-18

The Minima counter-leg now retains the market and publication generation observed at admission. A delayed UI task or coin response cannot persist or sign a new leg after a market change, intent change, host shutdown, connection change, identity halt or token mismatch. The existing ladder/OTC acceptance checks are re-run before persistence and at node-command execution. Each delayed attempt owns its reservation; an old coin/error/confirmation callback cannot release a newer attempt. Rows and successful-post notifications use the captured market. A started post retains its receipt even when the user changes market afterward.

Reuse: inspected integrated AtomiX `comms/NodeApi.java`, `swap/PublishGate.java`, `swap/SwapOrderBook.java`, `swap/MinimaHtlc.java`, `swap/SwapEngine.java`, `swap/SwapDb.java`, their callers and existing `PublishQueueTest`, `CpLockDeclineTest`, `HtlcTxnConstructionTest`, `MinimaReceiptTest`, `OrderMarketContextTest` and OTC tests. Standalone `apks/atomix` and `apks/usdtSwap` have the same unguarded responder callback and do not supply a fix. The existing NodeApi BooleanSupplier and DirectNodeApi.Request.begin authorization boundary are reused directly through the existing SignGate sequence; no new queue, SDK or dependency was introduced. Canonical adapter: `scripts/adapt-pandamonium-atomix-responder.py`; context fragment: `scripts/pandamonium-sources/atomix/responder-context.inc`.

SwapDb now throws when SQLite reports an unsuccessful reservation insert. The responder catches this before signing. Existing database schema and rows are unchanged. Known cancellation before post dispatch is a definite pre-post failure. Once the post has entered the shared worker queue, an ambiguous failure retains the existing POSTED tag, swap row and interrupted-write evidence.

The real command-boundary regression exposed another issue: a positive txnpost reply without an ID previously passed WriteSafety. Native `core/Minima/src/org/minima/system/commands/txn/txnpost.java` returns `TxPoW.toJSON()`; `objects/TxPoW.java` supplies its top-level txpowid. The existing strict send receipt predicate now also applies to txnpost. Missing, zero, malformed, incorrectly typed, pending or dry-run positive receipts retain the durable pause; they cannot report a successful lock. A receipt remains submission evidence, never chain confirmation. Claim/refund algorithms and their existing confirmation-depth policy are unchanged.

Validation: 389 AtomiX tests pass, including 18 new tests. New coverage uses public mocked identities, real SignGate/NodeApi/DirectNodeApi request boundaries, and disposable host SQLite. It exercises both markets; delayed reads; market/generation/token/shutdown changes; revoked OTC consent; changed ladder terms; a stopped handler; stale callback ownership; unsuccessful persistence; cancellation before signing/posting; malformed post replies; and late valid receipts after dispatch. Existing transaction construction, identity, OTC, publication and receipt tests remain green. Pandamonium debug compilation passes. All 19 pinned imports reproduce, transport verification passes, and 5,330 messages validate in all four languages. No device transaction, owner seed, key-use counter or wallet data was touched.

### Code Review

Summary: reviewed the complete changed source, adapter, context fragment and tests against the reused guard and persistence contracts. Findings corrected during this review: stale responder market/global labels, commands escaping authorization while queued, stale callbacks releasing a newer reservation, silent SQLite failure, and positive txnpost replies without transaction IDs. No unresolved finding in this source increment. Verdict: approve this checkpoint. Remaining ETH-side new-liability/host review, text/visual coverage and final release acceptance remain open.

Evidence: `build/localization/atomix-responder-validation.json`, `atomix-responder-tests.log` and `atomix-responder-import.log`. All prior source hashes outside the explicit reviewed set, the bundled node and protected wallet/audit files match the preceding Shop checkpoint. Signed 1.9.47 candidates are preserved and still require rebuilding for current source. Only Fold R3GL805K7MB was queried; it is unavailable. No release publication occurred.


## AtomiX ETH responder authorization and worker shutdown — 2026-10-18

The ETH responder captures its market/generation before entering the IO queue and takes a detached copy of the incoming coin. Its guard rechecks the same market, token, node connection, wallet identities and published ladder or persisted OTC consent. It is retained through approval and lock calls into the existing EthTx nonce serializer. A change during fee/nonce RPC reads prevents signing; a change during signing prevents broadcast. An already-dispatched write retains its receipt. Rows use the original market. The existing fee policy, nonce allocation/commit, contract encoding, chain-time timelock policy and claim/refund paths remain intact.

Shutdown previously discarded queued IO tasks without running their rejection handlers, leaving the process-wide cpEth marker held indefinitely. The existing DirectNodeApi.Request queued/executing/completed pattern now wraps submitIo tasks. Drained tasks invoke their existing rejection handler once; an obsolete runnable cannot later execute or release another host's marker. Executing work retains its own completion path and the new authorization checks.

Reuse inspected: integrated `atomix/eth/{EthTx,EthHtlc,EthRpc,EthSend}.java`, `swap/SwapEngine.java`, the preceding Minima responder guard, NodeApi's fail-closed BooleanSupplier contract, DirectNodeApi.Request.begin/cancelQueued, and existing ETH encoding/fee, order-context and retry tests. Standalone AtomiX has the same unguarded EthTx implementation; standalone/integrated ETH Wallet supplies no authorization-through-RPC guard. The adaptation extends the existing serializer and constructor rather than adding a transaction system or dependency. Canonical adapter: `scripts/adapt-pandamonium-atomix-eth-context.py`; fragment: `scripts/pandamonium-sources/atomix/eth-responder-context.inc`.

Validation: 402 AtomiX tests pass, including 13 new tests. Coverage includes both markets, queued context/key/connection changes, mutable scan results, revoked persisted OTC consent, changes during RPC/signing/broadcast, cancelled nonce allocation, valid late receipts, unchanged fees/calldata, shutdown marker release and existing refund/withdraw availability. Tests use synthetic public credentials and mocked RPC; no network, device, owner wallet or funds are used. Pandamonium debug compilation and all 19 pinned imports pass; transport and four-language catalogue checks pass. The preceding 622-source hash ledger was checked outside this explicit reviewed set; bundled node and protected wallet/audit sources remain unchanged.

### Code Review

Summary: reviewed the full changes to the engine, ETH constructor/serializer, adapter and tests. Corrected the delayed ETH context check, global-market row label and dropped queued-task marker. The existing fee/nonce/contract algorithms are retained. Verdict: approve this source checkpoint. This completes the recorded responder/host review; it does not claim universal transaction correctness or replace device acceptance.

Evidence: `build/localization/atomix-eth-context-validation.json`, `atomix-eth-context-tests.log` and `atomix-eth-context-import.log`. No APKs were overwritten or released. Signed 1.9.47 candidates remain preserved and need the final current-source rebuild. Remaining release work is current text coverage/formatting disposition, Fold state/visual acceptance and final signed publication to the authorized destinations.


## Current-source startup/receive text audit — 1.9.48 / 119

The historical direct-text inventory was rechecked against current source. Its remaining literal entries are product names (PandaPools, Terminal IDE, Minima Wallet), the MINIMA/MxUSD pair label and a version prefix. Current Java display setters, toast/channel sites and XML text attributes were then searched. Raw XML alone is not evidence of a display gap: many inherited layouts have no current Java references, and active dynamic fields have explicit Language bindings. Inspected examples include core tabs, backup/vault/resync states, password descriptions, Home key-use state, Terminal IDE JSON hints, Future Cash subtitle and UTXO/NFT style controls.

Five actual gaps were corrected: initial core footer, invalid extra-parameter notice, duplicate-node/port notice, service-started toast, and NFT Wallet receive-error toast. Core uses the existing Language.msg/setText pattern from HomeView and adjacent service notifications; the receive error reuses NftMessages.message unchanged, including literal preservation of unknown node details. The importer adaptation is updated. Four entries bring the catalogue to 5,334 messages in English, Simplified Chinese, Russian and Ukrainian. Port 11001 remains a literal placeholder value; all node startup and wallet operations are unchanged. Version is 1.9.48/vc119 under the existing app-source commit rule.

Validation: 729 passing existing tests (146 PandaBear, 146 BlackBear, 149 Pandamonium, 288 NFT Wallet). All 19 pinned imports reproduce; catalogue/transport/whitespace checks pass. No implementation-mirroring tests were added for these label-only edits. Application-level Language initialization precedes service creation. The new footer binding is replaced by the existing live footer binding when data arrives, so switching language does not restore an obsolete placeholder.

### Code Review

Reviewed all changed source, adapter and four-language entries. The changes affect displayed labels and the required version only; no commands, amounts, wallet operations, services or node behavior changed. Verdict: approve this checkpoint. Evidence: `build/localization/startup-labels-validation.json`, `startup-labels-tests.log` and `startup-labels-import.log`. The native node and protected wallet/audit hashes remain unchanged. This audit increment does not claim full visual/accessibility acceptance. Current broad text-path coverage/disposition and Fold acceptance remain open; signed current-source candidates are built separately.


## Signed 1.9.48 build checkpoint — 2026-10-18

Source commit: `a98d9c2ee3b24885f6c538f5abd1c86f4a454870`, verified on fork branch `feature/bear-languages-2026-10-16`. All three signed release builds completed. The 25 host test tasks report 2,677 passing cases, zero failures/errors/skips; four tasks have no test source. Gradle reused five up-to-date test tasks and ran the remaining test tasks with source. All 630 checkpoint source hashes and the baseline node JAR match.

APKs in `/Users/eurobuddha/Projects/minima/apks/base/dist` retain the baseline signing certificate and package IDs, version 1.9.48/vc119, non-debuggable release metadata and arm64 libraries. APK ZIP alignment was verified at 16 KiB. Each APK contains all 5,334 catalogue resources in English, Simplified Chinese, Russian and Ukrainian, with the four declared locales. SHA256 sidecars accompany each artifact.

- `minima-core-PandaBear-1.9.48-candidate.apk`: `28eb5eccda1c0f7974b01f3e46ba1d33bd79be240d41f7b61cb08158e231dd27`
- `minima-core-BlackBear-1.9.48-candidate.apk`: `edcf705218968aa15ba51426d6eb1538e1a021f6e417a43235ef50fb17a3aabd`
- `minima-core-Pandamonium-1.9.48-candidate.apk`: `c8789f052e51d397fb1b32cde0d6148dc1e0e843ed4547b7d4bf14d5a6e7b13d`

Evidence: `build/localization/bear-1.9.48-validation.json`, `signed-candidates-1.9.48-validation.json` and dist manifest `bear-languages-1.9.48-candidate.json`. Earlier candidates remain preserved. These are signed candidates; current text coverage/disposition and data-preserving Fold visual/runtime/minimaWallet acceptance remain open. No device installation or public release is claimed.


## Chat notifications and static coverage disposition — 2026-10-18

The current display-setter and notification scan found English labels in the active Keets drainer and Parlons inbound notifier. ChatDrainer now uses existing photo/voice labels, a chat-specific plural count and translated tap text. MaxChatNotifier uses the existing contact fallback, the unchanged ChatPreview helper for parsed media and a translated generic payment label. Contact names, captions, message bodies and payment data remain literal. Payment notifications retain their existing detail level. PendingIntents, notification IDs/channels, control-message filtering, durable storage/ack order and transport behavior are unchanged. The shared catalogue has 5,337 entries in four languages. Version is 1.9.49/vc120 under the repository app-source commit rule.

Reuse sources inspected: app/src/main/java/com/eurobuddha/minimacore/i18n/ChatPreview.java; localization/src/main/java/com/eurobuddha/minimacore/i18n/Language.java; integrated/mail/src/main/java/com/eurobuddha/mail/MainActivity.java; and Parlons maxima/build/account-import/{chatshared/com/eurobuddha/maxima/app/i18n/ChatPreview.java,app/src/main/java/com/eurobuddha/maxima/app/chat/ChatNotifier.java,localization/android/test/com/eurobuddha/maxima/app/i18n/ChatPreviewTest.java}. The existing helper translates parsed type labels without matching user text against English strings.

Static sweep: inspected direct Java text/title/message/hint/notification setters and literal toasts/buttons, plus active Java-referenced layout/menu attributes. XML contentDescription uses the existing l10n:description binding (not a contentDescription tag property). Active core accessibility attributes are bound; dynamic core backup/vault/restore/footer/log state, embedded style controls and Terminal IDE JSON hints are bound in Java. Remaining literal values in these inventories are brands, amounts/IDs, input drafts, captions/names, protocol samples, symbols, raw node output or unused legacy templates. App-row placeholders are replaced by external app names/package IDs and translated states. UTXO and PandaDEX toast helpers map diagnostics; NFT, Future Cash, Casino and PandaPools alert paths resolve their labels. MaxChatThreads.preview has no current caller; ChatView uses ChatPreview directly. No getIdentifier lookup was found in current app/integrated Java. No multiword catalogue sentence was identical to English in another language. These are bounded source checks, not proof of all runtime behavior or linguistic quality; all 19 app acceptance checks remain subject to Fold review.

Inherited optional node issue disposition: MySQLConnect.searchCoins formats Double SQL result values with default-locale %f. The local source and shipped bytecode confirm the defect. The shipped node JAR is byte-identical to baseline 1.9.41 (Git blob 24a063e587c7dc0da083df5ddcf5615cee209488; SHA256 d1ca0f0a34e21ff9755e8b356afeb6513f1fcf6391473feb4b73c127c1ce7cc3). Its init calls DriverManager.getConnection; the Class.forName call is in the standalone demo main, not init. No MySQL/MariaDB driver dependency or Java dynamic DEX loader was found in the app/build definitions and code inspected; all three signed 1.9.48 APKs lack the standard checked MySQL/MariaDB Driver descriptors. This is retained as an inherited limitation of an optional externally supplied JDBC path, outside the bundled Android integrations. It is not marked fixed, and no general claim about external extensions is made. Preserve the required node baseline; a driver-enabled node distribution would need its own correction and validation before relying on these Double results. It does not add an Android release gate for an unbundled driver path.

### Code Review

Summary: the minimal notification display changes reuse existing parsing and localization; no operation or persistence code changed. All changed Java, version/catalogue and generated resource changes were inspected, including plural categories and literal user data handling. Findings: no blocking issue in this diff. Verdict: approve this source checkpoint. Existing regression suites pass 453 executions (146 PandaBear, 146 BlackBear, 149 Pandamonium, 12 localization), with zero failures/errors/skips. All 19 pinned imports, transport, catalogue and whitespace checks pass. Evidence: build/localization/chat-notifications-validation.json, chat-notifications-tests.log and chat-notifications-import.log. Fold R3GL805K7MB is still absent; no device data was accessed. Signed 1.9.48 candidates remain preserved and must be superseded by rebuilt candidates for this source.


## Signed 1.9.49 candidates — 2026-10-18

Source `8eab9ba0eb5fb4bddafe2762f269b40d49912120` is committed and exact-hash verified on fork branch `feature/bear-languages-2026-10-16`. All three release builds and 25 host test tasks completed successfully: 2,677 passing executions, zero failures/errors/skips, four NO-SOURCE tasks and five valid UP-TO-DATE tasks. All 632 source hashes and the baseline node/wallet protected hashes match.

The three candidates in `/Users/eurobuddha/Projects/minima/apks/base/dist` have the original family signing certificate, correct package IDs, 1.9.49/vc120 metadata, non-debuggable arm64 packaging, verified 16 KiB ZIP alignment, all four declared locales and all 5,337 catalogue resources per locale. SHA256 sidecars are saved. Prior APKs remain preserved.

- `minima-core-PandaBear-1.9.49-candidate.apk`: `cfaa64ea66d4f7920edd5383e2e69fe866cbb3a1e954106e5daa95254fc59632`
- `minima-core-BlackBear-1.9.49-candidate.apk`: `05bfc53e13a6c2095d28e290931356c46a30f745c7a09ba963570aa45b14b27b`
- `minima-core-Pandamonium-1.9.49-candidate.apk`: `d342979872f45a7788533443bd5fae6e1ed3cf60a4baf8841d1ed238b9ae48ec`

Evidence: `build/localization/bear-1.9.49-validation.json`, `signed-candidates-1.9.49-validation.json` and `dist/bear-languages-1.9.49-candidate.json`. No public release or installation has occurred. The final serial-specific ADB check still reports Fold R3GL805K7MB not found. Reconnection has been requested.

Remaining acceptance: data-preserving signed upgrade on the Fold; explicit four-language selection and persistence; unchanged activity/input/operation state while switching; lock and biometric behavior; long labels and accessibility; populated minimaWallet behavior; all 19 integrated apps. Existing disposable instrumentation disables AppLock and requires ranchu hardware, so it must not run on the owner Fold. Use the signed candidate and normal UI paths, preserve owner data and signing state, and do not initiate financial actions merely to exercise labels. After acceptance, publish the accepted versioned artifacts and checksums to the authorized GitHub fork, PandaApps and eurobuddha.com. No other device or app store is authorized.


## Fold signed installation — 2026-10-18

Fold R3GL805K7MB reconnected; verified SM-F971B / API37. Installed all three verified release-signed 1.9.49/vc120 candidates with `adb -s R3GL805K7MB install -r --user 0`. Pandamonium was an in-place upgrade from 1.9.41/vc112; PandaBear and BlackBear were not previously installed. Each installer returned Success and Package Manager confirms the expected package/version for personal profile 0. Candidate checksums were verified before installation. No uninstall, app-data clearing, lock change, seed reset/import or transaction command was issued by this agent.

The normal Pandamonium lock requested owner authentication. The app subsequently reached minimaWallet, where a Working dialog was observed; a later fresh UI tree no longer showed that work and instead showed a populated core Send form. Stop UI interaction while that owner draft is active; readiness was requested. Do not tap Send, alter fields, or dismiss the form on the owner's behalf. The prior UI dump after an idle-timeout failure was stale and was not used to select any action. Subsequent UI reads required a successful fresh dump.

Evidence: `build/localization/fold-1.9.49-install-validation.json`. Installation is now complete; four-language persistence, retained-state, visual/accessibility, lock and integrated-app acceptance are still incomplete. Existing disposable instrumentation was not run. No public publication occurred. Resume normal UI validation when the owner says the Fold is ready.


## NFT metadata display fix — 1.9.50, 2026-10-18

User reported image payloads and JSON names expanding UTXO coin rows and appearing as NFT labels. Reused the explicitly named MinimaCore balance implementation: `BalanceAdapter.java`, `tokens/TokenMeta.java`, `tokens/IconResolver.java`, `tokens/ImageLoader.java`, `view_balance_row.xml`, and `TokenNamesTest.java`. The sibling UTXO/NFT parsers lacked the core parser's string-to-JSON conversion. Adapted that conversion to org.json, including serialized nested names and the existing StateNft token envelope. Existing image loaders receive the decoded icon; no new image implementation was added. Coin rows reuse BalancesView's one-line ellipsis. Collection fallback names no longer expose raw JSON.

Both integrated apps and their reproducible importer adaptations are fixed. Standalone sibling repositories have not been modified. The regressions cover 128 KiB embedded-image metadata, serialized balance/coin records, nested JSON names, collection envelopes/covers, missing names, multilingual literal names, raw-input preservation and exact amounts. Two overlapping initial Gradle runs interfered with report writing; a fresh sequential run regenerated all relevant reports successfully: UTXO 12, NFT Wallet 292, Pandamonium host 149, total 453; zero failures/errors/skips. All 19 pinned imports, transport, catalogue (5,337 messages in four languages) and whitespace checks pass.

Code review: all changed Java, tests, adapter and version changes inspected. Financial command construction, coin amounts, raw state, selection/spendability checks and image-loading security code are unchanged. StateNft changes are confined to metadata parsing. No blocking findings. Verdict: approve the source patch; device visual/runtime acceptance remains pending. Version is 1.9.50/vc121. Evidence: `build/localization/bear-1.9.50-validation.json` and `nft-metadata-final-tests.log`. Build signed candidates next; do not interrupt the owner's active Send form.


## Full review: NFT metadata fixes including MiniMall Studio — 2026-10-18

### Summary

Reviewed the complete patch since `5fb4fa5`: UTXO Wallet and NFT Wallet metadata/name parsing and bounded coin labels; NFT Wallet and MiniMall Studio collection parsing; Studio token names/icons; the shared importer adaptation; regression tests and canonical test copies; version metadata and validation records. Studio's three new regression cases initially failed, reproducing serialized JSON labels, missing images and raw JSON fallback names. It now reuses the core balance coercion and existing collection envelope logic. Its cards and exporter already consume these fields, so their layout, editable catalog, image pipeline and export logic remain intact. Standalone sibling repositories remain unchanged.

### Findings

No blocking findings in the final patch. Confirmed ordinary and multilingual names remain literal, missing-name localization remains intact in both wallets, root/nested/enveloped JSON metadata decodes consistently, large image payloads no longer become names, and malformed coin labels remain bounded. Metadata inputs and exact amounts are preserved. Both StateNft files are byte-identical to the prior source outside `parseMeta`; transaction/state handling, supply overflow checks, Studio data validation and shop-export ownership checks are retained. Importer source-drift guards and all 19 pinned imports pass.

### Verdict

Approve the source patch. Full host regression: 25 tasks, 2,686 passing tests, zero failures/errors/skips; valid UP-TO-DATE tasks are recorded separately from executed tasks. Transport, 5,337-message/four-language catalogue and whitespace checks pass; the node JAR still matches the baseline SHA256. Evidence: `build/localization/bear-1.9.50-validation.json`, `nft-studio-full-regression.log`, and `nft-studio-metadata-import.log`. The full review and checks completed before the final signed build.

The owner is AFK and disconnected the Fold for about one hour, requesting completed fixes, full review and prepared APKs. Do not attempt installation or device interaction. Rebuild the three signed 1.9.50/vc121 candidates with the Studio fix before staging any artifact in dist. The earlier wallet-only 1.9.50 build was not staged, installed or published. Device visual/runtime acceptance and publication remain pending.


## Signed 1.9.50 candidates ready — 2026-10-18

The full NFT display fix review and 25-task regression finished before building from `9144188971cf5fae859ab784f785a39010af02a6`. All three APKs in `/Users/eurobuddha/Projects/minima/apks/base/dist` pass original-certificate, package/version (1.9.50/vc121), non-debuggable arm64, 16 KiB ZIP alignment and four-language resource verification. Old candidates are preserved. SHA256 sidecars and the candidate manifest are saved.

- `minima-core-PandaBear-1.9.50-candidate.apk`: `a73d0c31a41ed37b6ec3e6034b0f09f9647bc43c1d9d603dbf57ee3344cb7307`
- `minima-core-BlackBear-1.9.50-candidate.apk`: `c185098cd44b366290c5b68f0ad74ee87cde6a2337de4ac17b72e68f29438f22`
- `minima-core-Pandamonium-1.9.50-candidate.apk`: `ed4a2e30dfe491fce0d82b89f3a7e9f6d3c9a7471fb268958dbbb5bab3b92b53`

Evidence: `build/localization/signed-candidates-1.9.50-validation.json` and `dist/bear-languages-1.9.50-candidate.json`. These builds include the integrated UTXO Wallet, NFT Wallet and MiniMall Studio fixes. No 1.9.50 installation or public publication occurred. The owner disconnected the Fold while AFK; resume data-preserving installation and visual/runtime acceptance when it is reconnected.


## Active goal: Atelier and The Salon in Pandamonium — 2026-10-18

The complete objective is to integrate both native apps with English, Simplified Chinese, Russian and Ukrainian, using the existing explicit selector. This section is an implementation checkpoint, not completion or release approval. The preceding turn installed 1.9.51 and made verified progress; this goal turn adds and tests the first integration slice.

### Sources and reused boundaries

- Atelier Android: `/Users/eurobuddha/Projects/minima/mds/statenft-suite/android`, version 0.7.18, parent suite commit `2a9a6ae`. Salon: `/Users/eurobuddha/Projects/minima/apks/salon`, version 0.11.34, commit `f216ab1`. Both working trees were clean at source inspection; precise revisions and hashes are in `integrated/sources.lock.json`.
- Existing `scripts/import-pandamonium.py`, `adapt-pandamonium-direct.py`, Mall/Vestr main-handler and Boolean-result gates, `DirectNodeEvents`, `PandamoniumDestinations`/`PandamoniumOrder`, and retained `Language` bindings.
- New adapters: `scripts/adapt-pandamonium-creative.py` and `scripts/adapt-pandamonium-creative-languages.py`. Always update adapters and generated modules together, then verify all 21 imports using `PANDAMONIUM_SOURCE_ROOT="$PWD/build/localization/pinned-sources" python3 scripts/import-pandamonium.py --verify`.

### Completed checkpoint

- [x] Import the full native sources, resources, FILTR and art engines, AI model and inherited tests; preserve the canonical art and hosting/Arweave public parity fixtures.
- [x] Append Atelier and The Salon to the existing destination identities (17 and 18), preserving saved order and existing apps.
- [x] Link both modules only into Pandamonium; use the embedded Minima node client and background event dispatcher.
- [x] Separate hosting preferences, keystore aliases, provider authorities, shared-file directories and notification identifiers in one UID.
- [x] Prevent unrelated wallet events from creating Salon identity keys before Salon has been used. Configured inboxes retain their donor signature-checked intake.
- [x] Bind initial navigation, Atelier launch/gallery labels and node status to the shared four-language library without screen recreation. Catalogue now has 5,355 entries (18 added); this is partial language coverage.
- [x] Verify existing 19 snapshots were unchanged when adding the two apps; all 21 import snapshots now reproduce.
- [x] Compile Pandamonium and pass 53 Atelier tests, 13 Salon tests, 150 host tests and 12 localization tests (228 total across the current reports). New tests cover direct reply completeness, saved destination order, and unused/configured Salon event intake.

### Remaining requirements — full goal, not optional polish

- [ ] Atelier: every native editor, collection/detail/gallery action, Single NFT and Token wizard, generative art style/slot controls, hosting settings and trust dialogs, scan/adopt/recover paths, image actions and validation/errors.
- [ ] Atelier: FILTR HTML/JS controls, tools, sheets, chooser/bridge messages, in-place language changes preserving edits. Keep `artstudio/art.js`, FILTR engine math and model bytes unchanged; translate display labels only.
- [ ] Atelier: mint/airdrop notifications, progress, phase labels and historical diagnostic display; retain transaction strings and metadata supplied by users.
- [ ] Salon: Feed, Discover, profile/content/media editors, hosting and trust dialogs, onboarding/claim, tips, messages/replies, backup/restore, notification text, diagnostics and dynamic counts/dates. Keep content, handles, keys, protocol strings and command amounts literal.
- [ ] Salon transport: current donor MaximaLink still uses the optional external Parlons IPC path. Inspect and reuse the host `MaxChat.node()`/`media()` interfaces for embedded Salon messaging/media while preserving sealed payloads, callback outcomes, subscriptions and lifetime. Do not remove features to avoid this work.
- [ ] Review donor paths exposed by integration: `MainActivity.adoptOrMint()` currently mints even after a failed balance read; verify complete snapshot evidence before permitting mint. `SalonComms.loadOrCreateSeed()` currently creates a replacement after decrypt failure; review against the existing preserve-key behavior before accepting the integration. Review Atelier's phantom-removal path on failed token reads. These are not fixed by shell localization.
- [ ] Full code review of all integrations and translations, catalogue/placeholder and untranslated-label audit, regression tests, importer reproduction and package/resource checks. Current review only covers the packaging/direct-node/initial-label boundary, not the donor apps end to end.
- [ ] Test language switching, retained drafts and active operations, lock behavior, notifications, WebView state, navigation and layouts on the authorized Fold only. Never run disposable-device fixtures on owner hardware. Existing full instrumentation compile also has unrelated obsolete AtomiX OtcDb fixtures to resolve before claiming a full device-test build.
- [ ] Build and verify signed versioned release APKs after full review, then install on Fold as authorized; keep public publication behind the existing final acceptance gate. Current 1.9.52 source has no signed candidate or device installation.

Evidence: `build/localization/creative-integration-foundation.json`, `creative-shell-tests.log`, `creative-events-tests.log`, `creative-import-verification.log`. Goal remains active.


## Atelier viewer/editor and creative notifications — 2026-10-18

Goal remains active. This checkpoint adds complete display bindings for Atelier's native lot viewer and crop editor, the native FILTR picker/save notices, Atelier's mint notification and Salon's tip/media notification labels. It adds 62 catalogue entries, bringing the shared catalogue to 5,417 messages in English, Simplified Chinese, Russian and Ukrainian. Full FILTR WebView UI and the other remaining requirements above are still open.

Reused the complete donor ViewerScreen/ImageEditor implementations, retained Design/Language bindings, existing NFT Wallet service language listeners and shared NotificationLabels channel updater. Viewer metadata, traits, addresses, URLs, collection names, message bodies and amounts remain literal. Crop/look keys, image math, art/FILTR engines, AI model and mint/airdrop algorithms are unchanged. One-line toolbar/control labels prevent longer translations from changing the crop area. Existing channel settings remain owned by Android; only channel names/descriptions update. The mint listener registers after successful foreground promotion, unregisters at destruction, and ignores late notification refreshes after shutdown.

Validation: 56 Atelier, 13 Salon, 12 localization and 150 Pandamonium host tests pass (231 total; zero failures/errors/skips). Includes two service lifecycle tests using mocked Android/node boundaries and one actual Robolectric native-graphics test that loads the real four-language resources, keeps the same crop view/filter and compares an edited image pixel-for-pixel through all four language selections. This is host simulation, not Fold runtime acceptance. The owner Fold remains absent from ADB; the connected S10+ is untouched. All 21 pinned imports reproduce; catalogue, transport and whitespace checks pass. Evidence is in build/localization/creative-presentation-validation.json and creative-{notification,viewer,editor,retained-editor}-tests.log.

Code review: inspected all changed adapters, native display/lifecycle paths, new tests and catalogue/generated resources. No blocking findings in this patch. No financial commands, seed routines or transport logic changed. This limited approval does not clear the previously listed donor balance/seed/phantom-removal concerns or the full integration review. Version is now 1.9.53/vc124 for the code checkpoint; no signed 1.9.52 or 1.9.53 APK, device installation or publication is claimed. Next: remaining native/hosting/FILTR interfaces and embedded Salon Maxima/media, followed by the unresolved donor error paths and full acceptance.


## FILTR four-language checkpoint — 1.9.54, 2026-10-18

Atelier's FILTR WebView now follows the shared explicit English, Simplified Chinese, Russian and Ukrainian selection. Reused the retained DOM binding functions from maxima/build/account-import/account/src/main/resources/panel/i18n.js. The new adapter marks app-owned labels and generates its offline dictionary from the shared catalogue. It covers effect/control/option/preset labels, annotation controls, panels, prompts, statuses and accessibility labels. User annotation text, filenames, engine enum values and rendering algorithms remain literal. Existing icon-button patterns keep Undo/Redo compact; Apply remains visible at 390px and category labels occupy two fixed-height lines.

Actual browser regression loads FILTR/WebGL with synthetic images, switches all four languages and verifies the same image, crop, history, settings, annotation, DOM controls, selected input text and open panel. It also exercises original enum values and prevents translated empty-image text from opening the effects panel. Three native regressions cover the language bridge, foreign-page guard and listener/WebView cleanup. Final Android run succeeds; valid reports contain 59 Atelier, 13 Salon, 12 localization and 150 host tests with no failures/errors/skips. The final resource-only rerun executes Atelier and retains valid up-to-date host/localization results. All 21 pinned imports reproduce, catalogue generation validates 5,688 messages, and transport/whitespace checks pass.

Evidence: build/localization/creative-filtr-validation.json, creative-filtr-browser.log, creative-filtr-tests.log, creative-filtr-final-tests.log, creative-filtr-import.log and filtr-screenshots/. Screenshots were inspected for Russian and Ukrainian at 390px; browser checks are not Android device acceptance.

The full integration goal remains active: remaining Atelier and Salon native screens, Salon embedded Maxima/media, recorded donor identity/financial error paths, full review and Fold acceptance. No 1.9.52–1.9.54 signed APK, installation or publication has occurred. On this turn the owner reported a connection, but ADB sees only S10+ R58M307HEEN; the authorized Fold R3GL805K7MB is absent. Other devices remain untouched. All three 1.9.51 installs on the Fold were already verified in the prior installation record.
