# Purchased tracker activation

Device activation is opt-in with `DEVICE_ACTIVATION_ENABLED=true` on a Gateway using PostgreSQL migration 018. The Gateway uses its existing customer account configuration. Activation requires a signed-in company Owner. In **Devices → Activate a purchased tracker**, enter the serial and one-time code from the card, add a label and select **Activate tracker**. The device appears even if it has sent no packets. The existing Device Lab determines whether a packet contains an eligible GNSS position.

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

The versioned card payload can be printed as a QR code. Core scanning, key-bound grants, Core-only claims, linking Core ownership to a website account and Core access to default Gateway routing are pending. The website flow currently uses the printed serial and code. Activation and a healthy HTTPS Gateway do not confirm the external tracker TCP hostname or port. Obtain those values from the Railway TCP Proxy settings before configuring the device.
