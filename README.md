# Trackium Cargo

A Minima MiniDapp foundation for cargo visibility, with an explicit synthetic Demo Mode and a tenant-scoped Gateway architecture.

- [Minima Proof Engine: protocol, live prerequisites and independent verification](docs/MINIMA_PROOF_ENGINE.md)
- [Gateway integration, pairing, shipments and server simulation](docs/GATEWAY_SHIPMENTS_SIMULATION.md)
- [MiniDapp 2.0: screens, local launch, packaging, tests and pairing design](docs/MINIDAPP_V2_FOUNDATION.md)
- [Gateway architecture and rollout](docs/GATEWAY_V1_ARCHITECTURE.md)
- [Telemetry Core v1 API, migrations and security boundaries](docs/TELEMETRY_CORE_V1.md)
- [Gateway local development](services/gateway/README.md)

`index.html` opens the new Cargo workspace. The original interface is preserved in `legacy.html`. The same-origin Gateway workspace supports owner-approved sessions, shipments and synthetic server simulation. Static Preview remains separate; embedded Core-origin transport is not implemented. The optional Proof Engine supports Server Core RPC and a signed-file Local Core workflow using the installed MiniDapp wallet. Publication is disabled by default, with event-specific Mainnet approvals and no automatic backlog. Real Core/network validation remains an operator prerequisite.
