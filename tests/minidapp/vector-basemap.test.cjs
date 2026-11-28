const test = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { start, stop, fixture, fixturePage } = require('./fixture.cjs');

test('vector XYZ basemap renders locally, retains Leaflet state and falls back on network or WebGL failure', async () => {
  await start(undefined,null,{directory:join(__dirname,'vector-tiles-fixture'),release:'synthetic-m1'});
  try {
    const {page,context} = await fixturePage(390,'light',{
      customer:true,location:{latitude:50.4504,longitude:30.5236}
    });
    try {
      const map = page.locator('#workspace-map');
      const tile = new URL(page.url()).origin + '/app/assets/vector-tiles/synthetic-m1/15/19162/11049.pbf';
      const response = await page.request.get(tile);
      assert.equal(response.status(),200);
      assert.equal(response.headers()['content-type'],'application/vnd.mapbox-vector-tile');
      assert.equal(response.headers()['content-encoding'],'gzip');
      assert.equal((await page.request.get(tile.replace('synthetic-m1','wrong-release'))).status(),404);
      assert.equal((await page.request.get(tile.replace('19162','32768'))).status(),404);
      const coverage = await page.request.get(new URL('/app/assets/vector-tiles/synthetic-m1/coverage.json',page.url()).href);
      assert.equal(coverage.status(),200);
      assert.equal((await coverage.json()).maxZoom,15);
      assert.equal((await page.request.get(coverage.url().replace('coverage.json','manifest.json'))).status(),404);
      const focus = async () => {
        await page.locator('#map-selection').selectOption('device:'+fixture.registry.id);
        await page.getByRole('button',{name:'Show on map'}).click();
        await page.locator('.leaflet-popup-close-button').click();
      };
      const state = value => page.locator('#workspace-map[data-vector-state="'+value+'"]').waitFor();
      await focus();
      await state('partial');
      await map.evaluate(el => {window.m1State=[el,el.querySelector('.maplibregl-canvas'),
        el.querySelector('.leaflet-map-pane').style.transform];});
      await page.emulateMedia({colorScheme:'dark'});
      await state('partial');
      await page.locator('html').evaluate(el => { el.dataset.tcTheme = 'light'; });
      await state('partial');
      assert.ok(await map.evaluate(el => el === window.m1State[0] &&
        el.querySelector('.maplibregl-canvas') === window.m1State[1] &&
        el.querySelector('.leaflet-map-pane').style.transform === window.m1State[2]));
      assert.ok(await map.locator('.ux-device-position').count());
      assert.ok(await map.getByRole('link',{name:'OpenStreetMap contributors'}).count());

      const canvasesFit = () => page.waitForFunction(() => {
        const map = document.querySelector('#workspace-map');
        const canvas = map?.querySelector('.maplibregl-canvas');
        return canvas && Math.abs(canvas.clientWidth-map.clientWidth)<=1 &&
          Math.abs(canvas.clientHeight-map.clientHeight)<=1;
      });
      await page.getByRole('button',{name:'Full screen',exact:true}).click();
      await canvasesFit();
      await page.keyboard.press('Escape');
      await canvasesFit();
      assert.ok(await map.evaluate(el => el.querySelector('.maplibregl-canvas')===window.m1State[1]));

      await page.getByText('Geographic overview',{exact:true}).click();
      assert.equal(await map.locator('.maplibregl-canvas').count(),0);
      await page.route('**/vector-tiles/**',route=>route.abort('failed'));
      await page.getByText('Vector roads',{exact:true}).click();
      await state('fallback');
      assert.ok(await map.locator('.workspace-map-land').count());
      assert.ok(await map.locator('.ux-device-position').count());
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.unroute('**/vector-tiles/**');
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type,...args) {
          return type.startsWith('webgl') ? null : getContext.call(this,type,...args);
        };
      });
      await page.reload();
      await state('renderer-failure');
      assert.equal(await map.locator('.maplibregl-canvas').count(),0);
      assert.ok(await map.locator('.workspace-map-land').count());
    } finally { await context.close(); }
  } finally { await stop(); }
});
