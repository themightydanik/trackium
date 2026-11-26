# Oracle ↔ Railway routing bridge

**Decision:** Use a dedicated HTTPS endpoint with mutual TLS on the existing Oracle VM. **Production activation remains NO-GO** until the operators close the live gates below. No new environments, domain, paid static IP, database changes or incoming Railway tunnel are needed.

## Architecture decision

| Option | Security and compatibility | Changes and operations | Decision |
| --- | --- | --- | --- |
| Oracle-initiated reverse tunnel over Railway HTTPS | No Oracle ingress. Railway supports ordinary HTTPS and WebSockets, but the application would own peer authentication, message multiplexing, bounds and half-open connection recovery. An Oracle agent must stay connected and re-register after Railway deploys. TLS terminates at the Railway edge; peer verification must be explicit at the app layer. | New persistent session protocol, lifecycle and reconnect logic. Multi-replica Gateway needs shared ownership or affinity; do not assume existing HTTPS provides it. | Consider if Oracle TCP ingress is unavailable. [Railway edge specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) |
| Dedicated Oracle mTLS proxy | Gateway calls only the reviewed literal IP and port. TLS verifies the IP SAN and dedicated server CA. Nginx requires a client certificate issued by a separate dedicated CA. Valhalla remains reachable only within the Docker routing network. The public port accepts only authenticated routing traffic. | Small Gateway HTTPS transport plus one constrained proxy container. Cert rotation, OCI ingress and resource checks remain operator responsibilities. Existing paid static egress is unnecessary. Without it, cryptographic authentication remains required and public handshake floods remain a residual risk. | **Selected.** [Railway static outbound IP plans](https://docs.railway.com/networking/static-outbound-ips) · [OCI security rules](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm) |
| Private overlay or external reverse proxy | Railway's built-in WireGuard mesh is scoped to a project environment. It does not enroll the Oracle host. Tailscale userspace mode can expose SOCKS5 or HTTP on Railway without TUN, but needs an agent, device identity and explicit Gateway integration. Kernel WireGuard capabilities on the current Railway service have not been established. | New component and credential lifecycle, external dependency, free-plan eligibility and possibly a relay. No basis to assume all are available without cost for this use. | Defer. [Railway private networking](https://docs.railway.com/networking/private-networking/how-it-works) · [Tailscale userspace networking](https://tailscale.com/kb/1112/userspace-networking) |

```text
Fleet Map → existing authenticated Gateway/B2/B3
            → TLS to approved IPv4:8443 with dedicated client credential
              → Oracle Nginx (mTLS, exact GET /status or POST /route)
                → Docker internal network → attestor:8002 → Valhalla loopback:8003
```

Oracle's A1 arm64 and VCN TCP ingress model are documented. Registry manifests include arm64 variants for both pinned images; the owner reports Valhalla 3.6.3 and the corridor graph already work on this VM. Only Nginx's approved TLS port needs connectivity from Railway. Outbound reachability from the **actual service** to Oracle port 8443, OCI and Docker firewall behavior there and the proxy's real resource usage remain unverified. [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

The existing `ROUTING_VALHALLA_ORIGIN` and its private-only DNS validation are unchanged. Oracle uses separate env vars and no DNS lookup. The deployment cannot configure alternative public URLs, credentials in URLs, redirects, custom paths, or simultaneous transports. Gateway checks graph ID, Valhalla version, snapshot, content type, response size and geometry exactly as before. TLS errors return the existing generic routing errors. TLS must finish within the 1.5 s connection budget. Route and readiness deadlines remain 8 s and 2.5 s respectively. Oracle defaults to one calculation in flight per Gateway process. Shared PostgreSQL quotas still apply. Each call creates a fresh connection; readiness retries after its five-second cache period. There is no automatic replay of route calculation or B3 mutations. Existing B3 history remains usable during an outage.

The proxy restricts request body size to 8 KiB, has fixed upstream plus bounded rate, connections and timeouts, and relies on the attestor and Gateway to independently cap the response at 1 MiB. The proxy closes upstream connections after each request and refreshes the Docker DNS record after a backend replacement. Container restart policies recover exited processes. There is no public access log or request/error body log in the bridge; the attestor suppresses raw engine output. Retain bounded readiness and existing Gateway outcome telemetry. OCI/OS operator log practices need review. Public TLS ports can still be subjected to denial of service, especially without approved source CIDRs.

## Before any live change

- Confirm the approved release and cutover window, including whether merging into main triggers automatic deploy. D3 observed Railway production deploy records from merges. Keep routing disabled in Railway until the channel gates close. **Do not merge merely to run the Oracle rehearsal**: the existing Oracle container is serving the validated graph independently and must remain untouched until the operator approves a cutover.
- Confirm Oracle's current container, graph and mounts, existing routing and host firewall, disk headroom for a second graph copy and available RAM. **Observed deployment (2026-11-26):** `trackium-valhalla` uses `/home/opc/trackium-routing/graph` (not `/srv/trackium-valhalla/6a707e47`); the pinned archive and 3,835 tiles have passed SHA-256 verification and `/graph/ops/probe.py` returned 169.710 km / 7,916.166 s / 18 maneuvers. Reconfirm paths and state with `docker inspect` before a change, rather than assuming these observations remain true. Only one 4 GiB Valhalla container runs on the 6 GB VM during cutover. Bridge budget is 0.25 CPU, 64 MiB, 32 PIDs; Valhalla is capped at 1 CPU, 4 GiB, 96 PIDs. They share the physical 1 OCPU. These budgets are limits; measure sustained pressure and route times.
- Verify the original graph checksum, preserve the current container and its original mount, and have the operator verify Oracle's SSH host-key fingerprint through their trusted console. All following operations are manual and require the operator's authorization.

## 1. Generate credentials on a trusted machine

From the reviewed checkout, create a new private directory using OpenSSL 1.1.1 or later. The generator makes separate 365-day CAs and 90-day leaves with role-specific EKUs. Never sign another peer with either CA. Keep both CA keys offline in protected storage. Rotation uses a new pair of CAs and leaves, coordinated with Gateway and proxy configuration. If a key is compromised, disable the transport and replace the affected CA and leaf.

```sh
routing/valhalla/oracle/create-pki.sh "$HOME/trackium-oracle-pki"
pki="$HOME/trackium-oracle-pki"
openssl verify -purpose sslserver -verify_ip 130.61.180.101 -CAfile "$pki/server-ca.crt" "$pki/server.crt"
openssl verify -purpose sslclient -CAfile "$pki/gateway-ca.crt" "$pki/gateway.crt"
```

Send **only** `server.crt`, `server.key`, and `gateway-ca.crt` to Oracle over the existing approved channel. The following example uses a verified SSH config alias `oracle-valhalla`. Keep `gateway.key` off Oracle. Do not paste secrets into trackers, command-line args, chat, logs, or CI.

```sh
ssh -o StrictHostKeyChecking=yes oracle-valhalla 'umask 077; mkdir -p "$HOME/trackium-bridge-incoming"'
scp -o StrictHostKeyChecking=yes "$pki/server.crt" "$pki/server.key" "$pki/gateway-ca.crt" \
  routing/valhalla/oracle/compose.yaml routing/valhalla/oracle/nginx.conf \
  oracle-valhalla:trackium-bridge-incoming/
```

## 2. Oracle cutover

**Read-only preflight first; no interruption until approval.** The observed Oracle source graph is `/home/opc/trackium-routing/graph`. Use a separate copy so Docker's SELinux `:Z` cannot relabel the original container's graph. Preserve the stopped container and original mounts for rollback. The original container uses `--network none`; the bridge Compose introduces a separate internal Docker routing network. Compose defaults to a loopback-only proxy bind. If the original inspection differs from this observed layout, stop and reconcile it before proceeding.

```sh
sudo docker inspect trackium-valhalla --format '{{.State.Status}} {{.HostConfig.NetworkMode}} {{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}'
sudo docker ps --filter name=trackium-valhalla
df -h / /srv
free -h
ip -4 -br addr
source_graph=/home/opc/trackium-routing/graph
base=/srv/trackium-oracle-bridge
incoming="$HOME/trackium-bridge-incoming"
sudo test -f "$source_graph/ops/verify-graph.py" || { echo 'Unexpected graph path: abort' >&2; exit 1; }
python3 "$source_graph/ops/verify-graph.py" "$source_graph"
sudo test ! -e "$base" || { echo 'Bridge target already exists: abort and inspect' >&2; exit 1; }
# Require enough space for a second ~563 MB graph plus operational headroom.
df -h "$(dirname "$base")"
# Continue only after operator validates free space, verified SSH host identity and PKI inputs.
sudo install -d -m 0755 "$base"
sudo cp -a -- "$source_graph" "$base/graph"
sudo install -d -o 101 -g 101 -m 0700 "$base/pki"
sudo install -o 101 -g 101 -m 0400 "$incoming/server.key" "$base/pki/server.key"
sudo install -o 101 -g 101 -m 0444 "$incoming/server.crt" "$incoming/gateway-ca.crt" "$base/pki/"
sudo install -m 0644 "$incoming/compose.yaml" "$incoming/nginx.conf" "$base/"
cd "$base"
compose() {
  sudo env ORACLE_GRAPH_DIR="$base/graph" ORACLE_BRIDGE_PKI_DIR="$base/pki" \
    ORACLE_BRIDGE_BIND_IP="${ORACLE_BRIDGE_BIND_IP:-127.0.0.1}" docker compose -p trackium-oracle-routing "$@"
}
compose config --quiet
compose pull
# Confirm the bridge image is linux/arm64 before touching the working service.
sudo docker image inspect nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236 --format '{{.Os}}/{{.Architecture}}'
# STOP HERE for an explicit cutover approval. Do not run the following stop command during preflight.
# After obtaining approval for the interruption:
sudo docker stop trackium-valhalla
compose up -d
compose ps
compose port bridge 8443
test -z "$(sudo docker port trackium-oracle-routing-valhalla-1)"
for service in valhalla bridge; do
  compose exec -T "$service" cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max /sys/fs/cgroup/pids.max
done
```

Expect cgroup v2 CPU quota/period ratios 1.0 and 0.25, memory 4294967296 and 67108864 bytes, and PIDs 96 and 32 respectively. If any effective limit is missing, bridge fails to start, or Valhalla does not pass `/status` and `/route`, **roll back immediately** with `compose down` and `sudo docker start trackium-valhalla` before proceeding. Preserve both graph copies. Check `sudo docker stats --no-stream` and `free -h`; on 1 OCPU, measure sequential request latency and memory pressure instead of assuming that locally successful limits imply enough throughput. For the loopback smoke, the operator can forward the already-authorized SSH connection to 8443, keeping the client private key on the trusted workstation. Run in two terminals. Keep the original destination in the HTTPS URL so certificate validation still checks its IP SAN.

```sh
ssh -o StrictHostKeyChecking=yes -N -L 127.0.0.1:18443:127.0.0.1:8443 oracle-valhalla
```

```sh
pki="$HOME/trackium-oracle-pki"
peer=https://130.61.180.101:8443
status_headers=$(mktemp)
curl -fsS --noproxy '*' --connect-to 130.61.180.101:8443:127.0.0.1:18443 \
  --cacert "$pki/server-ca.crt" --cert "$pki/gateway.crt" --key "$pki/gateway.key" \
  --max-time 10 -D "$status_headers" "$peer/status" | jq -e '{version,has_tiles}'
grep -i '^X-Trackium-' "$status_headers"
rm -- "$status_headers"
curl -sS --noproxy '*' --connect-to 130.61.180.101:8443:127.0.0.1:18443 \
  --cacert "$pki/server-ca.crt" --max-time 10 -o /dev/null -w '%{http_code}\n' "$peer/status"
```

Expect `has_tiles: true`, version 3.6.3, graph `6a707e47f877bd471dce66baa5fb0e1e54d4a1bfe6a0f2c49156eb1f9d992f29`, snapshot `2026-11-24T21:21:23Z`, and a non-2xx response without the client certificate.

After approving OCI network and host-firewall changes, configure **TCP 8443 only** in the existing NSG/security list. Restrict to already available stable Railway source CIDRs if any. If sources are dynamic, obtain explicit operator approval for a public mTLS listener and residual handshake-flood risk. Do not add a rule for 8002/8003. Audit effective OCI and Docker rules together; host firewalld alone may not cover Docker-published ports. Use `ip -4 -br addr` and OCI VNIC metadata to identify and independently verify the VM's **private** interface IPv4 address (do not assume the public IP is present on an interface). Bind the proxy to that approved private IPv4 interface, then recreate only the proxy with the shell function defined above:

```sh
ORACLE_BRIDGE_BIND_IP=REPLACE_WITH_APPROVED_VM_INTERFACE_IPV4 compose up -d --no-deps bridge
compose port bridge 8443
test -z "$(sudo docker port trackium-oracle-routing-valhalla-1)"
```

## 3. Railway validation and activation

Confirm the approved code revision is running, with routing still off. In an authorized ephemeral shell **inside the actual Gateway service**, load the following Oracle variables into the shell using the approved secret injection mechanism, without persisting them as Railway service variables yet. Do not echo credentials or put them on the command line. Use the existing app working directory. Verify that `ROUTING_VALHALLA_ORIGIN` is unset only in that shell.

| Variable | Value |
| --- | --- |
| `ROUTING_ORACLE_ORIGIN` | `https://130.61.180.101:8443` |
| `ROUTING_GRAPH_RELEASE_ID` | `6a707e47f877bd471dce66baa5fb0e1e54d4a1bfe6a0f2c49156eb1f9d992f29` |
| `ROUTING_ORACLE_SERVER_CA_PEM` | contents of `server-ca.crt` |
| `ROUTING_ORACLE_CLIENT_CERT_PEM` | contents of `gateway.crt` |
| `ROUTING_ORACLE_CLIENT_KEY_PEM` | contents of `gateway.key`, secret |

```sh
node --input-type=module <<'JS'
import { createRouting, readRoutingConfig } from './src/routing/service.js';
try {
  const config = readRoutingConfig(process.env);
  if (!config?.oracleTls) throw new Error('Oracle mTLS configuration required');
  console.log(await createRouting(config, null).checkReady());
} catch (error) {
  console.error(error.routingCode ?? 'ROUTING_PREFLIGHT_FAILED');
  process.exitCode = 1;
}
JS
```

This preflight makes one attested status call and does not use PostgreSQL. It must execute inside the **actual running Railway Gateway** with the PR revision available, not in an unrelated temporary environment. From the same shell, record a bounded TCP/TLS connect measurement and a few sequential `/status` checks; verify that the TLS handshake finishes within 1.5 s and readiness within 2.5 s on typical and cold attempts. Do not print private key material. Check the wrong/no-client rejection from the operator workstation as well. When all live gates pass, set all five Oracle variables together in an approved deployment using Railway's secret manager. Remove any conflicting old provider origin during the same revision. Do not change unrelated variables, profiles, credentials, PostgreSQL, or AOVX ingress.

```sh
origin=https://trackium-gateway-production.up.railway.app
curl -fsS --max-time 10 "$origin/readyz"
curl -fsS --max-time 10 "$origin/readyz/routing"
```

In Fleet Map, use the existing authorized demo/pilot company, select the approved shipment, enter Lviv `49.84112,24.02999` and Rzeszów `50.03741,22.00709`, then **Calculate route** with auto. Compare with the observed ~169.71 km, 7,916 s and 18 maneuvers on the pinned release. C3 follows the established explicit proposal, approval and activation. Test writes need separate authorization and an appropriate test shipment. Keep calculated planning geometry separate from GPS, and avoid logging route request/response bodies. On the current single OCPU, test a small sequential set first; check response timings and memory before increasing load.

## 4. Certificate rotation and monitoring

Both leaf certificates expire 90 days after issuance and both dedicated CAs expire after 365 days. Assign an owner and calendar an inspection well before the leaf expiration (for example 30 days in advance). Inventory certificate validity with `openssl x509 -in FILE -noout -dates -fingerprint -sha256` on the trusted workstation, never copying the Gateway private key to Oracle. Rehearse rotation with a fresh isolated PKI, verify the new IP SAN and EKUs, and coordinate the new Gateway credentials/CA trust and Oracle Nginx certificate/CA trust during an approved change window. Because the generated trust stores contain only one CA each, **rotation is not seamless by default**; document and approve the short cutover/redeploy or implement an independently reviewed overlap mechanism before promising zero downtime. On suspected key compromise, disable the routing transport, replace the affected CA and leaf and remove old trust rather than relying on certificate expiry. Do not log private keys or route bodies.

Monitor expiry, bounded aggregate `ROUTING_*` outcomes, and the 1-OCPU service latency and memory pressure. A mTLS handshake may still consume resources from anonymous internet clients; maintain the OCI exposure decision and firewall audit record.

## 5. Rollback

- On Railway, revert to the previous routing config or unset Oracle's four dedicated variables **and** the graph ID together if routing was previously disabled. Schedule any Railway redeploy with the operator. Verify `/readyz` and B3 read-only history. A disabled optional readiness endpoint returns 404.
- On Oracle, `compose down` from the cutover shell affects only the new project. Run `sudo docker start trackium-valhalla` to restore the original container. Remove the newly approved TCP 8443 rule if it was created. Preserve both graph directories. Withdraw the bridge credentials from Railway and securely remove temporary copies in the approved operator workflow. Keep database migrations and historical revisions.

## Verification and activation gates

| Gate | Status | Evidence / next action |
| --- | --- | --- |
| Existing Gateway and database behavior | PASS · disposable | Gateway unit 184/184 and PostgreSQL integration 61/61. No Cargo, AOVX, migration, proof or Fleet Map changes. |
| Gateway transport security | PASS · local | TLS tests use ephemeral PKI and verify the fixed origin, mutual trust, hostname/IP mismatch rejection, redirect refusal, attestation mismatch, sanitized failure and retry after outage. Existing private DNS pinning tests remain green. |
| Proxy and graph | PASS · local x86_64 Docker | Tested the pinned image and Compose on loopback with the full corridor graph. No Valhalla port mapping. No client or wrong client failed, wrong/exotic path variants and methods returned 404, an 8,193-byte request returned 413. Actual Gateway adapter → mTLS proxy → Valhalla returned the pinned graph, 169,710 m, 7,916 s and 18 maneuvers. During an upstream stop the proxy returned a bounded 5xx and recovered to 200 after recreating Valhalla. |
| Effective resource enforcement | FAIL · local runner; NOT VERIFIED · Oracle | Docker accepted requested configuration locally, but both containers reported parent cgroups of 4 CPUs, 32 GiB and no PID cap. On Oracle record the actual limits, TLS handshake/steady-state load, response timing and memory headroom. |
| Live peering and OCI isolation | NOT VERIFIED | With operator approval, confirm actual Railway outbound connectivity and authenticated readiness, correct peer/graph, rejected anonymous access, no 8002/8003 exposure and OCI firewall behavior. |
| Production feature and UI | NOT VERIFIED | Confirm approved deploy SHA; enable only after the previous gates, verify both readiness paths, calculate in Fleet Map, then check read-only B3 history and rollback. |

Reproduce the focused Gateway checks from repository root:

```sh
npm --prefix services/gateway test
# TEST_DATABASE_URL must point to disposable PostgreSQL.
npm --prefix services/gateway run test:integration
node --test services/gateway/test/routing.test.js
```

For a disposable proxy rehearsal, point `ORACLE_GRAPH_DIR` at a copy of the verified graph, generate a separate ephemeral PKI using `create-pki.sh DIR --local-test`, and configure the proxy directory with the same three files and UID 101 permissions. Keep the default localhost bind, then call `https://127.0.0.1:8443/status` with the test CA, client certificate and key. Check exact URI variants, repeat without the client certificate, stop only the disposable upstream, expect a 5xx, then recreate it and confirm readiness recovers. The loopback test certificate will fail production IP verification.
