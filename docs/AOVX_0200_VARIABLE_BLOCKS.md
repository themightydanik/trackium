# AOVX 0x0200 variable-length blocks

## Evidence from the protocol workbook

The 0x0200 sheet defines the variable section after the 40-byte fixed prefix:

- Base station information (bs): 2 + m * 13 bytes. Each 13-byte record is MCC (2), MNC (2), CI (4), LAC (4), RSSI (1).
- Device firmware version (fw): 2 + n bytes.

Captured GL110-GL samples show matching two-byte envelopes:
- F0 0D followed by 13 bytes (one base-station record).
- F0 1A followed by 26 bytes (two base-station records).
- F2 34 followed by 52 printable ASCII bytes containing the firmware-version string.

The tag association is based on observed captures aligned with the workbook's ordered field layout and declared lengths. It is limited to these observed forms.

## Decoder behavior

The offline message parser walks the variable section as two-byte tag/length envelopes while each declared value fits in the remaining bytes.

- Every block retains its numeric tag, declared length, raw value and hex.
- Tag 0xF0 is split into 13-byte base-station records only when the value length is a non-zero multiple of 13. MCC, MNC, CI and LAC remain raw hex; RSSI remains a raw byte. No endian conversion or signal scale is assumed.
- Tag 0xF2 gets an optional ASCII view only when every value byte is printable.
- Other tags remain opaque.
- If a block declares more bytes than remain, the incomplete suffix is preserved in unparsedVariableData; it does not invalidate the frame.
- The original remainingBody remains unchanged for compatibility.

This is descriptive offline parsing only. It does not change TCP ingestion, acknowledgements, device configuration, persistence, or production behavior.
