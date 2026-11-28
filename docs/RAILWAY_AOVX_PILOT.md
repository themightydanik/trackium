# Railway AOVX GL110 pilot ingress

This is a deliberately separate profile for a controlled physical-device pilot. It does not weaken or replace `railway-test`: that profile remains HTTP-only and continues to reject TCP receiver enablement.

## Scope and safety

- Keep the existing Railway project, PostgreSQL service, Gateway service, private `DATABASE_URL`, HTTPS HTTP domain, and single Gateway replica.
- Set `DEPLOYMENT_PROFILE=railway-aovx-pilot`. The profile requires `ENABLE_NATIVE_CLIENTS=true`, an explicit HTTPS `PUBLIC_ORIGIN`, `ENABLE_TCP_RECEIVER=true`, and `TCP_PROTOCOL=aovx`.
- Proof publication remains disabled; live/Mainnet flags remain false; simulator and fixture ingestion remain disabled. The profile refuses startup if any of these safety settings are overridden.
- The AOVX listener captures and persists inbound frames. Server ACKs are default-off. Enabling them requires the controlled rollout in [AOVX server acknowledgements](AOVX_SERVER_ACK.md). BCD alone does not authenticate hardware. Use the public listener only for the controlled pilot and monitor storage and connection budgets.
- The existing HTTP listener remains on Railway's supplied `PORT`; do not change its HTTPS domain target to 9000. The TCP listener binds `0.0.0.0` inside the container (the Gateway's existing default) on `TCP_PORT=9000`.

## Apply after the code PR is merged

1. Confirm the existing `trackium-gateway` deployment is healthy and the PostgreSQL service remains unchanged.
2. In the existing Gateway service, set these variables:
   - `DEPLOYMENT_PROFILE=railway-aovx-pilot`
   - `ENABLE_NATIVE_CLIENTS=true`
   - `ENABLE_TCP_RECEIVER=true`
   - `TCP_PROTOCOL=aovx`
   - `TCP_PORT=9000`
   - Keep `ENABLE_SERVER_SIMULATOR=false`, `ENABLE_FIXTURE_ADAPTER=false`, `PROOF_MODE=disabled`, `PROOF_ALLOW_LIVE=false`, `PROOF_ALLOW_MAINNET=false`, and `PROOF_MAX_PUBLICATIONS=1`.
   - Preserve the existing `DATABASE_URL`, `PUBLIC_ORIGIN`, and Railway `PORT`. Do not create a new database or project.
3. Deploy and verify `/healthz` and `/readyz` return 200. Confirm logs show the TCP listener on 9000 and HTTP listener on Railway's assigned port. Check the AOVX observations API remains token-protected.
4. Only after the application is listening, create exactly one Railway TCP Proxy for application port 9000 on the existing Gateway service. Do not create a TCP proxy for PostgreSQL. Record the generated public `host:port`; never assume it is port 9000 externally.
5. Configure one GL110 to that generated TCP endpoint using the vendor's supported configuration path. Do not send guessed ACKs or server commands. Verify packets via the protected `/internal/aovx/packets` endpoint.
6. If the pilot is paused, remove the Gateway TCP Proxy and set `ENABLE_TCP_RECEIVER=false`; return `DEPLOYMENT_PROFILE=railway-test` only after setting the receiver false and redeploying.

## Operational limits

The existing Gateway limits apply: maximum concurrent connections, pending frames/bytes, frame size, socket timeout, and bounded shutdown drain. The public TCP proxy is not an authentication boundary or a DDoS control. Do not attach unrelated services or expose any additional application ports. Do not publish the observations token in device configuration; it is only for operator HTTP reads.
