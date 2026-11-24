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
