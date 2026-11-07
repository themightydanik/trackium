const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '../..');
const PORT = 4175;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const ARTIFACTS = process.env.TRACKIUM_SCREENSHOTS || '/tmp/trackium-minidapp-screenshots';
let browser, server;
async function ready() {
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('static server failed to start');
}
async function newPage(t, viewport = { width: 1440, height: 1080 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const errors = [],
    requests = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort()
  );
  t.after(async () => {
    assert.deepEqual(errors, [], 'no JavaScript runtime errors');
    await context.close();
  });
  return { context, page, requests };
}
async function demo(page) {
  await page.locator('#demo-toggle').click();
  await page.waitForFunction(
    () => document.querySelector('#main').getAttribute('aria-busy') === 'false'
  );
  assert.equal(await page.locator('#demo-toggle').getAttribute('aria-checked'), 'true');
}
async function go(page, route) {
  await page.goto(ORIGIN + '/#' + route);
}
async function navigate(page, route) {
  await page.locator('#navigation a[href="#' + route + '"]').click();
  await page.waitForFunction(
    (route) =>
      document.querySelector('#navigation a[aria-current="page"]').getAttribute('href') ===
      '#' + route,
    route
  );
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'no document-level horizontal overflow'
  );
}

test.before(async () => {
  server = spawn(
    'python3',
    ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT],
    { stdio: 'ignore' }
  );
  await ready();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});
test.after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

test('unpaired workspace stays empty, never falls back to demo and has no unauthenticated Gateway requests', async (t) => {
  const { page, requests } = await newPage(t);
  await page.goto(ORIGIN);
  assert.equal(await page.locator('#demo-toggle').getAttribute('aria-checked'), 'false');
  assert.equal(await page.locator('.shipment-row').count(), 0);
  assert.match(await page.locator('#main').innerText(), /Gateway not paired/);
  assert.equal(requests.filter((u) => new URL(u).pathname.startsWith('/v1/')).length, 0);
  await page.locator('a[href="#settings"]').first().click();
  await page.getByRole('button', { name: 'Check pairing support' }).click();
  assert.match(await page.locator('#profile-feedback').innerText(), /No request was sent/);
  assert.equal(await page.locator('input[type=password]').count(), 0);
  assert.equal(requests.filter((u) => new URL(u).pathname.startsWith('/v1/')).length, 0);
  assert.equal(await page.locator('#demo-toggle').getAttribute('aria-checked'), 'false');
});

test('desktop demo navigation, shipment/device details, chart, search, history filters and honest proofs', async (t) => {
  const { page, requests } = await newPage(t);
  await page.goto(ORIGIN);
  await demo(page);
  assert.equal(await page.locator('#demo-banner').isVisible(), true);
  assert.equal(await page.locator('.shipment-row').count(), 3);
  await page.locator('.shipment-row').first().click();
  assert.equal(await page.locator('#detail-dialog').isVisible(), true);
  assert.match(await page.locator('#dialog-content').innerText(), /NOT SAVED ON GATEWAY/);
  await page.locator('.linked-device').click();
  assert.match(await page.locator('#dialog-title').innerText(), /Cargo sensor/);
  assert.match(await page.locator('#dialog-content').innerText(), /Not published/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Humidity', exact: true }).click();
  assert.match(await page.locator('.chart-value').innerText(), /48/);
  await page.screenshot({
    path: path.join(ARTIFACTS, 'dashboard-desktop.png'),
    fullPage: true,
    animations: 'disabled'
  });
  const headings = {
    shipments: 'Every journey',
    devices: 'Know what',
    map: 'The bigger picture',
    events: 'The detail behind',
    proofs: 'Visibility is not',
    settings: 'Your Gateway'
  };
  for (const [route, title] of Object.entries(headings)) {
    await navigate(page, route);
    assert.match(await page.locator('h1').innerText(), new RegExp(title));
    await noOverflow(page);
  }
  await navigate(page, 'devices');
  await page.locator('#workspace-search').fill('sensor 02');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.locator('#workspace-search').fill('no such device');
  assert.match(await page.locator('#main').innerText(), /No matching devices/);
  await navigate(page, 'events');
  await page.locator('#event-filter').selectOption('alarm');
  assert.ok((await page.locator('tbody tr').count()) > 0);
  assert.ok(
    (await page.locator('tbody tr').allTextContents()).every(
      (text) => text.includes('Attention') && text.includes('Synthetic')
    )
  );
  await navigate(page, 'proofs');
  assert.match(await page.locator('#main').innerText(), /No transactions submitted/);
  assert.equal(await page.getByRole('button', { name: /publish|submit/i }).count(), 0);
  await page.locator('#exit-demo').click();
  assert.equal(await page.locator('#demo-banner').isVisible(), false);
  await navigate(page, 'devices');
  assert.equal(await page.locator('tbody tr').count(), 0);
  assert.equal(requests.filter((u) => new URL(u).pathname.startsWith('/v1/')).length, 0);
});

test('mobile navigation, keyboard escape, dialogs and all seven screens fit narrow viewports', async (t) => {
  const { page } = await newPage(t, { width: 390, height: 844 });
  await page.goto(ORIGIN);
  await demo(page);
  assert.ok(await page.locator('#sidebar').evaluate((el) => el.getBoundingClientRect().right <= 0));
  await page.screenshot({
    path: path.join(ARTIFACTS, 'dashboard-mobile.png'),
    fullPage: true,
    animations: 'disabled'
  });
  for (const route of [
    'shipments',
    'devices',
    'map',
    'events',
    'proofs',
    'settings',
    'dashboard'
  ]) {
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
    await navigate(page, route);
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    await noOverflow(page);
  }
  await page.locator('.shipment-row').first().click();
  assert.ok(await page.locator('#detail-dialog').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#detail-dialog').isVisible(), false);
  await page.locator('#menu-toggle').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
  await page.setViewportSize({ width: 320, height: 700 });
  await noOverflow(page);
  await page.goto(ORIGIN + '/#settings');
  await noOverflow(page);
});

test('settings reject secret-bearing URLs, store only non-secret profile and survive storage failure', async (t) => {
  const { page } = await newPage(t);
  await go(page, 'settings');
  for (const value of [
    'https://user:secret@example.com',
    'https://gateway.example.com?token=secret',
    'https://gateway.example.com/path'
  ]) {
    await page.locator('#gateway-origin').fill(value);
    await page.getByRole('button', { name: 'Save profile' }).click();
    assert.match(await page.locator('#profile-feedback').innerText(), /without credentials/);
    assert.equal(await page.evaluate(() => localStorage.getItem('trackium_v2_profile')), null);
  }
  await page.locator('#gateway-origin').fill('https://gateway.example.com');
  await page.getByRole('button', { name: 'Save profile' }).click();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('trackium_v2_profile'))),
    { mode: 'free', origin: 'https://gateway.example.com' }
  );
  await page.reload();
  assert.equal(await page.locator('#gateway-origin').inputValue(), 'https://gateway.example.com');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('trackium_v2_profile')), null);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new Error('storage disabled');
    };
  });
  await page.locator('#gateway-origin').fill('https://gateway.example.com');
  await page.getByRole('button', { name: 'Save profile' }).click();
  assert.match(await page.locator('#profile-feedback').innerText(), /could not be saved/);
});

test('actual bundled MDS SDK with mocked node makes read-only status calls; block updates never become cargo proofs', async (t) => {
  const { context, page } = await newPage(t);
  const commands = [];
  await context.route('**/mdscommand_/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (name === 'cmd') {
      commands.push(route.request().postData());
      return route.fulfill({ json: { status: true, response: { chain: { block: 4242 } } } });
    }
    if (name === 'megapoll')
      return route.fulfill({ json: { status: true, series: 1, counter: 0, response: [] } });
    return route.abort();
  });
  await page.goto(ORIGIN + '/?uid=0xabcd#settings');
  await page.waitForFunction(
    () => document.querySelector('#mds-state').textContent === 'Minima connected'
  );
  assert.match(await page.locator('.runtime-panel').innerText(), /4242/);
  assert.deepEqual(commands, ['status']);
  assert.match(await page.locator('a[href^="./legacy.html"]').getAttribute('href'), /uid=0xabcd/);
  await page.evaluate(() =>
    MDSPostMessage({ event: 'NEWBLOCK', data: { txpow: { header: { block: 4243 } } } })
  );
  assert.match(await page.locator('.runtime-panel').innerText(), /4243/);
  await navigate(page, 'proofs');
  assert.match(await page.locator('#main').innerText(), /No blockchain proofs published/);
  assert.ok(commands.every((c) => c === 'status'));
});

test('Local Core page is responsive and never invokes a wallet outside installed MDS', async (t) => {
  const {page}=await newPage(t,{width:390,height:844});
  await page.goto(ORIGIN+'/local-core.html');
  assert.match(await page.locator('h1').innerText(),/Local Core Publisher/);
  await page.getByRole('button',{name:'Connect to installed Core',exact:true}).click();
  assert.match(await page.locator('#status').innerText(),/inside the installed Core MiniDapp/);
  assert.equal(await page.locator('#consent').isChecked(),false);
  await page.getByRole('button',{name:'Prepare signed & mined checkpoint (does not broadcast)',exact:true}).click();
  assert.match(await page.locator('#status').innerText(),/Connect to installed Core first/);
  await noOverflow(page);
});
