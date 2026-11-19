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

The Gateway still sends no registration responses, ACKs, commands, or
configuration. Checksum validation remains unconfirmed, and the generic GAL
workbook is not proof of GL110-GL V1.2 compatibility.
