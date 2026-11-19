# AOVX semantic message parsing foundation

This module adds pure, side-effect-free parsers for the message layouts that are
explicitly represented in the checked-in AOVX GAL Series Protocol V3.0 workbook
dump:

- `0x0100` device registration (fixed 38-byte body)
- `0x0102` device authentication (variable-length authentication code)
- `0x8100` registration response (reply sequence, result, optional auth code)
- `0x8001` server general response / acknowledgement (fixed 5-byte body)

## Safety and compatibility boundaries

- These functions parse an already-decoded envelope. They do not open sockets,
  write to the journal, mutate device state, register a device, or send replies.
- The envelope checksum remains observational. The XOR candidate is not treated
  as a confirmed production checksum algorithm.
- Unknown message IDs are returned as opaque messages rather than rejected.
- Device identifiers and registration fields are retained as raw bytes. This
  avoids inventing BCD, text-padding, or character-set rules not established by
  the workbook.
- The workbook is a generic GAL-series protocol document. These parsers do not
  establish that the GL110-GL V1.2 firmware implements these message types or
  layouts. No GL110-specific behavior is enabled by this change.
- The `0x8100` workbook says its authentication-code field appears only after
  successful registration; the parser enforces that documented distinction.

## Use

```js
import { decodeAovxFrame } from './frame.js';
import { parseAovxMessage } from './messages.js';

const envelope = decodeAovxFrame(wireFrame);
const message = parseAovxMessage(envelope);
```

This is a parsing foundation only. Production registration, authentication,
ACK generation/dispatch, telemetry persistence, and tenant/device binding
remain separate, gated implementation steps.
