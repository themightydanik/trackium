# Local PostgreSQL backup and restore drill

Run from the repository root with Node.js 22 or newer, npm and a local Docker daemon over a Unix socket. Docker must have access to the digest-pinned PostgreSQL 16 image, or be able to pull it. The first run may need registry access. The drill accepts no database URL, archive path or other arguments.

```sh
npm ci --prefix services/gateway
node services/gateway/scripts/backup-restore-drill.mjs
```

The script creates one disposable PostgreSQL container with a random password, a dynamic loopback port and four empty databases for source, recovery, damaged archives and an incomplete archive. The Gateway binds HTTP to loopback, disables its TCP listener and uses proof test mode. It seeds generated fixtures through the Gateway services and journal. The temporary archives and HTTP evidence exports stay in memory. The command prints the complete archive SHA-256 and byte count, then removes the container and its data volume on normal exit or a caught failure. Random IDs, credentials and timestamps make archive hashes vary between runs.

A passing run prints six `PASS:` lines and exits zero:

1. A corrupted archive header is rejected by PostgreSQL.
2. A truncated archive is rejected. Both damaged restore attempts run with `--single-transaction --exit-on-error` and must leave the target with zero public tables.
3. A valid archive with AOVX link rows intentionally omitted restores at the SQL level and fails the same lineage check used for the good restore. That database is never started as a Gateway.
4. The restored managed customer retains its tenant and access revision. The current owner credential can export test proof evidence and the rotated-out credential fails authentication. The output includes the local dump and verified recovery times and the number of fixture writes lost at the quiescent snapshot.
5. The full archive restores to an empty database. Gateway startup verifies migrations 001–009 against their file SHA-256 values and retains their original ledger rows. The drill compares evidence before and after restore and checks raw bytes and hashes, duplicate packet links, telemetry provenance, cargo sequence and every previous hash, shipment head, immutability, one outbox row per event, and unchanged notification receipts after a worker tick. The tenant-scoped proof bundle is identical before and after recovery. The independent verifier validates its hash chain and returns `TEST_ONLY_NOT_BLOCKCHAIN`; a different tenant is denied access.
6. The restored Gateway rejects an injected outbox failure atomically, replays the pending packet exactly once, continues packet IDs, deduplicates a repeat and reclaims an expired outbox lease while rejecting the stale token. Existing cargo events, acknowledged jobs and proof records remain intact.

A failed command or assertion exits nonzero. The drill exercises a logical dump/restore using the same PostgreSQL major version and the current Gateway code. It provides no production backup, point-in-time recovery, cross-version upgrade, production disaster-recovery timing or live blockchain evidence.
