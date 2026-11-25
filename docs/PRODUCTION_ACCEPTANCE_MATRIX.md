# D1 · Production acceptance matrix

The [D1 audit](PRODUCTION_READINESS_D1.md) gives the baseline, source findings, safe reproducibility commands and observed results. A gate closes only with recorded evidence for the named environment. Use synthetic manifests or approved test data; redact coordinates, identities, credentials and session headers in shared artifacts.

## Release gates

| Gate | Decision | Minimum action and acceptance evidence |
| --- | --- | --- |
| Code merge | **GO** for docs-only D1 | Independent review confirms findings and scope. Verify whether merging docs can trigger source deployment before merging. C3 was already merged. |
| Isolated staging | **CONDITIONAL GO** | Deployment owner approves disposable tenant and environment. Produce reviewed manifests, pinned image/graph, enforced target limits and private network proof. Gateway must work at baseline with routing disabled; pass staging smoke before enabling routing there. Review and build a signed QA APK pinned to the staging HTTPS origin if Android is included. |
| Production pilot | **NO-GO** | Operations and security owners sign off on target networking, cohort isolation, secret/log handling, capacity, health/alerts, database upgrade and app/graph rollback. Product accepts the defined countries and lanes with geographic and HGV caveats. Android owner records passing physical tests. Obtain an explicit operator release decision. |
| General production | **NO-GO** | Close pilot gates, demonstrate sustained headroom and recovery, validate claimed geography for a single promoted graph and sign off on operations ownership, security retention and support coverage. Expand only within measured capacity and accepted geography. |

### Isolated staging sequence

1. Record Gateway commit, Valhalla image digest, graph manifest SHA/ID, snapshot UTC, previous compatible deployment and DB major. Approve a disposable tenant, HTTPS origin, resource budget, test volume, retention and maintenance window. Confirm staging auto-deploy behavior and keep production disconnected.
2. Verify the approved private IPv4 DNS resolution inside Gateway; verify public reachability of Gateway over TLS and absence of public Valhalla ingress. Attempt Valhalla access from an unrelated staging workload and verify denial. Compare mount checksums and read effective cgroup settings inside the service. Use an attestor behind private peer controls and verify wrong graph metadata fails closed.
3. Rehearse the populated v016 → v017 deployment where applicable, using a disposable environment and bounded migration lock wait. With routing disabled verify normal Gateway readiness, Cargo and device views. Enable routing only on staging, then verify routing readiness and read-only active/history paths after an authorized routing-only failure test. Capture redacted status and alert evidence.
4. Use separate staging companies and Owner/Admin, Dispatcher and Viewer identities. Verify B2 input, role/CSRF rejection, cross-company 404, proposal replay, generation conflict and activation superseding a previous revision. B3 data stays separate from checkpoints, GPS, cargo events and proof states. Inspect edge, app and service logs for coordinates, account IDs and secrets. Run matrices below before pilot sign-off.

## Real geographic routing

Engine used in D1 was Valhalla 3.6.3. Both real graph manifests use the Geofabrik OSM replication snapshot of 2026-11-24 21:21:23 UTC. The Ukraine graph uses a full national PBF extract. The corridor graph is an arterial selection across twelve input extracts with additional German, Dutch and French clipping. These are two separate deployments; do not infer a route can cross graphs. See the committed [manifest and route evidence](valhalla-b1/README.md) and the [D1 command](PRODUCTION_READINESS_D1.md#reproducibility).

| Test | Evidence today | Required before pilot |
| --- | --- | --- |
| Kyiv → Lviv, reverse, Odesa → Mykolaiv on Ukraine graph | **PASS** engine, 544.243, 540.904 and 133.557 km respectively. | Replay through staging Gateway against promoted ID; inspect endpoints, maneuvers and geometry. |
| Burshtyn → Holohory, Lviv → Burshtyn → Holohory on Ukraine graph | **PASS** engine, 77.723 and 173.387 km; latter two ordered legs. | Validate representative rural and last-mile stops and snap distance within pilot requirements. |
| Lviv → Rzeszów, Kyiv → Warsaw, Odesa → Bucharest on corridor graph | **PASS** engine, 169.710, 775.709 and 565.191 km. | Review specific crossings in both directions, real access and detours with operator. |
| Berlin → Warsaw, Warsaw → Paris on corridor graph | **PASS** engine, 574.373 and 1,596.882 km. | Verify both directions and a multi-stop international shipment at staging, with road rather than straight-line geometry. |
| Kyiv → Lviv truck on Ukraine graph; Warsaw → Lviv truck on corridor graph | **PASS** for truck profile route calculation, 548.869 and 396.754 km. **NOT VERIFIED** for legal or operating clearance. | Validate local bridge height, vehicle weight and axle limits plus relevant width/length restrictions against authoritative road or operator records. Test below/above each known limit and inspect chosen path. |
| Graph boundaries, disconnected roads and closed links | **PASS** for prior B1/B2 pinned negative probes and separate D1 synthetic negative cases. Full geographic behavior **NOT VERIFIED**. | Use controls outside the promoted bounds, near but beyond the covered network, within disconnected portions, and on officially closed links. Look for explicit coverage/no-path results, no long snap that misrepresents availability, no substitute geometry. |
| Full Ukraine and most-Europe availability and cross-border last-mile connectivity on one production graph | **NOT VERIFIED** | Build and attest the intended combined release. Publish a coverage statement; repeat positive/negative tests, local streets and routes in each intended pilot region. |

For each staging case capture graph/engine/snapshot, profile and dimensions, waypoints, snap distances where available, route leg and maneuver counts, distance, calculated duration, warning/error and tracker-independent visual inspection. Set route-specific snap tolerances before testing. Verify both sides of restrictions on the intended profile. Valhalla can honor tagged restrictions without providing complete coverage. Compare official closures, temporary restrictions, border queues, roadworks and security conditions separately. Static OSM and modelled driving time cannot establish legal HGV access or arrival time.

## Physical Android acceptance

Local JVM, build and CI emulator evidence is available. All physical rows below are **NOT VERIFIED**. Use a staging-origin QA build after review, a disposable tenant and the actual APK. Record package, versionCode, commit, APK hash, signing certificate, device class, RAM, OS, WebView version, display/font settings and redacted evidence. Include minimum API 28, a current API 36 phone, a narrow low-memory phone and a cutout/gesture-navigation phone; cover both portrait and landscape and default/enlarged fonts. Exercise supported OEM/WebView variants where the pilot fleet requires them.

| Physical scenario | Reproduction and pass condition |
| --- | --- |
| Compatibility and entry | Install signed QA APK, launch and sign in over real staging TLS. Verify correct company/role, trusted navigation scope and external links; reboot and relaunch. No crash, mixed content or stale company content. |
| Safe areas, accessibility and cutouts | Test both themes, gesture and three-button navigation, rotation, larger text and keyboard over planner fields. Controls and map captions remain visible and tappable with no lateral scroll or inaccessible dialogs. |
| Map gestures and responsiveness | Select markers and shipments, pan, pinch zoom, toggle layers and fit a multi-leg route; let three refreshes finish. Selection and camera persist. Route and observed data stay distinct. |
| Background and resume | Background for short and extended periods; also simulate OS process eviction. Reopen with and without network. Verify correct session/freshness, no duplicate mutation and safe reconciliation for uncertain proposals. |
| Expiry and reauthentication | Expire or revoke the staging session during route calculation and during comparison. Protected data and overlays clear; sign back in and verify tenant boundaries. |
| Loss and recovery | Toggle airplane mode during map reads and after a staging proposal commits but before browser response. No automatic mutation; explicitly retry with same request ID while allowed and verify one revision. |
| Long calculation | Use approved staging timeout/error scenario, rotate or switch shipment mid-request and then retry explicitly. Loading and error state remain usable and late geometry never overwrites current state. |
| Memory and endurance | Repeat 30 minutes of navigation, zoom, revisions and background/resume on low-memory hardware. Use adb frame and memory sampling on the staging artifact. Investigate any crash, ANR, retained sensitive map content or monotonic growth; compare to proposed budgets below. |

## Load and resilience

B1's reproducible probe measures a fixed standalone engine route, sequential calls and four concurrent calls. C1–C3 browser fixtures cover functional paths and render timings. No checked-in workload proves complete Fleet Map/B3 target capacity or service restoration under user load. Use an approved external runner against dedicated staging. Seed both a typical tenant and the 25-shipment/25-device case, with some shipments at the 100-revision limit and multiple tenant identities sharing the same ingress. Use normal browser scheduling, distinct actors, approved staging synthetic data and no private production manifests.

All thresholds below are **proposed pending pilot approval**, not measured SLOs. A starting pilot envelope is 10 concurrently active map browsers across two tenants for 30 minutes, ramping from 1 to 5 to 10; verify 25 users as a separate stress case before any expansion. Report p50/p95/p99, admitted vs rejected requests, queue time, active users and route mix by phase. Lower the approved envelope or fix bottlenecks if measured capacity is insufficient.

| Scenario | Proposed threshold and rationale | Status |
| --- | --- | --- |
| Fleet polling and large manifest | Warm map ready p95 ≤3 s; normal refresh p95 ≤5 s; <1% unexpected errors, zero normal-use ingress 429s. Measure bytes/refresh, time-to-interact, browser long tasks, CPU/RSS, DB waits and ingress saturation. The budget is intended to keep interactions usable near the existing three-second refresh cadence. | **NOT VERIFIED** end to end |
| Map, history and concurrent B3 writes | B3 read p95 ≤500 ms and approve/activate p95 ≤1 s under baseline load. Test 100-revision history/detail/compare and simultaneous activations at the same generation. Exactly one success, one conflict; no lost history or stock races. Calculate-and-propose includes routing and uses its budget below. | **PASS** for archived functional concurrency, **NOT VERIFIED** at proposed load |
| Route calculations and quota exhaustion | Mix auto/truck and multi-leg requests, including 15-second bursts of four admitted requests, and separate actor/tenant/global quota trials. In-envelope B2 p95 ≤4 s and p99 ≤8 s, <1% unexpected errors, caps enforced. At overload, explicit 429 and recovery by the next clean quota window. Eight seconds matches the engine deadline; use lower measured p95 headroom for the pilot. | **NOT VERIFIED** end to end |
| Valhalla outage | In staging, fail the isolated engine/readiness dependency under steady load. B2 returns bounded 503/504, B3 history and Gateway remain available, no stray revision. Alert ≤2 min, route capability recovers ≤5 min after service is healthy. Check both initial boot and live loss. | **PASS** for CI live failure isolation, **NOT VERIFIED** for cold start, alerting and timed recovery |
| Gateway or database restart and reconnect bursts | On authorized staging only, restart one component at a time. Existing Cargo and route state stay intact, no duplicate proposals after response loss and ≥95% of clients recover within 60 s after readiness returns. Test staggered and simultaneous mobile/browser reconnects; no unauthorized reads while sessions recover. | **NOT VERIFIED** |
| Capacity, soak and device memory | ≥25% sustained CPU and memory headroom for Gateway/Valhalla/DB at pilot load, no OOM or sustained swapping and no steadily growing pool wait. Measure both graph load and rolling restart, browser heap and Android memory plateau, no ANRs. For GA run an approved 24-hour soak at the proposed peak. | **NOT VERIFIED** for target |

## Rollback and recovery checklist

- Before any target rollout, verify current installation artifacts, explicit previous app/image/graph pairing, backup identity and encryption, an isolated restore target, and who holds rollback authority. Agree an RPO/RTO; use **proposed** pilot objectives of ≤15 minutes RPO and ≤60 minutes RTO if the provider and workload can demonstrably meet them. Measure both in staging.
- Halt promotion on tenant/privacy exposure, unexpected mutations, failed migration, graph mismatch or sustained latency/error breach. Disable routing calculation on the dedicated instance if needed and validate the resulting restart and preserved history. Keep the old graph immutable and separately mounted; roll back Gateway's expected ID and actual Valhalla graph/image as a pair.
- If a B3 startup or migration fails, inspect the advisory and FK lock waits. Use an approved bounded lock window and verify no partially applied migration. Rehearse B2 on v017 where applicable, preserving tables. Validate Cargo read/write, then restore B3 and compare its active pointer, lifecycle audit and exact historic graph metadata. Do not drop B3 schema or restore over the live database as an application-rollback step.
- Restore to a separate PostgreSQL first. Validate route generations, active pointers, ordered history, audit actors/timestamps, telemetry lineage, shipment checkpoints, cargo hashes/outbox and proof states. Compare counts and invariants, then document reconciliation of any writes after the backup time. Route audit is append-only PostgreSQL history. The earlier recovery CI also verifies the independent Cargo hash chain.
- Reopen access only after redacted checks pass, a known-good browser and APK can authenticate, operations confirms dashboards/alerts and the incident owner records the decision.

## D2 evidence update

This section updates the D1 decisions for D2's single-production-environment release. The earlier staging and pilot sections are historical planning. D2 uses disposable local and CI resources and an explicitly authorized production cutover, without separate release environments or customer allowlists. [D2 launch procedure](PUBLIC_PRODUCTION_D2.md)

| Gate | D2 status | Outstanding evidence |
| --- | --- | --- |
| Public HTTPS and customer access | **PASS** locally with HTTPS proxy semantics, public root and fake-provider registration. **NOT VERIFIED** on target. | Confirm actual public URL, certificate, private ingress setting, verified sender/mail and rate/role enforcement. Review the existing demo and TCP dependencies before selecting the public profile. |
| Private network and attestation | **PASS** in Compose and DNS unit tests. The provider documents environment-local IPv4/IPv6 and WireGuard. **NOT VERIFIED** on target. | Operator verifies actual private resolutions, absence of public database/Valhalla ingress and matching graph/image through runtime readiness. |
| Resource enforcement | **FAIL** in local delegated Docker; **NOT VERIFIED** on target. | Inspect effective CPU/RAM/PID isolation on approved provider plan and demonstrate capacity at realistic load. |
| Polling and service recovery | **PASS** for request budget (770 → 158 per five ticks with 25 shipments and devices) and local Valhalla outage/read/restart. | Quantify target capacity, verify operational alert delivery and measure DB/edge limits. |
| Geographic scope | **PASS** for seven end-to-end B2 road calculations on the candidate arterial graph. | Approve the limited coverage statement, verify operating restrictions for any claimed HGV locations, and avoid extrapolating street or country coverage. |
| Database and rollback | **PASS** for disposable v016 upgrade, failed lock recovery, restored lineage/history and actual B3 → B2 → B3. | Confirm current DB major, backups/PITR, custody, recovery objectives and cutover window. |
| Android | **PASS** for local build and debug verification; **NOT VERIFIED** for production signing and physical device acceptance. | Review release signature and install/update behavior; test Android against authorized production HTTPS. |
| Public launch | **NO-GO**. Documentation and implementation are ready for review. | Open registration and routing only after closing the deployment gates with operator approval. |
