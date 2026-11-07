# Trackium Gateway Core — PR #2

First **raw-capture-only** foundation for Trackium Free and Managed. Not yet suitable for direct production exposure or a commercial pilot.

## Run locally

1. Copy `.env.example` to `.env`, set a strong `POSTGRES_PASSWORD`.
2. Run `docker compose -f compose.yml up --build -d`.
3. Check `curl http://127.0.0.1:8080/readyz`.
4. Send a **synthetic newline-delimited fixture only**: `printf 'fixture-001\\n' | nc 127.0.0.1 9000`.
5. Inspect saved packets with `docker compose -f compose.yml exec db psql -U trackium -c 'select id, received_at, sha256 from gateway_packets;'`.
6. Run `npm test` from this directory for framing tests.

## Limitations and security
- The TCP receiver uses **temporary newline framing**. It is NOT a verified AOVX GL110-GL parser; binary packets, device acknowledgements, device authentication and MQTT are NOT implemented.
- Do not expose TCP port 9000 to the public Internet until a real device protocol adapter, tenant binding, network controls and rate limiting have been implemented.
- The journal stores raw packets in PostgreSQL and a SHA-256 transport fingerprint. This fingerprint is **not** the SHA3-256 Minima evidence commitment.
- HTTP endpoints expose only liveness and readiness, never raw data. Port 8080 binds to localhost in the provided compose file.
- Database must be backed up externally and monitored before production.
- Real pilot readiness additionally requires proof publishing/confirmation, authenticated client API, monitoring, backup/restore tests, secure deployment and real GL110-GL traffic.

## Next PR
Implement firmware-specific AOVX packet framing, verified fixtures, device identification and provisioning. Keep the raw journal and proof engine decoupled.
