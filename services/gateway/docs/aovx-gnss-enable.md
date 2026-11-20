# AOVX GNSS enable operation

Trackium exposes one narrowly scoped physical-device configuration operation:

`POST /internal/aovx/devices/:deviceIdBcd/gnss-enable`

The endpoint requires the configured `AOVX_OBSERVATIONS_TOKEN` as a Bearer token. It accepts no request body or query parameters. The route verifies that exactly one active binding exists and that its device is enabled, real, and physical.

## Exact device change

The gateway sends one AOVX `0x8103` Configuration Commands Parameters frame containing exactly one TLV:

- Parameter count: `1`
- Parameter ID: `0x0000F029` (GNSS Enable)
- Length: `1`
- Value: `0x01` (enabled)

No caller-provided parameter ID or value is accepted. This is a physical device configuration change, not a read-only diagnostic.

## Acknowledgement and verification

The gateway requires a successful `0x0001` general response correlated to the write sequence and corresponding message ID `0x8103`. It then sends the existing read-only `0x8104` query and only marks the operation verified when the `0x0104` response includes `0xF029 = 1`.

An acknowledged command without successful read-back is returned as unverified (HTTP 409). Missing write acknowledgement times out (HTTP 504). The write is never automatically retried. Disconnects and session identity changes fail pending operations.

Only one GNSS enable operation per BCD device can be active at a time. The gateway refuses missing or ambiguous TCP sessions and does not queue commands for offline devices.

## Operational boundary

Do not invoke this endpoint during development, tests, startup, or deployment. Invoke it only after reviewing the deployed code and confirming the intended physical device is connected. No other AOVX configuration parameter is writable through this endpoint.
