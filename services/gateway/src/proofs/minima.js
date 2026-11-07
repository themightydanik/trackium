import { checkSpend, preflight } from './safety.js';
import { ProofError, hexId, PORT } from './commitment.js';
const fail = (code) => {
  throw new ProofError(code, { retryable: false });
};
const blob = (value) => {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(value) || value.length > 2097152)
    fail('INVALID_MINIMA_ARTIFACT');
  return value;
};
export function checkTransaction(tx, proof, { state = true } = {}) {
  if (
    !tx ||
    !Array.isArray(tx.inputs) ||
    !tx.inputs.length ||
    !Array.isArray(tx.outputs) ||
    !tx.outputs.length
  )
    fail('INVALID_TRANSACTION');
  for (const coin of [...tx.inputs, ...tx.outputs])
    if (coin.address?.toLowerCase() !== proof.publisher_address || coin.tokenid !== '0x00')
      fail('FOREIGN_TRANSACTION_COIN');
  const states = tx.state ?? [];
  if (
    state &&
    (states.length !== 1 ||
      Number(states[0].port) !== PORT ||
      states[0].data?.toLowerCase() !== proof.wire)
  )
    fail('COMMITMENT_MISMATCH');
  if (
    !state &&
    states.length &&
    !(
      states.length === 1 &&
      Number(states[0].port) === PORT &&
      states[0].data?.toLowerCase() === proof.wire
    )
  )
    fail('FOREIGN_TRANSACTION_STATE');
  checkSpend(tx, proof);
  return tx;
}
// Publisher identity must be a standard signature wallet script, not an anyone-can-spend address.
// The validating full node checks the script/address binding and signatures, not this JS parser.
export function checkWitness(witness, proof) {
  const script = witness?.scripts?.find(
    (s) => s.address?.toLowerCase() === proof.publisher_address
  );
  if (
    !script ||
    !/^RETURN SIGNEDBY\(0x[0-9a-f]{64}\)$/i.test(script.script) ||
    !witness.signatures?.length
  )
    fail('PUBLISHER_SIGNATURE_SCRIPT_REQUIRED');
}
export function createMinima(rpc, config) {
  return {
    async prepare(proof, audit, checkpoint) {
      const call = (c) => rpc.call(c, audit),
        id = proof.custom_id;
      if (!/^trk_[a-f0-9]{64}$/.test(id)) fail('INVALID_CUSTOM_ID');
      await preflight({ call }, proof.publisher_address, config);
      let row;
      try {
        row = await call(`txnlist id:${id}`);
      } catch (e) {
        if (e.code !== 'RPC_NOT_FOUND') throw e;
        if (proof.signed_data) await call(`txnimport id:${id} data:${blob(proof.signed_data)}`);
        else await call(`txncreate id:${id}`);
        row = await call(`txnlist id:${id}`);
      }
      if (!proof.signed_data) {
        if (!row.transaction?.inputs?.length && !row.transaction?.outputs?.length) {
          await call(
            `txnaddamount id:${id} amount:0.001 address:${proof.publisher_address} fromaddress:${proof.publisher_address} tokenid:0x00 burn:0 storestate:true`
          );
          row = await call(`txnlist id:${id}`);
        }
        checkTransaction(row.transaction, proof, { state: false });
        await call(`txnstate id:${id} port:${PORT} value:${proof.wire}`);
        await call(`txnbasics id:${id}`);
        await call(`txnsign id:${id} publickey:auto`);
        const checked = await call(`txncheck id:${id}`);
        if (checked.validtransaction !== true || checked.allsignaturesvalid !== true)
          fail('TRANSACTION_CHECK_FAILED');
        const exported = await call(`txnexport id:${id} showtxn:true`);
        checkTransaction(exported.txn?.transaction, proof);
        checkWitness(exported.txn?.witness, proof);
        const transaction_id = hexId(exported.txn.transaction.transactionid),
          signed_data = blob(exported.data);
        await checkpoint({ signed_data, transaction_id });
        proof = { ...proof, signed_data, transaction_id };
      } else {
        checkTransaction(row.transaction, proof);
        checkWitness(row.witness, proof);
        if (hexId(row.transaction.transactionid) !== proof.transaction_id)
          fail('SIGNED_TRANSACTION_MISMATCH');
      }
      const finalCheck = await call(`txncheck id:${id}`);
      if (finalCheck.validtransaction !== true || finalCheck.allsignaturesvalid !== true)
        fail('TRANSACTION_CHECK_FAILED');
      const mined = await call(`txnmine id:${id}`);
      return { txpow_id: hexId(mined.txpowid), mined_data: blob(mined.data) };
    },
    async broadcast(proof, audit) {
      const response = await rpc.call(`txnminepost data:${blob(proof.mined_data)}`, audit);
      if (hexId(response?.data?.txpowid) !== proof.txpow_id) fail('POST_RESPONSE_ID_MISMATCH');
      return response;
    }
  };
}
