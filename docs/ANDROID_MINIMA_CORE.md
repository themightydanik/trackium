# Trackium Android / BlackBear integration

Standalone native Kotlin application, not an MDS MiniDapp. BlackBear 2.2.10 was selected because it supplies the built-in wallet and the public MinimaAPI Android IPC SDK. It has no MDS. The classic MDS publisher remains an optional isolated legacy adapter; desktop Server publication still uses private authenticated RPC. No Eurobuddha repository is changed.

## Implemented and unvalidated

Implemented: five native screens (Dashboard, Shipments, Devices, Proofs, Settings), real tenant API observations, route/checkpoint and telemetry details, wallet/status observations, explicit owner pairing, signed jobs, foreground consent, durable publication/reconciliation and proof-bundle sharing. No WebView, arbitrary command input, JavaScript wallet bridge, demo TXIDs, seed import, background publisher or automatic backlog. Lists show the first 25 shipments/devices and at most 50 proofs per shipment; creation/editing remains on Gateway. Readings remain synthetic/unverified. A recent block is an observation, not proof of global synchronization.

The APK compiles and JVM/PostgreSQL/mock-IPC tests run in cloud. **No real Android IPC exchange, wallet signature, Mainnet submission or device lifecycle test has been performed.** The first real transaction is a manual operator acceptance test. This is not a production-readiness claim. Real GL110-GL decoding/tracker authentication and physical attestation are still outside this work.

## Reviewed dependencies and binaries

| Component | Exact reviewed version / commit |
| --- | --- |
| Android host + vendored public MinimaAPI | `eurobuddha/minima-core-android` `74206453dacbd5e00bf6a498474bdd77c9c59d63` |
| Selected APK | [2.2.10-BlackBear](https://github.com/eurobuddha/minima-core-android/releases/download/v2.2.10-BlackBear/minima-core-BlackBear-2.2.10.apk), versionCode 280, `com.eurobuddha.minimablock` |
| APK SHA-256 | `8428f694b509172f5f0b7a7c2f12596f31350a5755660ee7af508228f023bd0e` |
| APK signing certificate SHA-256 | `eca1383c9d27683a281fbe6355356267877dc2dd14d963d7cc289ca0700e517f` |
| APK catalog | `eurobuddha/minima-core-apks` `91509896583da7532d03a1ac2f585aa86b3b1deb` |
| Android source bundled minima.jar | SHA-256 `2fc973bcbf37ebc8581e25a2a2b0669ffe92d528fb28af47d5d5582265d59532`, reports `1.1.2.31-euro4` |
| Trackium engine fork | `themightydanik/minima-core` `c2a54a2e46b2c3a4fd541b80e7d7f5e7afe7d4da`, reports `1.1.2.31` |
| Additional engine reference | `eurobuddha/minima-core-fork` `7b5994a33c77f0af0bf74fb7e20db1d8e8f30552`, older micro4, not asserted identical to APK |
| Terminal integration example | `eurobuddha/minima-core-android-terminal` `73eb11014d2165d3e4247b4ce4d5a2638c382716` |
| Build | Gradle 8.11.1 (wrapper checksum pinned), AGP 8.10.1, Kotlin 2.1.21, compile/target SDK 36, min SDK 28, build-tools 35.0.0; JDK 21.0.9+10 used; app bytecode 17, SDK bytecode 11 |
| Test-only libraries | JUnit 4.13.2, Mockito 5.12.0, org.json 20240303 |

The released APK was downloaded, hashed and its signing certificate verified with apksigner. Its DEX contains `1.1.2.31-euro4`; the source Android jar reports the same version. This is not a reproducible-build attestation or proof that the APK exactly matches the Trackium engine fork. The app pins the **actual approved APK, certificate, version and installation identity**; other builds/updates require a source review and deliberate application update, not a bypass switch.

Five public Java SDK files are copied unchanged under `apps/android/minimaapi`; SHA-256 provenance is in `SOURCE.json`, Apache-2.0 license included. DirectNodeApi, Ethereum and embedded privileged APIs are excluded. Gateway remains Node/pg and has no Android dependency.

## IPC and permission contract

`MinimaAPI(Context, listener)` registers the response receiver and automatically sends REGISTER. Its normal discovery waits 1500 ms and refuses commands when several nodes reply. Trackium wraps its Context to allow only explicit `com.eurobuddha.minimablock` REGISTER/CMD broadcasts; no other node is contacted. The BlackBear action/extra prefix is `com.eurobuddha.minimacore`, despite the different package ID. SDK random application/node IDs are encrypted, never exposed in UI or logs.

The user must enable Trackium and grant **ADMIN** in BlackBear's Apps screen. Initial registration is disabled/non-admin. Reconnect after changing grants. BlackBear rejects privileged commands instead of offering the classic MDS pending-approval flow, and rechecks permissions before queued execution. ADMIN is broad Core authority, not a cryptographic restriction to the Trackium commands; review the installed Trackium APK. No wallet keys or backup files are requested.

Methods used: constructor, `Command(String, MinimaAPIListener)`, response callback, `onDestroy()`. `FileCommand`, `DirectNodeApi`, notification subscriptions and secret-key APIs are not used. Large responses are read through the SDK's content-URI mechanism: Trackium validates provider authority/UID, file size ≤2 MiB and inline size ≤2 MiB first. Unknown-size files are rejected. API 34+ outgoing broadcasts share sender identity; replies additionally use SDK request IDs (the reviewed Core does not always share reply identity). This is not hardware attestation and does not protect a compromised/rooted OS.

Commands allowed by Trackium:

```
status, getaddress, balance, scripts, coins, txpow
 txnlist, txncreate, txnaddamount, txnstate, txnbasics,
 txnsign, txncheck, txnexport, txnimport, txnmine, txnminepost
```

Commands are fixed by code, single-command only, no semicolon batches/CLI passthrough. Read responses are the SDK's `{status,response}` envelope; arrays such as coins/balance remain arrays. `txnexport showtxn:true` returns `{data,txn:{transaction,witness}}`; `txnmine` returns `{txpowid,data}` **without broadcast**; `txnminepost` returns `{data:<TxPoW>}`. Exact transaction amounts are checked with 44 decimal places, no floating-point spend decisions. Command timeout is 20 seconds, mining 135 seconds. Timeout means unknown outcome, not cancellation.

### Essential wallet trust boundary

**Use a dedicated wallet, one running wallet copy, and only trusted enabled Core apps, including READ apps.** The reviewed Core uses a shared custom-transaction namespace. Several mutation commands are not WRITE-classified, `txnsign` signs a mutable row, and `txnlock` is voluntary. A hostile enabled READ app can race row validation/signing; Trackium cannot enforce transaction isolation inside an unchanged Core. The user must explicitly acknowledge this prerequisite in Settings and each event approval. Do not enable live publishing in a Core shared with untrusted apps. Strong isolation would require a reviewed Core change (per-app transaction ownership or atomic expected-digest signing); this PR does not pretend to provide it.

Core owns block-as-key-uses, one-time signature indices and persisted counters. In the reviewed engine `Wallet.signData` is synchronized and persists `updateUses` after signing; Trackium never selects an index or rewinds counters. Trackium cannot detect another device restored from the same seed, reverse an unsafe backup restore or guarantee crash atomicity of Core's wallet database. Classic and BlackBear address derivation also differ: do not assume restoring a classic seed gives the same address.

## Gateway sessions and database

Migration `005_native_android.sql` is additive and checksum-tracked. It adds immutable publisher transport to proofs/policies, maps existing local proofs to `mds_legacy`, and introduces native challenges, sessions and replay nonces. Existing packet journal, events, ownership claims and migrations 003/004 are unchanged. Stop older workers before upgrading; mixed-version wallet workers are unsupported.

Enable `ENABLE_NATIVE_CLIENTS=true` with a trusted HTTPS `PUBLIC_ORIGIN`; native support is off by default. Terminate TLS on a controlled reverse proxy, keep the Node listener private, and do not broaden CORS. The APK uses system CA TLS, no redirects, no cleartext/user-info URLs, no browser cookie import. Native authentication is not Android device attestation.

1. APK creates a random 256-bit proof locally and sends only its SHA-256 with tenant ID to `POST /v1/native/challenges`. Challenge TTL: 2 minutes, maximum 10 active per tenant / 2000 globally.
2. Tenant owner uses an external read/admin/publish credential to explicitly approve that UUID. Neither a Minima UID nor an unauthenticated challenge establishes ownership.
3. APK claims once with the secret at `POST /v1/native/claim`. Claims lock/consume the challenge transactionally. Sessions last 15 minutes, have only read/publish scopes and the audience `trackium:native:v1:<HTTPS origin>`.
4. Every authenticated request signs exact method, path/query, timestamp, nonce and raw-body SHA-256. PoP key derivation: SHA256 of `trackium:native:pop:v1`, NUL, proof, NUL, challenge UUID, NUL, returned token. HMAC input: LF-joined `v1`, method, path, 13-digit timestamp, 128-bit lowercase hex nonce, body hash. Timestamp skew ≤30 seconds; nonce is unique per session; maximum 900 requests. No cookies or Origin are accepted with native credentials.
5. `GET/DELETE /v1/native/session` observes/revokes the current session. Owner can `DELETE /v1/native/sessions/:id`. Revoking the approving owner credential immediately invalidates its sessions. Expiry/revocation requires re-pairing, without discarding publication artifacts.

Session token and HMAC key stay in device-bound Android Keystore AES-GCM encrypted, atomically replaced/fsynced files in noBackupFilesDir. SDK IDs, signer pin and proof checkpoints use the same encrypted store. No seed, wallet key or owner key is stored. Database PoP keys are server authentication secrets: restrict PostgreSQL/backups. Expired ephemeral authentication rows are pruned opportunistically after 24 hours when a new challenge is created. Public challenge abuse can still deny pairing within quotas; deploy request-rate limits at the HTTPS ingress. No public proxy is provided.

## Build, installation and first manual Mainnet publication

Build on a machine with JDK 17+ (21 tested), Android SDK platform 36/build-tools 35.0.0 and network access to Google/Maven/Gradle:

```sh
cd apps/android
# ANDROID_HOME must point to your SDK, or configure ignored local.properties.
./gradlew :app:testDebugUnitTest :minimaapi:testDebugUnitTest :app:assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

The APK is a **debug-signed evaluation build**, not a release artifact. Keep its signing key outside the repository; do not uninstall/reinstall or clear app data to bypass an uncertain publication. A release needs controlled signing/distribution, device acceptance and a reviewed update/recovery process. Install the exact BlackBear APK above separately after verifying hash/certificate. Start it and finish synchronization on Mainnet.

Run Gateway/PostgreSQL using `services/gateway/compose.yml` and the existing engine deployment instructions. Compose native support is off by default. Live deployment needs the engine variables and external signer/reader credential mounts from MINIMA_PROOF_ENGINE.md; the minimal compose file does not automatically mount secrets or enable wallet publication. Required operator configuration includes:

```text
ENABLE_NATIVE_CLIENTS=true
PUBLIC_ORIGIN=https://your-controlled-gateway.example
PROOF_MODE=live
PROOF_ALLOW_LIVE=true
PROOF_ALLOW_MAINNET=true
PROOF_PUBLISHER=local
PROOF_MAX_PUBLICATIONS=1
PROOF_JOB_SIGNING_KEY_FILE=/outside-repository/job-signer.pem
# Trusted independent full-node reader and external credentials configured separately.
```

No secrets belong in these examples or the repository. Keep the job signer file 0600. Native signatures do not require Gateway writer RPC access. Reader profile must match the independently reviewed node, not automatically copy the Android profile.

1. Trackium Settings: enter HTTPS origin and tenant UUID. Create challenge; verify it on both devices. On the trusted Gateway host approve with:
   `node services/gateway/src/proofs/admin.js native-approve HTTPS_ORIGIN OWNER_JSON CHALLENGE_UUID`.
   Complete pairing in APK, refresh, compare and pin the Gateway signer fingerprint through the trusted owner channel.
2. Discover/register BlackBear; open Core, enable Trackium + ADMIN, return and reconnect. Observe wallet/balance and block/peer status. Only actual Core observations are shown; available balance can change before coin selection.
3. On trusted Gateway host configure a new unused publisher policy with `publisher_kind: "local"`, `publisher_transport: "android_minimaapi"`, actual **hex** publisher address, `max_input: "0.01"`, `max_publications: 1`. Use existing `admin.js policy` and explicit event approval, not a browser owner key. Existing legacy policies with live proofs cannot be converted.
4. Approve exactly one event with `confirmation: "PUBLISH MAINNET <event UUID>"` using existing owner approval CLI. It expires; do not approve backlog. Use a dedicated small-balance wallet; coin input selection must fit the cap (not merely total balance).
5. In APK enable local live/Mainnet switches and confirm trusted Core apps/one wallet instance. Open approved job, inspect source trust, event, publisher, STATE and input cap. Check Core readiness and synchronization. Type the exact event-specific phrase and confirm.
6. Publisher makes a 0.001 MIN **self-transfer**, requests zero burn, checks all inputs/outputs belong to the approved address, native token, conservation, cap and exactly one STATE field. PoW, key uses and temporary input locking still apply.
7. The same canonical commitment/STATE port 250 as Server Publisher is used. Signed job envelope P-256, issuer fingerprint, immutable event chain, exact canonical bytes and SHA-256 are checked before any wallet mutation. Raw canonical sensor-number bytes are preserved; native code does not reconstruct cargo business events.
8. After posting, use fresh Gateway verification and exported proof bundle. Only independently observed inclusion/depth can become confirmed. Reader is a trusted full node, not a trustless light client. A commitment proves bytes, not a genuine sensor reading. Synthetic remains synthetic.

## Durable state and recovery

Persisted identity includes job, Gateway origin/tenant, signer pin and exact Core package/certificate/install/update identity. A mismatch halts recovery. App allows one operation at a time, no background service. Closing/rotating the Activity revokes foreground consent, destroys SDK callbacks and closes IPC; already accepted Core commands can still complete. Reconnect and explicitly review the saved job after returning. Process death does not erase encrypted state.

Stages: APPROVED → SIGN_REQUESTED → SIGNED_SAVED → MINING_REQUESTED → MINED_SAVED → CHECKPOINT_ACKED → POST_REQUESTED → SUBMITTED → AWAITING_VERIFICATION / CONFIRMED. Errors retain artifacts as RECONCILIATION_REQUIRED or PAUSED_REVIEW.

- Signing intent is saved **before** txnsign. Lost reply: inspect/check/export the same Core row. Never automatically re-sign. Missing row without saved signed bytes: manual review.
- Signed transaction bytes/transaction ID are saved before mining. Lost mining response may re-mine that exact signed transaction; txnmine does not post. No new signature is requested. Core row loss after signed export can restore those exact signed bytes with txnimport.
- Final mined bytes, hash and TxPoW ID are saved before Gateway checkpoint. Posting requires a valid signed checkpoint acknowledgement for that job/STATE/ID/blob hash. Gateway outage means no post before this acknowledgement.
- Lost posting response: query the known ID first. Only explicit not-found permits bounded retry of the **same mined bytes**, maximum 3 attempts recorded before each call. Unknown lookup, expiry or exhausted budget requires review. No replacement transaction is created.
- Gateway fresh independent confirmation plus signed acknowledgement releases the wallet slot; lifetime publication reservation remains counted. Reopening a previously confirmed job refreshes verification and can show reorg/unavailable without another signature.
- Keystore loss/corrupt storage/uninstall is not auto-reset: preserve Core and Gateway records and investigate. Never clear publication records to obtain another budget or restore/clone a wallet with stale key-use counters.

Real-device acceptance still required: Android 9/modern Android registration/exported receivers, Apps grants and sender identity, bounded URI responses, synchronized Mainnet/balance, real signature DTOs and independent inclusion, pause/rotation/process kill, Core restart, offline Gateway, exact-blob reconciliation, application upgrades and Keystore recovery. No such test uses automatic funds in CI.

## Automated checks and file map

- `npm --prefix services/gateway test`: unit tests, Server publisher and legacy MDS recovery.
- `TEST_DATABASE_URL=... npm --prefix services/gateway run test:integration`: isolated PostgreSQL schemas, migrations, scopes/tenants, native replay/expiry/revocation and local/Server proof regression.
- `node --test tests/minidapp/core.test.cjs tests/minidapp/browser.test.cjs`: existing UI/MDS/legacy checks.
- Android Gradle tasks above: SDK registration/discovery routing tests and Native Publisher golden commitment/HMAC, spend safety, tampering, duplicate, lost signature/post response, offline checkpoint and foreground/permission checks. All Core interactions mocked; the Node-generated signed golden contains public test artifacts only.

Android source files: `ProofProtocol.kt` (shared wire verification), `NativePublisher.kt` (state machine), `BlackBearTransport.kt` (SDK boundary), `NativeGateway.kt` (HTTPS/PoP), `SecureStore.kt` (Keystore/checkpoints), `TrackiumApp.kt` (lifecycle/controller), `MainActivity.kt` (five native screens), `ProofExportProvider.kt` (explicit read-only bundle sharing). Build/manifest/resources and vendored SDK have separate configuration. Gateway changes are migration 005, native-session service/routes/config/runtime, immutable transport/signed-job fields and tests; classic adapter rejects native jobs. Existing legacy entry points and functions remain.
