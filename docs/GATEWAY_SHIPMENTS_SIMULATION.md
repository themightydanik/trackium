# Gateway integration, shipments and server simulation (PR #6)

## Implemented boundary

The supported end-to-end path is **Gateway-served Cargo UI → tenant-owner-approved short session → dedicated simulator identity → shared normalized ingestion transaction → PostgreSQL telemetry → shipment/checkpoint/condition events → immutable hash chain + transactional outbox → authenticated API → Cargo UI**. This is implemented for both Free/self-hosted and Managed tenants with the same authentication rules.

There are two deliberately separate frontend contexts:

- **Minima/static entry:** `index.html` keeps MDS read-only runtime status and an opt-in **Preview mode** with fixed local fixtures. It does not fetch Gateway data across origins or store an owner key. Settings can open the validated Gateway origin's `/app/` in a separate workspace. No Minima UID or credential is forwarded.
- **Gateway entry:** the same frontend files are served under `/app/`. Owner-approved, HttpOnly cookie sessions work here on the same origin. Devices, shipments, sensor readings, coordinates, checkpoints, history and simulator controls use actual PostgreSQL-backed APIs. This context identifies itself as a Gateway workspace, not a connected Minima node. Preview remains opt-in and visually separate; it never starts a simulator or writes its fixtures to the database.

**The same-origin exchange has been tested end-to-end in Chromium.** A live Minima Core installation and its handling of the external-workspace link have not been tested here. This release does not claim an embedded cross-origin Core transport. The bundled MDS SDK's URL-only GET / Basic-auth GETAUTH cannot safely carry the required session/Bearer exchange; no public relay or weaker CSP/CORS was introduced to get around it.

## Local setup and first run

Docker Compose requires Docker Engine/Compose v2; native development requires Node >=22 and PostgreSQL 16. From `services/gateway`:

```sh
cp .env.example .env
# Edit .env securely: choose POSTGRES_PASSWORD and enable these non-secret settings:
# ENABLE_WEB_WORKSPACE=true
# ENABLE_SERVER_SIMULATOR=true
# PUBLIC_ORIGIN=http://127.0.0.1:8080
# Leave ENABLE_FIXTURE_ADAPTER=false unless separately testing manual fixtures.
docker compose -f compose.yml up --build -d --wait
```

Both opt-in flags default to **false**. Use the exact configured origin in the browser, including hostname and port: `localhost` and `127.0.0.1` are different audiences. Open `/app/` at that origin. Health/readiness remain `/healthz` and `/readyz`.

Compose builds from the repository root with `services/gateway/Dockerfile`. The root `.dockerignore` allowlists only the Gateway build inputs and public v2 frontend files; `.env`, backend credentials, Git metadata and caches do not enter the context. For a manual build, run `docker build -f services/gateway/Dockerfile -t trackium-gateway .` from the repository root. Inspecting TLS proxies can provide the existing optional BuildKit `proxy_ca` secret without disabling certificate verification.

Create the tenant/owner key **on the trusted server**, outside the browser:

```sh
docker compose -f compose.yml exec gateway node src/telemetry/admin.js create-tenant --name='Cargo test tenant' --out=/tmp/tenant-owner.json
# Print only the public tenant UUID, not the key:
docker compose -f compose.yml exec gateway node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/tenant-owner.json','utf8')).tenant_id)"
```

The operator credential file is created with mode 0600 outside the application directory. Securely back it up outside the checkout/container ephemeral filesystem; never paste its token in the UI, URL or logs. For example, redirect `docker compose exec -T gateway cat /tmp/tenant-owner.json` into a private host file with `umask 077`, not onto the terminal. Restore a private copy into the trusted container if it is recreated. Provisioning/approval is an operator action; the web app cannot create tenants or obtain an admin key.

1. In the Gateway workspace enter the **public tenant UUID** and create a one-use challenge.
2. Independently verify the displayed Gateway origin, tenant and challenge ID. The tenant owner then runs:

```sh
docker compose -f compose.yml exec gateway node src/telemetry/admin.js approve-pairing --credential-file=/tmp/tenant-owner.json --challenge=PUBLIC_CHALLENGE_UUID --scopes=read,shipments,simulate
```

3. Click **Check owner approval**. A five-minute tenant session is issued. For read-only use, approve only `read` instead.
4. In **Devices**, explicitly create a simulator identity. In **Shipments**, create a draft, select that device, review/edit the ordered route JSON and temperature conditions, and save it on Gateway.
5. Activate the shipment, then explicitly select a normal simulation or temperature excursion. Pause/resume/finish control the persistent server run. Coordinate/sensor updates, checkpoints and events appear through polling.
6. Reaching all checkpoints changes the shipment to `delivered`. **Complete shipment** is a separate authorized action. Repeating completion returns 409.
7. **Disconnect and revoke** destroys the current session and clears loaded browser data. Expiry, owner-key revocation or a Gateway error also prevent loaded data from being shown as live; reconnect/refresh starts from server state, never from Preview fixtures.

Old owner keys issued before this migration retain their original scopes. Use the existing trusted `issue-key --tenant=... --scopes=read,admin,shipments,simulate --out=/private/file.json` workflow to issue an appropriate owner credential. Approval cannot grant a scope that the approving credential itself lacks. Scope `admin` alone does not imply the new operational scopes.

For native launch, securely set `DATABASE_URL`, `ENABLE_WEB_WORKSPACE=true`, `ENABLE_SERVER_SIMULATOR=true`, and the exact `PUBLIC_ORIGIN`, then `npm ci && npm start` in `services/gateway`. `WEB_ROOT` defaults to the checkout root; the Docker image sets `/opt/trackium-ui`. The UI is built from local files without a frontend framework or CDN.

## Remote Free/Managed and Minima Core

Use an HTTPS Gateway origin for remote deployment. Terminate TLS on trusted infrastructure, preserve the configured Host header, and keep the Gateway port bound to localhost. `PUBLIC_ORIGIN` must be the public HTTPS origin; sessions then use Secure cookies. Plain HTTP is accepted only for explicit loopback development. Forwarded headers never choose the audience or tenant. No cross-origin credentialed CORS is enabled.

In the Minima MiniDapp, Settings saves only `{mode, origin}`. **Open secure Gateway workspace** performs explicit browser navigation with `noopener noreferrer`, not a server-side URL fetch. The new workspace completes the exchange on its own origin. If the Core WebView does not open another window, manually open that exact HTTPS `/app/` address in a browser. Package/install the updated MiniDapp using `python3 scripts/package-minidapp.py /tmp/trackium-cargo-2.1.mds.zip`; actual Core installation/WebView behavior still needs verification on the target node. Existing `legacy.html`, MDS SDK, local database modules and ES5 service are preserved.

No owner key is put into MDS keypair/SQL storage, and a user-provided Minima UID is **never** accepted as identity. Direct in-page Core-origin live data, shared-session Core callbacks and automatic Minima proof publishing are not implemented. PR #7 will require a separately secured publisher with real Core credentials/configuration; those credentials do not belong in this UI.

## API and scopes

Existing `/v1/devices`/telemetry routes retain their bearer-key semantics, validation and tenant filtering. They additionally accept the scoped browser session for reads. Sessions never receive `admin` or `fixture`.

| Method / route | Scope / policy |
| --- | --- |
| `POST /v1/pairing/challenges` | Web flag enabled; same-origin browser headers; `{tenant_id}`; one-use proof cookie; 120-second challenge |
| `POST /v1/pairing/challenges/:id/approve` | Tenant-owner **bearer** credential with `admin` and each requested scope; `{scopes}`; requested tenant/audience must match |
| `POST /v1/pairing/session` | Same-origin + challenge cookie; consume approved challenge once; issue session |
| `GET /v1/session`, `DELETE /v1/session` | Valid browser session; DELETE requires CSRF and revokes it |
| `DELETE /v1/sessions/:id` | `admin`; own tenant only |
| `GET /v1/shipments?limit=&cursor=` | `read`; UUID cursor, limit 1..200 |
| `POST /v1/shipments` | `shipments`; `{name,device_id,route,conditions}` |
| `GET /v1/shipments/:id` | `read`; includes ordered checkpoints, conditions and provenance |
| `PATCH /v1/shipments/:id` | `shipments`; draft only; allowed fields: name, device_id, route, conditions |
| `POST /v1/shipments/:id/transitions` | `shipments`; `{status}`; state-machine validation |
| `GET /v1/shipments/:id/events?after=&limit=` | `read`; increasing sequence cursor; immutable canonical payload, hashes and outbox state |
| `POST /v1/simulated-devices` | `simulate` + server simulator flag; `{label}`; server UUID, mode synthetic, identity_kind simulator |
| `POST /v1/shipments/:id/simulations` | `simulate` + flag; active shipment bound to an enabled simulator identity; `{scenario: normal|temperature-excursion}` |
| `GET /v1/simulations` | `read`; own tenant runs |
| `POST /v1/simulations/:id/pause`, `/resume`, `/finish` | `simulate` + flag; validate persistent run state |

Write bodies use the existing 16 KiB JSON limit. All application queries take the tenant from the authenticated credential/session, not payload, UID or query. Composite foreign keys preserve tenant/device/provenance consistency. A real registry entry remains `physical`/unverified; it is not accepted by the simulator. Ordinary fixture ingestion cannot write to a simulator identity, and TCP newline data still enters only the raw journal.

## State, routes and conditions

Allowed transitions:

- `draft → active | cancelled`
- `active → delivered | cancelled`
- `delivered → completed`
- `completed` and `cancelled` are terminal.

Delivery requires **all checkpoints visited in order**; the final checkpoint triggers delivery in the same ingestion transaction. One device can belong to only one active/delivered shipment at a time. Draft rebinding must stay inside the tenant and preserve the synthetic/unverified trust class. Active/terminal fields cannot be edited; there is no silent reset, transfer of trust class or repeat completion.

The route is an ordered array of 2..32 objects `{name,latitude,longitude,radius_m}`; adjacent points must differ. Supported regional geometry bounds are latitude [-85,85], longitude [-180,180], radius 50..10000 m (default 200). It uses simple regional planar-distance approximations/interpolation, not a navigation-grade geodesic planner or verified hardware movement model.

Conditions are `{temperature_min_c,temperature_max_c,tolerance_c,max_deviation_m}`. Temperature limits must be ordered and within [-100,150] °C, tolerance 0..20 °C (default 0), route deviation threshold 50..100000 m (default 1000). Violations/recovery are emitted on threshold **edges**, not repeatedly for every violating sample. Checkpoints emit once per checkpoint, even if the coordinate is visited again or a later run traverses an already reached checkpoint. The event ledger preserves changes to draft route/conditions before activation.

## Durable simulator and shared ingestion

An authorized command starts a persistent `cargo_simulations` row with route/conditions snapshot, run UUID, cursor, logical start time, interval and scenario. It has its own synthetic registry identity; it never impersonates an AOVX tracker. The default worker checks due rows every second, serializes tenant mutations and locks the run. There are at most five running/paused runs per tenant, one per shipment, and four interpolation steps per route segment plus the origin sample (at most 125 samples per run).

For each tick, sample values are deterministic for the run/step, and `source_event_id = run_id:step`. The existing normalizer/validator is reused, with `source=simulator-v1`, `trust=synthetic`, `identity_kind=simulator`. The accepted raw synthetic input, telemetry event, shipment events, checkpoint updates, outbox and cursor increment commit **together**. Failure rolls them all back. A restart re-reads the stored cursor; identical replay returns the existing event, conflicting content returns 409. Disabling the simulator registry entry pauses its run; it cannot resume while disabled. A paused run does not advance; resume continues its cursor. Finishing early stops the run without falsely delivering the shipment. Terminal shipment transitions stop the run. Session expiry/logout/revocation stops further client commands but does not undo an already authorized durable run; use an authorized finish/cancel command or disable the worker for that.

The temperature-excursion scenario injects a bounded out-of-range reading at step 2 and then returns to nominal values. If the configured range/tolerance leaves no representable validated excursion, that scenario is rejected. Humidity/battery/GPS are also generated. Sample event times use a deterministic **simulation clock**, not proof of wall-clock movement. Pause/downtime does not cause a burst of backfilled ticks. Receipt/ledger `recorded_at` remain server timestamps; sort history by sequence rather than assuming event times are strictly increasing.

## Migration, ledger and PR #7 outbox

Migration `002_cargo.sql` is additive and runs under the existing transactional advisory lock/checksum ledger. Migration 001 stays unchanged. It adds device identity classification (existing real registrations -> physical, existing synthetic -> fixture), permits the separate simulator event source, extends the scope allowlist, and adds shipments/checkpoints/runs/ledger/outbox/pairing/session tables. Existing raw packets, telemetry payloads and canonical strings are retained. Back up before upgrading; perform DDL during a quiescent deployment, especially on large tables with the Gateway's bounded query timeouts. No destructive down migration is supplied.

Each important event has an immutable row with shipment/tenant/event/device IDs, sequence, type, event time, source_trust, exact canonical payload, SHA-256 and previous hash. The canonical envelope includes those identity/order/trust fields, previous hash and event data; hashing uses the Telemetry Core sorted JSON format. Per-shipment serialization, unique event keys and the head hash preserve the linked history. UPDATE/DELETE triggers prevent accidental ledger rewrites. These checks are not signatures, hardware authenticity, tamper resistance against a privileged DB administrator or blockchain confirmation.

The same transaction inserts `cargo_outbox(event_id,tenant_id)` exactly once. `src/cargo/outbox.js` supplies an **internal**, non-HTTP worker interface:

- `claimOutbox(pool,{limit,leaseMs})`: SKIP LOCKED leasing of pending or expired processing records; returns the immutable event and a fencing lease token; increments attempt count.
- `acknowledge(pool,tenant,event_id,lease_token)`: only a valid current lease can acknowledge; repeating the same completed acknowledgment is idempotent.
- `retry(...)`: return a failed valid lease to pending with backoff. Expired workers cannot acknowledge reclaimed work.

Delivery is **at least once**. PR #7 must durably deduplicate the downstream operation by event_id/canonical hash, respect per-shipment sequence/predecessor dependencies, journal real submission attempts and TXIDs, and independently confirm on-chain inclusion before showing proof status. Publish only agreed commitments, never raw GPS payloads or credentials; keep tenant isolation and synthetic provenance in every export. No publisher/consumer runs by default in this PR; outbox rows remain pending. `processed` means delivered to a future consumer, **never published or confirmed**. There are no fabricated TXIDs or confirmations. Synthetic trust must survive every PR #7 publication/export step.

## Security and operational limits

Challenges bind the requested tenant and configured audience, expire after 120 seconds, and require both owner approval and the browser's random HttpOnly proof cookie. Approval and claim are one-time, row-locked operations. Sessions expire after five minutes, have a fixed tenant/audience and an explicit subset of owner scopes, and are invalid if the approving key is revoked/reduced. Secrets are random 256-bit values stored only as hashes in PostgreSQL. Cookies are HttpOnly, SameSite=Strict, and Secure on HTTPS. The per-session CSRF value is returned to authorized same-origin JavaScript and held only in memory, not localStorage or a URL.

Cookie API requests require the exact configured Host, same-origin Fetch Metadata and the client marker; writes additionally require exact Origin and session-derived CSRF header. There are no wildcard CORS headers or arbitrary outbound URL/headers/Minima-command endpoints. The `/app/` static allowlist cannot serve backend/environment/legacy credentials. Challenge creation is limited to ten per source address/minute and 100 globally/minute per process, with a database cap of 1000 active challenges; only the socket peer address is trusted. Reverse-proxy users may share an address. Expired security rows still need an operator retention policy.

The workspace polls rather than streams. It loads the first 25 devices/shipments, 20 telemetry samples per device and 50 ledger records per loaded shipment; API cursors support larger histories, but a full frontend paginator is future work. Poll failures/expired sessions clear loaded data, and out-of-order refresh results cannot replace newer results. A session can remain valid during a network outage; a reload can restore it after the Gateway returns. Explicit logout revokes it.

No PostgreSQL RLS or defense against a compromised Gateway/DB administrator is claimed. Retention, per-tenant storage quotas, production load testing, secret rotation automation, backup/restore drills and remote TLS/reverse-proxy operations remain deployment work. The simulator's generated coordinates/sensors are not physical facts. Real GL110-GL firmware framing, authentication, ACK/retry behavior, ownership provisioning and captured hardware fixtures remain prerequisites for a real adapter. The temporary TCP newline receiver is unchanged. Legacy files/functions are retained and are not promoted into authenticated Gateway records.

## Focused checks

```sh
cd services/gateway
npm ci
npm test
TEST_DATABASE_URL='postgres://.../disposable_db' npm run test:integration
cd ../..
node --test tests/minidapp/core.test.cjs tests/minidapp/browser.test.cjs
TEST_DATABASE_URL='postgres://.../disposable_db' node --test tests/minidapp/server.integration.cjs
python3 scripts/package-minidapp.py /tmp/trackium-cargo-2.1.mds.zip
```

The PostgreSQL suites use/clean unique schemas (CREATE SCHEMA privilege required). Browser tests require the documented external Playwright/Chromium test tooling. They do not use paid services. Tests cover tenant/scopes, ordered checkpoints/revisits, state transitions/repeat completion, synthetic identity constraints, atomic tick rollback, actual runtime restart with a live cursor, canonical hash-chain immutability, outbox retry/lease fencing, pairing replay/expiry/owner revocation/CSRF/audience, and real browser owner exchange with HttpOnly cookies. The production server process is restarted during the browser simulation; PostgreSQL and the browser session persist. Browser assertions also check server data, static Preview isolation, offline clearing, logout, and absence of owner Authorization headers/keys in browser storage/DOM/logs.

Live Minima Core/WebView installation, hard power-loss/WAL fault injection, real hardware transport and blockchain publication are outside these checks and are not reported as passing.
