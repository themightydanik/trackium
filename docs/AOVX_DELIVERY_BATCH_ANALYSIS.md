# AOVX delivery batch and timing analysis

## Run

From `services/gateway`:

```zsh
npm run aovx:batches -- aovx-capture.json
```

The default batch-gap threshold is 15 minutes. It can be changed explicitly:

```zsh
npm run aovx:batches -- aovx-capture.json --batch-gap-minutes 10
```

The command reads the existing packet export and writes JSON to stdout. It does not modify the capture.

## What it reports

- Receive-time intervals calculated independently for each device, then summarized together (min, median, p95, max).
- Per-device delivery batches, split when the gap from the previous received packet for that device is strictly greater than the configured threshold.
- Per-batch first/last receive time, duration, packet count, buffered/realtime counts, and within-batch receive intervals.
- Gaps between adjacent batches for the same device.
- Exact full-wire-frame repeats, including how many repeated frame groups occur in more than one batch.
- Invalid frames and packets without a usable `received_at` value.

## Interpretation limits

- Each device is analyzed as an independent receive stream. Device identifiers are used internally for grouping and never emitted.
- A batch is a descriptive grouping based only on gateway `received_at`. The threshold is an analysis heuristic, not a protocol-defined boundary and not proof of a tracker buffering cycle.
- Cross-batch exact repeats show that the same complete frame was observed in separate receive-time groups. They do not identify which component caused the repetition.
- Device timestamps and timezone are intentionally not interpreted here. The existing delivery-age report labels its UTC assumption as provisional.
- Packets missing `received_at` remain in total packet/telemetry counts but cannot be assigned to a chronological batch.
- The tool does not deduplicate, suppress, acknowledge, or change production telemetry behavior.
