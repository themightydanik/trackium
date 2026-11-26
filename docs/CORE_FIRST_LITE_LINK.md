# Linking a Core-first tracker to Lite

## Invariant

The serial remains in the existing activation inventory. The Core owner installation remains the cryptographic owner. Linking attaches one verified website account to that device's existing private telemetry workspace. Preserve tenant ID, device ID, AOVX binding, packet lineage and existing Core grants. Core works without a website account before and after linking.

Use one active website ownership relationship per Core-first private workspace. Do not move a device or copy observations into an unrelated Lite company. The linked account can select the device's workspace with existing company switching. A later cross-company custody transfer remains the approved operator operation.

## Protocol

1. The signed-in, verified website account requests a five-minute challenge. The server stores the token digest, account ID, creation and expiry, and issuance session ID for audit and rate limiting. The request uses existing cookie, Origin and CSRF checks. The website displays a QR with the one-time connector.
2. Core scans the challenge and shows the specific device whose access it will share. It signs the existing Core envelope over a new link-approval operation, the challenge, and its owner installation ID. The server accepts only an approved, active owner grant matching the current inventory and active physical binding. A Full Access or View Only grant cannot perform this step.
3. The website shows the proposed device and installation fingerprint. To complete the link, the same account explicitly confirms the matched fingerprint and current device. In one transaction lock the challenge, workspace and registered-device claim, recheck both authorizations and expiry, consume the challenge, insert the linking relationship and its audit record, and add the role for this workspace.
4. The link endpoint returns only its resulting state and the existing workspace ID. The signed-in account can enter the workspace with the existing company switch. No token or Core key is copied to the account.

Do not expose device details in a public challenge lookup. Knowing a serial, activation card, public fingerprint, or QR alone does not grant ownership. Approval neither extends access to unrelated company members nor enables wallet access. The website relationship controls membership for this workspace only. Guard invitations and team expansion until the permitted membership model is reviewed.

## Revocation and retention

The active Core owner can revoke through a signed request. The linked user can unlink their own account through existing cookie/CSRF protection. Revoke the link and any website sessions for the affected workspace, remove only the membership created by the link, and record the audit event in one transaction. Enforce revocation in session authorization so a retained cookie cannot continue reading. Existing Core installation authorizations remain subject to their own lifecycle. The device owner and telemetry stay intact.

Invalidate pending challenges on custody transfer. Existing links must not be resurrected by reversing a transfer. Reconcile all link, membership and revocation changes before enabling after a database restore. Keep audit entries and stored ownership when rolling back a binary. Launch behind a dedicated default-off flag.

## Required evidence for the implementation PR

- Two verified website accounts cannot claim the same workspace concurrently.
- An expired challenge, borrowed QR, guessed serial, stale owner signature, revoked installation or Viewer cannot grant access.
- Website account switching and session revocation remain tenant-scoped.
- Linking preserves existing Core grants, telemetry history and immutable evidence.
- Replay and duplicate-confirm requests produce a consistent consumed outcome and create at most one active link.
- Transfer, restore and revoked-link races fail closed.
- Web and Android show the fingerprint and device before confirmation. An account-free Core installation works with the linking flag off.

Review the workspace membership restrictions, transaction lock order and account recovery treatment before implementing or enabling this protocol.
