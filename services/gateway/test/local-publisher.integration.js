import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { provisionTenant, issueKey } from '../src/telemetry/service.js';
import { ProofError } from '../src/proofs/commitment.js';
const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) throw Error('TEST_DATABASE_URL required');
const ADDRESS = '0x' + 'a'.repeat(64),
  TX = '0x' + 'b'.repeat(64),
  BLOCK = '0x' + 'c'.repeat(64);
test(
  'Local publisher: authenticated owner policy, signed file exchange and independent mock-node verification',
  { timeout: 20000 },
  async (t) => {
    const schema = 'local_proof_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: URL_DB });
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({ connectionString: URL_DB, options: '-c search_path=' + schema });
    const dir = await mkdtemp(tmpdir() + '/trackium-local-api-'),
      file = dir + '/signer.pem';
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    await writeFile(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    let visible = false,
      wire,
      depth = 6,
      corrupt = false,
      largeInput = false;
    const reader = {
      async call(c) {
        if (c === 'status')
          return { version: '1.0.49.4', chain: { block: 100 + depth, hash: BLOCK } };
        if (c.startsWith('txpow txpowid:')) {
          if (!visible) throw new ProofError('RPC_NOT_FOUND');
          const coin = { address: ADDRESS, tokenid: '0x00', amount: largeInput ? '0.1' : '0.001' };
          return {
            txpowid: TX,
            istransaction: true,
            header: { chainid: '0x00' },
            body: {
              txn: {
                transactionid: TX,
                inputs: [coin],
                outputs: largeInput
                  ? [
                      { ...coin, amount: '0.001' },
                      { ...coin, amount: '0.099' }
                    ]
                  : [coin],
                state: [{ port: 250, data: corrupt ? '0x00' : wire }]
              },
              witness: {
                scripts: [{ address: ADDRESS, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' }],
                signatures: [{}]
              }
            }
          };
        }
        if (c.startsWith('txpow onchain:'))
          return {
            found: true,
            block: '100',
            blockid: BLOCK,
            tip: String(100 + depth),
            confirmations: String(depth)
          };
        if (c === 'txpow block:100')
          return {
            txpowid: BLOCK,
            isblock: true,
            header: { chainid: '0x00', block: '100' },
            body: { txnlist: [TX] }
          };
        throw Error(c);
      }
    };
    const config = {
      ...readConfig({
        DATABASE_URL: URL_DB,
        PROOF_MODE: 'live',
        PROOF_ALLOW_LIVE: 'true',
        PROOF_ALLOW_MAINNET: 'true',
        PROOF_PUBLISHER: 'local',
        PROOF_JOB_SIGNING_KEY_FILE: file
      }),
      webEnabled: true,
      simulatorEnabled: true,
      tcpPort: 0,
      httpPort: 0,
      host: '127.0.0.1'
    };
    const runtime = createRuntime(db, config, {
      worker: false,
      proofDependencies: { reader },
      logger: { error() {} }
    });
    await runtime.gateway.start();
    config.publicOrigin = 'http://127.0.0.1:' + runtime.gateway.api.address().port;
    t.after(async () => {
      await runtime.gateway.shutdown();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
      await rm(dir, { recursive: true });
    });
    const a = await provisionTenant(db, 'A'),
      b = await provisionTenant(db, 'B'),
      onlyRead = await issueKey(db, a.tenant_id, ['read']);
    const device = await runtime.telemetry.register(
      a.tenant_id,
      { label: 'Simulator', mode: 'synthetic' },
      'simulator'
    );
    const shipment = await runtime.shipments.create(a.tenant_id, {
      name: 'A cargo',
      device_id: device.id,
      route: [
        { name: 'A', latitude: 50, longitude: 30, radius_m: 100 },
        { name: 'B', latitude: 51, longitude: 31, radius_m: 100 }
      ],
      conditions: {
        temperature_min_c: 2,
        temperature_max_c: 8,
        tolerance_c: 1,
        max_deviation_m: 1000
      }
    });
    const event = (await db.query('SELECT * FROM cargo_events WHERE shipment_id=$1', [shipment.id]))
      .rows[0];
    async function req(path, { token = a.token, method = 'GET', input, headers = {} } = {}) {
      const r = await fetch(config.publicOrigin + path, {
        method,
        headers: {
          authorization: 'Bearer ' + token,
          'content-type': 'application/json',
          ...headers
        },
        body: input === undefined ? undefined : JSON.stringify(input)
      });
      return { status: r.status, body: await r.json() };
    }
    const shipmentOnly = await issueKey(db, a.tenant_id, ['read', 'shipments']);
    let proofId, job, ack;
    await t.test(
      'enabling live does not enqueue or publish backlog; owner and scope checks hold',
      async () => {
        await runtime.proofs.tick();
        assert.equal((await db.query('SELECT count(*) FROM cargo_proofs')).rows[0].count, '0');
        const policy = {
          publisher_kind: 'local',
          publisher_address: ADDRESS,
          max_publications: 1,
          max_input: '0.01'
        };
        assert.equal(
          (
            await req('/v1/proof-publisher/policy', {
              method: 'POST',
              token: onlyRead.token,
              input: policy
            })
          ).status,
          403
        );
        assert.equal(
          (await req('/v1/proof-publisher/policy', { method: 'POST', input: policy })).status,
          200
        );
        assert.equal(
          (
            await req('/v1/proof-publisher/events/' + event.id + '/approve', {
              method: 'POST',
              input: { confirmation: 'yes' }
            })
          ).status,
          400
        );
        const approved = await req('/v1/proof-publisher/events/' + event.id + '/approve', {
          method: 'POST',
          input: { confirmation: 'PUBLISH MAINNET ' + event.id }
        });
        assert.equal(approved.status, 201);
        proofId = approved.body.proof_id;
        wire = (await runtime.proofs.get(a.tenant_id, proofId)).wire;
      }
    );
    await t.test(
      'approval replay is idempotent; count budget and publisher ownership cannot be bypassed',
      async () => {
        assert.equal(
          (
            await req('/v1/proof-publisher/events/' + event.id + '/approve', {
              method: 'POST',
              input: { confirmation: 'PUBLISH MAINNET ' + event.id }
            })
          ).status,
          201
        );
        assert.equal((await db.query('SELECT count(*) FROM cargo_proofs')).rows[0].count, '1');
        assert.equal(
          (
            await req('/v1/proof-publisher/policy', {
              method: 'POST',
              input: {
                publisher_kind: 'local',
                publisher_address: TX,
                max_publications: 10,
                max_input: '1'
              }
            })
          ).status,
          409
        );
        await runtime.shipments.change(a.tenant_id, shipment.id, 'active');
        const next = (
          await db.query('SELECT id FROM cargo_events WHERE shipment_id=$1 AND sequence>1', [
            shipment.id
          ])
        ).rows[0];
        assert.equal(
          (
            await req('/v1/proof-publisher/events/' + next.id + '/approve', {
              method: 'POST',
              input: { confirmation: 'PUBLISH MAINNET ' + next.id }
            })
          ).status,
          409
        );
        assert.equal(
          (
            await req('/v1/proof-publisher/events/' + event.id + '/approve', {
              method: 'POST',
              token: b.token,
              input: { confirmation: 'PUBLISH MAINNET ' + event.id }
            })
          ).status,
          409
        );
      }
    );
    await t.test(
      'signed jobs are tenant-bound; untrusted TXIDs require authenticated durable checkpoint',
      async () => {
        const exported = await req('/v1/proofs/' + proofId + '/local-job');
        assert.equal(exported.status, 200);
        job = exported.body;
        assert.equal(job.payload.bundle.records[0].tenant_id, a.tenant_id);
        assert.equal(job.payload.bundle.proof.publisher_kind, 'local');
        assert.ok(!JSON.stringify(job).includes(a.token));
        assert.equal(
          (await req('/v1/proofs/' + proofId + '/local-job', { token: b.token })).status,
          404
        );
        assert.equal(
          (
            await req('/v1/proofs/' + proofId + '/local-checkpoint', {
              method: 'POST',
              token: onlyRead.token,
              input: { txpow_id: TX, transaction_id: TX, mined_data: '0x5678' }
            })
          ).status,
          403
        );
        assert.equal(
          (
            await req('/v1/proofs/' + proofId + '/local-result', {
              method: 'POST',
              input: { txpow_id: TX }
            })
          ).status,
          409
        );
        assert.equal(
          (
            await req('/v1/proofs/' + proofId + '/local-checkpoint', {
              method: 'POST',
              input: { txpow_id: 'fake', transaction_id: TX, mined_data: '0x5678' }
            })
          ).status,
          400
        );
        assert.equal(
          (
            await req('/v1/proofs/' + proofId + '/local-checkpoint', {
              method: 'POST',
              token: shipmentOnly.token,
              input: { txpow_id: TX, transaction_id: TX, mined_data: '0x5678' }
            })
          ).status,
          403,
          'shipment-only credentials do not gain publish permission'
        );
        const saved = await req('/v1/proofs/' + proofId + '/local-checkpoint', {
          method: 'POST',
          input: { txpow_id: TX, transaction_id: TX, mined_data: '0x5678' }
        });
        assert.equal(saved.status, 200);
        ack = saved.body;
        assert.equal(ack.payload.stage, 'checkpoint');
        assert.ok(!ack.payload.verified);
        const replay = await req('/v1/proofs/' + proofId + '/local-checkpoint', {
          method: 'POST',
          input: { txpow_id: TX, transaction_id: TX, mined_data: '0x5678' }
        });
        assert.equal(replay.status, 200);
        assert.equal(
          (
            await req('/v1/proofs/' + proofId + '/local-checkpoint', {
              method: 'POST',
              input: { txpow_id: BLOCK, transaction_id: TX, mined_data: '0x1234' }
            })
          ).status,
          409
        );
        await runtime.proofs.tick();
        assert.notEqual((await runtime.proofs.get(a.tenant_id, proofId)).state, 'confirmed');
      }
    );
    await t.test(
      'Gateway independently rejects a mismatched onchain commitment and only confirms actual matching depth',
      async () => {
        visible = true;
        corrupt = true;
        let result = await req('/v1/proofs/' + proofId + '/local-result', {
          method: 'POST',
          input: { txpow_id: TX }
        });
        assert.equal(result.body.verification.verified, false);
        assert.equal(result.body.verification.reason, 'COMMITMENT_MISMATCH');
        corrupt = false;
        largeInput = true;
        await new Promise((r) => setTimeout(r, 1010));
        result = await req('/v1/proofs/' + proofId + '/local-result', {
          method: 'POST',
          input: { txpow_id: TX }
        });
        assert.equal(result.body.verification.verified, false);
        assert.equal(result.body.verification.reason, 'SELF_TRANSFER_SPEND_LIMIT');
        largeInput = false;
        await new Promise((r) => setTimeout(r, 1010));
        result = await req('/v1/proofs/' + proofId + '/local-result', {
          method: 'POST',
          input: { txpow_id: TX }
        });
        assert.equal(result.body.verification.verified, true);
        assert.equal(result.body.ack.payload.stage, 'confirmed');
        await runtime.proofs.tick();
        assert.equal((await runtime.proofs.get(a.tenant_id, proofId)).state, 'confirmed');
        assert.equal(
          (await db.query('SELECT submit_attempts FROM cargo_proofs WHERE id=$1', [proofId]))
            .rows[0].submit_attempts,
          0,
          'server never broadcasts for the local publisher'
        );
      }
    );
    await t.test(
      'existing browser pairing protects local-result POST against CSRF and cross-origin use',
      async () => {
        const headers = {
          origin: config.publicOrigin,
          'sec-fetch-site': 'same-origin',
          'x-trackium-client': 'cargo-v2'
        };
        let r = await fetch(config.publicOrigin + '/v1/pairing/challenges', {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ tenant_id: a.tenant_id })
        });
        const challenge = await r.json(),
          cookie = r.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; ');
        assert.equal(r.status, 201);
        assert.equal(
          (
            await req('/v1/pairing/challenges/' + challenge.id + '/approve', {
              method: 'POST',
              input: { scopes: ['read', 'shipments', 'publish'] }
            })
          ).status,
          200
        );
        r = await fetch(config.publicOrigin + '/v1/pairing/session', {
          method: 'POST',
          headers: { ...headers, cookie }
        });
        assert.equal(r.status, 201);
        const sessionCookie = r.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; '),
          session = await r.json();
        assert.ok(session.csrf);
        r = await fetch(config.publicOrigin + '/v1/proofs/' + proofId + '/local-result', {
          method: 'POST',
          headers: { ...headers, cookie: sessionCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ txpow_id: TX })
        });
        assert.equal(r.status, 403);
        r = await fetch(config.publicOrigin + '/v1/proofs/' + proofId + '/local-result', {
          method: 'POST',
          headers: {
            ...headers,
            origin: 'https://evil.invalid',
            cookie: sessionCookie,
            'x-csrf-token': session.csrf,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ txpow_id: TX })
        });
        assert.equal(r.status, 403);
        r = await fetch(config.publicOrigin + '/v1/proofs/' + proofId + '/local-checkpoint', {
          method: 'POST',
          headers: {
            ...headers,
            cookie: sessionCookie,
            'x-csrf-token': session.csrf,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ txpow_id: TX, transaction_id: TX, mined_data: '0x5678' })
        });
        assert.equal(
          r.status,
          200,
          'explicit publish scope and valid same-origin CSRF permit checkpoint replay'
        );
      }
    );
    await t.test(
      'Gateway wallet reservation excludes different clients/tenants until independently confirmed',
      async () => {
        assert.equal(
          (await db.query('SELECT count(*) FROM cargo_local_wallet_claims')).rows[0].count,
          '0',
          'first verified result released its wallet claim'
        );
        config.proofs.maxPublications = 3;
        await runtime.proofs.owner.policy(a.tenant_id, {
          publisher_kind: 'local',
          publisher_address: ADDRESS,
          max_publications: 2,
          max_input: '0.01'
        });
        const next = (
          await db.query('SELECT id FROM cargo_events WHERE shipment_id=$1 AND sequence=2', [
            shipment.id
          ])
        ).rows[0];
        const approved = await runtime.proofs.owner.approve(a.tenant_id, next.id, {
          confirmation: 'PUBLISH MAINNET ' + next.id
        });
        await assert.rejects(
          runtime.proofs.owner.checkpoint(a.tenant_id, approved.proof_id, {
            txpow_id: TX,
            transaction_id: TX,
            mined_data: '0x5678'
          }),
          /reserve/
        );
        const one = await runtime.proofs.owner.job(a.tenant_id, approved.proof_id);
        assert.equal(
          (await runtime.proofs.owner.job(a.tenant_id, approved.proof_id)).payload.job_id,
          one.payload.job_id,
          'lost job-export response reuses the same reservation'
        );
        const bd = await runtime.telemetry.register(
          b.tenant_id,
          { label: 'B simulator', mode: 'synthetic' },
          'simulator'
        );
        const bs = await runtime.shipments.create(b.tenant_id, {
          name: 'B cargo',
          device_id: bd.id,
          route: [
            { name: 'A', latitude: 50, longitude: 30, radius_m: 100 },
            { name: 'B', latitude: 51, longitude: 31, radius_m: 100 }
          ],
          conditions: {
            temperature_min_c: 2,
            temperature_max_c: 8,
            tolerance_c: 1,
            max_deviation_m: 1000
          }
        });
        await runtime.proofs.owner.policy(b.tenant_id, {
          publisher_kind: 'local',
          publisher_address: ADDRESS,
          max_publications: 1,
          max_input: '0.01'
        });
        const be = (await db.query('SELECT id FROM cargo_events WHERE shipment_id=$1', [bs.id]))
          .rows[0];
        const second = await runtime.proofs.owner.approve(b.tenant_id, be.id, {
          confirmation: 'PUBLISH MAINNET ' + be.id
        });
        await assert.rejects(
          runtime.proofs.owner.job(b.tenant_id, second.proof_id),
          (error) => error.status === 409 && /reserved/.test(error.message)
        );
        assert.equal(
          (await db.query('SELECT count(*) FROM cargo_local_wallet_claims')).rows[0].count,
          '1'
        );
      }
    );
  }
);
