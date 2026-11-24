# Trackium Lite Premium UI

Issue #85 builds on Update 4 and uses the approved Trackium mark, generated DS1 tokens and current authenticated Gateway workspace. The presentation layer is scoped to Lite. Navy surfaces and gold company and route accents complement the existing mint primary actions. The System, Light and Dark preferences still use DS1. No API, migration, proof rule, map vendor, remote tile dependency or credential flow changes.

## Before and after

Chromium renders the same disposable PostgreSQL pilot workflow against the baseline `11820d0` and the updated Lite. Screens show the closed username sign-in and a promoted pilot Owner with a specifically enrolled physical registry record that has no decoded telemetry. The screenshots use dark mode. They contain only local fixture identifiers and no account credentials or production telemetry. Clock displays and fixture-generated IDs can differ between captures.

| Screen | Width | Before | After |
| --- | ---: | --- | --- |
| Sign-in | 390 | [Before](lite-premium/before/login-390.webp) | [After](lite-premium/after/login-390.webp) |
| Dashboard | 1440 | [Before](lite-premium/before/dashboard-1440.webp) | [After](lite-premium/after/dashboard-1440.webp) |
| Shipments | 1024 | [Before](lite-premium/before/shipments-1024.webp) | [After](lite-premium/after/shipments-1024.webp) |
| Devices | 768 | [Before](lite-premium/before/devices-768.webp) | [After](lite-premium/after/devices-768.webp) |
| Physical Device Lab | 390 | [Before](lite-premium/before/device-lab-390.webp) | [After](lite-premium/after/device-lab-390.webp) |
| Geographic map | 1440 | [Before](lite-premium/before/map-1440.webp) | [After](lite-premium/after/map-1440.webp) |
| Events | 768 | [Before](lite-premium/before/events-768.webp) | [After](lite-premium/after/events-768.webp) |
| Proofs | 1024 | [Before](lite-premium/before/proofs-1024.webp) | [After](lite-premium/after/proofs-1024.webp) |
| Settings | 320 | [Before](lite-premium/before/settings-320.webp) | [After](lite-premium/after/settings-320.webp) |

The Chromium suite also exercises populated shipment/route editing, authentic fixture and synthetic history, Leaflet interactions, filters and cursors, diagnostics and export, Integritas TEST_ONLY verification, notifications, pairing, logout and native proof UI. Scoped CSS and navigation leave the existing Core surface available.

To capture updated evidence locally, point `TEST_DATABASE_URL` at disposable PostgreSQL, create the output directory and set `TRACKIUM_PREMIUM_SCREENSHOTS` to its absolute path. Use the project's Playwright installation with:

```sh
node --test --test-name-pattern='Closed demo preserves' tests/minidapp/server.integration.cjs
```

## Acceptance walkthrough

1. Sign in to the approved HTTPS Lite origin with the promoted pilot account. Confirm the company and role in Settings and the expected device in Devices. The closed login still uses Username and authenticated browser sessions.
2. With no fresh packets, confirm the device shows no decoded telemetry if history is empty. Only actual device reports establish device status. In Device Lab use Read now to distinguish last packet receipt and last device measurement. A transferred tracker with no accepted observations shows no position and empty history. Previous tenant observations must remain absent.
3. Check map pan, zoom, attribution and keyboard controls. Gold dashed lines show planned routes. Mint points show eligible reported positions. Older retained fixes carry a separate age label. Missing positions do not create markers. Load a UTC period in the lab and confirm JSON support export retains its existing coordinate opt-in.
4. Open Shipments, create a draft if authorized, edit stops and confirm cancellation prompts. Check loaded-page filters and pagination. Verify Events show their origin and timestamps, and outbox delivery remains distinct from proof status.
5. Check Lite Integritas TEST_ONLY verification and export in a tenant with test evidence. Core retains its native workflow. No local UI assertion establishes on-chain confirmation.
6. At 320, 390, 768, 1024 and 1440 px, check focus, drawer keyboard escape and navigation, the mobile quick bar, 200% text and System/Light/Dark. Confirm controls remain reachable with reduced motion. Sign out and verify no company content remains.

The live pilot tenant, physical GL110-GL with no SIM, screen readers and an actual mobile device have not been inspected in this task. The no-fresh-data state is covered locally before and after an authorized test transfer without fabricating a packet. Actual receiver activity and SIM state are outside what the UI can infer.
