import { generateKeyPairSync } from 'node:crypto';
import { readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSigner } from './ownership.js';
import { endpoint } from './rpc.js';
const [action, ...args] = process.argv.slice(2);
try {
  if (action === 'keygen') {
    const file = resolve(
        await realpath(dirname(resolve(args[0] ?? ''))),
        basename(resolve(args[0] ?? ''))
      ),
      root = fileURLToPath(new URL('../../../../', import.meta.url)),
      rel = relative(root, file);
    if (!args[0] || (!rel.startsWith('..') && !isAbsolute(rel)))
      throw Error('signing key must be outside repository');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    await writeFile(file, privateKey.export({ format: 'pem', type: 'pkcs8' }), {
      mode: 0o600,
      flag: 'wx'
    });
    const signer = await loadSigner(file);
    console.log(JSON.stringify({ fingerprint: signer.fingerprint, public_key: signer.publicKey }));
  } else {
    // trusted operator CLI: origin, external owner credential file, optional input file/event ID
    const [origin, file, inputFile, eventId] = args,
      url = endpoint(origin),
      info = await stat(file);
    if (info.mode & 0o077 || info.size > 4096) throw Error('restricted owner file required');
    const owner = JSON.parse(await readFile(file, 'utf8'));
    if (typeof owner.token !== 'string' || !owner.token) throw Error('owner token required');
    let path, input;
    if (action === 'policy') {
      path = '/v1/proof-publisher/policy';
      input = JSON.parse(await readFile(inputFile, 'utf8'));
    } else if (action === 'preflight') {
      path = '/v1/proof-publisher/preflight';
      input = {};
    } else if (action === 'approve') {
      if (!/^[0-9a-f-]{36}$/i.test(eventId ?? '')) throw Error('event UUID required');
      path = '/v1/proof-publisher/events/' + eventId + '/approve';
      input = JSON.parse(await readFile(inputFile, 'utf8'));
    } else
      throw Error(
        'use keygen PATH | policy ORIGIN OWNER_FILE POLICY_JSON | preflight ORIGIN OWNER_FILE | approve ORIGIN OWNER_FILE CONFIRM_JSON EVENT_ID'
      );
    const response = await fetch(new URL(path, url), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: { authorization: 'Bearer ' + owner.token, 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
    const result = await response.json();
    if (!response.ok)
      throw Error('Gateway rejected operation: ' + response.status + ' ' + result.error);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (e) {
  console.error(
    e.code ??
      (e.message?.startsWith('Gateway rejected')
        ? e.message
        : 'Invalid operator configuration or command; see docs/MINIMA_PROOF_ENGINE.md')
  );
  process.exitCode = 1;
}
