const assert = require('node:assert/strict');
const test = require('node:test');
const {join} = require('node:path');
const {fixturePage,fixture,start,stop,openFleetExplorer} = require('./fixture.cjs');

function encode(points) {
  const previous = [0,0];
  return points.map(point => [point.latitude,point.longitude].map((coord,i) => {
    const value = Math.round(coord*1e6), delta = value-previous[i];
    previous[i] = value;
    let bits = delta < 0 ? -2*delta-1 : 2*delta, result = '';
    while (bits >= 32) { result += String.fromCharCode(95 + bits%32); bits = Math.floor(bits/32); }
    return result + String.fromCharCode(63+bits);
  }).join('')).join('');
}
function calculate(input) {
  const stops = [input.origin,...input.waypoints,input.destination];
  return {body:{profile:input.profile,graph:{id:'1'.repeat(64),engine_version:'3.6.3',osm_snapshot:'2026-01-01'},
    calculated_at:'2026-01-01T00:00:00Z', warnings:['COVERAGE_MAY_BE_INCOMPLETE'],
    route:{geometry_format:'polyline6',distance_m:1198840,estimated_duration_s:41200,
      legs:stops.slice(1).map((to,i) => ({
        shape:encode([stops[i],{latitude:(stops[i].latitude+to.latitude)/2+.02,
          longitude:(stops[i].longitude+to.longitude)/2},to]),
        maneuvers:[{instruction:'<<Continue safely>>'}]
      }))}}};
}
const checkpoints = [
  {name:'Wrocław',latitude:51.11,longitude:17.04},
  {name:'Transfer',latitude:50.59,longitude:24.05},
  {name:'Kyiv',latitude:50.45,longitude:30.52}
];
const activeRoad = {id:'stored-fixture-route',state:'active',version:4,stops:checkpoints,
  calculation:calculate({origin:checkpoints[0],waypoints:[checkpoints[1]],destination:checkpoints[2],profile:'auto'}).body};
const fleet = [{...fixture.shipment,route:checkpoints,checkpoints},
  {...fixture.shipment,id:'66666666-6666-4666-8666-666666666666',name:'Other fixture cargo'}];
const select = async (page,index=0) => {
  await openFleetExplorer(page);
  await page.locator('.fleet-manifest-list button').nth(index).click();
};
const open = async page => {
  await select(page);
  await page.getByRole('button',{name:'Plan from checkpoints'}).click();
};
test('dispatcher previews multi-leg road plans without changing the fleet at four viewports',async () => {
  await start();
  try {
    for (const [width,theme] of [[1440,'dark'],[768,'light'],[390,'light'],[320,'dark']]) {
      const calls=[];
      const source = {customer:true,role:'dispatcher',touch:width <= 390,fleet,road:activeRoad,
        calculate:input => { calls.push(input); return calculate(input); }};
      const {page,context} = await fixturePage(width,theme,source);
      try {
        const map = page.locator('#workspace-map');
        await map.evaluate(node => {window.plannerMap = node;});
        await open(page);
        assert.equal(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),'51.11');
        const origin = page.getByRole('textbox',{name:'Origin latitude'});
        await origin.fill('91');
        await page.getByRole('button',{name:'Calculate route'}).press('Enter');
        await page.getByText(/Origin: enter valid/).waitFor();
        assert.equal(calls.length,0);
        await origin.fill('51.12');
        await page.getByRole('textbox',{name:'Destination longitude'}).fill('30.6');
        await page.getByRole('button',{name:'Add waypoint'}).click();
        const second = page.getByRole('group',{name:'Waypoint 2'});
        await second.getByRole('textbox',{name:'Waypoint 2 latitude'}).fill('50.88');
        await second.getByRole('textbox',{name:'Waypoint 2 longitude'}).fill('26');
        await second.getByRole('button',{name:'Move up'}).click();
        assert.equal(await page.getByRole('textbox',{name:'Waypoint 1 latitude'}).inputValue(),'50.88');
        await second.getByRole('button',{name:'Remove waypoint'}).click();
        await page.getByLabel('Vehicle profile').selectOption('truck');
        await page.getByRole('button',{name:'Calculate route'}).click();
        await page.getByText(/Height \(m\): use/).waitFor();
        for (const [label,value] of [['Height','3.9'],['Width','2.5'],['Length','16'],['Gross weight','35'],['Axle load','10']])
          await page.getByRole('textbox',{name:new RegExp(label)}).fill(value);
        const before = await page.evaluate(() => performance.now());
        await page.getByRole('button',{name:'Calculate route'}).click();
        const result = page.getByRole('region',{name:'Calculated preview'});
        await result.waitFor();
        const ms = await page.evaluate(before => performance.now()-before,before);
        assert.equal(calls.length,1);
        assert.equal(calls[0].profile,'truck');
        assert.deepEqual(calls[0].waypoints,[{latitude:50.88,longitude:26}]);
        assert.equal(calls[0].destination.longitude,30.6);
        assert.equal(await map.locator('.planner-preview-stop').count(),3);
        assert.equal((await map.locator('.planner-preview-line').getAttribute('d')).split('M').length-1,2);
        assert.equal(await map.locator('.ux-device-position').count(),1);
        assert.equal(await map.locator('.fleet-road-line').count(),1);
        await page.getByRole('button',{name:'Fit preview'}).click();
        await result.getByText('Maneuvers',{exact:true}).click();
        await result.getByText('<<Continue safely>>',{exact:true}).first().waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.TRACKIUM_PLANNER_SCREENSHOTS && [1440,390].includes(width)) {
          console.log(JSON.stringify({width,theme,calculate_to_preview_ms:Math.round(ms)}));
          for (const scheme of ['light','dark']) {
            await page.emulateMedia({colorScheme:scheme});
            await page.evaluate(() => scrollTo(0,0));
            await page.screenshot({path:join(process.env.TRACKIUM_PLANNER_SCREENSHOTS,'planner-'+width+'-'+scheme+'.png'),fullPage:true});
          }
          await page.emulateMedia({colorScheme:theme});
        }
        await origin.fill('51.13');
        assert.equal(await map.locator('.planner-preview-line').count(),0);
        assert.ok(await map.evaluate(node => node === window.plannerMap));
        if (width === 390) {
          const destination = page.getByRole('group',{name:'Destination'});
          await destination.getByRole('button',{name:'Pick on map'}).tap();
          await map.tap({position:{x:120,y:130}});
          assert.notEqual(await page.getByRole('textbox',{name:'Destination longitude'}).inputValue(),'30.6');
        }
        if (width === 320) {
          for (let i=1;i<8;i++) await page.getByRole('button',{name:'Add waypoint'}).click();
          assert.ok(await page.getByRole('button',{name:'Add waypoint'}).isDisabled());
          assert.equal(await page.locator('.planner-stop').count(),10);
        }
        assert.equal(calls.length,1);
        if (width === 1440) {
          page.once('dialog',dialog => dialog.accept());
          await page.getByRole('button',{name:'Reset draft'}).click();
          assert.equal(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),'');
          await page.getByRole('group',{name:'Origin'}).getByRole('button',{name:'Pick on map'}).click();
          await map.press('Enter');
          assert.notEqual(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),'');
          page.once('dialog',dialog => dialog.accept());
          await page.getByRole('button',{name:'Return to fleet view'}).click();
          assert.equal(await page.locator('.fleet-planner').count(),0);
          assert.equal(await map.locator('.fleet-road-line').count(),1);
        }
      } finally { await context.close(); }
    }
  } finally { await stop(); }
});

test('draft identity discards late calculations and protects selection, role and session boundaries',{timeout:60000},async () => {
  await start();
  try {
    const requests=[];
    const source={customer:true,role:'dispatcher',fleet,calculate:input =>
      new Promise(resolve => requests.push({input,resolve}))};
    const {page,context}=await fixturePage(390,'dark',source);
    try {
      await open(page);
      const submit=page.getByRole('button',{name:'Calculate route'});
      await submit.click();
      await page.getByRole('button',{name:'Calculating…'}).waitFor();
      await page.locator('#fleet-planner-form').evaluate(form => form.requestSubmit());
      await page.getByRole('textbox',{name:'Origin latitude'}).fill('51.15');
      await submit.click();
      await page.waitForFunction(() => document.querySelector('#fleet-planner-form button[type=submit]').disabled);
      while (requests.length < 2) await new Promise(resolve => setTimeout(resolve,20));
      requests[1].resolve(calculate(requests[1].input));
      await page.getByRole('region',{name:'Calculated preview'}).waitFor();
      requests[0].resolve({status:503,body:{code:'ROUTING_UNAVAILABLE'}});
      assert.equal(requests.length,2);
      await page.getByRole('textbox',{name:'Origin latitude'}).fill('51.16');
      await submit.click();
      page.once('dialog',dialog => dialog.dismiss());
      await select(page,1);
      assert.equal(await page.locator('.fleet-manifest-list button').first().getAttribute('aria-pressed'),'true');
      page.once('dialog',dialog => dialog.accept());
      await select(page,1);
      assert.equal(await page.locator('#fleet-planner-form').count(),0);
      while (requests.length < 3) await new Promise(resolve => setTimeout(resolve,20));
      requests[2].resolve(calculate(requests[2].input));
      await page.getByRole('button',{name:'Start blank route'}).click();
      assert.equal(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),'');
      await page.getByRole('textbox',{name:'Origin latitude'}).fill('48');
      page.once('dialog',dialog => dialog.dismiss());
      await page.locator('#lite-bottom-nav a[href="#shipments"]').click();
      await page.waitForFunction(() => location.hash === '#map');
      assert.equal(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),'48');
      source.tenant = 'replacement-company';
      await page.getByRole('button',{name:'Refresh',exact:true}).click();
      await page.locator('.connection-state').waitFor();
      assert.equal(await page.locator('.fleet-planner').count(),0);
    } finally { await context.close(); }

    for (const [status,code,phrase] of [
      [422,'COVERAGE_UNAVAILABLE',/covered road/],[429,'ROUTING_RATE_LIMITED',/Wait a minute/],
      [503,'ROUTING_UNAVAILABLE',/Routing unavailable/],[504,'ROUTING_TIMEOUT',/timed out/],[403,'',/permission denied/]
    ]) {
      const source={customer:true,role:'dispatcher',fleet,calculate:() => ({status,body:{code}})};
      const {page,context}=await fixturePage(390,'light',source);
      try {
        await open(page);
        await page.getByRole('button',{name:'Calculate route'}).click();
        await page.getByText(phrase).waitFor();
        source.phase=401;
        await page.getByRole('button',{name:'Refresh',exact:true}).click();
        await page.locator('.connection-state').waitFor();
        assert.equal(await page.locator('.fleet-planner').count(),0);
      } finally { await context.close(); }
    }
    const {page:viewer,context:viewerContext}=await fixturePage(390,'light',{customer:true,role:'viewer',fleet,road:activeRoad});
    try {
      await select(viewer);
      assert.equal(await viewer.getByRole('button',{name:'Plan from checkpoints'}).count(),0);
      await viewer.getByText('Active · v4',{exact:true}).waitFor();
    } finally { await context.close(); }
  } finally { await stop(); }
});
