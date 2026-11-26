import { randomUUID } from 'node:crypto';
import { ApiError, text } from '../telemetry/schema.js';
import { createPasswordDigest, matchesPasswordDigest } from './accounts.js';
import { hash, transaction } from './shared.js';

export async function administerPilot(pool, command, { name, identifiers, password, transferOnly = false } = {}) {
  if (!['inspect','plan','promote','rollback'].includes(command)) throw new ApiError(400, 'Unknown pilot operation');
  const grant = command === 'plan' || command === 'promote';
  const writable = command === 'promote' || command === 'rollback';
  if (grant) {
    text(name, 120);
    name = name.trim();
    if (!Array.isArray(identifiers) || identifiers.length > 20 ||
        (transferOnly ? identifiers.length !== 0 : identifiers.length < 1) ||
        new Set(identifiers).size !== identifiers.length || identifiers.some(id => !/^\d{12}$/.test(id)))
      throw new ApiError(400, 'Use 1–20 verified decimal identifiers, or empty inventory for transfer-only setup');
  }
  const encoded = writable ? await createPasswordDigest(password) : null;
  return transaction(pool, null, async client => {
    if (!writable) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    if (writable) await client.query("SELECT pg_advisory_xact_lock(hashtextextended('trackium-customer-demo',0))");
    const { rows: [demo] } = await client.query(
      `SELECT d.account_id,d.tenant_id AS archive_tenant_id,d.enabled,a.verified_at,
              ${writable ? 'a.password_digest,' : ''} p.tenant_id,p.active,t.name,
              m.role AS archive_role
       FROM customer_demo d JOIN customer_accounts a ON a.id=d.account_id
       LEFT JOIN customer_demo_pilot p ON p.account_id=d.account_id
       LEFT JOIN telemetry_tenants t ON t.id=p.tenant_id
       LEFT JOIN customer_members m ON m.account_id=d.account_id AND m.tenant_id=d.tenant_id
       ${writable ? 'FOR UPDATE OF a' : ''}`
    );
    if (!demo) throw new ApiError(404, 'Demo account does not exist');
    const status = {
      account_id: demo.account_id, archive_tenant_id: demo.archive_tenant_id,
      pilot_tenant_id: demo.tenant_id, active: demo.active === true,
      login_enabled: demo.enabled, archive_role: demo.archive_role
    };
    if (command === 'inspect') return { status: 'inspected', ...status };
    if (demo.archive_role !== 'viewer' || !demo.verified_at)
      throw new ApiError(409, 'Expected verified demo identity and archived Viewer membership');
    if (grant) {
      if (demo.active || !demo.enabled || (demo.tenant_id && demo.name !== name))
        throw new ApiError(409, 'Pilot is active, demo is disabled, or the previously selected company name differs');
      if (writable) {
        for (const identifier of [...identifiers].sort()) {
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended('aovx-enroll:'||$1,0))", [identifier]);
        }
      }
      const { rows: [checks] } = await client.query(
        `SELECT EXISTS(SELECT 1 FROM telemetry_tenants WHERE lower(name)=lower($1) AND id IS DISTINCT FROM $2) AS name_taken,
           EXISTS(SELECT 1 FROM telemetry_aovx_device_bindings WHERE device_id_bcd=ANY($3::text[])
             AND tenant_id IS DISTINCT FROM $2) AS binding_conflict,
           EXISTS(SELECT 1 FROM customer_aovx_approvals WHERE identifier_sha256=ANY($4::text[])
             AND tenant_id IS DISTINCT FROM $2) AS approval_conflict`,
        [name, demo.tenant_id, identifiers, identifiers.map(hash)]
      );
      if (checks.name_taken || checks.binding_conflict || checks.approval_conflict)
        throw new ApiError(409, 'Company name or approved inventory is unavailable; inspect ownership privately');
      if (!writable) return { status: 'dry-run', ...status, approved_devices: identifiers.length };
    } else if (!demo.active) {
      throw new ApiError(409, 'No active pilot to roll back');
    }
    if (await matchesPasswordDigest(password, demo.password_digest))
      throw new ApiError(400, 'Provide a new password distinct from the current password');

    let tenant = demo.tenant_id;
    if (command === 'promote') {
      if (!tenant) {
        tenant = randomUUID();
        await client.query('INSERT INTO telemetry_tenants(id,name) VALUES($1,$2)', [tenant,name]);
      }
      await client.query(
        `INSERT INTO customer_demo_pilot(account_id,tenant_id,active) VALUES($1,$2,true)
         ON CONFLICT(account_id) DO UPDATE SET active=true,changed_at=now()`, [demo.account_id,tenant]
      );
      await client.query("INSERT INTO customer_members(account_id,tenant_id,role) VALUES($1,$2,'owner')", [demo.account_id,tenant]);
      await client.query('DELETE FROM customer_aovx_approvals WHERE tenant_id=$1', [tenant]);
      await client.query(
        'INSERT INTO customer_aovx_approvals(tenant_id,identifier_sha256) SELECT $1,unnest($2::text[])',
        [tenant,identifiers.map(hash)]
      );
    } else {
      await client.query('DELETE FROM customer_members WHERE account_id=$1 AND tenant_id=$2', [demo.account_id,tenant]);
      await client.query('DELETE FROM customer_aovx_approvals WHERE tenant_id=$1', [tenant]);
      await client.query('DELETE FROM core_device_connection_codes WHERE tenant_id=$1',[tenant]);
      await client.query('UPDATE core_device_installations SET revoked_at=now() WHERE tenant_id=$1 AND revoked_at IS NULL',[tenant]);
      await client.query('UPDATE customer_demo_pilot SET active=false,changed_at=now() WHERE account_id=$1', [demo.account_id]);
    }
    await client.query('UPDATE customer_accounts SET password_digest=$2 WHERE id=$1', [demo.account_id,encoded]);
    await client.query('DELETE FROM customer_sessions WHERE account_id=$1', [demo.account_id]);
    await client.query('DELETE FROM customer_mail_tokens WHERE account_id=$1', [demo.account_id]);
    await client.query('INSERT INTO customer_demo_pilot_audit(account_id,action) VALUES($1,$2)', [demo.account_id,command]);
    return { ...status, status: command, pilot_tenant_id: tenant, active: command === 'promote' };
  });
}
