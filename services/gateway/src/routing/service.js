import { lookup } from 'node:dns';
import { request } from 'node:http';
import { isIPv4 } from 'node:net';
import { performance } from 'node:perf_hooks';
import { takeCustomerRate } from '../cargo/customer-rate.js';
import { hash } from '../cargo/shared.js';
import { ENGINE_VERSION, MAX_RESPONSE, normalizeRoute, providerRequest, routeError } from './contract.js';

const unavailable = () => routeError(503, 'ROUTING_UNAVAILABLE', 'Routing temporarily unavailable');
const timeout = () => routeError(504, 'ROUTING_TIMEOUT', 'Routing timed out');
const invalidResponse = () => routeError(502, 'ROUTING_RESPONSE_INVALID', 'Invalid routing response');
const mismatch = () => routeError(503, 'GRAPH_RELEASE_MISMATCH', 'Routing graph release differs from the configured release');
const limited = () => routeError(429, 'ROUTING_RATE_LIMITED', 'Routing capacity reached. Try again shortly');

function privateV4(address) {
  if (!isIPv4(address)) return false;
  const [a, b] = address.split('.').map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function readRoutingConfig(env) {
  const origin = env.ROUTING_VALHALLA_ORIGIN;
  const graphId = env.ROUTING_GRAPH_RELEASE_ID;
  if (origin === undefined && graphId === undefined) return null;
  const match = /^http:\/\/([a-z0-9][a-z0-9.-]*):([1-9][0-9]{0,4})$/.exec(origin ?? '');
  if (!match || Number(match[2]) > 65535 || !/^[a-f0-9]{64}$/.test(graphId ?? ''))
    throw new Error('Routing requires a private HTTP origin with explicit port and a SHA-256 graph release ID');
  const host = match[1];
  if (!(privateV4(host) || /^[a-z][a-z0-9-]{0,62}$/.test(host) || /^[a-z][a-z0-9.-]*\.railway\.internal$/.test(host)))
    throw new Error('Routing origin must be a private IPv4 address or private service name');
  return {host, port: Number(match[2]), graphId, allowFixture: env.NODE_ENV === 'test' && !env.RAILWAY_ENVIRONMENT_ID};
}

function pinnedLookup(hostname, _options, callback) {
  lookup(hostname, {family: 4, all: true}, (error, addresses) => {
    if (error || !addresses.length || addresses.some(({address}) => !privateV4(address)))
      return callback(unavailable());
    callback(null, addresses[0].address, 4);
  });
}

function graphFromHeaders(headers, config) {
  const version = headers['x-trackium-engine-version'];
  const id = headers['x-trackium-graph-id'];
  const snapshot = headers['x-trackium-osm-snapshot'];
  if (id !== config.graphId || version !== ENGINE_VERSION) throw mismatch();
  let sourceTimestamp = null;
  if (snapshot !== 'synthetic' || !config.allowFixture) {
    if (typeof snapshot !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(snapshot) ||
        !Number.isFinite(Date.parse(snapshot)) ||
        new Date(snapshot).toISOString().replace('.000Z', 'Z').slice(0, snapshot.length) !== snapshot)
      throw mismatch();
    sourceTimestamp = snapshot;
  }
  return {id, engine_version: version, osm_snapshot: sourceTimestamp};
}

function exchange(config, path, data, {connectMs, totalMs, signal}) {
  return new Promise((resolve, reject) => {
    let connectTimer, overallTimer, done = false;
    function finish(error, result) {
      if (done) return;
      done = true;
      clearTimeout(connectTimer);
      clearTimeout(overallTimer);
      if (error) reject(error);
      else resolve(result);
    }
    function fail(error) {
      finish(error);
      req.destroy();
    }
    const body = data === undefined ? undefined : JSON.stringify(data);
    const req = request({
      hostname: config.host, port: config.port, path, family: 4, autoSelectFamily: false,
      method: body ? 'POST' : 'GET', agent: false, lookup: pinnedLookup, signal,
      headers: {accept: 'application/json', ...(body && {
        'content-type': 'application/json', 'content-length': Buffer.byteLength(body)
      })}
    }, res => {
      try {
        if (res.statusCode >= 500) throw unavailable();
        if (![200, 400, 404, 422].includes(res.statusCode) ||
            !/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] ?? '') ||
            (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') ||
            Number(res.headers['content-length']) > MAX_RESPONSE)
          throw invalidResponse();
        const graph = graphFromHeaders(res.headers, config);
        const chunks = [];
        let bytes = 0;
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE) fail(invalidResponse());
          else chunks.push(chunk);
        });
        res.on('error', error => finish(error.routingCode ? error : invalidResponse()));
        res.on('end', () => {
          try {
            const text = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks));
            finish(null, {status: res.statusCode, data: JSON.parse(text), graph});
          } catch { finish(invalidResponse()); }
        });
      } catch (error) { fail(error); }
    });
    connectTimer = setTimeout(() => fail(timeout()), connectMs);
    overallTimer = setTimeout(() => fail(timeout()), totalMs);
    req.on('socket', socket => socket.once('connect', () => clearTimeout(connectTimer)));
    req.on('error', error => finish(error.routingCode ? error : unavailable()));
    req.end(body);
  });
}

export function createRouting(config, pool, logger = console, {connectMs = 1500, totalMs = 8000, concurrency = 4} = {}) {
  if (!config) return null;
  let active = 0, checkedAt = -Infinity, check;
  const metrics = {succeeded: 0, rejected: 0, failed: 0};
  function checkReady() {
    if (check && performance.now() - checkedAt < 5000) return check;
    checkedAt = performance.now();
    check = exchange(config, '/status', undefined, {connectMs, totalMs: 2500})
      .then(result => {
        if (result.status !== 200 || result.data?.version !== ENGINE_VERSION ||
            result.data?.has_tiles !== true) throw mismatch();
        return result.graph;
      });
    return check;
  }
  return {
    checkReady,
    async calculate(identity, calculation, signal) {
      const start = performance.now();
      let admitted = false, outcome = 'ok';
      try {
        if (active >= concurrency) throw limited();
        active++;
        admitted = true;
        try {
          await takeCustomerRate(pool, 'routing:actor:' + hash(identity.account_id), 8);
          await takeCustomerRate(pool, 'routing:tenant:' + hash(identity.tenant_id), 24);
          if (await takeCustomerRate(pool, 'routing:global', 120) === 1)
            await pool.query("DELETE FROM customer_rate_buckets WHERE window_at<now()-interval '5 minutes'");
        } catch (error) {
          throw error.status === 429 ? limited() : unavailable();
        }
        if (signal?.aborted) throw unavailable();
        const readyGraph = await checkReady();
        const result = await exchange(config, '/route', providerRequest(calculation), {connectMs, totalMs, signal});
        if (result.graph.osm_snapshot !== readyGraph.osm_snapshot) throw mismatch();
        if (result.status !== 200) {
          if (result.data?.error_code === 171)
            throw routeError(422, 'COVERAGE_UNAVAILABLE', 'No suitable road near one or more stops');
          if ([170, 442].includes(result.data?.error_code))
            throw routeError(422, 'ROUTE_NOT_FOUND', 'No connected road route found for this profile');
          if (result.data?.error_code === 154)
            throw routeError(422, 'ROUTE_NOT_FOUND', 'Route exceeds the supported calculation range');
          throw invalidResponse();
        }
        const route = normalizeRoute(result.data, calculation, result.graph, new Date().toISOString());
        metrics.succeeded++;
        return route;
      } catch (error) {
        outcome = error.routingCode ?? 'internal';
        metrics[error.status === 429 ? 'rejected' : 'failed']++;
        throw error;
      } finally {
        if (admitted) active--;
        // Bounded by quota for accepted work. Busy requests update aggregate counters only.
        if (admitted && outcome !== 'ROUTING_RATE_LIMITED')
          logger.info?.('routing calculation', {outcome, elapsed_ms: Math.round(performance.now() - start), ...metrics});
      }
    }
  };
}
