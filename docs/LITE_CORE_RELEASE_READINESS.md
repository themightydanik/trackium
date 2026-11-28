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

Turn the affected flags off before changing the running image. This closes the corresponding access surface while keeping QR, installation and ownership records. Unused QR codes expire after five minutes. A code that has already been redeemed becomes a pending installation, which has no automatic expiry. Approved grants also persist. Before reopening, have the verified company owner reconcile pending and approved installations, revoke unexpected requests and never approve an old request without rechecking its fingerprint. If there are unverified approved grants and reconciliation requires the owner API, stop. The Core flag is global and can reactivate those grants before reconciliation. Obtain an approved restricted recovery procedure before reopening. If reverting to a binary predating inventory-aware custody, suspend custody changes while it is running. Keep migrations 018 and 019, packet journal, prior packet links, grants and audit history. Do not drop tables or restore an old snapshot as a routine binary rollback. A database restore can lose subsequent operations or resurrect an earlier access state. Verify recovery privately and reconcile claims, custody and revocations before reopening access.

## Operator preflight and stop conditions

Do these read-only checks from an authorized infrastructure session before changing anything:

1. In Railway, select **Production → Gateway**. Record the running deployment ID, source commit, health check, current image and prior rollback candidate. Confirm whether GitHub merges and applying staged variable changes trigger deployments. Check the existing TCP Proxy target without changing it.
2. In **Variables**, privately confirm `ENABLE_WEB_WORKSPACE=true`, record the booleans for `CORE_DEVICE_ACCESS_ENABLED` and `DEVICE_ACTIVATION_ENABLED`, and compare `CORE_ANDROID_CERT_SHA256` to the value printed by the APK check. Record only booleans, presence and match results. Check that `PUBLIC_ORIGIN` matches the APK manifest's HTTPS origin. A live connection page with HTTP 200 and a statement with HTTP 404 is compatible with either an off Core flag or a missing/empty fingerprint on this Gateway. If all three prerequisites match, inspect the live revision and routing before enabling anything.
3. On the approved read-only PostgreSQL connection, record the migration checksums and restricted inventory counters. Compare each checksum to the exact reviewed Gateway image. Keep binding and journal evidence private.

   ```sql
   BEGIN READ ONLY;
   SELECT version, checksum FROM gateway_schema_migrations ORDER BY version;
   SELECT count(*) AS immediately_claimable_cards
     FROM device_activation_inventory
    WHERE claimed_at IS NULL AND activation_sha256 IS NOT NULL;
   SELECT count(*) FILTER (WHERE approved_at IS NULL) AS pending_installations,
          count(*) FILTER (WHERE approved_at IS NOT NULL) AS approved_installations
     FROM core_device_installations
    WHERE revoked_at IS NULL;
   ROLLBACK;
   ```

4. **Stop before enabling either claim surface** if any currently valid unused card is outside the approved pilot. The flags are deployment-wide, and Core-first claim requires no Lite account. Test on previously approved inventory or obtain explicit approval for every usable card. Zero claimable cards is the gate for an existing-ownership-only pilot. Check pilot ownership and the exact active physical binding in the protected operator inventory.
5. Run the public probes and keep their status codes as evidence. The preflight is read-only and intentionally fails while the statement is unavailable.

   ```sh
   origin=https://trackium-gateway-production.up.railway.app
   for path in /readyz /readyz/routing /app/connect-core; do
     curl --fail --silent --show-error --max-time 12 --output /dev/null \
       --write-out "$path %{http_code}\n" "$origin$path" || exit 1
   done
   bash services/gateway/scripts/check-core-app-links.sh CORE.apk
   bash services/gateway/scripts/check-core-app-links.sh CORE.apk --check-live
   ```

After separate authorization, apply the staged reviewed variables in **Production → Gateway → Variables**, starting with both flags false. Deploy the already reviewed commit through the existing service and verify the gates above. Enable only the approved flag at each step. For rollback, stage and apply both flags false first. Verify the deployment is healthy and the Core claim route and App Links statement return 404. If a binary rollback is required, select the reviewed prior deployment in Railway and verify the flag values again after rollback. If the previous deployment is restored with earlier variable values, explicitly verify the requested off settings before reopening traffic. Use an inventory-aware rollback image that understands migrations 018–019 whenever possible. Keep custody operations paused if using an older image. Production variable changes, deployment, inventory changes and rollback each require operator authorization.

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
