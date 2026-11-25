# D3 · Controlled Trackium demonstration for Minima

## Initial readiness

| Component | Repository evidence before D3 changes | Live gate |
| --- | --- | --- |
| Lite Web, Gateway and PostgreSQL | C1–C3 and migrations 001–017 exist on main after #100. | Verify deployed revision, PostgreSQL and actual workspace over Railway HTTPS. |
| Controlled access | Existing username provides a Viewer in the archive or Owner in the approved physical pilot. Owner has shipment permissions. | Operator inspects existing account state and authorizes any password rotation or promotion. |
| Railway and Valhalla | D2 defines a private attested routing image, paired graph configuration and restart/health settings. Public profile forbids demo mode. | Inspect source coupling, private DNS and ingress, effective limits and dependency health. |
| Lite APK | Existing standalone HTTPS WebView and offline emulator workflow. | Install the signed review build and exercise the authorized company on a physical phone. |
| Core APK | Canonical Android repository has an embedded BlackBear-derived node and native Gateway pairing. | Verify real node observation, approved pairing and restart on a physical phone. |
| AOVX and proofs | Gateway receives trackers and distinguishes eligible physical observations from raw receipts. Lite Integritas has TEST_ONLY mode. | Verify tracker custody, SIM and incoming receipts. Verify physical coordinates and proof provenance independently. |

## Decision and architecture

**NO-GO for the live demonstration.** Local D3 is ready for independent review. The public Railway address answers over HTTPS, but live routing and the integrated physical-phone flow remain unverified.

Lite Web and `tech.trackium.lite` share one HTTPS origin, customer session model and Gateway. Gateway stores customer membership, Cargo, AOVX observations, B3 revisions and proof state in PostgreSQL. Optional private Valhalla returns road-network calculations attested to a pinned graph. Core is a separate APK from the canonical Android repository. Its native client uses owner-approved Gateway pairing and its Minima observer uses the embedded BlackBear-derived host. The native client reads authorized observations and Gateway proof data. It is not an AOVX TCP receiver, a phone-GPS upload path, an Integritas client or a route lifecycle console. A genuine new observation enters via the authorized tracker → Gateway path; the paired Core and Lite can inspect the resulting records they support. The host has its own Wallet/Terminal capabilities, which are outside this demonstration.

## Railway and operator activation

Use [the existing Railway HTTPS workspace](https://trackium-gateway-production.up.railway.app/app/) and the existing production Gateway and private PostgreSQL. On 25 November 2026 (Kyiv), anonymous HTTPS reads returned `/app/` 200, `/readyz` 200 and `/readyz/routing` 404. These checks establish reachability; they do not establish database access for the demo identity, a private Valhalla deployment, or a live route. GitHub has a [successful production deployment record for the #100 merge](https://api.github.com/repos/themightydanik/trackium/deployments/8069312059/statuses) from Railway's bot. Treat merging into main as deployment-capable. Railway dashboard settings, branch toggles, current private ingress and effective resources were not accessible for review.

1. Before merging, have the operator inspect Gateway → Settings → Source and related CI/autodeploy settings and confirm how the reviewed SHA can be activated without an unplanned deploy. Check the deployed SHA, exact service, route graph, TCP receiver settings, DB major and migrations, backup custody and restore. Confirm that switching to closed demo access will not interrupt required normal customer access. Obtain explicit approval for the cutover. [D2 deployment and rollback](PUBLIC_PRODUCTION_D2.md)
2. Keep the existing Railway hostname and HTTPS certificate. The Gateway uses [the existing manifest](../deployment/railway/gateway.json) and `/readyz`. The database URL must use private connectivity. Use [the existing private Valhalla image configuration](../deployment/railway/valhalla.json) if the service is absent or differs; no public domain or TCP proxy for Valhalla or PostgreSQL. Set Valhalla port 8002. Verify private DNS from Gateway, resource enforcement and actual graph identity before enabling calculations.
3. Select `DEPLOYMENT_PROFILE=railway-demo`. Use `NODE_ENV=production`, `ENABLE_WEB_WORKSPACE=true`, `ENABLE_NATIVE_CLIENTS=true`, `PUBLIC_ORIGIN=https://trackium-gateway-production.up.railway.app`, `CUSTOMER_ACCOUNTS_ENABLED=false`, `PROOF_MODE=disabled`, `PROOF_ALLOW_LIVE=false`, `PROOF_ALLOW_MAINNET=false`, `ENABLE_SERVER_SIMULATOR=false` and `ENABLE_FIXTURE_ADAPTER=false`. Maintain already approved AOVX settings verbatim, including `TCP_PROTOCOL=aovx`, `TCP_PORT` and existing ingress when the receiver is in use. Otherwise explicitly set `ENABLE_TCP_RECEIVER=false`. The profile applies the existing bounded Railway ingress guard and HTTPS root redirect. Routing uses the private `ROUTING_VALHALLA_ORIGIN` and `ROUTING_GRAPH_RELEASE_ID` pair from D2. Configure no mail provider. While demo is off, keep `CUSTOMER_DEMO_ENABLED=false`, `CUSTOMER_DEMO_PILOT_ENABLED=false` and `INTEGRITAS_MODE=disabled`.
4. In an approved private operator shell, inspect existing `trackium-demo` using `npm run pilot:admin -- inspect` from the Gateway. Use [bootstrap](MINIMA_DEMO_ACCESS.md) only if absent, owner-only password files off Git and the existing secret store. The archive Viewer lacks route mutation permissions. For C2/C3 use the existing reviewed promotion path with the named isolated company and approved inventory. An already-promoted account should be inspected and rotated using the normal CLI instead of promoted again. The existing empty inventory option applies to approved transfer-only setup. To prepare a shipment without live hardware, have the operator create an isolated unbound registry record using the existing authorized device API and label it clearly. Leave GPS absent. The probe below uses exactly this type of record.
5. For the approved window enable `CUSTOMER_DEMO_ENABLED=true`, `CUSTOMER_DEMO_PILOT_ENABLED=true` for the promoted owner and `INTEGRITAS_MODE=test` as required by the existing demo gate. Test mode is instance-wide. Review pending requests before enabling it. Share the username and a rotated password through the approved private channel. The archive Viewer and pilot Owner are separate tenant views of the same identity; promotion rotates the password and revokes existing sessions. The operator must not broaden API scopes or link the archive tenant to physical devices. For enrolled devices preserve existing custody and binding; conflicts follow the existing transfer process. [Closed pilot procedure](MINIMA_PHYSICAL_PILOT.md) · [Custody transfer](AOVX_CUSTODY_TRANSFER.md)

## Rehearsal and demonstration

Use the candidate Valhalla 3.6.3 corridor release `6a707e47f877bd471dce66baa5fb0e1e54d4a1bfe6a0f2c49156eb1f9d992f29`, OSM snapshot `2026-11-24T21:21:23Z`. Rebuild/attest using D2's pinned inputs and packaging procedure. Current D3 real B2 calculations on this graph use Lviv → Przemyśl → Rzeszów with two road legs. Observed outputs were 190,120 m / 9,118 s for auto and 192,074 m / 10,643 s for truck (3.9 × 2.5 × 16 m, 35 t gross and 10 t axle). D2 also exercised Kyiv–Lviv, Kyiv–Warsaw, Odesa–Bucharest, Berlin–Warsaw and Warsaw–Paris. Changes to routes, graph, or costing require rehearsal. Planning durations exclude actual border queues and current traffic. Road coverage and legal HGV clearance are limited.

1. **Web.** Use normal sign-in at the Railway HTTPS workspace. Verify the intended company and Owner role. Open Fleet Map and a clearly labeled planning shipment. Inspect planned checkpoints and device eligibility. An unbound device has no measurement or location.
2. **Route planning.** Calculate the Lviv–Przemyśl–Rzeszów draft with auto and review the graph badge, distance and duration. Save, approve and activate revision 1 with the authorized Owner. Repeat for truck; approve and activate revision 2, compare versions and verify revision 1 is superseded. Use an explicit retry with the same request UUID after an uncertain proposal. Never infer vehicle movement from either route. In live service, avoid deliberately interrupting the production engine; rehearse outages on disposable Compose only.
3. **Lite.** Install the D3 APK on a dedicated phone and sign in to the same company over HTTPS. Verify the active revision and history independently of the browser session. Test gestures, safe areas, rotation, foreground return and reconnect. Sign out and confirm protected content disappears. No HTTP fallback.
4. **Core.** See the checklist below. Approve pairing for the same authorized pilot company only if the operator has an approved native-pairing API credential for that tenant with the existing read/admin/publish scopes. A Lite Owner cookie cannot approve native pairing. This legacy credential requirement does not authorize publishing. Keep that credential on the operator machine. Open native Devices and inspect the observation from the real tracker if available. Match device, receive and measurement time, provenance and missing/stale conditions in Lite. There is no Core-to-Gateway synthetic substitute.
5. **Proofs.** If it is useful to demonstrate the archive's existing Integritas `TEST_ONLY` evidence, use a separate approved Viewer segment. The promoted session cannot access the archive; do not reverse an existing active physical pilot solely to show proof cards. Core can show supported Gateway/Minima status and proof records, while native publication and wallet operations stay outside the demo. If the physical tracker is unavailable, show the planned route without GPS and explain why. An optional simulated segment runs against a disposable environment with the existing fixture test and is labeled synthetic.

### Disposable reproducibility

```sh
export COMPOSE_PROJECT_NAME=trackium-d3-disposable B2_GATEWAY_PORT=55473
export COMPOSE_FILE=routing/valhalla/compose.yaml:routing/valhalla/compose.gateway.yaml:routing/valhalla/compose.demo.yaml
export VALHALLA_GRAPH_DIR=/path/to/reviewed/graph-arterial
export ROUTING_GRAPH_RELEASE_ID=$(jq -er .graph_id "$VALHALLA_GRAPH_DIR/release.json")
docker compose up --build -d --wait --wait-timeout 120
docker compose exec -T gateway node --input-type=module - < routing/valhalla/demo-probe.mjs
docker compose down -v
```

The probe requires an empty disposable database with the fixed local Compose credentials and host. It tests HTTPS-origin security semantics, registration unavailable, Viewer denied, credential/session rotation on promotion, cross-company denial, CSRF, real auto/truck profiles, two legs, duplicate request replay, approval and activation, supersession and comparison. No physical observations are generated. The local run used the cached Gateway dependency layer with current source and assets copied over it.

## APK identities and build

These are internal, controlled review builds. Check the hashes and fingerprints using `sha256sum -c SHA256SUMS`, `apksigner verify --verbose --print-certs` and `aapt dump badging`. Install on an approved disposable phone with `adb -s TEST_SERIAL install APK`; use the full actual serial. For upgrade, compare the existing certificate and version code first. If signing is incompatible, use another test phone or an approved identity. Never clear or replace a working wallet. No keystores ship with the artifacts.

| | Lite D3 signed release build | Core internal review build |
| --- | --- | --- |
| Source | Trackium `0fadf5c98745089e606648090300029772ecbc85` (Lite app is identical in D3) | Core Android `e1f81bf5292220bcb6cef19e1134259289f2cf2b` |
| Package/version | `tech.trackium.lite`, `0.1.0`, code 3, min 28 / target 36 | `tech.trackium.core.prototype`, `0.3.0-TrackiumCorePrototype`, code 5, min 28 / target 35 |
| APK SHA-256 | `eb071eed7afa4d39a7c41a2e970e041bd37f9637b4c9fc48a25a624159ab2fbb` | `67a35f81e461de53e7e7927df9a7777efa8d743c79d6938d92da42e3fe3c9c42` |
| Signer SHA-256 | `e68862a1ef0c635cb63af42385afe7678122a545a7206e92ab6a7be30d696bc4`, demo-only v3 | `3bd16a814293e6f9a239da17845c679364da64a2449223b9f11f8dea8b9cd2b2`, debug v2 |

Lite uses only INTERNET. Build it with the wrapper and SDK versions from [D2](PUBLIC_PRODUCTION_D2.md#android-lite-release-and-distribution), assemble release, align and sign with a restricted internal demonstration key. Signed bytes vary with the signer. Core uses the canonical project's `scripts/ci-debug.sh`, which verifies pins, licenses, lint, several JVM suites and the final APK. Classify the Core APK as an internal build only. The canonical release gate is blocked; confirm distribution rights with the operator before giving a copy to external attendees. Use the operator's own approved phone for the demonstration. [Core build and release gate](https://github.com/themightydanik/trackium-core-android/blob/e1f81bf5292220bcb6cef19e1134259289f2cf2b/docs/CI_DEBUG_APK.md)

Core host declares Internet/network state, notifications, wake lock, boot, foreground service/special use, battery optimization, biometric/fingerprint, package query, legacy external storage, camera and microphone permissions. The Trackium integration adds no permissions. Grant only what is needed on the test phone. Network plus host notification/foreground behavior are relevant to node observation. Do not grant camera, microphone or storage merely for D3. The artifact package metadata records the exact manifest declarations.

## Real Minima and phone acceptance

Use the embedded reviewed Minima `1.1.2.31-euro4` host in Core where available. A separate BlackBear app is not needed for integrated observation. Start on API ≥28 with supported ABI and 4 KiB pages; 16 KiB compatibility is unverified. Use a dedicated test phone with disposable node state. Never import a seed or existing wallet. If a separate BlackBear installation exists, keep both installations intact and avoid starting both services on their shared default port 21001. Follow [the canonical phone checklist](https://github.com/themightydanik/trackium-core-android/blob/e1f81bf5292220bcb6cef19e1134259289f2cf2b/docs/PHONE_ACCEPTANCE.md).

| Real-device check | Evidence needed | D3 status |
| --- | --- | --- |
| Lite and Core install/launch | Record APK hashes, package, OS/API/ABI/page size, launch, orientation, touch and safe areas on a dedicated phone. | NOT VERIFIED |
| Embedded node enablement and permissions | Open Trackium from the host, confirm notification/foreground policy, use the read-only observer and record version, peer count and independently comparable latest height. No Wallet/Terminal operations. | NOT VERIFIED |
| Core Gateway pairing | Persist credential-free HTTPS origin and pilot tenant UUID. Verify pre-approval denial and approve only the intended challenge on the operator machine using existing `node services/gateway/src/proofs/admin.js native-approve ORIGIN OWNER_FILE CHALLENGE_UUID`. Complete pairing and record visible tenant data. | NOT VERIFIED |
| Genuine observation and delivery | Observe an already authorized tracker packet in the Gateway and follow provenance to the Core Device view and Lite Device Lab where supported. Compare fix/eligibility and timestamps. Report absent/stale data explicitly. | NOT VERIFIED |
| Proof demonstration | Show existing Core read-only data and separately show Lite TEST_ONLY if genuinely available to the authorized account. No Mainnet proof or wallet action. | NOT VERIFIED |
| Restart and recovery | Exercise phone background, reconnect and owner revoke, keeping the host boundary and encrypted session storage. Record whether real node readiness recovers. | NOT VERIFIED |

## Results and rollback

- **PASS locally** · Chromium/MiniDapp 42/42, including Fleet Map, session recovery, real PostgreSQL account onboarding, closed demo promotion and native publisher boundary.

- **PASS locally** · Gateway 183 unit, 61 PostgreSQL integration, and backup/restore with v016→017, preserved evidence and B3→B2→B3. The D3 real graph probe passed. PR #100's [private integration](https://github.com/themightydanik/trackium/actions/runs/45690404629) also passed authenticated fixture browser lifecycle and provider outage/recovery.
- **PASS locally** · Lite JVM 6, debug and instrumentation assembly, release assembly and separate demo signing. [D2 Lite CI](https://github.com/themightydanik/trackium/actions/runs/45690404679) passed offline emulator checks at the D2 PR head. D3-hosted checks are recorded on the PR.
- **PASS locally** · Canonical Core build, packager, lint, 353 JVM tests and verified debug signature. [Core CI for current main](https://github.com/themightydanik/trackium-core-android/actions/runs/45702444391). Local hardware acceleration is unavailable; a built test APK does not establish Android instrumentation or physical Minima acceptance.
- **NOT VERIFIED** · Authenticated Railway demo, deployed private routing, actual Lite/Core coexistence on phones, real Minima and genuine physical observations. No production writes or changes were executed.

Recovery priorities: If Gateway fails, confirm DNS/TLS and `/readyz`, preserve current data and use D2 app rollback or approved isolated restore. For routing failure, continue reading B3 history, avoid duplicate proposals and verify graph pairing and `/readyz/routing` before resuming. For incorrect account, expiry or network loss, reconnect via ordinary login or owner-approved pairing. If Minima is unavailable, use the disconnected label; do not use a live wallet to debug. For missing observations check approved binding, tracker connectivity and receipt separately from GNSS eligibility. Do not change hardware settings.

At the end, revoke demo sessions and rotate the password. Disable or roll back using the existing audited procedures, keeping pilot history and bindings. Revoke the Core review session. Disable the demo flags and Integritas test mode together if returning to the disarmed profile, after the operator reviews existing dependencies. Leave migrations intact. Obtain a separate operator GO only after live checks pass.
