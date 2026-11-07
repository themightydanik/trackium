import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';
import { provisionTenant, createTelemetryService } from '../src/telemetry/service.js';
import { createShipmentService, appendEvent, shipment } from '../src/cargo/shipments.js';
import { transaction, hash } from '../src/cargo/shared.js';
import { createProofService } from '../src/proofs/service.js';
import { buildCommitment, ProofError } from '../src/proofs/commitment.js';
const url = process.env.TEST_DATABASE_URL;
if (!url) throw Error('TEST_DATABASE_URL required');
const ADDRESS = '0x' + 'a'.repeat(64),
  TX = '0x' + 'b'.repeat(64),
  BLOCK = '0x' + 'c'.repeat(64);
const witness = {
  scripts: [{ address: ADDRESS, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' }],
  signatures: [{}]
};
test(
  'Proof Engine PostgreSQL + mock Core (no real blockchain transactions)',
  { timeout: 30000 },
  async (t) => {
    const schema = 'proof_test_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: url });
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({ connectionString: url, options: '-c search_path=' + schema });
    const runtime = createRuntime(
      db,
      {
        ...readConfig({ DATABASE_URL: url, PROOF_MODE: 'test' }),
        tcpPort: 0,
        httpPort: 0,
        host: '127.0.0.1'
      },
      { worker: false, logger: { error() {} } }
    );
    await runtime.gateway.start();
    t.after(async () => {
      await runtime.gateway.shutdown();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    });
    const a = await provisionTenant(db, 'A'),
      b = await provisionTenant(db, 'B'),
      telemetry = createTelemetryService(db),
      shipments = createShipmentService(db);
    const device = await telemetry.register(
      a.tenant_id,
      { label: 'Simulation', mode: 'synthetic' },
      'simulator'
    );
    const s = await shipments.create(a.tenant_id, {
      name: 'Private cargo',
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
    await transaction(db, a.tenant_id, async (client) => {
      const row = await shipment(client, a.tenant_id, s.id, true);
      await appendEvent(client, row, 'telemetry_recorded', { temperature_c: 5 }, 'skip');
      await appendEvent(client, row, 'checkpoint_reached', { checkpoint: 'B' }, 'checkpoint');
    });
    const req = async (path, token = a.token, method = 'GET') => {
      const res = await fetch('http://127.0.0.1:' + runtime.gateway.api.address().port + path, {
        method,
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined
      });
      return { status: res.status, body: await res.json() };
    };
    let testProof;
    await t.test('test outbox is idempotent, synthetic and never contains fake TXIDs', async () => {
      await Promise.all([runtime.proofs.tick(), runtime.proofs.tick()]);
      await runtime.proofs.tick();
      const rows = (await db.query("SELECT * FROM cargo_proofs WHERE mode='test'")).rows;
      assert.equal(rows.length, 2);
      testProof = rows.find((p) => p.sequence === '1');
      for (const p of rows) {
        assert.equal(p.state, 'submitted');
        assert.equal(p.txpow_id, null);
        assert.equal(p.signed_data, null);
        assert.equal(p.commitment.source_trust, 'synthetic');
        assert.match(p.test_receipt, /^test:/);
      }
      assert.equal(
        (await db.query('SELECT count(*) FROM cargo_outbox WHERE proof_enqueued_at IS NOT NULL'))
          .rows[0].count,
        '0'
      );
    });
    await t.test(
      'tenant auth, list, export and verification contain no wallet artifacts',
      async () => {
        assert.equal((await req('/v1/shipments/' + s.id + '/proofs')).body.proofs.length, 2);
        for (const path of [
          '/v1/proofs/' + testProof.id,
          '/v1/proofs/' + testProof.id + '/bundle',
          '/v1/shipments/' + s.id + '/proofs'
        ])
          assert.equal((await req(path, b.token)).status, 404);
        assert.equal(
          (await req('/v1/proofs/' + testProof.id + '/verify', b.token, 'POST')).status,
          404
        );
        const exported = await req('/v1/proofs/' + testProof.id + '/bundle');
        assert.equal(exported.status, 200);
        assert.equal(exported.body.records.length, 1);
        assert.ok(!JSON.stringify(exported.body).includes('signed_data'));
        const result = await req('/v1/proofs/' + testProof.id + '/verify', a.token, 'POST');
        assert.equal(result.body.verified, false);
        assert.equal(result.body.reason, 'TEST_ONLY_NOT_BLOCKCHAIN');
        assert.equal((await req('/v1/proofs/' + testProof.id, 'invalid')).status, 401);
      }
    );
    let tx = { inputs: [], outputs: [], state: [] },
      exists = false,
      mines = 0,
      posts = 0,
      visible = false,
      depth = 0,
      reorg = false,
      posted = [];
    const writer = {
      async call(c, audit) {
        const verb = c.split(' ')[0],
          ticket = await audit?.start(verb, { verb });
        let response;
        try {
          if (verb === 'status') response = { version: '1.0.49.4' };
          else if (verb === 'txnlist') {
            if (!exists) throw new ProofError('RPC_NOT_FOUND');
            response = { transaction: tx, witness };
          } else if (verb === 'txncreate') {
            exists = true;
            response = {};
          } else if (verb === 'txnaddamount') {
            tx = {
              inputs: [{ address: ADDRESS, tokenid: '0x00' }],
              outputs: [{ address: ADDRESS, tokenid: '0x00' }],
              state: [],
              transactionid: TX
            };
            response = {};
          } else if (verb === 'txnstate') {
            tx.state = [{ port: 250, data: c.split(' value:')[1] }];
            response = {};
          } else if (verb === 'txncheck')
            response = { validtransaction: true, allsignaturesvalid: true };
          else if (verb === 'txnexport')
            response = { data: '0x1234', txn: { transaction: tx, witness } };
          else if (verb === 'txnmine') {
            mines++;
            response = { txpowid: TX, data: '0x5678' };
          } else if (verb === 'txnminepost') {
            const p = (
              await db.query("SELECT * FROM cargo_proofs WHERE mode='live' AND txpow_id=$1", [TX])
            ).rows[0];
            assert.equal(p.mined_data, '0x5678');
            assert.equal(p.mined_sha256, hash('0x5678'));
            assert.equal(p.state, 'submitting');
            posted.push(c);
            posts++;
            if (posts === 1) throw new ProofError('RPC_TIMEOUT');
            visible = true;
            response = { data: { txpowid: TX } };
          } else response = {};
          await audit?.finish(ticket, response);
          return response;
        } catch (e) {
          await audit?.fail(ticket, e.code);
          throw e;
        }
      }
    };
    const reader = {
      async call(c) {
        if (c === 'status')
          return { version: '1.0.49.4', chain: { block: 100 + depth, hash: BLOCK } };
        if (c.startsWith('txpow txpowid:')) {
          if (!visible) throw new ProofError('RPC_NOT_FOUND');
          return {
            txpowid: TX,
            istransaction: true,
            header: { chainid: '0x00' },
            body: { txn: tx, witness }
          };
        }
        if (c.startsWith('txpow onchain:'))
          return {
            found: !reorg,
            block: '100',
            blockid: BLOCK,
            tip: String(100 + depth),
            confirmations: String(depth)
          };
        if (c === 'txpow block:100')
          return {
            txpowid: reorg ? '0x' + 'd'.repeat(64) : BLOCK,
            isblock: true,
            header: { block: '100', chainid: '0x00' },
            body: { txnlist: [TX] }
          };
        throw Error(c);
      }
    };
    const config = {
      mode: 'live',
      chain: '0x00',
      publisherAddress: ADDRESS,
      depth: 6,
      maxAttempts: 5,
      coreVersion: '1.0.49.4'
    };
    await t.test(
      'restart recovers submitting work that crashed before a mined checkpoint',
      async () => {
        const event = (
          await db.query('SELECT * FROM cargo_events WHERE id=$1', [testProof.event_id])
        ).rows[0];
        const c = buildCommitment(event, {
          mode: 'live',
          chain: config.chain,
          publisherAddress: ADDRESS
        });
        // Durable state left by a process dying before the next RPC/checkpoint.
        await db.query(
          `INSERT INTO cargo_proofs(id,tenant_id,shipment_id,event_id,sequence,mode,chain_id,publisher_address,commitment,commitment_canonical,commitment_sha256,wire,custom_id,required_depth,state,attempts) VALUES($1,$2,$3,$4,$5,'live',$6,$7,$8,$9,$10,$11,$12,6,'submitting',1)`,
          [
            randomUUID(),
            event.tenant_id,
            event.shipment_id,
            event.id,
            event.sequence,
            config.chain,
            ADDRESS,
            c.envelope,
            c.canonical,
            c.digest,
            c.wire,
            'trk_' + c.digest
          ]
        );
        assert.equal(posts, 0);
      }
    );
    let live = createProofService(db, config, { writer, reader });
    await live.initialize();
    let liveProof;
    await t.test(
      'ambiguous send persists artifact and serialized workers cannot duplicate publication',
      async () => {
        await Promise.all([live.tick(), live.tick()]);
        liveProof = (
          await db.query("SELECT * FROM cargo_proofs WHERE mode='live' ORDER BY sequence LIMIT 1")
        ).rows[0];
        assert.equal(liveProof.state, 'retryable_error');
        assert.equal(liveProof.txpow_id, TX);
        assert.equal(posts, 1);
        assert.equal(mines, 1);
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM cargo_proof_attempts WHERE outcome='failed' AND error_code='RPC_TIMEOUT'"
            )
          ).rows[0].count,
          '1'
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM cargo_proofs WHERE mode='live' AND mined_data IS NOT NULL"
            )
          ).rows[0].count,
          '1'
        );
      }
    );
    await t.test(
      'restart reconciles known ID before bounded rebroadcast of the exact same artifact',
      async () => {
        live = createProofService(db, config, { writer, reader });
        await live.initialize();
        await db.query("UPDATE cargo_proofs SET next_attempt_at=now() WHERE mode='live'");
        await live.tick();
        assert.equal(posts, 2);
        assert.equal(mines, 1);
        assert.equal(posted[0], posted[1]);
        const row = (await db.query('SELECT * FROM cargo_proofs WHERE id=$1', [liveProof.id]))
          .rows[0];
        assert.equal(row.state, 'submitted');
      }
    );
    await t.test(
      'depth and reorg are observed from node, not elapsed time; immutable artifact retained',
      async () => {
        // Keep the later proof deferred so the mock wallet only represents this one transaction.
        await db.query(
          "UPDATE cargo_proofs SET next_attempt_at=now()+interval '1 day' WHERE mode='live' AND id<>$1",
          [liveProof.id]
        );
        depth = 5;
        await live.tick();
        assert.equal(
          (await db.query('SELECT state FROM cargo_proofs WHERE id=$1', [liveProof.id])).rows[0]
            .state,
          'included'
        );
        depth = 6;
        await live.tick();
        assert.equal(
          (await db.query('SELECT state FROM cargo_proofs WHERE id=$1', [liveProof.id])).rows[0]
            .state,
          'confirmed'
        );
        reorg = true;
        await live.tick();
        assert.equal(
          (await db.query('SELECT state FROM cargo_proofs WHERE id=$1', [liveProof.id])).rows[0]
            .state,
          'reorged'
        );
        await assert.rejects(
          db.query('UPDATE cargo_proofs SET mined_data=$2 WHERE id=$1', [liveProof.id, '0x9999']),
          /immutable/
        );
        await db.query(
          'UPDATE cargo_proofs SET publication_blocked=true,next_attempt_at=now() WHERE id=$1',
          [liveProof.id]
        );
        await live.tick();
        assert.equal(posts, 2, 'chain monitoring must not clear permanent broadcast prohibition');
        assert.equal((await db.query('SELECT count(*) FROM cargo_events')).rows[0].count, '3');
      }
    );
  }
);
