# Trackium Gateway Core

**Raw-capture TCP journal with Telemetry Core v1** for Trackium Free and Managed. Not suitable for direct production exposure or a commercial pilot.

Telemetry Core adds authenticated tenant-scoped registration/read APIs, an opt-in synthetic fixture adapter, additive PostgreSQL migrations and canonical event bytes. See [Telemetry Core v1](../../docs/TELEMETRY_CORE_V1.md) for provisioning, schema, API routes, tests and security limitations. TCP input still only enters the raw journal; it never becomes trusted telemetry automatically.

See [Gateway integration and server simulation](../../docs/GATEWAY_SHIPMENTS_SIMULATION.md) for owner-approved web sessions, shipment APIs, durable simulation, migration 002 and the PR #7 outbox. The web workspace and simulator are disabled by default. Compose now builds from the repository root; direct image builds use `docker build -f services/gateway/Dockerfile .` there.

## Run locally

From `services/gateway`, with Docker Engine and Docker Compose v2 installed:

1. Copy `.env.example` to `.env` and set a strong `POSTGRES_PASSWORD`. Quote values containing `$` with single quotes in `.env`. This file is ignored by Git and excluded from Docker builds. The password is passed using `PGPASSWORD`, rather than interpolated into a connection URI. Changing it later does not rotate credentials in an existing database volume.
2. Run `docker compose -f compose.yml up --build -d --wait`.
3. Check `curl -f http://127.0.0.1:8080/readyz` (database connectivity) and `/healthz` (process liveness). Readiness can recover after a transient database failure. Compose also checks readiness automatically.
4. Send a **synthetic newline-delimited fixture only**: `printf 'fixture-001\n' | nc -N 127.0.0.1 9000` (OpenBSD netcat; other versions may require `-q 1`). No device ACK is sent.
5. Inspect saved packets with `docker compose -f compose.yml exec db psql -U trackium -d trackium -c "select id, received_at, encode(raw_payload, 'hex') as payload_hex, sha256 from gateway_packets order by id;"`.
6. Run `docker compose -f compose.yml down` to stop. The PostgreSQL volume is retained; `down -v` deletes its data.

Both published ports (TCP 9000, HTTP 8080) bind to localhost. PostgreSQL has no published port. Password configuration is required before Compose will start. Startup creates the journal table and index idempotently. Dependencies are locked and installed with `npm ci` in the image. Builds behind an inspecting HTTPS proxy can supply its trusted CA as the optional BuildKit secret `proxy_ca`; TLS verification must remain enabled.

For native development, use Node.js >=22, run `npm ci`, set `DATABASE_URL` (percent-encode any password in the URI), then run `npm start`. Run `npm test` for focused tests of framing, TCP lifecycle, write failures, reconnects, resource limits, readiness, shutdown and telemetry normalization; these tests use an injected journal and do not require PostgreSQL. Validate real database persistence separately with the Compose fixture above.

## Receiver behavior and limits

- Temporary LF (`0x0a`) framing supports fragmented and coalesced TCP chunks. LF is removed, all other bytes (including CR) are preserved, and empty frames are ignored. An unterminated suffix is discarded on disconnect; it never carries into a new connection.
- Complete accepted frames are written sequentially **within each connection**, including after client disconnect. There is no total arrival order across clients, and identity IDs/timestamps are not a cross-client ordering guarantee.
- A database write failure closes that client and skips its later queued frames. Other clients and new connections can continue. There is no automatic retry, deduplication or exactly-once guarantee; a connection/query failure can leave the commit result uncertain.
- Backpressure pauses socket reads while its accepted frames drain. Global pending-frame and pending-payload-byte budgets include in-flight writes, including those belonging to disconnected clients. Exceeding a limit closes the client and stops parsing that chunk; previously accepted frames still drain unless a database write fails.
- Disconnected clients retain a connection slot until their writes settle. The payload budget excludes framing buffers (at most `MAX_FRAME_BYTES` per retained connection), Node/socket buffers and object overhead; it is not a whole-process RSS limit.
- SIGTERM/SIGINT stop admission and socket reads, discard unaccepted bytes, close listeners, wait for accepted writes and active HTTP requests, then close the PostgreSQL pool. The deadline is 10 seconds by default (Compose allows 15). Timeout exits with failure and may leave accepted writes incomplete. There is no durable pre-database queue.
- Database connections and statements have 5-second timeouts, with a 6-second client query deadline. Idle pool connection errors are logged instead of becoming unhandled events.

Native environment settings (positive integers, rejected when invalid):

| Variable | Default | Meaning |
| --- | --- | --- |
| `TCP_PORT` / `HTTP_PORT` | `9000` / `8080` | Listener ports, 1–65535 |
| `MAX_FRAME_BYTES` | `65536` | Maximum payload per line, up to 16 MiB |
| `MAX_CONNECTIONS` | `100` | Connected or draining TCP sessions |
| `MAX_PENDING_FRAMES` | `100` | Global queued and in-flight frame budget |
| `MAX_PENDING_BYTES` | `8388608` | Global queued and in-flight payload byte budget |
| `SOCKET_TIMEOUT_MS` | `120000` | Socket inactivity timeout |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown deadline |

Compose uses these defaults; changing them requires a Compose environment override. Keep `stop_grace_period` longer than the shutdown deadline.

See [Minima Proof Engine](../../docs/MINIMA_PROOF_ENGINE.md) for additive migration 003, disabled/test/live modes, private-node configuration and proof API/verification.

## Limitations and next protocol work

- This is NOT a verified AOVX GL110-GL parser. Real binary packet framing, firmware-specific validation, device acknowledgements, authentication, provisioning and MQTT are not implemented. Arbitrary bytes in a synthetic line are preserved, but embedded LF splits that line.
- Do not expose TCP 9000 publicly before implementing protocol authentication, tenant binding, network controls and rate limiting. Telemetry API routes require scoped tenant credentials; the raw TCP receiver still has no device authentication, TLS or tenant binding. Retention policy is not implemented.
- The journal stores raw packets and a SHA-256 transport fingerprint. This is separate from the versioned cargo commitment (also SHA-256) and Minima object identifiers (SHA3-256). Optional server proof publication is documented separately; Integritas and Android integration remain outside this implementation.
- Disk usage is unbounded. PostgreSQL needs backups, monitoring and restore verification. Process crashes, forced shutdowns, overload and ambiguous database errors can lose or duplicate data on resend; no delivery assurance is claimed.
- GL110-GL integration needs the actual firmware version, authoritative protocol details and captured traffic with verified fixtures: frame boundaries/lengths/checksums, device identity, login/heartbeat, ACK/retry behavior, transport choice and disconnect/reconnect behavior. Bind devices to tenants before downstream processing and keep the raw journal decoupled from the future proof engine.
