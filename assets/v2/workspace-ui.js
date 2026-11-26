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
  const isAlert = (e) =>
    ['temperature_violation', 'temperature_excursion', 'route_deviation'].includes(e.event_type);
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
  const glyph = (kind) => '<svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ({
    shipments: '<path d="M4 11l12-6 12 6v11l-12 6-12-6zM4 11l12 6 12-6M16 17v11M10 8l12 6"/>',
    devices: '<rect x="9" y="3" width="14" height="26" rx="4"/><path d="M14 7h4m-3 17h2m-5-9h3l2-3 2 3h1"/>',
    events: '<path d="M5 16h5l3-7 5 14 3-7h6"/><circle cx="16" cy="16" r="13"/>',
    proofs: '<path d="M16 3l11 5v8c0 6-5 11-11 14-6-3-11-8-11-14V8zM11 16l3 3 7-7"/>',
    map: '<path d="M5 8l8 4 7-4 7 4v16l-7-4-7 4-8-4zM13 12v16m7-20v16"/>'
  }[kind] || '<path d="M5 26l7-8 6 3 8-13"/><circle cx="26" cy="8" r="3"/><circle cx="5" cy="26" r="2"/>') + '</svg>';
  const empty = (title, text, kind = 'map') =>
    '<div class="ux-empty"><span class="empty-glyph" aria-hidden="true">' +
    (isLite() ? '<svg class="empty-orbit" viewBox="0 0 112 80" fill="none"><path d="M3 60 39 40l36 20-36 20zM39 40l35-20 36 20-35 20zM3 40l36-20 35 20-35 20z" stroke="currentColor" opacity=".35"/><path d="M17 54 44 39m24 8 26-15" stroke="currentColor" stroke-dasharray="3 4"/><circle cx="16" cy="55" r="3" fill="currentColor"/><circle cx="96" cy="30" r="3" fill="currentColor"/></svg>' : '') + glyph(kind) + '</span><div><h3>' +
    esc(title) +
    '</h3><p>' +
    esc(text) +
    '</p></div></div>';
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
          ['Position trust', position.trust],
          ...(position.trust === 'unverified' && Date.now() - Date.parse(position.occurred_at) > 15 * 60000
            ? [['Position age', 'Older than 15 minutes']] : [])
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

  const isLite = () => document.documentElement.classList.contains('lite-workspace');
  const heading = (page, state) =>
    '<div class="page-heading"><div><div class="eyebrow">' +
    (state.session.customer ? esc(state.session.company_name) : 'TRACKIUM LITE · TENANT WORKSPACE') + '</div><h1>' +
    {
      dashboard: 'Overview',
      shipments: 'Shipments',
      devices: 'Devices',
      map: isLite() ? 'Fleet Map' : 'Routes & reported positions',
      events: 'Event history',
      proofs: 'Proof records',
      settings: state.session.customer ? 'Company settings' : 'Gateway settings'
    }[page] +
    '</h1><p>' +
    (isLite() ? (page === 'map' ? '' : 'Gateway snapshot') : state.updated
      ? 'Observed ' + date(state.updated) + ' · loaded snapshot, not a live stream'
      : 'Waiting for an authenticated observation') +
    '</p></div>' +
    action('Refresh', 'refresh', '', !isLite() && state.loading) +
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
    const stops = arr(s.checkpoints);
    const visited = stops.filter(stop => stop.visited_at).length;
    const issues = [s.route_violation && 'Route deviation recorded', s.temperature_violation && 'Temperature violation recorded'].filter(Boolean);
    const lite = isLite();
    return (
      '<article class="panel server-content server-shipment" data-view-key="shipment:' + esc(s.id) + '">' + (lite ? '<div class="freight-record"><div>' : '') + '<div class="server-shipment-heading">' +
      '<span class="ops-glyph">' + glyph('shipments') + '</span><h2>' +
      esc(s.name) +
      '</h2>' +
      badge(s.status) +
      provenanceBadge(s.source_trust) +
      '</div><p>' +
      '<span class="freight-device">' + glyph('devices') + esc(device?.registry.label || s.device_id) + '</span>' +
      '</p>' + issues.map(issue => '<p class="ops-alert">' + esc(issue) + '</p>').join('') +
      (lite ? '</div><div class="freight-checkpoints">' : '') +
      (stops.length ? '<label class="ops-progress">Checkpoint progress · ' + visited + ' / ' + stops.length +
        '<meter min="0" max="' + stops.length + '" value="' + visited + '"></meter></label>' : '') +
      (isLite() ? routeStrip(stops) : '<ol class="ux-route">' +
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
      '</ol>') + (lite ? '</div></div><footer class="freight-actions">' : '') +
      action('Open shipment', 'view-shipment', s.id) +
      shipmentActions(s, state, data) +
      (lite ? '</footer>' : '') + '</article>'
    );
  }
  function deviceTable(items) {
    return (
      '<div class="table-wrap"><table class="ux-device-table"><thead><tr><th>Device</th><th>Reported state</th><th>Temperature</th><th>Humidity</th><th>Battery</th><th>Provenance / observation time</th><th>Details</th></tr></thead><tbody>' +
      items
        .map((d) => {
          const e = d.history?.events?.[0],
            p = e?.payload || {};
          const position = C.reportedPosition(d);
          return (
            '<tr data-view-key="device:' + esc(d.registry.id) + '"><td data-label="Device"><span class="ops-glyph">' + glyph('devices') + '</span><strong>' +
            esc(d.registry.label) +
            '</strong><small class="cell-note">' +
            esc(d.registry.serial || d.registry.id) +
            '</small></td><td data-label="Reported state">' +
            (d.registry.enabled === false ? badge('Disabled', 'neutral') : d.registry.identity_kind === 'physical' && !e
              ? badge('No decoded telemetry', 'neutral') : badge(d.status?.status || 'unknown')) +
            '</td><td class="fleet-reading" data-label="Temperature">' +
            value(p.temperature_c, ' °C') +
            '</td><td class="fleet-reading" data-label="Humidity">' +
            value(p.humidity_pct, ' %') +
            '</td><td class="fleet-reading" data-label="Battery">' +
            value(p.battery_pct, ' %') +
            '</td><td data-label="Provenance / observation time">' +
            provenanceBadge(p.trust) +
            '<small class="cell-note">' +
            (d.registry.identity_kind === 'physical' && !e ? 'Awaiting a decoded observation' : observationTime(e)) +
            (d.registry.identity_kind === 'physical' ? (position
              ? '<br>Last known fix · unverified · ' + esc(position.occurred_at)
              : d.registry.serial && d.registry.enabled !== false ? '<br>Waiting for GPS' : '<br>Current position unavailable') : '') +
            '</small></td><td data-label="Details">' +
            action('Device details', 'view-device', d.registry.id) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }
  function map(data, picker = false, fleet) {
    const options = (prefix, records, name) => records.map(record =>
      '<option value="' + prefix + ':' + esc(record.id) + '">' + esc(name(record)) + '</option>').join('');
    return (
      (picker && isLite() ? '<div class="ops-map-tools"><label for="map-selection">Map objects</label>' +
        '<select class="text-input" id="map-selection"><option value="">All routes and positions</option>' +
        options('shipment', data.shipments, item => item.name) +
        options('device', data.devices.filter(C.reportedPosition).map(item => item.registry), item => item.label) +
        '</select><button class="button secondary" type="button" data-fit-report-map>Show on map</button></div>' : '') +
      '<div id="workspace-map" class="ux-geo" role="region" aria-label="Geographic routes and last reported positions"></div>' +
      '<div class="lite-map-key" aria-label="Map legend"><span class="planned">Planned checkpoints</span>' +
      (fleet ? '<span class="calculated">Calculated road route</span>' : '') +
      '<span class="reported">Last reported positions</span></div>' +
      '<p class="map-caption">' + (isLite() && document.documentElement.dataset.roadTileMaxZoom
        ? 'Road tiles where installed; geographic overview elsewhere. ' +
          (document.documentElement.dataset.roadTileDate
            ? 'Dataset date: ' + esc(document.documentElement.dataset.roadTileDate) + '. '
            : 'Dataset date unavailable. ') + 'Drag or use keyboard arrows, +/− to zoom.'
        : 'Coarse geographic basemap · drag or use keyboard arrows, +/− to zoom.') + '</p>' +
      (data.devices.some(C.reportedPosition)
        ? ''
        : '<p class="lite-position-state">No reported device positions in this page. Only eligible positions appear on the map.</p>')
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
  function routeStrip(stops) {
    if (!stops.length) return '<p class="freight-route-empty">Route not configured</p>';
    return '<ol class="freight-legs" aria-label="Planned checkpoints">' + stops.map(stop =>
      '<li class="' + (stop.visited_at ? 'reached' : '') + '"><span class="freight-node"></span><strong>' +
      esc(stop.name) + '</strong><small>' + (stop.visited_at ? 'Reached' : 'Planned') + '</small></li>'
    ).join('') + '</ol>';
  }

  function dispatchOverview(state) {
    const d = state.data;
    const active = d.shipments.filter(s => s.status === 'active');
    const flagged = d.shipments.filter(s => s.route_violation || s.temperature_violation);
    const recent = sorted(d.events, {sort: 'event_time', order: 'desc'}).slice(0, 4);
    const devices = d.devices.filter(x => x.registry.identity_kind === 'physical');
    const stats = [
      ['Active shipments', active.length, 'shipments', 'shipments'],
      ['Physical devices', devices.length, 'devices', 'devices'],
      ['Shipments with issues', flagged.length, 'events', 'shipments'],
      ['Integritas proof records', arr(d.integritas?.proofs).length, 'proofs', 'proofs']
    ];
    const stages = [['Planned', ['draft']], ['In transit', ['active']], ['Arrived', ['delivered','completed']]];
    const portfolio = '<ul class="dispatch-portfolio" aria-label="Shipment lifecycle breakdown">' +
      stages.map(([label, statuses]) => {
        const count = d.shipments.filter(s => statuses.includes(s.status)).length;
        return '<li><span>' + label + '</span><meter aria-label="' + label + '" min="0" max="' +
          Math.max(d.shipments.length, 1) + '" value="' + count + '"></meter><strong>' + count + '</strong></li>';
      }).join('') + '</ul>';
    return '<div class="dispatch-stage"><section class="dispatch-map" aria-labelledby="dispatch-map-title">' +
      '<header><div><h2 id="dispatch-map-title">Operations map</h2><p>Planned routes and eligible reported fixes</p></div>' +
      '<a class="button secondary" href="#map">Explore map</a></header>' + map(d) + '</section>' +
      '<aside class="dispatch-brief" aria-label="Dispatch summary"><h2>Fleet at a glance</h2><p>Loaded Gateway snapshot</p>' +
      '<div class="dispatch-stats">' + stats.map(([label,n,icon,path]) =>
        '<a class="ops-stat" href="#' + path + '"><span class="ops-glyph">' + glyph(icon) +
        '</span><strong>' + n + '</strong><span>' + label + '</span></a>').join('') + '</div>' +
      '<h3>Shipment lifecycle</h3>' + portfolio + '</aside></div>' +
      '<div class="dispatch-lower">' + panel('Dispatch board',
        (active.length ? active.slice(0, 4).map(s => '<article class="dispatch-record" data-view-key="dispatch:' +
          esc(s.id) + '"><header><h3>' + esc(s.name) + '</h3>' + provenanceBadge(s.source_trust) + '</header>' +
          routeStrip(arr(s.checkpoints)) + action('Open shipment', 'view-shipment', s.id) + '</article>').join('')
          : empty('No active departures', 'Active shipments appear here with their planned checkpoints.', 'shipments')) +
        '<a class="text-link" href="#shipments">Browse all shipments</a>', 'dispatch-board') +
      panel('Recent activity', recent.length ? '<ol class="dispatch-feed">' + recent.map(e =>
        '<li data-view-key="activity:' + esc(e.id) + '"><span class="ops-glyph">' + glyph('events') +
        '</span><div><strong>' + esc(eventName(e)) + '</strong><time>' + cargoEventTime(e) + '</time>' +
        provenanceBadge(e.source_trust) + '</div>' + action('Event details', 'view-event', e.id) + '</li>'
      ).join('') + '</ol><a class="text-link" href="#events">Open event history</a>' :
        empty('No recorded activity', 'Shipment events appear here after the Gateway records them.', 'events'), 'dispatch-activity') +
      '</div>';
  }

  function fleetRoute(road, selected, customer) {
    if (!selected) return '<p>Select a shipment to inspect its road plan.</p>';
    if (!customer) return '<p>Road revisions require a company sign-in.</p>';
    const entries = {
      loading:'Loading road route…', unavailable:'Road route information is unavailable.',
      pending:'Route revisions exist. No route is active.',
      changed:'Route changed while loading. Checking again on the next refresh.',
      none:'No active road route.'
    };
    const revision = road?.revision;
    if (!revision) return '<p role="status">' + entries[road?.status || 'loading'] + '</p>' +
      (road?.status === 'unavailable' ? '<button type="button" class="button secondary" data-fleet-retry>Retry route</button>' : '');
    const calc = revision.calculation;
    const route = calc?.route;
    const distance = Number.isFinite(route?.distance_m) ? (route.distance_m / 1000).toLocaleString(undefined, {maximumFractionDigits:1}) + ' km' : 'Unavailable';
    const minutes = Number.isFinite(route?.estimated_duration_s) ? Math.ceil(route.estimated_duration_s / 60) : null;
    const duration = minutes === null ? 'Unavailable' : (minutes >= 60 ? Math.floor(minutes / 60) + ' h ' : '') + minutes % 60 + ' min';
    const stops = C.roadGeometry(revision) ? revision.stops : [];
    const warnings = {
      STATIC_OSM_SNAPSHOT:'Calculated from static road data. ETA is an estimate.',
      COVERAGE_MAY_BE_INCOMPLETE:'Road network coverage may be incomplete.',
      HGV_RESTRICTIONS_MAY_BE_INCOMPLETE:'Truck restrictions may be incomplete.'
    };
    return '<div class="fleet-summary"><span class="badge">Active · v' + esc(revision.version) + '</span>' +
      '<span>' + (calc?.profile === 'truck' ? 'Truck' : calc?.profile === 'auto' ? 'Passenger car' : 'Profile unavailable') +
      '</span></div><dl class="fleet-estimates"><div><dt>Distance</dt><dd>' + distance +
      '</dd></div><div><dt>Estimated duration</dt><dd>' + duration + '</dd></div></dl>' +
      (stops.length ? '<ol class="fleet-stops" aria-label="Calculated route stops">' + stops.map((point, index) =>
        '<li><strong>' + (index === 0 ? 'Origin' : index === stops.length - 1 ? 'Destination' : 'Waypoint ' + index) +
        '</strong><span>' + point.latitude.toFixed(4) + ', ' + point.longitude.toFixed(4) + '</span></li>').join('') +
        '</ol>' : '<p role="status">Road geometry unavailable.</p>') +
      arr(calc?.warnings).filter(key => Object.hasOwn(warnings,key)).map(key => '<p class="fleet-warning">' + warnings[key] + '</p>').join('') +
      '<details><summary>Graph provenance</summary>' + fields([
        ['Graph release', calc?.graph?.id], ['Engine version', calc?.graph?.engine_version],
        ['OSM snapshot', calc?.graph?.osm_snapshot], ['Calculated at', calc?.calculated_at]
      ]) + '</details>';
  }

  function mapWorkspace(data, view, state) {
    const selected = data.shipments.find(shipment => shipment.id === view.shipment);
    const road = selected && state.roadRoute?.id === selected.id ? state.roadRoute : null;
    const filter = view.fleetFilter || 'all';
    const statuses = ['all','active','draft','delivered','completed','cancelled'];
    const query = (view.fleetQuery || '').toLowerCase().trim();
    const devices = new Map(data.devices.map(d => [d.registry.id,d]));
    const list = data.shipments.filter(shipment => (filter === 'all' || shipment.status === filter) &&
      [shipment.name, devices.get(shipment.device_id)?.registry.label].some(value => String(value || '').toLowerCase().includes(query)));
    const deviceFacts = (d) => {
      const observation = d.history?.events?.[0];
      const position = C.reportedPosition(d);
      const stamp = Date.parse(position?.occurred_at);
      const age = Math.max(0,Math.floor((Date.now()-stamp)/60000));
      const elapsed = age >= 1440 ? Math.floor(age/1440) + ' d' : age >= 60 ? Math.floor(age/60) + ' h' : age + ' min';
      return fields([
        ['Device state',d.status?.enabled === false ? 'Disabled' : d.status?.last_event_at ? 'Observation received' : 'No observations'],
        ...positionFields(d),
        ...(Number.isFinite(stamp) ? [['Observation age', elapsed + (Date.now() - stamp > 15 * 60000 ? ' · stale' : '')]] : [])
      ]) + (observation ? provenanceBadge(observation.payload?.trust) :
        position ? provenanceBadge(position.trust) : '');
    };
    const linked = selected && devices.get(selected.device_id);
    const historyCount = C.physicalBreadcrumbs(linked).length;
    const offset = linked && C.distanceFromRoad(C.reportedPosition(linked),road?.revision);
    const threshold = selected?.conditions?.max_deviation_m;
    const movement = linked?.registry.identity_kind === 'physical' ?
      '<p>' + (historyCount ? historyCount + ' recent physical breadcrumbs · unverified' : 'Waiting for physical GPS history') + '</p>' +
      (Number.isFinite(offset) ? '<p>Approximate distance from active road: ' + offset + ' m' +
        (Number.isFinite(threshold) && offset > threshold ? ' · outside shipment tolerance' : '') +
        ' · advisory only</p>' : '') : '';
    const layers = view.layers || {};
    const planner = root.TrackiumRoutePlanner;
    return '<div class="fleet-map-workspace"><section class="fleet-map-canvas" aria-label="Fleet map canvas">' +
      '<div class="fleet-map-toolbar"><fieldset><legend class="sr-only">Map layers</legend>' +
      [['planned','Planned'],['calculated','Road route'],['observed','Reported GPS']].map(([key,label]) =>
        '<label><input type="checkbox" data-fleet-layer="' + key + '" ' + (layers[key] !== false ? 'checked' : '') + '>' +
        '<span>' + label + '</span></label>').join('') + '</fieldset>' +
        '</div>' +
      (view.planner ? '<p class="planner-map-note">' + (view.planner.pick == null
        ? 'Dotted circles show draft stops. Dashed violet lines show the calculated preview.'
        : 'Choose a point on the map or press Enter to use the map center.') + '</p>' : '') +
      map(data,true,true) + '</section><aside class="fleet-manifest" aria-labelledby="fleet-manifest-heading">' +
      '<h2 id="fleet-manifest-heading">Shipments <span>' + data.shipments.length + '</span></h2>' +
      '<label class="sr-only" for="fleet-query">Search shipments or devices</label><input id="fleet-query" class="text-input" type="search" placeholder="Search shipments or devices" value="' +
      esc(view.fleetQuery || '') + '"><label class="sr-only" for="fleet-filter">Shipment status</label>' +
      '<select class="text-input" id="fleet-filter">' + statuses.map(key => '<option value="' + key + '"' +
        (filter === key ? ' selected' : '') + '>' + (key === 'all' ? 'All shipment statuses' : C.label(key)) + '</option>').join('') + '</select>' +
      '<div class="fleet-manifest-list">' + (list.length ? list.map(s =>
        '<button type="button" data-view-key="fleet:' + esc(s.id) + '" data-fleet-shipment="' + esc(s.id) + '" aria-pressed="' +
        String(s === selected) + '"><span><strong>' + esc(s.name) + '</strong><small>' +
        esc(devices.get(s.device_id)?.registry.label || 'Device not on this page') + '</small></span><span class="badge">' +
        esc(C.label(s.status)) + '</span></button>').join('') : '<p>' +
        (data.shipments.length ? 'No shipments match these filters.' : 'No shipments on this page.') + '</p>') + '</div>' +
      C.pagination('shipments',state) + '</aside>' +
      '<section class="fleet-context" aria-label="Shipment context"><header><div><h2>' +
      (selected ? esc(selected.name) : 'Shipment context') + '</h2></div>' +
      (selected ? '<div class="fleet-context-actions">' +
        (planner.allowed(state.session) && !view.planner ? '<button type="button" class="button secondary" data-planner="import">Plan from checkpoints</button>' +
          '<button type="button" class="button secondary" data-planner="blank">Start blank route</button>' +
          (C.roadGeometry(road?.revision) ? '<button type="button" class="button secondary" data-planner="active">Edit active road as draft</button>' : '') : '') +
        '<button class="button secondary" type="button" data-fleet-fit>Fit shipment</button>' +
        action('Shipment details','view-shipment',selected.id) + '</div>' : '') + '</header>' +
      '<div class="fleet-context-grid"><div><h3>Calculated road route</h3>' + fleetRoute(road,selected,state.session.customer) +
      '</div><div><h3>Planned checkpoints</h3>' + (selected ? routeStrip(arr(selected.checkpoints?.length ? selected.checkpoints : selected.route)) :
        '<p>Select a shipment to see its planned stops.</p>') +
      (linked ? '<h3>' + esc(linked.registry.label) + '</h3>' + deviceFacts(linked) + movement : '') + '</div></div></section>' +
      (view.planner ? planner.render(view.planner,root.TrackiumRouteLifecycle.proposal(view.lifecycle,view.planner)) : '') +
      root.TrackiumRouteLifecycle.render(view.lifecycle) +
      '<details class="fleet-directory"><summary>Device observations · ' + data.devices.length + '</summary>' +
      (data.devices.length ? '<ul class="geo-directory">' + data.devices.map(d =>
        '<li data-view-key="geo:' + esc(d.registry.id) + '"><span class="ops-glyph">' + glyph('devices') +
        '</span><div><strong>' + esc(d.registry.label) + '</strong>' + deviceFacts(d) + '</div>' +
        action('Device details','view-device',d.registry.id) + '</li>').join('') + '</ul>' :
        '<p>No devices on this page.</p>') + C.pagination('devices',state) + '</details></div>';
  }

  function proofJourney(proof) {
    const checks = [
      ['Prepared', ['prepared','submitted','pending','anchored','verified'].includes(proof.status)],
      ['Test transport', ['submitted','anchored','verified'].includes(proof.status)],
      ['Evidence checked', proof.status === 'verified']
    ];
    return '<ol class="proof-journey" aria-label="Test evidence progress">' + checks.map(([label, done]) =>
      '<li class="' + (done ? 'reached' : '') + '"><span class="freight-node"></span>' + label +
      '<span class="sr-only">' + (done ? ' · recorded' : ' · not shown as completed') + '</span></li>'
    ).join('') + '</ol>';
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
    if (page === 'dashboard' && isLite()) body = dispatchOverview(state);
    else if (page === 'dashboard')
      body =
        '<div class="ops-overview-metrics" aria-label="Loaded workspace metrics">' +
        [
          ['Active shipments', d.shipments.filter(s => s.status === 'active').length, 'shipments', 'shipments'],
          ['Physical devices', d.devices.filter(device => device.registry.identity_kind === 'physical').length, 'devices', 'devices'],
          ['Shipments with issues', d.shipments.filter(s => s.route_violation || s.temperature_violation).length, 'events', 'shipments'],
          ['Integritas proof records', arr(d.integritas?.proofs).length, 'proofs', 'proofs']
        ].map(([label, n, icon, path]) =>
          '<a class="ops-stat" href="#' + path + '"><span class="ops-glyph">' + glyph(icon) + '</span><span>' +
          label + '</span><strong>' + n + '</strong></a>'
        ).join('') +
        '</div><div class="ux-dashboard-grid ops-operations">' +
        panel('Routes & positions', map(d) + '<a class="text-link" href="#map">Open map →</a>') +
        panel(
          'Activity',
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
        '<div class="toolbar freight-toolbar"><strong>Shipment manifest</strong>' +
        action('Create shipment', 'create', '', !can('shipments')) +
        '</div><div class="' + (isLite() ? 'freight-manifest' : 'ux-card-grid') + '">' +
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
          state.session?.customer && (!state.session.demo || state.session.pilot) ? 'My Devices' : 'Device inventory',
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
    if (page === 'devices' && isLite()) {
      const physical = d.devices.filter(x => x.registry.identity_kind === 'physical');
      const reported = d.devices.filter(C.reportedPosition);
      body = '<dl class="fleet-counters" aria-label="Loaded device inventory">' +
        [['Registered on this page', d.devices.length, 'devices'], ['Physical identities', physical.length, 'shipments'],
         ['Eligible reported fixes', reported.length, 'map']].map(([label, n, icon]) =>
           '<div><span class="ops-glyph">' + glyph(icon) + '</span><dt>' + label + '</dt><dd>' + n + '</dd></div>'
         ).join('') + '</dl>' + body;
    }
    if (page === 'devices') body += C.pagination('devices', state);
    if (page === 'map' && isLite()) body = mapWorkspace(d, view, state);
    else if (page === 'map')
      body =
        panel('Routes & last reported locations', map(d, true)) +
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
        (isLite() ? '<div class="event-brief"><span class="ops-glyph">' + glyph('events') +
          '</span><div>Warnings <strong>' + d.events.filter(isAlert).length + '</strong></div>' +
          '<div>Recorded events <strong>' + d.events.length + '</strong></div></div>' : '') +
        search(page, view, d) +
        panel(
          'Recorded event timeline',
          '<p>First 50 events per loaded shipment. Outbox status records delivery only.</p><ol class="ux-timeline event-register">' +
            selected(d.events, view, 'event_time')
              .map(
                (e) =>
                  '<li data-view-key="event:' + esc(e.id) + '" class="' +
                  (isAlert(e) ? 'ops-event-alert' : 'ops-event') +
                  '"><span class="ops-glyph">' + glyph('events') + '</span><div class="section-title"><h3>' +
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
      const cards = d.integritas.proofs.map(proof => {
        const label = ({
          prepared: 'Evidence prepared', pending: 'Awaiting processing', submitted: 'Submitted to test transport',
          anchored: 'Provider reports an anchor', verified: 'Test evidence checked',
          unknown: 'Result unknown', failed: 'Processing failed'
        })[proof.status] || 'Result unknown';
        const shipment = d.shipments.find(record => record.id === proof.shipment_id);
        return '<article class="ops-proof" data-view-key="integritas:' + esc(proof.id) +
          '"><header><span class="ops-glyph">' + glyph('proofs') + '</span><div><h3>Integritas · TEST_ONLY</h3>' +
          '<strong>' + esc(label) + '</strong></div></header>' +
          '<p>' + esc(shipment?.name || proof.shipment_id) + '</p><p>' + esc(C.label(proof.event_type)) +
          ' · ' + date(proof.created_at) + '</p>' + provenanceBadge(proof.source_trust) +
          proofJourney(proof) + '<p class="ops-proof-boundary">No blockchain confirmation</p>' +
          '<div class="form-actions">' + action('Recheck test evidence', 'integritas-verify', proof.id) +
          action('Export test evidence', 'integritas-export', proof.id) + '</div>' +
          '<details class="ops-disclosure"><summary>Technical evidence</summary>' + fields([
            ['Proof ID', proof.id], ['Cargo event ID', proof.event_id], ['Network', proof.network],
            ['Operation ID', proof.operation_id], ['Error', proof.error]
          ]) + '</details></article>';
      });
      body = panel('Integritas proofs', cards.length ? '<div class="lite-proof-grid">' + cards.join('') + '</div>'
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
      body = '<div class="settings-workbench"><section aria-label="Appearance">' + TrackiumAppearance.form() +
        '</section>' + (d.notifications ? '<section aria-label="Notifications">' + notificationPanel(d.notifications) +
          '</section>' : '') + '</div>';
    if (page === 'settings' && !state.session.customer) {
      const original = old().querySelector('section.settings-panel');
      const appearance = root.TrackiumAppearance.form();
      const connection = panel(
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
        );
      const technical = '<details class="panel ux-advanced"><summary>Session & technical details</summary>' +
        (original?.innerHTML || '') + '</details>';
      body = (isLite() ? '<div class="settings-workbench"><section aria-label="Appearance">' + appearance +
        '</section><section aria-label="Connection and access">' + connection + technical + '</section></div>' :
        appearance + connection + technical) + notificationPanel(d.notifications);
    }
    const age = state.updated ? Date.now() - Date.parse(state.updated) : 0;
    return (
      heading(page, state) +
      (isLite() ? '' : '<div class="ux-observation" role="status">' +
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
      '</div>') +
      body
    );
  }
  function deviceDiagnostics(d) {
    const observation = d.observation;
    const position = d.position;
    const packet = d.packet;
    const ingestion = {
      pending: 'Pending processing or retry', rejected: 'Processing failure',
      unbound: 'No eligible binding at ingestion', processed: 'Processed',
      not_applicable: 'Packet is outside telemetry ingestion'
    };
    const packetResult = { checksum: 'Checksum mismatch', message_decode: 'Message decode failed',
      ingestion: 'Telemetry ingestion rejected the packet' };
    const reasons = {
      device_disabled: 'Device disabled', unbound_device: 'Unbound device',
      no_decoded_observation: 'No decoded observation', legacy_parser: 'Earlier parser version',
      invalid_device_time: 'Clock anomaly: invalid timestamp',
      future_device_time: 'Clock anomaly: future timestamp',
      no_gnss_fix: 'GNSS Unfix', invalid_position: 'Invalid position',
      buffered_report: 'Buffered report', delayed_report: 'Delayed report or clock lag',
      out_of_order: 'Out-of-order observation', conflicting_fixes: 'Conflicting fixes in the same second',
      eligible: 'Eligible real-time fix'
    };
    return '<p class="lab-observation-state">' + esc(d.binding === 'active' ? 'Active binding' : 'Unbound device') +
      ' · ' + esc(d.packet_recency === 'recent' ? 'Recent packet' : 'No recent data') +
      ' · ' + provenanceBadge(d.trust) + '</p>' + fields([
        ['Last packet received (UTC)', packet?.received_at],
        ['Packet processing', packetResult[packet?.failure_stage] ??
          (packet?.decoding === 'opaque' ? 'Unsupported message retained in journal' :
            packet?.decoding === 'failed' ? 'Processing failure' : ingestion[packet?.ingestion])],
        ['Last decoded observation received (UTC)', observation?.received_at],
        ['Device measurement time (UTC)', observation?.measured_at],
        ['Latest valid GNSS measurement (UTC)', d.last_valid_gnss_at],
        ['GNSS', { fix: 'Fix', unfix: 'Unfix' }[observation?.gnss]],
        ['Delivery', { buffered: 'Buffered', real_time: 'Real-time' }[observation?.delivery]],
        ['Receive minus measurement', observation?.receive_lag_ms == null ? null : observation.receive_lag_ms + ' ms'],
        ['Observation eligibility', reasons[position.reason]],
        ['Last-known position age', position.last_known ? (position.last_known.stale ? 'Older than 15 minutes' : 'Within 15 minutes') : null],
        ['Last known fix (UTC)', position.conflict ? 'Unavailable: conflicting fixes' : position.last_known_at]
      ]) + '<details class="ops-disclosure"><summary>Packet & parser details</summary>' + fields([
        ['Last received packet reference', packet?.packet_ref],
        ['Last received message type', Number.isInteger(packet?.message_id)
          ? '0x' + packet.message_id.toString(16).padStart(4,'0') : null],
        ['Parser version', observation?.parser_version], ['Linked observation packet reference', observation?.packet_ref]
      ]) + '</details>';
  }
  function physicalDeviceLab(id) {
    const now = new Date(Math.ceil(Date.now() / 60000) * 60000);
    const yesterday = new Date(now - 86400000);
    return '<div data-device-lab>' + panel('Physical Device Lab',
      '<div class="lab-signal-flow" aria-label="Device observation path"><span>' + glyph('devices') +
      'Tracker</span><span>' + glyph('events') + 'Gateway receipt</span><span>' + glyph('map') +
      'Measurement history</span></div>' +
      '<div class="form-actions">' +
      action('Read now', 'load-device-diagnostics', id) +
      action('Start monitoring', 'start-device-diagnostics', id) +
      action('Stop monitoring', 'stop-device-diagnostics', id) +
      '</div><p data-device-diagnostics-state role="status">Monitoring is off.</p>' +
      '<div data-device-diagnostics></div>' +
      '<div class="ops-lab-history"><h3>Position history</h3><p>Coarse geographic basemap. Points are discrete unverified fixes.</p>' +
      '<div class="ux-geo" data-device-lab-map role="region" aria-label="Physical device positions" hidden></div>' +
      action('Fit recorded positions', 'fit-device-lab-map', id) +
      '<div class="form-actions"><label>From (UTC)<input class="text-input" type="datetime-local" name="lab-from" value="' +
      yesterday.toISOString().slice(0, 16) + '"></label>' +
      '<label>To (UTC)<input class="text-input" type="datetime-local" name="lab-to" value="' +
      now.toISOString().slice(0, 16) + '"></label>' +
      action('Load period', 'load-device-lab-range', id) + '</div>' +
      '<p data-device-lab-range-state role="status"></p><div data-device-lab-rows></div>' +
      '<label><input type="checkbox" name="lab-export-coordinates"> Include precise coordinates in JSON</label><p>Share diagnostic files only with authorized recipients.</p>' +
      action('Export period JSON', 'export-device-diagnostics', id, true) + '</div>') + '</div>';
  }
  function deviceLabHistory(range) {
    return '<ol class="ux-timeline">' + range.observations.map(row => '<li>' + fields([
      ['Gateway received (UTC)', row.received_at],
      ['Measured (UTC)', row.measured_at],
      ['GNSS', row.fix == null ? null : row.fix ? 'Fix' : 'Unfix'],
      ['Delivery', row.buffered == null ? null : row.buffered ? 'Buffered' : 'Real-time'],
      ['Signal (raw code)', row.signal_raw_code],
      ['Satellites (raw code)', row.satellites_raw_code],
      ['Unverified position', row.position ? row.position.latitude + ', ' + row.position.longitude : null]
    ]) + '</li>').join('') + '</ol>';
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
              '<div class="ux-sensors freight-temperature">' +
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
          (isLite() ? routeStrip(arr(record.checkpoints)) : '') + '<ol class="ux-timeline">' +
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
          ...(d.registry.serial ? [['Serial number', d.registry.serial]] : []),
          ['Identity', d.registry.identity_kind],
          ['Status', d.status?.status],
          ...positionFields(d),
          ...observationFields(latest),
          ['Observation trust', latest?.payload?.trust]
        ]) +
        '<div class="ux-sensors freight-temperature">' +
        metric('Temperature', latest?.payload?.temperature_c, ' °C') +
        metric('Humidity', latest?.payload?.humidity_pct, ' %') +
        metric('Battery', latest?.payload?.battery_pct, ' %') +
        '</div>' +
        (d.registry.identity_kind === 'physical' && !latest
          ? empty('No decoded telemetry yet', 'Check Gateway packet receipt in Physical Device Lab.', 'devices')
          : '') +
        (d.registry.identity_kind === 'physical' && !data.nativeWorkspace
          ? physicalDeviceLab(d.registry.id)
          : '') +
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
    deviceDiagnostics,
    deviceLabHistory,
    deviceHistory,
    createForm,
    route,
    observation
  };
})(window);
