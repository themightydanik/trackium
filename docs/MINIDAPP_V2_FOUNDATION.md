# Trackium Cargo MiniDapp 2.0 foundation

## What this version does

`index.html` is a new dependency-free Cargo workspace with a navy/teal design system, responsive navigation, accessible mobile menu and detail dialogs, explicit loading/empty/error states, and seven screens:

| Screen | Implemented |
| --- | --- |
| Dashboard | Shipment/device overview, illustrative fleet map, temperature/humidity chart, recent synthetic activity |
| Shipments | Searchable demo list; shipment card with route milestones, cargo and linked device |
| Devices | Searchable device directory and detail cards for GPS, reported status, temperature, humidity and battery |
| Live Map | Local schematic Europe map and device coordinate list; no external tiles, geocoding or live tracking |
| Events | Fixed normalized-event history, device search and reported-status filters |
| Proofs | Clear unpublished/unimplemented states; no publish button, fabricated transactions or confirmations |
| Settings / Gateway | Free/Managed profile form, origin validation, pending-pairing state, runtime status and legacy link |

On first load **Demo mode is off**. No devices, shipments or events are obtained anonymously, and no data silently falls back to demo on failure. Enable the labeled switch or **Explore demo workspace** to load a deterministic snapshot at `2026-11-07T12:00:00.000Z`. Every demo event is `fixture-v1` / `synthetic`; a persistent banner labels the whole workspace. Demo data stays in memory and is not sent to Gateway or MDS SQL. Exiting demo clears its records and closes details; reload returns to unpaired mode. Shipments, routes, milestones and ETA are demonstrations only. There is no shipment API or local imitation of a Gateway save.

The only persisted v2 setting is `trackium_v2_profile`, containing exactly `{mode, origin}`. URL credentials, paths, query parameters and fragments are rejected. HTTPS is required except on loopback. The form does not accept API keys or pairing secrets. Saving a profile does **not** reach, authenticate or connect to Gateway. Browser storage failure produces a visible error.

## Existing files and dependency analysis

The old `index.html` loaded MDS, local SQL/database helpers, device/registry/simulator modules, blockchain/contract helpers and large inline handlers together. It could initialize legacy SQL/blockchain behavior as part of startup. These must not run as side effects of the new Gateway workspace.

- The old document is preserved **byte-for-byte** as root `legacy.html`, so its existing relative `assets/` and `mds.js` references still work. The Settings link carries only the native Minima `uid` when present; it does not carry a Gateway credential. The old files/functions in `assets/js`, `assets/css` and `mds.js` remain unchanged.
- The new document loads only the existing `mds.js` SDK and isolated `assets/v2/` scripts/styles. It does not read old `devices`, `blockchain_proofs` or shipment tables, import their trust flags, invoke transaction helpers, enable RPC, request GPS permissions or initialize Trackium Live.
- `dapp.conf` keeps the existing internal browser, icon and `trust: write` permission for legacy/service compatibility. Name/version/description now describe the Cargo foundation rather than claiming completed proof publishing. The new foreground UI uses only read-only `status`; this release does not claim least-privilege isolation from the preserved legacy tools.
- `service.js` previously loaded `assets/js/database.js`. Although its own syntax was ES5, that dependency contains `const`, template literals, arrows, Promise helpers and `globalThis`, so loading it in Rhino ES5 could fail at parse time. The service now loads `assets/v2/background-database.js` and constructs `TrackiumBackgroundDatabase`; these are its only two line changes.
- The new ES5 initializer copies the **same SQL definitions** for the three legacy tables and four indexes used by the service (`devices`, `movements`, `events`), without modifying existing data or loading modern browser helpers. It reports initialization failure instead of continuing on a failed schema operation. The full old initializer remains available to the legacy UI; no old tables or functions are deleted. The service's Android polling, throttling and local insert/update functions remain unchanged. They are legacy behavior, **not** Gateway telemetry or a new Android implementation.

Legacy data and controls are deliberately separate; opening the legacy workspace retains its original functionality and limitations. This is not a data migration. In particular, old local proof flags are not treated as confirmed evidence by v2.

## Gateway client boundary

`assets/v2/gateway-client.js` is a read-only client for the existing API:

- `devices({limit,cursor})` -> `GET /v1/devices`
- `device(id)` -> `GET /v1/devices/:id`
- `location(id)` -> `GET /v1/devices/:id/location`
- `status(id)` -> `GET /v1/devices/:id/status`
- `history(id,{limit,cursor,from,to})` -> `GET /v1/devices/:id/events`

UUIDs are validated and query values encoded. `gateway-model.js` maps the actual registry/status/location/history response envelopes, preserves missing sensor values as null, retains the history cursor and marks missing/unknown provenance **unverified**. A real registry entry never becomes a verified device or proof merely because its mode is `real`. Current UI data comes only from the explicitly chosen demo source. The model/client are the integration boundary for a future authenticated transport, not an implemented live connection.

`GatewayClient` requires an injected session transport. No such transport is installed in this release. Without it, calls reject with `PAIRING_UNAVAILABLE` before any network request; network/transport errors do not leak upstream details or substitute demo records. The profile form and check action display **«Ожидает реализации pairing»**. Current Gateway v1 has tenant API keys but **no pairing, token exchange or short-lived session API**, and this PR does not change that API. Do not inject existing operator/admin/read bearer keys into the browser to bypass this state.

### Why MDS.net is not used for Gateway authentication

The bundled SDK is MDS JS v2.1.0. `MDS.net.GET` accepts a URL only; `GETAUTH` supports Basic Auth, not an arbitrary Bearer header; `POST` accepts URL and data. Encoding bearer credentials in URLs, translating them into Basic Auth, or using an unauthenticated proxy would violate the intended boundary. `MDS.api` and `MDS.keypair` exist, but their presence is not proof of an isolated credential vault or authenticated sender binding. No Gateway credential is stored there in this foundation.

The new bridge initializes MDS only with a valid native Minima session UID. SDK `inited` is emitted locally, so the UI requires a successful read-only node `status` response before saying **Minima connected**. A 30-second read-only status heartbeat and 8-second timeout can mark the node unavailable; shutdown marks it disconnected. Block height is only node runtime information and never evidence confirmation. Outside Core the app is **Standalone preview**, and it does not call MDS polling/commands. Foreground JavaScript targets a current Chromium/WebView; only the background dependency chain is required to parse as ES5.

## Proposed pairing architecture — NOT implemented

The same security contract applies to both a customer's Free deployment and a Managed tenant:

1. A trusted authenticated Gateway control-plane action creates a short-lived, one-use pairing challenge, bound to a specific Gateway, tenant, client and read-only scopes. The current CLI/API does not implement this step.
2. A trusted Minima-side component or private authenticated session broker completes the challenge with verified caller identity and proof of possession. Long-lived upstream credentials belong in its server/native secure storage, **not** browser JavaScript, MDS UI-readable SQL/keypair state, a URL or an operator-pasted token field. Native sender identity/storage isolation must be verified on the actual Core runtime before relying on it; accepting a caller-supplied UID/tenant is insufficient.
3. The Gateway issues a tightly scoped session with a short expiry (proposed maximum five minutes), fixed audience and tenant, revocation and rotation. Prefer an HttpOnly/Secure session cookie if the deployment can provide a compatible origin; Minima/WebView third-party cookie and SameSite behavior must first be tested. Alternatively a trusted transport may use a short-lived read-only session held only in memory. Existing long-lived v1 keys are not that session.
4. A broker, if required, is private and authenticated, enforces the session's tenant and exact read-only operation/device allowlist, pins/validates the Gateway origin, blocks redirects/SSRF and never accepts arbitrary URLs, headers or Minima commands. It is not a public relay or an authentication bypass. Free and Managed use the same checks; there is no shared global device credential.
5. Browser integration must enforce exact origin/CORS and CSRF policy, never wildcard credentialed CORS; expiry/revocation clears loaded tenant state and requires re-pairing. Offline errors remain offline. Demo mode is separate and opt-in.

This requires a separately designed/reviewed Gateway server exchange and Core transport implementation. The current CSP permits only same-origin connections, disallows third-party scripts/objects/forms, and suppresses referrers. It intentionally does not permit arbitrary direct Gateway fetches. A future transport must adjust that policy narrowly after the architecture is verified. No server proxy, exchange, session or pairing-success state is shipped here.

## Local launch and packaging

No frontend framework, bundler, install step or external font/map CDN is required for v2:

```sh
cd /path/to/trackium
python3 -m http.server 4173 --bind 127.0.0.1
# Open index.html via that local server; select Explore demo workspace.
python3 scripts/package-minidapp.py /tmp/trackium-cargo-v2.mds.zip
```

The packager includes only root MiniDapp entry/config/runtime/icon files and static assets. Backend files, `.env`, dependencies, caches and Git metadata are excluded; output must be outside the checkout. The `.mds.zip` contains `dapp.conf` at its root and can be installed through the Minima MiniDapp Hub. In Core, launch the new default entry and check runtime status. The actual package installation on a running Minima Core has **not** been validated in this cloud environment.

The preserved legacy page still has its original external Leaflet dependency; offline guarantees apply to the new v2 page only. Back up the old MiniDapp/local data before upgrading and independently validate any legacy operations you use.

## Focused validation

```sh
node --test tests/minidapp/core.test.cjs
# Requires Playwright and Chromium as development tools, not shipped dependencies:
node --test tests/minidapp/browser.test.cjs
# Override browser path and screenshot directory when necessary:
CHROMIUM_PATH=/usr/bin/chromium TRACKIUM_SCREENSHOTS=/tmp/trackium-screenshots node --test tests/minidapp/browser.test.cjs
# Syntax validation of the background chain with an ES5 parser:
npm exec --yes --package=acorn@8.15.0 -- acorn --ecma5 --silent service.js assets/v2/background-database.js assets/v2/mds-bridge.js
python3 scripts/package-minidapp.py /tmp/trackium-cargo-v2.mds.zip
```

If Playwright is not available, install tooling **outside the checkout**, for example `npm install --prefix /tmp/trackium-test-tools playwright`, and run browser tests with `NODE_PATH=/tmp/trackium-test-tools/node_modules`. Install Chromium through the environment's supported package manager, or set `CHROMIUM_PATH` to an existing compatible browser. The browser suite starts/stops its own local static server; it does not require Gateway, external maps or a Minima node.

Tests cover fail-closed client behavior, route/response contracts, provenance, deterministic demo isolation, origin/secret rejection, model nulls, MDS read-only state transitions, legacy schema equality and background Android/local SQL flow without Promise/globalThis. Browser tests cover initial unpaired behavior/no anonymous API calls, all screens at desktop/mobile widths, search/filter/detail/chart interactions, menu/keyboard behavior, profile persistence/storage failures, and the **actual bundled SDK against mocked node responses**. They also confirm block changes never imply cargo proofs. Screenshots are produced outside the repository.

These checks do not prove live Minima installation, Rhino engine behavior beyond ES5 syntax/VM compatibility, real Gateway pairing, cross-origin sessions, GL110-GL hardware, real shipment persistence, Integritas publishing or on-chain confirmations. None is claimed as implemented or production-ready.
