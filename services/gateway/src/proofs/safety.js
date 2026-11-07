import { ProofError, hexId } from './commitment.js';
export function units(value) {
  if (typeof value !== 'string' || !/^\d{1,20}(?:\.\d{1,44})?$/.test(value))
    throw new ProofError('INVALID_COIN_AMOUNT', { retryable: false });
  const [a, b = ''] = value.split('.');
  return BigInt(a) * 10n ** 44n + BigInt(b.padEnd(44, '0'));
}
export function minima(value) {
  const n = BigInt(value);
  return (
    (n / 10n ** 44n).toString() +
    '.' +
    (n % 10n ** 44n).toString().padStart(44, '0').replace(/0+$/, '')
  );
}
export function checkSpend(tx, proof) {
  const inputs = tx.inputs ?? [],
    outputs = tx.outputs ?? [];
  if (inputs.length > 64 || outputs.length > 3)
    throw new ProofError('TRANSACTION_SIZE_POLICY', { retryable: false });
  const sum = (coins) =>
    coins.reduce((n, c) => {
      const amount = units(c.amount);
      if (amount <= 0n) throw new ProofError('INVALID_COIN_AMOUNT', { retryable: false });
      return n + amount;
    }, 0n);
  const total = sum(inputs),
    returned = sum(outputs);
  if (
    total !== returned ||
    total > units(proof.max_input ?? '1') ||
    total < units('0.001') ||
    !outputs.some((c) => units(c.amount) === units('0.001'))
  )
    throw new ProofError('SELF_TRANSFER_SPEND_LIMIT', { retryable: false });
  return total.toString();
}
export async function preflight(rpc, address, { coreVersion = '1.0.49.4', chain = '0x00' } = {}) {
  address = hexId(address);
  const status = await rpc.call('status');
  if (status.version !== coreVersion)
    throw new ProofError('UNSUPPORTED_CORE_VERSION', { retryable: false });
  if (!Number.isInteger(status.network?.connected) || status.network.connected < 1)
    throw new ProofError('CORE_NO_CONNECTED_PEERS');
  const tip = await rpc.call('txpow block:' + Number(status.chain?.block));
  if (
    tip.header?.chainid?.toLowerCase() !== chain ||
    hexId(tip.txpowid) !== hexId(status.chain?.hash)
  )
    throw new ProofError('CORE_NETWORK_OR_TIP_MISMATCH');
  const age = Date.now() - Number(tip.header?.timemilli);
  if (!Number.isFinite(age) || age < -120000 || age > 600000 || Number(status.chain?.block) < 1)
    throw new ProofError('CORE_TIP_STALE_OR_UNSYNCED');
  const script = await rpc.call('scripts address:' + address);
  if (
    script.address?.toLowerCase() !== address ||
    script.simple !== true ||
    !/^RETURN SIGNEDBY\(0x[0-9a-f]{64}\)$/i.test(script.script)
  )
    throw new ProofError('WALLET_ADDRESS_NOT_OWNED', { retryable: false });
  const coins = await rpc.call(
    'coins relevant:true sendable:true checkmempool:true tokenid:0x00 address:' + address
  );
  if (!Array.isArray(coins) || coins.length > 1000) throw new ProofError('WALLET_COIN_LIMIT');
  const balance = coins.reduce((n, c) => {
    if (c.address?.toLowerCase() !== address || c.tokenid !== '0x00')
      throw new ProofError('FOREIGN_WALLET_COIN', { retryable: false });
    return n + units(c.amount);
  }, 0n);
  if (balance < units('0.001')) throw new ProofError('INSUFFICIENT_SPENDABLE_BALANCE');
  return {
    network: chain === '0x00' ? 'Mainnet' : chain,
    publisher_address: address,
    spendable_units: balance.toString(),
    spendable_minima: minima(balance),
    unit_scale: 44,
    tip_height: Number(status.chain.block),
    tip_time: Number(tip.header.timemilli),
    checked_at: new Date().toISOString(),
    sync_check: 'recent_validated_tip; not a global synchronization oracle',
    expected_transfer: '0.001 to the same address',
    burn: '0',
    warning:
      'Inputs are temporarily spent/locked; signing-key uses and PoW resources are consumed. No external destination.'
  };
}
