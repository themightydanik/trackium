# AOVX Gateway ingress

When `TCP_PROTOCOL=aovx`, the Gateway:

1. Reassembles complete AOVX frames from arbitrary TCP chunks.
2. Validates the generic envelope and declared body length.
3. Compares the received checksum with the unconfirmed XOR candidate for observation only.
4. Attempts the pure semantic body parser.
5. Persists the exact original wire frame plus observational metadata.

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

This remains capture and observation only. The six-byte protocol device ID is
not a verified Trackium device identity; no tenant or device ownership is
assigned. The Gateway does not send registration responses, ACKs, commands,
or configuration. Checksum validation remains unconfirmed, and the generic
GAL workbook is not proof of GL110-GL V1.2 compatibility.
