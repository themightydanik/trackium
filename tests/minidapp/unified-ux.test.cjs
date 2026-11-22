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
