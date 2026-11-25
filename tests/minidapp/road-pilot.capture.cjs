/* Run with NODE_PATH pointing to the local Playwright installation. */
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { fixturePage, start, stop } = require('./fixture.cjs');

async function capture(directory, output) {
  const sites = JSON.parse(await fs.readFile(resolve(directory, 'samples.json'), 'utf8'));
  await fs.mkdir(output, { recursive: true });
  await start(undefined, {
    directory: resolve(directory, 'light'),
    darkDirectory: resolve(directory, 'dark'),
    maxZoom: 18,
    date: Object.values(sites).map(site => site.retrieved_kyiv_date).filter(Boolean).sort()[0]
  });
  try {
    for (const [name, site] of Object.entries(sites)) {
      for (const width of [1440, 390]) {
        const dark = width === 390;
        const { page, context } = await fixturePage(width, dark ? 'dark' : 'light', { location: site });
        try {
          await page.evaluate(() => { location.hash = 'map'; });
          await page.locator('#map-selection').selectOption({ label: 'Synthetic fixture sensor' });
          const client = await context.newCDPSession(page);
          await client.send('Performance.enable');
          const slow = dark && name === 'kyiv';
          if (slow) await client.send('Network.emulateNetworkConditions', {
            offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 90000
          });
          await page.evaluate(() => performance.clearResourceTimings());
          const started = performance.now();
          await page.getByRole('button', { name: 'Show on map' }).click();
          await page.getByRole('button', { name: 'Zoom in' }).click();
          const tail = '/road-tiles/' + (dark ? 'dark/' : '') + site['17'];
          const tile = page.locator('img[src$="' + tail + '"].leaflet-tile-loaded');
          await tile.waitFor();
          const tileReadyMs = Math.round(performance.now() - started);
          await page.locator('#workspace-map').press('Escape');
          const image = page.locator('#workspace-map');
          await image.evaluate(el => el.scrollIntoView({ block: 'center' }));
          await page.waitForFunction(() => [...document.querySelectorAll('#workspace-map img.leaflet-tile')]
            .every(img => img.complete));
          await image.screenshot({ path: resolve(output, name + '-' + width + '.png') });
          const viewport = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/road-tiles/'));
            const loaded = [...document.querySelectorAll('#workspace-map .leaflet-tile-loaded')];
            return {
              entries: entries.length,
              transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
              cachedResponses: entries.filter(entry => !entry.transferSize && entry.decodedBodySize).length,
              visibleDecodedTileMiB: loaded.reduce((sum, img) => sum + img.naturalWidth * img.naturalHeight * 4, 0) / 1048576
            };
          });
          await page.getByText('Geographic overview', {exact:true}).click();
          await page.evaluate(() => performance.clearResourceTimings());
          await page.getByText('Roads', {exact:true}).click();
          await tile.waitFor();
          let unmockedCache;
          if (name === 'kyiv' && width === 1440) {
            const url = await tile.evaluate(img => img.src);
            const clean = await context.browser().newPage();
            try {
              await clean.goto(new URL('/app/', url).href);
              unmockedCache = await clean.evaluate(async tileUrl => {
                const bytes = [];
                for (let i = 0; i < 2; i++) {
                  await (await fetch(tileUrl, { cache: 'force-cache' })).arrayBuffer();
                  bytes.push(performance.getEntriesByName(tileUrl).at(-1)?.transferSize ?? null);
                }
                return bytes;
              }, url);
            } finally {
              await clean.close();
            }
          }
          const {metrics} = await client.send('Performance.getMetrics');
          assert.equal(await page.getByRole('link', { name: 'OpenStreetMap contributors' }).count(), 1);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          console.log(JSON.stringify({
            name, width, slow, tileReadyMs, ...viewport, unmockedCache,
            jsHeapMiB: Math.round(metrics.find(metric => metric.name === 'JSHeapUsedSize').value / 104857.6) / 10
          }));
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await stop();
  }
}

const [directory, output] = process.argv.slice(2);
if (!directory || !output) throw new Error('Usage: node road-pilot.capture.cjs <pilot-directory> <screenshot-directory>');
capture(directory, output).catch(err => { console.error(err); process.exitCode = 1; });
