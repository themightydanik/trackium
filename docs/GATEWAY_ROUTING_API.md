# Gateway routing API · Issue #88 B2

`POST /v1/routes/calculate` calculates a standalone road route. The caller must have an active customer company session, the `shipments` scope, and the role Owner, Admin, or Dispatcher. Use the existing same-origin customer cookie and `X-CSRF-Token`. The Lite Android WebView uses this same session. Pairing sessions, telemetry API keys, native bearer sessions, and Viewer access cannot call this endpoint. Company identity comes from the session. The request accepts no company, shipment, graph, or service identifiers. No road calculation, GPS observation, shipment event, proof, or geometry is persisted.

## Contract

Send JSON (8 KiB limit) using this schema. All objects reject unknown fields.

```ts
type Point = { latitude: number; longitude: number };
type Truck = {
  height_m: number; width_m: number; length_m: number;
  weight_t: number; axle_load_t: number;
};
type Stops = { origin: Point; destination: Point; waypoints?: Point[] };
type Calculate = Stops & ({ profile: "auto" } | { profile: "truck"; truck: Truck });

type Maneuver = {
  type: number; instruction: string;
  distance_m: number; estimated_duration_s: number;
  begin_shape_index: number; end_shape_index: number;
};
type Leg = {
  shape: string; distance_m: number; estimated_duration_s: number;
  maneuvers: Maneuver[];
};
type Result = {
  profile: "auto" | "truck";
  truck?: Truck;
  graph: { id: string; engine_version: "3.6.3"; osm_snapshot: string | null };
  calculated_at: string;
  route: {
    geometry_format: "polyline6"; distance_m: number;
    estimated_duration_s: number; legs: Leg[];
  };
  alternatives: { status: "unsupported"; routes: [] };
  warnings: ("STATIC_OSM_SNAPSHOT" | "COVERAGE_MAY_BE_INCOMPLETE" |
    "HGV_RESTRICTIONS_MAY_BE_INCOMPLETE")[];
};
```

Latitude accepts −90…90 and longitude −180…180, with up to six decimal places. Use at most eight ordered stops between origin and destination. All stops must be at least 10 m apart, including nonadjacent ones. The total straight-line distance across consecutive stops and the returned road distance are each capped at 3,000 km. Truck values allow three decimals. Ranges are height 1–5 m, width 1–3 m, length 2–25 m, gross weight 2–60 metric tonnes and axle load 1–15 metric tonnes. Axle load cannot exceed gross weight. Gateway passes these to the respective Valhalla 3.6.3 `height`, `width`, `length`, `weight` and `axle_load` options and checks the costing reported on the maneuvers. No calculation options are exposed in B2.

Each leg contains a latitude-first signed polyline at precision 6. Maneuver indices are zero-based and local to the leg. `type` uses the Valhalla 3.6.3 maneuver enumeration. Treat instructions as plain text. Totals and steps use rounded meters and seconds. Calculated routes describe the road graph snapshot. They cannot establish road closures, bridge availability, border waits, legal HGV clearance, or arrival time. The snapshot field preserves the original precision of the release (UTC timestamp or calendar date). It is null only for the deterministic synthetic graph in a test environment.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST`, `INVALID_COORDINATES`, `INVALID_WAYPOINTS`, `UNSUPPORTED_PROFILE`, `INVALID_VEHICLE_DIMENSIONS` | Invalid input |
| 401/403 | Existing Gateway errors | Session, role, scope, or CSRF rejected |
| 404/405 | Existing Gateway errors | Feature unavailable or wrong method |
| 413 | Existing Gateway error | Request body limit exceeded |
| 422 | `COVERAGE_UNAVAILABLE` | Engine could not attach a stop to a suitable road in this release |
| 422 | `ROUTE_NOT_FOUND` | Stops cannot be connected for the costing, or engine route range exceeded |
| 429 | `ROUTING_RATE_LIMITED` | Request quota or concurrent capacity exhausted |
| 502 | `ROUTING_RESPONSE_INVALID` | Provider response failed protocol or geometry validation |
| 503 | `ROUTING_UNAVAILABLE` | Routing service or shared quota store unavailable |
| 503 | `GRAPH_RELEASE_MISMATCH` | Engine or graph attestation failed |
| 504 | `ROUTING_TIMEOUT` | Connect or overall response deadline exceeded |

Failures return the existing `error` string and a machine-readable `code` for routing errors. Coverage means routability in the loaded graph. The service has no authoritative geographic coverage polygon.

## Private operation

```text
Lite Web / Android WebView ── HTTPS ── Gateway (public service)
                                        ├── private database ── PostgreSQL
                                        └── private routing ── attestor :8002
                                                                  └── loopback :8003 ── Valhalla 3.6.3
```

Set both variables to enable routing. Leave both unset to keep it disabled.

| Variable | Value |
| --- | --- |
| `ROUTING_VALHALLA_ORIGIN` | Fixed private HTTP origin with explicit port, e.g. `http://valhalla:8002` |
| `ROUTING_GRAPH_RELEASE_ID` | Exact lowercase SHA-256 `graph_id` from the reviewed B1 `release.json` |
| `VALHALLA_GRAPH_DIR` | Compose host directory containing the immutable B1 release, config and tiles |
| `VALHALLA_RUN_AS` | Numeric nonroot UID/GID with read access to the release |

The B2 Compose overlay provides a disposable example of wiring Gateway to the B1 internal network. It exposes only Gateway, bound to local loopback, and uses a local mail sink and local test PostgreSQL. For staging, attach the actual Gateway service to an equivalent isolated routing network and use the existing HTTPS origin and secured database/mail settings. Give the network only trusted service peers. Private HTTP and the graph identity headers rely on that trust boundary. Service discovery must resolve to private IPv4. Validate deployed DNS and isolation before enabling. The private integration has been exercised with Compose. Any other platform topology needs separate verification.

The attestor checks the pinned binary version, config digest and every tile digest before starting Valhalla. It exposes only fixed route and status operations. Engine traffic stays on container loopback. Gateway rejects responses with a graph ID or engine version differing from the configured values. Mount release directories read-only and never modify their contents in place on the host. Build and verify each release using B1, start a new private instance with that release, check readiness and real probe routes, then promote the matching service name and graph ID together. Keep the previous instance or release directory for rollback. Revert the two variables together, or unset both and restart Gateway to disable routing. There are no migrations or persisted routes to roll back.

Gateway allows four active calculations per process and shares PostgreSQL quota buckets across replicas (8 per customer account, 24 per tenant and 120 total per minute). It enforces 1.5 s for connecting, 8 s overall per route call, a 1 MiB upstream response cap, 30,000 geometry points and 512 maneuvers. There is a separate readiness call capped at 2.5 s and cached for five seconds. Monitor `GET /readyz/routing` separately from Gateway `/readyz`, and monitor count, latency and failures from aggregate `routing calculation` logs. No route coordinates are logged. No automated retries or cross-tenant route cache are used. Valhalla requires at least the B1 starting allocation of two CPUs, 4 GiB and persistent release storage. Size storage for both current and rollback releases. Use the B1 measured storage and runtime data to plan larger coverage. B2 adds a full tile pass at Valhalla startup and buffers up to eight capped responses in the private service. The deployment host needs a separate load test with representative traffic and graph size.

## Reproduction and coverage

```sh
export COMPOSE_PROJECT_NAME=trackium-b2-test
export COMPOSE_FILE=routing/valhalla/compose.yaml:routing/valhalla/compose.gateway.yaml
export VALHALLA_GRAPH_DIR="$(mktemp -d)/graph"
python3 routing/valhalla/build-graph.py routing/valhalla/fixtures/restrictions.json "$VALHALLA_GRAPH_DIR"
export ROUTING_GRAPH_RELEASE_ID="$(jq -er .graph_id "$VALHALLA_GRAPH_DIR/release.json")"
export VALHALLA_RUN_AS="$(id -u):$(id -g)"
docker compose up --build -d --wait --wait-timeout 120
docker compose exec -T gateway node --input-type=module - fixture < routing/valhalla/gateway-probe.mjs
docker compose down -v
```

For real roads, build the two B1 releases documented below and set the graph directory and matching ID before starting a fresh disposable stack. Replace `fixture` with `corridors` for the six required routes, or `ukraine` for the reverse direction, a small town via an intermediate stop, HGV and a destination outside that graph. The international graph samples selected arterial corridors only. The synthetic fixture checks actual engine behavior for disconnection and a dimension-constrained truck detour, plus authentication, request limits and quota isolation. Keep these three evidence categories distinct. [B1 release and measurement procedure](valhalla-b1/README.md) · [Routing foundation ADR](ADR_VALHALLA_FOUNDATION.md)
