(function (root) {
  'use strict';
  const enabled = (root.location.pathname || '').startsWith('/app/');
  function create(onChange) {
    const state = {
      enabled,
      connected: false,
      loading: false,
      session: null,
      challenge: null,
      error: '',
      data: null,
      updated: null
    };
    let csrf = '',
      generation = 0,
      refreshSerial = 0,
      timer;
    function change() {
      onChange(state);
    }
    function clear(message = '') {
      state.connected = false;
      state.session = null;
      state.data = null;
      state.updated = null;
      state.error = message;
      csrf = '';
      clearTimeout(timer);
    }
    async function request(path, method = 'GET', input) {
      if (!enabled) throw new Error('Open the authenticated Gateway workspace first.');
      if (!path.startsWith('/v1/') || path.includes('#')) throw new Error('Invalid API path.');
      const requestVersion = generation;
      const headers = { 'X-Trackium-Client': 'cargo-v2' };
      if (method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
      if (input !== undefined) headers['Content-Type'] = 'application/json';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res, data;
      try {
        res = await fetch(path, {
          method,
          headers,
          credentials: 'same-origin',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
          body: input === undefined ? undefined : JSON.stringify(input)
        });
        data = await res.json();
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        if (res.status === 401 && requestVersion === generation) {
          generation++;
          clear('Session expired or revoked. Reconnect to continue.');
          change();
        }
        throw new Error(data.error || 'Gateway request failed');
      }
      return data;
    }
    async function refresh() {
      if (!state.connected) return;
      clearTimeout(timer);
      const version = generation,
        serial = ++refreshSerial;
      try {
        const session = await request('/v1/session');
        const [shipments, devices, simulations, publisher] = await Promise.all([
          request('/v1/shipments?limit=25'),
          request('/v1/devices?limit=25'),
          request('/v1/simulations'),
          request('/v1/proof-publisher')
        ]);
        const details = await Promise.all(
          shipments.shipments.map((s) => request('/v1/shipments/' + s.id))
        );
        const deviceDetails = await Promise.all(
          devices.devices.map(async (d) => ({
            registry: d,
            status: await request('/v1/devices/' + d.id + '/status'),
            location: await request('/v1/devices/' + d.id + '/location'),
            history: await request('/v1/devices/' + d.id + '/events?limit=20')
          }))
        );
        const events = await Promise.all(
          details.map((s) => request('/v1/shipments/' + s.id + '/events?limit=50'))
        );
        const proofs = await Promise.all(
          details.map((s) => request('/v1/shipments/' + s.id + '/proofs?limit=50'))
        );
        if (version !== generation || serial !== refreshSerial) return;
        state.session = session;
        csrf = session.csrf;
        state.data = {
          shipments: details,
          devices: deviceDetails,
          simulations: simulations.simulations,
          events: events.flatMap((e) => e.events),
          proofs: proofs.flatMap((e) => e.proofs),
          proofMode: proofs[0]?.engine_mode ?? 'disabled',
          publisher
        };
        state.updated = new Date().toISOString();
        state.error = '';
        change();
      } catch (e) {
        if (version !== generation || serial !== refreshSerial) return;
        generation++;
        clear('Gateway unavailable. Loaded data cleared; nothing is shown as live.');
        change();
      }
      if (state.connected) timer = setTimeout(refresh, 3000);
    }
    return {
      state,
      request,
      async restore() {
        if (!enabled) return;
        try {
          const session = await request('/v1/session');
          generation++;
          state.connected = true;
          state.session = session;
          csrf = session.csrf;
          await refresh();
        } catch (e) {
          clear('Pair this browser with your tenant to load Gateway data.');
          change();
        }
      },
      async challenge(tenant) {
        generation++;
        if (state.connected) await this.disconnect();
        const result = await request('/v1/pairing/challenges', 'POST', {
          tenant_id: tenant
        });
        state.challenge = result;
        state.error = '';
        change();
      },
      async claim() {
        try {
          const session = await request('/v1/pairing/session', 'POST');
          generation++;
          csrf = session.csrf;
          state.session = session;
          state.connected = true;
          state.challenge = null;
          state.error = '';
          await refresh();
        } catch (e) {
          state.error = e.message;
          change();
        }
      },
      async disconnect() {
        generation++;
        const active = state.connected;
        if (active) {
          try {
            await request('/v1/session', 'DELETE');
          } finally {
            clear();
            change();
          }
        } else {
          clear();
          change();
        }
      },
      async mutate(path, input = {}) {
        await request(path, 'POST', input);
        await refresh();
      },
      refresh
    };
  }
  root.TrackiumServer = { create, enabled };
})(window);
