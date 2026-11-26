# Purchased tracker activation

Device activation is opt-in with `DEVICE_ACTIVATION_ENABLED=true` on a Gateway using PostgreSQL migration 018. The Gateway uses its existing customer account configuration. Activation requires a signed-in company Owner. In **Devices → Activate a purchased tracker**, enter the serial and one-time code from the card, add a label and select **Activate tracker**. The device appears even if it has sent no packets. **My Devices** shows the serial for purchased trackers to company Owners. Open **Device details** to rename a device or inspect its tracking data. The existing Device Lab determines whether a packet contains an eligible GNSS position.

`POST /v1/account/activate-device` accepts `serial`, `code` and `label` as JSON and uses the existing customer session, same-origin and CSRF controls. It returns the created device with HTTP 201. Bad codes, missing stock and already-used codes get the same rejection. The account rate bucket is in PostgreSQL and works across replicas. The posted body should never be logged.

## Provisioning and custody

An operator independently verifies the printed serial and 12-digit BCD identifier from approved inventory records and device evidence. Keep leading zeroes in the BCD field. Existing enrollments must go through the existing custody review. This migration makes no inventory entries and does not change any existing ownership.

Prepare a permission-0600 JSON manifest of 1–100 objects, each with string fields `serial` and `device_id_bcd`. Use uppercase serials with letters, digits, periods, underscores or hyphens. From a restricted operator workstation with an approved private database connection supplied through `DATABASE_URL`, run these examples against **private paths**.

```sh
umask 077
npm --prefix services/gateway run activation:admin -- provision /private/inventory.json /private/new-cards.json
npm --prefix services/gateway run activation:admin -- inspect SERIAL
npm --prefix services/gateway run activation:admin -- invalidate SERIAL
npm --prefix services/gateway run activation:admin -- rotate SERIAL /private/replacement-cards.json
```

The private export contains the plaintext code and its versioned QR payload for each card. Render and print offline. Do not send the export to a CI runner or online QR generator. Securely discard the export when printing and reconciliation are complete. The command refuses to overwrite an existing export. If it reports a failure after creating an output file, quarantine the file and inspect the committed inventory before printing any card. Invalidate and rotate an unclaimed entry if a card may have leaked. A successful claim consumes the secret. Do not regenerate a printed secret for a claimed unit.

Claiming reserves the serial and BCD mapping, creates the real device record and establishes the existing telemetry binding in one transaction. The BCD identifier identifies the protocol source for binding purposes. It provides no cryptographic attestation of the tracker. Approved administrative custody transfers update the inventory pointer in the same transaction as the binding change. Historical measurements remain under their existing company. Claimed-device recovery or revocation uses the existing operator workflow.

## Rollout and rollback

Review and deploy migration 018 with the flag off. Confirm existing enrollments and transfers before provisioning the pilot inventory. Keep the feature flag off until operator review and a disposable-database rehearsal pass. Roll back by disabling the flag and retaining the schema and inventory. If rolling back to an older Gateway binary, pause custody transfers until the inventory-aware version is restored. An older binary cannot update the inventory during transfer.

The versioned card payload can be printed as a QR code. Core scans that payload from the printed card. Linking a Core-first ownership record to a website account remains pending. The website flow currently uses the printed serial and code. Activation and a healthy HTTPS Gateway do not confirm the external tracker TCP hostname or port. Obtain those values from the Railway TCP Proxy settings before configuring the device.

## Core gateway contract

Migration 019 adds device-scoped installation grants. The Core endpoints are disabled by default. Enable them in an isolated test Gateway with `CORE_DEVICE_ACCESS_ENABLED=true`. Each native request signs UTF-8 JSON with an installation P-256 key using SHA256withECDSA (ASN.1 DER signature). The signed message is six UTF-8 lines joined with LF, with no trailing newline. The lines are the literal `trackium-core-device-v1`, the origin, operation, nonce, decimal timestamp, and lowercase hex SHA-256 of the exact inner payload string. Supply `public_key` (DER SPKI), `nonce` (UUID), `timestamp` (milliseconds UTC), `payload` (the exact inner JSON string) and `signature`; binary fields use unpadded base64url. The configured Gateway origin is the audience. The server applies a 90-second clock window and persistently rejects nonce reuse across replicas.

- `POST /v1/core-devices/claim` accepts the card's serial, code and label. It uses migration 018's same inventory and atomically creates a private telemetry workspace and its first key-bound owner. It creates no customer account.
- `POST /v1/core-devices/connect` accepts a website-issued `code`. It consumes the code and creates a pending installation. The owner compares its displayed public-key fingerprint with the one on the receiving phone before approving. This prevents a photographed QR or intercepted link from granting GPS access on its own.
- `POST /v1/core-devices/devices` with an empty inner object lists only approved, non-revoked grants for the signing key.
- `POST /v1/core-devices/observations` returns an eligible position, if available, and up to 50 recorded observations for the signed `installation_id`.
- `POST /v1/core-devices/calculate` accepts an `installation_id` and a B2 `calculation`. Full Access and Core owners can use the configured, attested B2 service. View Only grants can read telemetry. Core grants confer no access to customer sessions, Cargo writes or Minima signing.

Company Owners can call the existing account route with the `core-device-issue`, `core-device-list`, `core-device-approve` and `core-device-revoke` actions. All accept `device_id`. Issue additionally accepts permission `full` or `view`; approve and revoke take an `installation_id`. Codes expire after five minutes. Custody transfer invalidates old codes and installations, including if custody is later reversed. Keep the flag disabled after restoration until post-snapshot revocations have been reconciled. Physical Android QR/App Link acceptance, Core-first website linking and the production release remain outstanding.

### Connect an existing physical tracker

For a device bound before activation was introduced, verify its printed serial against the physical device and the existing binding. An operator can run `npm --prefix services/gateway run activation:admin -- adopt /private/existing-binding.json`. The owner-only file contains `serial`, `device_id_bcd`, `tenant_id` and `device_id`. Adoption verifies the exact active physical binding. It issues no code and preserves the device ID, company and existing history.

A company Owner opens the device details in **My Devices**, chooses **View Only** or **Full Access**, and selects **Generate connection QR**. In Core, unlock the local app and choose **Devices → Add Device** to scan. The recipient sends the displayed public-key fingerprint to the owner. The owner refreshes the installations list, confirms the matching fingerprint and approves it. The recipient refreshes **My devices** and opens the tracker. **Revoke installation** removes access for that key. A View Only installation can see observations for this device but cannot manage the tracker, give anyone access, or make routing requests using the grant.

To use the one-time HTTPS link directly, set `CORE_ANDROID_CERT_SHA256` to the colon-separated fingerprint of the approved Core APK signing certificate. The Gateway publishes an Android Digital Asset Links statement for `tech.trackium.core.prototype`. Verify Android association on the actual signed installation before relying on this path. If the link opens in a browser, the owner can copy it into the Core connection field. The fragment carries the code so browsers do not send the code in the URL to the web server.

**Settings → My Applications** links to the Lite Fleet Map and shows Android downloads after release. Set `LITE_ANDROID_APK_URL` and `CORE_ANDROID_APK_URL` only after signing and publishing the corresponding public GitHub Release assets. Use a versioned tag such as `vX.Y.Z-pilot.N` and match it in the filename `trackium-lite-<tag>.apk` or `trackium-core-<tag>.apk`. Check that each published link is downloadable without a GitHub login and verify its signature and SHA-256 before exposing it. Unset settings display the unpublished state.
