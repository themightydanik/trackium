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

## Observed variable telemetry extensions

The `0x0200` tail parser recognizes two observed length-prefixed blocks, in
the order present in the workbook example and GL110-GL captures:

- `0xF0`: base-station information. The workbook describes this field as
  `2 + m × 13` bytes; the parser checks that the declared value length is a
  positive multiple of 13 and exposes each 13-byte record as raw hex only.
- `0xF2`: device firmware version. The workbook describes an ASCII
  firmware string with a two-byte envelope; the parser exposes the value as
  ASCII only when the declared length is complete and every byte is printable.

The tag mapping is based on the workbook's `0x0200` sample and the observed
GL110-GL packets. No MCC, MNC, cell ID, LAC, RSSI, firmware subcomponents,
units, or other record semantics are inferred. Any bytes after these recognized
blocks remain in `observedExtensions.unparsedTail` and the original
`remainingBody` is preserved unchanged. Malformed or truncated blocks are
not consumed and do not invalidate the enclosing structurally decoded frame.

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
