# Managed Gateway pilot

A platform operator creates an isolated tenant for each customer using the existing trusted Gateway database role. An owner receives an API credential outside Lite and approves a one-use browser challenge. The resulting Lite session uses the existing scoped HttpOnly cookie and CSRF checks. Free/self-hosted Gateway continues to use the existing tenant and key commands.

## Provision and connect

Run these commands from the repository root on a trusted operator host. Use a loopback Gateway and a disposable PostgreSQL database for rehearsals. Set `DATABASE_URL` through the operator environment and set `PUBLIC_ORIGIN` to the exact Lite origin. Start the Gateway with the browser workspace enabled, `PROOF_MODE=disabled` and the TCP receiver disabled for a pilot rehearsal. Keep the operator database role and credential files off the browser host if it is a separate machine.

```sh
admin() { node services/gateway/src/telemetry/admin.js "$@"; }
customer=$(node -p 'require("node:crypto").randomUUID()')
keydir=$(mktemp -d)
chmod 700 "$keydir"

admin managed-provision --customer="$customer" --name="Customer A"
admin managed-status --customer="$customer"
admin managed-grant --customer="$customer" --revision=0 --out="$keydir/owner.json"
```

Keep the customer UUID in the operator’s customer record. Repeating provisioning with that UUID and name returns the same tenant. Using the UUID with a different name fails. Each new customer UUID creates its own tenant. The managed CLI does not adopt existing tenants.

The grant writes a new mode-0600 JSON file outside the checkout and returns only identifiers, access status and revision. Deliver the file through an approved confidential channel. The owner has `read,admin,shipments`, can enroll or revoke devices through the existing owner API, and can approve Lite scopes limited to `read,shipments`. No platform-wide HTTP role exists. The pilot uses the existing proof configuration and approval gates with publication disabled.

The customer opens `/app/#settings`, enters the tenant ID and copies the one-use challenge ID to the owner. The owner uses the [existing Gateway approval API](RAILWAY_DEPLOYMENT.md#5-web-workspace-проверка-owner-pairing-перед-включением) from a trusted client, or a trusted Gateway operator can execute the established approval CLI on their behalf using the owner credential file:

```sh
admin approve-pairing --credential-file="$keydir/owner.json" \
  --challenge="$challenge" --scopes=read,shipments
```

The customer checks approval in Lite. They can then read their own devices, shipments and proof records. With the shipment scope and an enrolled device, they can save a shipment draft. Entering a tenant ID or challenge ID alone grants no access.

## Revoke, rotate and recover

1. Run `managed-status --customer="$customer"` and record its revision. Status counts active credentials and eligible browser sessions separately.
2. Run `managed-revoke --customer="$customer" --revision=N`, replacing `N` with the observed revision. New authenticated requests using the old owner key or its sessions fail. Previously approved challenges tied to that key cannot be claimed.
3. Confirm the customer’s identity through the operator’s approved recovery channel. Read the new revision and run `managed-grant` again with that revision and a fresh output path. The same command rotates an active key by replacing it atomically. Deliver the new file securely and repeat pairing with a new challenge.
4. If an operation reports a revision conflict, re-read status and reconcile before issuing another mutation. If the process stops after the file is created and you cannot establish whether the database committed, retain it in restricted storage, reconcile using status and the owner authentication endpoint, then discard or revoke it as appropriate. Use a new path on retry.

Revocation changes future authentication. It does not recall data already displayed or cancel requests that passed authentication before the revocation committed. Provision, grant and revoke preserve the tenant ID, historical telemetry, shipments, ledger and proofs. Managed credential changes go through the revisioned commands. The generic Free key commands reject managed keys.

## Capacity, backup and recovery

Run `admin managed-capacity` from the operator host. It reports registered managed customers, pending raw packets, pending or expired-lease cargo outbox jobs, and total PostgreSQL database bytes. Queue counts reflect the shared Gateway because raw packets may precede tenant resolution. Compare queue counts across samples to detect sustained backlog. Compare database growth with available bytes on the **PostgreSQL host or service volume** using its storage metrics or `df -Pk "$PGDATA"` on a self-hosted database machine. The CLI result stays with the operator and omits device identifiers, tenant details and secrets. Set polling cadence, alert thresholds, capacity limits and recovery targets with the pilot operator before external acceptance.

Use the [disposable backup and restore drill](../services/gateway/docs/BACKUP_RESTORE_DRILL.md). It verifies Managed registration and owner access alongside migration checksums, raw packet lineage, immutable cargo hashes, transactional outbox and export of test-only proof evidence. It reports dump and verified recovery elapsed time and counts writes lost at the quiescent fixture cut. Those measurements apply to the local fixture. Production recovery objectives require an operator-approved schedule, archive storage and retention, measured production-scale restore, disk alerts and incident escalation.

Before reopening a restored Gateway, reconcile customer access against the operator’s service records, especially revokes and rotations after the snapshot. An older snapshot can restore authentication state that predates a revocation. Revoke affected keys through the managed command and issue fresh credentials only after confirming entitlement to access. For rollback, stop Managed grants and use the revisioned revoke workflow when access must be disabled. Keep migration 008 and its customer mappings and access revisions in the backed-up schema. Do not run a pre-008 operator CLI against a Managed database, since it does not enforce the managed key workflow.

## Local acceptance

From the repository root, with Node 22+, Gateway dependencies installed, Playwright available to Node, local Chromium and `TEST_DATABASE_URL` pointing to a disposable PostgreSQL instance:

```sh
(cd services/gateway && npm test && npm run test:integration)
node --test tests/minidapp/*.test.cjs tests/minidapp/server.integration.cjs
node services/gateway/scripts/backup-restore-drill.mjs
```

The Managed browser scenario runs the operator CLI and real Gateway against an isolated schema. It checks two customer tenants, concurrent grants and conflicting provisioning, owner-approved pairing, shipment writes, device and proof isolation, scope and CSRF enforcement, revocation, rotation and reapproval. The Free browser and PostgreSQL regressions run in the same suite. Managed billing and independent Mainnet acceptance are tracked separately. The [local notification inbox](CARGO_NOTIFICATIONS.md) is an optional tenant feature.

| Acceptance gate | Local evidence | Remaining external check |
| --- | --- | --- |
| Provisioning and owner recovery | CLI + Chromium + PostgreSQL exercise customer A and B, scope and tenant isolation, access revocation, rotation and new approval | Confirm the pilot operator’s customer identity checks and confidential delivery channel |
| Capacity and restore | CLI reports database bytes and shared queue counts. Disposable restore verifies current and revoked owner keys, cargo evidence and test-only proof export | Approve SLOs and verify staging metrics, disk alert delivery, archive retention and representative restore timings |
| Physical tracking and proof publication | Generated AOVX frames remain unverified with null position. The browser runs with proof publication disabled | Physical GNSS and measurement ordering need independent evidence. Mainnet acceptance requires separate operator authorization |

The Free browser dataset-to-restore runner from TRK-P0-109 remains separate acceptance tooling. This package commits the Managed-specific browser scenario and extends the shared recovery drill.
