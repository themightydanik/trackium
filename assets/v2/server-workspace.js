(function (root) {
  'use strict';
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const badge = (value) => '<span class="badge synthetic">' + esc(value) + '</span>';
  const number = (value) => (typeof value === 'number' ? esc(value) : '—');
  const known = {
    draft: ['active', 'cancelled'],
    active: ['cancelled'],
    delivered: ['completed'],
    completed: [],
    cancelled: []
  };
  function button(label, action, id = '', disabled = false) {
    return (
      '<button class="button secondary" data-server-action="' +
      action +
      '" data-server-id="' +
      esc(id) +
      '" ' +
      (disabled ? 'disabled' : '') +
      '>' +
      esc(label) +
      '</button>'
    );
  }
  function schematic(shipments, devices) {
    const points = shipments
      .flatMap((s) => s.route)
      .concat(devices.map((d) => d.location.location?.gps).filter(Boolean));
    if (!points.length) return '<p>No route or GPS samples loaded.</p>';
    const minLat = Math.min(...points.map((p) => p.latitude)),
      maxLat = Math.max(...points.map((p) => p.latitude));
    const minLon = Math.min(...points.map((p) => p.longitude)),
      maxLon = Math.max(...points.map((p) => p.longitude));
    const project = (p) => [
      60 + ((p.longitude - minLon) / (maxLon - minLon || 1)) * 780,
      360 - ((p.latitude - minLat) / (maxLat - minLat || 1)) * 290
    ];
    return (
      '<div class="map-canvas"><svg viewBox="0 0 900 420" role="img" aria-label="Schematic Gateway routes and last reported positions, not navigation"><rect width="900" height="420" fill="#111f31"/>' +
      shipments
        .map(
          (s) =>
            '<polyline points="' +
            s.route.map((p) => project(p).join(',')).join(' ') +
            '" stroke="#43d7bd" stroke-width="2" stroke-dasharray="6 5" fill="none"/>'
        )
        .join('') +
      devices
        .filter((d) => d.location.location)
        .map((d) => {
          const [x, y] = project(d.location.location.gps);
          return (
            '<g><circle cx="' +
            x +
            '" cy="' +
            y +
            '" r="7" fill="#43d7bd"/><text x="' +
            (x - 40) +
            '" y="' +
            (y - 16) +
            '" fill="#c7e4df" font-size="13">' +
            esc(d.registry.label.slice(0, 24)) +
            '</text></g>'
          );
        })
        .join('') +
      '</svg><div class="map-caption">Gateway samples · schematic, not for navigation · see provenance below</div></div>'
    );
  }
  function render(page, state) {
    const can = (scope) => state.session.scopes.includes(scope),
      data = state.data;
    const heading =
      '<div class="page-heading"><div><div class="eyebrow">AUTHENTICATED GATEWAY · ' +
      esc(state.session.tenant_id) +
      '</div><h1>' +
      {
        dashboard: 'Gateway operations.',
        shipments: 'Shipments on your Gateway.',
        devices: 'Registered Gateway devices.',
        map: 'Latest reported coordinates.',
        events: 'Shipment event history.',
        proofs: 'Minima commitments & verification.',
        settings: 'Your authenticated session.'
      }[page] +
      '</h1><p>PostgreSQL data · ' +
      (state.updated
        ? 'refreshed ' +
          esc(new Date(state.updated).toLocaleTimeString()) +
          ' · polling every 3 seconds · first 25 devices/shipments'
        : 'loading') +
      ' · simulator data remains synthetic.</p></div>' +
      button('Refresh', 'refresh') +
      '</div>';
    if (!data)
      return (
        heading +
        '<div class="loading-state" role="status">Loading authenticated Gateway data…</div>'
      );
    const shipments = data.shipments,
      devices = data.devices;
    if (page === 'settings')
      return (
        heading +
        '<section class="panel settings-panel"><div class="panel-heading"><h2>Short-lived tenant session</h2>' +
        badge('Authenticated · not a device proof') +
        '</div><div class="server-content"><p>Audience: ' +
        esc(state.session.audience) +
        '<br>Expires: ' +
        esc(state.session.expires_at) +
        '<br>Scopes: ' +
        esc(state.session.scopes.join(', ')) +
        '</p><p>The session cookie is HttpOnly. No owner API key is present in the browser. Minima UID is not used as identity.</p>' +
        button('Disconnect and revoke', 'disconnect') +
        '</div></section>'
      );
    if (page === 'devices')
      return (
        heading +
        '<section class="panel"><div class="toolbar"><h2>Tenant devices</h2>' +
        button(
          'Create simulator identity',
          'device',
          '',
          !can('simulate') || !state.session.simulation_enabled
        ) +
        '</div><div class="table-wrap"><table><thead><tr><th>Device</th><th>Identity</th><th>Status</th><th>GPS</th><th>Temperature / humidity / battery</th><th>Source</th></tr></thead><tbody>' +
        devices
          .map((d) => {
            const p = d.history.events[0]?.payload ?? {},
              l = d.location.location;
            return (
              '<tr><td>' +
              esc(d.registry.label) +
              '<small class="cell-note">' +
              esc(d.registry.id) +
              '</small></td><td>' +
              esc(d.registry.identity_kind) +
              '</td><td>' +
              esc(d.status.status) +
              '</td><td>' +
              (l ? number(l.gps.latitude) + ', ' + number(l.gps.longitude) : 'No GPS') +
              '</td><td>' +
              number(p.temperature_c) +
              ' °C / ' +
              number(p.humidity_pct) +
              '% / ' +
              number(p.battery_pct) +
              '%</td><td>' +
              badge(p.trust ?? 'unverified') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div></section>'
      );
    if (page === 'map')
      return (
        heading +
        '<section class="panel server-content">' +
        schematic(shipments, devices) +
        '<h2>Coordinates from PostgreSQL</h2><p>No external map tiles or implied real-time physical tracking. These are the last reported samples; event times and provenance are shown.</p>' +
        devices
          .map((d) => {
            const l = d.location.location;
            return (
              '<div class="map-device"><strong>' +
              esc(d.registry.label) +
              '</strong><p>' +
              (l
                ? number(l.gps.latitude) + '° latitude · ' + number(l.gps.longitude) + '° longitude'
                : 'No coordinate sample') +
              '</p><small>' +
              esc(l?.occurred_at ?? 'No event time') +
              '</small>' +
              badge(l?.trust ?? 'unverified') +
              '</div>'
            );
          })
          .join('') +
        '</section>'
      );
    if (page === 'proofs')
      return (
        heading +
        '<div class="notice"><p>Engine mode: <strong>' +
        esc(data.proofMode ?? 'disabled') +
        '</strong>. Test receipts are not blockchain transactions. Confirmed is the last Gateway node observation; use Verify for a fresh check and Export for a separate trusted node. Synthetic data remains synthetic after anchoring.</p></div>' +
        '<section class="panel"><div class="table-wrap"><table><thead><tr><th>Event / date</th><th>Mode / provenance</th><th>Commitment SHA-256</th><th>TxPoW ID</th><th>State / depth</th><th>Actions</th></tr></thead><tbody>' +
        (data.proofs ?? [])
          .map(
            (p) =>
              '<tr><td>' +
              esc(p.commitment.event_type) +
              '<small class="cell-note">' +
              esc(p.created_at) +
              '</small><small class="cell-note">' +
              esc(p.shipment_id) +
              ' · #' +
              esc(p.sequence) +
              '</small></td><td>' +
              badge(p.mode) +
              badge(p.commitment.source_trust) +
              '</td><td><code class="hash-cell">' +
              esc(p.wire.slice(14)) +
              '</code></td><td><code class="hash-cell">' +
              esc(p.txpow_id ?? 'No blockchain TXID') +
              '</code></td><td>' +
              esc(p.state) +
              ' · ' +
              esc(p.confirmations) +
              '/' +
              esc(p.required_depth) +
              '<small class="cell-note">Checked: ' +
              esc(p.last_checked_at ?? 'never') +
              '</small><small class="cell-note">' +
              esc(p.last_error_code) +
              '</small></td><td>' +
              button('Verify', 'proof-verify', p.id) +
              button('Export bundle', 'proof-export', p.id) +
              '</td></tr>'
          )
          .join('') +
        '</tbody></table></div>' +
        (!(data.proofs ?? []).length
          ? '<p class="server-content">No proof records. Publishing defaults to disabled; selected outbox events are queued only when an operator enables test or live mode.</p>'
          : '') +
        '<p class="server-content">First 50 proofs per loaded shipment. API supports cursor pagination. Event commitments anchor a prefix of history; they do not prove that no later events exist.</p></section>'
      );
    if (page === 'events')
      return (
        heading +
        '<div class="notice"><p>Outbox state is worker delivery state, never blockchain proof status. See Proofs for Minima commitments. Up to 50 records per loaded shipment are shown; the API supports sequence pagination.</p></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>Event / time</th><th>Shipment</th><th>Provenance</th><th>SHA-256 / previous hash</th><th>Outbox</th></tr></thead><tbody>' +
        data.events
          .map(
            (e) =>
              '<tr><td>' +
              esc(e.event_type) +
              '<small class="cell-note">' +
              esc(e.event_time) +
              '</small></td><td>' +
              esc(shipments.find((s) => s.id === e.shipment_id)?.name ?? e.shipment_id) +
              '</td><td>' +
              badge(e.source_trust) +
              '</td><td><code class="hash-cell" title="' +
              esc(e.sha256) +
              '">' +
              esc(e.sha256) +
              '</code><small class="cell-note hash-cell">' +
              esc(e.previous_hash ?? 'Genesis') +
              '</small></td><td>' +
              esc(e.outbox_state) +
              ' · delivery only</td></tr>'
          )
          .join('') +
        '</tbody></table></div></section>'
      );
    return (
      heading +
      '<div class="notice"><p><strong>Server Simulation is distinct from Preview.</strong> Only an explicitly created simulator identity can generate samples. Starting a run is an authorized server command, not a physical tracker connection. Simulation enabled: ' +
      esc(state.session.simulation_enabled) +
      '.</p></div><section class="panel"><div class="toolbar"><h2>' +
      shipments.length +
      ' tenant shipments</h2>' +
      button('Create shipment', 'create', '', !can('shipments')) +
      '</div><div class="server-content">' +
      (shipments.length
        ? shipments
            .map((s) => {
              const run = data.simulations.find(
                (r) => r.shipment_id === s.id && ['running', 'paused'].includes(r.state)
              );
              return (
                '<article class="server-shipment"><div class="server-shipment-heading"><h2>' +
                esc(s.name) +
                '</h2>' +
                badge(s.source_trust) +
                '<strong>' +
                esc(s.status) +
                '</strong></div><small>' +
                esc(s.id) +
                '</small><p>Device: ' +
                esc(
                  devices.find((d) => d.registry.id === s.device_id)?.registry.label ?? s.device_id
                ) +
                ' · temperature ' +
                number(s.conditions.temperature_min_c) +
                '…' +
                number(s.conditions.temperature_max_c) +
                ' °C ± ' +
                number(s.conditions.tolerance_c) +
                ' °C</p><ol class="server-checkpoints">' +
                s.checkpoints
                  .map(
                    (cp) =>
                      '<li class="' +
                      (cp.visited_at ? 'visited' : '') +
                      '">' +
                      esc(cp.name) +
                      ' · ' +
                      (cp.visited_at ? 'reached ' + esc(cp.visited_at) : 'pending') +
                      '</li>'
                  )
                  .join('') +
                '</ol><div class="form-actions">' +
                (known[s.status] || [])
                  .map((next) =>
                    button(
                      next === 'completed'
                        ? 'Complete shipment'
                        : next === 'active'
                          ? 'Activate'
                          : 'Cancel',
                      'transition:' + next,
                      s.id,
                      !can('shipments')
                    )
                  )
                  .join('') +
                (s.status === 'active' && !run
                  ? button(
                      'Start normal simulation',
                      'start:normal',
                      s.id,
                      !can('simulate') || !state.session.simulation_enabled
                    ) +
                    button(
                      'Start temperature excursion',
                      'start:temperature-excursion',
                      s.id,
                      !can('simulate') || !state.session.simulation_enabled
                    )
                  : '') +
                (run
                  ? '<span>' +
                    badge('Synthetic run · ' + run.state + ' · step ' + run.step) +
                    '</span>' +
                    button(
                      run.state === 'running' ? 'Pause' : 'Resume',
                      run.state === 'running' ? 'pause' : 'resume',
                      run.id,
                      !can('simulate')
                    ) +
                    button('Finish simulation', 'finish', run.id, !can('simulate'))
                  : '') +
                '</div></article>'
              );
            })
            .join('')
        : '<p>No shipments. Create a simulator device in Devices, then create a draft shipment.</p>') +
      '</div></section>'
    );
  }
  function pairing(state) {
    return (
      '<section class="panel server-content"><h2>Pair this Gateway workspace</h2><p>Explicit tenant-owner approval is required. No API key or Minima UID is accepted in this form.</p><form id="server-pair-form"><label class="field-label" for="pair-tenant">Tenant UUID (public identifier)</label><input class="text-input" id="pair-tenant" required autocomplete="off"><button class="button primary" type="submit">Create one-use challenge</button></form>' +
      (state.challenge
        ? '<div class="notice"><div><strong>Owner approval required · expires in 2 minutes</strong><p>Challenge: <code id="pair-challenge">' +
          esc(state.challenge.id) +
          '</code></p><p>On the trusted Gateway host, run the owner approval CLI with the credential file for this tenant. Never paste that key here.</p>' +
          button('Check owner approval', 'claim') +
          '</div></div>'
        : '') +
      '<p role="status">' +
      esc(state.error) +
      '</p></section>'
    );
  }
  function createForm(devices) {
    return (
      '<h2 id="dialog-title">Create a Gateway shipment</h2><p>Saved in PostgreSQL for the authenticated tenant. Route points are ordered checkpoints.</p><form id="server-shipment-form"><label class="field-label">Name<input name="name" class="text-input" required maxlength="120"></label><label class="field-label">Bound device<select name="device_id" class="text-input" required>' +
      devices
        .filter((d) => d.registry.enabled)
        .map(
          (d) =>
            '<option value="' +
            esc(d.registry.id) +
            '">' +
            esc(d.registry.label) +
            ' · ' +
            esc(d.registry.identity_kind) +
            '</option>'
        )
        .join('') +
      '</select></label><label class="field-label">Ordered route JSON<textarea name="route" class="text-input" rows="7" required>' +
      esc(
        JSON.stringify(
          [
            { name: 'Wrocław', latitude: 51.11, longitude: 17.04, radius_m: 200 },
            { name: 'Kyiv', latitude: 50.45, longitude: 30.52, radius_m: 200 }
          ],
          null,
          2
        )
      ) +
      '</textarea></label><div class="sensor-cards">' +
      [
        ['min', 'Min °C', 2],
        ['max', 'Max °C', 8],
        ['tolerance', 'Tolerance °C', 1]
      ]
        .map(
          ([name, label, v]) =>
            '<label>' +
            label +
            '<input class="text-input" name="' +
            name +
            '" type="number" step="0.1" value="' +
            v +
            '" required></label>'
        )
        .join('') +
      '</div><button class="button primary" type="submit">Save draft on Gateway</button><p id="server-form-error" role="status"></p></form>'
    );
  }
  root.TrackiumServerView = { render, pairing, createForm };
})(window);
