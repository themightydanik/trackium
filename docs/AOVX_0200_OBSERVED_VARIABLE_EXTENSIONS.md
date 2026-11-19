# AOVX 0x0200 observed variable extensions

## Evidence

The official workbook sheet `0x0200` defines these variable fields:

| Workbook field | Documented structure | Captured GL110-GL observation | Parser treatment |
|---|---|---|---|
| WiFi list | `2 + m*7` bytes; each node is MAC (6) + RSSI (1) | Tag `F4` has a 35-byte value in all 50 analyzed packets: five 7-byte records | Parse record boundaries and retain MAC/RSSI as raw values |
| Battery information | `2 + 4 + [1 + [1]]` bytes | Tag `F7` has a 6-byte value in all 50 packets | Expose four voltage bytes and optional charge-status / percentage bytes without conversion |
| Device general information | 31 bytes total | Tag `F8` has a 29-byte value in all 50 packets; tag + length + value = 31 bytes | Validate envelope length only; do not decode or duplicate identifiers |
| Sensor information | TLV value: one-byte data type + one-byte field mask + selected fields in mask-bit order; field widths for bits 0–7 are 2, 2, 2, 6, 10, 2, 2, 2 bytes | Tag `F6` has a 14-byte value in all 50 packets; 19 distinct values. Values begin with data type `00` or `10`, then mask `0f` | Parse exact mask-derived boundaries and expose raw field slices; preserve unsupported lengths as opaque |
| Assistant information | Two-byte mask followed by optional fields; bits 0–3 describe 4, 4, 2, and 6-byte fields respectively | Tag `F9` has the same 18-byte value in all 50 packets: `000f00000000000000000000000000000000` | For the exact observed mask `0x000f` and 18-byte value, expose four raw slices aligned to the workbook; no numeric conversion. Other masks/lengths remain opaque |

The 50-packet length histogram had no truncated TLV blocks. The F4 length is an exact multiple of the workbook's 7-byte WiFi node structure. F7 and F8 lengths align with their workbook field sizes, but this does not establish the meaning, scaling, or byte order of their values.

### F6/F9 value comparison (50-packet capture)

- F6: 50/50 values are 14 bytes. There are 19 distinct values. The first byte is `00` in 47 packets and `10` in three packets; the second byte is `0f` in all 50. The workbook defines the first value byte as data type and the second as an 8-bit field mask. Mask `0x0f` selects Light (2), Temperature (2), Humidity (2), and Accelerometer (6), exactly accounting for the remaining 12 bytes. Data type `0x00` is Periodic sampling; `0x10` (16) is in the workbook's reserved range 14–74. Field values remain raw; no units, scaling, signedness, or byte order are inferred.
- F9: 50/50 values are identical, 18 bytes: `00 0f` followed by 16 zero bytes. This is consistent with a stable mask-like prefix and zero-valued remainder, but does not prove the exact field boundaries or optional-field ordering.
- The workbook's sensor formula includes a two-byte TLV header followed by one-byte data type, one-byte field mask, and mask-selected fields. For the observed mask `0x0f`, the value is exactly 14 bytes including data type and mask.
- The workbook's assistant section describes optional fields controlled by a mask. The 18-byte F9 sample alone does not establish a reliable field-by-field decode, so it remains opaque.

## Parser behavior

- F4 is parsed as 7-byte records with raw six-byte MAC and one-byte RSSI fields.
- F7 is split into a four-byte raw battery-voltage field and optional raw charge-status and battery-percentage bytes.
- F8 exposes only tag, declared length, value length, and envelope-match status. Its payload is deliberately not decoded because it contains device identifiers such as IMEI and ICCID.
- F6 is parsed only when its declared value length exactly matches the fields selected by its one-byte mask; all field values remain raw buffers. Unknown/reserved data types are preserved as raw bytes and are not rejected. F6 values with inconsistent lengths remain in `opaqueExtensions`. F9 is split into raw workbook-aligned slices only for the exact observed `0x000f` mask and 18-byte value; all other F9 masks or lengths remain opaque.
- Incomplete trailing TLV bytes remain in `unparsedTail`.
- Existing F0 base-station and F2 firmware properties remain available.

## Deliberately not inferred

- No WiFi MAC vendor lookup, geolocation, or interpretation of RSSI scale.
- No conversion of battery voltage bytes to a number or unit.
- No interpretation of charge-status or percentage values beyond exposing their raw bytes.
- No decoding of F8 identifiers.
- No numeric conversion of F6 sensor values, nor assumptions about units, scale, signedness, or endianness. F9 field slices are structural only; no GNSS age, ACC time, HDOP, or GNSS-time values are decoded or assigned units.
- No changes to TCP ingestion, acknowledgements, persistence, database schema, device settings, or production configuration.

WiFi MAC addresses can reveal nearby network infrastructure and should be treated as sensitive diagnostic data. The parser change is descriptive and does not add them to any new public endpoint.
