# AOVX telemetry delivery analysis

Run from `services/gateway`:

```sh
npm run aovx:delivery -- aovx-capture.json > aovx-delivery-analysis.json
```

The offline report examines decoded `0x0200` telemetry only. It reports:

- delivery mode from status bit 31 (0 = realtime, 1 = buffered, per the protocol workbook);
- timestamp BCD decoded as `YYMMDDhhmmss`;
- delivery-age statistics and buckets, calculated provisionally as if the device timestamp were UTC;
- exact repeated wire frames grouped by SHA-256 of the complete received frame;
- same-device/same-timestamp records that carry multiple status values.

## Important limitations

The device timezone has not been independently confirmed. Fields explicitly named `*UtcAssumption` are provisional calculations, not proof that the tracker clock is UTC. Invalid BCD digits and impossible calendar values are reported as invalid timestamps.

A repeated SHA-256 group means the complete received frame bytes are identical. It does not establish whether repetition originated in tracker buffering, device application replay, an upstream forwarder, or another layer. Raw observations are never deleted, filtered, or deduplicated by this analyzer.

A timestamp/status conflict is diagnostic only. In particular, timestamp alone is not a safe deduplication key. The analyzer does not modify gateway runtime behavior, storage, or production data.

The report bounds detailed records and repeated-frame groups to 200 entries while retaining aggregate counts.
