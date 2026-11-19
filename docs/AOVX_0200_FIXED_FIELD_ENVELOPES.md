# AOVX 0x0200 fixed-field tagged values

## Scope

This note records the observed envelope structure for the three fixed fields at body offsets 28–39. It does not assign measurement units, scale factors, or byte order to multi-byte values.

## Evidence

The official workbook's 0x0200 example (sheet 0x0200, sample row 8) shows these byte sequences:

| Body offset | Field | Sample bytes | Observed structure |
|---:|---|---|---|
| 28 | Mileage (mile, 6 bytes) | `01 04 00 00 00 00` | tag `0x01`, length `4`, four value bytes |
| 34 | Cellular signal (csq, 3 bytes) | `30 01 16` | tag `0x30`, length `1`, one value byte |
| 37 | GNSS satellites (gpsnum, 3 bytes) | `31 01 07` | tag `0x31`, length `1`, one value byte |

The same tag/length pattern appears in the captured GL110-GL telemetry:
- Mileage: `01 04 00 00 00 00`
- Cellular signal: `30 01 <value>`
- GNSS satellites: `31 01 00`

The workbook labels the fields as mileage, cellular network signal strength, and number of GNSS satellites used. It does not, in the extracted field definitions, specify the mileage value's byte order or units, nor the cellular-signal value's unit/scale.

## Decoder behavior

The parser exposes `mileageField`, `cellularSignalField`, and `gnssSatellitesField` as observed tag-length-value envelopes. Each includes:
- `tag` and `declaredLength`
- opaque `valueRaw` and `valueHex`
- `valueByte` only for a one-byte value whose tag and length match the observed sample
- `matchesObservedEnvelope` to make validation explicit

Unexpected tags or lengths are preserved as raw bytes and marked `matchesObservedEnvelope: false`; they do not make an otherwise structurally valid frame fail parsing.

The legacy `mileageRaw`, `cellularSignalRaw`, and `gnssSatellitesRaw` properties remain unchanged for compatibility.

## Deliberately not inferred

- No mileage numeric conversion, endianness, or distance unit.
- No cellular signal unit or conversion.
- No change to GPS, latitude/longitude, altitude, speed, or direction parsing.
- No interpretation of model-specific tail data.
- No changes to TCP ingestion, acknowledgements, database schema, or production configuration.
