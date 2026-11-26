import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError, object, text } from '../telemetry/schema.js';
import { hash, transaction } from './shared.js';

const serialPattern = /^[A-Z0-9][A-Z0-9._-]{3,63}$/;
const bcdPattern = /^[0-9]{12}$/;
const codePattern = /^[A-Za-z0-9_-]{43}$/;
const denied = () => new ApiError(400, 'Device activation was not accepted');
const lock = (client, bcd) =>
  client.query("SELECT pg_advisory_xact_lock(hashtextextended('aovx-enroll:'||$1,0))", [bcd]);
const secret = () => randomBytes(32).toString('base64url');

export async function claimDevice(pool, telemetry, identity, input) {
  object(input, ['serial', 'code', 'label']);
  const serial = typeof input.serial === 'string' ? input.serial.trim().toUpperCase() : '';
  if (!serialPattern.test(serial) || typeof input.code !== 'string' || !codePattern.test(input.code)) throw denied();
  text(input.label, 120);
  return transaction(pool, identity.tenant_id, async client => {
    // Match the existing tenant → account → BCD lock order.
    await client.query('SELECT id FROM customer_accounts WHERE id=$1 FOR NO KEY UPDATE', [identity.account_id]);
    const session = await client.query(
      `SELECT 1 FROM customer_sessions s JOIN customer_members m
           ON m.tenant_id=s.tenant_id AND m.account_id=s.account_id
        WHERE s.id=$1 AND s.tenant_id=$2 AND s.account_id=$3
          AND s.expires_at>now() AND m.role='owner' FOR SHARE OF s,m`,
      [identity.id,identity.tenant_id,identity.account_id]);
    if (!session.rowCount) throw new ApiError(403, 'Company owner required');
    const {rows:[candidate]} = await client.query(
      'SELECT device_id_bcd FROM device_activation_inventory WHERE serial=$1', [serial]);
    if (candidate) await lock(client,candidate.device_id_bcd);
    const {rows:[current]} = await client.query(
      'SELECT * FROM device_activation_inventory WHERE serial=$1 FOR UPDATE', [serial]);
    const valid = timingSafeEqual(Buffer.from(hash(input.code),'hex'),
      Buffer.from(current?.activation_sha256 ?? '0'.repeat(64),'hex'));
    if (!candidate || !current?.activation_sha256 || current.claimed_at || !valid) throw denied();

    const device = await telemetry.register(identity.tenant_id,{label:input.label,mode:'real'},'physical',client);
    await client.query(`UPDATE device_activation_inventory
      SET tenant_id=$2,device_id=$3,claimed_at=now(),activation_sha256=NULL WHERE serial=$1`,
    [serial,identity.tenant_id,device.id]);
    await client.query(`INSERT INTO telemetry_aovx_device_bindings (id,tenant_id,device_id,device_id_bcd)
      VALUES ($1,$2,$3,$4)`,[randomUUID(),identity.tenant_id,device.id,current.device_id_bcd]);
    return device;
  });
}

export async function provisionDevices(pool, rows, exportCards) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new Error('Use 1–100 inventory rows');
  for (const row of rows) {
    object(row, ['serial','device_id_bcd']);
    if (typeof row.serial !== 'string' || typeof row.device_id_bcd !== 'string' ||
        !serialPattern.test(row.serial) || !bcdPattern.test(row.device_id_bcd)) throw new Error('Invalid inventory row');
  }
  if (new Set(rows.map(row => row.serial)).size !== rows.length ||
      new Set(rows.map(row => row.device_id_bcd)).size !== rows.length) throw new Error('Duplicate inventory row');
  return transaction(pool,null,async client => {
    const ids = rows.map(row => row.device_id_bcd).sort();
    for (const bcd of ids) await lock(client,bcd);
    const used = await client.query(`SELECT 1 FROM telemetry_aovx_device_bindings WHERE device_id_bcd=ANY($1)
      UNION ALL SELECT 1 FROM customer_aovx_approvals WHERE identifier_sha256=ANY($2) LIMIT 1`, [ids,ids.map(hash)]);
    if (used.rowCount) throw new Error('Existing enrollment must be handled separately');
    const cards = [];
    for (const row of rows) {
      const code = secret();
      await client.query('INSERT INTO device_activation_inventory(serial,device_id_bcd,activation_sha256) VALUES($1,$2,$3)',
        [row.serial,row.device_id_bcd,hash(code)]);
      cards.push({serial:row.serial,code,qr:'trackium-activation:v1:' + row.serial + ':' + code});
    }
    await exportCards(cards);
    return cards.length;
  });
}

export async function administerActivation(pool, action, serial, exportCards) {
  if (!['invalidate','rotate','inspect'].includes(action) || !serialPattern.test(serial))
    throw new Error('Invalid activation operation');
  return transaction(pool,null,async client => {
    const {rows:[candidate]} = await client.query('SELECT device_id_bcd FROM device_activation_inventory WHERE serial=$1',[serial]);
    if (!candidate) throw new Error('Inventory entry unavailable');
    await lock(client,candidate.device_id_bcd);
    const {rows:[current]} = await client.query('SELECT * FROM device_activation_inventory WHERE serial=$1 FOR UPDATE',[serial]);
    if (action === 'inspect') return {serial,device_id_bcd:current.device_id_bcd,claimed:!!current.claimed_at,
      claimable:!!current.activation_sha256,tenant_id:current.tenant_id,device_id:current.device_id};
    if (current.claimed_at) throw new Error('Claimed device requires custody review');
    const code = action === 'rotate' ? secret() : null;
    await client.query('UPDATE device_activation_inventory SET activation_sha256=$2 WHERE serial=$1',
      [serial,code ? hash(code) : null]);
    if (code) await exportCards([{serial,code,qr:'trackium-activation:v1:' + serial + ':' + code}]);
    return {serial,claimable:!!code};
  });
}
