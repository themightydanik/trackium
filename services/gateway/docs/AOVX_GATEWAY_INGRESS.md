# AOVX Gateway ingress mode

The Gateway supports explicit TCP protocol selection:

- `TCP_PROTOCOL=raw` (default): existing synthetic newline-delimited raw capture.
- `TCP_PROTOCOL=aovx`: reassembles AOVX frames, validates delimiters, escaping and declared body length, then journals the exact original wire frame.

## Checksum status is provisional

The generic workbook says a checksum is present and must be verified, but its extracted examples conflict:

| Message | Workbook checksum | XOR over unescaped header + body | Result |
|---|---:|---:|---|
| `0x0102` authentication | `0x3E` | `0x3E` | match |
| `0x0100` registration | `0x48` | `0x1C` | mismatch |
| `0x8100` registration response | `0x3F` | `0xBD` | mismatch |

XOR is therefore an **unconfirmed candidate**, not an authoritative AOVX checksum algorithm. The decoder reports `checksumStatus` as `xor-match` or `xor-mismatch`. Its default `observe` policy accepts either status after structural validation. The opt-in `require-xor-match` policy is intended only for controlled fixtures.

The encoder still emits the XOR candidate for synthetic tests. Do not use it to construct production commands until checksum behavior is confirmed against the original workbook and real GL110-GL traffic.

## Deliberate scope boundary

This is not yet a GL110-GL V1.2 integration claim. AOVX mode does not parse `0x0200` telemetry, process registration/authentication, construct or send `0x8001` acknowledgements, map device IDs to tenants, or apply per-device authorization. It is a structurally validated binary-frame capture path only. Keep the TCP listener behind a private network/firewall until identity, authentication and tenant authorization exist.

The mode is selected at startup and does not auto-detect protocols. The default remains `raw`.

## Configure

```dotenv
TCP_PROTOCOL=aovx
```

Recreate the Gateway container. `/readyz` reports `aovx-frame-capture-only` in this mode and `raw-capture-only` otherwise.

## Validation

Tests cover split TCP chunks, coalesced frames, escaping, exact raw-wire persistence, structural rejection and checksum-mismatch observation. Physical GL110-GL compatibility still requires captured device traffic and manufacturer confirmation of the exact firmware profile.
