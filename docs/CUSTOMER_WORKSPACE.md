# Trackium Lite customer workspace

Lite at `/app/` offers email registration, confirmation, sign-in, recovery, company selection and member management when the account feature is enabled. The specialized owner-approved pairing remains available under **Specialized connection**. Core at `/app/core` continues using its own pairing and native proof workflow even when a Lite customer session is present.

## Local setup

Use Node 22+, an isolated PostgreSQL database and a private directory outside the checkout. From the repository root:

```sh
maildir=$(mktemp -d)
chmod 700 "$maildir"
cd services/gateway
ACCOUNT_MAIL_DIRECTORY="$maildir" ENABLE_WEB_WORKSPACE=true ENABLE_TCP_RECEIVER=false \
  INTEGRITAS_MODE=test PROOF_MODE=disabled PUBLIC_ORIGIN=http://127.0.0.1:8080 npm start
```

Provide `DATABASE_URL` for the disposable database through the environment. Open `http://127.0.0.1:8080/app/`. The local mail transport writes one file per verification, invitation or recovery to the private directory. Retrieve the correct code from that directory as the test operator. Treat these files like mailbox credentials and remove them securely after the rehearsal. Accounts are disabled by default. This release includes a local mail sink. Production email delivery requires separate setup, abuse controls and operator approval.

Create an account and use the confirmation code to set a password. Sign in, create a company, then use **Company settings → Add device record** if the company has no devices. This registers an unbound record and sends no tracker command. Open **Shipments** to create a draft and use **Routes & reported positions** to open a shipment from a route marker. An unbound device has no position. The dashed route and its planned stops are independent of observed positions. The dashboard counts the loaded page and reports recent device observations without treating silence as offline.

## Company permissions

| Role | Workspace access |
| --- | --- |
| Owner | Read, manage shipments and company device records, invite and manage other members including Admin |
| Admin | Read, manage shipments and company device records, invite and manage Dispatcher or Viewer |
| Dispatcher | Read and manage shipments |
| Viewer | Read, including permitted proof checks and evidence export |

Invitations bind the recipient email, company, issuer and role. Accept them after email confirmation and sign-in. A revoked issuer cannot confer access with a pending invitation. An Owner membership cannot be edited from this workflow. Company creation and selection rotate the HttpOnly session. The Gateway derives cargo scope from the current membership on each request. Account roles grant no native publisher, fixture or Gateway operator scopes.

The server hashes passwords with scrypt (N=32768, r=8, p=3) and independently salts each digest. Codes are single-use, expire after 30 minutes and are stored by hash in PostgreSQL. Anonymous writes enforce the configured browser origin and request header. Authenticated writes also require CSRF. Login errors are generic and account recovery uses uniform acceptance responses. Instance-wide, per-origin-peer and per-email budgets bound credential attempts. Account browser sessions expire after 12 hours. Sign-out revokes the current session and a password reset revokes every session for that account.

Lite shows current Integritas `TEST_ONLY` and read-only native proof history. The operator prepares eligible Integritas test proofs through the existing trusted workflow. The feature changes neither proof publication approval nor physical telemetry.

The map uses the existing vendored Leaflet BSD-2-Clause SDK and Natural Earth public-domain boundaries. It makes no external tile requests and incurs no metered provider charges. The basemap is general-purpose and has no street-level tile detail. Deployment capacity depends on the Gateway, browser and snapshot size.

Migration 011 adds the account, company membership, session and code tables. Prepare a database backup and use the existing restore drill. Before activating a restored deployment, expire its restored account sessions and codes and reconcile membership changes since the snapshot. Keep the private spool outside the web root, backup export and shared logs.
