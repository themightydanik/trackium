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
