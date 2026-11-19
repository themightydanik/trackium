# AOVX message parsing foundation

`src/aovx/messages.js` parses selected message bodies after the generic frame
envelope has been structurally decoded.

## Implemented message bodies

- `0x0100`: fixed registration body fields (province, district, manufacturer,
  device type, terminal ID, plate color and vehicle logo).
- `0x0102`: authentication code retained as bytes, with an optional printable
  ASCII view.
- `0x8100`: reply sequence, registration result and authentication code.
- `0x8001`: response sequence, corresponding message ID and result.
- `0x0001`: response sequence, corresponding device message ID and result.
- `0x0200`: fixed telemetry prefix through GNSS satellite count. Raw numeric
  values and BCD timestamp bytes are exposed without applying undocumented
  scaling, timezone, coordinate or unit assumptions. Remaining bytes are kept
  opaque because optional/model-dependent fields vary by configuration.

Other message IDs, including `0x0900`, `0x0104`, `0x8103` and `0x8104`,
remain opaque until their layouts are implemented from verified fixtures.

## Safety and compatibility boundary

This module is a pure parser. It does not register or authenticate a device,
authorize a tenant, send an ACK, issue configuration commands, or infer that
the generic GAL workbook applies to GL110-GL V1.2. The checksum remains
observational and unconfirmed. Do not enable protocol responses based only on
these workbook examples.

The parser is intentionally conservative: it preserves raw bytes, validates
only documented fixed lengths, and avoids converting raw telemetry into
physical units until the exact encoding is confirmed against real device data.
