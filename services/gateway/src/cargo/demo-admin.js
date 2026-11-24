import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { ApiError } from '../telemetry/schema.js';
import { createTelemetryService } from '../telemetry/service.js';
import { createIntegritas } from '../proofs/integritas.js';
import { createPasswordDigest } from './accounts.js';
import { createShipmentService, shipment, transition } from './shipments.js';
import { tenantLock, transaction } from './shared.js';

export async function readDemoPassword(path) {
  const value = await readOwnerSecret(path, 257);
  if (/[\r\n]/.test(value)) throw new ApiError(400, 'Use one password per secret file');
  return value;
}

export async function readOwnerSecret(path, maxBytes) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid() || info.size > maxBytes)
      throw new ApiError(400, 'Use an owner-only regular secret file');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)).replace(/\r?\n$/, '');
    if (bytesRead > maxBytes) throw new ApiError(400, 'Secret file exceeds its size limit');
    return value;
  } finally {
    await file.close();
  }
}

async function seed(pool, client, tenant) {
  const telemetry = createTelemetryService(pool);
  const shipments = createShipmentService(pool);
  const proofs = createIntegritas(pool);
  for (const [index, name, status, stops] of [
    [1, 'Demo · chilled cargo', 'active', [
      ['Wrocław depot', 51.11, 17.04], ['Kraków checkpoint', 50.06, 19.94], ['Lviv terminal', 49.84, 24.03]
    ]],
    [2, 'Demo · scheduled dry cargo', 'cancelled', [
      ['Rotterdam depot', 51.92, 4.48], ['Antwerp terminal', 51.22, 4.40]
    ]]
  ]) {
    const device = await telemetry.register(tenant, { label: 'Demo device ' + index, mode: 'synthetic' }, 'fixture', client);
    const cargo = await shipments.create(tenant, {
      name, device_id: device.id,
      route: stops.map(([name, latitude, longitude]) => ({ name, latitude, longitude })),
      conditions: { temperature_min_c: 2, temperature_max_c: 8 }
    }, client);
    await transition(client, await shipment(client, tenant, cargo.id, true), status, 'demo-seed-transition');
    const { rows: [event] } = await client.query(
      "SELECT id FROM cargo_events WHERE tenant_id=$1 AND shipment_id=$2 AND event_type='status_changed'",
      [tenant, cargo.id]);
    await proofs.prepare(tenant, event.id, client);
  }
}

export async function administerDemo(pool, command, { password } = {}) {
  if (!['bootstrap', 'rotate', 'revoke', 'disable', 'enable'].includes(command))
    throw new ApiError(400, 'Use bootstrap, rotate, revoke, disable or enable');
  // Kept as an internal sentinel in the email-based account table. Demo login uses customer_demo.username.
  const email = 'demo@trackium.invalid';
  const digest = ['bootstrap','rotate'].includes(command) ? await createPasswordDigest(password) : null;
  return transaction(pool, null, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('trackium-customer-demo',0))");
    const { rows: [existing] } = await client.query(
      `SELECT d.account_id,d.tenant_id,d.enabled FROM customer_demo d
       JOIN customer_accounts a ON a.id=d.account_id FOR UPDATE OF a`);
    if (command === 'bootstrap') {
      if (existing) return { status: 'already-present', enabled: existing.enabled };
      const occupied = await client.query(
        "SELECT EXISTS(SELECT 1 FROM customer_accounts WHERE email=$1) OR EXISTS(SELECT 1 FROM telemetry_tenants WHERE name='Trackium Demo') AS occupied",
        [email]);
      if (occupied.rows[0].occupied) throw new ApiError(409, 'Demo identifier is already in use');
      const account = randomUUID(), tenant = randomUUID();
      await client.query("INSERT INTO telemetry_tenants(id,name) VALUES($1,'Trackium Demo')", [tenant]);
      await client.query('INSERT INTO customer_accounts(id,email,password_digest,verified_at) VALUES($1,$2,$3,now())',
        [account,email,digest]);
      await client.query("INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,'viewer')",
        [account,tenant]);
      await client.query('INSERT INTO customer_demo(account_id,tenant_id) VALUES($1,$2)', [account,tenant]);
      await tenantLock(client,tenant);
      await seed(pool,client,tenant);
      return { status: 'created', enabled: true };
    }
    if (!existing) throw new ApiError(404, 'Demo account does not exist');
    if (command === 'rotate') {
      await client.query('UPDATE customer_accounts SET password_digest=$2 WHERE id=$1', [existing.account_id,digest]);
    } else if (command !== 'revoke') {
      await client.query('UPDATE customer_demo SET enabled=$1', [command === 'enable']);
    }
    await client.query('DELETE FROM customer_sessions WHERE account_id=$1', [existing.account_id]);
    return { status: command, enabled: ['rotate','revoke'].includes(command) ? existing.enabled : command === 'enable' };
  });
}
