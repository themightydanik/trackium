// Requires the disposable private Valhalla Compose stack from gateway-routing.yml.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const test = require('node:test');
const {chromium} = require('playwright');

function codeFor(email,purpose) {
  const script = `import {readdirSync,readFileSync} from 'node:fs';
    const dir=process.env.ACCOUNT_MAIL_DIRECTORY;
    const mail=readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(dir+'/'+f)));
    process.stdout.write(mail.find(m=>m.email===process.argv[1] && m.purpose===process.argv[2])?.code || '');`;
  return execFileSync('docker',['compose','exec','-T','gateway','node','--input-type=module','-e',script,email,purpose],
    {encoding:'utf8',timeout:15000});
}

test('real customer dispatcher previews private Valhalla geometry without writing B3', {timeout:90000}, async () => {
  const origin = 'http://127.0.0.1:' + (process.env.B2_GATEWAY_PORT || 55471);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    const password = 'disposable planner fixture ' + randomUUID();
    async function customer() {
      const page = await browser.newPage({viewport:{width:1280,height:900}});
      await page.goto(origin + '/app/');
      const email = randomUUID() + '@example.test';
      async function call(path,data) {
        const result = await page.evaluate(async ({path,data}) => {
          const headers = {'X-Trackium-Client':'cargo-v2'};
          if (data !== undefined) {
            const session = await fetch('/v1/account/session',{headers});
            const {csrf} = await session.json();
            if (csrf) headers['X-CSRF-Token'] = csrf;
            headers['Content-Type'] = 'application/json';
          }
          const res = await fetch(path,{method:data === undefined ? 'GET' : 'POST',headers,
            body:data === undefined ? undefined : JSON.stringify(data)});
          return {status:res.status,payload:await res.json()};
        },{path,data});
        return result;
      }
      assert.equal((await call('/v1/account/register',{email})).status,202);
      const code = codeFor(email,'verify');
      assert.ok(code);
      assert.equal((await call('/v1/account/verify',{code,password})).status,200);
      assert.equal((await call('/v1/account/login',{email,password})).status,200);
      return {page,email,call};
    }
    const owner = await customer();
    assert.equal((await owner.call('/v1/account/company',{name:'Disposable dispatcher planning'})).status,200);
    const device = await owner.call('/v1/account/device',{label:'Unbound planning fixture'});
    assert.equal(device.status,201);
    const shipment = await owner.call('/v1/shipments',{
      name:'Road planner acceptance',device_id:device.payload.id,
      route:[{name:'Origin',latitude:48,longitude:11.001},{name:'Destination',latitude:48,longitude:11.039}],
      conditions:{temperature_min_c:0,temperature_max_c:10}
    });
    assert.equal(shipment.status,201);
    const dispatcher = await customer();
    assert.equal((await owner.call('/v1/account/invite',{email:dispatcher.email,role:'dispatcher'})).status,200);
    const invitation = codeFor(dispatcher.email,'invite');
    assert.ok(invitation);
    assert.equal((await dispatcher.call('/v1/account/accept',{code:invitation})).status,200);
    const {page} = dispatcher;
    const shipmentPath = '/v1/shipments/' + shipment.payload.id;
    const history = await dispatcher.call(shipmentPath + '/road-routes');
    assert.equal(history.status,200);
    assert.deepEqual(history.payload.revisions,[]);
    const before = await dispatcher.call(shipmentPath);
    await page.reload();
    const writes = [];
    page.on('request',req => { if (!['GET','HEAD'].includes(req.method())) writes.push(new URL(req.url()).pathname); });
    await page.locator('.fleet-manifest-list button').filter({hasText:'Road planner acceptance'}).click();
    await page.getByRole('button',{name:'Plan from checkpoints'}).click();
    const calculated = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/routes/calculate');
    await page.getByRole('button',{name:'Calculate route'}).click();
    const response = await calculated;
    assert.equal(response.status(),200);
    const body = await response.json();
    assert.equal(body.graph.id,process.env.ROUTING_GRAPH_RELEASE_ID);
    assert.equal(body.graph.engine_version,'3.6.3');
    assert.equal(body.route.distance_m,2830);
    await page.getByRole('region',{name:'Calculated preview'}).waitFor();
    const line = page.locator('.planner-preview-line');
    await line.waitFor({state:'attached'});
    await page.getByRole('button',{name:'Fit preview'}).click();
    await page.waitForFunction(() => document.querySelector('.planner-preview-line')?.getBoundingClientRect().width > 20);
    assert.equal(await page.locator('.ux-device-position').count(),0);
    await page.getByRole('button',{name:'Return to fleet view'}).click();
    assert.deepEqual(await dispatcher.call(shipmentPath + '/road-routes'),history);
    assert.deepEqual(await dispatcher.call(shipmentPath),before);
    assert.deepEqual(writes,['/v1/routes/calculate']);
    await page.locator('#navigation a[href="#settings"]').click();
    await page.getByRole('button',{name:'Sign out'}).click();
    await page.getByRole('heading',{name:'Sign in to Trackium'}).waitFor();
    assert.equal(await page.locator('.fleet-planner').count(),0);
    console.log(JSON.stringify({distance_m:body.route.distance_m,engine:body.graph.engine_version,role:'dispatcher',revisions:0}));
  } finally { await browser.close(); }
});
