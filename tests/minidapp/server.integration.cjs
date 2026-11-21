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
  { timeout: 60000 },
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
      TCP_PROTOCOL: 'aovx',
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
    for (const asset of ['mark.png', 'app-32.png', 'site.webmanifest', 'lite.webmanifest']) {
      const response = await fetch(origin + '/app/assets/v2/brand/' + asset);
      assert.equal(response.status, 200, 'approved brand asset is served');
      assert.match(response.headers.get('content-type'), asset.endsWith('.png') ? /image\/png/ : /manifest\+json/);
    }
    assert.equal((await fetch(origin + '/app/assets/v2/brand/private.txt')).status, 404);
    const lite = await (await fetch(origin + '/app/')).text();
    assert.match(lite, /lite\.webmanifest/);
    assert.doesNotMatch(lite, /src="(?:mds\.js|assets\/v2\/mds-bridge\.js)"/);
    const manifestUrl = origin + '/app/assets/v2/brand/lite.webmanifest';
    const manifest = await (await fetch(manifestUrl)).json();
    assert.equal(new URL(manifest.start_url, manifestUrl).href, origin + '/app/');
    assert.equal(new URL(manifest.scope, manifestUrl).href, origin + '/app/');
    // Issue owner credential in the trusted test process, never inside Chromium.
    const { createTelemetryService, provisionTenant } = await import(
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
    async function pair(client, scopes) {
      await client.goto(origin + '/app/#settings');
      await client.locator('#pair-tenant').fill(owner.tenant_id);
      await client.getByRole('button', { name: 'Create one-use challenge' }).click();
      await client.waitForSelector('#pair-challenge');
      const id = await client.locator('#pair-challenge').innerText();
      const approval = await fetch(origin + '/v1/pairing/challenges/' + id + '/approve', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + owner.token,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ scopes })
      });
      assert.equal(approval.status, 200);
      await client.getByRole('button', { name: 'Check owner approval' }).click();
      await client.waitForSelector('#server-banner:not([hidden])');
    }
    async function patchName(client, shipmentId) {
      return client.evaluate(async (id) => {
        const clientHeader = { 'X-Trackium-Client': 'cargo-v2' };
        const session = await fetch('/v1/session', { headers: clientHeader });
        if (!session.ok) throw new Error('Missing browser session');
        const { csrf } = await session.json();
        const response = await fetch('/v1/shipments/' + id, {
          method: 'PATCH',
          headers: { ...clientHeader, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Rejected edit' })
        });
        return { status: response.status, error: (await response.json()).error };
      }, shipmentId);
    }
    await pair(page, ['read', 'shipments', 'simulate']);
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
    const form = page.locator('#server-shipment-form');
    await form.locator('[name=name]').fill('Browser cargo');
    await form.locator('[name=deviation]').fill('765');
    await page.getByRole('button', { name: 'Save draft on Gateway' }).click();
    const draftCard = page.locator('.server-shipment');
    await draftCard.waitFor();
    const draft = (await db.query('SELECT id,device_id FROM cargo_shipments')).rows[0];

    const readContext = await browser.newContext();
    try {
      const reader = await readContext.newPage();
      reader.setDefaultTimeout(8000);
      await pair(reader, ['read']);
      await reader.locator('#navigation a[href="#shipments"]').click();
      const readEdit = reader.getByRole('button', { name: 'Edit draft' });
      await readEdit.waitFor();
      assert.equal(await readEdit.isDisabled(), true);
      const denied = await patchName(reader, draft.id);
      assert.equal(denied.status, 403);
      assert.match(denied.error, /scope/);
    } finally {
      await readContext.close();
    }

    await draftCard.getByRole('button', { name: 'Edit draft' }).click();
    assert.equal(await form.locator('[name=name]').inputValue(), 'Browser cargo');
    assert.equal(await form.locator('[name=device_id]').inputValue(), draft.device_id);
    assert.equal(await form.locator('[name=deviation]').inputValue(), '765');
    assert.equal(await form.locator('[data-route-field=name]').last().inputValue(), 'Kyiv');
    await form.locator('[name=name]').fill('Browser cargo updated');
    await form.locator('[name=min]').fill('9');
    const save = form.getByRole('button', { name: 'Save draft changes' });
    await save.click();
    await page.waitForFunction(() =>
      document.querySelector('#server-form-error')?.textContent.includes('inverted temperature range')
    );
    assert.equal(await form.locator('[name=name]').inputValue(), 'Browser cargo updated');
    await form.locator('[name=min]').fill('3');
    await form.locator('[data-route-field=name]').last().fill('Kyiv depot');
    const patch = page.waitForResponse((r) =>
      r.request().method() === 'PATCH' && r.url() === origin + '/v1/shipments/' + draft.id
    );
    await save.click();
    assert.equal((await patch).status(), 200);
    await draftCard.getByRole('heading', { name: 'Browser cargo updated' }).waitFor();
    const saved = (await db.query('SELECT name,device_id,conditions FROM cargo_shipments WHERE id=$1', [draft.id])).rows[0];
    assert.equal(saved.name, 'Browser cargo updated');
    assert.equal(saved.device_id, draft.device_id);
    assert.equal(saved.conditions.temperature_min_c, 3);
    assert.equal(saved.conditions.max_deviation_m, 765);
    const stops = (await db.query(
      'SELECT name FROM cargo_checkpoints WHERE shipment_id=$1 ORDER BY ordinal', [draft.id]
    )).rows;
    assert.deepEqual(stops.map((stop) => stop.name), ['Wrocław', 'Kyiv depot']);
    assert.equal((await db.query(
      "SELECT count(*) FROM cargo_events WHERE shipment_id=$1 AND event_type='shipment_updated'", [draft.id]
    )).rows[0].count, '1');
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await page.getByRole('button', { name: 'Start temperature excursion' }).waitFor();
    assert.equal(await draftCard.getByRole('button', { name: 'Edit draft' }).count(), 0);
    const rejected = await patchName(page, draft.id);
    assert.equal(rejected.status, 409);
    assert.match(rejected.error, /only draft/);
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
      document.querySelector('.ux-timeline')?.textContent.includes('checkpoint reached')
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
    // Use the real TCP and tenant enrollment path. These are generated frame bytes,
    // not evidence for coordinate scaling or the clock on a physical tracker.
    const { encodeAovxFrame } = await import(path.join(ROOT, 'services/gateway/src/aovx/frame.js'));
    const { createShipmentService } = await import(path.join(ROOT, 'services/gateway/src/cargo/shipments.js'));
    const telemetry = createTelemetryService(db);
    const physical = await telemetry.register(owner.tenant_id, { label: 'AOVX history tracker', mode: 'real' });
    const bcd = '111222333444';
    await telemetry.bindAovxDevice(owner.tenant_id, null, { device_id: physical.id, device_id_bcd: bcd });
    const shipments = createShipmentService(db);
    const shipment = await shipments.create(owner.tenant_id, {
      name: 'AOVX observation cargo', device_id: physical.id,
      route: [{ name: 'Start', latitude: 51, longitude: 17 }, { name: 'End', latitude: 50, longitude: 30 }],
      conditions: { temperature_min_c: 2, temperature_max_c: 8 }
    });
    await shipments.change(owner.tenant_id, shipment.id, 'active');
    const body = Buffer.alloc(40);
    body.writeUInt32BE(0x80000012, 4);
    Buffer.from('240201030405', 'hex').copy(body, 22);
    const socket = net.connect(tcp, '127.0.0.1');
    const closed = once(socket, 'close');
    socket.end(encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: Buffer.from(bcd, 'hex'), sequenceNumber: 1, body
    }));
    await closed;
    let observation;
    await until(async () => {
      observation = (await db.query(
        'SELECT received_at FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2',
        [owner.tenant_id, physical.id]
      )).rows[0];
      return Boolean(observation);
    });
    const received = await page.evaluate(
      iso => new Date(iso).toLocaleString(), observation.received_at.toISOString()
    );
    await page.locator('#navigation a[href="#devices"]').click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: physical.label });
    await row.getByText(/Gateway received:/).waitFor();
    assert.ok((await row.innerText()).includes(received));
    assert.match(await row.innerText(), /unverified[\s\S]*Device measurement time unavailable[\s\S]*Current position unavailable/);
    assert.match(await row.innerText(), /Not reported/);
    assert.match(await page.getByRole('row').filter({ hasText: 'Server simulator 1' }).innerText(), /synthetic/);
    await row.getByRole('button', { name: 'Device details' }).click();
    const details = page.locator('#detail-dialog');
    assert.match(await details.innerText(), /Current position\s+Unavailable/);
    assert.match(await details.innerText(), /Device measurement time\s+Unavailable/);
    assert.match(await details.getByRole('listitem').last().innerText(), /Gateway received:.*unavailable/i);
    await details.locator('[data-action=close-dialog]').click();

    await page.locator('#navigation a[href="#map"]').click();
    const card = page.locator('.ux-card-grid .panel').filter({ hasText: physical.label });
    assert.match(await card.innerText(), /Current position\s+Unavailable[\s\S]*unverified/);
    assert.doesNotMatch(await card.innerText(), /Latitude|Longitude/);
    assert.equal(await page.locator('.ux-device-position').count(), 1, 'only the simulator gets a point');

    await page.locator('#navigation a[href="#events"]').click();
    const recorded = page.locator('.ux-timeline li').filter({ hasText: 'AOVX observation cargo' })
      .filter({ hasText: 'telemetry recorded' });
    assert.match(await recorded.innerText(), /Gateway received:.*Device measurement time unavailable/);
    await recorded.getByRole('button', { name: 'Event details' }).click();
    assert.match(await details.innerText(), /Gateway received[\s\S]*Device measurement time\s+Unavailable/);
    await details.locator('[data-action=close-dialog]').click();
    // Browse actual PostgreSQL cursor pages in the browser-only workspace.
    const fixture = await telemetry.register(owner.tenant_id, { label: 'Synthetic history sample', mode: 'synthetic' });
    for (let index = 1; index <= 22; index++) {
      const input = {
        schema_version: 1,
        source_event_id: 'lite-history-' + index,
        occurred_at: new Date(Date.UTC(2026, 0, index)).toISOString(),
        gps: index === 2 ? null : { latitude: index, longitude: index + 10 },
        temperature_c: index
      };
      await telemetry.ingestFixture(owner.tenant_id, fixture.id, input, JSON.stringify(input));
    }
    const foreign = await provisionTenant(db, 'Other Lite tenant');
    const historyPath = '/v1/devices/' + fixture.id + '/events';
    const scopedRead = (token, cursor) => fetch(origin + historyPath + '?limit=20&cursor=' + cursor, {
      headers: { authorization: 'Bearer ' + token }
    });
    const pageResponse = await fetch(origin + historyPath + '?limit=20', {
      headers: { authorization: 'Bearer ' + owner.token }
    });
    assert.equal(pageResponse.headers.get('cache-control'), 'no-store');
    const firstPage = await pageResponse.json();
    assert.ok(firstPage.next_cursor);
    assert.equal((await scopedRead(foreign.token, firstPage.next_cursor)).status, 404);
    assert.equal((await scopedRead(owner.token, 'invalid')).status, 400);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.match(await page.title(), /Trackium Lite/);
    await page.locator('#navigation a[href="#devices"]').evaluate(link => link.click());
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    const historyRow = page.getByRole('row').filter({ hasText: fixture.label });
    await historyRow.getByRole('button', { name: 'Device details' }).click();
    const history = page.locator('#device-history');
    await history.getByText('Page 1', { exact: true }).waitFor();
    assert.equal(await history.locator('.ux-timeline > li').count(), 20);
    assert.equal(await history.getByRole('img', { name: 'Discrete historical positions' }).locator('circle').count(), 20);
    await history.getByRole('button', { name: 'Older observations' }).press('Enter');
    await history.getByText('Page 2', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'device-history-title');
    assert.equal(await history.locator('.ux-timeline > li').count(), 2);
    const positions = history.getByRole('img', { name: 'Discrete historical positions' });
    assert.equal(await positions.locator('circle').count(), 1);
    assert.equal(await positions.locator('line, polyline, path').count(), 0);
    assert.equal(await history.getByRole('button', { name: 'Older observations' }).isDisabled(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await history.getByRole('button', { name: 'Newer observations' }).click();
    await history.getByText('Page 1', { exact: true }).waitFor();
    assert.equal(await history.locator('.ux-timeline > li').count(), 20);

    await context.setOffline(true);
    await page.getByRole('heading', { name: 'You are offline' }).waitFor();
    assert.equal(await history.count(), 0);
    assert.doesNotMatch(await page.locator('#main').innerText(), /Synthetic history sample/);
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Retry session check' }).click();
    await historyRow.getByRole('button', { name: 'Device details' }).click();
    await history.getByText('Page 1', { exact: true }).waitFor();
    await details.locator('[data-action=close-dialog]').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Static Preview is still an explicitly selected, isolated data source.
    await page.locator('#navigation a[href="#proofs"]').click();
    await page.locator('#demo-toggle').click();
    await page.waitForSelector('.proof-pipeline');
    assert.equal(await page.locator('#server-banner').isVisible(), false);
    assert.doesNotMatch(await page.locator('#main').innerText(), /AOVX history tracker|AOVX observation cargo/);
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
    await until(async () =>
      (await db.query('SELECT count(*) FROM cargo_sessions WHERE revoked_at IS NOT NULL')).rows[0].count === '1'
    );
    await until(async () => !(await context.cookies()).some((c) => c.name === 'trk_session'));
    assert.ok(
      authHeaders.every((v) => !v),
      'no owner Authorization header in Chromium'
    );
    assert.deepEqual(errors, []);
    assert.ok(!logs.includes(owner.token), 'no owner credential in server logs');
  }
);
