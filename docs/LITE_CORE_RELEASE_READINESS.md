# Lite and Core pilot release gate

Gateway and Lite baseline is `c57a5e4ee94a153b05ba953c824858ee76b3c1f8` after PR #104. Core baseline is `dd8c938ea62402d3546e8d5b707568d9ca82e6ec` after PR #13. Activation inventory is migration 018. Device installations, signed-request nonces and connection codes are migration 019. The release preflight in this PR adds no schema changes.

## Evidence and open gates

| Gate | Evidence or required action |
|---|---|
| Public Gateway and routing | Existing Production returned HTTP 200 for `/readyz`, `/readyz/routing` and `/app/connect-core` on 26 November 2026. This public check does not expose the live feature flags, migration checksums or inventory. |
| Android App Links | Production returned 404 for `/.well-known/assetlinks.json`. The merged Gateway already serves it when the web workspace, Core device access and the approved certificate fingerprint are configured. Verify the actual Railway values privately. |
| AOVX binding | Keep the current TCP proxy and raw journal. For an already enrolled tracker, verify the printed serial and current physical binding, then use the protected inventory adoption procedure if needed. Adoption issues no activation code and preserves history. |
| Access controls | Verify one-time claim and QR consumption, key binding, owner fingerprint match, revoke, and isolated access in the pilot. A website grant is pending until owner approval. View Only can read observations and has no server routing or device-management permission. Full Access adds scoped routing. |
| Core-first to Lite | PR #105 requires security decisions for link-derived permissions, challenge binding, revocation and transaction order. It is outside the initial rollout. |
| Physical telemetry | Known field position discrepancy remains open with AOVX. Treat the actual device's positions as unverified evidence. The intentionally removed SIM explains the absence of recent packets. |

## Controlled Railway rollout

1. Obtain operator approval for deployment and verify the exact image, Railway HTTPS host, private PostgreSQL settings, AOVX proxy, binding and current application flags in the existing service. Confirm CI for the reviewed commits and retain the previous image. Verify an approved backup and test restoration on disposable PostgreSQL. Record existing migration checksums, inventory and custody journal counts privately.
2. Start the reviewed Gateway with both `DEVICE_ACTIVATION_ENABLED=false` and `CORE_DEVICE_ACCESS_ENABLED=false`. Verify migrations 001–019 and the readiness endpoints. Use the deployed origin as `PUBLIC_ORIGIN`, matching the Core App Link host. Preserve the existing TCP ingress, routing and proof policies.
3. Inspect the exact continuity-signed Core APK using `bash services/gateway/scripts/check-core-app-links.sh CORE.apk`. Set the printed `CORE_ANDROID_CERT_SHA256` value only after verifying the chosen release APK. For the current pilot signing identity the value is `3B:D1:6A:81:42:93:E6:F9:A2:39:DA:17:84:5C:67:93:64:DA:64:A2:44:92:23:B9:F1:1F:8D:EA:8B:9C:D2:B2`. GitHub Actions review APKs use an ephemeral signing identity. Keep the production value tied to the distributed pilot APK.
4. Use the approved physical pilot binding. If necessary, adopt its exact active binding using the existing operator runbook in [Device activation](DEVICE_ACTIVATION.md). Confirm the inventory and tenant before enabling access. Leave unused production stock unavailable during the restricted smoke test. Enabling `CORE_DEVICE_ACCESS_ENABLED=true` also enables Core-first claims of valid unused inventory cards, independently of the Lite flag.
5. Enable Core access and run the App Links preflight with `--check-live`. Require direct HTTPS 200, JSON, exact package and exact signing certificate. Smoke-test signed Core do/deny cases and owner revocation. Verify QR fallback and Android domain verification before exposing any release URL. Test the existing device with no current SIM connection.
6. Enable `DEVICE_ACTIVATION_ENABLED=true` when ordinary customer activation is approved and customer accounts are configured. The closed demo uses its existing restricted pilot controls. Confirm that ordinary activation stays unavailable to demo viewers and non-owners. Publish APK download URLs only after separate authorization and after checking public availability and signing continuity.

## Rollback

Turn the affected flags off before changing the running image. This closes the corresponding access surface while keeping QR, installation and ownership records. Pending links can expire naturally. Reconcile outstanding grants and revocations before re-enabling because old authorizations are retained. If reverting to a binary predating inventory-aware custody, suspend custody changes while it is running. Keep migrations 018 and 019, packet journal, prior packet links, grants and audit history. Do not drop tables or restore an old snapshot as a routine binary rollback. A database restore can lose subsequent operations or resurrect an earlier access state. Verify recovery privately and reconcile claims, custody and revocations before reopening access.

## Phone acceptance with the SIM still removed

1. Verify package IDs, version codes and certificate fingerprints for both pilot APKs. Install with `adb install -r PATH.apk` over the previous pilot installations and retain app data. An incompatible signature is a stop condition.
2. In Lite Web and Lite Android, sign in to the approved company and open the existing physical device. Compare the device list, last-received time, UTC measurement time, stale position and packet/observation references. Expect no fresh GPS and no new TCP sample during this session.
3. Independently unlock Core. Generate a fresh View Only QR in Lite and scan it in Core. Check that no observation access exists before owner confirmation. Compare the fingerprint shown on the receiving Core screen, approve it in Lite and verify the same device and authorized history. Confirm router requests are denied, and try another company's device and the already-used QR.
4. Revoke that installation in Lite and verify subsequent requests fail closed. Generate a distinct Full Access grant and verify the same scoped observations plus official B2 road routing when configured. Keep Core plans and Minima identity local.
5. Repeat with a fresh connection link. On Android run `adb shell pm verify-app-links --re-verify tech.trackium.core.prototype`, wait for verification, then run `adb shell pm get-app-links tech.trackium.core.prototype`. Require the Railway host to be verified and the exact connection path to open the installed Core app. QR or manual paste can exercise the grant while domain verification is being resolved. Avoid placing a live one-time link in shell history.
6. Check network loss, resume and a restart. Previously seen positions can be shown as stale, while missing data stays unknown. Check local Core access and Minima identity still work without a website login.

The phone checks above verify integration, upgrade and stale-data behavior. Physical GPS acceptance remains separate. There is no need to reinsert the SIM for this sprint.

## AOVX vendor questions

- Confirm the exact device model, firmware coordinate and time field layout, scale and hemisphere semantics for the supplied real frames.
- Explain why the real-time frame's coordinate fields decode to a different geographic region while its base-station data indicates Ukraine.
- Explain future-dated BCD times in the buffered frames and the meaning of the reserved assistant time fields for this firmware.
- Confirm whether a reported fix can be retained from previous firmware state, another source or another time, and how to distinguish it using documented fields.

Keep the original incident export private and retain the baseline comparison. Keep decoding and custody logic unchanged until independently verified evidence justifies a change.
