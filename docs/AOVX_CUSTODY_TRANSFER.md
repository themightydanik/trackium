# Operator AOVX custody transfer

Issue #83 transfers future custody from Trackium Internal to the promoted Trackium Physical Pilot. It creates a new destination registry device and binding, and revokes the source binding. Source history, raw packet rows, prior packet links, shipment events, proofs, and immutable hashes stay where they were. There is no automatic transfer in demo promotion or Lite enrollment.

## Authorization and preflight

1. Obtain approval from the source company, the destination company and the authorized operator. Verify possession or documented authority over the exact GL110-GL independently of its BCD. Store the private approval and custody records in the operator channel and assign distinct UUID references to the approvals. The CLI records references and prevents reuse. It relies on the operator to validate those records and has no signature verification or browser endpoint.
2. On approved infrastructure, ensure every Gateway TCP receiver and replay worker runs the new revision with migration 016 before any cutover. Old workers do not enforce the new custody fence. Migration 016 adds an immutable transfer ledger and an identifier history index. It makes no changes to existing bindings or evidence.
3. Use a privileged database connection only for apply. Inspect and plan run in read-only repeatable-read transactions and can use an authorized read-only account. Run inspect before promotion where possible to confirm the source company, exact binding and device UUIDs, historical observations, open shipments, pending 0x0200 packets and the pilot's DB state. A different device, owner, third-company historical binding, approval conflict or open shipment blocks transfer. Wait for active receiving workers to drain pending packets where practical. A pending packet can stay raw-only if it reaches the worker after cutover.
4. The destination must be the enabled, already promoted pilot with its Owner membership. For a pilot with only a tracker already held by another tenant, the existing promotion supports explicit `--empty-inventory=approved-transfer` in place of `--device-file` for both plan and promote. This approves zero identifiers for Lite and performs no reassignment. The existing promotion, rollout gate, approved HTTPS origin and separately authorized password rotation follow the [pilot runbook](MINIMA_PHYSICAL_PILOT.md). Transfer itself does not change credentials, config or membership. DB inspect does not attest the state of the application feature gate.
5. This operation was requested without a new backup. No backup is taken by the tool. The reverse operation below changes **future custody**. It cannot recover lost data or replace a database recovery point. Proceed only after the authorized owners accept that recovery limitation.

## Operator commands

Run from `services/gateway` with `DATABASE_URL` injected by the approved secret store. Use owner-only regular JSON files. The inspect file contains only `{"identifier":"<12 decimal digits>"}`.

```sh
npm run aovx:transfer -- inspect-transfer --file=/secure/tracker.json
npm run aovx:transfer -- plan-transfer --file=/secure/transfer.json
npm run aovx:transfer -- apply-transfer --file=/secure/transfer.json --approve=transfer
```

The plan file has these fields. Use actual UUID values from the reviewed records.

| Field | Value |
| --- | --- |
| `id` | Unique operation UUID. Reuse the same file and ID after timeout or uncertain response. |
| `identifier` | Reviewed 12-digit BCD. |
| `source_tenant`, `source_device`, `source_binding` | Exact UUIDs from current inspect. |
| `destination_tenant`, `destination_label` | Exact promoted pilot tenant UUID and new physical device label. |
| `source_approval`, `destination_approval` | Separate one-time UUID references for the confirmed approvals. |
| `custody_reference`, `operator_reference` | UUID references to verified custody and the approving operator record. |

The plan reports pending packets rather than promising to move them. Apply revalidates all predicates under locks. Identical retries return the committed receipt. A changed plan with the same ID, a consumed approval, or an unexpected binding fails closed. Failure before commit leaves both the registry and bindings unchanged. Avoid manually revoking the source before applying.

## Concurrent packet behavior

- Cutover is the database UTC timestamp, rounded up to the next millisecond. Gateway journal receipt determines which side of the boundary a packet can enter. It is not the device measurement time. A pre-boundary packet can commit to the source if its worker wins the tenant lock. If cutover wins, the packet remains raw-only. It cannot be normalized to the destination.
- A packet received after the boundary while apply is still open can initially see the source. The worker checks the binding again after locking its tenant and retries in a fresh transaction when binding identity changed. It does not hold two tenant locks across that retry. The transfer commit does not wait on raw packet rows. TCP can continue receiving throughout.
- A transferred binding accepts only nonbuffered observations with valid reported measurement UTC on or after cutover and no later than receipt. Older, buffered, invalid, future or known historical repeats remain raw-only without a tenant event link. This is deliberately conservative and can reject the first report at second-level clock precision. Reported timing is still unverified. These checks do not authenticate hardware or prove that timestamps were not fabricated.
- The transfer takes tenant locks in UUID order, then the pilot account, BCD advisory lock and source rows. Transfer only adds an indexed audit lookup on the normal ingestion path, and a prior-binding/digest lookup for eligible transferred observations. Generic binding APIs cannot use audited identifiers to bypass the custody fence. Existing raw records and canonical evidence are untouched.

After apply, inspect and verify one active binding, source history intact, and new unverified observations in the pilot Device Lab only. Test measurement UTC, receipt, map and selected-period history. Treat a lack of eligible observations as unavailable, and use the GL110-GL field checklist before claiming actual device behavior.

## Reverse custody

Prepare a new plan with new approval and operation UUIDs. Use the current pilot binding as source, the original source tenant as destination, and add `reverse_of` set to the original transfer's operation UUID. Omit `destination_label`. Verify the original registry has no other active binding and that the pilot device has no open shipment. Apply using the same commands. A committed reversal revokes the pilot binding and opens a **new** binding on the original registry device, under the same cutoff rules. Pilot evidence and source evidence stay separate. Retrying the original forward command returns the old receipt and never undoes the reversal. If the audited binding was manually revoked or the hardware has left the approved tenant pair, stop for separately reviewed custody recovery.
