const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
let server, browser, origin;
const id = '11111111-1111-4111-8111-111111111111';
const deviceId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const proofId = '44444444-4444-4444-8444-444444444444';
const fixture = {
  shipment: { id, name: 'Synthetic browser fixture · cold cargo', device_id: deviceId, source_trust: 'synthetic', status: 'active', conditions: { temperature_min_c: 2, temperature_max_c: 8, tolerance_c: 1 }, route: [{name:'Start',latitude:51,longitude:17},{name:'Destination',latitude:50,longitude:30}], checkpoints: [{name:'Start',latitude:51,longitude:17,visited_at:null,source_trust:'synthetic'}] },
  registry: {id:deviceId,label:'Synthetic fixture sensor',identity_kind:'simulator',mode:'synthetic',enabled:true},
  event: {id:eventId,shipment_id:id,event_type:'temperature_excursion',event_time:'2026-01-01T00:00:00Z',source_trust:'synthetic',sha256:'a'.repeat(64),outbox_state:'delivered'},
  proof: {id:proofId,shipment_id:id,sequence:1,state:'submitted',mode:'test',publisher_kind:'server',wire:'TRACKIUMPROOF1'+ 'b'.repeat(64),confirmations:0,required_depth:3,txpow_id:null,commitment:{event_type:'temperature_excursion',source_trust:'synthetic'}}
};
async function fixturePage(width = 1440, scheme = 'light') {
  const context = await browser.newContext({viewport:{width,height:1000},colorScheme:scheme});
  await context.route('**/v1/**', async route => {
    const p = new URL(route.request().url()).pathname;
    let data;
    if(p==='/v1/session')data={tenant_id:'synthetic-browser-fixture',audience:'test-only',expires_at:'2099-01-01T00:00:00Z',scopes:['read','shipments'],csrf:'test-only',simulation_enabled:false};
    else if(p==='/v1/shipments')data={shipments:[fixture.shipment]};
    else if(p===`/v1/shipments/${id}`)data=fixture.shipment;
    else if(p===`/v1/shipments/${id}/events`)data={events:[fixture.event]};
    else if(p===`/v1/shipments/${id}/proofs`)data={proofs:[fixture.proof],engine_mode:'test'};
    else if(p==='/v1/devices')data={devices:[fixture.registry]};
    else if(p.endsWith('/status'))data={status:'unknown',last_event_at:'2026-01-01T00:00:00Z',mode:'synthetic'};
    else if(p.endsWith('/location'))data={location:{gps:{latitude:51,longitude:17},occurred_at:'2026-01-01T00:00:00Z',trust:'synthetic'}};
    else if(p===`/v1/devices/${deviceId}/events`)data={events:[{occurred_at:'2026-01-01T00:00:00Z',payload:{temperature_c:0,humidity_pct:null,battery_pct:50,trust:'synthetic'}}]};
    else if(p==='/v1/simulations')data={simulations:[]};
    else if(p==='/v1/proof-publisher')data={enabled:false,pending_events:[],policy:null,signer_fingerprint:'test-only'};
    else throw new Error('Unexpected UI API: '+p);
    await route.fulfill({json:data});
  });
  const page=await context.newPage();
  await page.goto(origin+'/app/');
  await page.locator('.ux-kpi').first().waitFor();
  return {context,page};
}
test.before(async()=>{
  server=http.createServer(async(req,res)=>{
    let name=new URL(req.url,'http://local').pathname.replace(/^\/app\//,'/');if(name==='/')name='/index.html';
    const file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(404).end();return;}
    try{const content=await fs.readFile(file);res.setHeader('content-type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html');res.end(content);}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
});
test.after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
test('authenticated seven-page UI uses DS1 themes and truthful structured evidence at compact/desktop sizes',async()=>{
  for(const width of [390,1440]){
    const {context,page}=await fixturePage(width);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const route of ['dashboard','shipments','devices','map','events','proofs','settings']){
      await page.evaluate(r=>location.hash=r,route);
      await page.locator('h1').waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+route);
    }
    await page.selectOption('#appearance-theme','dark');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.tcTheme),'dark');
    await page.evaluate(()=>location.hash='devices');
    await page.getByRole('button',{name:'Device details',exact:true}).click();
    assert.match(await page.locator('#dialog-content').innerText(),/0 °C/);
    assert.match(await page.locator('#dialog-content').innerText(),/Not reported/);
    assert.equal(await page.locator('#dialog-content details').getAttribute('open'),null);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#main').innerText(),/synthetic/);
    assert.deepEqual(errors,[]);await context.close();
  }
});
test('poll refresh preserves public drafts, focused search and structured route editing',async()=>{
  const {context,page}=await fixturePage();
  await page.evaluate(()=>location.hash='shipments');
  await page.locator('#server-search').fill('cold');
  await page.waitForTimeout(3300);
  assert.equal(await page.locator('#server-search').inputValue(),'cold');
  assert.equal(await page.locator('#server-search').evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Create shipment',exact:true}).click();
  assert.equal(await page.locator('[data-route-stop]').count(),2);
  await page.getByRole('button',{name:'Add route stop'}).click();
  assert.equal(await page.locator('[data-route-stop]').count(),3);
  await page.locator('[data-route-remove]').last().click();
  assert.equal(await page.locator('[data-route-stop]').count(),2);
  assert.equal(await page.locator('[name=route]').count(),0,'route JSON is no longer the primary form');
  await context.close();
});
