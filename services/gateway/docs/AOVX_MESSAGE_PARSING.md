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
  scaling, timezone, coordinate or unit assumptions.

## Telemetry byte diagnostics

For `0x0200`, the parser now also returns a diagnostic map of fixed-prefix
field offsets and a byte-oriented view of the opaque tail:

- body length and fixed-prefix length;
- byte offset and length for each documented fixed-prefix field;
- tail offset (40), byte length and complete hex representation;
- 16-byte chunks with absolute body offsets, spaced hex bytes and printable
  ASCII (non-printable bytes appear as dots);
- `timestampBcdDigits`, populated only when every BCD nibble is valid.

The BCD digit view is not a date/time conversion: no timezone or calendar
validity is inferred. Numeric telemetry fields remain raw and no coordinate,
speed, altitude, mileage or signal units are assumed. The tail remains opaque;
printable strings or repeated byte patterns are diagnostic clues, not a
confirmed extension schema.

The `0x0200` workbook example declares a 76-byte body. Its parser test checks
the documented 40-byte fixed prefix and uses a synthetic 36-byte opaque tail;
that test is not a complete captured wire-frame fixture and is not a GL110
device fixture.

## Other messages

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
