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

test('real customer route lifecycle with private Valhalla and PostgreSQL', {timeout:120000}, async () => {
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
    const unchangedPaths = [shipmentPath + '/events',shipmentPath + '/proofs','/v1/devices/' + device.payload.id + '/location'];
    const unchanged = await Promise.all(unchangedPaths.map(path => dispatcher.call(path)));
    assert.ok(unchanged.every(response => response.status === 200));
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
    // Lose the response only after the server commits, then recover the same request UUID.
    const routePost = shipmentPath + '/road-routes';
    const writesToB3 = [];
    page.on('request',req => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === routePost)
        writesToB3.push(req.postDataJSON());
    });
    await page.evaluate(path => {
      const realFetch = window.fetch;
      let suppress = true;
      window.fetch = async (url,options) => {
        const response = await realFetch(url,options);
        if (suppress && new URL(url,location.href).pathname === path && options?.method === 'POST' && response.status === 201) {
          suppress = false;
          throw new TypeError('Fixture lost the committed response');
        }
        return response;
      };
    },routePost);
    async function confirm(tab, title) {
      const dialog = tab.locator('#route-confirmation');
      await dialog.getByRole('heading',{name:title,exact:true}).waitFor();
      await dialog.getByRole('button',{name:title,exact:true}).click();
    }
    async function preview(tab) {
      await tab.getByRole('button',{name:'Plan from checkpoints'}).click();
      await tab.getByRole('button',{name:'Calculate route'}).click();
      await tab.getByRole('region',{name:'Calculated preview'}).waitFor();
    }
    await preview(page);
    await page.getByRole('button',{name:'Propose route',exact:true}).click();
    await confirm(page,'Propose route');
    await page.getByText(/Proposal outcome unknown/).waitFor();
    await page.getByRole('button',{name:'Retry exact proposal'}).click();
    await confirm(page,'Retry proposal');
    await page.getByText('Existing proposal recovered.',{exact:true}).waitFor();
    assert.deepEqual(writesToB3[0],writesToB3[1]);
    assert.ok(writesToB3[0].request_id);
    assert.deepEqual(Object.keys(writesToB3[0].calculation).sort(),['destination','origin','profile','waypoints']);
    await page.getByText('v1 · Proposed',{exact:true}).first().waitFor();
    assert.equal(await page.getByRole('button',{name:'Approve v1'}).count(),0);
    const routes = shipmentPath + '/road-routes';
    const firstHistory = await dispatcher.call(routes);
    const [first] = firstHistory.payload.revisions;
    assert.equal(firstHistory.payload.generation,1);
    assert.equal(firstHistory.payload.active_revision_id,null);

    await owner.page.reload();
    await owner.page.locator('.fleet-manifest-list button').filter({hasText:'Road planner acceptance'}).click();
    await owner.page.getByRole('button',{name:'Approve v1'}).click();

    // Change history behind the confirmation dialog to force a stale approval.
    await page.getByRole('button',{name:'Return to fleet view'}).click();
    await page.getByRole('button',{name:'Plan from checkpoints'}).click();
    await page.getByLabel('Vehicle profile').selectOption('truck');
    for (const [label,value] of [['Height','3.9'],['Width','2.5'],['Length','16'],['Gross weight','35'],['Axle load','10']])
      await page.getByRole('textbox',{name:new RegExp(label)}).fill(value);
    await page.getByRole('button',{name:'Calculate route'}).click();
    await page.getByRole('region',{name:'Calculated preview'}).waitFor();
    await page.getByRole('button',{name:'Propose route',exact:true}).click();
    await confirm(page,'Propose route');
    await page.getByText('v2 · Proposed',{exact:true}).first().waitFor();
    assert.notEqual(writesToB3[0].request_id,writesToB3[2].request_id);
    await confirm(owner.page,'Approve revision');
    await owner.page.getByText(/Another operator changed/).waitFor();
    await owner.page.getByText('v2 · Proposed',{exact:true}).first().waitFor();
    await owner.page.getByRole('button',{name:'Approve v1'}).click();
    await confirm(owner.page,'Approve revision');
    await owner.page.getByRole('button',{name:'Activate v1'}).waitFor();
    assert.equal((await owner.call(routes + '/active')).payload.revision,null);
    await owner.page.getByRole('button',{name:'Activate v1'}).click();
    await confirm(owner.page,'Activate revision');
    await owner.page.getByText('v1 · Active',{exact:true}).first().waitFor();
    await owner.page.getByRole('button',{name:'Approve v2'}).click();
    await confirm(owner.page,'Approve revision');
    await owner.page.getByRole('button',{name:'Activate v2'}).waitFor();
    const ready = await owner.call(routes);
    assert.equal(ready.payload.generation,5);
    const second = ready.payload.revisions[0];
    assert.equal(second.profile,'truck');

    const admin = await customer();
    assert.equal((await admin.call('/v1/account/company',{name:'Disposable separate company'})).status,200);
    assert.equal((await admin.call(routes)).status,404);
    assert.equal((await owner.call('/v1/account/invite',{email:admin.email,role:'admin'})).status,200);
    assert.equal((await admin.call('/v1/account/accept',{code:codeFor(admin.email,'invite')})).status,200);
    await owner.page.getByRole('button',{name:'Activate v2'}).click();
    const activationDialog = owner.page.locator('#route-confirmation');
    await activationDialog.getByText(/Replace the active planning route v1/).waitFor();
    await activationDialog.getByText('Distance delta',{exact:true}).waitFor();
    await activationDialog.getByText(/Verify HGV restrictions/).waitFor();
    const activation = owner.page.waitForResponse(res => new URL(res.url()).pathname.endsWith('/'+second.id+'/activate'));
    const [,ownerResponse,adminResponse] = await Promise.all([
      confirm(owner.page,'Activate revision'),activation,
      admin.call(routes + '/' + second.id + '/activate',{expected_generation:ready.payload.generation})
    ]);
    assert.deepEqual([ownerResponse.status(),adminResponse.status].sort(),[200,409]);
    await owner.page.getByText('v2 · Active',{exact:true}).first().waitFor();
    await owner.page.getByText('v1 · Superseded',{exact:true}).first().waitFor();
    assert.equal((await owner.call(routes + '/active')).payload.active_revision_id,second.id);
    const old = await owner.call(routes + '/' + first.id);
    assert.equal(old.payload.generation,6);
    assert.deepEqual(old.payload.revision.audit.map(entry => entry.state),['proposed','approved','active','superseded']);
    assert.equal(old.payload.revision.calculation.route.distance_m,2830);
    assert.equal((await owner.call(routes + '/' + second.id)).payload.revision.audit.at(-1).state,'active');

    await owner.page.getByLabel('Base revision').selectOption(first.id);
    await owner.page.getByLabel('Target revision').selectOption(second.id);
    await owner.page.getByRole('button',{name:'Compare revisions'}).click();
    await owner.page.getByRole('region',{name:'Revision comparison'}).waitFor();
    assert.equal(await owner.page.locator('.route-comparison-base,.route-comparison-target').count(),2);
    assert.equal(await owner.page.locator('.fleet-road-line').count(),1);
    assert.deepEqual(await owner.call(shipmentPath),before);
    assert.deepEqual(await Promise.all(unchangedPaths.map(path => owner.call(path))),unchanged);
    assert.equal(await owner.page.locator('.ux-device-position').count(),0);

    // Existing persisted history remains readable after the routing service stops.
    execFileSync('docker',['compose','stop','valhalla'],{stdio:'ignore',timeout:30000});
    await owner.page.getByRole('button',{name:'Inspect v1'}).click();
    await owner.page.getByRole('region',{name:'Revision details'}).getByText('Audit timeline').waitFor();
    assert.deepEqual(await owner.call(routes + '/' + first.id),old);
    await owner.page.locator('#navigation a[href="#settings"]').click();
    await owner.page.getByRole('button',{name:'Sign out'}).click();
    await owner.page.getByRole('heading',{name:'Sign in to Trackium'}).waitFor();
    assert.equal(await owner.page.locator('.fleet-lifecycle,.route-comparison-base').count(),0);
    console.log(JSON.stringify({engine:body.graph.engine_version,role:'dispatcher',replayed:1,
      revisions:2,generation:6,activationStatuses:[ownerResponse.status(),adminResponse.status].sort(),historyOffline:true}));
  } finally { await browser.close(); }
});
