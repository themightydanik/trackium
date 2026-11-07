import { createProofService } from '../src/proofs/service.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { generateKeyPairSync, randomUUID, webcrypto } from 'node:crypto';
import { tmpdir } from 'node:os';
import { loadSigner } from '../src/proofs/ownership.js';
import { buildCommitment } from '../src/proofs/commitment.js';
import { checkSpend, units, preflight } from '../src/proofs/safety.js';
import { canonicalize } from '../src/telemetry/schema.js';
import { hash } from '../src/cargo/shared.js';
import { proofConfig } from '../src/proofs/config.js';
const ADDRESS = '0x' + 'a'.repeat(64),
  TX = '0x' + 'b'.repeat(64),
  BLOCK = '0x' + 'c'.repeat(64);
const source = await readFile(new URL('../../../assets/v2/local-core.js', import.meta.url), 'utf8');
async function fixture(t) {
  const dir = await mkdtemp(tmpdir() + '/trackium-local-'),
    file = dir + '/job-key.pem';
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  await writeFile(file, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  t.after(() => rm(dir, { recursive: true }));
  const signer = await loadSigner(file);
  const data = {
    schema_version: 1,
    sequence: 1,
    shipment_id: randomUUID(),
    tenant_id: randomUUID(),
    event_id: randomUUID(),
    event_type: 'shipment_created',
    event_time: new Date().toISOString(),
    device_id: randomUUID(),
    source_trust: 'synthetic',
    previous_hash: null,
    data: { name: 'PRIVATE CARGO' }
  };
  const canonical_payload = canonicalize(data),
    record = { ...data, id: data.event_id, canonical_payload, sha256: hash(canonical_payload) },
    c = buildCommitment(record, { mode: 'live', chain: '0x00', publisherAddress: ADDRESS }),
    proof = {
      id: randomUUID(),
      event_id: data.event_id,
      shipment_id: data.shipment_id,
      sequence: 1,
      publisher_kind: 'local',
      mode: 'live',
      chain_id: '0x00',
      publisher_address: ADDRESS,
      wire: c.wire,
      commitment: c.envelope
    };
  const job = signer.packet({
    domain: 'trackium:local-core:job:v1',
    schema_version: 1,
    job_id: proof.id,
    expires_at: new Date(Date.now() + 3600000),
    max_input: '0.01',
    max_attempts: 3,
    bundle: { schema_version: 1, proof, records: [record] }
  });
  return { signer, job, proof };
}
function harness({
  android = false,
  write = true,
  locks = true,
  storage = new Map(),
  timeoutPost = false
} = {}) {
  const commands = [];
  let tx = { inputs: [], outputs: [], state: [] },
    exists = false,
    posted = false,
    mines = 0,
    posts = 0;
  const witness = {
    scripts: [{ address: ADDRESS, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' }],
    signatures: [{}]
  };
  const coin = { address: ADDRESS, tokenid: '0x00', amount: '0.001' };
  const mds = {
    init(cb) {
      cb({ event: 'inited' });
    },
    keypair: {
      get(key, cb) {
        const value = storage.get(key);
        cb({ status: value !== undefined, value: value ?? null });
      },
      set(key, value, cb) {
        storage.set(key, value);
        cb({ status: true });
      }
    },
    cmd(c, cb) {
      commands.push(c);
      const verb = c.split(' ')[0];
      let r = {};
      if (verb === 'checkmode') r = { writemode: write };
      else if (verb === 'status')
        r = { version: '1.0.49.4', network: { connected: 1 }, chain: { block: 100, hash: BLOCK } };
      else if (c === 'txpow block:100')
        r = { txpowid: BLOCK, header: { chainid: '0x00', timemilli: String(Date.now()) } };
      else if (verb === 'scripts')
        r = { address: ADDRESS, simple: true, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' };
      else if (verb === 'coins') r = [coin];
      else if (verb === 'txnlist') {
        if (!exists) return cb({ status: false, error: 'Transaction not found : test' });
        r = { transaction: tx, witness };
      } else if (verb === 'txncreate') exists = true;
      else if (verb === 'txnaddamount')
        tx = { inputs: [coin], outputs: [coin], state: [], transactionid: TX };
      else if (verb === 'txnstate') tx.state = [{ port: 250, data: c.split(' value:')[1] }];
      else if (verb === 'txncheck') r = { validtransaction: true, allsignaturesvalid: true };
      else if (verb === 'txnexport') r = { data: '0x1234', txn: { transaction: tx, witness } };
      else if (verb === 'txnmine') {
        mines++;
        r = { txpowid: TX, data: '0x5678' };
      } else if (c.startsWith('txpow txpowid:')) {
        if (!posted) return cb({ status: false, error: 'TxPoW not found : test' });
        r = { txpowid: TX };
      } else if (verb === 'txnminepost') {
        posts++;
        posted = true;
        if (timeoutPost) return cb({ status: false, error: 'mock lost response' });
        r = { data: { txpowid: TX } };
      }
      cb({ status: true, response: r });
    }
  };
  const context = {
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    URLSearchParams,
    atob,
    btoa,
    setTimeout,
    clearTimeout,
    location: { pathname: '/local-core.html', search: '?uid=0x1234' },
    navigator: {
      userAgent: android ? 'Android WebView' : 'Desktop',
      locks: locks ? { request: async (name, options, fn) => fn({ name }) } : undefined
    },
    MDS: mds
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return {
    api: context.TrackiumLocalCore.create(),
    protocol: context.TrackiumLocalCore,
    commands,
    storage,
    counts: () => ({ mines, posts })
  };
}
for (const android of [false, true])
  test(
    (android ? 'Android-like' : 'Desktop') +
      ' MDS mock: approved signed job → durable checkpoint → explicit publish → restart reconciliation',
    async (t) => {
      const { signer, job, proof } = await fixture(t),
        h = harness({ android, timeoutPost: true });
      await h.api.start();
      const check = await h.api.inspect(job, signer.fingerprint);
      assert.equal(check.core.network, 'Mainnet');
      assert.equal(check.core.spendable_minima, '0.001');
      await assert.rejects(h.api.prepare(job, signer.fingerprint, 'yes'), /approval/);
      const confirmation = 'PUBLISH MAINNET ' + proof.event_id,
        checkpoint = await h.api.prepare(job, signer.fingerprint, confirmation);
      assert.equal(h.counts().posts, 0);
      assert.equal(h.counts().mines, 1);
      assert.equal(checkpoint.txpow_id, TX);
      const ack = signer.packet({
        domain: 'trackium:local-core:ack:v1',
        job_id: proof.id,
        wire: proof.wire,
        stage: 'checkpoint',
        txpow_id: TX,
        mined_sha256: hash(checkpoint.mined_data)
      });
      await assert.rejects(
        h.api.publish(
          job,
          signer.fingerprint,
          { ...ack, signature: ack.signature.slice(0, -4) + 'AAAA' },
          confirmation
        ),
        /signature/
      );
      await assert.rejects(
        h.api.publish(job, signer.fingerprint, ack, confirmation),
        /Core command failed/
      );
      const restored = h.protocol.create();
      await restored.start();
      const result = await restored.publish(job, signer.fingerprint, ack, confirmation);
      assert.equal(result.txpow_id, TX);
      assert.equal(h.counts().posts, 1, 'known final ID reconciled without a second spend');
      assert.equal(h.counts().mines, 1);
      assert.ok(
        h.commands.some((c) => c === 'txnsign id:trk_' + proof.wire.slice(14) + ' publickey:auto')
      );
      assert.ok(!h.commands.some((c) => c.includes('password:') || c.startsWith('send ')));
      const release = signer.packet({
        domain: 'trackium:local-core:ack:v1',
        job_id: proof.id,
        wire: proof.wire,
        stage: 'confirmed',
        txpow_id: TX
      });
      await restored.release(job, signer.fingerprint, release);
      await assert.rejects(restored.prepare(job, signer.fingerprint, confirmation), /completed/);
    }
  );
test('MDS READ permission and unavailable Android Web Locks fail before signing or mining', async (t) => {
  const f = await fixture(t),
    h = harness({ write: false });
  await h.api.start();
  await assert.rejects(
    h.api.prepare(f.job, f.signer.fingerprint, 'PUBLISH MAINNET ' + f.proof.event_id),
    /WRITE permission/
  );
  assert.deepEqual(h.commands, ['checkmode']);
  const noLocks = harness({ android: true, locks: false });
  await noLocks.api.start();
  await assert.rejects(async () => noLocks.api.inspect(f.job, f.signer.fingerprint), /Web Locks/);
  assert.equal(noLocks.commands.length, 0);
});
test('signed jobs reject tampering, foreign pins, expired approval and cross-job acknowledgement', async (t) => {
  const f = await fixture(t),
    h = harness();
  await h.api.start();
  await assert.rejects(h.api.inspect(f.job, '0'.repeat(64)), /pin mismatch/);
  const tampered = structuredClone(f.job);
  tampered.payload.bundle.proof.wire = '0x' + '0'.repeat(76);
  await assert.rejects(h.api.inspect(tampered, f.signer.fingerprint), /signature/);
  const expired = f.signer.packet({ ...f.job.payload, expires_at: new Date(0) });
  await assert.rejects(
    h.api.prepare(expired, f.signer.fingerprint, 'PUBLISH MAINNET ' + f.proof.event_id),
    /expired/
  );
});
test('Mainnet requires separate enablement and exact 44-place arithmetic enforces spend conservation/input cap', () => {
  assert.throws(() => proofConfig({ PROOF_MODE: 'live', PROOF_ALLOW_LIVE: 'true' }), /MAINNET/);
  assert.equal(units('0.' + '0'.repeat(43) + '1'), 1n);
  const coin = { amount: '0.001' };
  assert.doesNotThrow(() => checkSpend({ inputs: [coin], outputs: [coin] }, { max_input: '0.01' }));
  assert.throws(() =>
    checkSpend(
      { inputs: [{ amount: '1' }], outputs: [{ amount: '0.001' }, { amount: '0.999' }] },
      { max_input: '0.01' }
    )
  );
  assert.throws(() =>
    checkSpend({ inputs: [coin], outputs: [{ amount: '0.0009' }] }, { max_input: '1' })
  );
});
test('local attempts are bounded and a restarted Core never re-mines a checkpointed job', async (t) => {
  const f = await fixture(t),
    h = harness(),
    confirm = 'PUBLISH MAINNET ' + f.proof.event_id;
  await h.api.start();
  const checkpoint = await h.api.prepare(f.job, f.signer.fingerprint, confirm);
  const ack = f.signer.packet({
    domain: 'trackium:local-core:ack:v1',
    job_id: f.proof.id,
    wire: f.proof.wire,
    stage: 'checkpoint',
    txpow_id: TX,
    mined_sha256: hash(checkpoint.mined_data)
  });
  const restarted = harness({ storage: h.storage });
  await restarted.api.start();
  const result = await restarted.api.publish(f.job, f.signer.fingerprint, ack, confirm);
  assert.equal(result.txpow_id, TX);
  assert.equal(restarted.counts().mines, 0);
  const savedKey = 'trk-proof-' + f.proof.id,
    record = JSON.parse(atob(h.storage.get(savedKey)));
  record.attempts = 3;
  h.storage.set(savedKey, btoa(JSON.stringify(record)));
  const absent = harness({ storage: h.storage });
  await absent.api.start();
  await assert.rejects(
    absent.api.publish(f.job, f.signer.fingerprint, ack, confirm),
    /attempt limit/
  );
  assert.equal(absent.counts().posts, 0);
  const wrong = f.signer.packet({ ...ack.payload, job_id: randomUUID() });
  await assert.rejects(
    absent.api.publish(f.job, f.signer.fingerprint, wrong, confirm),
    /acknowledgement mismatch/
  );
});
test('a second signed job cannot take an occupied local wallet slot', async (t) => {
  const first = await fixture(t),
    second = await fixture(t),
    h = harness();
  await h.api.start();
  await h.api.prepare(
    first.job,
    first.signer.fingerprint,
    'PUBLISH MAINNET ' + first.proof.event_id
  );
  await assert.rejects(
    h.api.prepare(
      second.job,
      second.signer.fingerprint,
      'PUBLISH MAINNET ' + second.proof.event_id
    ),
    /owns the local wallet slot/
  );
  assert.equal(h.counts().mines, 1);
});
test('corrupt saved artifact and attempt counter fail closed before wallet commands', async (t) => {
  const f = await fixture(t),
    h = harness();
  await h.api.start();
  const key = 'trk-proof-' + f.proof.id;
  h.storage.set(
    key,
    btoa(JSON.stringify({ pin: f.signer.fingerprint, wire: f.proof.wire, attempts: -1 }))
  );
  await assert.rejects(h.api.inspect(f.job, f.signer.fingerprint), /attempt budget/);
  assert.equal(h.commands.length, 0);
});

test('a DB connection with an uncertain advisory unlock is discarded, not pooled with a retained lock', async () => {
  let discarded = false;
  const db = {
    query: async (sql) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
      if (sql.includes('pg_advisory_unlock')) throw Error('mock database disconnect');
      return { rows: [] };
    },
    release: (broken) => {
      discarded = broken;
    }
  };
  await createProofService({ connect: async () => db }, { mode: 'test' }).tick();
  assert.equal(discarded, true);
});
