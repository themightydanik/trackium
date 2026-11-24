const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, fixturePage } = require('./fixture.cjs');
test.before(() => start());
test.after(() => stop());
test('authenticated seven-page UI uses DS1 themes and truthful structured evidence at compact/desktop sizes', async () => {
  for (const width of [390, 1440]) {
    const { context, page } = await fixturePage(width);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const route of [
      'dashboard',
      'shipments',
      'devices',
      'map',
      'events',
      'proofs',
      'settings'
    ]) {
      await page.evaluate((r) => (location.hash = r), route);
      await page.locator('h1').waitFor();
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'no page overflow ' + route
      );
    }
    await page.selectOption('#appearance-theme', 'dark');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.tcTheme), 'dark');
    await page.evaluate(() => (location.hash = 'devices'));
    await page.getByRole('button', { name: 'Device details', exact: true }).click();
    assert.match(await page.locator('#dialog-content').innerText(), /0 °C/);
    assert.match(await page.locator('#dialog-content').innerText(), /Not reported/);
    assert.equal(await page.locator('#dialog-content details').getAttribute('open'), null);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#main').innerText(), /synthetic/);
    assert.deepEqual(errors, []);
    await context.close();
  }
});
test('poll refresh preserves public drafts, focused search and structured route editing', async () => {
  const { context, page } = await fixturePage();
  await page.evaluate(() => (location.hash = 'shipments'));
  await page.locator('#server-search').fill('cold');
  await page.waitForTimeout(3300);
  assert.equal(await page.locator('#server-search').inputValue(), 'cold');
  assert.equal(
    await page.locator('#server-search').evaluate((e) => e === document.activeElement),
    true
  );
  await page.getByRole('button', { name: 'Create shipment', exact: true }).click();
  assert.equal(await page.locator('[data-route-stop]').count(), 2);
  await page.getByRole('button', { name: 'Add route stop' }).click();
  assert.equal(await page.locator('[data-route-stop]').count(), 3);
  await page.locator('[data-route-remove]').last().click();
  assert.equal(await page.locator('[data-route-stop]').count(), 2);
  assert.equal(
    await page.locator('[name=route]').count(),
    0,
    'route JSON is no longer the primary form'
  );
  await context.close();
});

test('Core keeps native publisher controls while Lite exposes native proof history read-only', async () => {
  const settings = { integritas: true, publisherKind: 'local', publisherEnabled: true,
    scopes: ['read', 'shipments', 'publish'] };
  const core = await fixturePage(1440, 'light', { ...settings, nativeWorkspace: true });
  const lite = await fixturePage(1440, 'light', { ...settings });
  try {
    await core.page.locator('#navigation a[href="#proofs"]').click();
    await core.page.getByText('Advanced publisher policy & Local Core exchange').click();
    await core.page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await core.page.locator('#native-publisher-controls[open]').waitFor();
    assert.ok(await core.page.getByRole('button', { name: 'Check Core / wallet readiness' }).isEnabled());
    assert.ok(await core.page.getByRole('button', { name: 'Import exchange & download acknowledgement' }).isEnabled());
    const download = core.page.waitForEvent('download');
    await core.page.getByRole('button', { name: 'Export Local Core job' }).click();
    assert.match((await download).suggestedFilename(), /^trackium-local-job-.*\.json$/);
    assert.equal(await core.page.getByText('Integritas proofs', { exact: true }).count(), 0);

    await lite.page.locator('#navigation a[href="#proofs"]').click();
    await lite.page.getByText('Native Minima proof history · read-only').waitFor();
    await lite.page.getByText('No Integritas proofs', { exact: true }).waitFor();
    assert.equal(await lite.page.getByRole('button', { name: 'Verify', exact: true }).count(), 1);
    assert.equal(await lite.page.getByRole('button', { name: 'Export bundle' }).count(), 1);
    assert.equal(await lite.page.getByRole('button', { name: 'Export Local Core job' }).count(), 0);
    assert.equal(await lite.page.locator('#local-exchange-form').count(), 0);
  } finally {
    await core.context.close();
    await lite.context.close();
  }
});

test('quiet snapshots retain map viewport, popup, focused filter and open details across updates', async () => {
  const source = {};
  const { context, page } = await fixturePage(1440, 'dark', source);
  try {
    await page.evaluate(() => { location.hash = 'shipments'; });
    const search = page.locator('#server-search');
    await search.fill('cold');
    const checkTime = async () => {
      const previous = await page.locator('#lite-gateway-time').getAttribute('datetime');
      await page.waitForFunction(prior => document.querySelector('#lite-gateway-time').dateTime !== prior, previous);
    };
    await search.evaluate(node => { window.pollSearch = node; window.filterTop = node.getBoundingClientRect().top; });
    await checkTime();
    await checkTime();
    assert.ok(await search.evaluate(node => node === window.pollSearch &&
      node === document.activeElement && node.getBoundingClientRect().top === window.filterTop));
    assert.equal(await search.inputValue(), 'cold');
    assert.equal(await page.getByText('Refreshing…', { exact: true }).count(), 0);

    await page.evaluate(() => { location.hash = 'map'; });
    const selection = page.locator('#map-selection');
    await selection.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Show on map' }).click();
    const map = page.locator('#workspace-map');
    await map.locator('.leaflet-popup').waitFor();
    await map.evaluate(node => {
      window.retainedMap = node;
      window.retainedMapTransform = node.querySelector('.leaflet-map-pane').style.transform;
    });
    const selectedRecord = await selection.inputValue();
    source.shipmentName = 'Cold cargo after update';
    await map.locator('.leaflet-popup').getByText('Planned route · Cold cargo after update').waitFor();
    assert.equal(await selection.inputValue(), selectedRecord);
    assert.ok(await map.evaluate(node => node === window.retainedMap &&
      node.querySelector('.leaflet-map-pane').style.transform === window.retainedMapTransform));
    await map.getByRole('button', { name: 'Shipment details' }).click();
    const dialog = page.locator('#detail-dialog');
    await dialog.getByRole('heading', { name: 'Cold cargo after update' }).waitFor();
    await checkTime();
    assert.equal(await dialog.evaluate(node => node.open), true);
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const requestCount = source.requests.length;
    await page.waitForTimeout(3200);
    assert.equal(source.requests.length, requestCount);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await checkTime();

    await context.setOffline(true);
    await page.getByText('Offline', { exact: true }).first().waitFor();
    assert.equal(await page.locator('#workspace-map').count(), 0);
    await context.setOffline(false);
    await page.locator('#workspace-map').waitFor();
    await page.getByText('Gateway snapshot', { exact: true }).first().waitFor();
  } finally {
    await context.close();
  }
});
