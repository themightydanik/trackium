# Closed Trackium Lite demo for Minima

The demo uses one normal password account with one Viewer membership in a separate **Trackium Demo** company. It carries no email, operator, simulator, native or publication permissions. Registration, recovery, invitations and company changes are unavailable in demo mode. Special-purpose pairing and the Core workspace keep their existing authentication. Guest visitors must sign in to see the demo. Keep the demo password off GitHub, logs and command lines.

## Approved rollout on the existing production Gateway

1. Confirm approval for the exact production service, database, revision and rollout window. Verify the current web and proof configuration and take an approved PostgreSQL backup. If this Gateway currently requires public customer accounts or native publication, stop and resolve the incompatibility with its operator before selecting demo mode.
2. With the demo gate off, apply the reviewed revision and confirm Gateway health and additive migration 014. Verify existing Core and pairing behavior. Obtain a restricted operator session with the intended private database connection. Set `DATABASE_URL` using the existing secret store. Run from `services/gateway` in a trusted checkout or from the Gateway working directory in an approved operator shell. Do not expose PostgreSQL publicly for bootstrap.
3. Place one generated password in an operator-owned regular file outside the checkout, using mode 0600 or 0400. Use an approved secret tool that does not put the password in shell history or arguments. The fixed login is `trackium-demo`.

```sh
cd services/gateway
npm run demo:admin -- bootstrap --password-file=/approved/private/demo-password
```

The command creates the new company, one Viewer and two reproducible synthetic shipments with planned routes, genuine lifecycle events and test proof requests in one transaction. It writes no device observation, GPS sample or AOVX binding. Conflicting existing identifiers are refused. Repeating bootstrap preserves existing data, credentials and activation state.

4. After operator approval, configure the exact existing Gateway as follows. Keep unrelated variables unchanged.

| Variable | Value |
| --- | --- |
| `CUSTOMER_DEMO_ENABLED` | `true` |
| `CUSTOMER_ACCOUNTS_ENABLED` | `false` |
| `ENABLE_WEB_WORKSPACE` | `true` |
| `INTEGRITAS_MODE` | `test` |
| `PROOF_MODE` | `disabled` |
| `PROOF_ALLOW_LIVE`, `PROOF_ALLOW_MAINNET` | `false` |
| `PUBLIC_ORIGIN` | Exact HTTPS origin for the existing Gateway |

No mail provider settings are required. `INTEGRITAS_MODE` applies to this Gateway instance. Check existing pending test requests before turning it on. Railway variable changes can trigger rollout. Review the pending changes and perform the agreed rollout only with operator approval. Core browser access remains at `/app/core`. The existing native proof workflow still requires its normal configuration and approvals outside the demo.

5. Confirm `/readyz`. Sign in at `/app/` as `trackium-demo` through the normal Lite login and confirm only **Trackium Demo** is visible. Verify Viewer permissions, planned routes without device positions, and the `TEST_ONLY` label on Integritas proof cards and verification. The local worker advances the seeded test requests. Share the HTTPS link and identifier with the approved participants, then provide the password through the approved private channel. Rotate it after the demonstration.

## Rotate, revoke and stop

```sh
npm run demo:admin -- rotate --password-file=/approved/private/replacement-password
npm run demo:admin -- revoke
npm run demo:admin -- disable
```

Rotation changes the password and revokes every demo session. Revoke alone signs all viewers out and preserves the password. Disable revokes all demo sessions and denies further sign-in immediately through the database flag. Also set `CUSTOMER_DEMO_ENABLED=false` in the approved rollback to remove the demo sign-in screen. The company and evidence remain isolated. Following a restored snapshot, keep the environment gate off and revoke and rotate before considering reactivation.

To reopen a disabled account, deliberately use `npm run demo:admin -- enable` after rotation and authorization. Do not assign other memberships, issue a tenant API key, connect real tracking hardware, or change native publisher settings for this company. This PR performs no production bootstrap, rollout or publication.

## Switch an existing demo to its username

In an approved rollout, disable the demo gate on all old Gateway replicas before applying migration 014. The migration adds the fixed username to the existing demo mapping and revokes its browser sessions once. It preserves the password digest, company, Viewer membership, shipments and proofs. The old email field remains internal and the updated Gateway accepts only the username for demo sign-in. Skip bootstrap for an existing demo. Once only the reviewed revision is serving, enable the gate and sign in with the existing password. Keep the demo gate off if reverting to an older Gateway revision.

The Viewer company stays separate from physical data. For approved promotion of
the same username into a dedicated company, see the
[closed physical pilot runbook](MINIMA_PHYSICAL_PILOT.md).
