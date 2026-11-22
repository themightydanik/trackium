import { createHash, randomUUID } from 'node:crypto';
import { ApiError, canonicalize, uuid } from '../telemetry/schema.js';
import { transaction } from '../cargo/shared.js';
import { record } from './commitment.js';

const digest = (text) => createHash('sha3-256').update(text, 'utf8').digest('hex');
const domain = 'trackium:cargo:integritas:v1';
const testOperation = (request) => 'TEST_ONLY:' + request.id;
const stampable = ['status_changed', 'checkpoint_reached', 'route_deviation', 'temperature_violation'];

// Test transport is deliberately disconnected from HTTP and Minima.
export const testIntegritas = {
  async submit(request) { return testOperation(request); },
  async poll(request) {
    return request.operation_id === testOperation(request) && digest(request.evidence) === request.evidence_sha3_256
      ? (request.status === 'submitted' ? 'pending' : 'verified')
      : 'failed';
  }
};

// V1 wire contract. Transport owns server-only authentication and timeouts.
// The gateway does not wire a live transport until the network and verification gates are proven.
export function integritasV1(transport) {
  function envelope(value) {
    if (value?.service !== 'CORE_API' || value.apiVersion !== 1 ||
        value.status !== 'success' || value.statusCode !== 200) throw new Error('INTEGRITAS_RESPONSE');
    return value.data;
  }
  function matches(value, request) {
    return value?.status === true && typeof value.data === 'string' &&
      value.data.toLowerCase() === '0x' + request.evidence_sha3_256;
  }
  return {
    async submit(request) {
      const data = envelope(await transport('/core/v1/timestamp/post',
        { hash: request.evidence_sha3_256.toUpperCase() }, request.id));
      if (!matches(data, request) || !/^0x[0-9a-f]{2,128}$/i.test(data.uid))
        throw new Error('INTEGRITAS_SUBMISSION_UNCERTAIN');
      return data.uid;
    },
    async poll(request) {
      const result = envelope(await transport('/core/v1/timestamp/status',
        { uids: [request.operation_id] }, request.id));
      const item = Array.isArray(result) && result.find((value) => value.uid === request.operation_id);
      if (!matches(item, request)) throw new Error('INTEGRITAS_LOOKUP_UNCERTAIN');
      if (item.onchain === false) return 'pending';
      if (item.onchain === true) return 'anchored'; // Provider report only. No independent confirmation.
      throw new Error('INTEGRITAS_LOOKUP_UNCERTAIN');
    }
  };
}

export function createIntegritas(pool, provider = testIntegritas) {
  const selection = `SELECT r.*,s.status,s.operation_id,s.error,s.updated_at::text AS updated_at,e.shipment_id,e.event_type,e.source_trust
    FROM cargo_integritas_requests r JOIN cargo_integritas_states s ON s.request_id=r.id
    JOIN cargo_events e ON e.id=r.event_id AND e.tenant_id=r.tenant_id`;
  const expose = ({ tenant_id, evidence, ...proof }) => ({
    ...proof, provider: 'integritas', network: 'test-only', verification: 'TEST_ONLY',
    on_chain_verified: false
  });
  async function lookup(tenant, id) {
    const { rows: [proof] } = await pool.query(selection + ' WHERE r.tenant_id=$1 AND r.id=$2', [tenant, uuid(id)]);
    if (!proof) throw new ApiError(404, 'Integritas proof not found');
    return proof;
  }
  async function refresh(request) {
    let status = 'unknown', error = null;
    try {
      status = await provider.poll(request);
    } catch {
      error = 'LOOKUP_UNCERTAIN';
    }
    await pool.query(
      `UPDATE cargo_integritas_states SET status=$2,error=$3,updated_at=clock_timestamp()
       WHERE request_id=$1 AND status=$4 AND updated_at=$5::timestamptz`,
      [request.id, status, error, request.status, request.updated_at]
    );
  }
  return {
    async prepare(tenant, id) {
      return transaction(pool, tenant, async (client) => {
        const { rows: [event] } = await client.query(
          'SELECT * FROM cargo_events WHERE tenant_id=$1 AND id=$2', [tenant, uuid(id)]);
        if (!event) throw new ApiError(404, 'cargo event not found');
        if (!stampable.includes(event.event_type)) throw new ApiError(409, 'cargo event not eligible');
        record(event);
        const { rows: [existing] } = await client.query(
          'SELECT id FROM cargo_integritas_requests WHERE tenant_id=$1 AND event_id=$2', [tenant, id]);
        if (existing) return existing;
        const evidence = canonicalize({ domain, cargo_sha256: event.sha256, cargo_event: JSON.parse(event.canonical_payload) });
        const requestId = randomUUID();
        await client.query(
          'INSERT INTO cargo_integritas_requests(id,tenant_id,event_id,evidence,evidence_sha3_256) VALUES($1,$2,$3,$4,$5)',
          [requestId, tenant, id, evidence, digest(evidence)]);
        await client.query('INSERT INTO cargo_integritas_states(request_id) VALUES($1)', [requestId]);
        return { id: requestId };
      });
    },
    async list(tenant) {
      const { rows } = await pool.query(selection + ' WHERE r.tenant_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 50', [tenant]);
      return { proofs: rows.map(expose) };
    },
    async bundle(tenant, id) {
      const proof = await lookup(tenant, id);
      return { proof: expose(proof), evidence: JSON.parse(proof.evidence) };
    },
    async verify(tenant, id) {
      const proof = await lookup(tenant, id);
      if (proof.operation_id) await refresh(proof);
      return expose(await lookup(tenant, id));
    },
    async tick() {
      const { rows } = await pool.query(selection + `
        WHERE s.status='prepared' OR (s.operation_id IS NOT NULL AND s.status IN ('submitted','pending','unknown'))
        ORDER BY s.updated_at,r.id LIMIT 20`);
      for (const request of rows) {
        if (request.status !== 'prepared') {
          await refresh(request);
          continue;
        }
        // Persist uncertainty before the irreversible call. No second submission
        // is attempted even if the worker crashes before the response is saved.
        const claim = await pool.query(
          `UPDATE cargo_integritas_states SET status='unknown',error='SUBMISSION_UNCERTAIN',updated_at=clock_timestamp()
           WHERE request_id=$1 AND status='prepared'`, [request.id]);
        if (!claim.rowCount) continue;
        let operation;
        try {
          operation = await provider.submit(request);
        } catch {
          continue;
        }
        await pool.query(
          `UPDATE cargo_integritas_states SET status='submitted',operation_id=$2,error=NULL,updated_at=clock_timestamp()
           WHERE request_id=$1 AND status='unknown' AND operation_id IS NULL`, [request.id, operation]);
      }
    }
  };
}

export function startIntegritasWorker(service, logger) {
  let stopped = false, pending, timer;
  const loop = () => {
    pending = service.tick()
      .catch(error => logger.error('Integritas test tick failed', error.code ?? 'internal'))
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, 1000);
      });
  };
  loop();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
  };
}
