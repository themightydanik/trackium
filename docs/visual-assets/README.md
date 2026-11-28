# Trackium visual assets

| Category | Location and rules |
| --- | --- |
| Brand | `assets/v2/brand/` contains owner-supplied marks and platform sizes. Keep the DS1 provenance and source checksums. |
| Interface and map icons | `assets/v2/map-icons.js` contains Lucide 0.468.0 icons as local SVG markup. The paths come from the upstream truck, radio, map-pin, flag, panel-left, panel-right, maximize and minimize files, plus package-open, scan-line and list-checks for D3. The wrapper adapts size and color through CSS. License notice travels with the runtime asset. [Pinned source](https://github.com/lucide-icons/lucide/tree/0.468.0/icons) · [License and Feather attribution](lucide-LICENSE.txt) |
| Functional maps | Use the existing same-origin road tiles with OpenStreetMap attribution, Natural Earth fallback and Leaflet notices. Keep map geometry independent from illustration assets. See [Fleet Map V2](../FLEET_MAP_V2.md). |
| Photography and illustration | D3 stores optimized derivative photos and micro-grain under `assets/v2/visual/`. See the [D3 asset catalog](../PREMIUM_VISUAL_EXPERIENCE_D3.md#asset-catalog-and-delivery). Group future assets by purpose. Keep creator, source URL, retrieval date, license URL and permitted transformations in a companion manifest. Check stock redistribution, attribution, trademark and recognizable-person restrictions before committing. |
| Responsive derivatives | Keep one source and document its derivative widths, format, crop and checksums. Use local WebP/AVIF and explicit dimensions or `srcset` as warranted. Supply useful alternative text for informational assets. |

Avoid remote runtime hotlinks. Add new runtime files to the appropriate serving and MiniDapp packaging policy, and retain required notices.
