# Codex project instructions — Trackium Gateway and MiniDapp

## Canonical repository and scope

Canonical backend / web repository: **https://github.com/themightydanik/trackium**.
These instructions apply throughout this repository; read any applicable nested
instructions before editing. Preserve existing instructions when updating them;
explicit user task/session instructions take precedence.

Develop here:

- Railway Gateway, PostgreSQL and REST API.
- Devices/AOVX, shipments, telemetry and events.
- Proof records, server publication policies and access control.
- The current web MiniDapp and its Gateway integration.
- Gateway authentication and owner approval.

The existing Gateway lives in `services/gateway/`; the current MiniDapp entry is
`index.html` with `assets/v2/` and its runtime dependencies. Inspect the actual
serving routes, imports and tests before changing an API or web entry point.
Do not confuse the current web workspace with a native Android Activity.

## Android boundary

Canonical Android repository:
**https://github.com/themightydanik/trackium-core-android**.
It is the only current repository for Trackium Core Android. Its
[project instructions](https://github.com/themightydanik/trackium-core-android/blob/main/AGENTS.md)
define Android ownership.

The custom Minima Core host, integrated native Trackium, Android UI/UX/navigation,
branding/adaptive icons/themes, native Gateway client integration, Android
security/tests and APK builds belong there.

**Do not create or develop the current Android application in this repository.
Do not treat `apps/android` as the current app. Do not recreate or move Android
Core into `prototypes/trackium-core-android`.** Read the canonical Android
repository for current native client behavior and API consumers.

Historical `legacy.html`, `local-core.html`, `apps/android` and any prototype
copies are provenance/compatibility material, not the current Android Core
architecture. Do not assume they are unused, and do not delete them automatically.
Before any authorized cleanup, identify active imports, links, serving and
packaging paths, consumers, tests and compatibility dependencies. Historical
presence is not permission to resume Android development here.

## Cross-repository tasks

1. Identify the actual files, API contracts and consumers affected before editing.
2. Inspect the other repository when necessary, but leave it unchanged if reading
   its contracts or documentation is sufficient.
3. Avoid duplicated business logic. Keep server-owned validation, authorization
   and publication policy authoritative; do not move them into an Android client.
4. For each repository that needs changes, use its own branch and pull request.
5. State cross-repository dependencies, compatibility assumptions and rollout
   order explicitly in the PR descriptions. Coordinate additive API changes
   before consumers when required; do not assume a fixed order for every task.
6. Never merge PRs automatically.

## Safety and compatibility

- Preserve existing Minima, wallet and one-time key-use/signing guarantees at
  integration boundaries. Do not weaken client/node security for API convenience.
- Preserve Gateway authentication, owner-approved pairing, Proof publication
  guards, tenant isolation and access control. Do not bypass approval or expose
  administrative provisioning through an unauthenticated public endpoint.
- Do not enable Mainnet publication without separate, explicit authorization.
  A UI change, successful build, test deployment or previous test approval is
  not authorization for real transactions/publications.
- Keep synthetic, simulated, unverified, stale and physically observed telemetry
  distinguishable. Never present fixtures as real device/AOVX data or claim
  chain inclusion proves physical sensor authenticity.
- Do not commit or expose seeds, private keys, production credentials, keystores,
  owner/session tokens or wallet data in logs or public artifacts. Use disposable
  test data for authorized tests; do not migrate working wallets implicitly.
- Preserve applicable licences, provenance/checksums and documented safety or
  release blockers. Do not disable TLS, auth or security checks to pass a test.

## Validation and reporting

Use the existing Gateway/MiniDapp scripts and tests appropriate to the changed
files and contracts. Run relevant checks; an instruction-only edit does not need
new runtime tests. Report exactly what ran and distinguish static/source review,
fixtures, browser tests, real Gateway deployment and physical AOVX/Android tests.
Do not claim operational acceptance from mocks or CI alone. Keep runtime changes
and historical-source removal out of documentation/instruction-only tasks.
