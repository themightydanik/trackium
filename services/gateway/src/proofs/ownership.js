import { randomUUID, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { ApiError, object, uuid, canonicalize } from '../telemetry/schema.js';
import { transaction, hash } from '../cargo/shared.js';
import { buildCommitment, TYPES, hexId } from './commitment.js';
import { preflight } from './safety.js';
function apiId(value) {
  try {
    return hexId(value);
  } catch {
    throw new ApiError(400, 'invalid Minima identifier');
  }
}
export async function loadSigner(file) {
  if (!file) return null;
  const info = await stat(file);
  if (!info.isFile() || info.mode & 0o077 || info.size > 8192)
    throw new Error('Unsafe job signing key file');
  const key = createPrivateKey(await readFile(file));
  const exported = createPublicKey(key).export({ format: 'jwk' });
  if (exported.crv !== 'P-256') throw new Error('Job signer must be P-256');
  const publicKey = { kty: 'EC', crv: 'P-256', x: exported.x, y: exported.y };
  return {
    publicKey,
    fingerprint: hash(canonicalize(publicKey)),
    packet(payload) {
      payload = JSON.parse(JSON.stringify(payload));
      return {
        payload,
        issuer: publicKey,
        signature: sign('sha256', Buffer.from(canonicalize(payload)), {
          key,
          dsaEncoding: 'ieee-p1363'
        }).toString('base64')
      };
    }
  };
}
export function createOwnership(pool, config, proofs, { getReader, getWriter, getSigner }) {
  const requireLive = () => {
    if (config.mode !== 'live' || config.chain !== '0x00' || config.allowMainnet !== true)
      throw new ApiError(403, 'Mainnet publication is disabled');
  };
  let preflightBusy = false,
    preflightNext = 0,
    lastPreflight = null,
    lastTenant = null;
  const owner = {
    async status(tenant) {
      const policy =
        (await pool.query('SELECT * FROM cargo_publisher_policies WHERE tenant_id=$1', [tenant]))
          .rows[0] ?? null;
      const signer = getSigner();
      const pending = (
        await pool.query(
          `SELECT e.id,e.shipment_id,e.event_type,e.event_time,e.source_trust FROM cargo_outbox o JOIN cargo_events e ON e.id=o.event_id WHERE e.tenant_id=$1 AND e.event_type=ANY($2::text[]) AND NOT EXISTS(SELECT 1 FROM cargo_proofs p WHERE p.event_id=e.id AND p.mode='live' AND p.approved_at IS NOT NULL) ORDER BY e.recorded_at LIMIT 50`,
          [tenant, TYPES]
        )
      ).rows;
      return {
        pending_events: pending,
        last_preflight: lastTenant === tenant ? lastPreflight : null,
        policy,
        network: 'Mainnet',
        enabled: config.mode === 'live' && config.allowMainnet === true,
        global_limit: config.maxPublications ?? 1,
        signer_fingerprint: signer?.fingerprint ?? null,
        connection:
          policy?.publisher_kind === 'local'
            ? 'Local Core is checked in the installed MiniDapp; manual signed file exchange'
            : 'Server Core checked on explicit preflight/approval',
        automatic_backlog: false
      };
    },
    async policy(tenant, input) {
      requireLive();
      object(input, ['publisher_kind', 'publisher_address', 'max_publications', 'max_input']);
      if (
        !['local', 'server'].includes(input.publisher_kind) ||
        !['0.01', '0.1', '1'].includes(input.max_input) ||
        !Number.isInteger(input.max_publications) ||
        input.max_publications < 1 ||
        input.max_publications > 100
      )
        throw new ApiError(400, 'invalid publisher policy');
      const address = apiId(input.publisher_address);
      if (
        input.publisher_kind === 'server' &&
        (!getWriter() || address !== config.publisherAddress)
      )
        throw new ApiError(409, 'server wallet configuration does not match');
      if (input.publisher_kind === 'local' && !getSigner())
        throw new ApiError(503, 'external job signing key required');
      return transaction(pool, tenant, async (db) => {
        if (
          !(
            await db.query(
              "SELECT pg_try_advisory_xact_lock(hashtextextended('trackium:proof:'||current_schema(),0)) AS locked"
            )
          ).rows[0].locked
        )
          throw new ApiError(409, 'publisher busy; retry after in-flight work');
        if (
          (
            await db.query(
              "SELECT 1 FROM cargo_proofs WHERE tenant_id=$1 AND mode='live' LIMIT 1",
              [tenant]
            )
          ).rowCount
        ) {
          const current = (
            await db.query('SELECT * FROM cargo_publisher_policies WHERE tenant_id=$1', [tenant])
          ).rows[0];
          if (!current) {
            const conflict = (
              await db.query(
                "SELECT 1 FROM cargo_proofs WHERE tenant_id=$1 AND mode='live' AND (publisher_kind<>$2 OR publisher_address<>$3) LIMIT 1",
                [tenant, input.publisher_kind, address]
              )
            ).rowCount;
            if (conflict || input.max_input !== '1')
              throw new ApiError(409, 'legacy proof ownership/input cap must be preserved');
          }
          if (
            current &&
            (current.publisher_kind !== input.publisher_kind ||
              current.publisher_address !== address ||
              current.max_input !== input.max_input)
          )
            throw new ApiError(
              409,
              'publisher ownership and input cap are locked after first live proof'
            );
        }
        return (
          await db.query(
            'INSERT INTO cargo_publisher_policies(tenant_id,publisher_kind,publisher_address,max_publications,max_input) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id) DO UPDATE SET publisher_kind=$2,publisher_address=$3,max_publications=$4,max_input=$5 RETURNING *',
            [tenant, input.publisher_kind, address, input.max_publications, input.max_input]
          )
        ).rows[0];
      });
    },
    async preflight(tenant) {
      requireLive();
      const policy = (await owner.status(tenant)).policy;
      if (!policy) throw new ApiError(409, 'publisher policy required');
      if (policy.publisher_kind === 'local')
        return { ready: false, reason: 'Run preflight in the installed Core MiniDapp', ...policy };
      if (preflightBusy || Date.now() < preflightNext)
        throw new ApiError(429, 'Core preflight busy; retry later');
      preflightBusy = true;
      preflightNext = Date.now() + 1000;
      try {
        lastPreflight = await preflight(getWriter(), policy.publisher_address, config);
        lastTenant = tenant;
        return lastPreflight;
      } finally {
        preflightBusy = false;
      }
    },
    async approve(tenant, eventId, input) {
      requireLive();
      uuid(eventId);
      object(input, ['confirmation']);
      if (input.confirmation !== 'PUBLISH MAINNET ' + eventId)
        throw new ApiError(400, 'explicit event-specific Mainnet confirmation required');
      const p = (await owner.status(tenant)).policy;
      if (!p) throw new ApiError(409, 'publisher policy required');
      if (p.publisher_kind === 'server') await owner.preflight(tenant);
      return transaction(pool, tenant, async (db) => {
        if (
          !(
            await db.query(
              "SELECT pg_try_advisory_xact_lock(hashtextextended('trackium:proof:'||current_schema(),0)) AS locked"
            )
          ).rows[0].locked
        )
          throw new ApiError(409, 'publisher busy; retry after in-flight work');
        const policy = (
          await db.query('SELECT * FROM cargo_publisher_policies WHERE tenant_id=$1', [tenant])
        ).rows[0];
        if (canonicalize(policy) !== canonicalize(p))
          throw new ApiError(409, 'policy changed; retry approval');
        const event = (
          await db.query(
            'SELECT e.* FROM cargo_events e JOIN cargo_outbox o ON e.id=o.event_id WHERE e.id=$1 AND e.tenant_id=$2',
            [eventId, tenant]
          )
        ).rows[0];
        if (!event) throw new ApiError(404, 'event not found');
        if (!TYPES.includes(event.event_type))
          throw new ApiError(400, 'event not selected for proofs');
        let row = (
          await db.query("SELECT * FROM cargo_proofs WHERE event_id=$1 AND mode='live'", [eventId])
        ).rows[0];
        if (row) {
          if (
            row.publisher_kind !== policy.publisher_kind ||
            row.publisher_address !== policy.publisher_address
          )
            throw new ApiError(409, 'proof already owned by another publisher');
          if (row.approved_at) return proofs.get(tenant, row.id);
        }
        const counts = await db.query(
          "SELECT count(*) AS global_count,count(*) FILTER(WHERE tenant_id=$1) AS tenant_count FROM cargo_proofs WHERE mode='live'",
          [tenant]
        );
        if (
          Number(counts.rows[0].global_count) - (row ? 1 : 0) >= (config.maxPublications ?? 1) ||
          Number(counts.rows[0].tenant_count) - (row ? 1 : 0) >= policy.max_publications
        )
          throw new ApiError(409, 'publication count limit reached');
        if (!row) {
          const c = buildCommitment(event, {
            mode: 'live',
            chain: config.chain,
            publisherAddress: policy.publisher_address
          });
          row = (
            await db.query(
              `INSERT INTO cargo_proofs(id,tenant_id,shipment_id,event_id,sequence,mode,chain_id,publisher_address,commitment,commitment_canonical,commitment_sha256,wire,custom_id,required_depth,publisher_kind) VALUES($1,$2,$3,$4,$5,'live',$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
              [
                randomUUID(),
                tenant,
                event.shipment_id,
                eventId,
                event.sequence,
                config.chain,
                policy.publisher_address,
                c.envelope,
                c.canonical,
                c.digest,
                c.wire,
                'trk_' + c.digest,
                config.depth,
                policy.publisher_kind
              ]
            )
          ).rows[0];
        }
        await db.query(
          "UPDATE cargo_proofs SET approved_at=now(),approval_expires_at=now()+interval '24 hours' WHERE id=$1",
          [row.id]
        );
        await db.query(
          'UPDATE cargo_outbox SET proof_enqueued_at=COALESCE(proof_enqueued_at,now()) WHERE event_id=$1',
          [eventId]
        );
        return {
          proof_id: row.id,
          approved: true,
          publisher_kind: row.publisher_kind,
          expires_in_hours: 24
        };
      });
    },
    async job(tenant, id) {
      requireLive();
      const bundle = await proofs.bundle(tenant, id),
        p = bundle.proof;
      if (
        p.publisher_kind !== 'local' ||
        !p.approved_at ||
        new Date(p.approval_expires_at) < new Date()
      )
        throw new ApiError(409, 'valid local approval required');
      const predecessor = (
        await pool.query(
          `SELECT 1 FROM cargo_events e WHERE e.tenant_id=$1 AND e.shipment_id=$2 AND e.sequence<$3 AND e.event_type=ANY($4::text[]) AND NOT EXISTS(SELECT 1 FROM cargo_proofs earlier WHERE earlier.event_id=e.id AND earlier.mode='live' AND earlier.state='confirmed') LIMIT 1`,
          [tenant, p.shipment_id, p.sequence, TYPES]
        )
      ).rowCount;
      if (predecessor) throw new ApiError(409, 'selected predecessor is not confirmed');
      const policy = (await owner.status(tenant)).policy;
      const signer = getSigner();
      if (!signer) throw new ApiError(503, 'job signer unavailable');
      await transaction(pool, tenant, async (db) => {
        if (
          !(
            await db.query(
              "SELECT pg_try_advisory_xact_lock(hashtextextended('trackium:proof:'||current_schema(),0)) AS locked"
            )
          ).rows[0].locked
        )
          throw new ApiError(409, 'publisher busy; retry after in-flight work');
        const serverSpend = (
          await db.query(
            "SELECT 1 FROM cargo_proofs WHERE mode='live' AND publisher_kind='server' AND publisher_address=$1 AND state<>'confirmed' AND (state='submitting' OR signed_data IS NOT NULL OR mined_data IS NOT NULL) LIMIT 1",
            [p.publisher_address]
          )
        ).rowCount;
        if (serverSpend) throw new ApiError(409, 'wallet has an unresolved server publication');
        await db.query(
          'INSERT INTO cargo_local_wallet_claims(publisher_address,proof_id,tenant_id) VALUES($1,$2,$3) ON CONFLICT(publisher_address) DO NOTHING',
          [p.publisher_address, id, tenant]
        );
        const claim = (
          await db.query(
            'SELECT proof_id FROM cargo_local_wallet_claims WHERE publisher_address=$1',
            [p.publisher_address]
          )
        ).rows[0];
        if (claim.proof_id !== id)
          throw new ApiError(409, 'wallet is reserved by another approved local job');
      });
      return signer.packet({
        domain: 'trackium:local-core:job:v1',
        schema_version: 1,
        job_id: id,
        expires_at: p.approval_expires_at,
        max_input: policy.max_input,
        max_attempts: 3,
        bundle
      });
    },
    async checkpoint(tenant, id, input) {
      requireLive();
      object(input, ['txpow_id', 'transaction_id', 'mined_data']);
      const tx = apiId(input.txpow_id),
        transactionId = apiId(input.transaction_id);
      if (
        typeof input.mined_data !== 'string' ||
        !/^0x(?:[a-f0-9]{2})+$/i.test(input.mined_data) ||
        input.mined_data.length > 131072
      )
        throw new ApiError(400, 'invalid or oversized mined artifact');
      const proof = await proofs.get(tenant, id);
      if (proof.publisher_kind !== 'local' || !proof.approved_at)
        throw new ApiError(409, 'not a locally owned approved job');
      await transaction(pool, tenant, async (db) => {
        const p = (
          await db.query('SELECT * FROM cargo_proofs WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [
            id,
            tenant
          ])
        ).rows[0];
        if (
          !p.txpow_id &&
          !(
            await db.query(
              'SELECT 1 FROM cargo_local_wallet_claims WHERE proof_id=$1 AND tenant_id=$2 AND publisher_address=$3',
              [id, tenant, p.publisher_address]
            )
          ).rowCount
        )
          throw new ApiError(409, 'export and reserve the signed local job first');
        if (p.txpow_id) {
          if (
            p.txpow_id !== tx ||
            p.mined_data !== input.mined_data ||
            p.transaction_id !== transactionId
          )
            throw new ApiError(409, 'checkpoint identity conflict');
          return;
        }
        if (new Date(p.approval_expires_at) < new Date())
          throw new ApiError(409, 'approval expired');
        await db.query(
          "UPDATE cargo_proofs SET txpow_id=$2,transaction_id=$3,mined_data=$4,mined_sha256=$5,state='submitting',last_error_code='LOCAL_CHECKPOINT_UNVERIFIED' WHERE id=$1",
          [id, tx, transactionId, input.mined_data, hash(input.mined_data)]
        );
      });
      return getSigner().packet({
        domain: 'trackium:local-core:ack:v1',
        job_id: id,
        txpow_id: tx,
        mined_sha256: hash(input.mined_data),
        stage: 'checkpoint',
        wire: proof.wire
      });
    },
    async result(tenant, id, input) {
      object(input, ['txpow_id']);
      const p = await proofs.get(tenant, id);
      if (p.publisher_kind !== 'local' || !p.txpow_id || p.txpow_id !== apiId(input.txpow_id))
        throw new ApiError(409, 'result does not match durable local checkpoint');
      const verification = await proofs.verify(tenant, id);
      if (verification.verified)
        await pool.query(
          'DELETE FROM cargo_local_wallet_claims WHERE proof_id=$1 AND tenant_id=$2',
          [id, tenant]
        );
      return {
        verification,
        ack: getSigner()?.packet({
          domain: 'trackium:local-core:ack:v1',
          job_id: id,
          txpow_id: p.txpow_id,
          wire: p.wire,
          stage: verification.verified ? 'confirmed' : 'not_confirmed',
          checked_at: new Date().toISOString()
        })
      };
    }
  };
  return owner;
}
