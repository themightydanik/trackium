const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, fixturePage } = require('./fixture.cjs');
test.before(() => start());
test.after(() => stop());
const routes = ['dashboard', 'shipments', 'devices', 'map', 'events', 'proofs', 'settings'];
async function navigate(page, route) {
  await page.evaluate((r) => (location.hash = r), route);
  await page.waitForFunction(
    (r) =>
      document.title.startsWith(
        {
          dashboard: 'Overview',
          shipments: 'Shipments',
          devices: 'Devices',
          map: 'Live Map',
          events: 'Events',
          proofs: 'Proofs',
          settings: 'Settings'
        }[r]
      ),
    route
  );
}
test('all routes: five viewports, Light/Dark/System, keyboard and 200% text', async () => {
  for (const width of [320, 390, 768, 1024, 1440])
    for (const scheme of ['light', 'dark', 'system']) {
      const { context, page } = await fixturePage(width, 'light');
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await navigate(page, 'settings');
      await page.selectOption('#appearance-theme', scheme);
      if (scheme === 'system') {
        await page.emulateMedia({ colorScheme: 'dark' });
        assert.equal(
          await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--tc-canvas').trim()
          ),
          '#0B1220'
        );
      }
      for (const route of routes) {
        await navigate(page, route);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          'overflow ' + width + ' ' + scheme + ' ' + route
        );
      }
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      for (const route of ['shipments', 'devices', 'proofs']) {
        await navigate(page, route);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          '200% text overflow ' + width + ' ' + route
        );
      }
      await navigate(page, 'devices');
      await page.getByRole('button', { name: 'Device details', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'Synthetic fixture sensor', exact: true }).waitFor();
      assert.equal(await page.locator('.ux-chart').count(), 3);
      await page.keyboard.press('Escape');
      assert.equal(
        await page
          .locator('[data-server-action=view-device]')
          .evaluate((e) => e === document.activeElement),
        true
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
});
test('existing cursor contract, filters and Back scroll retention', async () => {
  const source = {};
  const { context, page } = await fixturePage(1024, 'dark', source);
  await navigate(page, 'shipments');
  await page.selectOption('#server-sort', 'status');
  await page.selectOption('#server-order', 'desc');
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('heading', { name: 'Synthetic second page' }).waitFor();
  assert.ok(source.requests.some((p) => p.includes('cursor=next-fixture-page')));
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('heading', { name: 'Synthetic browser fixture · cold cargo' }).waitFor();
  await page.evaluate(() => scrollTo(0, 350));
  const y = await page.evaluate(() => scrollY);
  await navigate(page, 'devices');
  await page.goBack();
  await page.locator('#server-sort').waitFor();
  assert.equal(await page.locator('#server-sort').inputValue(), 'status');
  assert.equal(await page.locator('#server-order').inputValue(), 'desc');
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y) < 3);
  await context.close();
});
test('empty, unpaired, unauthorized, offline and expired states clear tenant evidence', async () => {
  for (const phase of [401, 403]) {
    const { context, page } = await fixturePage(390, 'light', { phase });
    await page.locator('#pair-tenant').waitFor();
    assert.equal(await page.locator('.ux-kpi').count(), 0);
    await context.close();
  }
  const empty = await fixturePage(320, 'light', { empty: true });
  await navigate(empty.page, 'shipments');
  await empty.page.getByRole('heading', { name: 'No matching shipments' }).waitFor();
  await empty.context.close();
  for (const scenario of ['offline', 'phase']) {
    const source = {};
    const { context, page } = await fixturePage(390, 'light', source);
    await navigate(page, 'devices');
    await page.getByRole('button', { name: 'Device details', exact: true }).click();
    if (scenario === 'offline') source.offline = true;
    else source.phase = 401;
    await page
      .getByRole('heading', {
        name: scenario === 'offline' ? 'Gateway unavailable' : 'Session expired',
        exact: true
      })
      .waitFor({ timeout: 12000 });
    assert.equal(await page.locator('#detail-dialog').evaluate((e) => e.open), false);
    assert.ok(
      !(await page.locator('#dialog-content').innerText()).includes('Synthetic fixture sensor')
    );
    assert.equal(await page.locator('.ux-kpi').count(), 0);
    await context.close();
  }
});
test('map stays local and uses geographic coordinates with measured-position labels', async () => {
  const { context, page } = await fixturePage(768, 'dark');
  const external = [];
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(page.url()).origin) external.push(r.url());
  });
  await navigate(page, 'map');
  await page.locator('.leaflet-interactive').first().waitFor();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.match(
    await page.locator('#main').innerText(),
    /last reported positions|last reported locations/i
  );
  assert.match(await page.locator('#main').innerText(), /Natural Earth/);
  assert.deepEqual(external, []);
  await context.close();
});
