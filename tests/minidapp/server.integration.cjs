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
    Buffer.from('240231030405', 'hex').copy(body, 22);
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
    // A valid buffered fix is visible in history without becoming a map marker.
    body.writeUInt32BE(31867795, 8);
    body.writeUInt32BE(117147473, 12);
    Buffer.from('240201030405', 'hex').copy(body, 22);
    const bufferedSocket = net.connect(tcp, '127.0.0.1');
    const bufferedClosed = once(bufferedSocket, 'close');
    bufferedSocket.end(encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: Buffer.from(bcd, 'hex'), sequenceNumber: 2, body
    }));
    await bufferedClosed;
    await until(async () => (await db.query(
      'SELECT count(*)::int AS n FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2',
      [owner.tenant_id, physical.id]
    )).rows[0].n === 2);
    await page.locator('#navigation a[href="#devices"]').click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row.getByText(/2024-02-01T03:04:05.000Z.*Buffered/).waitFor();
    await row.getByRole('button', { name: 'Device details' }).click();
    assert.match(await details.innerText(), /Current position\s+Unavailable/);
    await details.getByText('Unverified AOVX positions on this page', { exact: true }).waitFor();
    assert.match(await details.innerText(), /Unverified AOVX positions on this page/);
    assert.match(await details.innerText(), /2024-02-01T03:04:05.000Z · Buffered/);
    assert.match(await details.innerText(), /31.867795, 117.147473/);
    const diagnostics = details.locator('[data-device-diagnostics]');
    await details.getByRole('button', { name: 'Read now' }).click();
    await diagnostics.getByText('Buffered report', { exact: true }).waitFor();
    assert.match(await diagnostics.innerText(), /Last packet received \(UTC\)[\s\S]*Device measurement time \(UTC\)\s+2024-02-01T03:04:05.000Z/);
    assert.match(await diagnostics.innerText(), /Processed[\s\S]*Buffered[\s\S]*aovx-gal-v2/);
    assert.doesNotMatch(await diagnostics.innerText(), new RegExp(bcd));
    const checkRange = details.getByRole('button', { name: 'Load period' });
    await checkRange.click();
    await details.getByText('2 observations in the loaded UTC receipt period.').waitFor();
    assert.equal(await details.locator('.ux-lab-history-point').count(), 1);
    assert.equal(await details.locator('.ux-lab-last-known').count(), 0);
    const exportRange = details.getByRole('button', { name: 'Export period JSON' });
    const downloadEvent = page.waitForEvent('download');
    await exportRange.click();
    const labDownload = await downloadEvent;
    const { readFile: readDownload } = require('node:fs/promises');
    const bundleText = await readDownload(await labDownload.path(), 'utf8');
    const labBundle = JSON.parse(bundleText);
    assert.equal(labBundle.format, 'trackium-device-support-range-v1');
    assert.equal(labBundle.contains_location_data, false);
    assert.ok(labBundle.observations.every(row => !Object.hasOwn(row, 'position')));
    assert.doesNotMatch(bundleText, new RegExp(bcd + '|31.867795|117.147473'));
    assert.equal(labBundle.observations.length, 2);
    await details.getByLabel('Include precise coordinates in JSON').check();
    const secondDownload = page.waitForEvent('download');
    await exportRange.click();
    const withPosition = JSON.parse(await readDownload(await (await secondDownload).path(), 'utf8'));
    assert.equal(withPosition.contains_location_data, true);
    assert.equal(withPosition.observations.find(row => row.position).position.latitude, 31.867795);

    const diagnosticsPath = '**/v1/devices/' + physical.id + '/diagnostics';
    let signalStarted, releaseRoute;
    const started = new Promise(resolve => { signalStarted = resolve; });
    const release = new Promise(resolve => { releaseRoute = resolve; });
    const waitForStop = async route => {
      signalStarted();
      await release;
      await route.abort().catch(() => {});
    };
    await page.route(diagnosticsPath, waitForStop);
    await details.getByRole('button', { name: 'Start monitoring' }).click();
    await started;
    const canceled = page.waitForEvent('requestfailed', { predicate: req => req.url().endsWith('/diagnostics') });
    await details.getByRole('button', { name: 'Stop monitoring' }).click();
    await canceled;
    releaseRoute();
    await page.unroute(diagnosticsPath, waitForStop);
    assert.equal(await diagnostics.innerText(), '');
    await details.getByText('Monitoring stopped.', { exact: true }).waitFor();
    await details.getByLabel('To (UTC)').fill('2024-02-02T12:00');
    assert.ok(await exportRange.isDisabled());
    await details.locator('[data-action=close-dialog]').click();
    // A timely real-time fix is labelled last known and unverified on the map.
    body.writeUInt32BE(2, 4);
    const measuredAt = new Date(Math.floor(Date.now() / 1000) * 1000 - 2000).toISOString();
    Buffer.from(measuredAt.slice(2, 19).replace(/\D/g, ''), 'hex').copy(body, 22);
    const realtimeSocket = net.connect(tcp, '127.0.0.1');
    const realtimeClosed = once(realtimeSocket, 'close');
    realtimeSocket.end(encodeAovxFrame({
      messageId: 0x0200, deviceIdBcd: Buffer.from(bcd, 'hex'), sequenceNumber: 3, body
    }));
    await realtimeClosed;
    await until(async () => (await db.query(
      'SELECT count(*)::int AS n FROM telemetry_events WHERE tenant_id=$1 AND device_id=$2',
      [owner.tenant_id, physical.id]
    )).rows[0].n === 3);
    await page.locator('#navigation a[href="#map"]').click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await card.getByText('Last known fix (UTC)', { exact: true }).waitFor();
    assert.match(await card.innerText(), /Gateway received[\s\S]*unverified/);
    assert.equal(await page.locator('.ux-device-position').count(), 2);
    await page.locator('#navigation a[href="#devices"]').click();
    await row.getByRole('button', { name: 'Device details' }).click();
    await details.getByRole('button', { name: 'Read now' }).click();
    await details.locator('.ux-lab-last-known').waitFor();
    await details.getByText('Within 15 minutes', { exact: true }).waitFor();
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

test('Managed customer lifecycle through the operator CLI, Gateway and Lite', { timeout: 60000 }, async (t) => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const { mkdtemp, readFile, rm, stat, writeFile } = require('node:fs/promises');
  const { tmpdir } = require('node:os');
  const directory = await mkdtemp(path.join(tmpdir(), 'trackium-managed-'));
  const schema = 'managed_browser_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: DB });
  const db = new pg.Pool({ connectionString: DB, options: '-c search_path=' + schema });
  let gateway, browser;
  t.after(async () => {
    await browser?.close();
    if (gateway) await gateway.shutdown();
    else await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
    await rm(directory, { recursive: true, force: true });
  });
  await admin.query('CREATE SCHEMA ' + schema);
  const httpPort = await port();
  const origin = 'http://127.0.0.1:' + httpPort;
  const { createRuntime } = await import('../../services/gateway/src/cargo/runtime.js');
  const { readConfig } = await import('../../services/gateway/src/config.js');
  ({ gateway } = createRuntime(db, {
    ...readConfig({ DATABASE_URL: DB, PUBLIC_ORIGIN: origin, PROOF_MODE: 'disabled',
      ENABLE_WEB_WORKSPACE: 'true', ENABLE_TCP_RECEIVER: 'false', ENABLE_LOCAL_NOTIFICATIONS: 'true', INTEGRITAS_MODE: 'test', WEB_ROOT: ROOT }),
    host: '127.0.0.1', httpPort
  }, { worker: true, logger: { info() {}, warn() {}, error() {} } }));
  await gateway.start();
  const cli = async (command, ...options) => {
    const { stdout } = await promisify(execFile)(process.execPath,
      ['services/gateway/src/telemetry/admin.js', command, ...options],
      { cwd: ROOT, env: { ...process.env, DATABASE_URL: DB, PGOPTIONS: '-c search_path=' + schema } });
    return JSON.parse(stdout);
  };
  const a = '--customer=' + randomUUID(), b = '--customer=' + randomUUID();
  const provision = (customer, name) => cli('managed-provision', customer, '--name=' + name);
  const status = (customer) => cli('managed-status', customer);
  const output = (name) => '--out=' + path.join(directory, name);
  const grant = (customer, revision, name) => cli('managed-grant', customer, '--revision=' + revision, output(name));
  const owner = async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
  const [customerA, sameA, customerB] = await Promise.all([
    provision(a, 'Customer A'), provision(a, 'Customer A'), provision(b, 'Customer B')
  ]);
  assert.deepEqual(customerA, sameA);
  assert.notEqual(customerA.tenant_id, customerB.tenant_id);
  await assert.rejects(provision(a, 'Conflicting name'), /different name/);
  assert.equal((await status(a)).access, 'awaiting_grant');
  await writeFile(path.join(directory, 'occupied'), 'sentinel', { mode: 0o600 });
  await assert.rejects(grant(a, 0, 'occupied'), /EEXIST/);
  assert.equal((await status(a)).access_revision, 0);
  assert.equal(await readFile(path.join(directory, 'occupied'), 'utf8'), 'sentinel');
  const [first, second] = await Promise.allSettled([grant(a, 0, 'a1'), grant(a, 0, 'a2')]);
  assert.notEqual(first.status, second.status);
  const winner = first.status === 'fulfilled' ? 'a1' : 'a2';
  assert.match((first.reason || second.reason).message, /access revision changed/);
  assert.equal((await stat(path.join(directory, winner))).mode & 0o777, 0o600);
  const ownerA = await owner(winner);
  assert.deepEqual(ownerA.scopes, ['read', 'admin', 'shipments']);
  await assert.rejects(cli('issue-key', '--tenant=' + customerA.tenant_id, '--scopes=publish',
    output('bypass')), /use managed-grant/);
  await assert.rejects(cli('revoke-key', '--id=' + ownerA.id), /use managed-revoke/);
  await grant(b, 0, 'b');
  const ownerB = await owner('b');
  const api = (credential, endpoint, method = 'GET', body) => fetch(origin + endpoint, {
    method, headers: { authorization: 'Bearer ' + credential.token, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const register = (credential, label) => api(credential, '/v1/devices', 'POST', { label, mode: 'real' });
  const registered = await register(ownerA, 'Customer A tracker');
  assert.equal(registered.status, 201);
  const deviceA = await registered.json();
  assert.equal((await register(ownerB, 'Customer B tracker')).status, 201);
  const deviceUrl = '/v1/devices/' + deviceA.id;
  assert.equal((await api(ownerB, deviceUrl)).status, 404);
  const location = await api(ownerA, deviceUrl + '/location');
  assert.equal(location.status, 200);
  assert.equal((await location.json()).location, null);
  const approve = (credential, id, scopes) =>
    api(credential, '/v1/pairing/challenges/' + id + '/approve', 'POST', { scopes });

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']
  });
  const open = async () => (await browser.newContext()).newPage();
  const pageA = await open(), pageB = await open(), pending = await open();
  const leaked = [];
  pageA.on('request', request => {
    if (request.headers().authorization) leaked.push(request.url());
  });
  async function challenge(page, tenant) {
    await page.goto(origin + '/app/#settings');
    await page.locator('#pair-tenant').fill(tenant);
    await page.getByRole('button', { name: 'Create one-use challenge' }).click();
    return page.locator('#pair-challenge').innerText();
  }
  async function claim(page) {
    await page.getByRole('button', { name: 'Check owner approval' }).click();
    await page.waitForSelector('#server-banner:not([hidden])');
  }
  function browserRequest(page, endpoint, method = 'GET', withCsrf = false) {
    return page.evaluate(async ({ endpoint, method, withCsrf }) => {
      const headers = { 'X-Trackium-Client': 'cargo-v2' };
      if (withCsrf) headers['X-CSRF-Token'] =
        (await (await fetch('/v1/session', { headers })).json()).csrf;
      if (method !== 'GET') headers['Content-Type'] = 'application/json';
      const response = await fetch(endpoint, { method, headers,
        body: method === 'GET' ? undefined : JSON.stringify({ name: 'Denied' }) });
      return response.status;
    }, { endpoint, method, withCsrf });
  }

  const idA = await challenge(pageA, customerA.tenant_id);
  assert.equal((await approve(ownerB, idA, ['read'])).status, 409);
  assert.equal((await approve(ownerA, idA, ['simulate'])).status, 403);
  assert.equal((await approve(ownerA, idA, ['read', 'shipments'])).status, 200);
  await claim(pageA);
  const idB = await challenge(pageB, customerB.tenant_id);
  assert.equal((await approve(ownerB, idB, ['read', 'shipments'])).status, 200);
  await claim(pageB);
  const pendingId = await challenge(pending, customerA.tenant_id);
  assert.equal((await approve(ownerA, pendingId, ['read'])).status, 200);
  assert.equal((await status(a)).active_browser_sessions, 1);

  await pageA.locator('#navigation a[href="#shipments"]').click();
  await pageA.getByRole('button', { name: 'Create shipment', exact: true }).click();
  await pageA.locator('#server-shipment-form [name=name]').fill('Customer A cargo');
  await pageA.getByRole('button', { name: 'Save draft on Gateway' }).click();
  await pageA.locator('.server-shipment').filter({ hasText: 'Customer A cargo' }).waitFor();
  const { rows: [shipment] } = await db.query('SELECT id,tenant_id FROM cargo_shipments');
  assert.equal(shipment.tenant_id, customerA.tenant_id);
  const url = '/v1/shipments/' + shipment.id;
  assert.equal(await browserRequest(pageA, url, 'PATCH'), 403);
  assert.equal(await browserRequest(pageB, url), 404);
  assert.equal(await browserRequest(pageA, deviceUrl), 200);
  assert.equal(await browserRequest(pageB, deviceUrl), 404);
  assert.equal(await browserRequest(pageA, url + '/proofs'), 200);
  assert.equal(await browserRequest(pageB, url + '/proofs'), 404);
  assert.equal(await browserRequest(pageB, url, 'PATCH', true), 404);
  assert.equal((await api(ownerB, url)).status, 404);
  assert.equal((await api(ownerA, '/v1/managed/customers')).status, 404);
  const proofStatus = await api(ownerA, '/v1/proof-publisher');
  assert.equal(proofStatus.status, 200);
  assert.equal((await proofStatus.json()).enabled, false);
  const { rows: [ledger] } = await db.query(
    'SELECT e.event_type,o.tenant_id FROM cargo_events e JOIN cargo_outbox o ON o.event_id=e.id'
  );
  assert.deepEqual(ledger, { event_type: 'shipment_created', tenant_id: customerA.tenant_id });
  assert.equal((await db.query('SELECT count(*)::int AS total FROM cargo_proofs')).rows[0].total, 0);
  assert.equal(Number((await cli('managed-capacity')).managed_customers), 2);

  const feed = '/v1/notifications';
  assert.equal((await api(ownerB, feed + '?tenant_id=' + customerA.tenant_id)).status, 400);
  assert.equal((await api(ownerB, feed, 'PUT', { enabled: true, tenant_id: customerA.tenant_id })).status, 400);
  assert.equal(await browserRequest(pageA, feed, 'PUT'), 403);
  assert.equal(await browserRequest(pageA, feed, 'PUT', true), 403);
  assert.equal((await api(ownerA, feed, 'PUT', { enabled: true })).status, 200);
  assert.equal((await api(ownerA, url + '/transitions', 'POST', { status: 'active' })).status, 200);
  await pageA.locator('#navigation a[href="#settings"]').click();
  const notification = pageA.locator('li').filter({ hasText: 'status changed · active · shipment' });
  await notification.filter({ hasText: 'delivered (1 attempt)' }).waitFor();
  assert.match(await notification.innerText(), /unverified/);
  const otherFeed = await (await api(ownerB, feed)).json();
  assert.deepEqual(otherFeed, { preferences: { enabled: false, include_synthetic: false }, notifications: [] });
  await pageB.locator('#navigation a[href="#settings"]').click();
  await pageB.getByText('No notifications.', { exact: true }).waitFor();
  assert.equal(await pageB.locator('li').filter({ hasText: shipment.id }).count(), 0);

  const proofs = '/v1/integritas/proofs';
  const { rows: [eligible] } = await db.query("SELECT id FROM cargo_events WHERE event_type='status_changed'");
  assert.equal((await api(ownerB, proofs, 'POST', { event_id: eligible.id })).status, 404);
  const prepared = await api(ownerA, proofs, 'POST', { event_id: eligible.id });
  assert.equal(prepared.status, 202);
  const { id: proofId } = await prepared.json();
  assert.deepEqual(await (await api(ownerA, proofs, 'POST', { event_id: eligible.id })).json(), { id: proofId });
  assert.equal((await api(ownerB, proofs + '/' + proofId + '/bundle')).status, 404);
  assert.equal(await browserRequest(pageA, proofs, 'POST', true), 403);
  await pageA.locator('#navigation a[href="#proofs"]').click();
  await pageA.getByText('Test evidence checked', { exact: true }).waitFor();
  await pageA.getByRole('button', { name: 'Recheck test evidence' }).click();
  await pageA.getByRole('heading', { name: 'Integritas · TEST_ONLY' }).last().waitFor();
  assert.equal((await (await api(ownerA, proofs + '/' + proofId + '/bundle')).json()).proof.on_chain_verified, false);
  await pageA.getByRole('button', { name: 'Close details', exact: true }).click();
  const downloaded = pageA.waitForEvent('download');
  await pageA.getByRole('button', { name: 'Export test evidence' }).click();
  const artifact = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
  assert.equal(artifact.proof.id, proofId);
  assert.equal(artifact.proof.provider, 'integritas');
  assert.equal(artifact.proof.on_chain_verified, false);
  assert.equal(artifact.evidence.cargo_event.event_id, eligible.id);
  await pageA.evaluate(() => Object.defineProperty(navigator, 'userAgent', {
    value: navigator.userAgent + ' TrackiumLiteAndroid/0.1'
  }));
  await pageA.getByRole('button', { name: 'Export test evidence' }).click();
  const androidExport = pageA.getByRole('textbox', { name: 'Evidence JSON' });
  await androidExport.waitFor();
  assert.equal(JSON.parse(await androidExport.inputValue()).proof.id, proofId);
  await pageA.getByRole('button', { name: 'Close details', exact: true }).click();

  assert.equal(await pageA.getByText('Native Minima proof history · read-only').count(), 1);
  assert.equal(await pageA.locator('#local-exchange-form').count(), 0);
  await pageA.goto(origin + '/app/core#proofs');
  const advanced = pageA.getByText('Advanced publisher policy & Local Core exchange', { exact: true });
  await advanced.waitFor();
  await advanced.click();
  assert.ok(await pageA.getByRole('button', { name: 'Check Core / wallet readiness' }).isDisabled());
  assert.ok(await pageA.getByRole('button', { name: 'Import exchange & download acknowledgement' }).isDisabled());
  assert.equal(await pageA.getByText('Integritas proofs', { exact: true }).count(), 0);

  await cli('managed-revoke', a, '--revision=1');
  assert.equal(await browserRequest(pageA, feed), 401);
  assert.equal((await status(a)).access, 'revoked');
  assert.equal((await status(a)).active_browser_sessions, 0);
  assert.equal((await api(ownerA, url)).status, 401);
  assert.equal(await browserRequest(pageA, '/v1/session'), 401);
  assert.equal(await browserRequest(pageB, '/v1/session'), 200);
  await grant(a, 2, 'recovered');
  const recovered = await owner('recovered');
  assert.equal(await browserRequest(pageA, '/v1/session'), 401);
  assert.equal(await browserRequest(pending, '/v1/pairing/session', 'POST'), 401);
  const newId = await challenge(pageA, customerA.tenant_id);
  assert.equal((await approve(ownerA, newId, ['read'])).status, 401);
  assert.equal((await approve(recovered, newId, ['read'])).status, 200);
  await claim(pageA);
  assert.equal(await browserRequest(pageA, url), 200);
  assert.equal(await browserRequest(pageA, url, 'PATCH', true), 403);
  await grant(a, 3, 'rotated');
  assert.equal((await api(recovered, url)).status, 401);
  assert.equal(await browserRequest(pageA, '/v1/session'), 401);
  assert.deepEqual(leaked, []);
});

test('New customer registers, adds a company and creates a shipment visible on the map', { timeout: 60000 }, async (t) => {
  const { mkdtemp, readdir, readFile, rm } = require('node:fs/promises');
  const { tmpdir } = require('node:os');
  const directory = await mkdtemp(path.join(tmpdir(), 'trackium-customer-e2e-'));
  const schema = 'customer_browser_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: DB });
  const db = new pg.Pool({ connectionString: DB, options: '-c search_path=' + schema });
  await admin.query('CREATE SCHEMA ' + schema);
  const httpPort = await port();
  const origin = 'http://127.0.0.1:' + httpPort;
  const { createRuntime } = await import('../../services/gateway/src/cargo/runtime.js');
  const { readConfig } = await import('../../services/gateway/src/config.js');
  const { gateway } = createRuntime(db, {
    ...readConfig({ DATABASE_URL: DB, PUBLIC_ORIGIN: origin, CUSTOMER_ACCOUNTS_ENABLED: 'true', CUSTOMER_MAIL_PROVIDER: 'local', ACCOUNT_MAIL_DIRECTORY: directory,
      ENABLE_WEB_WORKSPACE: 'true', ENABLE_TCP_RECEIVER: 'false', INTEGRITAS_MODE: 'test', WEB_ROOT: ROOT }),
    host: '127.0.0.1', httpPort
  }, { worker: false, logger: { info(){}, error(){} } });
  let browser;
  t.after(async () => {
    await browser?.close();
    await gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
    await rm(directory, { recursive:true, force:true });
  });
  await gateway.start();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport:{width:1280,height:1000},
    userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile Safari/537.36 TrackiumLiteAndroid/0.1' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  const screenshots = process.env.TRACKIUM_CUSTOMER_SCREENSHOTS;
  const capture = name => screenshots && page.screenshot({path:path.join(screenshots,name+'.png')});
  await page.goto(origin + '/app/');
  await page.getByRole('heading', {name:'Sign in to Trackium'}).waitFor();
  await capture('01-sign-in');
  await page.getByRole('button', {name:'Create account',exact:true}).click();
  await page.getByLabel('Work email').fill('new@example.test');
  await page.getByRole('button', {name:'Send confirmation code'}).click();
  await page.getByRole('heading', {name:'Confirm your email'}).waitFor();
  const [message] = await readdir(directory);
  const { code } = JSON.parse(await readFile(path.join(directory,message),'utf8'));
  const password = 'customer fixture test secret';
  await page.getByLabel('Email code').fill(code);
  await page.getByLabel('New password').fill(password);
  await page.getByRole('button', {name:'Confirm email'}).click();
  await page.getByLabel('Work email').fill('new@example.test');
  await page.getByLabel('Password', {exact:true}).fill(password);
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await page.getByLabel('Company name').fill('Northline Logistics');
  await page.getByRole('button', {name:'Create company'}).click();
  await page.getByRole('heading', {name:'Overview',exact:true}).waitFor();
  await capture('02-dashboard');
  await page.locator('#navigation a[href="#settings"]').click();
  await page.getByLabel('Device label').fill('Unbound pilot device');
  await page.getByRole('button', {name:'Add device record'}).click();
  await page.getByText('Saved.',{exact:true}).waitFor();
  await page.locator('#navigation a[href="#shipments"]').click();
  await page.getByRole('button', {name:'Create shipment',exact:true}).click();
  await page.locator('#server-shipment-form [name=name]').fill('Northline pilot cargo');
  for (const [index, stop] of [['Wrocław','51.11','17.04'],['Kyiv','50.45','30.52']].entries()) {
    const form = page.locator('[data-route-stop]').nth(index);
    for (const [field, value] of ['name','latitude','longitude'].map((field,i) => [field,stop[i]])) {
      await form.locator('[data-route-field=' + field + ']').fill(value);
    }
  }
  await page.getByRole('button', {name:'Save draft on Gateway'}).click();
  await page.getByText('Northline pilot cargo',{exact:true}).first().waitFor();
  await capture('03-shipments');
  await page.locator('#navigation a[href="#map"]').click();
  await page.locator('.leaflet-container').waitFor();
  assert.equal(await page.locator('.ux-device-position').count(),0);
  await page.locator('.ux-route-stop').first().click();
  await page.locator('.leaflet-popup').getByRole('button',{name:'Shipment details'}).click();
  await page.locator('#detail-dialog[open]').waitFor();
  assert.match(await page.locator('#detail-dialog').innerText(), /Northline pilot cargo/);
  await page.keyboard.press('Escape');
  await capture('04-map');
  await page.locator('#navigation a[href="#shipments"]').click();
  await page.getByRole('button', { name:'Activate', exact:true }).click();
  await until(async () => (await db.query("SELECT 1 FROM cargo_events WHERE event_type='status_changed'")).rowCount === 1);
  const { createIntegritas } = await import('../../services/gateway/src/proofs/integritas.js');
  const integritas = createIntegritas(db);
  const { rows: [event] } = await db.query("SELECT id,tenant_id FROM cargo_events WHERE event_type='status_changed'");
  await integritas.prepare(event.tenant_id,event.id);
  for (let step=0;step<3;step++) await integritas.tick();
  await page.locator('#navigation a[href="#proofs"]').click();
  await page.getByText('Test evidence checked', {exact:true}).waitFor();
  await capture('05-test-proof');
  await page.setViewportSize({width:390,height:840});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture('06-mobile-proof');
  await page.setViewportSize({width:1280,height:1000});
  await page.locator('#navigation a[href="#settings"]').click();
  await page.getByRole('button', {name:'Sign out',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in to Trackium'}).waitFor();
  await page.getByRole('button', {name:'Forgot password'}).click();
  await page.getByLabel('Work email').fill('new@example.test');
  await page.getByRole('button', {name:'Send recovery code'}).click();
  await page.getByRole('heading', {name:'Set a new password'}).waitFor();
  const messages = await Promise.all((await readdir(directory)).map(file =>
    readFile(path.join(directory,file),'utf8').then(JSON.parse)));
  const reset = messages.find(entry => entry.purpose === 'reset');
  assert.ok(reset);
  await page.getByLabel('Email code').fill(reset.code);
  await page.getByLabel('New password').fill('new browser fixture password');
  await page.getByRole('button', {name:'Reset password'}).click();
  await page.getByRole('heading', {name:'Sign in to Trackium'}).waitFor();
  await page.getByLabel('Work email').fill('new@example.test');
  await page.getByLabel('Password', {exact:true}).fill('new browser fixture password');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await page.getByRole('heading', {name:'Overview',exact:true}).waitFor();
  assert.equal(new URL(page.url()).origin, origin);
  assert.deepEqual(failures,[]);
});

test('Closed demo uses normal password sign-in and shows only synthetic cargo and test proofs', { timeout: 40000 }, async (t) => {
  const schema = 'customer_demo_' + randomUUID().replaceAll('-','');
  const admin = new pg.Pool({ connectionString: DB });
  await admin.query('CREATE SCHEMA ' + schema);
  const db = new pg.Pool({ connectionString: DB, options:'-c search_path=' + schema });
  const httpPort = await port();
  const origin = 'http://127.0.0.1:' + httpPort;
  const { readConfig } = await import('../../services/gateway/src/config.js');
  const { createRuntime } = await import('../../services/gateway/src/cargo/runtime.js');
  const { administerDemo } = await import('../../services/gateway/src/cargo/demo-admin.js');
  const { createIntegritas } = await import('../../services/gateway/src/proofs/integritas.js');
  const { gateway } = createRuntime(db, {
    ...readConfig({ DATABASE_URL:DB, PUBLIC_ORIGIN:origin, ENABLE_WEB_WORKSPACE:'true', ENABLE_TCP_RECEIVER:'false',
      CUSTOMER_DEMO_ENABLED:'true', INTEGRITAS_MODE:'test', WEB_ROOT:ROOT }),
    host:'127.0.0.1', httpPort
  }, { worker:false, logger:{ info(){}, error(){} } });
  let browser;
  t.after(async () => {
    await browser?.close();
    await gateway.shutdown();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  });
  await gateway.start();
  const password = 'local demo browser fixture password';
  await administerDemo(db,'bootstrap',{password});
  const proofs = createIntegritas(db);
  for (let i=0;i<6;i++) await proofs.tick();
  browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox'] });
  const page = await browser.newPage();
  const requests = [];
  page.on('request', req => requests.push(new URL(req.url()).pathname));
  await page.goto(origin + '/app/');
  await page.getByRole('heading', { name:'Sign in to Trackium' }).waitFor();
  assert.equal(await page.getByRole('button',{name:'Create account',exact:true}).count(),0);
  assert.equal(await page.getByLabel('Work email').count(),0);
  await page.getByRole('textbox',{name:'Username'}).fill('trackium-demo');
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
  await page.locator('#navigation a[href="#shipments"]').click();
  await page.getByText('Demo · chilled cargo',{exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Create shipment',exact:true}).isDisabled());
  await page.locator('#navigation a[href="#map"]').click();
  await page.locator('.ux-route-stop').first().waitFor();
  assert.equal(await page.locator('.ux-device-position').count(),0);
  await page.locator('#navigation a[href="#proofs"]').click();
  await page.getByText('Integritas · TEST_ONLY',{exact:true}).first().waitFor();
  assert.equal(await page.getByText('Native Minima proof history · read-only').count(),0);
  assert.ok(requests.every(path => !/^\/v1\/(?:proofs|proof-publisher)/.test(path) &&
    !/^\/v1\/shipments\/[^/]+\/proofs$/.test(path)));
  await page.locator('#navigation a[href="#settings"]').click();
  await page.getByText('Viewer · synthetic examples').waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('heading',{name:'Sign in to Trackium'}).waitFor();
});
