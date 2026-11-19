# AOVX 0x0200 observed variable extensions

## Evidence

The official workbook sheet `0x0200` defines these variable fields:

| Workbook field | Documented structure | Captured GL110-GL observation | Parser treatment |
|---|---|---|---|
| WiFi list | `2 + m*7` bytes; each node is MAC (6) + RSSI (1) | Tag `F4` has a 35-byte value in all 50 analyzed packets: five 7-byte records | Parse record boundaries and retain MAC/RSSI as raw values |
| Battery information | `2 + 4 + [1 + [1]]` bytes | Tag `F7` has a 6-byte value in all 50 packets | Expose four voltage bytes and optional charge-status / percentage bytes without conversion |
| Device general information | 31 bytes total | Tag `F8` has a 29-byte value in all 50 packets; tag + length + value = 31 bytes | Validate envelope length only; do not decode or duplicate identifiers |
| Sensor information | Workbook describes a structured, mask-dependent payload | Tag `F6` has a stable 14-byte value in all 50 packets | Preserve as opaque |
| Assistant information | Workbook describes a larger structured payload | Tag `F9` has a stable 18-byte value in all 50 packets | Preserve as opaque |

The 50-packet length histogram had no truncated TLV blocks. The F4 length is an exact multiple of the workbook's 7-byte WiFi node structure. F7 and F8 lengths align with their workbook field sizes, but this does not establish the meaning, scaling, or byte order of their values.

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
- No interpretation of F6 or F9.
- No changes to TCP ingestion, acknowledgements, persistence, database schema, device settings, or production configuration.

WiFi MAC addresses can reveal nearby network infrastructure and should be treated as sensitive diagnostic data. The parser change is descriptive and does not add them to any new public endpoint.
