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
const [command, ...args] = process.argv.slice(2);
const options = Object.fromEntries(
  args.map((arg) => {
    const i = arg.indexOf('=');
    return [arg.slice(0, i), arg.slice(i + 1)];
  })
);
try {
  await initialize();
  await migrate(pool);
  if (command === 'approve-pairing') {
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
      'UPDATE telemetry_api_keys SET revoked_at=now() WHERE id=$1 RETURNING id',
      [uuid(options['--id'])]
    );
    if (!result.rowCount) throw new Error('key not found');
    console.log('key revoked');
  } else {
    if (!options['--out'])
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
      await realpath(dirname(resolve(options['--out']))),
      options['--out'].split('/').at(-1)
    );
    const within = relative(await realpath(protectedRoot), output);
    if (!within.startsWith('../') && !isAbsolute(within))
      throw new Error('credential output must be outside the checkout/application directory');
    let credential;
    if (command === 'create-tenant') credential = await provisionTenant(pool, options['--name']);
    else if (command === 'issue-key')
      credential = await issueKey(pool, uuid(options['--tenant']), options['--scopes']?.split(','));
    else throw new Error('commands: create-tenant, issue-key, revoke-key');
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
