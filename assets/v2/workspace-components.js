/* Small shared presentation components. No credentials or network operations. */
(function (root) {
  'use strict';
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
  const date = (v) =>
    v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString() : 'Not reported';
  const label = (s) => String(s ?? 'Unknown').replaceAll('_', ' ');
  function pagination(kind, state) {
    const p = state.pages?.[kind];
    if (!p) return '';
    return (
      '<nav class="ux-pagination" aria-label="' +
      kind +
      ' pages"><button class="button secondary" data-server-action="page-' +
      kind +
      '-previous" ' +
      (!p.previous.length || state.loading ? 'disabled' : '') +
      '>Previous page</button><span>Page ' +
      (p.previous.length + 1) +
      ' · up to 25 records</span><button class="button secondary" data-server-action="page-' +
      kind +
      '-next" ' +
      (!p.next || state.loading ? 'disabled' : '') +
      '>Next page</button></nav>'
    );
  }
  function chart(events) {
    return (
      '<section class="telemetry-charts"><h3>Returned measurement series</h3><p>Discrete observations only · missing values omitted · time on the horizontal axis. No smoothing or invented samples.</p>' +
      [
        ['temperature_c', 'Temperature', '°C'],
        ['humidity_pct', 'Humidity', '%'],
        ['battery_pct', 'Battery', '%']
      ]
        .map(([key, title, unit]) => {
          const samples = (events || [])
            .filter(
              (e) =>
                typeof e.payload?.[key] === 'number' &&
                Number.isFinite(e.payload[key]) &&
                Number.isFinite(Date.parse(e.occurred_at))
            )
            .map((e) => ({
              x: Date.parse(e.occurred_at),
              y: e.payload[key],
              trust: e.payload.trust
            }))
            .sort((a, b) => a.x - b.x);
          if (samples.length < 2 || samples[0].x === samples.at(-1).x)
            return (
              '<div class="ux-chart-empty"><strong>' +
              title +
              '</strong><p>Insufficient data · at least two measured times are needed.</p></div>'
            );
          const xmin = samples[0].x,
            xmax = samples.at(-1).x,
            ymin = Math.min(...samples.map((p) => p.y)),
            ymax = Math.max(...samples.map((p) => p.y));
          return (
            '<figure class="ux-chart"><figcaption>' +
            title +
            ' (' +
            unit +
            ') · ' +
            samples.length +
            ' reported samples</figcaption><svg viewBox="0 0 440 160" role="img" aria-label="' +
            title +
            ' observations over measured time"><path class="chart-axis" d="M45 15V125H425"/><text x="0" y="20">' +
            esc(ymax) +
            '</text><text x="0" y="125">' +
            esc(ymin) +
            '</text>' +
            samples
              .map(
                (p) =>
                  '<circle tabindex="0" cx="' +
                  (45 + ((p.x - xmin) / (xmax - xmin)) * 370) +
                  '" cy="' +
                  (115 - ((p.y - ymin) / (ymax - ymin || 1)) * 90) +
                  '" r="4"><title>' +
                  esc(
                    date(new Date(p.x).toISOString()) +
                      ' · ' +
                      p.y +
                      ' ' +
                      unit +
                      ' · ' +
                      (p.trust || 'unknown')
                  ) +
                  '</title></circle>'
              )
              .join('') +
            '<text x="45" y="150">' +
            esc(new Date(xmin).toLocaleTimeString()) +
            '</text><text x="425" y="150" text-anchor="end">' +
            esc(new Date(xmax).toLocaleTimeString()) +
            '</text></svg><small>' +
            esc(date(new Date(xmin).toISOString())) +
            ' — ' +
            esc(date(new Date(xmax).toISOString())) +
            '</small></figure>'
          );
        })
        .join('') +
      '</section>'
    );
  }
  function connection(state) {
    const phase = state.phase || 'unpaired';
    const title =
      {
        checking: 'Checking Gateway session',
        unpaired: 'Connect your logistics workspace',
        pairing: 'Waiting for owner approval',
        expired: 'Session expired',
        unavailable: 'Gateway unavailable',
        forbidden: 'Access not authorized'
      }[phase] || 'Connect your logistics workspace';
    const steps =
      '<ol class="connection-steps"><li><strong>Identify your tenant</strong><span>Use its public UUID, never an owner key.</span></li><li><strong>Request owner approval</strong><span>A short-lived one-use challenge is approved on the trusted Gateway host.</span></li><li><strong>Open your workspace</strong><span>The Gateway grants a scoped HttpOnly browser session.</span></li></ol>';
    return (
      '<div class="page-heading"><div><div class="eyebrow">TRACKIUM CORE · GATEWAY</div><h1>' +
      title +
      '</h1><p>No shipment data is shown until an authenticated Gateway observation succeeds.</p></div></div><section class="panel server-content connection-state"><div class="connection-status" role="status"><strong>' +
      {
        checking: 'Connection unknown · checking',
        unavailable: 'Unavailable · loaded data cleared',
        forbidden: 'Reachable · authorization denied',
        expired: 'Expired · owner re-pairing required',
        pairing: 'Reachable · approval pending',
        unpaired: 'Unpaired · owner approval required'
      }[phase] +
      '</strong><p>' +
      esc(state.error) +
      '</p>' +
      (['unavailable', 'expired', 'forbidden'].includes(phase)
        ? '<button class="button secondary" data-server-action="reconnect">Retry session check</button>'
        : '') +
      '</div>' +
      steps +
      '</section>'
    );
  }
  const valid = (p) =>
    p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180;
  let mapInstance = null,
    lastView = null,
    currentPage = null;
  function beforeRender(reset) {
    if (mapInstance) {
      lastView = {
        center: mapInstance.getCenter(),
        zoom: mapInstance.getZoom(),
        page: currentPage
      };
      mapInstance.remove();
      mapInstance = null;
    }
    if (reset) lastView = null;
  }
  function mountMap(data, page) {
    const el = document.getElementById('workspace-map');
    if (!el || !root.L || !root.TrackiumWorldMap) return;
    currentPage = page;
    const style = getComputedStyle(document.documentElement),
      accent = style.getPropertyValue('--tc-accent').trim(),
      land = style.getPropertyValue('--tc-surface-raised').trim(),
      outline = style.getPropertyValue('--tc-outline').trim();
    const map = (mapInstance = L.map(el, {
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: true
    }));
    map.setView([25, 10], 2);
    const countries = L.geoJSON(root.TrackiumWorldMap, {
      interactive: false,
      style: { color: outline, weight: 1, fillColor: land, fillOpacity: 1 }
    }).addTo(map);
    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Leaflet (BSD-2-Clause) · Natural Earth (public domain)');
    const bounds = [];
    for (const s of data.shipments) {
      const points = (s.route || []).filter(valid).map((p) => [p.latitude, p.longitude]);
      bounds.push(...points);
      if (points.length)
        L.polyline(points, { color: accent, weight: 2, dashArray: '6 6' })
          .bindTooltip('Planned route · ' + esc(s.name))
          .addTo(map);
    }
    for (const d of data.devices) {
      const obs = d.location?.location;
      if (!valid(obs?.gps)) continue;
      const p = [obs.gps.latitude, obs.gps.longitude];
      bounds.push(p);
      L.circleMarker(p, {
        radius: 7,
        color: accent,
        fillColor: accent,
        fillOpacity: 0.9
      })
        .bindPopup(
          '<strong>' +
            esc(d.registry.label) +
            '</strong><p>Last reported: ' +
            esc(date(obs.occurred_at)) +
            '</p><p>Source: ' +
            esc(obs.trust || 'unknown') +
            '</p><p>' +
            obs.gps.latitude +
            ', ' +
            obs.gps.longitude +
            '</p>'
        )
        .addTo(map);
    }
    if (lastView?.page === page) map.setView(lastView.center, lastView.zoom);
    else if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
    else map.setView([25, 10], 2);
    function countryLabels() {
      countries.eachLayer((layer) => {
        layer.unbindTooltip();
        if (map.getZoom() >= 4 && map.getBounds().intersects(layer.getBounds()))
          layer
            .bindTooltip(esc(layer.feature.properties.NAME_EN || layer.feature.properties.NAME), {
              permanent: true,
              direction: 'center',
              className: 'country-label'
            })
            .openTooltip();
      });
    }
    map.on('zoomend', countryLabels);
    countryLabels();
    map.invalidateSize();
  }
  root.TrackiumComponents = {
    esc,
    date,
    label,
    pagination,
    chart,
    connection,
    beforeRender,
    mountMap
  };
})(window);
