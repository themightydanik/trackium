# AOVX protocol foundation

This module implements only the transport frame envelope shared by the AOVX protocol workbook profile. It does not claim that GL110-GL V1.2 firmware compatibility has been confirmed by the supplied generic GA/GAL documents.

## Implemented

- `0x7E` frame delimiters.
- Escaping and unescaping: `7E -> 7D 02` and `7D -> 7D 01`.
- 12-byte message header: message ID (2), properties (2), device ID (6 BCD), sequence (2).
- Body length from the low 10 bits of the properties field.
- XOR checksum over the unescaped header and body.
- Strict length, escape, delimiter and checksum validation.

## Verification basis

The hidden workbook sheet for `0x0102` contains a complete authentication sample ending in checksum `0x3E`. XOR over the unescaped bytes preceding the checksum reproduces `0x3E`. The tests use this sample as the checksum fixture and round-trip additional frames containing both escaped values.

The workbook's `0x8001` sample appears inconsistent with XOR when transcribed from the extracted cell values. It is deliberately not used as a valid checksum fixture until checked against the original workbook layout or a captured device packet.

## Not implemented yet

- Device registration policy and authentication/session state.
- `0x0200` telemetry body parsing.
- `0x8001` ACK construction/dispatch.
- TCP stream accumulator for multiple/split AOVX frames.
- GL110-specific firmware compatibility verification.

These are separate follow-up changes so that framing correctness can be reviewed independently.
