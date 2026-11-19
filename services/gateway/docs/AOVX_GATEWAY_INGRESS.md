# AOVX Gateway ingress mode

The Gateway now supports an explicit TCP protocol selection:

- `TCP_PROTOCOL=raw` (default): preserves the existing synthetic newline-delimited raw-capture behavior.
- `TCP_PROTOCOL=aovx`: uses the AOVX TCP stream framer, validates the generic frame envelope, body length and XOR checksum, then journals the exact original wire frame (including delimiters and escape bytes).

The mode is selected at process startup. It does not auto-detect protocols. Never point a device at a raw-mode listener expecting binary AOVX frames.

## Deliberate scope boundary

This is not yet a GL110-GL V1.2 integration claim. The AOVX mode does not parse `0x0200` telemetry, process registration/authentication, construct or send `0x8001` acknowledgements, map a device ID to a tenant, or apply per-device authorization. It is a validated binary-frame capture path only. Keep the TCP listener behind a private network/firewall until device identity and tenant authorization are implemented.

The default remains `raw`, so existing local synthetic workflows and the Railway test profile are unchanged. Railway test config explicitly disables TCP as before.

## Configure

In Compose, set:

```dotenv
TCP_PROTOCOL=aovx
```

Then recreate the Gateway container. `/readyz` reports `aovx-frame-capture-only` when this mode is active, and `raw-capture-only` otherwise.

## Validation

Gateway tests exercise split TCP chunks, multiple coalesced frames, escaped delimiter bytes, exact raw-wire persistence, invalid-checksum rejection and the unchanged default raw mode. Physical GL110-GL compatibility still requires captured device traffic and manufacturer confirmation of the exact firmware profile.
