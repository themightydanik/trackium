# Trackium Cargo

A Minima MiniDapp foundation for cargo visibility, with an explicit synthetic Demo Mode and a tenant-scoped Gateway architecture.

- [Gateway integration, pairing, shipments and server simulation](docs/GATEWAY_SHIPMENTS_SIMULATION.md)
- [MiniDapp 2.0: screens, local launch, packaging, tests and pairing design](docs/MINIDAPP_V2_FOUNDATION.md)
- [Gateway architecture and rollout](docs/GATEWAY_V1_ARCHITECTURE.md)
- [Telemetry Core v1 API, migrations and security boundaries](docs/TELEMETRY_CORE_V1.md)
- [Gateway local development](services/gateway/README.md)

`index.html` opens the new Cargo workspace. The original interface is preserved in `legacy.html`. The same-origin Gateway workspace supports owner-approved sessions, shipments and synthetic server simulation. Static Preview remains separate; embedded Core-origin transport and blockchain publication are not implemented.
