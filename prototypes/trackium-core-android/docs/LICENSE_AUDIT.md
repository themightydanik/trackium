# Keets and native dependency licence audit — 2026-11-08

**Public-release blocker remains open.** This is a source/evidence review, not legal clearance. Build success, a permissive npm licence field and a valid checksum are different facts. Technical debug artifact generation does not resolve incomplete distribution rights or notice obligations.

## Evidence and scope

| Item | Pinned evidence | Finding |
| --- | --- | --- |
| Keets source | `b99bce1bf0c558061f3444deadf853ef5f60147c`, archive SHA256 `a49fa66960599c81db472a231ae19f23e8cb7a9a9f7bad12628e9e5753afc9e9` | No licence/NOTICE/COPYING files found anywhere in the pinned source archive. **sidecar/package.json declares MIT**, so absence of a root LICENSE alone must not be misreported as absence of any licence declaration. Grant scope, original notices and attribution still need clarification. |
| Keets sidecar lock | Captured `UPSTREAM_NOTICES/keets-sidecar-package-lock.json`, SHA256 `87d948ba4cb73c6bf5b18b50933ea37bcbb1fe6dc0def6b80d267e2192d143ae` | 115 package instances including root: 55 Apache-2.0, 54 MIT, 6 ISC declarations. Zero missing licence fields. This is metadata, not a full vendored-C/binary inventory. |
| Native addons | 21 distinct package/version pairs shipped for each of the three ABIs | Matched every ARM64 addon name/version against the pinned sidecar lock; downloaded each exact npm tarball, verified SHA512 SRI, collected its actual licence file without executing package scripts. 21/21 have captured legal files and match lock metadata. |
| Bare Kit runtime | `v2.5.5`, prebuild ZIP SHA256 `fc68740347c8532ba49d45bf61fae9ca1f1040dc7d6c99f2f92dc30c40e84e46` | Exact-tag root Apache-2.0 licence retained. The prebuild ZIP/AAR contains no complete legal inventory/NOTICE for all linked native components. Tag-object pin and legal-text hash are in license-evidence-pins.json. |
| Native transitive components | libsodium/libuv/V8/ICU/libc++ are examples needing actual build-linkage verification, not assumed complete contents | npm addon licence does not automatically cover bundled C/C++ code. Need exact source revisions, build provenance, applicable copyright/NOTICE texts and mapping to each binary; avoid claiming every ELF shares the package's licence. |
| Host/node/History/SDK | Original root Apache-2.0 text, untouched copyright notices and source pins | Preserved. The copied code does not imply a trademark grant or official Minima release. |
| Trackium code | Owner-requested reuse from pinned repository without a top-level distribution licence | Obtain explicit project distribution terms before a separate public release. Owner-authorized development is not a blanket third-party relicensing grant. |

The two sodium-native versions declare MIT; the other 19 captured native package/version instances declare Apache-2.0. Their licence texts and hashes are stored under `UPSTREAM_NOTICES/licenses/npm/` and `native-license-evidence.json`. That evidence captures package-level text; it is intentionally not labelled a complete native SBOM. Build-tool npm dependencies are separate: 56 Apache-2.0 and 5 MIT declared dependencies plus an unlicensed private root tool manifest; build tools are not automatically runtime code.

## Enforced checks

`check-source-manifests.py` checks the original root licence checksum, four source commit pins, immutable Eurobuddha JAR, wrapper/script/download/checksum manifests and copied engine regression hashes. Gradle still verifies all generated Keets/native outputs and packaged ELF bytes.

`check-licenses.py` checks the captured source-lock hash against the original Keets pin, npm HTTPS/SRI structure, the sidecar MIT declaration, complete 21-addon coverage, declared licence/URL/version/SRI equality to the pinned lock and checksums of every collected legal text. CI emits `license-audit.json` with **release_blocked=true**. This is a debug evidence check; known unresolved rights do not get silently relabelled PASS/cleared.

```sh
python3 scripts/check-licenses.py --output dist/license-audit.json
python3 scripts/check-licenses.py --release  # intentionally fails while blockers remain
```

Regression tests verify corrupted/missing legal evidence and unsafe paths are rejected and release mode refuses unresolved rights. No workflow creates a GitHub Release or production-signed APK.

## Close-out criteria

The tracked `UPSTREAM_NOTICES/release-blockers.json` is authoritative for the current unresolved items. Close a blocker only with linked original-licensor evidence, captured notices, exact binary/source attribution and a documented reviewer decision. Required work includes:

- Clarify the Keets sidecar MIT grant's scope and original copyright/notice text; retain them alongside the derived work.
- Obtain/construct an accurate native binary-to-source and transitive licence/NOTICE inventory for Bare Kit and each addon build, including any relevant exceptions/attribution requirements.
- Confirm repository owner's explicit distribution terms for Trackium-derived files and compatibility with the imported Apache components.
- Re-review any rebuilt/replaced native artifact together with checksum pins, key safety, Android compatibility and its licence evidence.

Do not remove the blocker because the APK builds, npm metadata looks permissive, CI is green, or a phone smoke test succeeds. See REUSE_AND_ENGINE_REVIEW.md for host/engine provenance and the explicit retained limitations.
