# Offline AOVX capture analysis

This utility analyzes a JSON response saved from the protected read-only
`/internal/aovx/packets` endpoint. It does not connect to Railway, access
credentials, write to the database, send tracker commands, or modify device
configuration.

## Capture a page

Set the operator token in your shell without putting it in command history,
then save one page:

```sh
read -s "AOVX_TOKEN?Operator token: "
echo
curl -fsS -H "Authorization: Bearer $AOVX_TOKEN" \
  "$GATEWAY_URL/internal/aovx/packets?limit=50" > aovx-capture.json
unset AOVX_TOKEN
```

Set `GATEWAY_URL` to the Gateway HTTPS origin before running the command.
Keep the capture file private: it contains raw device traffic and identifiers.

## Run locally

From `services/gateway`:

```sh
npm run aovx:analyze -- aovx-capture.json
```

The JSON report includes message-ID and body-length counts, decode failures,
the observed XOR-candidate match count, and raw fixed-prefix/tail bytes for
each `0x0200` packet. It deliberately omits remote IP addresses and does not
interpret coordinate, speed, mileage, signal, timestamp timezone, or
model-specific extension semantics.

The XOR comparison is still an unconfirmed checksum candidate, not device
authentication. A successful structural decode is not proof that the generic
GAL workbook fully describes GL110-GL V1.2.
