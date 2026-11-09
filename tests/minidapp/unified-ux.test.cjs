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
