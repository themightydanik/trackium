// Operator-only CLI; never expose database-wide provisioning as a public API.
import { writeFile, realpath, readFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool, initialize, close } from '../journal.js';
import { migrate } from './migrate.js';
import { createTelemetryService, provisionTenant, issueKey } from './service.js';
import { uuid } from './schema.js';
import { createPairing } from '../cargo/pairing.js';
import { readConfig } from '../config.js';
import { changeCustomerAccess, customerStatus, managedCapacity, provisionCustomer } from '../managed/service.js';
const [command, ...args] = process.argv.slice(2);
const options = Object.fromEntries(
  args.map((arg) => {
    const i = arg.indexOf('=');
    return [arg.slice(0, i), arg.slice(i + 1)];
  })
);
async function credentialOutput(requested) {
  if (!requested)
    throw new Error('provide --out=/secure/path/key.json (new file, outside repository)');
  const moduleRoot = fileURLToPath(new URL('../../', import.meta.url));
  let protectedRoot = moduleRoot;
  try {
    protectedRoot = (
      await promisify(execFile)('git', ['rev-parse', '--show-toplevel'], { cwd: moduleRoot })
    ).stdout.trim();
  } catch {
    /* Image has no Git checkout. */
  }
  const output = resolve(
    await realpath(dirname(resolve(requested))),
    requested.split('/').at(-1)
  );
  const within = relative(await realpath(protectedRoot), output);
  if (!within.startsWith('../') && !isAbsolute(within))
    throw new Error('credential output must be outside the checkout/application directory');
  return output;
}

const managedOptions = {
  'managed-provision': ['--customer', '--name'],
  'managed-status': ['--customer'],
  'managed-grant': ['--customer', '--revision', '--out'],
  'managed-revoke': ['--customer', '--revision'],
  'managed-capacity': []
};
async function managedCommand() {
  const required = managedOptions[command];
  if (args.length !== required.length || Object.keys(options).length !== required.length ||
      !required.every(key => options[key]?.trim()))
    throw new Error('Required options for ' + command + ': ' + required.join(', '));
  const customer = options['--customer'];
  if (command === 'managed-provision') return provisionCustomer(pool, customer, options['--name']);
  if (command === 'managed-status') return customerStatus(pool, customer);
  if (command === 'managed-capacity') return managedCapacity(pool);
  const revision = options['--revision'];
  if (command === 'managed-revoke') return changeCustomerAccess(pool, customer, revision);
  const output = await credentialOutput(options['--out']);
  return changeCustomerAccess(pool, customer, revision, credential =>
    writeFile(output, JSON.stringify(credential) + '\n', { mode: 0o600, flag: 'wx' })
  );
}

try {
  await initialize();
  await migrate(pool);
  if (Object.hasOwn(managedOptions, command)) {
    console.log(JSON.stringify(await managedCommand()));
  } else if (command === 'approve-pairing') {
    let credential;
    try {
      credential = JSON.parse(await readFile(options['--credential-file'], 'utf8'));
    } catch {
      // JSON parser errors can include input snippets; never echo credential bytes.
      throw new Error('Cannot read owner credential JSON');
    }
    const identity = await createTelemetryService(pool).authenticate('Bearer ' + credential.token);
    await createPairing(pool, readConfig()).approve(
      identity,
      options['--challenge'],
      (options['--scopes'] || 'read').split(',')
    );
    console.log('Pairing challenge approved for credential tenant.');
  } else if (command === 'revoke-key') {
    const result = await pool.query(
      `UPDATE telemetry_api_keys k SET revoked_at=now() WHERE id=$1
       AND NOT EXISTS (SELECT 1 FROM managed_customers c WHERE c.tenant_id=k.tenant_id) RETURNING id`,
      [uuid(options['--id'])]
    );
    if (!result.rowCount) throw new Error('key not found or belongs to a managed customer; use managed-revoke');
    console.log('key revoked');
  } else {
    const output = await credentialOutput(options['--out']);
    let credential;
    if (command === 'create-tenant') credential = await provisionTenant(pool, options['--name']);
    else if (command === 'issue-key') {
      const tenant = uuid(options['--tenant']);
      const managed = await pool.query('SELECT 1 FROM managed_customers WHERE tenant_id=$1', [tenant]);
      if (managed.rowCount) throw new Error('use managed-grant for a managed customer');
      credential = await issueKey(pool, tenant, options['--scopes']?.split(','));
    } else {
      throw new Error('commands: create-tenant, issue-key, revoke-key, approve-pairing, ' +
        Object.keys(managedOptions).join(', '));
    }
    try {
      await writeFile(output, JSON.stringify(credential) + '\n', { mode: 0o600, flag: 'wx' });
    } catch (err) {
      await pool.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1', [
        credential.id
      ]);
      throw err;
    }
    console.log('credential saved to requested file; store it securely');
  }
} catch (err) {
  console.error('provisioning failed:', err.message);
  process.exitCode = 1;
} finally {
  await close();
}
