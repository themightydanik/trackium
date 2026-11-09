# UI implementation progress — Design System 1.0 / Web

## Scope of this first PR

Only stage1 foundation: version1.0.0 semantic token snapshot and generated CSS, owner golden mark, current-workspace brand image/favicon/app icon metadata, targeted checks. No Gateway/backend/auth/API/PostgreSQL/migration/Proof-policy changes. No Android project is added here; the canonical source is trackium-core-android/design-system. Legacy.html, local-core.html and historical apps/android are unchanged.

The owner-approved mark already exists in assets/img/logo.png and icon.png. Android retains byte-identical originals and produces exact RGBA crop/raster derivatives; this Web snapshot uses those outputs, not an invented logo or prior Routed T/Cargo C/Relay proposal. Source version/hash/commit are in design-system/SOURCE.json. Gold is used for branding; primary actions remain mint. Original attribution/NOTICE is not removed.

Merge order: review/merge Android foundation first, then this compatible snapshot. Both CI builds are self-contained; no cross-repository fetch is required. Before changing tokens/brand, update canonical source and explicitly re-pin the reviewed snapshot. No automatic merges.

## Themes and staged migration

New --tc-* roles provide System light/dark plus explicit data-tc-theme=light|dark; typography (rem/leading/weight), space/radius/elevation/icon/motion/component roles are shared. Current legacy cargo.css components are not globally recoloured or resized in this step: full Light/Dark UI, a Settings toggle and comprehensive redesign are stage6 after earlier Android stages are reviewed/merged. Rem typography assumes the future DS1 consumer's 100% (normally16px) root, not the legacy14px base. This avoids falsely claiming a complete accessible light theme while residual hardcoded surfaces remain.

Approved light accent was darkened slightly to #007667 after contrast checks against elevated surfaces. Canonical palette is the sole target system, not an additional independent History/Chat/Trackium palette. Web keeps browser-friendly sidebar/drawer; Android root navigation is not copied here. No nonfunctional domain feature buttons are introduced. The webmanifest is icon/install metadata only, not an offline/PWA-service or live-data capability claim.

## Verification

Local snapshot/owner-source/hash/semantic checks pass. Existing16 browser/core tests +2 targeted tests pass (18 total), including compact/desktop logo loading/no document overflow, favicon resolution, System/manual token contexts and unchanged unpaired/no-demo state. Existing authenticated PostgreSQL browser integration and real owner/tenant sessions are not run for this asset-only step; production acceptance is not inferred.

Review docs/design-system-1/brand-comparison.png and the before/after preview screenshots in the PR. Actual browser/OS app-icon masks, high DPI favicon/themed contexts, full contrast/focus and all light-theme components need later manual acceptance. No trackers, real data or Mainnet actions were used.

## Remaining stages

Android chrome/Node → unified navigation → native content → remaining Android modules → current Web redesign → full UX acceptance. None is started by this PR. Licensing/NOTICE, native16-KiB compatibility and phone/Mainnet/production Gateway/AOVX acceptance blockers remain separate. No public Release.

### Web visual evidence

Unauthenticated, no-demo local captures at 1440 and 390 CSS px; phone drawer fully opened. Before is repository main `ee384431f6e1d8c21240ee6cbcc1f9473b73555e`, after is this foundation. These demonstrate brand replacement, not a completed responsive/theme redesign.

- [Desktop before](design-system-1/web-before-1440.png) / [after](design-system-1/web-after-1440.png)
- [Phone before](design-system-1/web-before-390.png) / [after](design-system-1/web-after-390.png)

## Update 4 — unified MiniDapp implementation

Prerequisites are merged: Android PR #6 and Web foundation PR #16. The canonical
DS1 token/brand snapshot is preserved; no alternative palette or Android project
is introduced here. Android logo/navigation cosmetics are a separate requested
Android change and are not replaced with generated artwork in this Web PR.

The authenticated `/app/` workspace now provides:

- Dashboard: loaded shipment/device/Proof/event counts, recent events and route overview.
- Shipments: snapshot search/filter, shipment cards, checkpoint/condition details,
  existing authorized lifecycle actions and a structured draft-route editor.
- Devices: responsive table/cards, measured telemetry, missing-reading states,
  provenance and device/history details. A real zero remains zero.
- Live Map: existing route coordinates and last reported GPS on an explicitly
  schematic map; no fabricated position, external tile provider or navigation claim.
- Events: searchable recorded timeline and evidence details; outbox delivery is
  distinguished from blockchain confirmation.
- Proofs: human-readable evidence states, existing Verify/export actions and
  collapsed publisher policy/Local Core exchange controls.
- Gateway Settings: System/Light/Dark appearance, origin/tenant/session information
  and existing session revocation. Owner-approved pairing remains unchanged.

Shared DS1 surfaces, controls, focus states, cards, empty/loading feedback and
responsive sidebar/drawer serve these pages. Polling retains focused search and
public form drafts in memory within the same session/page; credentials are never
persisted by this presentation layer. Refresh timestamps and snapshot limits are
visible. Existing auth, CSRF, scopes, tenant isolation, publication policies and
all HTTP API contracts remain authoritative and unchanged.

The sole Gateway serving change is a precise allowlist for the already reviewed
brand PNGs/webmanifest. This fixes missing branding under `/app/`; it does not
expose arbitrary repository files or introduce an API.

### Review captures

These are local Chromium captures using **explicitly synthetic browser fixtures**,
not real Gateway, blockchain, AOVX or phone acceptance. No production token is used.

- [Dashboard, desktop dark](update4/dashboard-1440.png)
- [Shipments, desktop light](update4/shipments-1440.png)
- [Devices, phone light](update4/devices-390.png)
- [Proofs, phone dark](update4/proofs-390.png)
- [Gateway Settings, tablet dark](update4/settings-900.png)

### Validation and remaining scope

Two targeted browser tests passed during implementation: seven authenticated
pages at compact/desktop widths, theme choice, structured evidence/missing values,
input/focus retention across polling and draft stop editing. Final CI runs the
complete MiniDapp browser/core/snapshot checks, real ephemeral PostgreSQL owner
pairing/simulator/restart integration, and existing Gateway deployment checks.
The PR records the resulting run URLs and any actual failures; previous Android
or foundation CI is not evidence for this change.

Current API capabilities are intentionally not extended: only the first 25
shipments/devices and bounded per-record history are loaded and searched. Server
pagination already exists; a fuller browsing UI can consume its existing cursors
in a separate functional update. A geographic basemap/provider and live transport
are separate integrations. Full-text cross-tenant-safe server search or richer
aggregate/stream APIs would require a separately scoped backend change if desired.

Manual acceptance remains: a real owner-approved HTTPS Gateway session, physical
AOVX telemetry, phone/tablet browsers and assistive technology. No Mainnet
publication, financial operation, real tracker measurement or production readiness
is inferred from these fixtures or CI. Existing licensing/release blockers remain.

## Complete Update 4 — Web UX and cross-platform acceptance

This continuation starts from merged Web #17 (`331e670`) after Web #16 and
Android #7 (`8e07854`). It supersedes the earlier Update 4 follow-up list for
pagination, geographic maps and measurement charts. Android was read as the
reference; no Android or backend source is changed here.

### Implemented screens and retained contracts

| Screen / component | Completed behavior | Existing data / limitation |
|---|---|---|
| Overview | Gateway/authenticated observation, granted scopes, freshness, loaded totals, routes and newest events | Counts cover current API pages, never tenant-wide totals; stored session alone is not connectivity |
| Shipments | Search/filter/sort, previous/next pages, route editor, conditions/checkpoints, linked device readings/events/Proof details, cancellation confirmation | Existing `/v1/shipments` cursor, detail, transitions and simulator operations; server remains authoritative |
| Devices | Responsive table/cards, source/time/units, details and discrete measurement charts | Existing device registry/status/location/history; missing values stay missing, including between chart points; genuine zero is retained |
| Live Map | Pan/zoom/keyboard, coarse geographic context, reported-position popups, planned route overlays, coordinate fallback | Existing latitude/longitude and observation time; no simulated movement, road navigation or live-stream claim |
| Events | Search/filter/sort, time, human-readable type, shipment/device, provenance, available importance, evidence details | First 50 events per loaded shipment; importance says Not reported if absent; worker delivery is not chain inclusion |
| Proofs | Model-supported lifecycle labels, source/time/reference/depth, linked shipment/device, fresh configured-node check evidence and export | Verify result is time-stamped and volatile, not a permanent independent-verification claim; publication policy unchanged |
| Settings / connection | Appearance, origin/tenant/scopes/expiry, owner challenge/claim/revoke, checking/unpaired/expired/forbidden/unavailable states | Same-origin HttpOnly/CSRF flow; no owner key form or credential persistence |
| Shell | Overview terminology, responsive drawer/sidebar, Back/filter/scroll retention, keyboard/dialog focus, reduced motion | Only public presentation preferences in localStorage; session-bound drafts/evidence in memory are cleared at identity loss |

Only existing API paths and payloads are used. Existing simulator actions remain
explicitly synthetic and scope-gated. POST/DELETE requests still use the existing
CSRF header and same-origin cookies. Session failure clears tenant records and
open detail evidence. No API, PostgreSQL, auth, CORS/CSP or Proof-policy changes.

### Geographic assets and brand provenance

Leaflet 1.9.4 is locally vendored under its BSD-2-Clause terms (retained in
`tools/LEAFLET-LICENSE.txt`). Natural Earth 1:110m country polygons are public
domain: https://www.naturalearthdata.com/about/terms-of-use/. Pinned source,
npm integrity and local SHA-256 values are in `tools/web-vendor-lock.json` and
verified by the existing snapshot checker. Country outlines are coarse context,
not authoritative boundaries or routing data. No paid service, remote tiles,
third-party coordinate requests or relaxed CSP is required.

DS1 tokens remain unchanged. The header mark is now the exact owner PNG used by
Android after #7; its separate source/hash is recorded in `design-system/SOURCE.json`.
App icon derivatives retain their reviewed foundation provenance.

### Before / after evidence

Actual local Chromium captures, identical **explicit synthetic fixtures**, no
production credential. Before is merged `331e670`; after is this branch. These
are screenshots of rendered UI, not generated mockups or physical acceptance.
The device comparison shows details; the after view is scrolled to real
fixture-derived chart samples. Themes and viewport widths are in filenames.

| View | Before | After |
|---|---|---|
| Overview · 1440 dark | [before](update4-complete/before-dashboard-1440.png) | [after](update4-complete/after-dashboard-1440.png) |
| Shipments · 768 light | [before](update4-complete/before-shipments-768.png) | [after](update4-complete/after-shipments-768.png) |
| Device details/series · 390 light | [before](update4-complete/before-devices-390.png) | [after](update4-complete/after-devices-390.png) |
| Geographic map · 1024 dark | [before](update4-complete/before-map-1024.png) | [after](update4-complete/after-map-1024.png) |
| Settings · 320 light | [before](update4-complete/before-settings-320.png) | [after](update4-complete/after-settings-320.png) |

### Compact Android / Web parity matrix

| Capability | Android availability | Web availability | Source / difference / limit |
|---|---|---|---|
| Brand, theme, units and missing data | DS1, System/Light/Dark, native views | Same DS1, owner gold header, System/Light/Dark | Same semantic tokens; web sidebar/drawer differs from Android root bar |
| Node observation | Embedded read-only Minima status | No embedded node; explicit Gateway observations | Peers/recent tip are not global-sync proof; Web does not move Minima into a browser |
| Shipments/devices/events | Native Gateway client, structured details | Cards/table, bounded history, sorting/cursors/charts | Same Gateway records and source-trust labels; only loaded records are searched |
| Location | Native coordinate/route evidence | Interactive coarse map plus coordinates | Last measurement is not live movement or evidence of physical authenticity |
| Proofs | Native reported states/check/export | Same pending/submitted/included/confirmed/failed/unknown terminology, node check/export | Blockchain inclusion and physical provenance remain separate; no automatic publication |
| Pairing | Protected native credential storage and owner approval | Owner approval, HttpOnly scoped browser session | Storage models deliberately differ; origin/session expiry and server scopes remain authoritative |
| Wallet, signing, node lifecycle, biometric gate | Android host capabilities | Not browser capabilities | No new wallet/financial or direct signing interface |

### Automated coverage and manual acceptance

Targeted checks cover seven routes at 320/390/768/1024/1440 px in Light/Dark/System,
200% root text scaling, keyboard/dialog focus, bounded-record sorting and cursor
requests, browser Back/scroll retention, empty/unpaired/unauthorized/offline/expired
states and local map requests. Tests use fixture data, including zero and missing
sensor values; they do not create real tracker evidence. Map initialization and
Back-scroll failures found during development were corrected, then only affected
targeted checks were repeated. No successful full suite was repeatedly rerun.

The single final Web CI round runs all existing tests plus this coverage, the
real ephemeral PostgreSQL owner-pairing/simulator/restart/Proof integration,
static JS syntax checks and DS1/vendor checksum checks. This is a static web
application: there is no new bundler/framework build. Final run/results are
linked from the PR. Existing tests remain; only the intentional map accessible
name/role expectation changes from schematic image to geographic region.

| Remaining manual acceptance / blocker | Android | Web | Evidence boundary |
|---|---|---|---|
| Physical smartphone/tablet and OEM/IME/edge-to-edge | Pending | Pending mobile browsers | No physical test claimed; use existing PHONE_ACCEPTANCE procedure |
| TalkBack / screen reader / actual 200% browser text settings | Pending | Pending | Automated keyboard/root-font checks are not assistive-technology acceptance |
| PIN/biometric lock and protected windows | Existing Update 2/3 tests; manual pending | Not a browser biometric gate | Android is not rebuilt in this task |
| Real owner-approved HTTPS pairing, expiry/revoke | Pending controlled owner session | Pending controlled owner session | CI uses ephemeral tenant/owner only |
| Physical AOVX, battery/RAM/storage measurements | Pending | Physical-source telemetry pending | No synthetic data presented as real AOVX |
| Independent Proof verification | Manual trusted-node check pending | Manual trusted-node check pending | Configured-node HTTP verification is bounded evidence, not permanent acceptance |
| Keets/native redistribution rights and 16-KiB compatibility | Existing unresolved release blockers | Web does not resolve Android native blockers | Preserve notices and explicit blocked release policy |
| Mainnet/financial/production acceptance | Not performed | Not performed | Outside authorization; no real transaction/publication |

No implementation-blocking API changes are required for this scope. Optional
future work: full-text server search/aggregates or actual event streaming need
separate backend authorization; deeper history/pagination for each individual
shipment/device can use existing cursors in another functional update. Geographic
road-level tiles/routing are not provided by the bundled coarse map. Stop after
reviewable PR; no automatic merge or public release.
