import { randomUUID } from 'node:crypto';
import { ApiError, invalid, object, uuid, text, canonicalize } from '../telemetry/schema.js';
import { createTelemetryService } from '../telemetry/service.js';
import { hash, tenantLock, transaction } from '../cargo/shared.js';

const conflict = (message) => new ApiError(409, message);
const bcd = (value) => {
  if (typeof value !== 'string' || !/^[0-9]{12}$/.test(value)) invalid('Expected a 12-digit AOVX identifier');
  return value;
};

function parsePlan(input) {
  const ids = ['id','source_tenant','source_device','source_binding','destination_tenant',
    'source_approval','destination_approval','custody_reference','operator_reference'];
  object(input, [...ids,'identifier','destination_label','reverse_of']);
  const plan = Object.fromEntries(ids.map(key => [key, uuid(input[key])]));
  plan.identifier = bcd(input.identifier);
  plan.reverse_of = input.reverse_of == null ? null : uuid(input.reverse_of);
  plan.destination_label = plan.reverse_of ? null : text(input.destination_label, 120).trim();
  if (plan.reverse_of && input.destination_label != null) invalid('Rollback reuses the original device label');
  if (plan.source_tenant === plan.destination_tenant ||
      new Set([plan.id, plan.source_approval, plan.destination_approval, plan.custody_reference]).size !== 4)
    invalid('Provide distinct tenants and approval references');
  return plan;
}

async function inspect(client, identifier) {
  const { rows } = await client.query(
    `SELECT b.id,b.tenant_id,t.name AS company,b.device_id,b.state,b.created_at,b.revoked_at,d.enabled,d.mode,d.identity_kind
       FROM telemetry_aovx_device_bindings b JOIN telemetry_tenants t ON t.id=b.tenant_id
       JOIN telemetry_devices d ON d.tenant_id=b.tenant_id AND d.id=b.device_id
       WHERE b.device_id_bcd=$1 ORDER BY b.created_at,b.id`, [identifier]);
  const { rows: [pilot] } = await client.query(
    `SELECT p.tenant_id,t.name AS company,p.active,d.enabled AS login_enabled,a.verified_at IS NOT NULL AS verified,m.role
       FROM customer_demo_pilot p JOIN customer_demo d ON d.account_id=p.account_id
       JOIN customer_accounts a ON a.id=p.account_id
       JOIN telemetry_tenants t ON t.id=p.tenant_id
       LEFT JOIN customer_members m ON m.tenant_id=p.tenant_id AND m.account_id=p.account_id`);
  const active = rows.find(row => row.state === 'active') ?? null;
  const { rows: [pending] } = await client.query(
    `SELECT count(*)::int AS pending FROM gateway_packets WHERE aovx_device_id_bcd=$1 AND aovx_processing_state='pending'`,
    [identifier]);
  const source = active && (await client.query(
    `SELECT (SELECT count(*) FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2)::int AS observations,
            (SELECT count(*) FROM cargo_shipments WHERE tenant_id=$1 AND device_id=$2
             AND status IN ('active','delivered'))::int AS open_shipments`, [active.tenant_id,active.device_id])).rows[0];
  return { active, prior_bindings: rows.filter(row => row.state === 'revoked'), pilot: pilot ?? null,
    pending_packets: pending.pending, source };
}

async function verifyPlan(client, plan, state) {
  const { active, pilot, source, prior_bindings: retired } = state;
  if (!active || !active.enabled || active.mode !== 'real' || active.identity_kind !== 'physical' || active.id !== plan.source_binding ||
      active.tenant_id !== plan.source_tenant || active.device_id !== plan.source_device)
    throw conflict('Expected active source device and binding do not match');
  if (source.open_shipments) throw conflict('Close active or delivered shipments before transferring custody');
  if (retired.some(row => ![plan.source_tenant,plan.destination_tenant].includes(row.tenant_id)))
    throw conflict('Identifier has historical bindings outside the approved tenant pair');
  const used = await client.query(
    `SELECT 1 FROM telemetry_aovx_transfers
     WHERE source_approval=ANY($1::uuid[]) OR destination_approval=ANY($1::uuid[])
        OR source_binding_id=$2 OR reverse_of=$3`,
    [[plan.source_approval,plan.destination_approval],plan.source_binding,plan.reverse_of]);
  if (used.rowCount) throw conflict('Transfer approval, source binding or rollback reference was already used');
  const reserved = await client.query(
    'SELECT tenant_id FROM customer_aovx_approvals WHERE identifier_sha256=$1', [hash(plan.identifier)]);
  if (reserved.rows.some(row => ![plan.source_tenant,plan.destination_tenant].includes(row.tenant_id)))
    throw conflict('Identifier is approved to a different company');
  if (!plan.reverse_of) {
    if (pilot?.tenant_id !== plan.destination_tenant || !pilot.active || !pilot.login_enabled || !pilot.verified || pilot.role !== 'owner')
      throw conflict('Destination must be the promoted, enabled physical pilot with an Owner');
    return null;
  }
  const { rows: [original] } = await client.query(
    `SELECT b.tenant_id,b.device_id,b.device_id_bcd,d.enabled,d.mode,d.identity_kind
       FROM telemetry_aovx_transfers a JOIN telemetry_aovx_device_bindings b ON b.id=a.source_binding_id
       JOIN telemetry_devices d ON d.tenant_id=b.tenant_id AND d.id=b.device_id
       WHERE a.id=$1 AND a.reverse_of IS NULL AND a.destination_binding_id=$2`,
    [plan.reverse_of,plan.source_binding]);
  if (!original || original.tenant_id !== plan.destination_tenant || original.device_id_bcd !== plan.identifier ||
      !original.enabled || original.mode !== 'real' || original.identity_kind !== 'physical')
    throw conflict('Rollback does not match the original transfer and enabled device');
  const current = await client.query(
    "SELECT 1 FROM telemetry_aovx_device_bindings WHERE tenant_id=$1 AND device_id=$2 AND state='active'",
    [original.tenant_id,original.device_id]);
  if (current.rowCount) throw conflict('Original device already has an active binding');
  return original.device_id;
}

export async function administerAovxTransfer(pool, command, input) {
  if (!['inspect-transfer','plan-transfer','apply-transfer'].includes(command)) invalid('Unknown transfer operation');
  if (command === 'inspect-transfer') object(input, ['identifier']);
  const plan = command === 'inspect-transfer' ? null : parsePlan(input);
  const identifier = plan?.identifier ?? bcd(input.identifier);
  const apply = command === 'apply-transfer';
  const digest = plan && hash(canonicalize(plan));
  return transaction(pool, null, async client => {
    if (apply) {
      // Ingestion, Cargo and customer enrollment take tenant locks before
      // device/binding rows. Pilot administration takes account before BCD.
      for (const tenant of [plan.source_tenant,plan.destination_tenant].sort()) await tenantLock(client, tenant);
      await client.query(
        'SELECT a.id FROM customer_demo d JOIN customer_accounts a ON a.id=d.account_id FOR UPDATE OF a');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('aovx-enroll:'||$1,0))", [identifier]);
      const prior = await client.query('SELECT * FROM telemetry_aovx_transfers WHERE id=$1', [plan.id]);
      if (prior.rowCount) {
        if (prior.rows[0].request_sha256 !== digest) throw conflict('Operation ID belongs to a different plan');
        const { request_sha256, ...receipt } = prior.rows[0];
        return { status: 'already-applied', ...receipt };
      }
      await client.query(
        'SELECT id FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [plan.source_tenant,plan.source_device]);
      await client.query('SELECT id FROM telemetry_aovx_device_bindings WHERE id=$1 FOR UPDATE', [plan.source_binding]);
    } else {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    }
    const state = await inspect(client, identifier);
    if (!plan) return state;
    let device = await verifyPlan(client, plan, state);
    if (!apply) return { status: 'dry-run', ...state, operation_id: plan.id,
      destination_tenant: plan.destination_tenant, reuse_device: device, historical_backfill: false };
    if (!device) {
      const registry = await createTelemetryService(pool).register(plan.destination_tenant,
        { label: plan.destination_label, mode: 'real' }, 'physical', client);
      device = registry.id;
    } else {
      const { rows: [target] } = await client.query(
        'SELECT enabled FROM telemetry_devices WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [plan.destination_tenant,device]);
      if (!target?.enabled) throw conflict('Original device is no longer enabled');
    }
    const binding = randomUUID();
    const { rows: [{ cutoff }] } = await client.query(
      "SELECT date_trunc('milliseconds',clock_timestamp()) + interval '1 millisecond' AS cutoff");
    await client.query(
      "UPDATE telemetry_aovx_device_bindings SET state='revoked',revoked_at=$2 WHERE id=$1", [plan.source_binding,cutoff]);
    await client.query(`INSERT INTO telemetry_aovx_device_bindings
      (id,tenant_id,device_id,device_id_bcd,created_at) VALUES($1,$2,$3,$4,$5)`,
    [binding,plan.destination_tenant,device,identifier,cutoff]);
    const { rows: [audit] } = await client.query(
      `INSERT INTO telemetry_aovx_transfers
        (id,request_sha256,source_binding_id,destination_binding_id,reverse_of,source_approval,
         destination_approval,custody_reference,operator_reference,effective_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,source_binding_id,destination_binding_id,reverse_of,source_approval,destination_approval,
                 custody_reference,operator_reference,effective_at`,
      [plan.id,digest,plan.source_binding,binding,plan.reverse_of,plan.source_approval,plan.destination_approval,
        plan.custody_reference,plan.operator_reference,cutoff]);
    return { status: 'applied', ...audit };
  });
}
