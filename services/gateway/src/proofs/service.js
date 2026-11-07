import { randomUUID } from 'node:crypto';
import { ApiError, uuid } from '../telemetry/schema.js';
import { hash } from '../cargo/shared.js';
import { TYPES, buildCommitment, ProofError } from './commitment.js';
import { inspectChain, verifyBundle } from './verifier.js';
import { createRpc } from './rpc.js';
import { createMinima } from './minima.js';
const publicFields =
  'id,shipment_id,event_id,sequence,mode,chain_id,publisher_address,state,commitment,wire,txpow_id,transaction_id,required_depth,confirmations,included_height,included_block_id,last_checked_at,last_error_code,publication_blocked,test_receipt,created_at,updated_at';
export function createProofService(pool, config = { mode: 'disabled' }, { writer, reader } = {}) {
  let adapter,
    busyVerify = false,
    nextVerify = 0,
    stopping = false;
  const service = {
    stop() {
      stopping = true;
    },
    async initialize() {
      if (config.mode === 'live') {
        if (!config.publisherAddress)
          throw new ProofError('PUBLISHER_ADDRESS_REQUIRED', { retryable: false });
        writer ??= await createRpc({
          url: config.writerUrl,
          file: config.writerFile,
          caFile: config.caFile
        });
        reader ??= await createRpc({
          url: config.readerUrl,
          file: config.readerFile,
          caFile: config.readerCaFile,
          readOnly: true,
          requestTimeout: 10000
        });
        const guard = (rpc) => ({
          call(...args) {
            if (stopping) throw new ProofError('WORKER_STOPPING');
            return rpc.call(...args);
          }
        });
        writer = guard(writer);
        reader = guard(reader);
        adapter = createMinima(writer, config);
      }
    },
    async list(tenant, shipment, limit = 100, cursor) {
      uuid(tenant);
      uuid(shipment);
      if (cursor) uuid(cursor);
      if (
        !(
          await pool.query('SELECT 1 FROM cargo_shipments WHERE tenant_id=$1 AND id=$2', [
            tenant,
            shipment
          ])
        ).rowCount
      )
        throw new ApiError(404, 'shipment not found');
      const result = await pool.query(
        `SELECT ${publicFields} FROM cargo_proofs WHERE tenant_id=$1 AND shipment_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4`,
        [tenant, shipment, cursor ?? null, limit]
      );
      return {
        engine_mode: config.mode,
        proofs: result.rows,
        next_cursor: result.rowCount === limit ? result.rows.at(-1).id : null
      };
    },
    async get(tenant, id) {
      uuid(id);
      const row = (
        await pool.query(`SELECT ${publicFields} FROM cargo_proofs WHERE tenant_id=$1 AND id=$2`, [
          tenant,
          id
        ])
      ).rows[0];
      if (!row) throw new ApiError(404, 'proof not found');
      return row;
    },
    async bundle(tenant, id) {
      const proof = await service.get(tenant, id);
      if (Number(proof.sequence) > 2000)
        throw new ApiError(
          413,
          'chain exceeds bundle limit; segmented verification not implemented'
        );
      const size = (
        await pool.query(
          'SELECT coalesce(sum(octet_length(canonical_payload)),0) AS bytes FROM cargo_events WHERE tenant_id=$1 AND shipment_id=$2 AND sequence<=$3',
          [tenant, proof.shipment_id, proof.sequence]
        )
      ).rows[0];
      if (Number(size.bytes) > 3500000)
        throw new ApiError(413, 'bundle exceeds bounded export size');
      const records = (
        await pool.query(
          'SELECT id,tenant_id,shipment_id,sequence,event_type,source_trust,canonical_payload,sha256,previous_hash FROM cargo_events WHERE tenant_id=$1 AND shipment_id=$2 AND sequence<=$3 ORDER BY sequence',
          [tenant, proof.shipment_id, proof.sequence]
        )
      ).rows;
      const bundle = { schema_version: 1, proof, records };
      if (Buffer.byteLength(JSON.stringify(bundle)) > 4194304)
        throw new ApiError(413, 'bundle exceeds 4 MiB');
      return bundle;
    },
    async verify(tenant, id) {
      const bundle = await service.bundle(tenant, id);
      // Bound node work globally; no tenant can use this as an arbitrary RPC relay.
      if (busyVerify || Date.now() < nextVerify)
        throw new ApiError(429, 'verification busy; retry later');
      busyVerify = true;
      nextVerify = Date.now() + 1000;
      try {
        return await verifyBundle(bundle, {
          rpc: reader,
          expectedPublisher: config.publisherAddress,
          chain: config.chain,
          depth: config.depth
        });
      } finally {
        busyVerify = false;
      }
    },
    async tick() {
      if (config.mode === 'disabled' || stopping) return;
      const db = await pool.connect();
      let locked = false;
      try {
        locked = (await db.query('SELECT pg_try_advisory_lock(736219,7) AS locked')).rows[0].locked;
        if (!locked) return;
        const rows = (
          await db.query(
            `SELECT e.* FROM cargo_outbox o JOIN cargo_events e ON e.id=o.event_id AND e.tenant_id=o.tenant_id WHERE e.event_type=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM cargo_proofs p WHERE p.event_id=e.id AND p.mode=$2) ORDER BY e.recorded_at,e.sequence LIMIT 100`,
            [TYPES, config.mode]
          )
        ).rows;
        for (const row of rows) {
          if (stopping) return;
          const c = buildCommitment(row, {
            mode: config.mode,
            chain: config.chain,
            publisherAddress: config.publisherAddress
          });
          await db.query('BEGIN');
          try {
            const inserted = await db.query(
              `INSERT INTO cargo_proofs(id,tenant_id,shipment_id,event_id,sequence,mode,chain_id,publisher_address,commitment,commitment_canonical,commitment_sha256,wire,custom_id,required_depth) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(event_id,mode) DO NOTHING RETURNING id`,
              [
                randomUUID(),
                row.tenant_id,
                row.shipment_id,
                row.id,
                row.sequence,
                config.mode,
                config.chain,
                config.publisherAddress,
                c.envelope,
                c.canonical,
                c.digest,
                c.wire,
                'trk_' + c.digest,
                config.depth
              ]
            );
            if (config.mode === 'live')
              await db.query(
                'UPDATE cargo_outbox SET proof_enqueued_at=COALESCE(proof_enqueued_at,now()) WHERE event_id=$1',
                [row.id]
              );
            if (inserted.rowCount)
              await db.query(
                'INSERT INTO cargo_proof_states(id,proof_id,state,details) VALUES($1,$2,$3,$4)',
                [randomUUID(), inserted.rows[0].id, 'pending', {}]
              );
            await db.query('COMMIT');
          } catch (e) {
            await db.query('ROLLBACK');
            throw e;
          }
        }
        if (config.mode === 'test') {
          const pending = (
            await db.query(
              "SELECT * FROM cargo_proofs WHERE mode='test' AND state='pending' ORDER BY sequence LIMIT 100"
            )
          ).rows;
          for (const row of pending)
            await state(db, row, 'submitted', {
              test_receipt: 'test:' + row.commitment_sha256,
              last_error_code: 'TEST_ONLY_NOT_BLOCKCHAIN'
            });
          return;
        }
        // Recheck confirmed as well as submitted artifacts. Absence/pruning never counts as confirmation.
        const reconciled = new Set();
        const monitor = (
          await db.query(
            "SELECT * FROM cargo_proofs WHERE mode='live' AND txpow_id IS NOT NULL ORDER BY last_checked_at NULLS FIRST LIMIT 100"
          )
        ).rows;
        for (const row of monitor) {
          if (stopping) return;
          try {
            const result = await inspectChain(reader, row, audit(db, row.id));
            reconciled.add(row.id);
            await state(
              db,
              row,
              result.status === 'unavailable' ? 'retryable_error' : result.status,
              {
                confirmations: result.confirmations,
                included_height: result.included_height ?? row.included_height,
                included_block_id: result.included_block_id ?? row.included_block_id,
                verification: result,
                last_checked_at: new Date(),
                last_error_code: result.status === 'unavailable' ? result.reason : null
              }
            );
          } catch (e) {
            await state(db, row, e.retryable === false ? 'failed' : 'retryable_error', {
              confirmations: 0,
              last_checked_at: new Date(),
              last_error_code: e.code ?? 'NODE_UNAVAILABLE',
              publication_blocked: row.publication_blocked || e.retryable === false
            });
          }
        }
        if (stopping) return;
        // One wallet spend in flight. Do not spend selected inputs twice across shipments.
        const inflight = (
          await db.query(
            "SELECT * FROM cargo_proofs WHERE mode='live' AND mined_data IS NOT NULL AND state<>'confirmed' ORDER BY created_at LIMIT 1"
          )
        ).rows[0];
        let row = inflight;
        if (!row)
          row = (
            await db.query(
              `SELECT p.* FROM cargo_proofs p WHERE p.mode='live' AND p.mined_data IS NULL AND p.state IN ('pending','submitting','retryable_error') AND p.next_attempt_at<=now() AND NOT EXISTS(SELECT 1 FROM cargo_events e WHERE e.shipment_id=p.shipment_id AND e.sequence<p.sequence AND e.event_type=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM cargo_proofs predecessor WHERE predecessor.event_id=e.id AND predecessor.mode='live' AND predecessor.state='confirmed')) ORDER BY p.created_at,p.sequence LIMIT 1`,
              [TYPES]
            )
          ).rows[0];
        if (row?.mined_data && !reconciled.has(row.id)) return;
        if (
          row &&
          (row.chain_id !== config.chain || row.publisher_address !== config.publisherAddress)
        )
          throw new ProofError('PUBLISHER_CONFIGURATION_CHANGED', { retryable: false });
        if (
          !row ||
          row.attempts >= config.maxAttempts ||
          row.submit_attempts >= config.maxAttempts ||
          row.publication_blocked ||
          row.state === 'failed' ||
          row.state === 'included' ||
          new Date(row.next_attempt_at) > new Date()
        )
          return;
        try {
          const attempt = row.attempts + 1;
          await state(db, row, 'submitting', { attempts: attempt, last_error_code: null });
          row.attempts = attempt;
          if (!row.mined_data) {
            const mined = await adapter.prepare(row, audit(db, row.id), async (fields) => {
              await update(db, row.id, fields);
              Object.assign(row, fields);
            });
            const artifact = { ...mined, mined_sha256: hash(mined.mined_data) };
            await update(db, row.id, artifact);
            Object.assign(row, artifact);
          }
          if (hash(row.mined_data) !== row.mined_sha256)
            throw new ProofError('MINED_ARTIFACT_CHECKSUM', { retryable: false });
          // DB checkpoint must succeed BEFORE the network side effect. Always reuse this exact blob after ambiguity.
          await update(db, row.id, { submit_attempts: row.submit_attempts + 1 });
          await adapter.broadcast(row, audit(db, row.id));
          await state(db, row, 'submitted', {
            next_attempt_at: new Date(Date.now() + 30000)
          });
        } catch (e) {
          await state(
            db,
            row,
            e.retryable === false || row.attempts >= config.maxAttempts
              ? 'failed'
              : 'retryable_error',
            {
              last_error_code: e.code ?? 'PUBLISH_FAILED',
              publication_blocked: e.retryable === false || row.attempts >= config.maxAttempts,
              next_attempt_at: new Date(Date.now() + Math.min(300000, 1000 * 2 ** row.attempts))
            }
          );
        }
      } finally {
        if (locked)
          try {
            await db.query('SELECT pg_advisory_unlock(736219,7)');
          } catch {}
        db.release();
      }
    }
  };
  return service;
}
const mutable = new Set([
  'publication_blocked',
  'signed_data',
  'transaction_id',
  'mined_data',
  'mined_sha256',
  'txpow_id',
  'attempts',
  'submit_attempts',
  'test_receipt',
  'last_error_code',
  'next_attempt_at',
  'confirmations',
  'included_height',
  'included_block_id',
  'last_checked_at',
  'verification'
]);
async function update(db, id, fields) {
  const entries = Object.entries(fields);
  if (entries.some(([k]) => !mutable.has(k))) throw new Error('invalid proof update');
  await db.query(
    `UPDATE cargo_proofs SET ${entries.map(([k], i) => k + '=$' + (i + 2)).join(',')},updated_at=now() WHERE id=$1`,
    [id, ...entries.map(([, v]) => v)]
  );
}
async function state(db, row, value, fields = {}) {
  await db.query('BEGIN');
  try {
    const entries = Object.entries(fields);
    if (entries.some(([k]) => !mutable.has(k))) throw new Error('invalid proof update');
    await db.query(
      `UPDATE cargo_proofs SET state=$2,${entries.map(([k], i) => k + '=$' + (i + 3) + ',').join('')}updated_at=now() WHERE id=$1`,
      [row.id, value, ...entries.map(([, v]) => v)]
    );
    if (row.state !== value)
      await db.query(
        'INSERT INTO cargo_proof_states(id,proof_id,state,details) VALUES($1,$2,$3,$4)',
        [randomUUID(), row.id, value, { reason: fields.last_error_code ?? null }]
      );
    await db.query('COMMIT');
    row.state = value;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
function audit(db, proof) {
  return {
    async start(operation, request) {
      const id = randomUUID();
      await db.query(
        'INSERT INTO cargo_proof_attempts(id,proof_id,operation,request) VALUES($1,$2,$3,$4)',
        [id, proof, operation, request]
      );
      return id;
    },
    async finish(id, response) {
      await db.query(
        "UPDATE cargo_proof_attempts SET outcome='succeeded',finished_at=now(),response=$2,response_sha256=$3 WHERE id=$1",
        [id, response, hash(JSON.stringify(response))]
      );
    },
    async fail(id, error) {
      await db.query(
        "UPDATE cargo_proof_attempts SET outcome='failed',finished_at=now(),error_code=$2 WHERE id=$1",
        [id, error]
      );
    }
  };
}
export function startProofWorker(proofs, logger = console, pollMs = 5000) {
  let stopping = false,
    timer,
    running = Promise.resolve();
  const run = () => {
    running = proofs
      .tick()
      .catch((e) => logger.error('proof worker failed', e.code ?? 'internal'))
      .finally(() => {
        if (!stopping) timer = setTimeout(run, pollMs);
      });
  };
  run();
  return async () => {
    stopping = true;
    proofs.stop();
    clearTimeout(timer);
    await running;
  };
}
