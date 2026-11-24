# Closed physical pilot for Trackium Lite

Issue #81 uses the existing `trackium-demo` username, account UUID, scrypt credential and customer session stack. Promotion requires a new password. The legacy credential and sessions cease to work when the transaction commits.

## Authorization and evidence

| Existing boundary | Pilot decision |
| --- | --- |
| Demo login resolves `customer_demo`. The ordinary email account flow excludes that account. | Keep that login identifier and separation. Both the explicit config gate and the audited DB promotion are required for the pilot. Turning the gate off while promoted fails closed. |
| The archive company has a Viewer role and synthetic shipments and TEST_ONLY evidence. | Preserve its tenant UUID, membership, evidence and immutable history. The promoted session is pinned to a separately named physical company with Owner membership. It cannot switch into the archive while promoted. |
| Customer Owner/Admin is a company role. The public telemetry binding endpoints require API-key admin scope. | Use a dedicated customer cookie endpoint for physical enrollment, with role, tenant, CSRF, persistent rate limits and verified inventory checks. The pilot session keeps read and shipment scopes. No API-key admin, publish, native, simulation or fixture permission is granted. |
| A 12-digit AOVX identifier can be observed without proof of ownership. | Require independent physical custody or documentary authorization before inventory approval, plus explicit confirmation in Lite. The inventory's identifier hashes are internal lookup data, not secrets or identity proofs. No command or tracker authentication is inferred from a BCD match. |
| Receiver lineage is binding-time and tenant-scoped; parser keeps device receipt and measurements separate. | Reuse the atomic registry and binding path, existing TCP receiver and Physical Device Lab. There is no backfill into the new tenant. Positions remain unverified, with buffered and future-time gating unchanged. |

The active pilot has no public account registration, email recovery, invitations, or arbitrary company creation. A pilot operator can manage its own shipments and enroll approved inventory. An unapproved identifier or a foreign prior binding produces a generic conflict. Revoked identifiers need operator review. Legacy operator APIs retain their existing authorization and can be used by operators for audited remediation outside this workflow.

In **Devices → Add physical AOVX tracker**, enter a label and an approved 12-digit identifier and confirm custody. The server either creates a physical registry row and its binding together, or rolls both back. No operator SQL/CLI is needed for this registration after inventory approval. A new device may initially show no packets. Observe it in **Device details → Physical Device Lab**. The browser does not substitute demo fixtures or invent sensor units.

## Controlled rollout

1. Obtain deployment and production data-access authorization. Identify the intended account owner, approved pilot company name and verified tracker inventory. Do not infer ownership from raw packets. Keep all inventory and pilot credentials in the approved private secret store.
2. Take an encrypted full PostgreSQL backup at a recorded cut and rehearse restore to a disposable database. Record the archive SHA-256 and verify schema migration checksums, session isolation, device lineage, cargo hashes/outbox and proof export. Use the [backup/restore drill](../services/gateway/docs/BACKUP_RESTORE_DRILL.md) to rehearse the checks. A real database restore must reconcile writes since the recorded cut.
3. Apply the additive schema on an authorized deployment with `CUSTOMER_DEMO_PILOT_ENABLED=false`. Migration 015 creates pilot state, an inventory lookup and an audit table. It does not promote accounts or rewrite data. Verify `/readyz`, HTTPS and legacy Viewer access. Keep `CUSTOMER_DEMO_ENABLED=true`, `ENABLE_WEB_WORKSPACE=true`, `CUSTOMER_ACCOUNTS_ENABLED=false`, `INTEGRITAS_MODE=test`, `PROOF_MODE=disabled`, `PROOF_ALLOW_LIVE=false` and `PROOF_ALLOW_MAINNET=false`. Use the existing authorized HTTPS `PUBLIC_ORIGIN`.
4. From `services/gateway`, use `DATABASE_URL` injected by the trusted secret store. Use a read-only role for the first two commands. `inspect` reconciles the current demo and pilot tenant IDs and archive membership. `plan` checks that every verified identifier is available, including prior revoked bindings to other tenants. Any conflict blocks rollout. Resolve conflicts privately with the authorized operator and account owner; the CLI never transfers an identifier.
5. Use an owner-only regular file for the device inventory, one independently verified decimal identifier per line, up to 20. Provide a different owner-only file containing the newly generated password. Use the explicit approval flag only after the plan and backup have been reviewed. On the approved HTTPS origin, enable the pilot gate on every upgraded replica before running promotion. The gate alone preserves Viewer access. Promotion commits the new role and password together, and revokes the Viewer sessions. An outdated replica with the gate off rejects promoted sessions.
6. Send the new password through an approved access channel. Verify old cookies fail, the same username opens the pilot company as Owner, other tenant data and the synthetic archive are absent, and read-only proof export continues to report its actual trust. Enroll the approved tracker and check receipt, location eligibility, map, selected history and export. Run the [GL110-GL physical acceptance checklist](AOVX_GL110_FIELD_ACCEPTANCE.md) before claiming hardware acceptance.

Commands run on the approved operator host:

```sh
npm run pilot:admin -- inspect
npm run pilot:admin -- plan '--name=Trackium Physical Pilot' --device-file=/secure/pilot-inventory
npm run pilot:admin -- promote '--name=Trackium Physical Pilot' --device-file=/secure/pilot-inventory \
  --password-file=/secure/pilot-new-password --approve=promote
```

The plan is read-only. Promotion repeats its conflict checks in the write transaction. That transaction serializes against demo CLI rotation and login, creates or resumes the reviewed pilot tenant, records the audit event, rotates the password, and invalidates sessions and old password mail tokens. Avoid copying command outputs containing internal UUIDs outside the operator channel. Routine password rotation and revocation use the existing `npm run demo:admin -- rotate --password-file=...` and `npm run demo:admin -- revoke`. With `disable`, either form of username access stops.

## Rollback

Use a separately rotated password, never the pre-promotion credential. Run the rollback with the feature code still available before reverting the application revision:

```sh
npm run pilot:admin -- rollback --password-file=/secure/pilot-rollback-password --approve=rollback
```

Rollback revokes sessions, removes the pilot Owner membership and approvals and restores the legacy Viewer login using the rotated password if the account is enabled. The pilot tenant, enrolled devices, bindings, physical history and proofs are retained. The software flag can then be disabled. Receipt on existing bindings can continue; stopping collection requires separately authorized unbinding. Resume only with the same pilot company name and reapproved inventory. No migration is edited or removed.

No local check verifies a production binding, HTTPS deployment or physical GL110-GL. The integration and Chromium tests use controlled frames and a disposable database.

A tracker with a foreign binding requires the separate audited
[AOVX custody transfer](AOVX_CUSTODY_TRANSFER.md). Promotion and Lite enrollment
do not move an existing binding or its history.
