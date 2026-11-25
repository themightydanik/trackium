# D2 · Trackium Lite public launch

**Decision: NO-GO for public launch.** This PR prepares the existing Railway production topology without applying it. It uses one production environment and the same HTTPS origin for browser and APK. Local Compose and Actions are disposable verification only. See [the D1 matrix with D2 evidence](PRODUCTION_ACCEPTANCE_MATRIX.md).

## Topology and configuration

```
Browser + tech.trackium.lite → HTTPS Railway edge → Gateway :8080
                                                   ├─ private PostgreSQL :5432
                                                   └─ private Valhalla attestor :8002 → engine loopback :8003
```

Use the existing production Gateway and PostgreSQL. The additional service is private Valhalla 3.6.3. Gateway is the only service receiving a public HTTPS domain. D2 does not provision a TCP proxy. Preserve an already authorized AOVX ingress if the operator confirms it is in use. PostgreSQL and Valhalla must have no public domain or TCP proxy. Use `trackium-gateway-production.up.railway.app`, the exact HTTPS hostname trusted by the APK. If the operator chooses another production origin, change and review the APK origin and Gateway configuration together. Gateway API requests keep the existing cookie, scope and CSRF requirements; the public root redirects to the workspace and the Fleet Map is the default authenticated customer workspace.

Select the [Gateway config-as-code](../deployment/railway/gateway.json) explicitly. For the private OCI image service, apply the settings from the [Valhalla config](../deployment/railway/valhalla.json) explicitly if the image service cannot read a config-as-code file from the source repository. The config does not provision an environment, switch on Railway GitHub autodeploy, grant public ports or change an existing service. Review the actual provider plan, source deployment settings, TLS certificate, domain, and network before activating changes. No additional environment is required.

Railway documents environment-local WireGuard and private DNS, with AAAA-only legacy environments and A/AAAA for newer ones. The adapter only accepts single-label Railway service names under `.railway.internal` when Railway environment metadata exists. It pins each connection to a validated RFC1918 IPv4 or ULA IPv6 record, rejects mixed answers with unsafe addresses, and follows no redirects. Non-Railway Compose stays IPv4. Valhalla's bridge binds dual stack, its engine binds IPv4 loopback, and request/response limits and version/graph attestation still apply. This verifies the published provider contract and local behavior. It leaves target resolution, addressing, peer trust and isolation unverified. Only approved workloads should share the private environment. [Railway private networking](https://docs.railway.com/networking/private-networking/how-it-works)

| Service | Setting | Value or source |
| --- | --- | --- |
| Gateway | `NODE_ENV`, `DEPLOYMENT_PROFILE`, `PORT` | `production`, `railway-public`, `8080`. Leave `HTTP_PORT` unset or align it. |
| Gateway | `PUBLIC_ORIGIN`, `ENABLE_WEB_WORKSPACE`, `ENABLE_NATIVE_CLIENTS` | Exact production HTTPS origin, `true`, `true`. |
| Gateway | `DATABASE_URL` | Existing PostgreSQL private URL via Railway reference. Confirm host is internal and PostgreSQL major/role are correct. |
| Gateway | `CUSTOMER_ACCOUNTS_ENABLED`, `CUSTOMER_MAIL_PROVIDER` | Start with accounts disabled for the operator cutover. Set `true` and `resend` for authorized launch. |
| Gateway | `RESEND_API_KEY`, `CUSTOMER_MAIL_FROM`, `CUSTOMER_MAIL_TOKEN_KEY` | Restricted send key, separately verified sender domain/address, persistent 32-byte random hex secret. Keep these in service secrets. Protect the token key across redeploys; changing it invalidates outstanding codes. Resend sandbox delivery to an operator address cannot satisfy public registration. |
| Gateway | `ROUTING_VALHALLA_ORIGIN`, `ROUTING_GRAPH_RELEASE_ID` | `http://valhalla.railway.internal:8002` and the selected full release ID, or omit both to disable calculation. |
| Gateway | `ENABLE_TCP_RECEIVER`, `ENABLE_SERVER_SIMULATOR`, `ENABLE_FIXTURE_ADAPTER`, `CUSTOMER_DEMO_ENABLED`, `CUSTOMER_DEMO_PILOT_ENABLED` | `false` by default. To preserve an already authorized AOVX listener, retain its existing `TCP_PORT` and use `ENABLE_TCP_RECEIVER=true` with `TCP_PROTOCOL=aovx`. Review any special demo access before switching profiles. No existing bindings or observations are rewritten. |
| Gateway | `PROOF_MODE`, `PROOF_ALLOW_LIVE`, `PROOF_ALLOW_MAINNET`, `INTEGRITAS_MODE` | `disabled`, `false`, `false`, `disabled`. No new proof publication. Existing native proof records retain their read contract and are not deleted. |
| Valhalla | `PORT`, source | `8002`; OCI digest of the image built with a reviewed graph. No runtime graph download or storage credentials. |
| PostgreSQL | Existing persistent storage, backups and private networking | Preserve the installed database and migration checksums. No production restore in place as an application rollback. |

Registration uses existing transactional email verification, password authentication, membership and server-side quotas. The production profile rejects a local mail sink, demo admission and unsafe proof/fixture modes. No routing allowlist is applied to registered customers. Owners, Admins and Dispatchers may calculate/propose, Owners/Admins may approve/activate, and Viewers can read authorized revisions. Both standalone B2 and proposal calculation use existing rate admission. Registration, email delivery and role permissions do not grant provider or wallet access.

## Graph and resources

For cross-border launch the reproducible candidate is the combined arterial Ukraine/Europe release `6a707e47f877bd471dce66baa5fb0e1e54d4a1bfe6a0f2c49156eb1f9d992f29`. Its Geofabrik source snapshot is 2026-11-24 21:21:23 UTC. One deployment uses one connected graph. The separate, more detailed Ukraine graph cannot extend this release's coverage transparently. Document the narrower scope explicitly before launch: sampled Ukrainian and international corridors, incomplete local roads, limited source windows in western Europe, unverified last-mile and unverified HGV legal clearance. Static OSM has no guarantees for current road closures, security, border delays, legal access or arrival time. [B1 input hashes, observed coverage and build measurements](valhalla-b1/README.md)

Rebuild offline from pinned source bytes using Python 3, Docker and osmium. Put the exact raw files listed by [sources.json](../routing/valhalla/sources/sources.json) next to a copy of it. Use distinct empty working/output directories.

```sh
python3 routing/valhalla/prepare-corridors.py /reviewed/inputs/sources.json /work/prepared
python3 routing/valhalla/select-arterial.py /work/prepared/corridors.json /work/arterial
python3 routing/valhalla/build-graph.py /work/arterial/arterial.json /work/graph-corridors
routing/valhalla/package-release.sh /work/graph-corridors trackium-valhalla:review
```

Record the manifest, input/graph checksums, tool versions, build date and final OCI digest, plus the matched route acceptance results. A recompile with a different resulting ID needs new review and Gateway pinning. The package contains only the attestor, image pin and root-owned graph payload. The unprivileged service checks config, tiles, source and engine version at startup. The packaged image suppresses raw engine output; Gateway emits bounded calculation outcomes. Keep both previous graph and corresponding OCI digest. Publish only to an approved registry after operator authorization; the script only builds locally.

Measured B1 corridor build peaked at about 7.55 GiB RSS, 338.54 s compile time and 563,481,088 graph bytes; the 810,176 KiB peak service RSS was a small route sample. The manifest requests 2 vCPU/4 GiB for Valhalla, not a proven production envelope. Railway's schema exposes CPU and RAM overrides but no configurable PID cap in these files. Confirm effective CPU/RAM/PID limits in the live provider container with `/sys/fs/cgroup/{cpu.max,memory.max,pids.max}` and record plan/minimum headroom and measured latency. If Railway cannot supply acceptable PID isolation, resolve separately before enabling public routing. The local delegated Docker host previously demonstrated unenforced limits; a config listing alone does not close this gate. Allocate space for at least two release images plus staging files during an offline rebuild. [Railway config schema](https://railway.com/railway.schema.json)

## Reliability and capacity

Gateway deploy admission uses `/readyz` (PostgreSQL). Private Valhalla uses `/status` to confirm graph backing and engine availability. Gateway checks routing separately via `/readyz/routing`; loss of Valhalla causes bounded errors for new calculations while B3 history remains readable. The attestor exits unsuccessfully if its engine exits unexpectedly and the manifest has bounded on-failure restart. Gateway does not wait for Valhalla at startup. The configured 1.5 s connect, 8 s route and 2.5 s readiness deadlines, 4 concurrent calculations per Gateway, 8/24/120 actor/tenant/platform per minute and input/output bounds remain unchanged. [B2 contract](GATEWAY_ROUTING_API.md)

Fleet Map checks the session every three seconds while visible, refreshes its full snapshot every 15 seconds after the last successful full refresh, and immediately refreshes on manual action, mutations, role change and foreground return. Other Lite views retain their existing refresh cadence for shipment events, device history and proofs. One Lite snapshot fan-out runs in groups of six. In the deterministic 25×25 test five ticks generated **158** reads versus **770** with the previous all-reads-each-tick logic (**79.5% fewer** for the same ticks). Per-stage peak concurrency fell from 25 to 6. This measures the client request budget, excluding optional APIs, Fleet Map selected-route requests, assets and overlapping actions. Telemetry and Cargo source data remain unchanged. There is no measured users-per-instance estimate. Current public ingress guard is 1,200 API/asset requests a minute and 32 concurrent per process. Run the approved load mix in [the matrix](PRODUCTION_ACCEPTANCE_MATRIX.md#load-and-resilience) locally and measure a small non-destructive approved check on target before opening it. Do not extrapolate the local single-route p95 or simply raise limits.

Railway deployment healthchecks run at cutover only. In an existing operator monitor, independently check both public readiness paths every 30 seconds and alert the assigned owner after three failures. Distinguish planned routing-disabled 404 from 503 after activation. Monitor restart count, memory/OOM, CPU, PIDs, disk, database pool wait, backup age, mail delivery outcomes and 429/5xx rates. Alert on a service crash loop, stale backup or >75% sustained resource use for ten minutes as initial thresholds to review. Retain sanitized outcome counts and latency. Forbid reading or retaining cookies, CSRF, mail codes, precise coordinates or raw request bodies in shared logs/APM. Test delivery of the alerts; this PR does not install or configure a monitoring service. [Railway healthcheck behavior](https://docs.railway.com/deployments/healthchecks)

## Backup, cutover and rollback

1. Check the current DATABASE_URL ownership and migration state and review the exact deployment plan, including existing TCP and demo dependencies. Freeze changes until the operator approves. Take encrypted provider backup/PITR evidence and a restricted logical `pg_dump --format=custom --no-owner --no-acl` with an approved operator account. Verify archive checksum and rehearse `pg_restore --single-transaction --exit-on-error` on disposable local PostgreSQL. Validate ledger, lineage, company access, route revision/audit and active head. Record backup age, measured recovery time and custody. [Restore drill](../services/gateway/docs/BACKUP_RESTORE_DRILL.md)
2. Preserve migration 017. Gateway applies existing migrations transactionally under its migration lock before becoming ready. Agree a bounded PostgreSQL lock wait and maintenance window as in [B3](SHIPMENT_ROAD_ROUTES.md). Check exact DB major and locks. On failure verify readiness remains closed for the new revision, check migration state and reuse the previous app. Never edit migration checksums.
3. Under explicit authorization deploy the reviewed production services with registration/calculation held closed. Verify actual private DNS and HTTPS, readiness separation, secret redaction and restart policies and confirm absence of public Valhalla/PostgreSQL ingress. Test a controlled real mailbox and app using the same HTTPS origin when the operator permits it. Verify role denial, cohort-independent registered access, on-device acceptance and a small authorized route smoke. Open public registration only after launch sign-off. Verify production APK signing and public distribution controls separately.
4. Hold or halt release for privacy, integrity, graph, backup or sustained availability failures. Roll back the previous Gateway revision while retaining B3 tables. Calculations can be disabled by unsetting both routing settings. Activate the former Valhalla image and matching expected release ID together. Closing accounts during emergency rollback also disables normal customer access; use an operator-approved maintenance window, or roll back to a prior safe account-compatible config. Restore production data only through a separately authorized incident plan from a verified isolated restore.

## Android Lite release and distribution

The Lite shell still pins the production site URL and rejects cleartext, other origins and unsafe resource/navigation paths. The package is `tech.trackium.lite`, version `0.1.0` (versionCode 3), min SDK 28 and target SDK 36. Use the repository wrapper, JDK 21 and the Android SDK versions in [the existing workflow](../.github/workflows/lite-android-debug.yml). The workflow produces an installable debug review artifact and exercises offline Android behavior in an API 34 emulator. Physical acceptance requires the D1 device checklist on the actual signed release against authorized production.

```sh
apps/android/gradlew -p apps/lite-android --no-daemon \
  :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest :app:assembleRelease
# After review, in the operator's secure signing environment:
"$ANDROID_HOME/build-tools/35.0.0/zipalign" -P 16 -f 4 \
  apps/lite-android/app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" sign --ks /secure/operator/keystore \
  --out trackium-lite.apk aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs trackium-lite.apk
"$ANDROID_HOME/build-tools/35.0.0/aapt" dump badging trackium-lite.apk
sha256sum trackium-lite.apk
```

Publish the reviewed signature fingerprint, version, source commit and APK SHA-256 over the same trusted HTTPS origin or an approved distribution channel. If updating a previous installation, verify its signing lineage and lower versionCode first. The debug key and the operator's release key have different distribution purposes. No operator key was used in D2. Local debug APK signature v2 verified, signing certificate SHA-256 `9b1973242dd409201357b5175b374c3a6d76d674d73114b0eb38cb5d9431b38e`, APK SHA-256 `ad2c054f31f7acda8848e87934699ae29ed23f6e4a07709588954271ed1871f3`. The release build was produced unsigned for controlled signing.

## Executed evidence and gates

| Check | Evidence |
| --- | --- |
| Account and site integration | Public profile launched on disposable PostgreSQL with HTTPS proxy semantics. Verified root redirect, hostile Host rejection and protected workspace reads. Account suite covered register/verify/login, membership, isolation, CSRF, password reset and mail error/idempotency through a fake Resend transport. No real email was sent. |
| Gateway and PostgreSQL | 182/182 unit, 61/61 PostgreSQL integration; backup drill passed migration 017, lock timeout rollback, checksum verification, corrupt/truncated/incomplete archive rejection and route history/active pointer recovery. Actual B2 `e97647e98d0c44b6e6c773dfc0c34d4a490ef01a` ran against restored B3 schema. The disposable archive recovered lineage, immutable ledger, outbox and proof evidence. |
| Routing behind Gateway | Real Valhalla 3.6.3 through B2 on the release candidate returned seven routes. Auto routes were Kyiv–Lviv, Lviv–Rzeszów, Kyiv–Warsaw, Odesa–Bucharest, Berlin–Warsaw and Warsaw–Paris. The truck Kyiv–Lviv result was 548,248 m, 22,739 s with an HGV warning. The fixture B3 browser test verified generation 6, two revisions, lost-response replay, concurrent 200/409 activation and readable history during routing outage. Routing readiness recovered after a local restart. A separate cold start with Valhalla stopped returned Gateway readiness 200 and routing readiness 503. The unprivileged packaged fixture also attested its graph and exited nonzero when its engine was killed. |
| Private topology and resources | Local Valhalla and PostgreSQL had no published ports. Valhalla attestor served both IPv4 and IPv6 loopback; Gateway DNS filtering also exercised with mixed and IPv6-only fixture records. Local Docker accepted 2 CPUs, 4 GiB, 96 PIDs but reported effective cgroups of 4 CPUs, 32 GiB and unlimited PIDs. The resource gate is open. Both Railway configs matched the published JSON schema. The existing Railway SDK type check and 1/1 configuration test passed. |
| Chromium and MiniDapp | Full fixture suite 38/38; disposable PostgreSQL browser suite 4/4, including registration, map, proof and recovery. Separate private-Valhalla browser lifecycle 1/1. |
| Android Lite | 6/6 JVM tests; debug, instrumentation APK and unsigned release assembly ran locally. Local emulator execution lacks hardware KVM. See PR Actions for hosted emulator results. Physical compatibility, actual registration/TLS and public signing are open. |

```sh
npm --prefix services/gateway test
# Set TEST_DATABASE_URL to a disposable PostgreSQL database only.
npm --prefix services/gateway run test:integration
node services/gateway/scripts/backup-restore-drill.mjs
NODE_PATH=/path/to/ui-tools/node_modules node --test tests/minidapp/poll-budget.test.cjs
NODE_PATH=/path/to/ui-tools/node_modules node --test --test-concurrency=3 tests/minidapp/*.test.cjs
```

Use the [private Compose workflow](../.github/workflows/gateway-routing.yml) to reproduce the authenticated fixture runs. For the real corridor check select the reviewed arterial graph instead and use the `corridors` Gateway probe mode. The local build initially rejected the container registry proxy CA during `npm ci`; the local Compose run reused the cached Gateway base and copied current source/migrations/assets over it. Hosted CI builds the standard Dockerfile. Provider resource caps, actual ingress/DNS, backups, trusted alerting, production load, real mail, physical APK acceptance and signing remain mandatory before public release. No provider changes were made.
