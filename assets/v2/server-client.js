(function (root) {
  'use strict';
  const enabled = (root.location.pathname || '').startsWith('/app/');
  function create(onChange) {
    const state = {
      enabled,
      phase: enabled ? 'checking' : 'unpaired',
      pages: {
        shipments: { cursor: null, previous: [], next: null },
        devices: { cursor: null, previous: [], next: null }
      },
      verifications: {},
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
    function clear(message = '', phase = 'unpaired') {
      state.phase = phase;
      state.pages = {
        shipments: { cursor: null, previous: [], next: null },
        devices: { cursor: null, previous: [], next: null }
      };
      state.verifications = {};
      state.loading = false;
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
          clear(
            'Session expired or revoked. Reconnect to continue.',
            state.connected ? 'expired' : 'unpaired'
          );
          change();
        }
        const error = new Error(data.error || 'Gateway request failed');
        error.status = res.status;
        throw error;
      }
      return data;
    }
    async function refresh() {
      if (!state.connected) return;
      clearTimeout(timer);
      const version = generation,
        serial = ++refreshSerial;
      state.loading = true;
      change();
      try {
        const session = await request('/v1/session');
        const [shipments, devices, simulations, publisher] = await Promise.all([
          request(
            '/v1/shipments?limit=25' +
              (state.pages.shipments.cursor
                ? '&cursor=' + encodeURIComponent(state.pages.shipments.cursor)
                : '')
          ),
          request(
            '/v1/devices?limit=25' +
              (state.pages.devices.cursor
                ? '&cursor=' + encodeURIComponent(state.pages.devices.cursor)
                : '')
          ),
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
        state.phase = 'available';
        state.pages.shipments.next = shipments.next_cursor || null;
        state.pages.devices.next = devices.next_cursor || null;
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
        state.loading = false;
        state.updated = new Date().toISOString();
        state.error = '';
        change();
      } catch (e) {
        if (version !== generation || serial !== refreshSerial) return;
        generation++;
        clear(
          e.status === 403
            ? 'This session is not authorized for the workspace. Ask the owner to review its scopes.'
            : 'Gateway unavailable. Loaded data cleared; nothing is shown as live.',
          e.status === 403 ? 'forbidden' : 'unavailable'
        );
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
          clear(
            e.status === 401
              ? 'Pair this browser with your tenant to load Gateway data.'
              : e.status === 403
                ? 'This session is not authorized for the workspace. Ask the owner to review its scopes.'
                : 'Gateway unavailable. Check the connection and try again.',
            e.status === 401 ? 'unpaired' : e.status === 403 ? 'forbidden' : 'unavailable'
          );
          change();
        }
      },
      async challenge(tenant) {
        generation++;
        if (state.connected) await this.disconnect();
        const result = await request('/v1/pairing/challenges', 'POST', {
          tenant_id: tenant
        });
        state.phase = 'pairing';
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
      async turnPage(kind, direction) {
        if (!['shipments', 'devices'].includes(kind) || state.loading) return;
        const p = state.pages[kind];
        if (direction === 'next' && p.next) {
          p.previous.push(p.cursor);
          p.cursor = p.next;
        } else if (direction === 'previous' && p.previous.length) p.cursor = p.previous.pop();
        else return;
        await refresh();
      },
      refresh
    };
  }
  root.TrackiumServer = { create, enabled };
})(window);
