# Integritas test foundation for Trackium Lite

Lite consumes Integritas evidence through the Gateway. The provider identity is `integritas` and the only available network in this build is `test-only`. The Gateway will reject any `INTEGRITAS_MODE` other than `disabled` (default) or `test`. Neither mode makes real Integritas requests. At `/app/`, Lite displays Integritas proofs alongside a separate read-only `minima_native` history. Native records come from the existing tenant-scoped proof API for the currently loaded shipment page, regardless of Integritas mode. Lite supports native evidence details, verification and bundle export. Local Core job export, readiness and checkpoint/result import live at `/app/core#proofs`, on the same Gateway origin with the existing session, scopes and proof approval. The installed MiniDapp retains its separate Local Core Publisher link and signing flow. The Integritas feature flag has no effect on the Core workspace.

## Prepare and check a local proof

Start a disposable Gateway with `ENABLE_WEB_WORKSPACE=true`, `INTEGRITAS_MODE=test`, `PROOF_MODE=disabled`, and the exact workspace origin. Use the normal owner-approved pairing. After an eligible shipment transition, use the existing tenant owner bearer from a trusted API client:

```http
POST /v1/integritas/proofs
Content-Type: application/json

{"event_id":"<cargo event UUID>"}
```

The Gateway returns HTTP 202 and the same request ID for retries of the same tenant and event. The owner credential stays outside Lite. The workspace **Proofs** screen shows the preparation time, event, shipment, local status and operation ID. **Recheck test evidence** performs a new check and **Export test evidence** exports the same tenant-scoped request and canonical evidence. A read-scoped client can call `GET /v1/integritas/proofs`, `POST /v1/integritas/proofs/<id>/verify` with an empty JSON object and `GET /v1/integritas/proofs/<id>/bundle`. Requests from another tenant cannot retrieve the record.

Migration 010 stores an immutable request and a separate worker state. The versioned envelope `trackium:cargo:integritas:v1` binds the exact canonical cargo event, including its previous hash, to its existing SHA-256. The new stamp digest is NIST SHA3-256 over the UTF-8 canonical envelope. The original SHA-256 and ledger are unchanged. Preparation is explicit, with no historical scan. Local test verification confirms the envelope digest and deterministic mock operation ID. It always reports `TEST_ONLY` and `on_chain_verified: false`.

The worker persists an uncertain submission intent before invoking its transport. After a timeout with no UID or a crash in that window, it keeps `unknown` and never submits again. A known UID permits reads for reconciliation. Provider-reported inclusion would only be `anchored` under the wire adapter. Independent chain and depth verification is a separate gate before any live `verified` state. Disabling the feature pauses work and preserves the request and state.

## Published provider contract and live gates

- Integritas v1 uses an `x-api-key`, JSON `{hash}` containing SHA3-256, `POST /core/v1/timestamp/post`, and `POST /core/v1/timestamp/status` with `{uids:[…]}`. A successful stamp yields a UID. Status can report `onchain:false` before a completed proof. `x-request-id` is described as trace metadata. No documented idempotency or recovery by trace ID was found. Source fixtures exercise the documented wire shape without issuing requests. [v1 stamp](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/send-hash-uid/) · [v1 status](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/get-proof/) · [v1 proof verification](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/verify-hash/)
- v2 documents stamp, file check and file verification. A full match can report a block number, TxPoW ID and transaction ID. A not-found result does not disambiguate a still-pending stamp from an unaccepted request. The docs show two base hostnames and examples in TypeScript, Python and cURL. They link an MCP integration. No official versioned client SDK, confirmation-depth/network contract, retry SLA or account quota was established from the published references reviewed. [v2 API](https://docs.integritas.technology/docs/technical-docs/api-docs/v2/) · [v2 response schema](https://docs.integritas.technology/docs/technical-docs/api-docs/v2/response-schema/) · [MCP](https://docs.integritas.technology/docs/technical-docs/mcp/)
- Before enabling real stamping, confirm the canonical hostname and network, credentials for an authorized environment, costs and rate/error limits, how to reconcile an ambiguous submission without UID, and independent proof verification against the correct Minima chain at an agreed depth. Require a separate operator approval. No paid or real stamping was used for this change.
