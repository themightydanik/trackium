import { buildCommitment, verifyRecords, ProofError, hexId } from './commitment.js';
import { checkTransaction, checkWitness } from './minima.js';
import { canonicalize } from '../telemetry/schema.js';
// This validates against a separately configured validating full node; it is not a JS consensus implementation.
export async function inspectChain(rpc, proof, audit) {
  const call = (c) => rpc.call(c, audit),
    id = hexId(proof.txpow_id);
  const before = await call('status');
  let tx;
  try {
    tx = await call(`txpow txpowid:${id}`);
  } catch (e) {
    if (e.code === 'RPC_NOT_FOUND')
      return { status: 'unavailable', reason: 'TXPOW_UNAVAILABLE', confirmations: 0 };
    throw e;
  }
  if (
    hexId(tx.txpowid) !== id ||
    tx.istransaction !== true ||
    tx.header?.chainid?.toLowerCase() !== proof.chain_id
  )
    throw new ProofError('TXPOW_ID_OR_NETWORK_MISMATCH', { retryable: false });
  if ((tx.body?.burntxn?.inputs?.length ?? 0) || (tx.body?.burntxn?.outputs?.length ?? 0))
    throw new ProofError('BURN_TRANSACTION_FORBIDDEN', { retryable: false });
  checkTransaction(tx.body?.txn, proof);
  checkWitness(tx.body?.witness, proof);
  if (proof.transaction_id && hexId(tx.body.txn.transactionid) !== proof.transaction_id)
    throw new ProofError('TRANSACTION_ID_MISMATCH', { retryable: false });
  const onchain = await call(`txpow onchain:${id}`);
  if (onchain.found !== true) {
    if (proof.included_height !== null && proof.included_height !== undefined) {
      let old;
      try {
        old = await call(`txpow block:${Number(proof.included_height)}`);
      } catch (e) {
        if (e.code !== 'RPC_NOT_FOUND') throw e;
      }
      if (old && hexId(old.txpowid) !== hexId(proof.included_block_id)) {
        const after = await call('status');
        if (before.chain?.hash !== after.chain?.hash || before.chain?.block !== after.chain?.block)
          throw new ProofError('CHAIN_TIP_CHANGED');
        if (
          old.header?.chainid?.toLowerCase() !== proof.chain_id ||
          Number(old.header?.block) !== Number(proof.included_height)
        )
          throw new ProofError('INCLUSION_MISMATCH', { retryable: false });
        return { status: 'reorged', reason: 'INCLUSION_BLOCK_CHANGED', confirmations: 0 };
      }
    }
    return { status: 'submitted', reason: 'NOT_ON_CURRENT_CHAIN', confirmations: 0 };
  }
  const height = Number(onchain.block),
    tip = Number(before.chain?.block);
  if (!Number.isSafeInteger(height) || !Number.isSafeInteger(tip) || height < 0 || tip < height)
    throw new ProofError('INVALID_CHAIN_HEIGHT');
  const block = await call(`txpow block:${height}`),
    after = await call('status');
  if (before.chain?.hash !== after.chain?.hash || before.chain?.block !== after.chain?.block)
    throw new ProofError('CHAIN_TIP_CHANGED');
  if (
    hexId(block.txpowid) !== hexId(onchain.blockid) ||
    Number(block.header?.block) !== height ||
    block.header?.chainid?.toLowerCase() !== proof.chain_id ||
    block.isblock !== true ||
    !(
      hexId(block.txpowid) === id ||
      (block.body?.txnlist ?? []).some((value) => hexId(value) === id)
    )
  )
    throw new ProofError('INCLUSION_MISMATCH', { retryable: false });
  if (Number(onchain.tip) !== tip || Number(onchain.confirmations) !== tip - height)
    throw new ProofError('CONFIRMATION_MISMATCH');
  const confirmations = tip - height;
  return {
    status: confirmations >= proof.required_depth ? 'confirmed' : 'included',
    reason: 'CURRENT_CHAIN_INCLUSION',
    confirmations,
    included_height: height,
    included_block_id: hexId(block.txpowid),
    tip: before.chain.hash
  };
}
export async function verifyBundle(
  bundle,
  { rpc, expectedPublisher, chain, depth = 6, maxInput = '1' }
) {
  try {
    if (Buffer.byteLength(JSON.stringify(bundle)) > 4194304)
      throw new ProofError('BUNDLE_TOO_LARGE', { retryable: false });
    if (bundle.schema_version !== 1 || !Array.isArray(bundle.records))
      throw new ProofError('INVALID_BUNDLE', { retryable: false });
    const anchor = bundle.records.at(-1);
    if (!anchor) throw new ProofError('EMPTY_BUNDLE', { retryable: false });
    verifyRecords(bundle.records, anchor);
    const proof = bundle.proof;
    if (
      proof.event_id !== anchor.id ||
      proof.shipment_id !== anchor.shipment_id ||
      Number(proof.sequence) !== Number(anchor.sequence)
    )
      throw new ProofError('PROOF_EVENT_MISMATCH', { retryable: false });
    const built = buildCommitment(anchor, {
      mode: proof.mode,
      chain: proof.chain_id,
      publisherAddress: proof.publisher_address
    });
    if (canonicalize(proof.commitment) !== built.canonical || proof.wire !== built.wire)
      throw new ProofError('COMMITMENT_MISMATCH', { retryable: false });
    if (proof.mode !== 'live')
      return {
        verified: false,
        status: 'test',
        reason: 'TEST_ONLY_NOT_BLOCKCHAIN',
        hash_chain_valid: true
      };
    if (!rpc)
      return {
        verified: false,
        status: 'unavailable',
        reason: 'INDEPENDENT_NODE_REQUIRED',
        hash_chain_valid: true
      };
    if (hexId(expectedPublisher) !== proof.publisher_address || chain !== proof.chain_id)
      throw new ProofError('UNTRUSTED_PUBLISHER_OR_NETWORK', { retryable: false });
    if (!proof.txpow_id)
      return {
        verified: false,
        status: 'pending',
        reason: 'NO_TXPOW_ID',
        hash_chain_valid: true
      };
    if (!['0.01', '0.1', '1'].includes(maxInput))
      throw new ProofError('INVALID_SPEND_POLICY', { retryable: false });
    const result = await inspectChain(rpc, {
      ...proof,
      max_input: maxInput,
      required_depth: depth,
      included_height: null
    });
    return {
      ...result,
      verified: result.status === 'confirmed',
      hash_chain_valid: true,
      source_trust: anchor.source_trust,
      max_input_checked: maxInput,
      checked_at: new Date().toISOString()
    };
  } catch (e) {
    return { verified: false, status: 'unavailable', reason: e.code ?? 'INVALID_BUNDLE' };
  }
}
