import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { ApiError, object, uuid } from '../telemetry/schema.js';
import { body, reply } from '../telemetry/api.js';
import { parseCalculation, routeError } from '../routing/contract.js';
import { claimInventory, requireCurrentOwner } from './device-activation.js';
import { takeCustomerRate } from './customer-rate.js';
import { hash, transaction } from './shared.js';

const denied = () => new ApiError(401, 'Core installation authorization failed');
const windowMs = 90_000;
const operations = new Set(['claim', 'devices', 'observations', 'calculate', 'connect']);

function readEnvelope(input, operation, audience) {
  object(input, ['public_key', 'nonce', 'timestamp', 'payload', 'signature']);
  const { public_key, nonce, timestamp, payload, signature } = input;
  if (typeof public_key !== 'string' || !/^[A-Za-z0-9_-]{120,124}$/.test(public_key) ||
      typeof signature !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(signature) ||
      typeof payload !== 'string' || !Number.isSafeInteger(timestamp) ||
      Math.abs(Date.now() - timestamp) > windowMs) throw denied();
  uuid(nonce);
  try {
    const key = createPublicKey({key:Buffer.from(public_key,'base64url'),type:'spki',format:'der'});
    const canonical = key.export({type:'spki',format:'der'});
    if (canonical.toString('base64url') !== public_key || key.asymmetricKeyType !== 'ec' ||
        key.asymmetricKeyDetails.namedCurve !== 'prime256v1' ||
        !verify('sha256',Buffer.from(['trackium-core-device-v1', audience, operation, nonce, timestamp, hash(payload)].join('\n')),
          key,Buffer.from(signature,'base64url'))) throw denied();
    return { keyHash:hash(canonical), nonce, input:JSON.parse(payload) };
  } catch { throw denied(); }
}

export function manageCoreDeviceAccess(pool, identity, operation, input) {
  object(input,operation === 'issue' ? ['device_id','permission'] :
    operation === 'list' ? ['device_id'] : ['device_id','installation_id']);
  const device = uuid(input.device_id);
  const installation = ['approve','revoke'].includes(operation) ? uuid(input.installation_id) : null;
  if (operation === 'issue' && !['full','view'].includes(input.permission))
    throw new ApiError(400,'Invalid Core permission');
  return transaction(pool,identity.tenant_id,async client => {
    await requireCurrentOwner(client,identity);
    const args = [identity.tenant_id,device];
    const {rows:[inventory]} = await client.query(`SELECT i.serial FROM device_activation_inventory i
      JOIN telemetry_devices d ON d.tenant_id=i.tenant_id AND d.id=i.device_id
      WHERE i.tenant_id=$1 AND i.device_id=$2 AND d.enabled FOR UPDATE OF i`,args);
    if (!inventory) throw new ApiError(404,'Activated device unavailable');
    if (operation === 'issue') {
      const code = randomBytes(32).toString('base64url');
      await client.query('DELETE FROM core_device_connection_codes WHERE expires_at<=now()');
      const {rows:[issued]} = await client.query(`INSERT INTO core_device_connection_codes
        (code_sha256,tenant_id,device_id,permission,expires_at)
        VALUES($3,$1,$2,$4,now()+interval '5 minutes') RETURNING expires_at`,
      [...args,hash(code),input.permission]);
      return {code,expires_at:issued.expires_at};
    }
    if (operation === 'list') {
      const {rows} = await client.query(`SELECT id,key_sha256 AS fingerprint,permission,created_at,approved_at
        FROM core_device_installations WHERE tenant_id=$1 AND device_id=$2 AND revoked_at IS NULL
        ORDER BY created_at DESC,id LIMIT 50`,args);
      return {installations:rows};
    }
    const {rowCount} = operation === 'approve'
      ? await client.query(`UPDATE core_device_installations SET approved_at=now()
          WHERE tenant_id=$1 AND device_id=$2 AND id=$3 AND permission<>'owner'
            AND revoked_at IS NULL AND approved_at IS NULL`,[...args,installation])
      : await client.query(`UPDATE core_device_installations SET revoked_at=now()
          WHERE tenant_id=$1 AND device_id=$2 AND id=$3 AND permission<>'owner' AND revoked_at IS NULL`,[...args,installation]);
    if (!rowCount) throw new ApiError(404,'Core installation unavailable');
    return {updated:true};
  });
}

async function connectInstallation(pool,keyHash,input,pilotEnabled) {
  object(input,['code']);
  if (typeof input.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.code)) throw denied();
  return transaction(pool,null,async client => {
    const key = hash(input.code);
    const {rows:[target]} = await client.query(`SELECT tenant_id,device_id
      FROM core_device_connection_codes WHERE code_sha256=$1 AND expires_at>now()`,[key]);
    if (!target) throw denied();
    const args = [target.tenant_id,target.device_id];
    const {rows:[device]} = await client.query(`SELECT serial FROM device_activation_inventory
      WHERE tenant_id=$1 AND device_id=$2 AND NOT EXISTS (
        SELECT 1 FROM customer_demo_pilot p JOIN customer_demo d USING(account_id)
        WHERE p.tenant_id=$1 AND (NOT p.active OR NOT d.enabled OR NOT $3)
      ) FOR UPDATE`,[...args,pilotEnabled]);
    if (!device) throw denied();
    const {rows:[code]} = await client.query(`DELETE FROM core_device_connection_codes
      WHERE code_sha256=$1 AND expires_at>now() RETURNING permission`,[key]);
    if (!code) throw denied();
    const {rows:[count]} = await client.query(`SELECT COUNT(*)::int n FROM core_device_installations
      WHERE serial=$1 AND revoked_at IS NULL`,[device.serial]);
    if (count.n >= 50) throw new ApiError(409,'Installation limit reached');
    const id = randomUUID();
    const inserted = await client.query(`INSERT INTO core_device_installations(id,serial,tenant_id,device_id,key_sha256,permission)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,[id,device.serial,...args,keyHash,code.permission]);
    if (!inserted.rowCount) throw new ApiError(409,'Core installation already connected');
    return {id,fingerprint:keyHash,approval_required:true};
  });
}

export function createCoreDeviceAccess(pool, config, telemetry, routing) {
  const audience = new URL(config.publicOrigin).origin;
  return async (req,res,operation) => {
    if (req.method !== 'POST' || !operations.has(operation)) throw new ApiError(404, 'not found');
    if (req.headers.cookie || req.headers.authorization || req.headers.origin)
      throw denied();
    await takeCustomerRate(pool,'core-device:global',240);
    await takeCustomerRate(pool,'core-device:peer:' + hash(req.socket.remoteAddress || 'unknown'),120);
    const { keyHash, nonce, input } = readEnvelope((await body(req,8192)).input,operation,audience);
    const attempts = await takeCustomerRate(pool,'core-device:' + keyHash,20);
    if (attempts === 1) await pool.query('DELETE FROM core_device_request_nonces WHERE expires_at<=now()');
    const used = await pool.query(`INSERT INTO core_device_request_nonces(key_sha256,nonce,expires_at)
      VALUES ($1,$2,now()+interval '4 minutes') ON CONFLICT DO NOTHING`,[keyHash,nonce]);
    if (!used.rowCount) throw denied();
    if (operation === 'connect') return reply(res,201,await connectInstallation(pool,keyHash,input,Boolean(config.pilotEnabled)));
    if (operation === 'claim') {
      await takeCustomerRate(pool,'core-device-claim:' + keyHash,5);
      const claimed = await transaction(pool,null,async client => {
        const device = await claimInventory(client,telemetry,input,async () => {
          const tenant = randomUUID();
          await client.query("INSERT INTO telemetry_tenants(id,name) VALUES($1,'Core device workspace')",[tenant]);
          return tenant;
        });
        const id = randomUUID();
        await client.query(`INSERT INTO core_device_installations(id,serial,tenant_id,device_id,key_sha256,permission,approved_at)
          VALUES($1,$2,$3,$4,$5,'owner',now())`,[id,device.serial,device.tenant_id,device.id,keyHash]);
        return {id, device_id:device.id,serial:device.serial,label:device.label,permission:'owner'};
      });
      return reply(res,201,claimed);
    }
    if (operation === 'devices') object(input,[]);
    else object(input,operation === 'calculate' ? ['installation_id','calculation'] : ['installation_id']);
    const installation = operation === 'devices' ? null : uuid(input.installation_id);
    const {rows} = await pool.query(`
      SELECT c.id,c.tenant_id,c.device_id,i.serial,d.label,d.enabled,c.permission
      FROM core_device_installations c JOIN device_activation_inventory i USING(serial)
      JOIN telemetry_devices d ON d.tenant_id=c.tenant_id AND d.id=c.device_id
      WHERE c.key_sha256=$1 AND c.revoked_at IS NULL AND c.approved_at IS NOT NULL AND c.tenant_id=i.tenant_id AND c.device_id=i.device_id
        AND ($2::uuid IS NULL OR c.id=$2)
        AND NOT EXISTS (
          SELECT 1 FROM customer_demo_pilot p JOIN customer_demo d USING(account_id)
          WHERE p.tenant_id=c.tenant_id AND (NOT p.active OR NOT d.enabled OR NOT $3)
        )
      ORDER BY c.created_at DESC,c.id LIMIT 50`,[keyHash,installation,Boolean(config.pilotEnabled)]);
    if (operation === 'devices')
      return reply(res,200,{devices:rows.map(({tenant_id,...device}) => device)});
    const device = rows[0];
    if (!device?.enabled) throw new ApiError(404,'Device authorization unavailable');
    if (operation === 'observations') {
      const [current, history] = await Promise.all([
        telemetry.latest(device.tenant_id,device.device_id,true),
        telemetry.history(device.tenant_id,device.device_id,{limit:50})
      ]);
      return reply(res,200,{location:current.location,history:history.events.map(event => ({
        id:event.id,occurred_at:event.occurred_at,received_at:event.received_at,payload:event.payload
      }))});
    }
    if (device.permission === 'view') throw new ApiError(403,'Read-only access');
    if (!routing) throw routeError(503,'ROUTING_UNAVAILABLE','Routing temporarily unavailable');
    return reply(res,200,await routing.calculate({account_id:keyHash,tenant_id:device.tenant_id},
      parseCalculation(input.calculation)));
  };
}
