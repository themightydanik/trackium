import { hash } from '../src/cargo/shared.js';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { provisionDevices } from '../src/cargo/device-activation.js';
import { createRuntime } from '../src/cargo/runtime.js';
import { readConfig } from '../src/config.js';

test('Core-only card claim and device reads require the private installation key', async t => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL required');
  const schema = 'core_access_' + randomUUID().replaceAll('-','');
  const admin = new pg.Pool({connectionString:url});
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({connectionString:url,options:'-c search_path=' + schema});
  const fingerprint = Array(32).fill('AA').join(':');
  const config = readConfig({DATABASE_URL:url,ENABLE_TCP_RECEIVER:'false',ENABLE_WEB_WORKSPACE:'true',
    CORE_DEVICE_ACCESS_ENABLED:'true',CORE_ANDROID_CERT_SHA256:fingerprint});
  const {gateway} = createRuntime(pool,{...config,host:'127.0.0.1',httpPort:0},
    {worker:false,logger:{info(){},error(){}}});
  t.after(async () => {
    await gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await gateway.start();
  const origin = 'http://127.0.0.1:' + gateway.api.address().port;
  const statement = await fetch(origin+'/.well-known/assetlinks.json');
  assert.equal(statement.status,200);
  assert.deepEqual((await statement.json())[0].target,{
    namespace:'android_app',package_name:'tech.trackium.core.prototype',sha256_cert_fingerprints:[fingerprint]
  });
  const owner = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const other = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  function signed(operation,input,keys = owner) {
    const payload = JSON.stringify(input);
    const timestamp = Date.now();
    const nonce = randomUUID();
    return {public_key:keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),
      payload,timestamp,nonce,signature:sign('sha256',Buffer.from(
        ['trackium-core-device-v1',config.publicOrigin,operation,nonce,timestamp,hash(payload)].join('\n')),keys.privateKey).toString('base64url')};
  }
  const post = async (operation,envelope,extra) => {
    const response = await fetch(origin+'/v1/core-devices/'+operation,{method:'POST',
      headers:{'content-type':'application/json',...extra},body:JSON.stringify(envelope)});
    return {status:response.status,...await response.json()};
  };
  let card;
  await provisionDevices(pool,[{serial:'CORE-ACTIVATION-TEST',device_id_bcd:'199999999996'}],async cards => { [card] = cards; });
  const claim = {serial:card.serial,code:card.code,label:'Core fixture'};
  const envelope = signed('claim',claim);
  assert.equal((await post('claim',{...envelope,payload:JSON.stringify({...claim,label:'tampered'})})).status,401);
  const results = await Promise.all([post('claim',envelope),post('claim',signed('claim',claim,other))]);
  assert.deepEqual(results.map(x=>x.status).sort(),[201,400]);
  const first = results.findIndex(x=>x.status===201);
  const keys = first===0 ? owner : other;
  const notOwner = first===0 ? other : owner;
  const claimed = results[first];
  const listing = signed('devices',{},keys);
  assert.equal((await post('devices',listing,{cookie:'untrusted=true'})).status,401);
  assert.equal((await post('devices',listing)).devices[0].id,claimed.id);
  assert.equal((await post('devices',listing)).status,401);
  assert.deepEqual((await post('devices',signed('devices',{},notOwner))).devices,[]);
  const target = {installation_id:claimed.id};
  assert.equal((await post('observations',signed('observations',target,notOwner))).status,404);
  assert.deepEqual(await post('observations',signed('observations',target,keys)),{status:200,location:null,history:[]});
  assert.equal((await post('calculate',signed('calculate',{...target,calculation:{}},keys))).code,'ROUTING_UNAVAILABLE');
  await pool.query('UPDATE core_device_installations SET revoked_at=now() WHERE id=$1',[claimed.id]);
  assert.equal((await post('observations',signed('observations',target,keys))).status,404);
  assert.equal((await pool.query('SELECT count(*)::int n FROM customer_accounts')).rows[0].n,0);
});
