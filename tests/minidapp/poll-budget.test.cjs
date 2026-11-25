const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('Lite validates the session between bounded full snapshots on a 25×25 manifest', async () => {
  let clock = 0, pending = 0, peak = 0, timer, nextTimer = 0, expired = false, role = 'owner';
  const paths = [];
  const snapshots = [];
  const session = () => ({id:'session', tenant_id:'tenant', role, customer:true, csrf:'fixture'});
  const entries = kind => Array.from({length:25}, (_,i) => ({id:kind + i}));
  const document = {documentElement:{dataset:{customerAccounts:'true'}}, hidden:false, addEventListener() {}};
  const window = {location:{pathname:'/app/', hash:'#map'}};
  class Clock extends Date {
    constructor() { super(clock); }
    static now() { return clock; }
  }
  vm.runInNewContext(readFileSync(resolve(__dirname, '../../assets/v2/server-client.js'), 'utf8'), {
    window, document, Date:Clock, navigator:{onLine:true}, AbortController, DOMException,
    setTimeout(fn, ms) {
      if (ms === 3000) timer = fn;
      return ++nextTimer;
    },
    clearTimeout() {},
    async fetch(url) {
      paths.push(url);
      peak = Math.max(peak, ++pending);
      await Promise.resolve();
      pending--;
      const data = url === '/v1/shipments?limit=25' ? {shipments:entries('s')}
        : url === '/v1/devices?limit=25' ? {devices:entries('d')}
        : { ...session(), events:[], proofs:[], simulations:[] };
      return {ok:!expired, status:expired ? 401 : 200, json:async () => data};
    }
  });
  const client = window.TrackiumServer.create((state, reason) => {
    if (reason === 'snapshot') snapshots.push(state.updated);
  });
  await client.restore();
  const coldRequests = paths.length;
  assert.equal(coldRequests, 155); // Includes the account-session bootstrap.
  assert.equal(peak, 6);
  for (clock of [3000, 6000, 9000, 12000, 15000]) await timer();
  assert.equal(paths.length - coldRequests, 158); // Four session-only ticks, then one complete refresh.
  assert.equal(154 * 5 - 158, 612);
  assert.equal(snapshots.length, 2);
  clock = 16000;
  const beforeManual = paths.length;
  await client.refresh();
  assert.equal(paths.length - beforeManual, 154);
  assert.equal(snapshots.length, 3);

  role = 'viewer';
  clock = 19000;
  await timer();
  assert.equal(client.state.session.role, 'viewer');
  assert.equal(snapshots.length, 4);
  window.location.hash = '#proofs';
  clock = 22000;
  const beforeProofs = paths.length;
  await timer();
  assert.equal(paths.length - beforeProofs, 154);
  assert.equal(snapshots.length, 5);

  expired = true;
  clock = 25000;
  await timer();
  assert.equal(client.state.data, null);
  assert.equal(client.state.connected, false);
});
