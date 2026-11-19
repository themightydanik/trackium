# AOVX duplicate-sample status analysis

## Purpose

This offline report finds repeated 0x0200 observations that carry the same F6 sample bytes, then compares their complete decoded frame payloads. It is intended to distinguish status/checksum-only variants from frames that also differ elsewhere.

## Run

From `services/gateway`:

```zsh
npm run aovx:duplicates -- aovx-capture.json
```

The input is the existing packet export with a top-level `packets` array and each row's `raw_payload_hex`. JSON is written to stdout. The command does not modify the capture.

## Grouping and comparison

- Decode structurally valid frames and retain 0x0200 messages with an F6 extension matching the parser's observed envelope.
- Group internally by device, BCD timestamp digits, sequence number, F6 data type, field mask, and all raw F6 field bytes. Device identifiers are never included in the report.
- Compare each repeated sample's unescaped packet bytes against the first observation in its group.
- The four status bytes occupy unescaped packet offsets 16–19 (frame header 12 bytes plus body offset 4).
- The final unescaped packet byte is reported as the checksum byte. XOR remains an unconfirmed candidate, not an authenticated checksum guarantee.
- A status-only-and-checksum variant is one where every changed packet offset is confined to the four status bytes and final checksum byte, and at least one status byte changed.

## Interpretation limits

- A status-only classification describes byte differences; it does not explain why the status changed or prove the device's delivery mechanism.
- The report does not infer status-bit semantics, units, physical sensor values, or causation.
- Samples with different device, timestamp, sequence, F6 data type/mask, or raw F6 fields are not grouped together.
- Offline analysis only: no TCP, ACK, persistence, database, tracker configuration, deduplication, or production behavior changes.
