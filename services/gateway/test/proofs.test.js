import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { canonicalize } from '../src/telemetry/schema.js';
import { hash } from '../src/cargo/shared.js';
import { buildCommitment, verifyRecords, ProofError } from '../src/proofs/commitment.js';
import { proofConfig } from '../src/proofs/config.js';
import { createRpc, endpoint } from '../src/proofs/rpc.js';
import { createMinima, checkWitness } from '../src/proofs/minima.js';
import { inspectChain, verifyBundle } from '../src/proofs/verifier.js';
export const ADDRESS = '0x' + 'a'.repeat(64),
  TX = '0x' + 'b'.repeat(64),
  BLOCK = '0x' + 'c'.repeat(64);
const witness = {
  scripts: [{ address: ADDRESS, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' }],
  signatures: [{}]
};
export function event(previous = null) {
  const value = {
    schema_version: 1,
    sequence: previous ? 2 : 1,
    shipment_id: previous?.shipment_id ?? randomUUID(),
    tenant_id: previous?.tenant_id ?? randomUUID(),
    event_id: randomUUID(),
    event_type: 'checkpoint_reached',
    event_time: '2026-11-07T12:00:00.000Z',
    device_id: randomUUID(),
    source_trust: 'synthetic',
    previous_hash: previous?.sha256 ?? null,
    data: { gps: { latitude: 50, longitude: 30 }, name: 'PRIVATE CARGO' }
  };
  const canonical_payload = canonicalize(value);
  return {
    ...value,
    id: value.event_id,
    canonical_payload,
    sha256: hash(canonical_payload)
  };
}
export function proof(row = event()) {
  const c = buildCommitment(row, {
    mode: 'live',
    chain: '0x00',
    publisherAddress: ADDRESS
  });
  return {
    event_id: row.id,
    shipment_id: row.shipment_id,
    sequence: row.sequence,
    mode: 'live',
    chain_id: '0x00',
    publisher_address: ADDRESS,
    commitment: c.envelope,
    wire: c.wire,
    custom_id: 'trk_' + c.digest,
    txpow_id: TX,
    required_depth: 6,
    included_height: null
  };
}
export function chainRpc(p, { depth = 6, reorg = false, missing = false } = {}) {
  const tx = {
    inputs: [{ address: ADDRESS, tokenid: '0x00', amount: '0.001' }],
    outputs: [{ address: ADDRESS, tokenid: '0x00', amount: '0.001' }],
    state: [{ port: 250, data: p.wire }],
    transactionid: TX
  };
  return {
    async call(c) {
      if (c === 'status')
        return { version: '1.0.49.4', chain: { block: 100 + depth, hash: BLOCK } };
      if (c.startsWith('txpow txpowid:')) {
        if (missing) throw new ProofError('RPC_NOT_FOUND');
        return {
          txpowid: '0x' + TX.slice(2).toUpperCase(),
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
          body: { txnlist: ['0x' + TX.slice(2).toUpperCase()] }
        };
      throw Error(c);
    }
  };
}
test('proof modes default disabled and live requires explicit authorization', () => {
  assert.equal(proofConfig({}).mode, 'disabled');
  assert.throws(() => proofConfig({ PROOF_MODE: 'live' }));
  for (const url of ['http://example.com', 'https://host/a', 'https://user:pass@host/'])
    assert.throws(() => endpoint(url));
});
test('domain separated commitment preserves trust and binds hash, not raw GPS or cargo name', () => {
  const row = event(),
    live = buildCommitment(row, { mode: 'live', chain: '0x00', publisherAddress: ADDRESS }),
    mock = buildCommitment(row, { mode: 'test', chain: '0x00' });
  assert.equal(live.wire.length, 78);
  assert.match(live.wire, /^0x54524b500101/);
  assert.notEqual(live.digest, mock.digest);
  assert.ok(!live.canonical.includes('PRIVATE CARGO'));
  assert.ok(!live.canonical.includes('latitude'));
  assert.equal(live.envelope.source_trust, 'synthetic');
  assert.throws(() =>
    buildCommitment(
      { ...row, canonical_payload: row.canonical_payload + ' ' },
      { mode: 'test', chain: '0x00' }
    )
  );
});
test('independent verifier rebuilds full event chain, rejects tamper, gaps and foreign publisher', async () => {
  const a = event(),
    b = event(a),
    p = proof(b),
    bundle = { schema_version: 1, records: [a, b], proof: p },
    options = { rpc: chainRpc(p), expectedPublisher: ADDRESS, chain: '0x00', depth: 6 };
  assert.equal((await verifyBundle(bundle, options)).verified, true);
  assert.equal(
    (await verifyBundle({ ...bundle, records: [b] }, options)).reason,
    'HASH_CHAIN_GAP_OR_MISMATCH'
  );
  assert.equal(
    (await verifyBundle({ ...bundle, records: [{ ...a, sha256: '0'.repeat(64) }, b] }, options))
      .reason,
    'EVENT_HASH_MISMATCH'
  );
  assert.equal(
    (await verifyBundle(bundle, { ...options, expectedPublisher: TX })).reason,
    'UNTRUSTED_PUBLISHER_OR_NETWORK'
  );
  assert.equal(
    (await verifyBundle(bundle, { ...options, rpc: chainRpc(p, { depth: 5 }) })).verified,
    false
  );
});
test('reorg, pruned node and chain absence never become confirmations', async () => {
  const p = proof();
  assert.equal((await inspectChain(chainRpc(p, { missing: true }), p)).status, 'unavailable');
  assert.equal(
    (
      await inspectChain(chainRpc(p, { reorg: true }), {
        ...p,
        included_height: 100,
        included_block_id: BLOCK
      })
    ).status,
    'reorged'
  );
  assert.equal((await inspectChain(chainRpc(p, { reorg: true }), p)).status, 'submitted');
});
test('test bundle cannot claim blockchain verification even with a supplied txid', async () => {
  const a = event(),
    c = buildCommitment(a, { mode: 'test', chain: '0x00' });
  const result = await verifyBundle(
    {
      schema_version: 1,
      records: [a],
      proof: {
        event_id: a.id,
        shipment_id: a.shipment_id,
        sequence: a.sequence,
        mode: 'test',
        chain_id: '0x00',
        commitment: c.envelope,
        wire: c.wire,
        txpow_id: TX
      }
    },
    {}
  );
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'TEST_ONLY_NOT_BLOCKCHAIN');
});
test('Minima adapter signs and mines without posting; signed checkpoint precedes mining', async () => {
  const p = proof();
  delete p.txpow_id;
  let exists = false,
    tx = { inputs: [], outputs: [], state: [] },
    checkpoint = false;
  const commands = [];
  const rpc = {
    async call(c) {
      commands.push(c);
      if (c === 'status')
        return {
          version: '1.0.49.4',
          network: { connected: 1 },
          chain: { block: 100, hash: BLOCK }
        };
      if (c === 'txpow block:100')
        return { txpowid: BLOCK, header: { chainid: '0x00', timemilli: String(Date.now()) } };
      if (c.startsWith('scripts address:'))
        return { address: ADDRESS, simple: true, script: 'RETURN SIGNEDBY(' + ADDRESS + ')' };
      if (c.startsWith('coins ')) return [{ address: ADDRESS, tokenid: '0x00', amount: '0.001' }];
      const verb = c.split(' ')[0];
      if (verb === 'txnlist') {
        if (!exists) throw new ProofError('RPC_NOT_FOUND');
        return { transaction: tx, witness };
      }
      if (verb === 'txncreate') {
        exists = true;
        return {};
      }
      if (verb === 'txnaddamount') {
        tx = {
          inputs: [{ address: ADDRESS, tokenid: '0x00', amount: '0.001' }],
          outputs: [{ address: ADDRESS, tokenid: '0x00', amount: '0.001' }],
          state: [],
          transactionid: TX
        };
        return {};
      }
      if (verb === 'txnstate') {
        tx.state = [{ port: 250, data: p.wire }];
        return {};
      }
      if (verb === 'txncheck') return { validtransaction: true, allsignaturesvalid: true };
      if (verb === 'txnexport') return { data: '0x1234', txn: { transaction: tx, witness } };
      if (verb === 'txnmine') {
        assert.ok(checkpoint);
        return { txpowid: TX, data: '0x5678' };
      }
      return {};
    }
  };
  const mined = await createMinima(rpc, { coreVersion: '1.0.49.4' }).prepare(
    p,
    null,
    async (fields) => {
      checkpoint = true;
      assert.equal(fields.transaction_id, TX);
    }
  );
  assert.equal(mined.txpow_id, TX);
  assert.ok(!commands.some((c) => c.startsWith('txnminepost') || c.startsWith('txnpost')));
  assert.ok(commands.some((c) => c.includes('fromaddress:' + ADDRESS)));
});
test('RPC uses authenticated POST with exact Core header names, sanitizes audits and restricts commands', async (t) => {
  const dir = await mkdtemp(tmpdir() + '/trackium-rpc-'),
    file = dir + '/credentials.json';
  await writeFile(file, JSON.stringify({ username: 'minima', password: 'test-secret-value' }), {
    mode: 0o600
  });
  const server = http.createServer((req, res) => {
    assert.ok(req.rawHeaders.includes('Authorization'));
    assert.ok(req.rawHeaders.includes('Content-Length'));
    let command = '';
    req.on('data', (c) => (command += c));
    req.on('end', () =>
      res.end(
        JSON.stringify({
          status: true,
          response: { version: '1.0.49.4', password: 'test-secret-value', echo: command }
        })
      )
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true });
  });
  const rpc = await createRpc({
    url: 'http://127.0.0.1:' + server.address().port,
    file,
    readOnly: true
  });
  let logged;
  const result = await rpc.call('status', {
    start: async () => 1,
    finish: async (id, r) => (logged = r),
    fail: async () => {}
  });
  assert.equal(result.version, '1.0.49.4');
  assert.ok(!JSON.stringify(logged).includes('test-secret-value'));
  await assert.rejects(rpc.call('txncreate id:bad'));
  await assert.rejects(rpc.call('status;txnminepost data:0x00'));
});

test('publisher identity rejects anyone-can-spend scripts and missing signatures', () => {
  const p = proof();
  assert.throws(() =>
    checkWitness({ scripts: [{ address: ADDRESS, script: 'RETURN TRUE' }], signatures: [{}] }, p)
  );
  assert.throws(() => checkWitness({ ...witness, signatures: [] }, p));
});

test('independent verification ignores an untrusted bundle attempt to raise the spending cap', async () => {
  const a = event(),
    p = { ...proof(a), max_input: '100' },
    base = chainRpc(p);
  const rpc = {
    async call(command) {
      const r = await base.call(command);
      if (command.startsWith('txpow txpowid:')) {
        r.body.txn.inputs[0].amount = '2';
        r.body.txn.outputs = [
          { address: ADDRESS, tokenid: '0x00', amount: '0.001' },
          { address: ADDRESS, tokenid: '0x00', amount: '1.999' }
        ];
      }
      return r;
    }
  };
  const result = await verifyBundle(
    { schema_version: 1, records: [a], proof: p },
    { rpc, expectedPublisher: ADDRESS, chain: '0x00' }
  );
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'SELF_TRANSFER_SPEND_LIMIT');
});
