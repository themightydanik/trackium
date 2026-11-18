# Trackium — AI project handoff (2026-11-19)

> **Read this first when taking over development.** This is a handoff map, not an acceptance certificate. Verify every claim against current code, CI, deployment, devices and linked documentation. No secrets, seed phrases, tokens, SIM identifiers or owner credentials belong in this file.

## Product goal and boundaries

Trackium is a cargo/logistics monitoring system combining shipment history, real device telemetry, tenant-scoped Gateway services and independently verifiable Minima commitments. The user wants **two customer-facing options**: **Trackium Lite** (cross-platform, no mandatory local Core) and **Trackium Core** (custom Android Minima Core host with native Trackium workspace). These are product intentions; do **not** infer both are shipped from their names. Customer-controlled/free Gateway and optional paid managed hosting are intended. Device purchase plus optional support/managed subscription is a business direction, not proof of billing implementation.

**Mainnet is the owner's intended network**; never publish transactions, sign, spend or migrate wallet data without explicit operator approval. Synthetic simulation, mock tests, live telemetry and chain-confirmed proofs must remain separately labeled.

## Repositories and ownership

- [themightydanik/trackium](https://github.com/themightydanik/trackium) — Gateway/PostgreSQL, telemetry and cargo workflows, proof engine, browser MiniDapp and older Android companion material. Read its [README](https://github.com/themightydanik/trackium/blob/main/README.md) and docs before changing anything.
- [themightydanik/trackium-core-android](https://github.com/themightydanik/trackium-core-android) — separate Android app embedding a pinned Eurobuddha-derived Minima engine and native Trackium UI, **not** a rewritten consensus engine. It does not contain Gateway/Railway/PostgreSQL backend. Read [README](https://github.com/themightydanik/trackium-core-android/blob/main/README.md), `sources.lock.json`, NOTICE and architecture/acceptance docs.

## Evidence ledger: distinguish implemented, tested and accepted

| Area | Repository evidence | What is **not** established |
| --- | --- | --- |
| Gateway tenant model, pairing, shipments and synthetic simulation | trackium README; `docs/GATEWAY_SHIPMENTS_SIMULATION.md`; `docs/TELEMETRY_CORE_V1.md` | Physical device ownership and authenticated real GL110 ingestion |
| Minima Proof Engine and independent verifier | `docs/MINIMA_PROOF_ENGINE.md`; explicit policy gates and automated mock tests | Successful real Mainnet transaction, live wallet/Android interoperability or physical sensor truth |
| Browser MiniDapp | `docs/MINIDAPP_V2_FOUNDATION.md`; same-origin Gateway workspace | Core-origin transport; fully decentralized/offline workflow |
| Trackium Core Android | separate repo README, `docs/TRACKIUM_CORE_ARCHITECTURE.md`, `docs/PHONE_ACCEPTANCE.md` | Physical phone acceptance, production funds, Mainnet acceptance, hardware acceptance, public release |
| Production deployment | `docs/RAILWAY_DEPLOYMENT.md`; prior operator reports of Railway health | Current deployed SHA, DB migrations, authenticated E2E, public raw TCP/MQTT listener |
| AOVX GL110-GL V1.2 | Physical units received; one tested with active Kyivstar SIM without PIN; STATUS LED blink observed | Verified power/LED manual, initial activation, cloud online, APN, actual firmware protocol, custom-server connection, signed hardware provenance |

**Hardware blocker as of 2026-11-19:** two GL110-GL units are registered in AOVX/uCargo cloud account but have **never come online**. One SIM was verified in a phone; holding STATUS ~3 seconds changed blue LED to a repeating blink, with a brief fast-blink interval. This does **not** prove network registration. The manufacturer supplied cloud URLs `https://cloud.aovx.com/login` and `https://cloud.ucargo.ai/login` and account access, but no quick-start guide or exact-model provisioning instructions. Cloud parameter UI exposes JT/T 808 vs TAIP (`0xF007`: 0=JTT808, 1=TAIP), main server/APN options, but **offline device cannot receive/query commands through that connection**. Do not guess button sequences, SMS commands, firmware settings or claim the unit is activated. Obtain the exact GL110-GL V1.2 power-on, LED, offline APN/server provisioning, protocol/auth/ACK/TLS and recovery documentation. If unavailable, evaluate supported alternative hardware. Device IMEI/ICCID and cloud passwords are private.

## Roadmap and blockers

1. **P0: trust and documentation.** Review [decentralized audit PR #11](https://github.com/themightydanik/trackium/pull/11) and `docs/DECENTRALIZED_ROADMAP.md` **on that PR branch**; it was open/unmerged at handoff. Its P0.1 legacy wallet isolation, P0.2 Core capability/transport, P0.3 hardware firmware/identity contract and P0.4 authority design are proposed work, **not completed by the existence of the roadmap**.
2. **Hardware integration:** exact manufacturer provisioning instructions → observe cloud first-online → identify on-wire protocol/version → provision reachable dedicated TCP/MQTT endpoint with authentication and TLS as supported → raw packet capture → validated decoder, ownership and provenance → tenant shipment events. Never assume a Railway HTTPS endpoint is a raw JT808 TCP listener.
3. **MiniDapp and UX:** verify which browser redesign/parity work is actually merged; Trackium Lite remains a distinct intended option, not automatically an implemented product.
4. **Core Android:** test on physical phone with empty wallet, inspect sync/resource/16-KiB page constraints, licence/release blockers; protect embedded engine pins, wallet storage and separate BlackBear data. See `docs/PHONE_ACCEPTANCE.md` and `docs/LICENSE_AUDIT.md`.
5. **Mainnet proof acceptance:** only after explicit owner authorization, spending limits, durable checkpoints, independent verifier and exact wallet/network validation. Do not treat synthetic receipts as Mainnet proofs.
6. **Pilot/grant:** capture reproducible evidence of physical shipment data, tenant isolation, operator-controlled Gateway and verifiable proofs. Grant milestone terms/acceptance criteria must be supplied by owner; do not invent them.

## Non-negotiable engineering constraints

- Preserve tenant isolation, RLS/auth/owner approval, canonical JSON + SHA-256 event chain, immutable event history, deduplication, explicit provenance and independent proof verification.
- Preserve explicit Mainnet financial gates, one-owner publisher policy, no automatic backlog, checkpoint-before-post, bounded wallet exposure, duplicate/reorg recovery and private RPC.
- Never log or commit seeds, wallet files, SIM identifiers, tokens, certificates' private keys, or owner credentials.
- Do not rewrite applied SQL migrations; add migrations with checksums and backwards-compatibility review.
- Do not replace the pinned Minima engine or weaken its provenance, signature checks, TLS, Android isolation or licensing controls.
- Do not auto-merge PRs, deploy, reconfigure live Gateway, send tracker commands, or execute wallet actions without owner approval.
- Prefer small reviewable PRs, fast focused tests, and explicit manual acceptance gates.

## New AI onboarding protocol

1. Read both repositories' README and referenced architecture/security/roadmap docs, current main branch, open PRs and Issues.
2. Build a **verified** matrix: implemented in main / PR only / test-only / deployed and observed / hardware-tested / planned / blocked. Link exact files, commits and tests.
3. Identify mismatches between this handoff and current code; report them rather than silently rewriting history.
4. Propose the smallest next PR with acceptance criteria, risks and no production side effects.
5. Ask owner before merging, deploying, publishing on Mainnet, changing hardware provisioning or touching keys.

**Status caveat:** This handoff was prepared from README and selected GitHub docs plus the operator's reported hardware observations. It is not a complete code audit, nor a claim that all described features are currently deployed.
