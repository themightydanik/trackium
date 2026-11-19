# AOVX protocol foundation

This module implements the transport envelope described by the AOVX GAL-series protocol workbook. It does not claim that GL110-GL V1.2 firmware compatibility has been confirmed by the supplied generic GA/GAL documents.

## Frame codec

- `0x7E` frame delimiters.
- Escaping and unescaping: `7E -> 7D 02` and `7D -> 7D 01`.
- 12-byte message header: message ID (2), properties (2), device ID (6 BCD), sequence (2).
- Body length from the low 10 bits of the properties field.
- XOR checksum over the unescaped header and body.
- Strict length, escape, delimiter and checksum validation.

## TCP stream framing

`createAovxStreamFramer` is a transport-level accumulator. It handles arbitrary TCP chunk boundaries, extracts multiple coalesced frames, preserves the exact wire bytes (including delimiters and escape sequences), ignores bytes before a start flag, and discards incomplete data when the connection closes.

The stream framer deliberately does not decode or authenticate messages. Pass each emitted frame to `decodeAovxFrame` in a later protocol-ingress integration. Oversized frames fail the current stream closed.

## Verification basis

The hidden workbook sheet for `0x0102` contains a complete authentication sample ending in checksum `0x3E`. XOR over the unescaped bytes preceding the checksum reproduces `0x3E`. Tests use this sample as the checksum fixture and round-trip additional frames containing both escaped values.

The workbook's `0x8001` sample appears inconsistent with XOR when transcribed from the extracted cell values. It is deliberately not used as a valid checksum fixture until checked against the original workbook layout or a captured device packet.

## Not implemented yet

- Device registration policy and authentication/session state.
- `0x0200` telemetry body parsing.
- `0x8001` ACK construction/dispatch.
- TCP Gateway protocol-mode selection and raw packet persistence integration.
- GL110-specific firmware compatibility verification.

These are separate follow-up changes so framing, protocol parsing and device identity policy can be reviewed independently.
