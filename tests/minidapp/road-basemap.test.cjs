const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const test = require('node:test');
const { fixturePage, start, stop } = require('./fixture.cjs');

test('Lite layers use same-origin road imagery and preserve the viewport on polling', async () => {
  const directory = process.env.TRACKIUM_ROAD_TEST_TILES ||
    resolve(__dirname, '../../services/gateway/test/fixtures/road-tiles');
  await start(undefined, { directory, maxZoom: 17 });
  try {
    for (const width of [1440, 390]) {
      const { page, context } = await fixturePage(width, 'light', {
        location: { latitude: 52.5195, longitude: 13.4045 }
      });
      try {
        await page.evaluate(() => { location.hash = 'map'; });
        await page.locator('#map-selection').selectOption({ label: 'Synthetic fixture sensor' });
        await page.getByRole('button', { name: 'Show on map' }).click();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        const tile = page.locator('img[src$="/17/70416/42986.png"].leaflet-tile-loaded');
        await tile.waitFor();
        assert.ok(await tile.evaluate(img => img.naturalWidth === 256 && new URL(img.src).origin === location.origin));
        assert.equal(await page.getByRole('link', { name: 'OpenStreetMap contributors' }).count(), 1);
        const pane = page.locator('#workspace-map .leaflet-map-pane');
        await pane.evaluate(el => { window.roadReview = [el, el.style.transform]; });
        const previous = await page.locator('#lite-gateway-time').getAttribute('datetime');
        await page.waitForFunction(stamp => document.querySelector('#lite-gateway-time').dateTime !== stamp, previous);
        assert.ok(await pane.evaluate(el => el === window.roadReview[0] && el.style.transform === window.roadReview[1]));
        assert.ok(await tile.isVisible());
        if (process.env.TRACKIUM_ROAD_SCREENSHOTS) {
          await page.locator('#workspace-map').press('Escape');
          await pane.evaluate(el => el.closest('#workspace-map').scrollIntoView({ block: 'center' }));
          await page.locator('#workspace-map').screenshot({
            path: resolve(process.env.TRACKIUM_ROAD_SCREENSHOTS, 'berlin-' + width + '.png')
          });
        }
        await page.getByText('Geographic overview', { exact: true }).click();
        assert.equal(await tile.count(), 0);
        await page.getByText('Roads', { exact: true }).click();
        await tile.waitFor();
      } finally {
        await context.close();
      }
    }
  } finally {
    await stop();
  }
});

const samples = require('../../services/gateway/test/fixtures/road-tiles/europe-samples.json');
const tileRoot = resolve(__dirname, '../../services/gateway/test/fixtures/road-tiles');

async function openRoadMap(page) {
  await page.evaluate(() => { location.hash = 'map'; });
  await page.locator('#map-selection').selectOption({ label: 'Synthetic fixture sensor' });
}

async function focusStreet(page, site, style = '') {
  await page.getByRole('button', { name: 'Show on map' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const tile = page.locator('img[src$="road-tiles/' + style + site['17'] + '"].leaflet-tile-loaded');
  await tile.waitFor();
  return tile;
}

test('same map moves through Kyiv, the Ukrainian–Polish border, and Warsaw, with a separate dark source', async () => {
  const source = { location: samples.kyiv };
  await start(undefined, { directory: tileRoot, darkDirectory: resolve(tileRoot, 'dark'), maxZoom: 17, date: '2026-11-25' });
  try {
    const { page, context } = await fixturePage(390, 'light', source);
    try {
      await openRoadMap(page);
      await focusStreet(page, samples.kyiv);
      await page.getByText(/Dataset date: 2026-11-25/).waitFor();
      const map = page.locator('#workspace-map');
      await map.evaluate(el => { window.coverageMap = el; });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.locator('img[src$="road-tiles/dark/' + samples.kyiv['17'] + '"].leaflet-tile-loaded').waitFor();
      await page.locator('.fleet-directory summary').click();
      for (const site of [samples['shehyni-medyka'], samples.warsaw]) {
        source.location = site;
        await page.getByText(String(site.longitude), { exact: true }).waitFor();
        await focusStreet(page, site, 'dark/');
        assert.ok(await map.evaluate(el => el === window.coverageMap));
      }
      await page.route('**/road-tiles/**', route => route.abort('failed'));
      await page.getByRole('button', { name: 'Zoom out' }).click();
      await page.locator('.leaflet-tile:not(.leaflet-tile-loaded)').first().waitFor({ state: 'attached' });
      assert.ok(await map.locator('.leaflet-trackiumGeography-pane svg path').count() > 0);
      assert.equal(await page.getByRole('link', { name: 'OpenStreetMap contributors' }).count(), 1);
    } finally {
      await context.close();
    }
  } finally {
    await stop();
  }
});
