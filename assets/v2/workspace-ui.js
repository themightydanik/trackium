(function (root) {
  'use strict';
  const legacy = root.TrackiumServerView;
  const C = root.TrackiumComponents;
  let verificationEvidence = {};
  const sorted = (items, view, key = 'name') =>
    [...items].sort((a, b) => {
      const field = view.sort || key;
      const cmp = String(a[field] ?? a.registry?.[field] ?? '').localeCompare(
        String(b[field] ?? b.registry?.[field] ?? ''),
        undefined,
        { numeric: true }
      );
      return view.order === 'desc' ? -cmp : cmp;
    });
  const selected = (items, view, key) =>
    sorted(
      items.filter((r) => matches(r.registry || r, view)),
      view,
      key
    );
  const eventName = (e) => C.label(e.event_type);
  const deviceLink = (id, data) =>
    action(
      data.devices.find((d) => d.registry.id === id)?.registry.label || 'Device details',
      'view-device',
      id,
      !data.devices.some((d) => d.registry.id === id)
    );
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[c]
    );
  const arr = (v) => (Array.isArray(v) ? v : []);
  const value = (v, unit = '') =>
    v === null || v === undefined || v === '' ? 'Not reported' : esc(v) + unit;
  const date = (v) => (v ? esc(new Date(v).toLocaleString()) : 'Not reported');
  const badge = (label, kind = 'neutral') =>
    '<span class="badge ' + kind + '">' + esc(label ?? 'Unknown') + '</span>';
  const action = (label, type, id = '', disabled = false) =>
    '<button class="button secondary" data-server-action="' +
    type +
    '" data-server-id="' +
    esc(id) +
    '" ' +
    (disabled ? 'disabled' : '') +
    '>' +
    esc(label) +
    '</button>';
  const panel = (title, body, cls = '') =>
    '<section class="panel server-content ' +
    cls +
    '"><div class="section-title"><h2>' +
    esc(title) +
    '</h2></div>' +
    body +
    '</section>';
  const empty = (title, text) =>
    '<div class="ux-empty"><span class="empty-glyph" aria-hidden="true">◇</span><h3>' +
    esc(title) +
    '</h3><p>' +
    esc(text) +
    '</p></div>';
  const metric = (label, v, unit = '') =>
    '<div class="ux-metric"><span>' +
    esc(label) +
    '</span><strong>' +
    value(v, unit) +
    '</strong></div>';
  const fields = (rows) =>
    '<dl class="evidence-grid">' +
    rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + value(v) + '</dd></div>').join('') +
    '</dl>';
  const receiptTime = (event) => event?.payload?.event_time_basis === 'gateway_received_at';
  const observationFields = (event) =>
    receiptTime(event)
      ? [
          ['Gateway received', event.received_at ?? event.occurred_at],
          [event.payload.device_measured_at ? 'Device measurement time (UTC)' : 'Device measurement time',
            event.payload.device_measured_at ?? 'Unavailable']
        ]
      : [[
          event?.payload?.trust === 'synthetic' ? 'Synthetic sample time' : 'Device measurement time',
          event?.occurred_at
        ]];
  const observationTime = (event) =>
    receiptTime(event)
      ? 'Gateway received: ' + date(event.received_at ?? event.occurred_at) +
        (event.payload.device_measured_at
          ? ' · Device measurement time (UTC): ' + esc(event.payload.device_measured_at)
          : ' · Device measurement time unavailable') +
        (event.payload.extra?.buffered === true ? ' · Buffered' : '')
      : date(event?.occurred_at);
  const provenanceBadge = (trust) =>
    badge(trust || 'unknown', trust === 'synthetic' ? 'synthetic' : 'neutral');
  function cargoObservation(event) {
    if (event.event_type !== 'telemetry_recorded') return null;
    try {
      return {
        occurred_at: event.event_time,
        payload: JSON.parse(event.canonical_payload)?.data?.payload
      };
    } catch {
      return null;
    }
  }
  const cargoEventTime = (event) =>
    observationTime(cargoObservation(event) ?? { occurred_at: event.event_time });
  function positionFields(device) {
    const position = C.reportedPosition(device);
    return position
      ? [
          [position.trust === 'synthetic' ? 'Synthetic position time' : 'Last known fix (UTC)', position.occurred_at],
          ...(position.received_at ? [['Gateway received', position.received_at]] : []),
          ['Latitude', position.gps.latitude],
          ['Longitude', position.gps.longitude],
          ['Position trust', position.trust]
        ]
      : [['Current position', 'Unavailable']];
  }
  const stateLabel = (p) =>
    ({
      created: 'Created · no inclusion evidence',
      pending: 'Pending · no inclusion evidence',
      submitting: 'Pending · no inclusion evidence',
      submitted: 'Submitted · inclusion not established',
      included: 'Inclusion observed · confirmation depth may change',
      confirmed: 'Gateway reports confirmed · independently recheck',
      failed: 'Failed / blocked · inspect reported error',
      retryable_error: 'Failed / blocked · inspect reported error',
      blocked: 'Failed / blocked · inspect reported error'
    })[p.state] || 'Unknown · inspect Gateway evidence';

  const heading = (page, state) =>
    '<div class="page-heading"><div><div class="eyebrow">' +
    (state.session.customer ? esc(state.session.company_name) : 'TRACKIUM LITE · TENANT WORKSPACE') + '</div><h1>' +
    {
      dashboard: 'Overview',
      shipments: 'Shipments',
      devices: 'Devices',
      map: 'Routes & reported positions',
      events: 'Event history',
      proofs: 'Proof records',
      settings: state.session.customer ? 'Company settings' : 'Gateway settings'
    }[page] +
    '</h1><p>' +
    (state.updated
      ? 'Observed ' + date(state.updated) + ' · loaded snapshot, not a live stream'
      : 'Waiting for an authenticated observation') +
    '</p></div>' +
    action('Refresh', 'refresh', '', state.loading) +
    '</div>';
  function search(page, view, data) {
    const q = esc(view.query || '');
    const options = [
      'all',
      ...new Set(
        (page === 'shipments'
          ? data.shipments
          : page === 'devices'
            ? data.devices.map((d) => d.registry)
            : page === 'events'
              ? data.events
              : data.proofs
        )
          .flatMap((r) => [r.status, r.mode, r.source_trust, r.event_type, r.state])
          .filter(Boolean)
      )
    ];
    return (
      '<div class="toolbar ux-filter"><label class="search-field" for="server-search"><span>Search loaded ' +
      esc(page) +
      '</span><input id="server-search" class="text-input" type="search" value="' +
      q +
      '" placeholder="Name, identifier or status" autocomplete="off"></label><label>Filter<select id="server-filter" class="text-input">' +
      options
        .map(
          (v) =>
            '<option value="' +
            esc(v) +
            '" ' +
            (view.filter === v ? 'selected' : '') +
            '>' +
            esc(v === 'all' ? 'All records' : C.label(v)) +
            '</option>'
        )
        .join('') +
      '</select></label><label>Sort by<select id="server-sort" class="text-input">' +
      (page === 'shipments'
        ? ['name', 'status', 'created_at']
        : page === 'devices'
          ? ['label', 'id', 'mode']
          : page === 'events'
            ? ['event_time', 'event_type', 'source_trust']
            : ['created_at', 'state', 'sequence']
      )
        .map(
          (k) =>
            '<option value="' +
            k +
            '" ' +
            ((view.sort ||
              {
                shipments: 'name',
                devices: 'label',
                events: 'event_time',
                proofs: 'created_at'
              }[page]) === k
              ? 'selected'
              : '') +
            '>' +
            esc(C.label(k)) +
            '</option>'
        )
        .join('') +
      '</select></label><label>Order<select id="server-order" class="text-input"><option value="asc">Ascending</option><option value="desc" ' +
      (view.order === 'desc' ? 'selected' : '') +
      '>Descending</option></select></label><small>Only the returned snapshot is searched and sorted.</small></div>'
    );
  }
  const matches = (r, view) => {
    const fields = [
      r.name,
      r.label,
      r.id,
      r.status,
      r.state,
      r.mode,
      r.source_trust,
      r.event_type,
      r.shipment_id,
      r.identity_kind
    ].filter((v) => typeof v === 'string');
    return (
      (fields.join(' ') + ' ' + fields.map(C.label).join(' '))
        .toLowerCase()
        .includes((view.query || '').toLowerCase()) &&
      (!view.filter || view.filter === 'all' || fields.includes(view.filter))
    );
  };
  function shipmentActions(s, state, data) {
    const can = (scope) => state.session.scopes.includes(scope),
      next =
        {
          draft: ['active', 'cancelled'],
          active: ['cancelled'],
          delivered: ['completed']
        }[s.status] || [];
    const run = arr(data.simulations).find(
      (r) => r.shipment_id === s.id && ['running', 'paused'].includes(r.state)
    );
    return (
      '<div class="form-actions">' +
      (s.status === 'draft' ? action('Edit draft', 'edit-draft', s.id, !can('shipments')) : '') +
      next
        .map((n) =>
          action(
            n === 'active' ? 'Activate' : n === 'completed' ? 'Complete shipment' : 'Cancel',
            'transition:' + n,
            s.id,
            !can('shipments')
          )
        )
        .join('') +
      '</div>' +
      (state.session.simulation_enabled && can('simulate')
        ? '<div class="simulation-tools"><h3>Synthetic simulation</h3><p>Authorized server simulation; never a physical tracker connection.</p>' +
          (run
            ? badge('Synthetic run · ' + run.state) +
              action(
                run.state === 'running' ? 'Pause' : 'Resume',
                run.state === 'running' ? 'pause' : 'resume',
                run.id
              ) +
              action('Finish simulation', 'finish', run.id)
            : s.status === 'active'
              ? action('Start normal simulation', 'start:normal', s.id) +
                action('Start temperature excursion', 'start:temperature-excursion', s.id)
              : '') +
          '</div>'
        : '')
    );
  }
  function shipmentCard(s, state) {
    const data = state.data,
      device = data.devices.find((d) => d.registry.id === s.device_id);
    return (
      '<article class="panel server-content server-shipment"><div class="server-shipment-heading"><h2>' +
      esc(s.name) +
      '</h2>' +
      badge(s.status) +
      badge(s.source_trust, 'synthetic') +
      '</div><p>' +
      esc(device?.registry.label || s.device_id) +
      '</p><ol class="ux-route">' +
      arr(s.checkpoints)
        .map(
          (cp) =>
            '<li class="' +
            (cp.visited_at ? 'visited' : '') +
            '"><strong>' +
            esc(cp.name) +
            '</strong><span>' +
            (cp.visited_at ? 'Reached ' + date(cp.visited_at) : 'Arrival not recorded') +
            '</span></li>'
        )
        .join('') +
      '</ol>' +
      action('Open shipment', 'view-shipment', s.id) +
      shipmentActions(s, state, data) +
      '</article>'
    );
  }
  function deviceTable(items) {
    return (
      '<div class="table-wrap"><table class="ux-device-table"><thead><tr><th>Device</th><th>Reported state</th><th>Temperature</th><th>Humidity</th><th>Battery</th><th>Provenance / observation time</th><th>Details</th></tr></thead><tbody>' +
      items
        .map((d) => {
          const e = d.history?.events?.[0],
            p = e?.payload || {};
          return (
            '<tr><td data-label="Device"><strong>' +
            esc(d.registry.label) +
            '</strong><small class="cell-note">' +
            esc(d.registry.id) +
            '</small></td><td data-label="Reported state">' +
            badge(d.status?.status || 'unknown') +
            '</td><td data-label="Temperature">' +
            value(p.temperature_c, ' °C') +
            '</td><td data-label="Humidity">' +
            value(p.humidity_pct, ' %') +
            '</td><td data-label="Battery">' +
            value(p.battery_pct, ' %') +
            '</td><td data-label="Provenance / observation time">' +
            provenanceBadge(p.trust) +
            '<small class="cell-note">' +
            observationTime(e) +
            (d.registry.identity_kind === 'physical' ? (C.reportedPosition(d)
              ? '<br>Last known fix · unverified' : '<br>Current position unavailable') : '') +
            '</small></td><td data-label="Details">' +
            action('Device details', 'view-device', d.registry.id) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }
  function map(data) {
    return (
      '<div id="workspace-map" class="ux-geo" role="region" aria-label="Geographic routes and last reported positions"></div><p class="map-caption">Bundled coarse geographic basemap · drag or use keyboard arrows, +/− to zoom. Dashed lines are planned routes, points are last reported positions. No live tracking, external tiles or navigation service.</p>' +
      (data.devices.some(C.reportedPosition)
        ? ''
        : '<p>No reported device positions in this page. A planned route is not a measured journey.</p>')
    );
  }
  function proofCards(items, nativeWorkspace) {
    return (
      '<div class="ux-card-grid">' +
      items
        .map(
          (p) =>
            '<article class="panel server-content"><div class="section-title"><h2>' +
            esc(C.label(p.commitment?.event_type || 'Proof')) +
            '</h2>' +
            badge('minima_native · ' + p.mode, 'synthetic') +
            '</div><h3>' +
            esc(stateLabel(p)) +
            '</h3><p>Reported confirmations ' +
            value(p.confirmations) +
            ' / ' +
            value(p.required_depth) +
            '</p><p>Created ' +
            date(p.created_at) +
            ' · checked ' +
            date(p.last_checked_at) +
            '</p><p>' +
            (p.txpow_id ? 'TxPoW ' + esc(p.txpow_id) : 'No blockchain TXID') +
            '</p><p>Shipment ' +
            esc(p.shipment_id || 'Not reported') +
            '</p>' +
            (verificationEvidence[p.id]
              ? '<p class="verification-evidence">Fresh node check: ' +
                esc(verificationEvidence[p.id].result.verified ? 'passed' : 'not verified') +
                ' · ' +
                date(verificationEvidence[p.id].at) +
                ' · ' +
                esc(verificationEvidence[p.id].result.status) +
                '</p>'
              : '<p>Independent verification not established. Use Verify for a fresh configured-node observation.</p>') +
            badge(p.commitment?.source_trust || 'unknown', 'synthetic') +
            '<div class="form-actions">' +
            action('Evidence details', 'view-proof', p.id) +
            action('Verify', 'proof-verify', p.id) +
            action('Export bundle', 'proof-export', p.id) +
            (nativeWorkspace && p.publisher_kind === 'local'
              ? action('Export Local Core job', 'local-job', p.id)
              : '') +
            '</div></article>'
        )
        .join('') +
      '</div>'
    );
  }
  function notificationPanel(feed) {
    if (!feed) return '';
    const preferences = feed.preferences.enabled
      ? 'Enabled by the tenant owner.' + (feed.preferences.include_synthetic ? ' Includes synthetic events.' : '')
      : 'New notifications are disabled by the tenant owner.';
    const items = feed.notifications.map((notice) => {
      const attempts = notice.attempts === 1 ? ' attempt' : ' attempts';
      return '<li>' + esc(notice.event_type.replaceAll('_', ' ')) +
        (notice.shipment_status ? ' · ' + esc(notice.shipment_status) : '') +
        ' · shipment ' + esc(notice.shipment_id) +
        ' · ' + esc(notice.source_trust) + ' · ' + esc(notice.recorded_at) +
        ' · ' + esc(notice.state) + ' (' + esc(notice.attempts) + attempts + ')' +
        (notice.last_error ? ' · Local inbox write failed' : '') + '</li>';
    });
    return panel('Local shipment notifications',
      '<p>' + preferences + ' Delivery means an entry reached this inbox.</p>' +
      (items.length ? '<ul>' + items.join('') + '</ul>' : '<p>No notifications.</p>'));
  }
  function render(page, state, view = {}) {
    verificationEvidence = state.verifications || {};
    if (!state.data)
      return (
        heading(page, state) +
        panel(
          'Loading your workspace',
          '<div role="status" class="loading-state">Loading authenticated Gateway data…</div>'
        )
      );
    const d = state.data,
      can = (scope) => state.session.scopes.includes(scope),
      old = () => {
        const t = document.createElement('template');
        t.innerHTML = legacy.render(page, state);
        return t.content;
      };
    let body = '';
    if (page === 'dashboard')
      body =
        '<div class="summary-grid ux-summary">' +
        [
          ['Active shipments', d.shipments.filter(s => s.status === 'active').length, 'shipments'],
          ['Completed shipments', d.shipments.filter(s => s.status === 'completed').length, 'shipments'],
          ['Shipments with issues', d.shipments.filter(s => s.route_violation || s.temperature_violation).length, 'shipments'],
          ['Recently reporting devices', d.devices.filter(d => ['moving','stationary','alarm'].includes(d.status.status)
            && Date.now() - Date.parse(d.status.last_event_at) <= 15 * 60 * 1000).length, 'devices'],
          ['Devices reporting offline', d.devices.filter(d => d.status.status === 'offline').length, 'devices'],
          ['Integritas proof records', arr(d.integritas?.proofs).length, 'proofs'],
          ['Recent events', d.events.length, 'events']
        ]
          .map(
            ([label, n, path]) =>
              '<a class="panel ux-kpi" href="#' +
              path +
              '"><span>' +
              label +
              '</span><strong>' +
              n +
              '</strong><small>In the loaded snapshot →</small></a>'
          )
          .join('') +
        '</div><div class="ux-dashboard-grid">' +
        panel('Routes & positions', map(d) + '<a class="text-link" href="#map">Open map →</a>') +
        panel(
          'Recent recorded events',
          d.events.length
            ? '<ol class="ux-timeline">' +
                sorted(d.events, { sort: 'event_time', order: 'desc' })
                  .slice(0, 5)
                  .map(
                    (e) =>
                      '<li><strong>' +
                      esc(eventName(e)) +
                      '</strong><time>' +
                      cargoEventTime(e) +
                      '</time>' +
                      provenanceBadge(e.source_trust) +
                      action('Event details', 'view-event', e.id) +
                      '</li>'
                  )
                  .join('') +
                '</ol>'
            : empty(
                'No events in this snapshot',
                'New events appear after the Gateway records them.'
              )
        ) +
        '</div>' +
        panel(
          'Shipments',
          d.shipments.length
            ? '<div class="ux-card-grid">' +
                d.shipments
                  .slice(0, 3)
                  .map((s) => shipmentCard(s, state))
                  .join('') +
                '</div>'
            : empty(
                'No shipments loaded',
                'An authorized operator can create a shipment on the Shipments page.'
              )
        );
    if (page === 'shipments')
      body =
        search(page, view, d) +
        '<div class="toolbar"><p>Current shipment page · your company</p>' +
        action('Create shipment', 'create', '', !can('shipments')) +
        '</div><div class="ux-card-grid">' +
        selected(d.shipments, view, 'name')
          .map((s) => shipmentCard(s, state))
          .join('') +
        '</div>' +
        (d.shipments.filter((s) => matches(s, view)).length
          ? ''
          : empty(
              'No matching shipments',
              'Change the loaded-snapshot filters or refresh the Gateway.'
            ));
    if (page === 'shipments') body += C.pagination('shipments', state);
    if (page === 'devices')
      body =
        search(page, view, d) +
        panel(
          'Company devices',
          '<div class="toolbar"><p>Latest reported samples with measurement time and provenance.</p>' +
            action(
              'Create simulator identity',
              'device',
              '',
              !can('simulate') || !state.session.simulation_enabled
            ) +
            '</div>' +
            deviceTable(selected(d.devices, view, 'label'))
        ) +
        (d.devices.filter((x) => matches(x.registry, view)).length
          ? ''
          : empty('No matching devices', 'No device records match the loaded snapshot.'));
    if (page === 'devices') body += C.pagination('devices', state);
    if (page === 'map')
      body =
        panel('Routes & last reported locations', map(d)) +
        '<div class="ux-card-grid">' +
        d.devices
          .map((x) =>
            panel(
              x.registry.label,
              fields([
                ...positionFields(x),
                ...(x.history?.events?.length
                  ? [
                      ['Observation trust', x.history.events[0].payload?.trust],
                      ...observationFields(x.history.events[0])
                    ]
                  : [])
              ]) + action('Device details', 'view-device', x.registry.id)
            )
          )
          .join('') +
        '</div>';
    if (page === 'events')
      body =
        search(page, view, d) +
        panel(
          'Recorded event timeline',
          '<p>Outbox state describes worker delivery, never blockchain confirmation. First 50 events per loaded shipment.</p><ol class="ux-timeline">' +
            selected(d.events, view, 'event_time')
              .map(
                (e) =>
                  '<li><div class="section-title"><h3>' +
                  esc(eventName(e)) +
                  '</h3>' +
                  provenanceBadge(e.source_trust) +
                  '</div><p>' +
                  esc(d.shipments.find((s) => s.id === e.shipment_id)?.name || e.shipment_id) +
                  '</p>' +
                  deviceLink(
                    e.device_id || d.shipments.find((s) => s.id === e.shipment_id)?.device_id,
                    d
                  ) +
                  '<p>Importance: ' +
                  esc(e.severity || 'Not reported') +
                  '</p><time>' +
                  cargoEventTime(e) +
                  '</time><p>' +
                  esc(e.outbox_state || 'unknown') +
                  ' · delivery only</p>' +
                  action('Event details', 'view-event', e.id) +
                  '</li>'
              )
              .join('') +
            '</ol>'
        ) +
        (d.events.filter((e) => matches(e, view)).length
          ? ''
          : empty('No matching events', 'No event history matches the loaded snapshot.'));
    if (page === 'proofs' && d.integritas) {
      const cards = d.integritas.proofs.map((proof) => panel('Integritas · TEST_ONLY', fields([
        ['Shipment', proof.shipment_id], ['Cargo event', proof.event_type + ' · ' + proof.event_id],
        ['Provenance', proof.source_trust], ['Prepared', proof.created_at], ['Proof ID', proof.id],
        ['Operation ID', proof.operation_id || 'Unavailable'], ['Network', proof.network],
        ['Status', ({
          prepared: 'Evidence prepared', pending: 'Awaiting processing', submitted: 'Submitted to test transport',
          anchored: 'Provider reports an anchor', verified: 'Test evidence checked',
          unknown: 'Result unknown', failed: 'Processing failed'
        })[proof.status] || 'Result unknown'],
        ['Verification', 'TEST_ONLY · No blockchain confirmation'],
        ['Error', proof.error || 'None reported']
      ]) + action('Recheck test evidence', 'integritas-verify', proof.id) +
        action('Export test evidence', 'integritas-export', proof.id)));
      body = panel('Integritas proofs', cards.length ? cards.join('')
        : empty('No Integritas proofs', 'Ask the tenant owner to prepare test evidence.'));
    }
    if (page === 'proofs' && !state.session.demo) {
      const controls = state.nativeWorkspace ? old().querySelector('section.panel.server-content') : null;
      body +=
        (state.nativeWorkspace ? '' : '<h2>Native Minima proof history · read-only</h2>') +
        '<div class="notice"><p>Submission, chain inclusion and physical sensor authenticity are different claims. Gateway confirmation is a past observation; Verify performs a fresh reader check. Test receipts are not blockchain transactions.</p></div>' +
        search(page, view, d) +
        proofCards(selected(arr(d.proofs), view, 'created_at'), state.nativeWorkspace) +
        (!arr(d.proofs).filter((p) => matches(p, view)).length
          ? empty(
              'No matching proof records',
              'Publication stays governed by the existing owner policy.'
            )
          : '') +
        (controls ? '<details class="panel ux-advanced" id="native-publisher-controls"><summary>Advanced publisher policy & Local Core exchange</summary>' +
          controls.innerHTML + '</details>' : '');
    }
    if (page === 'settings' && state.session.customer)
      body = notificationPanel(d.notifications) + TrackiumAppearance.form();
    if (page === 'settings' && !state.session.customer) {
      const original = old().querySelector('section.settings-panel');
      body =
        root.TrackiumAppearance.form() +
        panel(
          'Gateway origin & tenant',
          fields([
            ['Origin', location.origin],
            ['Tenant', state.session.tenant_id],
            ['Session audience', state.session.audience],
            ['Expires', state.session.expires_at],
            ['Scopes', state.session.scopes.join(', ')]
          ]) +
            '<p>Owner-approved, short-lived session. HttpOnly cookies remain unavailable to JavaScript. No owner key or bearer-token form.</p>' +
            action('Disconnect and revoke', 'disconnect')
        ) +
        notificationPanel(d.notifications) +
        '<details class="panel ux-advanced"><summary>Session & technical details</summary>' +
        (original?.innerHTML || '') +
        '</details>';
    }
    const age = state.updated ? Date.now() - Date.parse(state.updated) : 0;
    return (
      heading(page, state) +
      '<div class="ux-observation" role="status">' +
      badge(
        navigator.onLine === false
          ? 'Offline · last loaded observation'
          : 'Authenticated observation',
        'teal'
      ) +
      (state.session.customer ? '<span>Company snapshot' : '<span>Gateway reached at last fetch · authorized scopes: ' +
      esc(state.session.scopes.join(', '))) +
      '</span>' +
      '<span>Current pages only · counts, search and sorting exclude unloaded records.</span>' +
      (age > 300000 ? badge('Snapshot older than five minutes · refresh', 'warning') : '') +
      (state.loading ? '<span>Refreshing…</span>' : '') +
      '</div>' +
      body
    );
  }
  function deviceHistory(device, history) {
    const events = arr(history?.page?.events);
    return '<section id="device-history" class="panel server-content" aria-labelledby="device-history-title">' +
      '<h3 id="device-history-title" tabindex="-1">Returned telemetry history</h3>' +
      C.positionHistory(device.registry, events) + C.chart(events) +
      (events.length
        ? '<ol class="ux-timeline">' + events.map((event) => {
            const point = C.historyPosition(device.registry, event);
            return '<li><time>' + observationTime(event) + '</time>' +
              provenanceBadge(event.payload?.trust) +
              (point ? '<p>Reported position: ' + point.latitude + ', ' + point.longitude + '</p>' : '') +
              '<div class="ux-sensors">' +
              metric('Temperature', event.payload?.temperature_c, ' °C') +
              metric('Humidity', event.payload?.humidity_pct, ' %') +
              metric('Battery', event.payload?.battery_pct, ' %') + '</div></li>';
          }).join('') + '</ol>'
        : '<p>No telemetry observations have been returned.</p>') +
      '<nav class="ux-pagination" aria-label="Device history pages">' +
      action('Newer observations', 'history-newer', device.registry.id, !history?.previous?.length) +
      '<span aria-live="polite">Page ' + ((history?.previous?.length ?? 0) + 1) + '</span>' +
      action('Older observations', 'history-older', device.registry.id, !history?.page?.next_cursor) +
      '</nav></section>';
  }
  function detail(type, id, data, evidence = {}, observed, history) {
    verificationEvidence = evidence;
    let title = 'Reported evidence',
      body = '',
      record;
    if (type === 'shipment') {
      record = data.shipments.find((s) => s.id === id);
      if (!record) return null;
      title = record.name;
      body =
        fields([
          ['Status', record.status],
          ['Device', record.device_id],
          ['Source trust', record.source_trust],
          ['Identifier', record.id]
        ]) +
        deviceLink(record.device_id, data) +
        panel(
          'Latest linked device observation',
          (() => {
            const d = data.devices.find((x) => x.registry.id === record.device_id),
              e = d?.history?.events?.[0];
            return d
              ? fields([
                  ...observationFields(e),
                  ['Temperature (°C)', e?.payload?.temperature_c],
                  ['Humidity (%)', e?.payload?.humidity_pct],
                  ['Battery (%)', e?.payload?.battery_pct],
                  ['Source trust', e?.payload?.trust]
                ])
              : '<p>Linked device is not in the current device page. Open Devices to browse it.</p>';
          })()
        ) +
        panel(
          'Cargo conditions',
          fields([
            ['Minimum temperature (°C)', record.conditions?.temperature_min_c],
            ['Maximum temperature (°C)', record.conditions?.temperature_max_c],
            ['Tolerance (°C)', record.conditions?.tolerance_c],
            ['Route deviation limit (m)', record.conditions?.max_deviation_m]
          ])
        ) +
        panel(
          'Route & checkpoints',
          '<ol class="ux-timeline">' +
            arr(record.checkpoints)
              .map(
                (cp) =>
                  '<li><h3>' +
                  esc(cp.name) +
                  '</h3>' +
                  fields([
                    ['Latitude', cp.latitude],
                    ['Longitude', cp.longitude],
                    ['Visited', cp.visited_at],
                    ['Source trust', cp.source_trust]
                  ]) +
                  '</li>'
              )
              .join('') +
            '</ol>'
        ) +
        panel(
          'Event history',
          arr(data.events)
            .filter((e) => e.shipment_id === id)
            .map(
              (e) =>
                '<p>' +
                esc(eventName(e)) +
                ' · ' +
                cargoEventTime(e) +
                ' · ' +
                esc(e.source_trust) +
                '</p>'
            )
            .join('') || 'No events'
        ) +
        panel('Linked proofs', proofCards(arr(data.proofs).filter((p) => p.shipment_id === id), data.nativeWorkspace));
    } else if (type === 'device') {
      const d = data.devices.find((x) => x.registry.id === id);
      if (!d) return null;
      record = d;
      title = d.registry.label;
      const latest = d.history?.events?.[0];
      body =
        fields([
          ['Identifier', d.registry.id],
          ['Identity', d.registry.identity_kind],
          ['Status', d.status?.status],
          ...positionFields(d),
          ...observationFields(latest),
          ['Observation trust', latest?.payload?.trust]
        ]) +
        '<div class="ux-sensors">' +
        metric('Temperature', latest?.payload?.temperature_c, ' °C') +
        metric('Humidity', latest?.payload?.humidity_pct, ' %') +
        metric('Battery', latest?.payload?.battery_pct, ' %') +
        '</div>' +
        deviceHistory(d, history ?? { page: d.history });
    } else {
      record = arr(type === 'proof' ? data.proofs : data.events).find((e) => e.id === id);
      if (!record) return null;
      title = type === 'proof' ? 'Proof evidence' : record.event_type;
      const event = type === 'event' ? cargoObservation(record) : null;
      body = fields(
        type === 'proof'
          ? [
              ['Shipment', record.shipment_id],
              [
                'Device',
                record.commitment?.device_id ||
                  data.shipments.find((s) => s.id === record.shipment_id)?.device_id
              ],
              ['Created', record.created_at],
              ['State', stateLabel(record)],
              ['Confirmations', record.confirmations],
              ['Required depth', record.required_depth],
              ['Last checked', record.last_checked_at],
              ['Source trust', record.commitment?.source_trust],
              ['TxPoW', record.txpow_id],
              ['Commitment', record.wire?.slice(14)],
              ['Error', record.last_error_code]
            ]
          : [
              ['Event', record.event_type],
              ...(event ? observationFields(event) : [['Event time', record.event_time]]),
              ['Shipment', record.shipment_id],
              ['Source trust', record.source_trust],
              ['SHA-256', record.sha256],
              ['Previous hash', record.previous_hash],
              ['Outbox', record.outbox_state]
            ]
      );
    }
    return (
      '<h2 id="dialog-title">' +
      esc(title) +
      '</h2><p>Reported evidence only. Measurement time, source trust and fetch time are separate; missing readings are not zeros.</p>' +
      body +
      '<p>Last successful workspace fetch: ' +
      date(observed) +
      '</p><details class="ux-advanced"><summary>' +
      (type === 'device' ? 'Initial workspace snapshot (raw)' : 'Advanced Raw Data') +
      '</summary><pre>' + esc(JSON.stringify(record, null, 2)) +
      '</pre></details>'
    );
  }
  function stopFields(p, i) {
    return (
      '<div data-route-stop><h3>Stop ' +
      (i + 1) +
      '</h3>' +
      [
        ['name', 'Name', 'text'],
        ['latitude', 'Latitude', 'number'],
        ['longitude', 'Longitude', 'number'],
        ['radius_m', 'Radius (m)', 'number']
      ]
        .map(
          ([key, label, type]) =>
            '<label>' +
            label +
            '<input class="text-input" data-route-field="' +
            key +
            '" type="' +
            type +
            '" ' +
            (type === 'number' ? 'step="any"' : '') +
            ' value="' +
            esc(p[key] ?? '') +
            '" required></label>'
        )
        .join('') +
      '<button class="button secondary" type="button" data-route-remove>Remove stop</button></div>'
    );
  }
  function createForm(devices, draft, customer = false) {
    const t = document.createElement('template');
    t.innerHTML = legacy.createForm(devices, draft);
    const raw = t.content.querySelector('[name=route]');
    const points = customer && !draft ? [{ radius_m: 200 }, { radius_m: 200 }] : JSON.parse(raw.value);
    raw.closest('label').outerHTML =
      '<fieldset class="ux-route-editor"><legend>Draft route · edit stops before saving</legend><div id="route-stops">' +
      points.map(stopFields).join('') +
      '</div><button class="button secondary" type="button" data-route-add>Add route stop</button><p>2–32 ordered checkpoints; the Gateway validates the final route.</p><details><summary>Advanced route JSON</summary><label>Route JSON<textarea id="advanced-route-json" class="text-input" rows="6">' +
      esc(JSON.stringify(points, null, 2)) +
      '</textarea></label><button class="button secondary" type="button" data-route-apply>Use JSON stops</button></details><p id="route-feedback" role="status"></p></fieldset>';
    return t.innerHTML;
  }
  function route(form) {
    return [...form.querySelectorAll('[data-route-stop]')].map((stop) =>
      Object.fromEntries(
        ['name', 'latitude', 'longitude', 'radius_m'].map((key) => [
          key,
          key === 'name'
            ? stop.querySelector('[data-route-field=' + key + ']').value
            : Number(stop.querySelector('[data-route-field=' + key + ']').value)
        ])
      )
    );
  }
  document.addEventListener('click', (event) => {
    const add = event.target.closest('[data-route-add]'),
      remove = event.target.closest('[data-route-remove]'),
      apply = event.target.closest('[data-route-apply]');
    if (!add && !remove && !apply) return;
    const form = event.target.closest('form'),
      list = form.querySelector('#route-stops'),
      feedback = form.querySelector('#route-feedback');
    if (add) {
      if (list.children.length >= 32) {
        feedback.textContent = 'Maximum 32 stops.';
        return;
      }
      list.insertAdjacentHTML('beforeend', stopFields({}, list.children.length));
      list.lastElementChild.querySelector('input').focus();
    }
    if (remove) {
      if (list.children.length <= 2) {
        feedback.textContent = 'At least two stops are required.';
        return;
      }
      remove.closest('[data-route-stop]').remove();
    }
    if (apply) {
      try {
        const points = JSON.parse(form.querySelector('#advanced-route-json').value);
        if (
          !Array.isArray(points) ||
          points.length < 2 ||
          points.length > 32 ||
          points.some((p) => !p || typeof p !== 'object')
        )
          throw Error();
        list.innerHTML = points.map(stopFields).join('');
        feedback.textContent = 'Draft stops updated; nothing saved yet.';
      } catch (_) {
        feedback.textContent = 'Enter an array of 2–32 route points.';
      }
    }
  });
  function observation(title, result) {
    return (
      '<h2 id="dialog-title">' +
      esc(title) +
      '</h2>' +
      fields(
        Object.entries(result)
          .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
          .slice(0, 40)
          .map(([k, v]) => [k.replaceAll('_', ' '), v])
      ) +
      '<p>Connected peers and a recent tip do not establish global synchronization. Inspect the actual Core before any separately authorized operation.</p><details><summary>Advanced Raw Data</summary><pre>' +
      esc(JSON.stringify(result, null, 2)) +
      '</pre></details>'
    );
  }
  root.TrackiumServerView = {
    ...legacy,
    render,
    detail,
    deviceHistory,
    createForm,
    route,
    observation
  };
})(window);
