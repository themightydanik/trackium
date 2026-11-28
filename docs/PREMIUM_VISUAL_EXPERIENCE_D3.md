# Trackium Premium Visual Experience D3

## Screen audit and changes

Baseline is main `dc0fe87` after D1 and D2. Existing DS1 semantic roles, brand mark, navigation, web authentication and Leaflet workspace are the foundation.

| Screen | Baseline finding | D3 treatment |
| --- | --- | --- |
| Login and account setup | The illustrated panel used a generic parcel diagram. The login form shared the same visual weight as its surrounding canvas. | A full-bleed image and an insulated form establish two clear zones. A shorter crop keeps the mobile form above the fold at normal text size. Registration and verification show a distinct warehouse photograph. |
| Overview | A flat title led into several surfaces of similar weight. | A matte header anchors the page, the KPI strip stays clean, and lifecycle and activity use distinct tonal roles next to the map. |
| Shipments | Manifest controls and planned stops were visually close to adjacent cards. | A tinted control area and an inset itinerary separate filtering, checkpoint order and record details. |
| Devices and activation | Inventory cards and the purchased-tracker form had little distinction from regular sections. | The inventory strip uses an elevated tone. A licensed scan icon introduces the existing activation instructions without implying any specific tracker model. |
| Fleet Map | Explorer, map framing and inspector used similar fills. | Explorer and map heading share a section tone. The inspector uses an elevated surface. Leaflet and its controls retain the D2 layout and data colors. |
| Events, Proofs and Settings | Dense provenance and configuration depend on predictable quiet backgrounds. | Events and Proofs inherit the new shell, with no decorative treatment on the records. The settings appearance group is elevated within the existing structure. |

## Surface language

`assets/v2/premium-surfaces.css` derives D3 surface roles from D1 tokens. Light uses cool tinted chrome, white content and a warmer highlight. Dark uses a deep navy workspace, a cooler raised chrome, and a restrained warm highlight. The same palette math responds to System or the explicit theme setting.

| Role | Application |
| --- | --- |
| App and workspace | Cool base outside the workspace and DS1 canvas within it. |
| Section and card | Tonal navigation, manifest tools, explorer and checkpoint strip. Standard panels retain a clean direct surface. |
| Elevated and highlighted cards | Slightly raised inspector, activity and inventory. A neutral warm tint marks the shipment lifecycle summary. |
| Interactive | Existing mint selected and focus-state semantics. Status colors retain their original meaning. |
| Floating and modal | Floating chrome and transient notification tones. Modal foreground remains solid with the existing dimmed backdrop. |
| Brand and presentation | The Overview header blends neutral stops with a warm edge and soft depth. Login pairs a restrained photographic tint with a solid form and atmospheric workspace background. |

One locally generated 64 px repeating micro-grain tile is restricted to the right side of the Overview header and masked out toward the text. Its maximum alpha after the layer opacity is below 3%. The login vignette is a CSS overlay on photography only. Use subdued editorial photography with moderate saturation and natural light. Reserve full-bleed images for public entry and setup. Use familiar line icons or functional empty-state pictograms in workspaces. Keep brand photography and texture away from Leaflet, routes, coordinates, telemetry history, metrics, dense tables, text fields, critical notifications and proofs.

## Asset catalog and delivery

| Asset | Provenance | Treatment |
| --- | --- | --- |
| Container terminal | Samuel Wölfl. [Original on Pexels](https://www.pexels.com/photo/intermodal-container-stacked-on-port-1427541/) | Login and recovery. 4:3 derivatives with a compact mobile crop and muted saturation. |
| Warehouse operations | Tiger Lily. [Original on Pexels](https://www.pexels.com/photo/men-working-in-a-warehouse-4481259/) | Registration and verification. 4:3 derivatives and the same restrained color treatment. |
| Empty-state and activation pictograms | Lucide 0.468.0 `package-open`, `list-checks` and `scan-line`. [Pinned source](https://github.com/lucide-icons/lucide/tree/0.468.0/icons) · [License and notice](visual-assets/lucide-LICENSE.txt) | Local SVG paths using the existing Lucide renderer. Reserve larger treatments for instructional or empty content. |
| Matte micro-grain | Trackium-authored deterministic raster. No third-party source. | One lossless WebP tile on the Overview header. |

Pexels lists both images as free to use under its photo license. Commercial use and editing are permitted. Attribution is optional and recorded here. The images are integrated into the product with no suggestion of endorsement. No originals or standalone stock download links ship in the app. [Pexels license](https://www.pexels.com/license/)

Each screen requests at most one photo variant. The intrinsic dimensions and reserved photo panel prevent image decoding from reflowing the form. The eager, high-priority photo is visible at entry. No runtime request is made to an external image host. There are no offscreen product photos or new animation dependencies. The four variants and texture total 218,366 bytes. A 320 px 1× viewport requests the 27–28 kB derivative, while the desktop viewport requests a 74–87 kB variant. All assets are explicitly allowlisted and served with their WebP MIME type.

```text
75e29cfd09cc1c5cf7a10604263d7d471e46db93fc7a9e5bf4113c3843681310  matte-grain.webp
88fa001ab0081089ac86b8c319b8390619fb365b42196bc0b7e4bef3f8df7be3  terminal-480.webp
abfc5a1ae3a6651429eaba2d0433622401a149397350535837e277ee01424d8c  terminal-960.webp
c8ada94ef5b226df4398f832be63c8aa4bb37d41544a5ee4bc57c220e24b37fe  warehouse-480.webp
9ace581ded941bb6f5caedb68d9bd4e6af7625f0d0764826997ec6d755b2ed89  warehouse-960.webp
```

## Browser evidence

Chromium captures use isolated, explicitly synthetic workspace data and a local Gateway web handler for login and registration. Each comparison uses the same viewport, theme and fixture. Mobile captures come from Chromium, with physical Android WebView acceptance separate.

| Screen | Desktop Light | Desktop Dark | Mobile Light | Mobile Dark |
| --- | --- | --- | --- | --- |
| login | [1440](premium-d3/after/login-1440-light.webp) | [1440](premium-d3/after/login-1440-dark.webp) | [390](premium-d3/after/login-390-light.webp) | [390](premium-d3/after/login-390-dark.webp) |
| dashboard | [1440](premium-d3/after/dashboard-1440-light.webp) | [1440](premium-d3/after/dashboard-1440-dark.webp) | [390](premium-d3/after/dashboard-390-light.webp) | [390](premium-d3/after/dashboard-390-dark.webp) |
| devices | [1440](premium-d3/after/devices-1440-light.webp) | [1440](premium-d3/after/devices-1440-dark.webp) | — | — |
| shipments | [1440](premium-d3/after/shipments-1440-light.webp) | [1440](premium-d3/after/shipments-1440-dark.webp) | — | — |
| map | [1440](premium-d3/after/map-1440-light.webp) | [1440](premium-d3/after/map-1440-dark.webp) | — | — |
| events | [1440](premium-d3/after/events-1440-light.webp) | [1440](premium-d3/after/events-1440-dark.webp) | — | — |
| proofs | [1440](premium-d3/after/proofs-1440-light.webp) | [1440](premium-d3/after/proofs-1440-dark.webp) | — | — |
| settings | [1440](premium-d3/after/settings-1440-light.webp) | [1440](premium-d3/after/settings-1440-dark.webp) | — | — |

| Comparison | Before | After |
| --- | --- | --- |
| Login, desktop Light | [D2](premium-d3/before/login-1440-light.webp) | [D3](premium-d3/after/login-1440-light.webp) |
| Overview, desktop Dark | [D2](premium-d3/before/dashboard-1440-dark.webp) | [D3](premium-d3/after/dashboard-1440-dark.webp) |
| Shipments, desktop Light | [D2](premium-d3/before/shipments-1440-light.webp) | [D3](premium-d3/after/shipments-1440-light.webp) |

Additional evidence includes [registration photography](premium-d3/after/registration-1440-light.webp) and the [Overview empty state](premium-d3/after/empty-1440-dark.webp).

## Verification

Nine targeted Chromium tests passed. The existing route test covers five viewport widths from 320 to 1440 px, 200% text, manual and System themes, focus, and horizontal fit. The new test uses the Gateway web asset handler. It checks the mobile and desktop photo URLs, valid WebP responses, the asset allowlist, stable form coordinates while the image is delayed, registration imagery, keyboard focus, accessibility at 200% text, and reduced-motion emulation. DS1 button contrast is 5.54:1 in Light and 10.83:1 in Dark. Secondary text against the least favorable Overview gradient stop is 5.59:1 in Light and 6.49:1 in Dark, before the subtle grain layer. Focus ring contrast on the form surface is 6.49:1 and 8.04:1 respectively.

```sh
node --test tests/minidapp/design-system.test.cjs tests/minidapp/complete-ux.test.cjs
python3 scripts/package-minidapp.py /tmp/trackium-premium-d3.mds.zip
```
