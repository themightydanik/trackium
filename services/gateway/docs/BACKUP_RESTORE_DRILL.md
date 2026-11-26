# Local PostgreSQL backup and restore drill

Run from the repository root with Node.js 22 or newer, npm and a local Docker daemon over a Unix socket. Docker must have access to the digest-pinned PostgreSQL 16 image, or be able to pull it. The first run may need registry access. The drill accepts no database URL, archive path or other arguments.

```sh
npm ci --prefix services/gateway
node services/gateway/scripts/backup-restore-drill.mjs
```

The script creates one disposable PostgreSQL container with a random password, a dynamic loopback port and four empty databases for source, recovery, damaged archives and an incomplete archive. The Gateway binds HTTP to loopback, disables its TCP listener and uses proof test mode. It seeds generated fixtures through the Gateway services and journal. The temporary archives and HTTP evidence exports stay in memory. The command prints the complete archive SHA-256 and byte count, then removes the container and its data volume on normal exit or a caught failure. Random IDs, credentials and timestamps make archive hashes vary between runs.

A passing run exits zero and reports checks including:

1. A corrupted archive header is rejected by PostgreSQL.
2. A truncated archive is rejected. Both damaged restore attempts run with `--single-transaction --exit-on-error` and must leave the target with zero public tables.
3. A valid archive with AOVX link rows intentionally omitted restores at the SQL level and fails the same lineage check used for the good restore. That database is never started as a Gateway.
4. The restored managed customer retains its tenant and access revision. The current owner credential can export test proof evidence and the rotated-out credential fails authentication. The output includes the local dump and verified recovery times and the number of fixture writes lost at the quiescent snapshot.
5. The full archive restores to an empty database. Gateway startup verifies migrations 001–019 against their file SHA-256 values and retains their original ledger rows. The drill compares evidence before and after restore and checks raw bytes and hashes, duplicate packet links, telemetry provenance, cargo sequence and every previous hash, shipment head, immutability, one outbox row per event, and unchanged notification receipts after a worker tick. The tenant-scoped proof bundle is identical before and after recovery. The independent verifier validates its hash chain and returns `TEST_ONLY_NOT_BLOCKCHAIN`; a different tenant is denied access.
6. The restored Gateway rejects an injected outbox failure atomically, replays the pending packet exactly once, continues packet IDs, deduplicates a repeat and reclaims an expired outbox lease while rejecting the stale token. Existing cargo events, acknowledged jobs and proof records remain intact.

A failed command or assertion exits nonzero. The drill exercises a logical dump/restore using the same PostgreSQL major version and the current Gateway code. It provides no production backup, point-in-time recovery, cross-version upgrade, production disaster-recovery timing or live blockchain evidence.

The recovered fixture also includes the customer account and company membership from migration 011. Before serving a restored customer deployment, revoke restored browser sessions and outstanding email codes and reconcile changes since the snapshot. The private local mail directory is outside the database archive. The restored activation inventory preserves its protected verifier and claim status. Reconcile printed cards and claims made since the snapshot before re-enabling activation. Rotate any unclaimed card whose use or custody cannot be established.

## Road route history and binary rollback

Run from a Git checkout with commit `e97647e98d0c44b6e6c773dfc0c34d4a490ef01a` available locally. Git and tar extract that exact B2 Gateway into a temporary directory. The drill checks that both lockfiles match before sharing the installed dependencies. It starts the actual B2 runtime, including its migrations and HTTP server. The disposable databases use the same PostgreSQL major release.

The drill fills a v016 database using B2, including a shipment, two checkpoints and cargo events. It checks that a shipment write lock makes a bounded v017 migration roll back, then starts the current Gateway to apply 017 through 019 and compares the original rows. It checks the new catalog entries, a no-op migration rerun and rejection of a changed checksum. It creates and activates two route revisions with different test graph IDs using the routing service and deterministic calculation fixtures. These fixtures are calculated road plans for storage tests and do not add GPS observations.

The full archive carries both revisions, the active head at generation 6, and seven audit rows. The restored database is opened first by the real B2 runtime. Its authenticated shipment API responds while all B3 rows remain present. B3 then opens the same database and reads the active and superseded revisions with routing disabled. The drill compares the deterministic snapshots, including graph IDs, geometry, ETA, actors and audit timestamps, and exercises the restored foreign keys and immutability triggers. The route audit is append-only PostgreSQL history. Cargo hash-chain and Integritas test-proof checks run independently.
