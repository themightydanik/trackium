# Trackium Premium Experience D1

## Interface audit

| Surface | Existing implementation | Finding and D1 response |
| --- | --- | --- |
| Lite Web | `index.html`, `appearance.js`, `cargo.css`, and the server workspace and customer UI renderers. Fleet Map is the initial company screen. Overview, Shipments, Devices, Events, Proofs and Settings use the same shell, with a compact mobile navigation. | DS1 colors were already available, but headings, surface depth, control states and spacing came from overlapping CSS rules. Metrics competed with the map in four nested tiles. Overview now puts a compact metric band first and pairs the map with shipment lifecycle and activity. Operational counts and actions use the existing snapshot. |
| Lite Android | `apps/lite-android/…/MainActivity.kt` loads the hosted Lite workspace. The Activity owns system insets, trusted-origin navigation, recovery and the export picker. | The same web components cover the normal Android workspace. The native recovery screen and system picker remain independently styled. D1 adds no APK-specific layout or navigation. |
| Core Android | Canonical repository at `dd8c938ea62402d3546e8d5b707568d9ca82e6ec`. The native `MainActivity` uses a section Spinner, vertical ScrollView, optional host navigation and local DS1 color resources. `ThemePreference` resolves the UI mode. | The palette already aligns with Lite. Selectable labels, repeated vertical cards, full-width actions and a native dropdown make hierarchy and density feel different. The native label helper also couples bold type with accessibility-heading semantics. A future native component pass can align visual roles and annotate actual headings independently while keeping the host and native map. |

## Design contract and reuse

The generated `assets/v2/design-tokens.css` snapshot remains the web mapping of the canonical Core `design-system/tokens.json`. `assets/v2/lite-design-system.css` consumes those roles within `.lite-workspace`. It supplies component-level density, text hierarchy and elevation. Native resources can map the same roles to sp, dp and Android elevation. The old MiniDapp and native Core retain their own presentation scope.

| Component | Shared treatment | Android reuse |
| --- | --- | --- |
| Typography and rhythm | Display/title roles, label/body secondary text, token-based spacing and tabular metrics. | WebView inherits. Core can map heading roles to text appearances with user font scaling. |
| Actions and fields | Primary/secondary hierarchy, touch targets, focus, disabled, invalid and hover states. | WebView inherits. Native button and input helpers can adopt the same roles, keeping the native 48 dp target. |
| Cards, tables and status | Outline and elevation by surface role, stronger table headers, focused rows and semantic status pills. Text remains visible alongside status color. | Core can reuse surface and status roles in its cards and stack records on narrow screens. |
| Navigation and account | Active state, tokenized spacing and press targets. Existing mobile navigation, account, sign-in and dropdown behavior remain in use. | WebView inherits. Core can map equivalent selected states onto its native navigation. |
| Dialogs, notifications and feedback | DS1 elevation, a dimmed modal backdrop, status bands, loading and empty treatments, reduced motion. Empty panels use the domain icon for the section. | Use native dialogs, transient messages and live-region equivalents. Preserve platform focus and Back behavior. |

The web pass uses the existing owned brand assets and section icons. Light, Dark and System use the same token values as DS1. Explicit theme selection also sets the browser color scheme for native form widgets. No third-party visual assets or runtime dependencies were added.

## Browser evidence

Screenshots use the existing local browser fixture in an authenticated test workspace with synthetic labels and provenance. The login captures use the actual Gateway web asset handler with a local unauthorized response. They contain no Production account or device information. The mobile captures are Chromium viewports, with native Android rendering and insets reviewed from source only.

| Screen | Desktop Light | Desktop Dark | Mobile Light | Mobile Dark |
| --- | --- | --- | --- | --- |
| dashboard | [1440](premium-d1/dashboard-1440-light.webp) | [1440](premium-d1/dashboard-1440-dark.webp) | [390](premium-d1/dashboard-390-light.webp) | [390](premium-d1/dashboard-390-dark.webp) |
| shipments | [1440](premium-d1/shipments-1440-light.webp) | [1440](premium-d1/shipments-1440-dark.webp) | — | — |
| devices | [1440](premium-d1/devices-1440-light.webp) | [1440](premium-d1/devices-1440-dark.webp) | [390](premium-d1/devices-390-light.webp) | [390](premium-d1/devices-390-dark.webp) |
| map | [1440](premium-d1/map-1440-light.webp) | [1440](premium-d1/map-1440-dark.webp) | [390](premium-d1/map-390-light.webp) | [390](premium-d1/map-390-dark.webp) |
| events | [1440](premium-d1/events-1440-light.webp) | [1440](premium-d1/events-1440-dark.webp) | — | — |
| proofs | [1440](premium-d1/proofs-1440-light.webp) | [1440](premium-d1/proofs-1440-dark.webp) | — | — |
| settings | [1440](premium-d1/settings-1440-light.webp) | [1440](premium-d1/settings-1440-dark.webp) | — | — |
| login | [1440](premium-d1/login-1440-light.webp) | [1440](premium-d1/login-1440-dark.webp) | [390](premium-d1/login-390-light.webp) | [390](premium-d1/login-390-dark.webp) |

Local verification uses `node --test tests/minidapp/design-system.test.cjs tests/minidapp/complete-ux.test.cjs` with Chromium and Playwright. It covers the main routes at five viewport widths, Light/Dark/System, 200% text, keyboard actions, absence of page overflow, sign-in and connection states, and client behavior after session expiry. Calculated DS1 contrast for Light/Dark is 5.54:1 / 10.83:1 for primary button text, 6.47:1 / 7.88:1 for secondary text on a surface, and 6.49:1 / 8.04:1 for the focus ring against a surface. Build the MiniDapp archive with `python3 scripts/package-minidapp.py /tmp/trackium-premium-d1.mds.zip`.

## Fleet Map V3 follow-up

1. Prototype a map-first desktop workspace with a fleet list and an inspectable selection. Validate list selection, map focus and route editing from the same context.
2. Prototype a mobile bottom sheet with collapsed and expanded states. Test safe areas, map gestures, keyboard navigation and sheet focus on a physical Android device.
3. Retain a single Leaflet instance and map camera ownership. Keep planned checkpoints, calculated routes and eligible observations visually distinct. Reuse B2/B3 contracts, permissions and polling.
4. Validate road-tile fallback, loading and empty states with existing map fixtures. Compare visual hierarchy and responsiveness in both themes and verify map use with representative fleet sizes.
