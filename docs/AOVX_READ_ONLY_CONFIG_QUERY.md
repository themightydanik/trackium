# AOVX read-only configuration query

Trackium supports an operator-only read of the AOVX GNSS Enable parameter.

## Protocol

- Server request: `0x8104` (empty body).
- General query acknowledgement: `0x0001`. This confirms the request and its result, but contains no parameter values.
- Parameter response: `0x0104`, with response sequence, parameter count, and repeated DWORD-ID / BYTE-length / value entries.
- GNSS Enable: parameter `0x0000F029`, one byte: `0 = disabled`, `1 = enabled`.
- Checksum: XOR from the first message-header byte through the last body byte; checksum byte excluded.
- Escaping: `0x7E -> 0x7D 0x02`, `0x7D -> 0x7D 0x01`.

A successful `0x0001` acknowledgement is not treated as a GNSS configuration result. Trackium waits for the matching `0x0104` parameter response. If the device sends only the acknowledgement, the query times out and no GNSS state is inferred.

## Operator endpoint

`POST /internal/aovx/devices/{12-digit-BCD}/config-query`

Authentication: existing `AOVX_OBSERVATIONS_TOKEN` bearer token. The endpoint additionally requires exactly one active binding to an enabled physical device in real mode.

The Gateway routes the request only when exactly one active TCP session has reported a checksum-valid `0x0200` frame for the requested BCD identifier. It refuses zero or multiple matching sessions. The request timeout is 12 seconds. Only `0x8104` is emitted by this feature; it does not send `0x8103` or mutate device configuration.

## Identity and trust boundary

The BCD value in an AOVX frame is an identifier, not cryptographic authentication. The existing device binding remains at its current trust level (including `unverified`). The configuration result is returned to the operator and written to the Gateway's structured logs; it is not persisted as a separate telemetry observation and does not promote device trust.

No production command is sent during tests or deployment. An operator must explicitly call the endpoint after reviewing and deploying the change.
