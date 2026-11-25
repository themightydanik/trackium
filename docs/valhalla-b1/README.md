# B1 measured routing results

The Ukrainian graph was compiled locally from the complete Geofabrik extract `ukraine-261124.osm.pbf`. Its replication timestamp is `2026-11-24T21:21:23Z`. The PBF bounds in longitude/latitude are `22.132644,44.008624,40.238113,52.386497`. These are source bounds. Routability below is established by testing particular routes.

| Route | Profile | Distance km | Model time seconds | Maneuvers |
| --- | --- | ---: | ---: | ---: |
| Kyiv → Lviv | car | 544.243 | 22,485.822 | 28 |
| Lviv → Kyiv | car | 540.904 | 22,304.667 | 27 |
| Burshtyn → Holohory | car | 77.723 | 4,676.374 | 9 |
| Lviv → Burshtyn → Holohory | car | 173.387 | 10,137.134 | 28 |
| Odesa → Mykolaiv | car | 133.557 | 6,320.770 | 12 |
| Kyiv → Lviv | truck | 548.869 | 22,853.560 | 31 |

All six tests returned HTTP 200 and real polyline6 geometry. The probe decoded each leg and checked its endpoints within 1 km of requested coordinates. The largest actual snap was 94.2 m. Estimated time reflects the graph and chosen costing. Access restrictions, live traffic and safe passage require independent confirmation.

[Ukraine graph release, source SHA-256 and build measurements](ukraine-release.json) · [Ukraine route evidence including graph ID and warnings](ukraine-routes.json)

| Metric | Ukraine graph |
| --- | ---: |
| Compressed OSM PBF | 885,655,410 bytes |
| Valhalla compile wall time | 442.15 s |
| Compile CPU time, user + system | 857.99 s |
| Peak builder RSS | 10,186,192 KiB |
| Output graph | 997,662,952 bytes / 1,523 tiles |
| First Kyiv–Lviv after readiness | 2,241.97 ms |
| Warm sequential p50 / p95 / p99, n=20 | 426.75 / 587.19 / 622.44 ms |
| Warm concurrency 4 p50 / p95 / p99, n=32 | 625.75 / 934.96 / 1,202.64 ms |
| Warm benchmark errors | 0 |
| Service RSS high-water mark after probes | 773,096 KiB |
| Service CPU after probes, including process startup | 23.5 s |

The builder used four threads. Requests ran through the private service with two workers. The first request follows the readiness check and can see filesystem cache from the compile. Resource readings are Linux process values; the environment had concurrent local preprocessing. The percentiles describe the stated small sample, not an SLA. The closed loopback port returned a connection refusal. A separate Kyiv–Paris request against the Ukraine-only graph returned HTTP 400 / Valhalla 171 (no suitable edges near the destination). B2 still owns the public service-error mapping.

The [separate deterministic synthetic fixture](restriction-fixture.json) used the same Valhalla binary. The car and in-limit truck used a 2.830 km direct edge. Raising any one of height, width, length, gross weight or axle load selected a 5.946 km detour. Disconnected and motor-vehicle-closed cases returned HTTP 400 / Valhalla 442. Thirteen locations were rejected with HTTP 400.

## Connected Ukraine and Europe corridor pilot

Twelve Geofabrik extracts shared OSM replication timestamp `2026-11-24T21:21:23Z`. The combined source was clipped only at the declared German and Dutch windows and at the selected French regional boundaries. The merged road PBF was 1,813,961,085 bytes, and the final arterial selection was 299,456,255 bytes. It keeps the major/intermediate road hierarchy plus referenced restrictions/ferries. The graph covers the required test corridors and has intentionally incomplete local-street coverage.

| Route | Profile | Distance km | Model time seconds | Maneuvers |
| --- | --- | ---: | ---: | ---: |
| Kyiv → Lviv | car | 542.297 | 22,248.878 | 27 |
| Lviv → Rzeszów | car | 169.710 | 7,916.166 | 18 |
| Kyiv → Warsaw | car | 775.709 | 34,505.730 | 51 |
| Odesa → Bucharest | car | 565.191 | 27,257.216 | 69 |
| Berlin → Warsaw | car | 574.373 | 17,053.837 | 37 |
| Warsaw → Paris | car | 1,596.882 | 50,520.027 | 68 |
| Warsaw → Lviv | truck | 396.754 | 20,539.535 | 64 |

Seven of seven actual queries returned HTTP 200 with decoded geometry and maneuvers. The maximum endpoint snap across the corridor tests was 187.3 m. The engine warned about some unparsed OSM conditional expressions and incomplete connections at five sampled ferry endpoints during compilation. Its validator also printed possible duplicate shortcut warnings. Review these with untrimmed data before production, especially for timed restrictions and ferry-dependent itineraries.

| Metric | Intercity graph |
| --- | ---: |
| Final compiled PBF | 299,456,255 bytes |
| Valhalla compile wall time | 338.54 s |
| Compile CPU time, user + system | 855.07 s |
| Peak builder RSS | 7,920,648 KiB |
| Output graph | 563,481,088 bytes / 3,835 tiles |
| First Warsaw–Paris after readiness | 2,001.05 ms |
| Warm sequential p50 / p95 / p99, n=20 | 178.75 / 291.14 / 1,305.61 ms |
| Warm concurrency 4 p50 / p95 / p99, n=32 | 416.38 / 635.31 / 658.82 ms |
| Warm benchmark errors | 0 |
| Service RSS high-water mark | 810,176 KiB |
| Service CPU after probes, including process startup | 17.34 s |

[Corridor graph release with exact raw, intermediate and final hashes](corridor-release.json) · [Corridor route and performance results](corridor-routes.json)

The local rootless daemon recorded the supplied CPU, memory and PID settings but did not delegate per-container controllers. The service read the parent cgroup limits (4 CPUs, 32 GiB and no PID cap). The measured results are from this shared local budget and two Valhalla workers. The hosted workflow also checks that a cgroup-enabled runner applies the service limits. Require this check on any future deployment host.

## Capacity and cost

For a **Ukraine trial**, the measured peak is about 9.7 GiB builder RSS and 7.4 minutes of compile time. Allocate a 4 vCPU/16 GiB offline builder and at least 20 GB scratch as a starting envelope, then test real peak disk and concurrent jobs. The measured graph is about 1.0 GB; retain at least one previous graph and separate PBF archives. Evaluate runtime with 2 vCPU/4 GiB. The measured ~755 MiB peak applies to the sampled route set.

For **broader Europe**, start a build feasibility benchmark with 16 vCPU/64 GiB and 200 GB fast scratch as an unverified envelope, based on source size and intermediate/rollback needs. Graph bytes, peak RAM and throughput depend on filtered modes, detailed geography and simultaneous workloads. Build peak may require a larger machine. Do not treat this budget as a measured requirement.

For cost comparison only, a hypothetical USD 0.25 builder-hour prices the measured Ukraine compile at about USD 0.031 before input preparation, data transfer and billing increments. At USD 0.08/service-hour, one always-on service costs USD 58.40 per 730-hour month before storage, network and redundancy. At a separate, illustrative USD 1.20/hour larger builder rate, a four-hour Europe build would cost USD 4.80 before storage and transfer. Obtain an actual quote for the target class. These coefficients are scenario inputs, not a vendor quote or a spend decision. Measure Europe first and then price compute, staged graph retention, egress and redundancy.
