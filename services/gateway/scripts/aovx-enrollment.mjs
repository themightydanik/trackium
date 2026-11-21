// Owner/operator tool. All authorization and enrollment rules live in the Gateway API.
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const commands = {
  register: ['label'],
  bind: ['device', 'bcd'],
  list: [],
  revoke: ['bcd']
};
const usage = `Usage: node scripts/aovx-enrollment.mjs COMMAND --origin=https://gateway.example.com --credential-file=/private/key.json
  register --label="Vehicle A"    Create a physical device and return its UUID
  bind --device=UUID --bcd=BCD    Bind 12 protocol digits to that physical device
  list                          List this credential's tenant bindings and history
  revoke --bcd=BCD               Revoke the active tenant binding
Only local loopback (127.0.0.1 or [::1]) can use HTTP for disposable tests.`;

function origin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Supply the Gateway HTTPS origin');
  }
  if (parsed.href !== parsed.origin + '/' ||
      (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(parsed.hostname))))
    throw new Error('Supply the Gateway HTTPS origin without credentials, path, query or fragment');
  return parsed.origin;
}

async function loadToken(file) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 16384 ||
        stat.uid !== process.getuid()) throw new Error();
    const { token } = JSON.parse(await handle.readFile('utf8'));
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error();
    return token;
  } catch {
    // File/JSON errors can contain credential material.
    throw new Error('Use a regular credential JSON file owned by you and readable only by you (chmod 600)');
  } finally {
    await handle?.close();
  }
}

async function run(command, args) {
  if (!Object.hasOwn(commands, command)) throw new Error(usage);
  const required = ['origin', 'credential-file', ...commands[command]];
  const { values } = parseArgs({
    args, options: Object.fromEntries(required.map(key => [key, { type: 'string' }]))
  });
  for (const key of required) {
    if (!values[key]?.trim()) throw new Error('Missing --' + key);
  }
  const gateway = origin(values.origin);
  if (values.bcd !== undefined && !/^[0-9]{12}$/.test(values.bcd))
    throw new Error('BCD must be exactly 12 decimal protocol digits');
  if (values.device !== undefined &&
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(values.device))
    throw new Error('Device must be a tenant-local UUID');
  const token = await loadToken(values['credential-file']);
  const bindings = '/v1/aovx/devices';
  const [method, path, input] = {
    register: ['POST', '/v1/devices', { label: values.label, mode: 'real' }],
    bind: ['POST', bindings, { device_id: values.device, device_id_bcd: values.bcd }],
    list: ['GET', bindings],
    revoke: ['DELETE', bindings + '/' + values.bcd]
  }[command];
  const retryHint = command === 'register'
    ? 'Check the tenant device list before retrying registration.'
    : 'List bindings before retrying a mutation.';
  let response;
  try {
    response = await fetch(gateway + path, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: 'Bearer ' + token,
        accept: 'application/json',
        ...(input && { 'content-type': 'application/json' })
      },
      body: input && JSON.stringify(input)
    });
  } catch {
    throw new Error('Gateway request failed. Check origin, TLS and redirects. ' + retryHint);
  }
  if (!response.ok) {
    await response.body?.cancel();
    const guidance = {
      400: 'Check the label, device UUID and 12-digit BCD.',
      401: 'Check the credential and whether it was revoked.',
      403: command === 'list' ? 'Listing requires read scope.' : 'This operation requires admin scope.',
      404: 'Check the credential tenant, device UUID and active binding.',
      409: 'Check for an existing active binding or an ineligible device.'
    };
    throw new Error('Gateway HTTP ' + response.status + ' · ' +
      (guidance[response.status] ?? retryHint));
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Gateway returned invalid JSON. ' + retryHint);
  }
  console.log(JSON.stringify(result, null, 2));
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === '--help') console.log(usage);
  else await run(command, args);
} catch (error) {
  // Suppress parser diagnostics that can contain arbitrary command-line input.
  console.error(error.code?.startsWith('ERR_PARSE_ARGS')
    ? 'Unsupported option or argument. Run with --help.' : error.message);
  process.exitCode = 1;
}
