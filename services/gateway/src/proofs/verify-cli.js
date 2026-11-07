import { readFile, stat } from 'node:fs/promises';
import { createRpc } from './rpc.js';
import { verifyBundle } from './verifier.js';
import { chainId, hexId } from './commitment.js';
try {
  const file = process.argv[2];
  if (!file || (await stat(file)).size > 4194304)
    throw new Error('Supply a bundle JSON file of at most 4 MiB');
  const depth = Number(process.env.PROOF_CONFIRMATION_DEPTH ?? 6);
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > 100)
    throw new Error('depth must be 1..100');
  const rpc = await createRpc({
    url: process.env.MINIMA_READER_RPC_URL,
    file: process.env.MINIMA_READER_CREDENTIAL_FILE,
    caFile: process.env.MINIMA_READER_CA_FILE,
    readOnly: true,
    requestTimeout: 10000
  });
  const result = await verifyBundle(JSON.parse(await readFile(file, 'utf8')), {
    rpc,
    expectedPublisher: hexId(process.env.MINIMA_PUBLISHER_ADDRESS),
    chain: chainId(process.env.MINIMA_CHAIN_ID ?? '0x00'),
    depth
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.verified ? 0 : 1;
} catch (e) {
  console.error(e.code ?? 'INVALID_VERIFIER_CONFIGURATION_OR_BUNDLE');
  process.exitCode = 2;
}
