# Minima Proof Engine v1 — Mainnet hardening and Local Core

The engine extends the existing Free/Managed Gateway, immutable `cargo_events`, SHA-256 hash chain and `cargo_outbox`. Publication is **disabled by default**. It never sends an automatic backlog when live mode is enabled. Legacy MiniDapp/Rhino files and the raw GL110-GL path are unchanged.

| Evidence level | Current state |
| --- | --- |
| Implemented | Server Core RPC publisher; foreground Local Core MDS adapter; signed manual file exchange; tenant ownership/approval/budgets; checkpoints; independent verifier; UI and CLI |
| Automated validation | PostgreSQL, mock Core RPC/MDS, desktop/Android-like browser capabilities, restart/ambiguity, permissions, tampering, limits, tenant/CSRF checks, existing browser/MDS/legacy regression |
| Not live validated | Real desktop Core wallet signatures/Mainnet inclusion, Android Core/WebView permissions and file transfer, Android suspension/restart and device-specific WebCrypto/Web Locks support |

**No real Mainnet transaction was sent during development. Testnet is not a prerequisite.** The first real transaction is an explicit user operation on **Mainnet**, with a dedicated wallet/address and a small balance. This is not a production-readiness or globally synchronized-node claim.

## One protocol, two publishers

**Local Core** uses `MDS.cmd()` inside the installed Trackium MiniDapp. Signing stays in that desktop/Android node's built-in wallet. Gateway receives public artifacts/IDs; it has no wallet RPC credential, seed or private key. The workflow runs only while the MiniDapp is open. Closing Android WebView does not create an autonomous background publisher.

**Server Core** uses private authenticated RPC on a separately trusted Core node and its built-in wallet. It can process explicitly approved events without a foreground UI. It is suitable for self-hosted Free and Managed deployment, with the same tenant boundaries. It never accepts arbitrary wallet commands from users.

Each tenant has an owner-configured `local`/`server` publisher policy and wallet address. After its first live proof, publisher identity and input cap are locked; the owner may explicitly change its publication-count quota. Each event has only one live proof/commitment/owner. An expired or disconnected local job is **never** reassigned to Server Core. There is no automatic fallback that could duplicate a spend.

Stop every older Gateway worker before upgrading; mixed old/new publishers or rolling wallet upgrades are not supported. Migration **004_publisher_safety.sql** is additive: publisher ownership, explicit approvals/expiry and tenant policy are added without editing deployed migration 003. Existing live rows have no new approval and cannot resume wallet sends until explicitly reviewed/approved; their matching server policy can be adopted with the original 1 MIN input cap, and existing reservations still count against quotas; known IDs continue to be monitored. Migration checksums remain enforced.

## Official Core/MDS contract researched

Source: official [minima-global/Minima commit 52542f25605a28a776e9b3b43b0808a05dceab01](https://github.com/minima-global/Minima/tree/52542f25605a28a776e9b3b43b0808a05dceab01), reporting **1.0.49.4**. Both publishers require that version before wallet preparation. Other versions must be reviewed rather than bypassing validation.

- [CommandRunner](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/CommandRunner.java): registers transaction commands; `ALL_WRITE_COMMANDS` includes `txnsign`. READ MiniDapps get `status:false,pending:true,pendinguid` for that command; public MDS cannot queue it. Other transaction verbs are **not all classified WRITE** in this version. Thus a Core READ RPC/MDS label is not a substitute for our command whitelist and private transport.
- [CMDcommand](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/mds/handler/CMDcommand.java): MDS passes the MiniDapp identity to CommandRunner. Desktop and Android use the same Java command path, not a hidden RPC bypass.
- [checkmode](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/mds/checkmode.java) exposes `writemode`; [checkpending](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/mds/checkpending.java) only says whether a pending UID still exists. Removal is **not proof of approval**; `txncheck` must validate signatures.
- [txnaddamount](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/txn/txnaddamount.java): supports `fromaddress`; change returns there. Main output uses requested `storestate`, change does not. Inputs are selected by Core, so input exposure can exceed the 0.001 main output.
- [txnexport](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/txn/txnexport.java): `showtxn:true` returns `{data,txn:{transaction,witness,...}}`.
- [txnmine](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/txn/txnmine.java): mines **without posting**, returns `{txpowid,data}`; mining limit 120 seconds.
- [txnminepost](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/txn/txnminepost.java): posts the exact pre-mined blob; response is `{data:<TxPoW JSON>}`, not a new top-level ID.
- [txpow](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/commands/search/txpow.java): direct lookup returns TxPoW JSON; `onchain` returns `found,block,blockid,tip,confirmations`; block lookup returns TxPoW JSON. IDs are hex, commonly uppercase. Depth is **tip height minus inclusion height**.
- [MDSManager](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/mds/MDSManager.java) / [KEYPAIRcommand](https://github.com/minima-global/Minima/blob/52542f25605a28a776e9b3b43b0808a05dceab01/src/org/minima/system/mds/handler/KEYPAIRcommand.java): app-scoped `MDS.keypair.get/set` persists public recovery state. This file store is not an atomic distributed lease or fsync guarantee; Gateway's separate durable checkpoint is required before local posting.

Commands actually used:

```
checkmode                          # MDS only
status
txpow block:<tip_height>
scripts address:<publisher>
coins relevant:true sendable:true checkmempool:true tokenid:0x00 address:<publisher>
txnlist id:trk_<digest>
txncreate id:trk_<digest>
txnaddamount id:... amount:0.001 address:<publisher> fromaddress:<publisher> tokenid:0x00 burn:0 storestate:true
txnstate id:... port:250 value:<commitment>
txnbasics id:...
txnsign id:... publickey:auto
txncheck id:...
txnexport id:... showtxn:true
txnimport id:... data:<saved_signed_row>     # recovery only
txnmine id:...
txnminepost data:<saved_mined_blob>
checkpending uid:<saved_pending_uid>        # raced MDS permission revocation only
txpow txpowid:<final_id>
txpow onchain:<final_id>
```

`txnpost`, `send`, automatic-post signing, external wallet applications and WalletConnect are not used. No signer password/seed is placed in command parameters. Server HTTP uses authenticated POST with exact `Authorization` / `Content-Length` header spelling; redirects, remote plaintext and arbitrary commands are rejected.

## Commitment format and verifier

Transaction STATE port **250** stores exactly 38 bytes:

```
TRKP (4 bytes) | version 01 | flags (1 byte) | SHA-256(public commitment JSON) (32 bytes)
```

Flag bit 0 = synthetic, bit 1 = test. The public commitment's recursively key-sorted UTF-8 JSON fields are:

```
domain: "trackium:cargo:minima-proof:v1"
schema_version: 1
publish_mode: "live" | "test"
chain_id, publisher_address
event_id, shipment_id, event_type, sequence
canonical_sha256, previous_hash, source_trust
```

No raw GPS, customer name, tenant ID or key is in the onchain STATE bytes. The hashed canonical event includes tenant/device/time/data. Bundles contain the complete hash-chain prefix through the anchor, including unpublished intermediate records. They contain sensitive cargo information and should only be shared with authorized verifiers. An anchor proves that prefix, not the absence of later events or physical truth of a sensor reading. `synthetic` / `unverified` provenance remains unchanged after anchoring.

Cargo hashing and commitment hashing use **SHA-256**. Minima's default object hashing uses **SHA3-256**; identifiers are produced by Core, not by relabeling a local hash. The stored artifact checksum is SHA-256 of its exact hexadecimal text, separate from Minima's binary TxPoW ID.

The independent verifier rebuilds canonical bytes, every previous hash, the commitment and flags. It obtains the transaction from its configured validating node, checks network, publisher inputs/outputs, standard signature wallet witness, zero burn transaction, current inclusion block membership, a stable tip and required depth. It does not trust Gateway's `confirmed` field. Gateway checks the actual transaction against its immutable tenant input cap, including untrusted Local Core results; standalone CLI uses a trusted `PROOF_MAX_INPUT` setting (default `1`, optionally `0.01`/`0.1`), never an untrusted bundle's claimed spending policy. Standard `RETURN SIGNEDBY(0x...)` wallet scripts are supported; anyone-can-spend/custom contracts are rejected. Signature/script/consensus validation ultimately relies on the trusted full node: this is **not** a standalone SPV/light client or a dishonest-node defense.

## Mainnet safety and configuration

All modes: `PROOF_MODE=disabled` (default), `test` (labeled local receipts, no node traffic), `live` (explicit gates below). Test rows cannot store real transaction IDs/artifacts or confirmations in PostgreSQL. Automatic tests never enable a real node.

| Setting | Meaning |
| --- | --- |
| `PROOF_MODE=live` | live engine selected |
| `PROOF_ALLOW_LIVE=true` | explicit operator opt-in |
| `PROOF_ALLOW_MAINNET=true` | separate Mainnet opt-in |
| `MINIMA_CHAIN_ID=0x00` | Mainnet; first real run does not require testnet |
| `PROOF_PUBLISHER=server` | initialize the private writer plus reader |
| `PROOF_PUBLISHER=local` | reader-only Gateway; no wallet writer credentials/address required |
| `PROOF_MAX_PUBLICATIONS=1` | global lifetime live-proof reservation cap; explicit range 1–100 |
| `PROOF_CONFIRMATION_DEPTH=6` | depth 1–100 |
| `PROOF_MAX_ATTEMPTS=5` | server publication attempts, max 10; local jobs cap at 3 |
| `MINIMA_RPC_URL`, `MINIMA_RPC_CREDENTIAL_FILE` | private server writer only |
| `MINIMA_PUBLISHER_ADDRESS` | server wallet address, `0x` + 64 hex; local policy supplies its own address |
| `MINIMA_READER_RPC_URL`, `MINIMA_READER_CREDENTIAL_FILE` | trusted validating reader, required in live mode, ideally independently operated |
| `MINIMA_RPC_CA_FILE`, `MINIMA_READER_CA_FILE` | optional CA paths; TLS verification stays enabled |
| `PROOF_JOB_SIGNING_KEY_FILE` | external P-256 private key for local jobs/acks; **not** a Minima wallet key |

RPC JSON secret files contain `username,password`, are outside the checkout, mode 0600 or stricter, max 4 KiB. The job signing PEM is outside the checkout, mode 0600, max 8 KiB. Gateway keys/cookies/long-term tokens are never stored in MDS. Native publishing uses the existing Gateway launch:

```sh
npm --prefix services/gateway ci
npm --prefix services/gateway start
```

Core preflight checks version, connected peers, matching tip ID/network, a block timestamp within 10 minutes (not over 2 minutes in the future), a standard **owned wallet script**, and spendable native coins excluding mempool conflicts. A recent tip and peers are necessary checks, **not proof of global synchronization**: the operator must inspect Core synchronization and, preferably, compare a separate trusted node before confirming the first Mainnet event. Clock correctness matters; uncertain/stale responses stop preparation.

The request is a 0.001 self-transfer and zero requested burn. Before signing, publishers enforce all inputs/outputs at the configured wallet address, native token, exact input/output conservation, at most 64 inputs/3 outputs, the 0.001 main output and a total input cap (`0.01`, `0.1` or `1` MIN per tenant policy). Amounts use exact **44-place integer arithmetic**, matching Core MiniNumber; no floating point or presumed Ethereum precision. A large selected coin fails the cap instead of silently spending it. Fund the dedicated address with suitably small coins.

This is not guaranteed free or risk-free: inputs are spent/recreated and can be temporarily locked, PoW consumes resources, wallet signing keys have use limits, and node/network rejection or reorg can occur. No external destination or burn transaction is permitted by this protocol. Mainnet costs/selection must still be validated on the actual node. Both global and tenant count limits reserve work at owner approval, so retries cannot allocate another event/transaction.

## Desktop and Android setup

1. Install official Core 1.0.49.4 and Trackium's packaged MiniDapp. Use a dedicated built-in wallet/address with a small balance. Back up Core appropriately; do not share the publisher wallet between independent Gateways or clone active signer nodes.
2. Open Trackium **inside Core** and follow Proofs → **Open Local Core Publisher** (`local-core.html`, with Core's UID). The separate page uses MDS; Gateway `/app/` never initializes wallet MDS.
3. Explicitly grant Trackium WRITE permission in Minima Hub if you choose local publication. The adapter first calls `checkmode` and stops in READ/public mode before creating/signing transactions. Existing `dapp.conf` trust requests are not treated as proof of an actual granted permission.
4. If permission is revoked while signing and Core queues the command, the adapter saves `pendinguid` and does not blindly repeat signing. Restore permission/inspect the Core pending request explicitly; removal from pending does not mean approved. Recovery requires successful `txncheck` with valid signatures. If a signature request's response is lost before a usable result exists, inspect that exact custom transaction in Core; do not delete it and create a replacement automatically.
5. Modern secure-context **WebCrypto P-256/SHA-256**, **BigInt**, **Web Locks**, file selection and MDS keypair APIs are required. Missing capabilities fail closed. Update Android System WebView/Core if needed; do not weaken CSP, TLS or permissions.

Desktop and Android share the same adapter/commitment and command contract. Android WebView download/share UX, certificate handling, write/pending dialogs, battery optimization, suspension and Core restart behavior require a real-device acceptance run. HTML download and a selectable public JSON fallback are provided; neither is claimed tested on a physical Android device. No Android background worker or new APK is implemented. `service.js` remains ES5/Rhino-compatible and unchanged.

## Secure Gateway pairing and local file protocol

The existing `/app/` same-origin pairing remains authoritative: tenant owner approves short-lived HttpOnly cookie sessions, scopes and audience; POST requires the existing CSRF/client/origin checks. Minima UID is not tenant identity. CORS/CSP are not relaxed and no public RPC proxy is introduced.

On the trusted Gateway host, approve the existing browser pairing challenge with a deliberately scoped session (the owner key must carry those scopes):

```sh
node services/gateway/src/telemetry/admin.js approve-pairing --credential-file=/private/owner.json --challenge=CHALLENGE_UUID --scopes=read,publish
```

An older owner key without `publish` can be replaced using the trusted DB-side `issue-key --tenant=TENANT_UUID --scopes=read,admin,shipments,publish --out=/private/new-owner.json` command of that same CLI. No existing key or browser session is silently granted the new scope.

Core-origin MiniDapp has **no automatic access to that Gateway browser session**. The supported transport is explicit manual files, not a simulated protected connection:

1. Owner configures tenant publisher policy and approves **one event** with the exact confirmation `PUBLISH MAINNET <event_uuid>`. The initial global and tenant count caps are one. Enabling live mode alone allocates nothing, including old backlog.
2. In the authenticated Gateway Proofs screen, export the approved **Local Core job**. Copy the job-signing fingerprint from that same trusted Gateway origin. Pin it in the installed MiniDapp; a fingerprint embedded in an unknown file is not trusted.
3. The file is a P-256 ECDSA/SHA-256 signed, JSON-normalized payload (`trackium:local-core:job:v1`). It binds proof/job/tenant/shipment/event, full canonical chain, Mainnet wallet, immutable commitment, 24-hour approval, input cap and three attempts. Node uses IEEE-P1363 signatures compatible with WebCrypto. It contains no Gateway credential.
4. The installed page validates the signature against the pinned fingerprint and independently rebuilds the event chain/commitment. Check wallet readiness, verify tenant/shipment/provenance, inspect limits and type the exact event confirmation. **Prepare** signs and mines without posting, persists public state in MDS, and exports a checkpoint `{proof_id,txpow_id,transaction_id,mined_data}`.
5. Import that JSON in authenticated Gateway Proofs (requires the explicit `publish` session scope). Gateway locks the final identity/artifact in PostgreSQL and signs a `trackium:local-core:ack:v1` **checkpoint** acknowledgement. This is **not** chain verification or proof that unbroadcast binary data is valid. Conflicting checkpoints return 409; identical replays are idempotent.
6. Import the acknowledgement into Core and explicitly **Publish / reconcile**. The adapter checks the acknowledgement, job/slot ownership, limits, readiness and known final ID first. It can post only that saved blob, at most three times. No acknowledgement → no posting. Core's own wallet never leaves the device.
7. Transfer the result `{proof_id,txpow_id}` to authenticated Gateway. Gateway independently queries its trusted reader and rebuilds the proof before returning verification. A caller's arbitrary TXID cannot become verified. Export a signed **confirmed** acknowledgement to release the local wallet slot; reorg remains possible later.

MDS stores only public signed/mined recovery artifacts, the public signer fingerprint, stage, pending UID and attempt count, base64 encoded to avoid SDK delimiter ambiguities. Gateway atomically reserves one signed local job per wallet address across tenants/browser profiles/devices; only a fresh independent confirmed result releases that reservation. Server spends for the same reserved address are blocked. Job export is refused while a server spend is unresolved. Web Locks plus a persistent app-wide Core slot additionally exclude parallel tabs/jobs. A closed/expired client does not release either reservation. Use dedicated wallet addresses and trusted tenant-owner policy administration: a stalled approved job can deliberately block a shared wallet. This conservative availability tradeoff does not grant anyone access to its private key; untrusted multi-tenant provisioning/quotas still need deployment hardening. Local and server proof ownership is immutable. Do not delete/reinstall MiniDapp storage to bypass a blocked job. Preserve job/checkpoint/ack files; if local storage is lost, Gateway still rejects a different final identity, so a newly mined replacement cannot obtain posting authorization. Restoring the old public artifact needs operator recovery; automatic identity reset is deliberately absent.

A job expires after 24 hours for new wallet actions. Expiry does not release/reassign its owner or erase its final ID. Lookup/independent verification remains possible. There is no automatic renewal/reassignment API: inspect expired unbroadcast work with the operator; never create a replacement identity to work around ambiguity. Missing WRITE/WebCrypto/Web Locks on a device is an explicit unsupported capability, not a mocked success. The Server Core mode remains a separate supported option with its own wallet, not an automatic takeover of an existing local event.

## Owner CLI and first real Mainnet event

Everything below is an **operator procedure**, not executed by tests or Codex. Use private HTTPS/loopback endpoints. Configure/fund/synchronize Core, confirm the network and obtain the dedicated built-in wallet address (`getaddress` in the private Core console). Keep RPC private with authentication/TLS/firewall; do not expose even READ RPC publicly because Core's WRITE classification is narrower than all side-effecting commands.

Generate a local-job signer once, outside the repository (parent directory must already exist):

```sh
node services/gateway/src/proofs/admin.js keygen /absolute/private/trackium-job-signer.pem
```

This prints only public key/fingerprint. Set `PROOF_JOB_SIGNING_KEY_FILE` and the live configuration above, then start Gateway. For Server Core, configure its writer wallet/address/RPC; Local-only Gateway requires only the reader and job signer. Base Compose only forwards disabled/test mode. Live needs a private override with explicit gates/settings and read-only secret bind mounts, readable by container UID 1000, mode 0600; use reachable private HTTPS endpoints rather than weakening the HTTP rule for host/container networking. For server mining set `SHUTDOWN_TIMEOUT_MS=150000`, supervisor/container stop grace at least 160 seconds; forced shutdown is still handled by checkpoints.

Keep an existing tenant owner credential JSON (`token`, `tenant_id`) in a mode-0600 external file. Policy JSON (public data) for the **first transaction**:

```json
{"publisher_kind":"local","publisher_address":"0xREPLACE_WITH_64_HEX","max_publications":1,"max_input":"0.01"}
```

Use `"server"` and its configured dedicated address for Server Core. Configure through the trusted operator CLI:

```sh
node services/gateway/src/proofs/admin.js policy https://your-private-gateway /private/owner.json /private/policy.json
node services/gateway/src/proofs/admin.js preflight https://your-private-gateway /private/owner.json
```

Local preflight points to the installed MiniDapp; Server preflight returns its actual wallet/tip/balance observation. The authenticated Proofs screen lists up to 50 selected events awaiting owner approval. Choose one event; synthetic simulator events remain synthetic. Create a public confirmation JSON file with **that exact UUID**:

```json
{"confirmation":"PUBLISH MAINNET REPLACE_WITH_EVENT_UUID"}
```

```sh
node services/gateway/src/proofs/admin.js approve https://your-private-gateway /private/owner.json /private/confirmation.json EVENT_UUID
```

For Local Core, perform the signed file sequence above. For Server Core, the worker now has permission to prepare/post just that reserved event. Do not run a second manual `txnpost`. Wait for observed inclusion/depth, then Verify and export the bundle. Record the real TXID, Core version/network, selected inputs, wallet behavior and Android/desktop observations in your deployment acceptance log. This repository contains no invented real-TX example.

After a successful first run, autonomous Server Core use still requires explicitly raising the global cap/config and tenant count quota, and explicit owner approval of each intended event. Raising a quota does **not** approve backlog. Publisher identity/input cap remain locked; ownership migration is a separate recovery design.

## API and states

All IDs are tenant-scoped. `read` covers lists/status/jobs/bundles/verification/preflight; browser POST retains CSRF checks. `admin` (owner API key only, never browser/MDS storage) configures policy/approves events. `publish` is the explicitly owner-granted browser scope for checkpoint/result imports. Existing shipment/session grants are not upgraded: new owner credentials include `publish`, while existing owners must deliberately provision a credential carrying it before approving that browser scope. Owner API keys with `admin` can also import directly from the trusted host. This additive capability avoids silently granting financial-job control to existing shipment writers. No endpoint accepts a caller-selected node URL or arbitrary Core command.

```
GET  /v1/proof-publisher                    # policy, pending events, key fingerprint
POST /v1/proof-publisher/policy             # admin
POST /v1/proof-publisher/preflight          # read, bounded explicit check
POST /v1/proof-publisher/events/:id/approve  # admin, event-specific typed consent
GET  /v1/shipments/:id/proofs?limit=50&cursor=<uuid>
GET  /v1/proofs/:id
GET  /v1/proofs/:id/bundle
POST /v1/proofs/:id/verify                  # JSON {}
GET  /v1/proofs/:id/local-job
POST /v1/proofs/:id/local-checkpoint        # publish
POST /v1/proofs/:id/local-result            # publish
```

Server worker uses PostgreSQL session exclusion scoped to its application schema (all workers must use the same schema; never share a wallet across independently deployed schemas/databases) and at most one unconfirmed wallet artifact globally. Selected shipment predecessors must be confirmed before publication/job export. All RPC attempts and state changes are recorded; JSON responses, including arrays, are serialized explicitly and credential values redacted. Signed rows are saved before mining; final mined blob/checksum/TxPoW ID are saved **before sending**. A crash in `submitting` before mining is recoverable. Existing signed rows are checked again with `txncheck` after Core restart/import.

After ambiguity: reconcile the known ID; only the identical blob can be retried. Backoff is bounded to five minutes and attempt budgets persist. A durable `publication_blocked` flag prevents permanent/exhausted errors from regaining send permission when later monitoring changes a status. Local rows are monitored but **never broadcast by Server Core**. Generic outbox delivery state is not blockchain confirmation.

States: `pending`, `submitting`, `submitted`, `included`, `confirmed`, `retryable_error`, `failed`, `reorged`. `submitted`/test receipts are never verified. Confirmation uses actual current-chain depth, not a timer. Confirmed records are rechecked. Reader outages remove current positive observation; changed inclusion blocks require stable-tip reorg evidence. Missing data is not confirmation or proof of reorg. Core's single `TxPoW not found` response cannot distinguish never-seen from pruned data; it is reported unavailable. A previously included but now unavailable artifact is not automatically rebroadcast. Keep archival data for durable verification.

The UI displays mode, network/policy/address, explicit balance/readiness observations, awaiting-approval/approved queues, actual final ID, observed state/depth/time, provenance and Verify/Export. Local Publish is in the installed Core page, not a fake Gateway-origin MDS bridge. Static Preview remains distinct and publishes nothing. Browser result/ack imports do not upgrade state without independent node validation.

## Independent TXID verification and recovery

Use your own trusted validating node and expected publisher address obtained out of band. The exported bundle is capped at 2,000 records / 4 MiB (conservative canonical-size preflight). Larger prefixes require future segmented verification; no truncated chain is silently accepted. No wallet RPC credentials or signed/mined blobs are in proof bundle exports. The Local checkpoint exchange is a separate public-artifact format.

```sh
export MINIMA_READER_RPC_URL=https://your-private-independent-node:9005
export MINIMA_READER_CREDENTIAL_FILE=/private/reader.json
export MINIMA_PUBLISHER_ADDRESS=0xREPLACE_WITH_TRUSTED_64_HEX_ADDRESS
export MINIMA_CHAIN_ID=0x00
export PROOF_CONFIRMATION_DEPTH=6
export PROOF_MAX_INPUT=0.01  # trusted operator policy for this proof
node services/gateway/src/proofs/verify-cli.js /private/exported-bundle.json
```

Exit 0 = verified at current requested depth, 1 = not verified, 2 = invalid local configuration/input. `txpow txpowid:<id>`, `txpow onchain:<id>`, `txpow block:<height>` and `status` provide manual chain observations; the CLI additionally reconstructs the private event/hash commitment. A TXID alone cannot reconstruct cargo data.

Recovery rules:

- Lost post response/Core restart: retain the saved final ID/blob. Query first. Never rebuild/re-sign another spend because of a timeout.
- MDS/Core unavailable: keep the job pending. Reopen the installed page with the same signed job and key pin. Check persisted stages/permissions and use the same checkpoint/ack; there is no background-success promise.
- Gateway checkpoint reply lost: replay the identical authenticated checkpoint and obtain another signed ack. A changed ID/blob is rejected.
- Node unsynchronized/no peers/wrong wallet/network/insufficient balance: no preparation/posting; repair the node/funding and recheck, preserving existing identities.
- Exhausted/expired jobs, stale MMR signatures, storage loss or conflicting spends: operator inspection, no automatic reset/re-mining of a broadcast artifact. Failed/exhausted known IDs continue monitoring for delayed inclusion.
- `TXPOW_UNAVAILABLE`: never-seen or pruned; an archival/trusted reader may be needed. `CHAIN_TIP_CHANGED`: retry a fresh snapshot, never accept inconsistent reads. `COMMITMENT_MISMATCH`/hash chain errors: preserve the original journal and investigate.

## Automated checks and remaining limits

```sh
npm --prefix services/gateway test
TEST_DATABASE_URL=postgres://... npm --prefix services/gateway run test:integration
node --test tests/minidapp/core.test.cjs tests/minidapp/browser.test.cjs
TEST_DATABASE_URL=postgres://... node --test tests/minidapp/server.integration.cjs
python3 scripts/package-minidapp.py /tmp/trackium-mainnet-review.mds.zip
```

Tests use isolated disposable PostgreSQL schemas and mocks, never actual wallet funds. They cover signed jobs/acks, tampering/pinning, desktop/Android-like MDS, READ denial, user approval, immutable checkpoint-before-post, Core/app restart, lost responses, reconciliation/duplicates, slots/ownership, attempt/count/input limits, exact arithmetic, auth/tenant/replay/CSRF, independent verification/reorg/unavailable data and legacy regressions.

Remaining acceptance work: actual Mainnet transaction and recovery using each real Core, physical Android WebView/lifecycle/file transfer; node synchronization beyond the conservative observable preflight; expired-job renewal and explicit ownership migration; segmented bundles/archive retrieval; production quotas/retention/monitoring and signer-key rotation. RPC traces/state tables and Core custom transaction rows grow and need a reviewed retention/backup policy. Gateway job signer loss/rotation requires out-of-band re-pinning and preservation of old recovery files, not silent trust replacement. GL110-GL still needs the authoritative protocol, authenticated device/tenant binding and firmware-specific captured fixtures. No Integritas/Minima Proof Engine blockchain results, Android background service or physical tracker trust are fabricated.
