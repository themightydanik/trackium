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
      history: null,
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
      state.history = null;
      state.loading = false;
      state.connected = false;
      state.session = null;
      state.challenge = null;
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
      if (navigator.onLine === false) throw new Error('Offline. Reconnect to the Gateway.');
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
        if (version !== generation || serial !== refreshSerial) return;
        if (state.session.tenant_id !== session.tenant_id || state.session.id !== session.id) {
          generation++;
          clear('Browser session changed. Check the new session to continue.', 'expired');
          change();
          return;
        }
        const [shipments, devices, simulations, publisher, notifications, integritas] = await Promise.all([
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
          request('/v1/proof-publisher'),
          session.local_notifications ? request('/v1/notifications') : null,
          session.integritas_proofs ? request('/v1/integritas/proofs') : null
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
        const proofs = integritas ? [] : await Promise.all(
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
          publisher,
          notifications,
          integritas
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
        if (navigator.onLine === false) return this.offline();
        const version = ++generation;
        try {
          const session = await request('/v1/session');
          if (version !== generation) return;
          if (state.session && (state.session.id !== session.id || state.session.tenant_id !== session.tenant_id))
            clear();
          state.connected = true;
          state.session = session;
          csrf = session.csrf;
          await refresh();
        } catch (e) {
          if (version !== generation) return;
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
        if (state.connected) await this.disconnect();
        const version = ++generation;
        const result = await request('/v1/pairing/challenges', 'POST', {
          tenant_id: tenant
        });
        if (version !== generation) return;
        state.phase = 'pairing';
        state.challenge = result;
        state.error = '';
        change();
      },
      async claim() {
        const version = ++generation;
        try {
          const session = await request('/v1/pairing/session', 'POST');
          if (version !== generation) return;
          csrf = session.csrf;
          state.session = session;
          state.connected = true;
          state.challenge = null;
          state.error = '';
          await refresh();
        } catch (e) {
          if (version !== generation) return;
          state.error = e.message;
          change();
        }
      },
      async disconnect() {
        generation++;
        const revoke = state.connected ? request('/v1/session', 'DELETE') : null;
        clear();
        change();
        await revoke;
      },
      offline() {
        if (!enabled) return;
        generation++;
        clear('Offline. Reconnect and check your session to load tenant data.', 'offline');
        change();
      },
      openHistory(device) {
        state.history = {
          device, cursor: null, previous: [], page: device.history
        };
        return state.history;
      },
      closeHistory() {
        state.history = null;
      },
      async stepHistory(direction) {
        const history = state.history;
        if (!history || history.loading || !state.connected) return null;
        const newer = direction === 'newer';
        const cursor = newer ? history.previous.at(-1) : history.page?.next_cursor;
        if (cursor === undefined || (!newer && !cursor)) return null;
        const version = generation;
        history.loading = true;
        try {
          const page = await request('/v1/devices/' + encodeURIComponent(history.device.registry.id) +
            '/events?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
          if (version !== generation || state.history !== history) return null;
          if (newer) history.previous.pop();
          else history.previous.push(history.cursor);
          history.cursor = cursor;
          history.page = page;
          return history;
        } catch (error) {
          if (version === generation && state.history === history) throw error;
          return null;
        } finally {
          history.loading = false;
        }
      },
      async mutate(path, input = {}, method = 'POST') {
        await request(path, method, input);
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
