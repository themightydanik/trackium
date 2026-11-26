# GL110-GL field pilot with Lite and Core

## Install and connect both applications

After approval of the Lite deployment, open the approved Railway HTTPS origin in Lite Web or install the matching signed Android APK. On a test phone use Android’s package installer, or `adb install trackium-lite-field-debug.apk` and `adb install trackium-core-field-debug.apk`. Compare package, versionCode, certificate and SHA-256 with the build manifest. Update in place only if the installed signing identity is compatible. Use a separate test phone if signatures differ. Preserve any existing Core wallet data.

Lite uses the Railway browser workspace and its existing session. Core uses its independent native app. In Core configure the separately operated road provider under **Settings → Open independent field map → Configure independent road provider**, enter the HTTPS origin, dedicated account and pinned graph ID, then import the scoped offline GeoJSON. Test with a known route before pairing the physical device. [Core provider setup](https://github.com/themightydanik/trackium-core-android/blob/feat/core-field-map/docs/FIELD_TRACKING.md)

## Before inserting the SIM

1. Check the exact GL110-GL modem/firmware and carrier band support. Activate a data SIM, test its data plan, and confirm roaming and SIM PIN requirements with the carrier and tracker manual. Obtain the exact APN and any authentication from the carrier. Use the firmware-matched AOVX configuration tool or approved vendor procedure; no SMS or remote device commands are needed here.
2. Have the operator confirm the existing AOVX TCP proxy and its external hostname and port on the intended Gateway. Internal application port 9000 is not necessarily the public port. The browser HTTPS address is not the tracker TCP endpoint. Preserve the approved AOVX transport and only use a company-authorized device binding. [AOVX ingress](RAILWAY_AOVX_PILOT.md)
3. Verify the tracker identifier against the configuration tool and inventory. Lite enrollment expects a 12-digit decimal BCD identifier, including leading zeros. Do not substitute an IMEI without confirming the protocol identifier. Reuse the approved binding and check for conflict before any change. Use the configured firmware reporting cadence, as stationary and moving intervals can differ. Record the actual values before testing. [Enrollment](AOVX_DEVICE_ENROLLMENT.md)
4. Confirm the intended Gateway revision and routing readiness. The route editor can save a road proposal only after a B2 calculation succeeds. [Oracle routing readiness](ORACLE_RAILWAY_ROUTING_BRIDGE.md)
5. Pair Core to the authorized HTTPS telemetry service using its separate native owner-approved procedure. The operator controls the tenant-scoped pairing credential; the customer cookie and tracker SIM never authorize Core. Core remains usable without Railway or a Lite login. [Core phone proof](https://github.com/themightydanik/trackium-core-android/blob/main/docs/PHONE_ACCEPTANCE.md)

## 1. Stationary outdoors

While parked, power off the tracker before inserting the SIM if the hardware guide requires it. Start it in open sky and wait at least the agreed report window. The first TCP packet can be registration or heartbeat, not GNSS. In Lite, open **Devices → Physical Device Lab**, and look for a processed linked observation with a valid GNSS fix. Verify actual UTC measurement and Gateway receipt separately and compare the location to a trusted reference. The Fleet Map location marker requires a recent-enough valid real-time measurement at receipt and no conflicting newest fix. A retained marker is last known and becomes stale after 15 minutes. A pending or absent position must remain unavailable.

In Core, open **Devices → Open device observation** and tap **Refresh tracker observation**. Check device, coordinate, UTC and receipt against Lite. An eligible fix appears mint on the local coordinate plot. A buffered reading can appear as a history ring, never as the current fix. Accuracy is unavailable where the tracker does not report a supported accuracy measurement. [Detailed diagnostics](AOVX_GL110_FIELD_ACCEPTANCE.md)

## 2. Route and movement

1. Lite **Fleet Map → shipment**. Choose **Start blank route**, **Plan from checkpoints**, or **Edit active road as draft**. Enter or pick origin, destination and waypoints; reordering changes the draft only. Calculate, review the road geometry and estimates, propose, approve, then activate with the corresponding B3 rights. Historical revisions and original shipment checkpoints remain separate. Enable **Reported GPS** and **Road route** to see both on one map.
2. In the paired Core device detail, use **Edit local waypoint plan**. Enter one latitude/longitude pair per line, with origin first and destination last. Choose **Calculate road preview**, confirm the provider, review the resulting road, and choose **Save and activate road locally**. Fit the road on the imported offline linework. The latest eligible fix and history remain distinct from the route. The foreground device view refreshes every 15 seconds while idle.
3. A passenger or person safely parked should interact with the apps. Compare known waypoints and UTC against reports. In Lite, only the selected shipment device's bounded recent history appears as discrete breadcrumbs; use Device Lab for wider history. The approximate distance from the active road uses the recent eligible fix. It is advisory and does not change the shipment, cargo ledger or proof. In Core, compare the same device's fixes and advisory distance to its active local road. Never use observation or approximate distance as a driving instruction.
4. During an authorized coverage gap, ensure the previous fix ages rather than moving without data. When connectivity returns, old buffered fixes may appear in history without replacing the newer current projection. Keep private coordinates and packet evidence in approved storage.

Local browser fixtures and JVM tests verify presentation and controls. The owner must still confirm actual TCP reachability for the SIM, device/tenant binding, first eligible GL110-GL fix, observed movement on both phones, and production route readiness. Do not use simulator or synthetic samples as hardware evidence.

## Deployment gates

The release is not field-test ready without approval and deployment of the exact Lite PR, a reachable independent Core provider, and the operator-confirmed external AOVX TCP hostname and port. The internal application port is not evidence of the external endpoint. Record that exact pair from the existing Railway TCP proxy configuration and compare it with the tracker configuration before insertion. Leave the existing receiver and Oracle bridge unchanged.
