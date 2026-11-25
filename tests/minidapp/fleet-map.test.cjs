const assert = require('node:assert/strict');
const test = require('node:test');
const { join } = require('node:path');
const { fixturePage, fixture, start, stop } = require('./fixture.cjs');

const stops = [{latitude:51,longitude:17},{latitude:50.6,longitude:24},{latitude:50,longitude:30}];
function shape(points) {
  let previous = [0,0];
  return points.flatMap(point => {
    const next = [Math.round(point.latitude*1e6), Math.round(point.longitude*1e6)];
    const parts = next.map((value,i) => {
      const delta = value - previous[i];
      let bits = delta < 0 ? -2*delta-1 : 2*delta, result = '';
      while (bits >= 32) {
        result += String.fromCharCode(95 + bits%32);
        bits = Math.floor(bits/32);
      }
      return result + String.fromCharCode(63 + bits);
    });
    previous = next;
    return parts;
  }).join('');
}
const revision = {
  id:'browser-fixture-road-v2', state:'active', version:2, stops,
  calculation:{
    profile:'truck', graph:{id:'b'.repeat(64),engine_version:'3.6.3',osm_snapshot:'2026-01-01'},
    calculated_at:'2026-01-01T00:00:00Z', warnings:['STATIC_OSM_SNAPSHOT','HGV_RESTRICTIONS_MAY_BE_INCOMPLETE'],
    route:{geometry_format:'polyline6',distance_m:1120800,estimated_duration_s:36000,legs:[
      {shape:shape([stops[0],{latitude:51.2,longitude:20},stops[1]])},
      {shape:shape([stops[1],{latitude:50.8,longitude:27},stops[2]])}
    ]}
  }
};
const fleet = Array.from({length:25}, (_,i) => ({
  ...fixture.shipment,
  id:i ? '11111111-1111-4111-8111-' + String(i).padStart(12,'0') : fixture.shipment.id,
  name: i ? 'Synthetic cargo ' + String(i).padStart(2,'0') : 'Synthetic · Baltic cold chain',
  status: i % 2 ? 'draft' : 'active',
  route:stops.map((p,j) => ({latitude:p.latitude+i*.017,longitude:p.longitude+i*.04,name:['Origin','Transfer','Destination'][j]})),
  checkpoints:[]
}));

test('Fleet Map renders a bounded manifest, B3 legs, independent layers and stable camera', async () => {
  await start();
  try {
    for (const [width,theme] of [[1440,'dark'],[390,'light'],[320,'dark'],[768,'light']]) {
      const source = {customer:true,road:revision,fleet};
      const {page,context} = await fixturePage(width,theme,source);
      try {
        await page.getByRole('heading',{name:'Fleet Map'}).waitFor();
        assert.equal(await page.locator('.fleet-manifest-list button').count(),25);
        assert.equal(source.requests.filter(path => path.includes('/road-routes')).length,0);
        const filter = page.getByRole('combobox',{name:'Shipment status'});
        await filter.selectOption('draft');
        assert.equal(await page.locator('.fleet-manifest-list button').count(),12);
        await filter.selectOption('all');
        if (width === 768) {
          const map = page.locator('#workspace-map');
          await map.evaluate(node => { window.originalFleetMap = node; });
          await page.emulateMedia({colorScheme:'dark'});
          assert.ok(await map.evaluate(node => node === window.originalFleetMap));
          await page.emulateMedia({colorScheme:theme});
        }
        const search = page.getByRole('searchbox',{name:'Search shipments or devices'});
        await search.fill('Baltic');
        assert.equal(await page.locator('.fleet-manifest-list button').count(),1);
        const row = page.locator('.fleet-manifest-list button').first();
        const renderStart = await page.evaluate(() => performance.now());
        await row.press('Enter');
        await page.getByText('Active · v2',{exact:true}).waitFor();
        const renderMs = await page.evaluate(start => performance.now()-start,renderStart);
        if (process.env.TRACKIUM_FLEET_SCREENSHOTS) console.log(JSON.stringify({width,theme,shipments:25,markers:79,select_ms:Math.round(renderMs)}));
        await page.getByRole('button',{name:'Fit shipment'}).click();
        const map = page.locator('#workspace-map');
        const line = map.locator('.fleet-road-line');
        assert.equal(await line.count(),1);
        assert.equal((await line.getAttribute('d')).split('M').length-1,2);
        assert.equal(await map.locator('.fleet-road-stop').count(),3);
        assert.equal(await map.locator('.ux-route-stop').count(),75);
        assert.equal(await map.locator('.fleet-stale-fix').count(),1);
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        const decoded = await page.evaluate(rev => window.TrackiumComponents.roadGeometry(rev),revision);
        assert.deepEqual(decoded, [[[51,17],[51.2,20],[50.6,24]],[[50.6,24],[50.8,27],[50,30]]]);
        const malformed = structuredClone(revision);
        malformed.calculation.route.legs[1].shape = '~'.repeat(20);
        assert.equal(await page.evaluate(rev => window.TrackiumComponents.roadGeometry(rev),malformed),null);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.TRACKIUM_FLEET_SCREENSHOTS && [1440,390].includes(width)) {
          await search.fill('');
          await search.blur();
          for (const scheme of ['light','dark']) {
            await page.emulateMedia({colorScheme:scheme});
            await page.evaluate(() => scrollTo(0,0));
            await page.screenshot({path:join(process.env.TRACKIUM_FLEET_SCREENSHOTS,'fleet-'+scheme+'-'+width+'.png'),fullPage:true});
          }
          await page.emulateMedia({colorScheme:theme});
        }
        await page.getByRole('checkbox',{name:'Road route'}).uncheck();
        assert.equal(await line.count(),0);
        await page.getByRole('checkbox',{name:'Road route'}).check();
        const pane = map.locator('.leaflet-map-pane');
        await pane.evaluate(el => { window.fleetPane = [el,el.style.transform]; });
        const time = await page.locator('#lite-gateway-time').getAttribute('datetime');
        await page.waitForFunction(before => document.querySelector('#lite-gateway-time').dateTime !== before,time);
        assert.ok(await pane.evaluate(el => el === window.fleetPane[0] && el.style.transform === window.fleetPane[1]));
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        await page.getByRole('checkbox',{name:'Reported GPS'}).uncheck();
        assert.equal(await map.locator('.ux-device-position').count(),0);
        await page.getByRole('checkbox',{name:'Planned',exact:true}).uncheck();
        assert.equal(await map.locator('.ux-route-stop').count(),0);
        assert.ok(source.requests.every(path => !path.includes('/routes/calculate')));
        assert.deepEqual(source.errors || [],[]);
      } finally { await context.close(); }
    }
  } finally { await stop(); }
});

test('Fleet Map distinguishes missing, pending, unavailable and malformed geometry and clears on expiry', async () => {
  await start();
  try {
    for (const [override,message] of [
      [{},'No active road route.'],
      [{proposed:true},'Route revisions exist. No route is active.'],
      [{roadError:503},'Road route information is unavailable.'],
      [{road:{...revision, calculation:{...revision.calculation,route:{legs:[]}}}},'Road geometry unavailable.']
    ]) {
      const source = {customer:true,...override};
      const {page,context} = await fixturePage(390,'dark',source);
      try {
        const marker = page.locator('.ux-route-stop').first();
        await marker.press('Enter');
        await page.locator('.leaflet-popup').getByRole('button',{name:'Select shipment'}).click();
        await page.getByText(message,{exact:true}).waitFor();
        assert.equal(await page.locator('.fleet-road-line').count(),0);
        if (source.roadError) {
          source.roadError = null;
          source.road = revision;
          await page.getByRole('button',{name:'Retry route'}).click();
          await page.locator('.fleet-road-line').waitFor();
        }
        source.phase = 401;
        await page.locator('.connection-state').waitFor();
        assert.equal(await page.locator('#workspace-map').count(),0);
      } finally { await context.close(); }
    }
    const {page,context} = await fixturePage(320,'light',{customer:true,empty:true});
    try { await page.getByText('No shipments on this page.',{exact:true}).waitFor(); }
    finally { await context.close(); }
  } finally { await stop(); }
});
