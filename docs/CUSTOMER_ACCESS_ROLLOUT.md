# Customer access rollout

Customer accounts are off by default. Deploying the code and additive migration 012 leaves login, signup and the mail worker off until explicit activation. Core, specialized pairing, Cargo API scopes and proof modes retain their independent settings.

## Approved Railway service variables

| Variable | Value or source |
| --- | --- |
| `CUSTOMER_ACCOUNTS_ENABLED` | `false` for initial rollout. Set `true` only after operator approval. |
| `CUSTOMER_MAIL_PROVIDER` | `resend` in a deployed environment. The `local` file sink is limited to loopback development and rejects Railway and production. |
| `RESEND_API_KEY` | Server-side Resend send-only key restricted to the verified sending domain. |
| `CUSTOMER_MAIL_FROM` | Bare sender email on that verified domain. |
| `CUSTOMER_MAIL_TOKEN_KEY` | Secret shared by all replicas. Generate 32 random bytes and store the hex encoding in the approved secret store. |
| `PUBLIC_ORIGIN` | Exact HTTPS browser origin, without a path, credentials or query. |
| `ENABLE_WEB_WORKSPACE` | `true` for the approved Lite service. |

Startup fails closed if activation is requested with incomplete or invalid configuration. Resend credentials are used only on the server and never sent to a browser or to Android. The existing operator-configured proof flags stay independent. Customer activation does not change Integritas or native publication settings.

## Delivery and abuse controls

Signup, recovery and invitations save the code hash and mail job in the same database transaction. The queued row records a stable job ID, sender and delivery state. The worker derives the one-use code from the job ID and the shared secret. Retries do not require storing the raw code in PostgreSQL. HTML and plain-text versions contain the same code and instructions for the configured Lite app. No external links or tracking are embedded.

The worker leases jobs using PostgreSQL `SKIP LOCKED`. It posts only to the fixed HTTPS Resend endpoint, denies redirects and uses a five-second timeout. Network errors, temporary HTTP errors and ambiguous outcomes retry with the same job ID, request content and `Idempotency-Key`. Retry-After seconds are honored within the code lifetime. Retries stop on permanent errors, at eight attempts or before code expiry. Each code lasts 30 minutes, within Resend's documented 24-hour idempotency window. A successful provider response records `accepted`. Inbox delivery requires independent confirmation. Repeated requests for the same active code subject are coalesced until it is consumed or expires. Users with a terminal delivery failure can request a fresh code after expiry. Provider bodies, recipient addresses, keys and codes stay out of runtime logs. Queue counts can be monitored by outcome and pending age, without selecting recipient data. [Resend send API](https://resend.com/docs/api-reference/emails/send-email) · [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

PostgreSQL enforces fixed-window limits of 100 account writes per minute globally, 30 per socket peer and five per normalized email and operation for signup, login and recovery. Budget consumption is atomic across replicas. Railway proxy peers can share a budget. The service never trusts client-supplied forwarding headers. Per-process limits also cap concurrent account work. Verify shared budgets against expected Railway traffic before raising limits. A separately approved edge rate limit and monitoring are needed before public launch. Recovery uses uniform success responses and a timing floor. Login performs equivalent password work for unknown email addresses. The existing origin checks, HttpOnly/Secure/SameSite cookies, CSRF, session revocation and current membership checks remain.

## Rollout and rollback

1. Confirm an isolated staging service, PostgreSQL backup and operator approval before configuring secrets or deploying. Verify sender DNS and provider quotas using the authorized Resend account. Keep registration switched off during the initial rollout.
2. Start the new revision and verify health, migration 012 and legacy pairing/Core access. Confirm the intended public origin. Configure the shared token key and sender identically on all replicas. Activate customer accounts only for the approved staging test window.
3. With separate permission for real mail, use controlled staging mailboxes to test signup, recovery, invite/revoke and rate limits. Confirm actual inbox delivery, retry metrics and current role enforcement. Keep provider and Gateway diagnostics free of message contents.
4. To pause or roll back, set `CUSTOMER_ACCOUNTS_ENABLED=false`. This stops new requests and workers after rollout. Existing account data and queued jobs are retained. Before resuming, reconcile the queue and invalidate outstanding codes if the incident, restore, sender/template change or token-key rotation could make old jobs unsafe. Deleting outstanding code rows cascades to their queue jobs. Revoke affected account sessions if a snapshot resurrected them. Keep migrations applied and leave the old file sink disabled if reverting application code.
5. For persistent provider faults, inspect status counts and the approved provider dashboard. Resolve configuration and wait for the active code lifetime rather than replaying uncertain sends with a new key. Pre-launch gates are verified sender, public edge abuse controls, monitored email quotas, backup/revocation rehearsal and physical Android acceptance.

## Physical Lite Android acceptance

Use the existing `tech.trackium.lite` APK signed by the approved certificate. On a test phone open the approved HTTPS staging Gateway. Start on Lite sign-in, request confirmation, open the separate mail app and copy just the code. Return to Lite and confirm within the same WebView origin. Sign in, open a company, close/reopen, then sign out. Confirm that protected data no longer displays. Recover using a fresh code and password, then verify the prior session cannot be used. Accept an invitation as its intended email and verify revocation after a fresh protected request. Check an external redirect and an HTTP origin are rejected, changes to origin clear local session state, and no mail link or API key is passed into the WebView. The Linux Chromium WebView-UA regression and Android Robolectric tests do not substitute for this handset check.
