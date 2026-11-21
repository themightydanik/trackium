import { randomUUID } from 'node:crypto';
import { transaction } from '../cargo/shared.js';
import { ApiError, text, uuid } from '../telemetry/schema.js';
import { issueKey } from '../telemetry/service.js';

// Pilot owners can administer their devices and approve read/shipment browser scopes.
const ownerScopes = ['read', 'admin', 'shipments'];

export async function provisionCustomer(pool, customerId, name) {
  customerId = uuid(customerId);
  text(name, 120);
  return transaction(pool, null, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('managed:'||$1,0))", [customerId]);
    const { rows: [existing] } = await client.query(
      `SELECT c.customer_id,c.tenant_id,c.access_revision,t.name
       FROM managed_customers c JOIN telemetry_tenants t ON t.id=c.tenant_id
       WHERE customer_id=$1`, [customerId]
    );
    if (existing) {
      if (existing.name !== name) throw new ApiError(409, 'customer already registered with a different name');
      return existing;
    }
    const tenantId = randomUUID();
    await client.query('INSERT INTO telemetry_tenants(id,name) VALUES($1,$2)', [tenantId, name]);
    const { rows: [customer] } = await client.query(
      'INSERT INTO managed_customers(customer_id,tenant_id) VALUES($1,$2) RETURNING customer_id,tenant_id,access_revision',
      [customerId, tenantId]
    );
    return { ...customer, name };
  });
}

export async function customerStatus(pool, customerId) {
  const { rows: [customer] } = await pool.query(
    `SELECT c.*,t.name,
       (SELECT count(*)::int FROM telemetry_api_keys k WHERE k.tenant_id=c.tenant_id
         AND k.revoked_at IS NULL) AS active_keys,
       (SELECT count(*)::int FROM cargo_sessions s JOIN telemetry_api_keys k
         ON k.id=s.approved_by AND k.tenant_id=s.tenant_id WHERE s.tenant_id=c.tenant_id
         AND s.revoked_at IS NULL AND s.expires_at>now()
         AND k.revoked_at IS NULL AND 'admin'=ANY(k.scopes) AND s.scopes <@ k.scopes) AS active_browser_sessions
     FROM managed_customers c JOIN telemetry_tenants t ON t.id=c.tenant_id
     WHERE c.customer_id=$1`, [uuid(customerId)]
  );
  if (!customer) throw new ApiError(404, 'managed customer not found');
  return {
    ...customer,
    access: customer.active_keys ? 'active' : customer.access_revision ? 'revoked' : 'awaiting_grant'
  };
}

export async function changeCustomerAccess(pool, customerId, revision, deliverCredential) {
  customerId = uuid(customerId);
  if (typeof revision !== 'string' || !/^(0|[1-9][0-9]{0,8})$/.test(revision))
    throw new ApiError(400, 'provide the expected --revision from managed-status');
  return transaction(pool, null, async client => {
    const { rows: [customer] } = await client.query(
      'SELECT tenant_id,access_revision FROM managed_customers WHERE customer_id=$1 FOR UPDATE',
      [customerId]
    );
    if (!customer) throw new ApiError(404, 'managed customer not found');
    if (customer.access_revision !== Number(revision))
      throw new ApiError(409, 'access revision changed; check managed-status before retrying');

    // Session authentication and pairing claims already check the approving key.
    await client.query('UPDATE telemetry_api_keys SET revoked_at=now() WHERE tenant_id=$1 AND revoked_at IS NULL',
      [customer.tenant_id]);
    if (deliverCredential) {
      const credential = await issueKey(client, customer.tenant_id, ownerScopes);
      await deliverCredential(credential);
    }
    const { rows: [updated] } = await client.query(
      `UPDATE managed_customers SET access_revision=access_revision+1,access_changed_at=now()
       WHERE customer_id=$1 RETURNING customer_id,tenant_id,access_revision`, [customerId]
    );
    return { ...updated, access: deliverCredential ? 'active' : 'revoked' };
  });
}

export async function managedCapacity(pool) {
  const { rows: [counts] } = await pool.query(
    `SELECT (SELECT count(*) FROM managed_customers) AS managed_customers,
       (SELECT count(*) FROM gateway_packets WHERE aovx_processing_state='pending') AS pending_raw_packets,
       (SELECT count(*) FROM cargo_outbox WHERE state='pending' OR
          (state='processing' AND lease_until<=now())) AS available_or_expired_outbox,
       pg_database_size(current_database()) AS database_bytes`
  );
  return counts;
}
