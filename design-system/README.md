# Design System 1.0 presentation snapshot

Canonical source: https://github.com/themightydanik/trackium-core-android/tree/feat/design-system-1-foundation/design-system . This folder is JSON/provenance only, not an Android project or an independent business-logic implementation.

SOURCE.json records the reviewed canonical commit, token SHA256 and every generated Web asset hash. tools/check-design-system.py verifies the snapshot offline. Do not edit generated CSS/PNG by hand or auto-fetch a moving source during production builds; update the canonical source and review both repository PRs.

The owner original wordmark remains in assets/img/logo.png and its source SHA is checked. All source proportions, crossings, gradient and alpha are retained by the crop/resize pipeline. No approximate SVG tracing or AI logo generation is used. Root legacy icon.png and legacy runtime files are not rewritten.

See docs/UI_IMPLEMENTATION_PROGRESS.md for staged activation, theme limitations and test status.
