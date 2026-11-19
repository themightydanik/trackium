# AOVX Gateway ingress

When `TCP_PROTOCOL=aovx`, the Gateway reassembles complete AOVX frames,
validates the generic envelope and declared body length, observes the
unconfirmed XOR checksum candidate, attempts conservative semantic parsing,
and persists the exact original wire frame plus observational metadata.
A parse failure does not discard a structurally valid frame.

The journal also maintains `gateway_aovx_device_observations`, a derived,
non-authoritative view of traffic. It records first/last seen timestamps,
packet count, latest message metadata, and timestamps for observing message
IDs `0x0100` (registration) and `0x0102` (authentication).

These timestamps are observations only. They do not mean registration was
accepted or an authentication code was valid. No device is marked
authenticated, activated, trusted, or tenant-owned.

## Read-only operator API

The endpoints below are disabled unless `AOVX_OBSERVATIONS_TOKEN` is
configured. The token must contain 32–512 URL-safe characters. Supply it as
`Authorization: Bearer <token>`.

- `GET /internal/aovx/devices?limit=100&cursor=<12-hex-device-id>`
- `GET /internal/aovx/devices/<12-hex-device-id>`

The API is operator-wide because devices are not yet tenant-bound. It is
deliberately separate from tenant-scoped `/v1` APIs and must only be enabled
with a strong deployment secret. The token is compared in constant time.
No write methods are implemented. Without configuration the endpoint returns
404; invalid or missing credentials return 401 when enabled.

Do not expose the operator token in browser code, logs, URLs, or client apps.
Prefer access through a private network or administrative tunnel. Rotate the
token by replacing the deployment secret and restarting Gateway.

## Controlled physical-device pilot

The Compose profile keeps both HTTP and TCP on loopback by default. To accept
a tracker connection from a mobile network, set:

```dotenv
TCP_PROTOCOL=aovx
TCP_BIND_ADDRESS=0.0.0.0
```

Then recreate the Gateway and allow inbound **TCP only** on port 9000 in the
host firewall. Keep HTTP 8080 and PostgreSQL private; do not publish either
port. Verify the effective mapping with `docker compose config` before
starting the service. Use a temporary pilot window and close the firewall
rule again afterwards.

**Important security boundary:** the current AOVX ingress is an unauthenticated
binary capture listener. It does not yet authenticate a device, bind it to a
tenant, verify the checksum algorithm, or establish GL110-GL V1.2 compatibility.
A publicly reachable listener can therefore receive arbitrary traffic and
consume bounded Gateway resources. Do not treat a packet or observed device ID
as proof of identity. Keep the pilot isolated, monitor logs and database
growth, and do not use this as a production endpoint.

The operator API remains on the private HTTP listener. Compose passes
`AOVX_OBSERVATIONS_TOKEN` into the container; leave it empty to keep the API
disabled. If enabled, use a generated 32–512 character URL-safe secret and
access the HTTP API only through localhost or an administrative tunnel.

## Read-only raw packet inspection

The protected operator API also exposes recent AOVX frames:

- `GET /internal/aovx/packets?limit=25`
- `GET /internal/aovx/packets?limit=25&device_id=<12-hex-device-id>`
- `GET /internal/aovx/packets?limit=25&before=<packet-id>`

Use the same `Authorization: Bearer <token>` header as the device-observations
API. Pages are newest-first, capped at 50 packets, and use the last returned
packet ID as `next_cursor` for the next older page. Each item includes the
original frame as lowercase `raw_payload_hex`, its SHA-256, receive time,
remote address, parser metadata and payload length. Payload hex is capped at
64 KiB per frame; `payload_truncated` indicates when a larger stored payload
was clipped. The endpoint is read-only and operator-wide. Keep it private and
never place the token in a URL, browser bundle, or logs.

The Gateway still sends no registration responses, ACKs, commands, or
configuration. Checksum validation remains unconfirmed, and the generic GAL
workbook is not proof of GL110-GL V1.2 compatibility.
