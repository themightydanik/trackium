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

The builder used four threads. Requests ran through the private service with two workers. The first request follows the readiness check and can see filesystem cache from the compile. Resource readings are Linux process values; the environment had concurrent local preprocessing. The percentiles describe the stated small sample, not an SLA. The closed loopback port returned a connection refusal; B2 still owns the public service-error mapping.

The [separate deterministic synthetic fixture](restriction-fixture.json) used the same Valhalla binary. The car and in-limit truck used a 2.830 km direct edge. Raising any one of height, width, length, gross weight or axle load selected a 5.946 km detour. Disconnected and motor-vehicle-closed cases returned HTTP 400 / Valhalla 442. Thirteen locations were rejected with HTTP 400.

## Capacity and cost

For a **Ukraine trial**, the measured peak is about 9.7 GiB builder RSS and 7.4 minutes of compile time. Allocate a 4 vCPU/16 GiB offline builder and at least 20 GB scratch as a starting envelope, then test real peak disk and concurrent jobs. The measured graph is about 1.0 GB; retain at least one previous graph and separate PBF archives. Evaluate runtime with 2 vCPU/4 GiB. The measured ~755 MiB peak applies to the sampled route set.

For **broader Europe**, start a build feasibility benchmark with 16 vCPU/64 GiB and 200 GB fast scratch as an unverified envelope, based on source size and intermediate/rollback needs. Graph bytes, peak RAM and throughput depend on filtered modes, detailed geography and simultaneous workloads. Build peak may require a larger machine. Do not treat this budget as a measured requirement.

For cost comparison only, a hypothetical USD 0.25 builder-hour prices the measured Ukraine compile at about USD 0.031 before input preparation, data transfer and billing increments. At USD 0.08/service-hour, one always-on service costs USD 58.40 per 730-hour month before storage, network and redundancy. At the same illustrative builder rate a 4-hour Europe build would cost USD 1.00, excluding the larger required host and disk; obtain an actual quote for the target class. These coefficients are scenario inputs, not a vendor quote or a spend decision. Measure Europe first and then price compute, staged graph retention, egress and redundancy.
