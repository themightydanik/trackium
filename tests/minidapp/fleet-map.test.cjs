const assert = require('node:assert/strict');
const test = require('node:test');
const { join } = require('node:path');
const { fixturePage, fixture, start, stop, openFleetExplorer } = require('./fixture.cjs');

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

async function verifyMobileMap(page, width) {
  const map = page.locator('#workspace-map');
  const labels = await map.locator('.fleet-country-label').evaluateAll(nodes => nodes.map(node => {
    const {left,right,top,bottom} = node.getBoundingClientRect();
    return {left,right,top,bottom};
  }));
  assert.ok(labels.length >= 2 && labels.length <= 8, width + ' px should keep orientation without crowding');
  for (const [index,a] of labels.entries())
    for (const b of labels.slice(index+1))
      assert.ok(a.right+2 <= b.left || b.right+2 <= a.left || a.bottom+2 <= b.top || b.bottom+2 <= a.top);
  const marker = map.locator('.leaflet-fleetRoad-pane .fleet-road-stop').first();
  const overview = map.locator('.leaflet-fleetOverview-pane');
  const selected = map.locator('.leaflet-fleetPlan-pane');
  const important = await marker.evaluate(node => Number(getComputedStyle(node.closest('.leaflet-pane')).zIndex));
  assert.ok(important > await selected.evaluate(node => Number(getComputedStyle(node).zIndex)));
  assert.ok(await selected.evaluate(node => Number(getComputedStyle(node).zIndex)) >
    await overview.evaluate(node => Number(getComputedStyle(node).zIndex)));

  async function aboveNav(locator) {
    const result = await locator.evaluate(node => {
      node.scrollIntoView({block:'end'});
      const r = node.getBoundingClientRect();
      const top = document.querySelector('.lite-bottom-nav').getBoundingClientRect().top;
      return {gap:top-r.bottom,hit:node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};
    });
    assert.ok(result.gap >= 0 && result.hit, JSON.stringify({width,...result}));
    return result.gap;
  }
  const caption = page.locator('.fleet-map-canvas .map-caption');
  const directory = page.locator('.fleet-directory summary');
  const normalGap = await aboveNav(caption);
  await aboveNav(directory);
  await directory.tap();
  await aboveNav(page.locator('.fleet-directory').getByRole('button',{name:'Device details'}));
  await page.locator('.fleet-directory summary').tap();

  // Exercise the same CSS path used by env(safe-area-inset-bottom) with a known inset.
  await page.evaluate(() => document.documentElement.style.setProperty('--lite-safe-bottom','24px'));
  const safeGap = await aboveNav(caption);
  if (process.env.TRACKIUM_FLEET_SCREENSHOTS)
    await page.screenshot({path:join(process.env.TRACKIUM_FLEET_SCREENSHOTS,'fleet-safe-area-'+width+'.png')});
  const zoom = map.getByRole('button',{name:'Zoom in'});
  await aboveNav(zoom);
  await zoom.tap();
  assert.equal(await marker.count(),1);
  await map.getByRole('button',{name:'Zoom out'}).tap();
  await aboveNav(directory);
  await page.evaluate(() => document.documentElement.style.removeProperty('--lite-safe-bottom'));
  if (process.env.TRACKIUM_FLEET_SCREENSHOTS)
    console.log(JSON.stringify({width,labels:labels.length,normal_nav_gap_px:Math.round(normalGap),safe_nav_gap_px:Math.round(safeGap)}));
}

test('Fleet Map renders a bounded manifest, B3 legs, independent layers and stable camera', async () => {
  await start();
  try {
    for (const [width,theme] of [[1440,'dark'],[390,'light'],[320,'dark'],[768,'light']]) {
      const source = {customer:true,road:revision,fleet,touch:width <= 390};
      const {page,context} = await fixturePage(width,theme,source);
      try {
        await page.getByRole('heading',{name:'Fleet Map'}).waitFor();
        assert.equal(await page.locator('.fleet-manifest-list button').count(),25);
        assert.equal(source.requests.filter(path => path.includes('/road-routes')).length,0);
        const fleetMap = page.locator('#workspace-map');
        assert.equal(await fleetMap.locator('.leaflet-fleetOverview-pane .ux-route-stop').count(),75);
        await openFleetExplorer(page);
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
        const overview = map.locator('.leaflet-fleetOverview-pane');
        assert.ok(Number(await overview.evaluate(node => getComputedStyle(node).opacity)) <= .36);
        assert.equal(await overview.locator('.ux-route-stop').count(),72);
        assert.equal(await map.locator('.leaflet-fleetPlan-pane .ux-route-stop').count(),3);
        if (width <= 390) await verifyMobileMap(page,width);
        assert.equal(await map.locator('.fleet-stale-fix').count(),1);
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        const decoded = await page.evaluate(rev => window.TrackiumComponents.roadGeometry(rev),revision);
        assert.deepEqual(decoded, [[[51,17],[51.2,20],[50.6,24]],[[50.6,24],[50.8,27],[50,30]]]);
        const malformed = structuredClone(revision);
        malformed.calculation.route.legs[1].shape = '~'.repeat(20);
        assert.equal(await page.evaluate(rev => window.TrackiumComponents.roadGeometry(rev),malformed),null);
        malformed.calculation.route.legs[1].shape = shape(stops.slice(0,2));
        assert.equal(await page.evaluate(rev => window.TrackiumComponents.roadGeometry(rev),malformed),null);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.TRACKIUM_FLEET_SCREENSHOTS && [1440,390,320].includes(width)) {
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
        await pane.evaluate(el => {
          window.fleetPane = [el,el.style.transform,el.querySelector('.fleet-country-label')];
        });
        const time = await page.locator('#lite-gateway-time').getAttribute('datetime');
        await page.waitForFunction(before => document.querySelector('#lite-gateway-time').dateTime !== before,time);
        assert.ok(await pane.evaluate(el => el === window.fleetPane[0] &&
          el.style.transform === window.fleetPane[1] && el.querySelector('.fleet-country-label') === window.fleetPane[2]));
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        await page.getByRole('checkbox',{name:'Reported GPS'}).uncheck();
        assert.equal(await map.locator('.ux-device-position').count(),0);
        await page.getByRole('checkbox',{name:'Planned',exact:true}).uncheck();
        assert.equal(await map.locator('.ux-route-stop').count(),0);
        if (width === 390) {
          await page.setViewportSize({width: 320, height: 900});
          await page.evaluate(() => { location.hash = 'shipments'; });
          await page.getByRole('heading',{name:'Shipments',exact:true}).waitFor();
          await page.waitForTimeout(250); // Leaflet's resize moveend is debounced by 200 ms.
        }
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
    try { await openFleetExplorer(page); await page.getByText('No shipments on this page.',{exact:true}).waitFor(); }
    finally { await context.close(); }
  } finally { await stop(); }
});

test('selected physical history stays distinct from the latest fix and the active road', async () => {
  await start();
  try {
    const registry = {...fixture.registry,identity_kind:'physical',mode:'real'};
    const measured = new Date(Date.now()-2000).toISOString();
    const received = new Date().toISOString();
    const gps = {latitude:51.2,longitude:17};
    const sample = (extra, overrides = {}) => ({received_at:received,payload:{
      trust:'unverified',source:'aovx-gal-v1',device_id:registry.id,
      gps,device_measured_at:measured,extra,...overrides
    }});
    const source = {customer:true,registry,road:revision,
      physicalLocation:{trust:'unverified',gps,occurred_at:measured,received_at:received},
      physicalHistory:[sample({gnss_fix:true,buffered:true}),sample({gnss_fix:false}),
        sample({gnss_fix:true},{device_id:'foreign'}),sample({gnss_fix:true},{trust:'synthetic'})]};
    const {page,context} = await fixturePage(390,'dark',source);
    try {
      await page.evaluate(() => { location.hash = '#map'; });
      await openFleetExplorer(page);
      await page.locator('.fleet-manifest-list button').first().click();
      await page.locator('.fleet-road-line').waitFor();
      await page.locator('.fleet-gps-breadcrumb').waitFor();
      await page.getByRole('button',{name:'Edit active road as draft'}).click();
      assert.equal(await page.getByRole('textbox',{name:'Origin latitude'}).inputValue(),String(revision.stops[0].latitude));
      assert.equal(await page.locator('.fleet-road-line').count(),1);
      assert.equal(await page.locator('.fleet-gps-breadcrumb').count(),1);
      assert.equal(await page.locator('.ux-device-position').count(),1);
      await page.getByText(/Approximate distance from active road/).waitFor();
      await page.locator('[data-fleet-layer="observed"]').uncheck();
      assert.equal(await page.locator('.fleet-gps-breadcrumb, .ux-device-position').count(),0);
      assert.equal(await page.locator('.fleet-road-line').count(),1);
      source.physicalLocation = null;
      const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/devices/' + registry.id + '/location');
      await page.getByRole('button',{name:'Refresh',exact:true}).click();
      await refreshed;
      await page.locator('[data-fleet-layer="observed"]').check();
      await page.locator('.fleet-gps-breadcrumb').waitFor();
      await page.locator('.ux-device-position').waitFor({state:'detached'});
      await page.getByText(/Approximate distance from active road/).waitFor({state:'detached'});
      assert.equal(await page.locator('.fleet-road-line').count(),1);
    } finally { await context.close(); }
  } finally { await stop(); }
});

test('Fleet Map V3 panels and full screen keep one canvas and preserve selection', async () => {
  await start();
  try {
    for (const [width, theme] of [[1440,'light'],[1440,'dark'],[1024,'light'],[390,'light'],[390,'dark'],[320,'dark']]) {
      const source = {customer:true,road:revision,fleet,touch:width <= 390};
      const {page,context} = await fixturePage(width,theme,source);
      try {
        const mobile = width <= 390;
        if (width === 1024) await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
        const map = page.locator('#workspace-map');
        const explorer = page.locator('#fleet-toggle-explorer');
        const inspector = page.locator('#fleet-toggle-inspector');
        const fullscreen = page.locator('#fleet-toggle-map-canvas');
        const inspectorBody = page.locator('#fleet-inspector-body');
        const row = page.locator('.fleet-manifest-list button').first();
        const mapSize = () => map.evaluate(el => [el.offsetWidth,el.offsetHeight]);
        const capture = async state => {
          if (!process.env.TRACKIUM_FLEET_V3_SCREENSHOTS || width === 320 || width === 1024) return;
          await page.screenshot({path:join(process.env.TRACKIUM_FLEET_V3_SCREENSHOTS,
            state + '-' + theme + '.png')});
        };
        await map.evaluate(el => { window.v3Map = el; });
        assert.equal(await explorer.getAttribute('aria-expanded'),String(!mobile));
        await openFleetExplorer(page);
        await row.press('Enter');
        await page.locator('.fleet-road-line').waitFor();
        await page.getByRole('heading',{name:'Recent shipment events'}).waitFor();
        assert.ok(await map.locator('.fleet-pin svg').count());
        assert.ok(await map.locator('.fleet-checkpoint-icon svg').count());
        const initialSize = await mapSize();
        assert.ok(initialSize[0] >= 240, 'the map retains usable width with both panels open');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await explorer.click();
        assert.equal(await row.isVisible(),false);
        if (!mobile) {
          assert.ok((await mapSize())[0] > initialSize[0]);
          await explorer.click();
          await page.getByRole('button',{name:'Fit shipment'}).click();
          await page.evaluate(() => window.scrollTo(0,0));
          await capture('desktop');
        }
        await inspector.click();
        assert.equal(await inspectorBody.isVisible(),false);
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        if (mobile) {
          await page.evaluate(() => window.scrollTo(0,0));
          await capture('mobile-collapsed');
          await page.locator('.fleet-sheet-toggle').tap();
          assert.equal(await inspectorBody.isVisible(),true);
          await page.locator('.fleet-context').evaluate(el => el.scrollIntoView({block:'end'}));
          await capture('mobile-inspector');
        }
        await fullscreen.focus();
        await fullscreen.press('Enter');
        await page.getByRole('dialog',{name:'Fleet map canvas'}).waitFor();
        assert.equal(await fullscreen.getAttribute('aria-expanded'),'true');
        assert.ok((await mapSize())[0] >= initialSize[0]);
        await fullscreen.press('Shift+Tab');
        assert.ok(await map.evaluate(el => el.parentElement.contains(document.activeElement)));
        if (!mobile) await capture('desktop-full-screen');
        await page.keyboard.press('Escape');
        assert.equal(await fullscreen.getAttribute('aria-expanded'),'false');
        assert.ok(await map.evaluate(el => el === window.v3Map));
        assert.equal(await map.locator('.fleet-road-line').count(),1);
        assert.equal(await row.getAttribute('aria-pressed'),'true');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(source.requests.some(path => path.includes('/routes/calculate')),false);
        assert.deepEqual(source.errors || [],[]);
      } finally { await context.close(); }
    }
  } finally { await stop(); }
});
