# AOVX Gateway ingress

When `TCP_PROTOCOL=aovx`, the Gateway:

1. Reassembles complete AOVX frames from arbitrary TCP chunks.
2. Validates the generic envelope and declared body length.
3. Compares the received checksum with the unconfirmed XOR candidate for observation only.
4. Attempts the pure semantic body parser.
5. Persists the exact original wire frame plus observational metadata.
6. Updates a per-device observation row in the same PostgreSQL statement as packet persistence.

The raw wire bytes and SHA-256 remain the authoritative capture. A semantic
body parse failure does not discard a structurally valid frame: it is stored
with `aovx_parse_status='error'` and a bounded `aovx_parse_error`. Unknown
message IDs are stored with `aovx_parse_status='opaque'`. Successfully parsed
messages use `aovx_parse_status='parsed'`.

The journal metadata columns are additive and are installed idempotently when
the Gateway initializes. They include message ID, the six-byte device ID as
BCD hex, message sequence, observational checksum status, parser status/error,
and JSON-safe parsed body values. Binary fields in JSON are represented as
`{"encoding":"hex","value":"..."}`.

## Device observations

`gateway_aovx_device_observations` is a derived, non-authoritative view of
traffic seen by the Gateway. It records the first/last packet timestamps,
packet count, most recently observed message metadata, and whether message
IDs `0x0100` (registration) and `0x0102` (authentication) have ever been
observed for that BCD device identifier.

These are event observations only:
- Seeing `0x0100` does not mean registration was accepted.
- Seeing `0x0102` does not mean the authentication code was valid.
- No device is marked authenticated, activated, trusted, or tenant-owned.
- A device identifier is only a protocol identifier, not a verified Trackium identity.
- The raw packet and observation update commit atomically; malformed identifiers
  remain in the raw packet journal but do not create device rows.

This remains capture and observation only. The Gateway does not send
registration responses, ACKs, commands, or configuration. Checksum validation
remains unconfirmed, and the generic GAL workbook is not proof of GL110-GL V1.2
compatibility.
