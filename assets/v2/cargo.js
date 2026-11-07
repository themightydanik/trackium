(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) =>
    String(value == null ? '' : value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const icons = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    shipments: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7 5l10 4"/>',
    devices:
      '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 6h4M10 18h4M10 10h4v4h-4z"/>',
    map: '<path d="M9 19l-6 3V5l6-3 6 3 6-3v17l-6 3-6-3zM9 2v17M15 5v17"/>',
    events:
      '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="19" r="2"/>',
    proofs: '<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12h6M12 9v6"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z"/><circle cx="12" cy="10" r="2.5"/>',
    temperature: '<path d="M9 14V5a3 3 0 016 0v9a5 5 0 11-6 0M12 9v8"/>',
    humidity: '<path d="M12 2S5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2zM8 16a4 4 0 004 3"/>',
    battery:
      '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 10v4M10 10v4M14 10v4"/>',
    alert: '<path d="M12 3L2 21h20L12 3zM12 9v5M12 17v1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    signal: '<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>'
  };
  const icon = (name, cls = '') =>
    '<svg class="icon ' +
    cls +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (icons[name] || icons.devices) +
    '</svg>';
  const pages = [
    ['dashboard', 'Dashboard'],
    ['shipments', 'Shipments'],
    ['devices', 'Devices'],
    ['map', 'Live Map'],
    ['events', 'Events'],
    ['proofs', 'Proofs'],
    ['settings', 'Settings / Gateway']
  ];
  const client = new TrackiumGateway.GatewayClient();
  const state = {
    demo: false,
    loading: false,
    data: { devices: [], shipments: [], events: [] },
    query: '',
    eventFilter: 'all',
    chart: 'temperature',
    profile: null,
    error: '',
    generation: 0,
    mds: { state: 'standalone', label: 'Standalone preview' }
  };
  const server = TrackiumServer.create(() => render());
  let toastTimer;
  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem('trackium_v2_profile'));
      if (saved && ['free', 'managed'].includes(saved.mode))
        state.profile = {
          mode: saved.mode,
          origin: TrackiumGateway.validateOrigin(saved.origin)
        };
    } catch (_) {
      /* Corrupt or unavailable storage must not block the workspace. */
    }
  }
  function page() {
    const route = location.hash.slice(1);
    return pages.some((p) => p[0] === route) ? route : 'dashboard';
  }
  function badge(text, kind = 'neutral') {
    return '<span class="badge ' + kind + '">' + escape(text) + '</span>';
  }
  function provenance() {
    return badge('Synthetic', 'synthetic');
  }
  function statusLabel(status) {
    return (
      {
        moving: 'Moving',
        alarm: 'Attention',
        stationary: 'Stationary',
        unknown: 'No telemetry'
      }[status] || status
    );
  }
  function statusBadge(status) {
    return badge(
      statusLabel(status),
      status === 'alarm' || status === 'Attention'
        ? 'warning'
        : status === 'moving' || status === 'In transit'
          ? 'teal'
          : 'neutral'
    );
  }
  function number(value, suffix = '') {
    return value === null || value === undefined ? '—' : escape(value) + suffix;
  }
  function header(eyebrow, title, description, action = '') {
    return (
      '<div class="page-heading"><div><div class="eyebrow">' +
      escape(eyebrow) +
      '</div><h1>' +
      escape(title) +
      '</h1><p>' +
      escape(description) +
      '</p></div><div class="heading-actions">' +
      action +
      '</div></div>'
    );
  }
  function button(label, action, style = 'secondary', i = '') {
    return (
      '<button class="button ' +
      style +
      '" data-action="' +
      action +
      '">' +
      (i ? icon(i) : '') +
      escape(label) +
      '</button>'
    );
  }
  function empty(title, description, kind = 'devices') {
    return (
      '<div class="empty-state"><span class="empty-icon">' +
      icon(kind) +
      '</span><h3>' +
      escape(title) +
      '</h3><p>' +
      escape(description) +
      '</p>' +
      button('Explore demo workspace', 'demo-on', 'primary') +
      '<a class="text-link" href="#settings">Configure Gateway ' +
      icon('arrow') +
      '</a></div>'
    );
  }
  function offlineNote() {
    return (
      '<div class="notice">' +
      icon('signal') +
      '<div><strong>Gateway not paired</strong><p>No Core-origin session is configured. Open the authenticated Gateway workspace in Settings. Preview data is static and opt-in.</p></div><a href="#settings">Settings ' +
      icon('arrow', 'northeast') +
      '</a></div>'
    );
  }
  function summaryCard(label, value, detail, kind, accent) {
    return (
      '<article class="metric-card ' +
      (accent || '') +
      '"><div class="metric-top"><span>' +
      label +
      '</span><span class="metric-icon">' +
      icon(kind) +
      '</span></div><strong>' +
      value +
      '</strong><div class="metric-bottom">' +
      detail +
      '</div></article>'
    );
  }
  function mapSvg(shipment, large = false) {
    const project = (p) => [((p[0] + 4) / 43) * 900, ((57 - p[1]) / 17) * 440];
    const route = shipment ? shipment.route : state.demo ? state.data.shipments[0].route : [];
    const routePoints = route.map((p) => project(p).join(',')).join(' ');
    const markers = state.demo ? state.data.devices.filter((d) => d.latitude !== null) : [];
    const cities = [
      ['Amsterdam', 4.9, 52.37],
      ['Berlin', 13.4, 52.52],
      ['Prague', 14.44, 50.08],
      ['Warsaw', 21.01, 52.23],
      ['Lviv', 24.03, 49.84],
      ['Kyiv', 30.52, 50.45],
      ['Budapest', 19.04, 47.5],
      ['Paris', 2.35, 48.86],
      ['Milan', 9.19, 45.46]
    ];
    return (
      '<div class="map-canvas ' +
      (large ? 'large' : '') +
      '"><svg viewBox="0 0 900 440" role="img" aria-label="' +
      (state.demo
        ? 'Illustrative Europe map with synthetic cargo positions'
        : 'Illustrative Europe map; no Gateway positions loaded') +
      '"><defs><pattern id="map-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#23334a" stroke-width=".6"/></pattern><linearGradient id="land-fill" x2="1" y2="1"><stop stop-color="#233b4c"/><stop offset="1" stop-color="#172b3e"/></linearGradient></defs><rect width="900" height="440" fill="#111f31"/><rect width="900" height="440" fill="url(#map-grid)"/>' +
      '<path d="M155 55l53 15 42-12 37 17 54-22 25-47 31 15-8 66 31 18 57-3 25 18 82-26 47 29 51-3 37 15 75-7 66 25 40-3v189l-72 1-54-21-35 12-38-18-67 2-29 26-45-11-13 31-51-1-28-24-20 3-15 39-18-4-23-41-40-12-17-43-42-22-48-1-28-38-43 7-27 28-51-11-14-43 27-43-12-32 29-11 12-33 30-22z" fill="url(#land-fill)" stroke="#344b5c" stroke-width="1.3"/>' +
      '<g fill="none" stroke="#35475a" stroke-width="1" stroke-dasharray="4 5"><path d="M270 80l30 90-23 80M390 83l-20 72 33 40-18 98M485 110l-15 83 42 61M590 125l-30 80 37 94M240 184l129 25 118-16 100 15 112-11M300 265l111-26 111 15 105-16"/></g>' +
      '<g fill="none" stroke="#354b60" stroke-width="2"><path d="M145 210Q230 158 282 130T403 143T524 114T600 160T722 170M280 130L386 180L494 205L524 114M386 180L416 294L530 303"/></g>' +
      cities
        .map((c) => {
          const [x, y] = project([c[1], c[2]]);
          return (
            '<g><circle cx="' +
            x +
            '" cy="' +
            y +
            '" r="2.4" fill="#657a8f"/><text x="' +
            (x + 8) +
            '" y="' +
            (y - 8) +
            '" fill="#8c9eb2" font-size="11" font-family="system-ui">' +
            c[0] +
            '</text></g>'
          );
        })
        .join('') +
      (route.length
        ? '<polyline points="' +
          routePoints +
          '" fill="none" stroke="#3ad7bd" stroke-width="2.5" stroke-dasharray="6 5" opacity=".75"/>'
        : '') +
      markers
        .map((d, i) => {
          const [x, y] = project([d.longitude, d.latitude]);
          return (
            '<g><circle cx="' +
            x +
            '" cy="' +
            y +
            '" r="17" fill="' +
            (d.status === 'alarm' ? '#f1b35f' : '#37d3be') +
            '" opacity=".12"/><circle cx="' +
            x +
            '" cy="' +
            y +
            '" r="7" fill="' +
            (d.status === 'alarm' ? '#f1b35f' : '#37d3be') +
            '" stroke="#142437" stroke-width="3"/><rect x="' +
            (x + 13) +
            '" y="' +
            (y + 5) +
            '" width="68" height="22" rx="5" fill="#0c192a" stroke="#31495c"/><text x="' +
            (x + 21) +
            '" y="' +
            (y + 20) +
            '" fill="#e4eff5" font-size="10" font-family="system-ui">' +
            escape(d.short) +
            '</text></g>'
          );
        })
        .join('') +
      '</svg><div class="map-caption"><span class="map-live-dot"></span>' +
      (state.demo ? 'Synthetic positions' : 'No positions loaded') +
      '<span class="map-caption-end">Schematic · not for navigation</span></div><div class="map-compass">N<br><span>↑</span></div></div>'
    );
  }
  function shipmentRows(items, compact = false) {
    if (!items.length)
      return '<div class="small-empty">No matching shipments. Try a different search.</div>';
    return items
      .map(
        (s) =>
          '<button class="shipment-row" data-shipment="' +
          escape(s.id) +
          '"><span class="shipment-symbol">' +
          icon('shipments') +
          '</span><span class="shipment-main"><strong>' +
          escape(s.id) +
          ' <small>' +
          escape(s.name) +
          '</small></strong><span>' +
          escape(s.origin) +
          ' <span class="route-arrow">→</span> ' +
          escape(s.destination) +
          '</span></span><span class="shipment-progress"><span>' +
          s.progress +
          '% <small>route progress</small></span><span class="progress-bar"><i style="width:' +
          s.progress +
          '%"></i></span></span>' +
          statusBadge(s.status) +
          '<span class="row-chevron">' +
          icon('arrow', 'northeast') +
          '</span></button>'
      )
      .join('');
  }
  function chart() {
    const humidity = state.chart === 'humidity';
    const values = state.demo
      ? state.data.events
          .filter((e) => e.device_id === state.data.devices[0].id)
          .slice()
          .reverse()
          .map((e) => (humidity ? e.payload.humidity_pct : e.payload.temperature_c))
      : [];
    const points = values
      .map((v, i) => 40 + i * 43 + ',' + (humidity ? 175 - (v - 45) * 9 : 175 - (v - 3.5) * 90))
      .join(' ');
    return (
      '<div class="chart-header"><div><h2>Condition monitor</h2><p>' +
      (state.demo ? 'TRK–001 · synthetic cold-chain readings' : 'No sensor readings available') +
      '</p></div><div class="segmented" aria-label="Chart measurement"><button data-chart="temperature" aria-pressed="' +
      !humidity +
      '" class="' +
      (!humidity ? 'active' : '') +
      '">Temperature</button><button data-chart="humidity" aria-pressed="' +
      humidity +
      '" class="' +
      (humidity ? 'active' : '') +
      '">Humidity</button></div></div><div class="chart-value">' +
      (state.demo ? (humidity ? '48<span>% RH</span>' : '4.2<span>°C</span>') : '—') +
      '<span class="chart-context">' +
      (state.demo ? 'Synthetic sample · 12:00 UTC' : 'Pairing required') +
      '</span></div><svg class="sensor-chart" viewBox="0 0 550 200" role="img" aria-label="' +
      (state.demo
        ? humidity
          ? 'Synthetic humidity history, 47 to 49 percent'
          : 'Synthetic temperature history, 3.9 to 4.3 Celsius'
        : 'Empty sensor chart') +
      '"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#37d3be" stop-opacity=".2"/><stop offset="1" stop-color="#37d3be" stop-opacity="0"/></linearGradient></defs>' +
      [40, 85, 130, 175]
        .map(
          (y, i) =>
            '<line x1="40" y1="' +
            y +
            '" x2="525" y2="' +
            y +
            '" stroke="#28374b" stroke-dasharray="3 4"/><text x="2" y="' +
            (y + 4) +
            '" fill="#7d92aa" font-size="11">' +
            (humidity ? 60 - i * 5 : 5 - i * 0.5) +
            '</text>'
        )
        .join('') +
      (values.length
        ? '<polygon points="40,175 ' +
          points +
          ' 513,175" fill="url(#chart-fill)"/><polyline points="' +
          points +
          '" stroke="#37d3be" stroke-width="2.5" fill="none" stroke-linejoin="round"/>'
        : '') +
      '<g fill="#7d92aa" font-size="11"><text x="40" y="198">01:00</text><text x="195" y="198">05:00</text><text x="350" y="198">09:00</text><text x="490" y="198">12:00</text></g></svg>' +
      (state.demo
        ? '<div class="chart-footnote">' +
          provenance() +
          '<span>Fixed demo snapshot · UTC</span></div>'
        : '')
    );
  }
  function dashboard() {
    return (
      header(
        'OPERATIONS OVERVIEW',
        'A clear view of your cargo.',
        'Monitor shipments, device conditions and every step of the journey.',
        state.demo
          ? '<span class="snapshot-date">' +
              icon('clock') +
              '07 Nov 2026 <span>·</span> 12:00 UTC</span>'
          : button('Explore demo workspace', 'demo-on', 'primary', 'arrow')
      ) +
      (!state.demo ? offlineNote() : '') +
      '<div class="metrics-grid">' +
      summaryCard(
        'Active shipments',
        state.demo ? '03' : '—',
        state.demo
          ? '<span class="teal-text">2 on the move</span><span>of 3 demo shipments</span>'
          : 'Open Gateway workspace',
        'shipments'
      ) +
      summaryCard(
        'Registered devices',
        state.demo ? '04' : '—',
        state.demo
          ? '<span class="teal-text">3 with telemetry</span><span>1 no telemetry</span>'
          : 'No paired tenant',
        'devices'
      ) +
      summaryCard(
        'Needs attention',
        state.demo ? '01' : '—',
        state.demo
          ? '<span class="amber-text">Temperature excursion</span><span>TRK–002 · synthetic</span>'
          : 'No live alerts',
        'alert',
        'attention'
      ) +
      summaryCard('Confirmed proofs', '00', '<span>No publishing integration</span>', 'proofs') +
      '</div>' +
      '<div class="dashboard-grid"><section class="panel map-panel"><div class="panel-heading"><div><h2>Fleet overview</h2><p>' +
      (state.demo
        ? '3 synthetic positions across Europe'
        : 'Connect your Gateway to see device locations') +
      '</p></div><a class="text-link" href="#map">Open map ' +
      icon('arrow') +
      '</a></div>' +
      mapSvg() +
      '<div class="map-legend"><span><i class="dot teal-dot"></i> Moving / stationary</span><span><i class="dot amber-dot"></i> Attention</span><span class="muted">Illustrative view</span></div></section><section class="panel condition-panel">' +
      chart() +
      '</section></div>' +
      '<div class="dashboard-bottom"><section class="panel"><div class="panel-heading"><div><h2>Shipments in focus</h2><p>' +
      (state.demo
        ? 'Demo routes, never saved on Gateway'
        : 'Shipment management is not yet available on Gateway') +
      '</p></div><a class="text-link" href="#shipments">View all ' +
      icon('arrow') +
      '</a></div>' +
      (state.demo
        ? shipmentRows(state.data.shipments)
        : empty(
            'Your next journey starts here',
            'Open the Gateway workspace for authenticated shipments, or explore a clearly labeled static Preview.',
            'shipments'
          )) +
      '</section><section class="panel activity-panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>' +
      (state.demo ? 'Synthetic event timeline' : 'No Gateway events loaded') +
      '</p></div></div>' +
      (state.demo
        ? '<div class="activity-list">' +
          [
            {
              title: 'Temperature needs attention',
              text: 'TRK–002 · Prague, CZ',
              time: '12:00',
              type: 'alert'
            },
            {
              title: 'Location sample recorded',
              text: 'TRK–001 · Wrocław, PL',
              time: '12:00',
              type: 'pin'
            },
            {
              title: 'Device at origin',
              text: 'TRK–003 · Rotterdam, NL',
              time: '11:55',
              type: 'devices'
            }
          ]
            .map(
              (a) =>
                '<div class="activity-item"><span class="activity-icon ' +
                (a.type === 'alert' ? 'amber-text' : '') +
                '">' +
                icon(a.type) +
                '</span><div><strong>' +
                a.title +
                '</strong><p>' +
                a.text +
                '</p><small>Demo · ' +
                a.time +
                ' UTC</small></div></div>'
            )
            .join('') +
          '</div>'
        : '<div class="small-empty">Events will appear here after a secure Gateway session is supported.</div>') +
      '</section></div>'
    );
  }
  function search(placeholder) {
    return (
      '<label class="search-field">' +
      icon('search') +
      '<input id="workspace-search" type="search" autocomplete="off" placeholder="' +
      placeholder +
      '" aria-label="' +
      placeholder +
      '" value="' +
      escape(state.query) +
      '"></label>'
    );
  }
  function shipments() {
    const items = state.data.shipments.filter((s) =>
      (s.id + ' ' + s.name + ' ' + s.origin + ' ' + s.destination)
        .toLowerCase()
        .includes(state.query.toLowerCase())
    );
    return (
      header(
        'SHIPMENT MANAGEMENT',
        'Every journey, in one place.',
        'Routes, cargo conditions and linked devices — clearly connected.',
        state.demo ? badge('Demo planning only', 'synthetic') : badge('Shipment API unavailable')
      ) +
      '<div class="notice subtle">' +
      icon('shipments') +
      '<div><strong>Shipment workspace preview</strong><p>These static Preview routes are not Gateway records. Use the authenticated Gateway workspace to create and manage shipments in PostgreSQL.</p></div></div>' +
      '<section class="panel"><div class="toolbar">' +
      search('Search shipments, cargo or route') +
      '<span class="muted">' +
      (state.demo ? items.length + ' demo shipments' : 'No shipments loaded') +
      '</span></div>' +
      (state.demo
        ? shipmentRows(items)
        : empty(
            'No connected shipments',
            'Open your Gateway workspace for authenticated shipment records. No local Preview record is presented as Gateway data.',
            'shipments'
          )) +
      '</section>'
    );
  }
  function deviceList() {
    const items = state.data.devices.filter((d) =>
      (d.label + ' ' + d.short + ' ' + d.city).toLowerCase().includes(state.query.toLowerCase())
    );
    return (
      header(
        'DEVICE DIRECTORY',
        'Know what your cargo knows.',
        'Location, battery and environmental readings, with explicit provenance.',
        '<a class="button secondary" href="#settings">' + icon('settings') + 'Gateway settings</a>'
      ) +
      '<section class="panel"><div class="toolbar">' +
      search('Search devices or location') +
      '<span class="muted">' +
      (state.demo ? items.length + ' synthetic devices' : 'Gateway not paired') +
      '</span></div>' +
      (state.demo
        ? '<div class="table-wrap"><table><thead><tr><th>Device</th><th>Reported status</th><th>Last location</th><th>Temperature</th><th>Battery</th><th>Provenance</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>' +
          items
            .map(
              (d) =>
                '<tr><td><button class="device-link" data-device="' +
                d.id +
                '"><span class="device-tile">' +
                icon('devices') +
                '</span><span><strong>' +
                escape(d.label) +
                '</strong><small>' +
                d.short +
                '</small></span></button></td><td>' +
                statusBadge(d.status) +
                '</td><td>' +
                escape(d.city) +
                '<small class="cell-note">' +
                d.last +
                (d.last === '—' ? '' : ' UTC · demo') +
                '</small></td><td>' +
                number(d.temperature, ' °C') +
                '</td><td>' +
                number(d.battery, '%') +
                '</td><td>' +
                provenance() +
                '</td><td><button class="icon-button" aria-label="Details for ' +
                escape(d.label) +
                '" data-device="' +
                d.id +
                '">' +
                icon('arrow', 'northeast') +
                '</button></td></tr>'
            )
            .join('') +
          '</tbody></table>' +
          (items.length ? '' : '<div class="small-empty">No matching devices.</div>') +
          '</div>'
        : empty(
            'No Gateway devices loaded',
            'Open the Gateway workspace for owner-approved pairing. The original local MDS registry remains separate.'
          )) +
      '</section>'
    );
  }
  function mapPage() {
    return (
      header(
        'LOCATION WORKSPACE',
        'The bigger picture.',
        'Device positions and route context, with provenance at every point.',
        state.demo
          ? badge('Synthetic · fixed snapshot', 'synthetic')
          : badge('No live location feed')
      ) +
      '<div class="map-page-grid"><section class="panel map-panel">' +
      mapSvg(null, true) +
      '<div class="map-legend"><span><i class="dot teal-dot"></i> Synthetic position</span><span><i class="dot amber-dot"></i> Attention</span><span class="muted">No live map tiles or tracking</span></div></section><section class="panel map-devices"><div class="panel-heading"><div><h2>Device positions</h2><p>' +
      (state.demo ? '3 GPS samples · 1 without GPS' : 'No devices loaded') +
      '</p></div></div>' +
      (state.demo
        ? state.data.devices
            .map(
              (d) =>
                '<button class="map-device" data-device="' +
                d.id +
                '"><div><strong>' +
                escape(d.label) +
                '</strong>' +
                statusBadge(d.status) +
                '</div><p>' +
                escape(d.city) +
                '</p><small>' +
                (d.latitude === null
                  ? 'No coordinates'
                  : d.latitude.toFixed(4) + '° N, ' + d.longitude.toFixed(4) + '° E') +
                '</small>' +
                provenance() +
                '</button>'
            )
            .join('')
        : empty(
            'No live positions',
            'No Gateway session is available. Enable Demo mode to explore illustrative positions.',
            'map'
          )) +
      '</section></div>'
    );
  }
  function eventsPage() {
    const items = state.data.events.filter(
      (ev) =>
        (state.eventFilter === 'all' || ev.payload.status === state.eventFilter) &&
        (ev.label + ' ' + ev.short + ' ' + ev.payload.status)
          .toLowerCase()
          .includes(state.query.toLowerCase())
    );
    return (
      header(
        'TELEMETRY HISTORY',
        'The detail behind every move.',
        'Normalized schema v1 · event time in UTC · provenance always visible.'
      ) +
      '<section class="panel"><div class="toolbar">' +
      search('Search device or reported status') +
      '<label class="filter-label">Status<select id="event-filter"><option value="all">All statuses</option><option value="alarm" ' +
      (state.eventFilter === 'alarm' ? 'selected' : '') +
      '>Attention</option><option value="moving" ' +
      (state.eventFilter === 'moving' ? 'selected' : '') +
      '>Moving</option><option value="stationary" ' +
      (state.eventFilter === 'stationary' ? 'selected' : '') +
      '>Stationary</option></select></label></div>' +
      (state.demo
        ? '<div class="table-wrap"><table><thead><tr><th>Event time · UTC</th><th>Device</th><th>Reported status</th><th>Temperature</th><th>Humidity</th><th>Battery</th><th>Provenance</th></tr></thead><tbody>' +
          items
            .map(
              (ev) =>
                '<tr><td><strong>' +
                ev.occurred_at.slice(11, 16) +
                '</strong><small class="cell-note">07 Nov 2026</small></td><td><button class="text-link" data-device="' +
                ev.device_id +
                '">' +
                escape(ev.short) +
                '</button></td><td>' +
                statusBadge(ev.payload.status) +
                '</td><td>' +
                ev.payload.temperature_c +
                ' °C</td><td>' +
                ev.payload.humidity_pct +
                '%</td><td>' +
                ev.payload.battery_pct +
                '%</td><td>' +
                provenance() +
                '</td></tr>'
            )
            .join('') +
          '</tbody></table>' +
          (items.length ? '' : '<div class="small-empty">No events match this filter.</div>') +
          '</div><div class="table-footer">' +
          items.length +
          ' synthetic events · fixed dataset · no live polling</div>'
        : empty(
            'No telemetry history',
            'Gateway history requires an authenticated tenant session. No events are fetched anonymously.',
            'events'
          )) +
      '</section>'
    );
  }
  function proofsPage() {
    return (
      header(
        'EVIDENCE WORKSPACE',
        'Visibility is not yet proof.',
        'Keep recorded telemetry separate from cryptographically confirmed evidence.',
        badge('Publishing not implemented', 'warning')
      ) +
      '<div class="metrics-grid proof-metrics">' +
      summaryCard('Confirmed on-chain', '00', 'No confirmation adapter', 'proofs') +
      summaryCard('Pending transactions', '00', 'No transactions submitted', 'clock') +
      summaryCard('Canonical format', 'v1', 'Prepared by Gateway Telemetry Core', 'events') +
      '</div>' +
      '<section class="panel proof-panel"><div class="proof-emblem">' +
      icon('proofs') +
      '</div><h2>No blockchain proofs published</h2><p>The Gateway prepares canonical event bytes and a SHA-256 checksum. That checksum is not an authenticity guarantee, a Minima commitment or an on-chain confirmation.</p><div class="proof-pipeline"><div><span>01</span><strong>Telemetry</strong><small>Gateway / synthetic input</small></div><i>→</i><div><span>02</span><strong>Canonical format</strong><small>Telemetry Core v1</small></div><i>→</i><div class="future"><span>03</span><strong>Publish</strong><small>Not implemented</small></div><i>→</i><div class="future"><span>04</span><strong>Confirm</strong><small>Not implemented</small></div></div><div class="notice subtle">' +
      icon('alert') +
      '<p>' +
      (state.demo
        ? 'Demo telemetry is synthetic and has no published proof.'
        : 'No Gateway evidence is loaded.') +
      ' Integritas and the Minima Proof Engine are not connected. No transaction can be submitted from this screen.</p></div></section>'
    );
  }
  function settingsPage() {
    const profile = state.profile || { mode: 'free', origin: '' };
    return (
      header(
        'WORKSPACE SETTINGS',
        'Your Gateway. Your deployment.',
        'One tenant boundary for Free and Managed. No credentials in the browser.'
      ) +
      '<div class="settings-grid"><section class="panel settings-panel"><div class="panel-heading"><div><h2>Gateway connection</h2><p>Configure a public connection profile, without secrets.</p></div>' +
      badge('Not paired', 'warning') +
      '</div><form id="gateway-form" novalidate><fieldset><legend>Deployment model</legend><div class="mode-options"><label><input type="radio" name="deployment" value="free" ' +
      (profile.mode === 'free' ? 'checked' : '') +
      '><span><strong>Free / self-hosted</strong><small>Your infrastructure, your operations.</small></span></label><label><input type="radio" name="deployment" value="managed" ' +
      (profile.mode === 'managed' ? 'checked' : '') +
      '><span><strong>Managed</strong><small>A tenant on a managed Gateway.</small></span></label></div></fieldset><label class="field-label" for="gateway-origin">Gateway origin</label><input class="text-input" id="gateway-origin" type="url" autocomplete="off" spellcheck="false" placeholder="https://gateway.example.com" value="' +
      escape(profile.origin) +
      '" aria-describedby="origin-help profile-feedback"><p class="field-help" id="origin-help">Origin only. No username, password, path, query parameters or token. HTTP is accepted only on localhost.</p><div id="profile-feedback" class="form-feedback" role="status"></div><div class="form-actions"><button class="button primary" type="submit">Save profile</button><button type="button" class="button secondary" data-action="check-gateway">Check pairing support</button><button type="button" class="text-link" data-action="clear-profile">Clear</button></div></form>' +
      (state.profile
        ? '<div class="server-content"><a class="button primary" href="' +
          escape(state.profile.origin) +
          '/app/" target="_blank" rel="noopener noreferrer">Open secure Gateway workspace</a><p>Owner-approved pairing runs on the Gateway origin. No token or Minima UID is forwarded.</p></div>'
        : '') +
      '<div class="pairing-state"><span class="pairing-symbol">' +
      icon('signal') +
      '</span><div><strong>Pairing uses the Gateway workspace</strong><p>Open the same-origin workspace above for one-use tenant-owner approval and short-lived sessions. Direct Core-origin transport is not enabled. Saving this profile does not connect.</p></div></div></section><div class="settings-side"><section class="panel security-panel"><span class="eyebrow">CONNECTION SECURITY</span><h2>Credentials stay off the page.</h2><p>No bearer-token field, browser token storage, anonymous API fallback or public proxy.</p><ul><li>Tenant-bound, one-use pairing exchange</li><li>Short-lived, scope-limited sessions</li><li>No credentials forwarded from Core</li></ul><span class="muted">Same-origin Gateway sessions implemented; Core handoff requires verification</span></section><section class="panel runtime-panel"><h2>Minima runtime</h2><div class="runtime-status">' +
      badge(state.mds.label, state.mds.state === 'ready' ? 'teal' : 'neutral') +
      '</div><p>' +
      (state.mds.block !== undefined
        ? 'Current node block: ' +
          escape(state.mds.block) +
          '. This is not cargo proof confirmation.'
        : 'The new UI makes only a read-only node status request when opened with a Minima session.') +
      '</p><a class="text-link" href="' +
      escape(TrackiumMDS.legacyUrl()) +
      '">Open legacy workspace ' +
      icon('arrow', 'northeast') +
      '</a><small class="legacy-note">Separate legacy tools, including their original local DB, simulator and blockchain behavior. Not a Gateway migration.</small></section></div></div>'
    );
  }
  function render() {
    const current = page();
    $('#navigation').innerHTML = pages
      .map(
        ([id, label]) =>
          '<a href="#' +
          id +
          '" class="nav-item ' +
          (current === id ? 'active' : '') +
          '" ' +
          (current === id ? 'aria-current="page"' : '') +
          '>' +
          icon(id) +
          '<span>' +
          label +
          '</span>' +
          (id === 'shipments' && state.demo ? '<span class="nav-count">3</span>' : '') +
          '</a>'
      )
      .join('');
    $('#breadcrumb').textContent = pages.find((p) => p[0] === current)[1];
    $('#demo-toggle').setAttribute('aria-checked', String(state.demo));
    $('#demo-banner').hidden = !state.demo;
    $('#workspace-label').textContent = state.demo
      ? 'Demo · synthetic data'
      : 'Local workspace · not paired';
    document.title = pages.find((p) => p[0] === current)[1] + ' · Trackium Cargo';
    const views = {
      dashboard,
      shipments,
      devices: deviceList,
      map: mapPage,
      events: eventsPage,
      proofs: proofsPage,
      settings: settingsPage
    };
    $('#main').setAttribute('aria-busy', String(state.loading));
    $('.connection-pill').innerHTML =
      '<span></span>' + (server.state.connected ? 'Tenant session' : 'Not paired');
    const serverBanner = $('#server-banner');
    serverBanner.hidden = !server.state.connected || state.demo;
    if (server.state.enabled && !state.demo) {
      $('#main').innerHTML = server.state.connected
        ? TrackiumServerView.render(current, server.state)
        : header(
            'GATEWAY WORKSPACE',
            'Connect with tenant-owner approval.',
            'This page runs on the Gateway origin. No Minima UID or owner API key is accepted as browser identity.'
          ) + TrackiumServerView.pairing(server.state);
      return;
    }
    $('#main').innerHTML = state.loading
      ? '<div class="loading-state" role="status"><span class="spinner"></span><h2>Loading synthetic workspace…</h2><p>Demo snapshot only. No Gateway request.</p></div>'
      : views[current]();
  }
  async function demo(enabled) {
    const generation = ++state.generation;
    state.demo = enabled;
    state.error = '';
    state.query = '';
    state.eventFilter = 'all';
    if (!enabled) {
      state.loading = false;
      state.data = { devices: [], shipments: [], events: [] };
      $('#detail-dialog').close();
      render();
      return;
    }
    state.loading = true;
    render();
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (generation !== state.generation) return;
    state.data = TrackiumDemo.create();
    state.loading = false;
    render();
    toast('Preview enabled · static synthetic fixtures only');
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => {
      $('#toast').hidden = true;
    }, 3500);
  }
  function openDialog(content) {
    $('#dialog-content').innerHTML =
      '<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close details">×</button>' +
      content;
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
    $('.dialog-close').focus();
  }
  function showShipment(id) {
    if (!state.demo) return;
    const s = state.data.shipments.find((item) => item.id === id);
    if (!s) return;
    const d = state.data.devices.find((item) => item.id === s.device);
    openDialog(
      '<div class="eyebrow">DEMO SHIPMENT · NOT SAVED ON GATEWAY</div><h2 id="dialog-title">' +
        escape(s.id) +
        ' · ' +
        escape(s.name) +
        '</h2><p class="dialog-subtitle">' +
        escape(s.cargo) +
        ' · ' +
        escape(s.reference) +
        '</p><div class="detail-status">' +
        statusBadge(s.status) +
        provenance() +
        '</div><div class="route-cities"><div><small>' +
        s.from +
        ' · ORIGIN</small><strong>' +
        escape(s.origin) +
        '</strong></div>' +
        icon('arrow') +
        '<div><small>' +
        s.to +
        ' · DESTINATION</small><strong>' +
        escape(s.destination) +
        '</strong></div></div>' +
        mapSvg(s) +
        '<div class="detail-two-column"><div><h3>Route milestones</h3><ol class="route-timeline">' +
        s.stops
          .map(
            (stop, i) => '<li class="' + (i === 0 ? 'complete' : '') + '">' + escape(stop) + '</li>'
          )
          .join('') +
        '</ol></div><div><h3>Linked device</h3><button class="linked-device" data-device="' +
        d.id +
        '">' +
        icon('devices') +
        '<span><strong>' +
        escape(d.label) +
        '</strong><small>' +
        escape(d.short) +
        ' · Synthetic</small></span>' +
        icon('arrow', 'northeast') +
        '</button><dl class="detail-facts"><div><dt>Demo ETA</dt><dd>' +
        escape(s.eta) +
        '</dd></div><div><dt>Illustrative route</dt><dd>' +
        s.distance +
        '</dd></div></dl></div></div><p class="detail-disclaimer">All shipment data and milestones are demonstrations, not Gateway records or validated delivery claims.</p>'
    );
  }
  function showDevice(id) {
    if (!state.demo) return;
    const d = state.data.devices.find((item) => item.id === id);
    if (!d) return;
    openDialog(
      '<div class="eyebrow">DEMO DEVICE · SYNTHETIC</div><h2 id="dialog-title">' +
        escape(d.label) +
        '</h2><p class="dialog-subtitle">' +
        escape(d.short) +
        ' · ' +
        escape(d.city) +
        '</p><div class="detail-status">' +
        statusBadge(d.status) +
        provenance() +
        '</div><div class="sensor-cards">' +
        [
          ['temperature', number(d.temperature, ' °C'), 'Temperature'],
          ['humidity', number(d.humidity, '%'), 'Humidity'],
          ['battery', number(d.battery, '%'), 'Battery']
        ]
          .map(
            (x) =>
              '<div>' +
              icon(x[0]) +
              '<strong>' +
              x[1] +
              '</strong><small>' +
              x[2] +
              '</small></div>'
          )
          .join('') +
        '</div><dl class="detail-facts"><div><dt>Registry mode</dt><dd>Synthetic</dd></div><div><dt>Coordinates</dt><dd>' +
        (d.latitude === null
          ? 'No GPS sample'
          : d.latitude.toFixed(4) + ', ' + d.longitude.toFixed(4)) +
        '</dd></div><div><dt>Linked demo shipment</dt><dd>' +
        escape(d.shipment || 'Not assigned') +
        '</dd></div><div><dt>Proof status</dt><dd>Not published</dd></div></dl><div class="notice subtle">' +
        icon('proofs') +
        '<p>These readings are synthetic. No device authenticity, on-chain confirmation or real-time connectivity is asserted.</p></div>'
    );
  }
  const mobileNavigation = window.matchMedia('(max-width: 760px)');
  function syncMenu() {
    const open = mobileNavigation.matches && $('#sidebar').classList.contains('open');
    $('#sidebar').inert = mobileNavigation.matches && !open;
    $('.workspace-main').inert = open;
    document.body.classList.toggle('nav-open', open);
  }
  function closeMenu() {
    $('#sidebar').classList.remove('open');
    $('#nav-scrim').hidden = true;
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    $('#sidebar').removeAttribute('aria-modal');
    $('#sidebar').removeAttribute('role');
    syncMenu();
  }
  function openMenu() {
    $('#sidebar').classList.add('open');
    $('#nav-scrim').hidden = false;
    $('#menu-toggle').setAttribute('aria-expanded', 'true');
    $('#sidebar').setAttribute('role', 'dialog');
    $('#sidebar').setAttribute('aria-modal', 'true');
    syncMenu();
    $('#nav-close').focus();
  }
  mobileNavigation.addEventListener('change', closeMenu);
  syncMenu();
  document.addEventListener('click', async function (event) {
    const target = event.target.closest('button, a');
    if (!target) return;
    const serverAction = target.dataset.serverAction;
    if (serverAction) {
      target.disabled = true;
      try {
        const id = target.dataset.serverId;
        if (serverAction === 'refresh') await server.refresh();
        else if (serverAction === 'claim') await server.claim();
        else if (serverAction === 'disconnect') await server.disconnect();
        else if (serverAction === 'proof-verify') {
          const result = await server.request('/v1/proofs/' + id + '/verify', 'POST', {});
          openDialog(
            '<h2>Fresh node verification</h2><p>' +
              escape(
                result.verified
                  ? 'Verified against the configured node at this time'
                  : 'Not verified'
              ) +
              '</p><p>' +
              escape(result.status) +
              ' · ' +
              escape(result.reason) +
              '</p><p>Depth: ' +
              escape(result.confirmations ?? 0) +
              '. Provenance: ' +
              escape(result.source_trust ?? 'see event') +
              '.</p><p>Export the bundle to verify with your own trusted node. A valid commitment does not verify the physical sensor reading.</p>'
          );
        } else if (serverAction === 'proof-export') {
          const bundle = await server.request('/v1/proofs/' + id + '/bundle');
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'trackium-proof-' + id + '.json';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else if (serverAction === 'device')
          await server.mutate('/v1/simulated-devices', {
            label: 'Server simulator ' + (server.state.data.devices.length + 1)
          });
        else if (serverAction === 'create')
          openDialog(TrackiumServerView.createForm(server.state.data.devices));
        else if (serverAction.startsWith('transition:'))
          await server.mutate('/v1/shipments/' + id + '/transitions', {
            status: serverAction.split(':')[1]
          });
        else if (serverAction.startsWith('start:'))
          await server.mutate('/v1/shipments/' + id + '/simulations', {
            scenario: serverAction.split(':')[1]
          });
        else if (['pause', 'resume', 'finish'].includes(serverAction))
          await server.mutate('/v1/simulations/' + id + '/' + serverAction);
      } catch (error) {
        toast(error.message);
      } finally {
        target.disabled = false;
      }
      return;
    }
    const action = target.dataset.action;
    if (target.id === 'demo-toggle') demo(!state.demo);
    if (target.id === 'exit-demo' || action === 'demo-off') demo(false);
    if (action === 'demo-on') demo(true);
    if (target.id === 'menu-toggle') openMenu();
    if (target.id === 'nav-scrim' || target.id === 'nav-close') {
      closeMenu();
      $('#menu-toggle').focus();
    }
    if (
      target.tagName === 'A' &&
      target.getAttribute('href').startsWith('#') &&
      target.closest('#sidebar')
    )
      closeMenu();
    if (action === 'close-dialog') $('#detail-dialog').close();
    if (target.dataset.shipment) showShipment(target.dataset.shipment);
    if (target.dataset.device) showDevice(target.dataset.device);
    if (target.dataset.chart) {
      state.chart = target.dataset.chart;
      render();
    }
    if (action === 'check-gateway') {
      const feedback = $('#profile-feedback');
      feedback.textContent = 'Checking session capability…';
      try {
        await client.devices();
        feedback.textContent = 'Session transport available.';
      } catch (error) {
        feedback.textContent =
          error.code === 'PAIRING_UNAVAILABLE'
            ? 'No request was sent. Open the Gateway workspace for owner-approved pairing; direct Core-origin sessions are not configured.'
            : 'Gateway unavailable. No demo data was substituted.';
      }
    }
    if (action === 'clear-profile') {
      try {
        localStorage.removeItem('trackium_v2_profile');
      } catch (_) {}
      state.profile = null;
      render();
      toast('Connection profile cleared. No Gateway credentials were stored.');
    }
  });
  document.addEventListener('submit', function (event) {
    if (event.target.id === 'server-pair-form') {
      event.preventDefault();
      server.challenge($('#pair-tenant').value.trim()).catch((error) => toast(error.message));
      return;
    }
    if (event.target.id === 'server-shipment-form') {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const input = {
          name: form.get('name'),
          device_id: form.get('device_id'),
          route: JSON.parse(form.get('route')),
          conditions: {
            temperature_min_c: Number(form.get('min')),
            temperature_max_c: Number(form.get('max')),
            tolerance_c: Number(form.get('tolerance')),
            max_deviation_m: 1000
          }
        };
        server
          .mutate('/v1/shipments', input)
          .then(() => {
            $('#detail-dialog').close();
            toast('Draft saved on Gateway.');
          })
          .catch((error) => {
            $('#server-form-error').textContent = error.message;
          });
      } catch (error) {
        $('#server-form-error').textContent = 'Enter valid route JSON.';
      }
      return;
    }
    if (event.target.id !== 'gateway-form') return;
    event.preventDefault();
    const feedback = $('#profile-feedback');
    try {
      const profile = {
        mode: new FormData(event.target).get('deployment'),
        origin: TrackiumGateway.validateOrigin($('#gateway-origin').value.trim())
      };
      localStorage.setItem('trackium_v2_profile', JSON.stringify(profile));
      state.profile = profile;
      feedback.textContent =
        'Profile saved locally. Open the Gateway workspace to pair — not connected here.';
    } catch (error) {
      feedback.textContent =
        error.code === 'INVALID_ORIGIN'
          ? error.message
          : 'Profile could not be saved. Browser storage may be unavailable.';
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target.id === 'workspace-search') {
      const position = event.target.selectionStart;
      state.query = event.target.value;
      render();
      const field = $('#workspace-search');
      field.focus();
      field.setSelectionRange(position, position);
    }
  });
  document.addEventListener('change', function (event) {
    if (event.target.id === 'event-filter') {
      state.eventFilter = event.target.value;
      render();
      $('#event-filter').focus();
    }
  });
  window.addEventListener('hashchange', () => {
    state.query = '';
    closeMenu();
    $('#detail-dialog').close();
    render();
    $('#main').focus();
    window.scrollTo(0, 0);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#sidebar').classList.contains('open')) {
      closeMenu();
      $('#menu-toggle').focus();
    }
    if (
      event.key === 'Tab' &&
      mobileNavigation.matches &&
      $('#sidebar').classList.contains('open')
    ) {
      const links = Array.from($('#sidebar').querySelectorAll('a[href],button')).filter(
        (el) => el.getClientRects().length
      );
      const first = links[0],
        last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  $('#detail-dialog').addEventListener('click', (event) => {
    if (event.target === $('#detail-dialog')) $('#detail-dialog').close();
  });
  loadProfile();
  render();
  if (TrackiumServer.enabled) server.restore();
  TrackiumMDS.start((info) => {
    state.mds = info;
    $('#mds-state').textContent = info.label;
    if (page() === 'settings') render();
  });
})();
