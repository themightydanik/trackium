# AOVX F6 and fixed telemetry comparison

## Purpose

The offline comparison report places observed F6 sensor values beside the fixed 0x0200 telemetry fields from the same packet, then counts raw-value changes across adjacent samples. It is intended to expose correlations for further protocol investigation, not to decode measurement values.

## Run

From `services/gateway`:

```zsh
node --input-type=module -e '
import fs from "node:fs";
import { compareAovxTelemetry } from "./src/aovx/compare-telemetry.js";
const capture = JSON.parse(fs.readFileSync("aovx-capture.json", "utf8"));
console.log(JSON.stringify(compareAovxTelemetry(capture), null, 2));
'
```

The input is the existing packet export with a top-level `packets` array and each row's `raw_payload_hex`. The report is printed to stdout; it does not modify the capture.

## Method

- Decode structurally valid AOVX frames and retain only 0x0200 messages with an F6 extension that matches the workbook's mask-derived length.
- Group samples by device internally, then sort each device's samples by the BCD timestamp digit string. This is lexical ordering only; it does not apply a timezone or calculate elapsed time.
- Compare the raw F6 fields (Light, Temperature, Humidity, Accelerometer) with raw fixed-prefix bytes (status, latitude, longitude, altitude, speed, direction).
- For each sensor/fixed-field pair, count adjacent transitions where both changed, only the sensor field changed, only the fixed field changed, or neither changed.
- Keep malformed frames, telemetry without a matching F6 block, and invalid BCD timestamps visible in aggregate counts.

## Interpretation limits

- Hex values remain raw bytes. No units, scaling, signedness, endianness, coordinates, or physical meaning are inferred.
- Co-occurrence is not causation. Adjacent observations may be separated by unknown intervals, buffered delivery, or repeated application-level observations.
- Sequence numbers are shown for context only; no wrap, reset, or ordering semantics are assumed.
- The report does not deduplicate packets or expose device identifiers.
- Offline analysis only: no TCP, ACK, persistence, database, device configuration, or production behavior changes.
