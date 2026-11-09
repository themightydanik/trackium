const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const pg = require('../../services/gateway/node_modules/pg');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const DB = process.env.TEST_DATABASE_URL;
if (!DB) throw new Error('TEST_DATABASE_URL required');
async function port() {
  const s = net.createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function until(check, ms = 12000) {
  const end = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > end) throw new Error('condition timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}
test(
  'Browser → real owner pairing → server simulation → PostgreSQL → shipment history → MiniDapp',
  { timeout: 45000 },
  async (t) => {
    const schema = 'cargo_browser_' + randomUUID().replaceAll('-', ''),
      admin = new pg.Pool({ connectionString: DB });
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({ connectionString: DB, options: '-c search_path=' + schema });
    const http = await port(),
      tcp = await port(),
      origin = 'http://127.0.0.1:' + http;
    const env = {
      ...process.env,
      DATABASE_URL: DB,
      PGOPTIONS: '-c search_path=' + schema,
      HTTP_PORT: String(http),
      TCP_PORT: String(tcp),
      PUBLIC_ORIGIN: origin,
      WEB_ROOT: ROOT,
      ENABLE_WEB_WORKSPACE: 'true',
      ENABLE_SERVER_SIMULATOR: 'true',
      PROOF_MODE: 'test'
    };
    let child,
      browser,
      logs = '';
    const start = async () => {
      child = spawn(process.execPath, ['src/server.js'], {
        cwd: path.join(ROOT, 'services/gateway'),
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', (b) => (logs += b));
      child.stderr.on('data', (b) => (logs += b));
      await until(async () => {
        try {
          return (await fetch(origin + '/readyz')).ok;
        } catch {
          return false;
        }
      });
    };
    const stop = async () => {
      if (child && child.exitCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGTERM');
        await exited;
      }
    };
    t.after(async () => {
      if (browser) await browser.close();
      await stop();
      await db.end();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    });
    await start();
    for (const asset of ['mark.png', 'app-32.png', 'site.webmanifest']) {
      const response = await fetch(origin + '/app/assets/v2/brand/' + asset);
      assert.equal(response.status, 200, 'approved brand asset is served');
      assert.match(response.headers.get('content-type'), asset.endsWith('.png') ? /image\/png/ : /manifest\+json/);
    }
    assert.equal((await fetch(origin + '/app/assets/v2/brand/private.txt')).status, 404);
    // Issue owner credential in the trusted test process, never inside Chromium.
    const { provisionTenant } = await import(
      path.join(ROOT, 'services/gateway/src/telemetry/service.js')
    );
    const owner = await provisionTenant(db, 'Browser owner');
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
      headless: true
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
      page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [],
      authHeaders = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      authHeaders.push(Boolean(r.headers().authorization));
    });
    await page.goto(origin + '/app/#settings');
    await page.locator('#pair-tenant').fill(owner.tenant_id);
    await page.getByRole('button', { name: 'Create one-use challenge' }).click();
    await page.waitForSelector('#pair-challenge');
    const id = await page.locator('#pair-challenge').innerText();
    const approval = await fetch(origin + '/v1/pairing/challenges/' + id + '/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + owner.token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ scopes: ['read', 'shipments', 'simulate'] })
    });
    assert.equal(approval.status, 200);
    await page.getByRole('button', { name: 'Check owner approval' }).click();
    await page.waitForSelector('#server-banner:not([hidden])');
    const cookies = await context.cookies();
    assert.ok(
      cookies.some((c) => c.name === 'trk_session' && c.httpOnly && c.sameSite === 'Strict')
    );
    assert.equal(await page.evaluate(() => document.cookie), '');
    assert.ok(!(await page.content()).includes(owner.token));
    assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes(owner.token));
    await page.locator('#navigation a[href="#devices"]').click();
    await page.getByRole('button', { name: 'Create simulator identity' }).click();
    await page.waitForFunction(
      () => document.querySelector('tbody')?.textContent.includes('Server simulator 1'),
      null,
      { timeout: 5000 }
    );
    await page.locator('#navigation a[href="#shipments"]').click();
    await page.getByRole('button', { name: 'Create shipment', exact: true }).click();
    await page.locator('#server-shipment-form input[name=name]').fill('Browser cargo');
    await page.getByRole('button', { name: 'Save draft on Gateway' }).click();
    await page.waitForSelector('.server-shipment');
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await page.getByRole('button', { name: 'Start temperature excursion' }).click();
    await until(
      async () => Number((await db.query('SELECT step FROM cargo_simulations')).rows[0]?.step) >= 1
    );
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await until(
      async () =>
        (await db.query('SELECT state FROM cargo_simulations')).rows[0]?.state === 'paused'
    );
    const cursor = (await db.query('SELECT step FROM cargo_simulations')).rows[0].step;
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    // Restart the actual server during an active durable run. Cookie audience/port is stable.
    await stop();
    await start();
    await page.reload();
    await page.waitForSelector('.server-shipment');
    assert.ok((await db.query('SELECT step FROM cargo_simulations')).rows[0].step >= cursor);
    await until(
      async () =>
        (await db.query('SELECT status FROM cargo_shipments')).rows[0]?.status === 'delivered'
    );
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Complete shipment' }).click();
    await until(
      async () =>
        (await db.query('SELECT status FROM cargo_shipments')).rows[0]?.status === 'completed'
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM telemetry_events WHERE source='simulator-v1' AND trust='synthetic'"
        )
      ).rows[0].count,
      '5'
    );
    assert.equal(
      (await db.query("SELECT count(*) FROM cargo_events WHERE event_type='checkpoint_reached'"))
        .rows[0].count,
      '2'
    );
    assert.ok(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM cargo_events WHERE event_type='temperature_violation'"
          )
        ).rows[0].count
      ) > 0
    );
    assert.equal(
      (await db.query("SELECT count(*) FROM cargo_events WHERE source_trust<>'synthetic'")).rows[0]
        .count,
      '0'
    );
    await page.locator('#navigation a[href="#map"]').click();
    await page
      .getByRole('region', {
        name: 'Geographic routes and last reported positions'
      })
      .waitFor();
    assert.match(await page.locator('#main').innerText(), /30.52/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#navigation a[href="#events"]').click();
    await page.waitForFunction(() =>
      document.querySelector('.ux-timeline')?.textContent.includes('checkpoint_reached')
    );
    assert.match(await page.locator('#main').innerText(), /synthetic/);
    await page.locator('#navigation a[href="#proofs"]').click();
    await until(
      async () =>
        Number(
          (await db.query("SELECT count(*) FROM cargo_proofs WHERE mode='test'")).rows[0].count
        ) > 0
    );
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Verify', exact: true }).first().waitFor();
    assert.match(await page.locator('#main').innerText(), /No blockchain TXID/);
    await page.getByRole('button', { name: 'Verify', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Fresh node verification' }).waitFor();
    assert.match(await page.locator('#detail-dialog').innerText(), /TEST_ONLY_NOT_BLOCKCHAIN/);
    await page.locator('#detail-dialog [data-action=close-dialog]').click();
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export bundle', exact: true }).first().click();
    const download = await downloadReady;
    assert.match(download.suggestedFilename(), /^trackium-proof-.*\.json$/);
    const bundle = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'));
    assert.equal(bundle.proof.mode, 'test');
    assert.equal(bundle.proof.txpow_id, null);
    assert.ok(bundle.records.every((r) => r.source_trust === 'synthetic'));
    assert.ok(!JSON.stringify(bundle).includes(owner.token));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Static Preview is still an explicitly selected, isolated data source.
    await page.locator('#demo-toggle').click();
    await page.waitForSelector('.proof-pipeline');
    assert.equal(await page.locator('#server-banner').isVisible(), false);
    await page.locator('#exit-demo').click();
    // A disconnected Gateway must clear loaded tenant data, not call it live.
    await stop();
    await page.waitForFunction(() =>
      document.querySelector('#main').textContent.includes('Gateway unavailable')
    );
    assert.equal(await page.locator('.server-shipment').count(), 0);
    await start();
    await page.reload();
    await page.waitForSelector('#server-banner:not([hidden])');
    await page.locator('#navigation a[href="#settings"]').click();
    await page.getByRole('button', { name: 'Disconnect and revoke' }).click();
    await page.waitForSelector('#pair-tenant');
    assert.equal(
      (await db.query('SELECT count(*) FROM cargo_sessions WHERE revoked_at IS NOT NULL')).rows[0]
        .count,
      '1'
    );
    assert.equal((await context.cookies()).filter((c) => c.name === 'trk_session').length, 0);
    assert.ok(
      authHeaders.every((v) => !v),
      'no owner Authorization header in Chromium'
    );
    assert.deepEqual(errors, []);
    assert.ok(!logs.includes(owner.token), 'no owner credential in server logs');
  }
);
