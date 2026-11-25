const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
let server, browser, origin;
const id = '11111111-1111-4111-8111-111111111111';
const deviceId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const proofId = '44444444-4444-4444-8444-444444444444';
const fixture = {
  shipment: {
    id,
    name: 'Synthetic browser fixture · cold cargo',
    device_id: deviceId,
    source_trust: 'synthetic',
    status: 'active',
    conditions: { temperature_min_c: 2, temperature_max_c: 8, tolerance_c: 1 },
    route: [
      { name: 'Start', latitude: 51, longitude: 17 },
      { name: 'Destination', latitude: 50, longitude: 30 }
    ],
    checkpoints: [
      { name: 'Start', latitude: 51, longitude: 17, visited_at: null, source_trust: 'synthetic' }
    ]
  },
  registry: {
    id: deviceId,
    label: 'Synthetic fixture sensor',
    identity_kind: 'simulator',
    mode: 'synthetic',
    enabled: true
  },
  event: {
    id: eventId,
    shipment_id: id,
    event_type: 'temperature_excursion',
    event_time: '2026-01-01T00:00:00Z',
    source_trust: 'synthetic',
    sha256: 'a'.repeat(64),
    outbox_state: 'delivered'
  },
  proof: {
    id: proofId,
    shipment_id: id,
    sequence: 1,
    state: 'submitted',
    mode: 'test',
    publisher_kind: 'server',
    wire: 'TRACKIUMPROOF1' + 'b'.repeat(64),
    confirmations: 0,
    required_depth: 3,
    txpow_id: null,
    commitment: { event_type: 'temperature_excursion', source_trust: 'synthetic' }
  }
};
async function fixturePage(width = 1440, scheme = 'light', source = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    colorScheme: scheme,
    hasTouch: source.touch === true
  });
  await context.route('**/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    let data;
    source.requests ||= [];
    source.requests.push(p + new URL(route.request().url()).search);
    if (source.offline) {
      await route.abort('internetdisconnected');
      return;
    }
    if (p === '/v1/session' && source.phase) {
      await route.fulfill({
        status: source.phase,
        json: { error: source.phase === 401 ? 'SESSION_EXPIRED' : 'FORBIDDEN' }
      });
      return;
    }

    if (p === '/v1/session')
      data = {
        ...(source.customer ? {customer:true, role:source.role || 'owner', company_name:'Northline · browser fixture'} : {}),
        tenant_id: source.tenant ?? 'synthetic-browser-fixture',
        audience: 'test-only',
        expires_at: '2099-01-01T00:00:00Z',
        scopes: source.scopes || ['read', 'shipments'],
        integritas_proofs: source.integritas,
        csrf: 'test-only',
        simulation_enabled: false
      };
    else if (p === '/v1/routes/calculate' && source.calculate) {
      const response = await source.calculate(route.request().postDataJSON());
      try { await route.fulfill({status:response.status || 200,json:response.body}); }
      catch (error) { if (!/closed|interception|Invalid/i.test(error.message)) throw error; }
      return;
    }
    else if (p.includes('/road-routes') && source.lifecycle) {
      const response = await source.lifecycle(p,route.request().method(),route.request().postDataJSON(),
        new URL(route.request().url()).searchParams);
      if (response.abort) await route.abort('failed');
      else await route.fulfill({status:response.status || 200,json:response.body});
      return;
    }
    else if (p.endsWith('/road-routes/active') && source.customer) {
      if (source.roadError) return route.fulfill({status:source.roadError,json:{error:'Fixture routing failure'}});
      data = {generation:source.road ? 3 : 1, revision:source.road || null};
    }
    else if (p.endsWith('/road-routes') && source.customer)
      data = {generation:source.road ? 3 : 1,active_revision_id:source.road?.id ?? null,
        revisions:source.road ? [{id:source.road.id,state:'active',version:source.road.version,profile:source.road.calculation?.profile}]
          : source.proposed ? [{state:'proposed'}] : []};
    else if (p === '/v1/shipments')
      data = {
        shipments: source.fleet || (source.empty
          ? []
          : [
              {
                ...fixture.shipment,
                ...(new URL(route.request().url()).searchParams.has('cursor')
                  ? { id: '55555555-5555-4555-8555-555555555555', name: 'Synthetic second page' }
                  : {})
              }
            ]),
        next_cursor: new URL(route.request().url()).searchParams.has('cursor')
          ? null
          : 'next-fixture-page'
      };
    else if (source.fleet?.some(s => p === '/v1/shipments/' + s.id)) data = source.fleet.find(s => p.endsWith('/' + s.id));
    else if (source.fleet?.some(s => p.startsWith('/v1/shipments/' + s.id + '/')) && !p.includes('/road-routes'))
      data = p.endsWith('/proofs') ? {proofs:[],engine_mode:'test'} : {events:[]};
    else if (p === '/v1/shipments/55555555-5555-4555-8555-555555555555')
      data = {
        ...fixture.shipment,
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Synthetic second page'
      };
    else if (p.includes('/shipments/55555555-5555-4555-8555-555555555555/'))
      data = p.endsWith('/proofs') ? { proofs: [], engine_mode: 'test' } : { events: [] };
    else if (p === `/v1/shipments/${id}`) data = {
      ...fixture.shipment,
      ...(source.shipmentName ? { name: source.shipmentName } : {}),
      ...(source.visual ? { checkpoints: [
        { name: 'Start', latitude: 51, longitude: 17, visited_at: null, source_trust: 'synthetic' },
        { name: 'Transfer', latitude: 50.5, longitude: 23.5, visited_at: null, source_trust: 'synthetic' },
        { name: 'Destination', latitude: 50, longitude: 30, visited_at: null, source_trust: 'synthetic' }
      ] } : {})
    };
    else if (p === `/v1/shipments/${id}/events`) data = { events: [fixture.event] };
    else if (p === `/v1/shipments/${id}/proofs`)
      data = { proofs: [{ ...fixture.proof, publisher_kind: source.publisherKind || 'server' }], engine_mode: 'test' };
    else if (p === '/v1/integritas/proofs') data = { proofs: source.visual ? [{
      id: proofId, shipment_id: id, event_id: eventId, event_type: fixture.event.event_type,
      status: 'verified', created_at: fixture.event.event_time, network: 'test',
      source_trust: 'synthetic', on_chain_verified: false
    }] : [] };
    else if (p === '/v1/proofs/' + proofId + '/local-job') data = { proof_id: proofId };
    else if (p === '/v1/devices')
      data = { devices: source.empty ? [] : [fixture.registry], next_cursor: null };
    else if (p.endsWith('/status'))
      data = { status: 'unknown', last_event_at: '2026-01-01T00:00:00Z', mode: 'synthetic' };
    else if (p.endsWith('/location'))
      data = {
        location: {
          gps: source.location || { latitude: 51, longitude: 17 },
          occurred_at: '2026-01-01T00:00:00Z',
          trust: 'synthetic'
        }
      };
    else if (p === `/v1/devices/${deviceId}/events` &&
        new URL(route.request().url()).searchParams.has('cursor') && source.historyPage)
      data = await source.historyPage();
    else if (p === `/v1/devices/${deviceId}/events`)
      data = {
        next_cursor: source.historyPage ? 'fixture-history-cursor' : null,
        events: [
          {
            occurred_at: '2026-01-01T00:00:00Z',
            payload: { temperature_c: 0, humidity_pct: null, battery_pct: 50, trust: 'synthetic' }
          },
          {
            occurred_at: '2025-12-31T23:00:00Z',
            payload: { temperature_c: 3, humidity_pct: 48, battery_pct: 52, trust: 'synthetic' }
          },
          {
            occurred_at: '2025-12-31T22:00:00Z',
            payload: { temperature_c: 4, humidity_pct: 47, battery_pct: 53, trust: 'synthetic' }
          }
        ]
      };
    else if (p === '/v1/simulations') data = { simulations: [] };
    else if (p === '/v1/proof-publisher')
      data = { enabled: source.publisherEnabled || false, pending_events: [], policy: null, signer_fingerprint: 'test-only' };
    else throw new Error('Unexpected UI API: ' + p);
    await route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') {
      source.consoleErrors ||= [];
      source.consoleErrors.push(m.text());
    }
  });
  page.on('pageerror', (e) => {
    source.errors ||= [];
    source.errors.push(e.message);
  });
  await page.goto(origin + (source.nativeWorkspace ? '/app/core' : '/app/'));
  await page
    .locator(source.phase || source.offline ? '.connection-state' : source.customer ? '.fleet-map-workspace' : '.ops-stat')
    .first()
    .waitFor();
  if (source.errors?.length) throw new Error('Fixture script errors: ' + source.errors.join('; '));
  return { context, page };
}

async function start(rootDir = ROOT, roadTiles) {
  const web = roadTiles ? (await import('../../services/gateway/src/cargo/web.js')).createWebHandler({
    webEnabled: true, webRoot: rootDir, roadTiles
  }) : null;
  server = http.createServer(async (req, res) => {
    if (web && req.url.startsWith('/app/')) return web(req, res);
    let name = new URL(req.url, 'http://local').pathname.replace(/^\/app\//, '/');
    if (name === '/' || name === '/core') name = '/index.html';
    const file = path.resolve(rootDir, '.' + name);
    if (!file.startsWith(rootDir + path.sep)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const content = await fs.readFile(file);
      res.setHeader(
        'content-type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.css')
            ? 'text/css'
            : name.endsWith('.png')
              ? 'image/png'
              : 'text/html'
      );
      res.end(content);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
}
async function stop() {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
module.exports = { start, stop, fixturePage, fixture };
