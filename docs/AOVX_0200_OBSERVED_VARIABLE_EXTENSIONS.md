# AOVX 0x0200 observed variable extensions

## Evidence

The official workbook sheet `0x0200` defines these variable fields:

| Workbook field | Documented structure | Captured GL110-GL observation | Parser treatment |
|---|---|---|---|
| WiFi list | `2 + m*7` bytes; each node is MAC (6) + RSSI (1) | Tag `F4` has a 35-byte value in all 50 analyzed packets: five 7-byte records | Parse record boundaries and retain MAC/RSSI as raw values |
| Battery information | `2 + 4 + [1 + [1]]` bytes | Tag `F7` has a 6-byte value in all 50 packets | Expose four voltage bytes and optional charge-status / percentage bytes without conversion |
| Device general information | 31 bytes total | Tag `F8` has a 29-byte value in all 50 packets; tag + length + value = 31 bytes | Validate envelope length only; do not decode or duplicate identifiers |
| Sensor information | `2 + 1 + 1 + m*(2+2+2+6+10+2+2+2)` bytes, including mask/event/count and mask-dependent sensor records | Tag `F6` has a 14-byte value in all 50 packets; 19 distinct values. Every value begins `00 0f`; the next two bytes vary and the remaining bytes vary by sample | Preserve as opaque: 14 bytes does not match the documented fixed prefix plus a complete sensor record |
| Assistant information | Workbook describes a mask-dependent payload with a two-byte mask and optional fields | Tag `F9` has the same 18-byte value in all 50 packets: `000f00000000000000000000000000000000` | Preserve as opaque: the observed mask/value layout has not been independently validated against the workbook's optional-field ordering |

The 50-packet length histogram had no truncated TLV blocks. The F4 length is an exact multiple of the workbook's 7-byte WiFi node structure. F7 and F8 lengths align with their workbook field sizes, but this does not establish the meaning, scaling, or byte order of their values.

### F6/F9 value comparison (50-packet capture)

- F6: 50/50 values are 14 bytes. There are 19 distinct values. The first two bytes are `00 0f` in 49 packets and `10 0f` in one packet. The following byte is usually `00`, with one observed `10`; the next byte varies across values. Remaining bytes are retained exactly as captured. These byte patterns are observations only; no mask bit order, event type, sensor count, or sensor measurements are assigned.
- F9: 50/50 values are identical, 18 bytes: `00 0f` followed by 16 zero bytes. This is consistent with a stable mask-like prefix and zero-valued remainder, but does not prove the exact field boundaries or optional-field ordering.
- The workbook's sensor structure requires a two-byte prefix, one-byte trigger/event field, one-byte count, and zero or more substantially larger sensor records. A 14-byte F6 value cannot safely be treated as one complete documented sensor record.
- The workbook's assistant section describes optional fields controlled by a mask. The 18-byte F9 sample alone does not establish a reliable field-by-field decode, so it remains opaque.

## Parser behavior

- F4 is parsed as 7-byte records with raw six-byte MAC and one-byte RSSI fields.
- F7 is split into a four-byte raw battery-voltage field and optional raw charge-status and battery-percentage bytes.
- F8 exposes only tag, declared length, value length, and envelope-match status. Its payload is deliberately not decoded because it contains device identifiers such as IMEI and ICCID.
- F6, F9, and other unrecognized complete TLVs remain in `opaqueExtensions` with their raw bytes.
- Incomplete trailing TLV bytes remain in `unparsedTail`.
- Existing F0 base-station and F2 firmware properties remain available.

## Deliberately not inferred

- No WiFi MAC vendor lookup, geolocation, or interpretation of RSSI scale.
- No conversion of battery voltage bytes to a number or unit.
- No interpretation of charge-status or percentage values beyond exposing their raw bytes.
- No decoding of F8 identifiers.
- No interpretation of F6 or F9; observed byte patterns are documented only as capture evidence.
- No changes to TCP ingestion, acknowledgements, persistence, database schema, device settings, or production configuration.

WiFi MAC addresses can reveal nearby network infrastructure and should be treated as sensitive diagnostic data. The parser change is descriptive and does not add them to any new public endpoint.
