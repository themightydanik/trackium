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
      '<section class="telemetry-charts"><h3>Returned measurement series</h3><p>Discrete observations only · missing values omitted · reported observation time on the horizontal axis. No smoothing or invented samples.</p>' +
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
              '</strong><p>Insufficient data · at least two observation times are needed.</p></div>'
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
            ' observations over reported time"><path class="chart-grid" d="M45 25H425M45 70H425M45 115H425"/><path class="chart-axis" d="M45 15V125H425"/><text x="0" y="20">' +
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
        offline: 'You are offline',
        forbidden: 'Access not authorized'
      }[phase] || 'Connect your logistics workspace';
    const steps =
      '<ol class="connection-steps"><li><strong>Identify your tenant</strong><span>Use its public UUID, never an owner key.</span></li><li><strong>Request owner approval</strong><span>A short-lived one-use challenge is approved on the trusted Gateway host.</span></li><li><strong>Open your workspace</strong><span>The Gateway grants a scoped HttpOnly browser session.</span></li></ol>';
    return (
      '<div class="page-heading"><div><div class="eyebrow">TRACKIUM LITE · GATEWAY</div><h1>' +
      title +
      '</h1><p>No shipment data is shown until an authenticated Gateway observation succeeds.</p></div></div><section class="panel server-content connection-state"><div class="connection-status" role="status"><strong>' +
      {
        checking: 'Connection unknown · checking',
        unavailable: 'Unavailable · loaded data cleared',
        offline: 'Offline · tenant data cleared',
        forbidden: 'Reachable · authorization denied',
        expired: 'Expired · owner re-pairing required',
        pairing: 'Reachable · approval pending',
        unpaired: 'Unpaired · owner approval required'
      }[phase] +
      '</strong><p>' +
      esc(state.error) +
      '</p>' +
      (['offline', 'unavailable', 'expired', 'forbidden'].includes(phase)
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
  function historyPosition(device, event) {
    const payload = event.payload;
    const eligible = device.identity_kind === 'physical'
      ? payload?.source === 'aovx-gal-v1' && payload.trust === 'unverified' &&
        payload.device_measured_at && payload.extra?.gnss_fix === true
      : payload?.trust === 'synthetic';
    return eligible && valid(payload.gps) ? payload.gps : null;
  }
  function positionHistory(device, events) {
    const points = events.map((event) => historyPosition(device, event)).filter(Boolean);
    if (!points.length) return '<p>No historical positions on this page.</p>';
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes), minLon = Math.min(...longitudes);
    const latSpan = Math.max(...latitudes) - minLat, lonSpan = Math.max(...longitudes) - minLon;
    const caption = device.identity_kind === 'physical'
      ? 'Unverified AOVX positions on this page' : 'Synthetic position observations on this page';
    return '<figure class="ux-chart"><figcaption>' + caption + '</figcaption>' +
      '<svg viewBox="0 0 440 160" role="img" aria-label="Discrete historical positions">' +
      points.map((point) => {
        const x = lonSpan ? 20 + (point.longitude - minLon) / lonSpan * 400 : 220;
        const y = latSpan ? 140 - (point.latitude - minLat) / latSpan * 120 : 80;
        return '<circle cx="' + x + '" cy="' + y + '" r="4"><title>' +
          point.latitude + ', ' + point.longitude + '</title></circle>';
      }).join('') +
      '</svg><small>Positions are shown as individual samples. Lines between observations are omitted.</small></figure>';
  }
  const roadGeometryCache = new WeakMap();
  function nearRoadStop(point, stop) {
    const rad = Math.PI / 180;
    const halfChord = Math.sin((point[0] - stop.latitude) * rad / 2) ** 2 +
      Math.cos(point[0] * rad) * Math.cos(stop.latitude * rad) *
      Math.sin((point[1] - stop.longitude) * rad / 2) ** 2;
    return halfChord <= Math.sin(1000 / 12742000) ** 2;
  }
  function roadGeometry(revision) {
    if (!revision || typeof revision !== 'object') return null;
    if (roadGeometryCache.has(revision)) return roadGeometryCache.get(revision);
    const route = revision.calculation?.route;
    let geometry = null, remaining = 30000;
    try {
      if (revision.state !== 'active' || route?.geometry_format !== 'polyline6' ||
          !Array.isArray(route.legs) || !route.legs.length || route.legs.length > 9 ||
          !Array.isArray(revision.stops) || revision.stops.length !== route.legs.length + 1 ||
          !revision.stops.every(valid)) throw new Error('Invalid route');
      geometry = route.legs.map(({shape}, index) => {
        if (typeof shape !== 'string' || shape.length > 300000) throw new Error('Invalid shape');
        let offset = 0, lat = 0, lon = 0;
        const points = [];
        function delta() {
          let number = 0;
          for (let shift = 0; shift <= 30; shift += 5) {
            const part = shape.charCodeAt(offset++) - 63;
            if (!(part >= 0 && part <= 63)) break;
            number += (part & 31) * 2 ** shift;
            if (part < 32) return number % 2 ? -Math.ceil(number / 2) : number / 2;
          }
          throw new Error('Invalid coordinate delta');
        }
        while (offset < shape.length) {
          lat += delta();
          lon += delta();
          if (Math.abs(lat) > 90e6 || Math.abs(lon) > 180e6 || --remaining < 0)
            throw new Error('Shape out of bounds');
          points.push([lat / 1e6, lon / 1e6]);
        }
        if (points.length < 2 || !nearRoadStop(points[0], revision.stops[index]) ||
            !nearRoadStop(points.at(-1), revision.stops[index + 1])) throw new Error('Incomplete shape');
        return points;
      });
    } catch (_) { geometry = null; }
    roadGeometryCache.set(revision, geometry);
    return geometry;
  }

  let mapInstance = null, mapContainer = null, countries = null, mapStyle = '',
    lastView = null, currentPage = null, syncRoadStyle = null;
  const mapLayers = new Map();
  function beforeRender(reset) {
    if (mapInstance) {
      lastView = {
        center: mapInstance.getCenter(),
        zoom: mapInstance.getZoom(),
        page: currentPage
      };
      mapInstance.remove();
      syncRoadStyle = null;
      mapInstance = null;
      mapContainer = null;
      mapLayers.clear();
    }
    if (reset) lastView = null;
  }
  function reportedPosition(device) {
    const position = device.location?.location;
    const eligible = device.registry.identity_kind === 'physical'
      ? position?.trust === 'unverified' && position.received_at
      : position?.trust === 'synthetic';
    return eligible && valid(position.gps) ? position : null;
  }
  function mountMap(data, page, fleet) {
    const el = document.getElementById('workspace-map');
    if (!el || !root.L || !root.TrackiumWorldMap) return;
    currentPage = page;
    const style = getComputedStyle(document.documentElement),
      accent = style.getPropertyValue('--tc-accent').trim(),
      signalColor = fleet ? style.getPropertyValue('--tc-info').trim() : accent,
      land = style.getPropertyValue('--tc-surface-raised').trim(),
      outline = style.getPropertyValue('--tc-outline').trim();
    const fresh = mapContainer !== el;
    if (fresh) {
      beforeRender(false);
      currentPage = page;
      const maxNativeZoom = Number(document.documentElement.dataset.roadTileMaxZoom);
      const roadEnabled = document.documentElement.classList.contains('lite-workspace') &&
        Number.isInteger(maxNativeZoom) && maxNativeZoom >= 1 && maxNativeZoom <= 19;
      mapInstance = L.map(el, {
        scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false,
        markerZoomAnimation: false, minZoom: 1, maxZoom: roadEnabled ? 19 : 12, attributionControl: true
      }).setView([25, 10], 2);
      mapContainer = el;
      if (roadEnabled) mapInstance.createPane('trackiumGeography').style.zIndex = '190';
      countries = L.geoJSON(root.TrackiumWorldMap, {
        interactive: false, className: 'workspace-map-land', pane: roadEnabled ? 'trackiumGeography' : 'overlayPane'
      }).addTo(mapInstance);
      if (roadEnabled) {
        const media = matchMedia('(prefers-color-scheme: dark)');
        const tilesUrl = () => {
          const theme = document.documentElement.dataset.tcTheme;
          const dark = theme === 'dark' || (!theme && media.matches);
          const variant = dark && document.documentElement.dataset.roadTileDark === 'true' ? 'dark/' : '';
          return '/app/assets/road-tiles/' + variant + '{z}/{x}/{y}.png';
        };
        let currentRoadUrl = tilesUrl();
        const roads = L.tileLayer(currentRoadUrl, {
          maxNativeZoom, maxZoom: 19, noWrap: true, updateWhenIdle: true,
          className: 'trackium-road-tiles',
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(mapInstance);
        syncRoadStyle = () => {
          const url = tilesUrl();
          if (url !== currentRoadUrl) roads.setUrl(currentRoadUrl = url);
        };
        const updateStyle = syncRoadStyle;
        media.addEventListener('change', updateStyle);
        mapInstance.on('unload', () => media.removeEventListener('change', updateStyle));
        const chooser = L.control.layers({ 'Roads': roads, 'Geographic overview': L.layerGroup() }, {}, {
          collapsed: false, position: 'bottomleft'
        }).addTo(mapInstance);
        chooser.getContainer().setAttribute('aria-label', 'Basemap layer');
      }
      mapInstance.attributionControl.setPrefix('');
      mapInstance.attributionControl.addAttribution('Leaflet (BSD-2-Clause) · Natural Earth (public domain)');
      mapInstance.on('zoomend', countryLabels);
    }
    const map = mapInstance;
    syncRoadStyle?.();
    const planColor = document.documentElement.classList.contains('lite-workspace')
      ? style.getPropertyValue('--tc-gold').trim() : accent;
    const theme = [outline, land].join('/');
    if (fresh || mapStyle !== theme) {
      countries.setStyle({ color: outline, weight: 1, fillColor: land, fillOpacity: 1 });
      mapStyle = theme;
    }
    const seen = new Set();
    function place(key, signature, create) {
      seen.add(key);
      const previous = mapLayers.get(key);
      if (previous?.signature === signature) return;
      const open = previous?.layer.isPopupOpen();
      previous?.layer.remove();
      const layer = create().addTo(map);
      mapLayers.set(key, { signature, layer });
      const marker = key.startsWith('stop:') && fleet ? layer.getElement() : null;
      if (marker) {
        marker.setAttribute('tabindex','0');
        marker.setAttribute('role','button');
        marker.setAttribute('aria-label','Inspect planned checkpoint');
        marker.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          layer.openPopup();
          layer.getPopup().getElement()?.querySelector('button')?.focus();
        });
      }
      if (open && layer.getPopup()) {
        layer.getPopup().options.autoPan = false;
        layer.openPopup();
        layer.getPopup().options.autoPan = true;
      }
    }
    const bounds = [];
    if (fleet?.layers.planned !== false) for (const s of (page === 'dashboard' ? data.shipments.filter(s => s.status === 'active') : data.shipments)) {
      const points = (s.route || []).filter(valid).map((p) => [p.latitude, p.longitude]);
      bounds.push(...points);
      const details = '<button class="button secondary" data-server-action="view-shipment" data-server-id="' +
        esc(s.id) + '">Shipment details</button>';
      if (points.length)
        place('shipment:' + s.id, JSON.stringify([points,s.name,planColor,fleet?.selected === s.id]), () =>
          L.polyline(points, { color: planColor, weight: fleet?.selected === s.id ? 4 : 3,
              opacity: fleet?.selected && fleet.selected !== s.id ? .24 : .9, dashArray: '6 6' })
            .bindPopup('<p>Planned route · ' + esc(s.name) + '</p>' + details, { minWidth: 170 }));
      for (const [index, stop] of (s.route || []).entries()) {
        if (!valid(stop)) continue;
        const kind = index === 0 ? 'Origin' : index === s.route.length - 1 ? 'Destination' : 'Checkpoint';
        const select = fleet ? '<button class="button secondary" data-fleet-shipment="' +
          esc(s.id) + '">Select shipment</button>' : '';
        place('stop:' + s.id + ':' + index, JSON.stringify([stop,kind,outline,planColor,fleet?.selected === s.id]), () =>
          L.circleMarker([stop.latitude,stop.longitude], { className: 'ux-route-stop', radius: fleet?.selected === s.id ? 8 : 6, color: outline, fillColor: planColor,
              fillOpacity: fleet?.selected && fleet.selected !== s.id ? .25 : .85 })
            .bindPopup('<p>' + kind + ' · ' + esc(stop.name) + '</p>' + select + details, { minWidth: 170 }));
      }
    }
    const revision = fleet?.road?.revision;
    const geometry = fleet?.layers.calculated !== false && roadGeometry(revision);
    if (geometry) {
      const signature = revision.id + '/' + accent;
      place('road:' + fleet.selected, signature, () =>
        L.polyline(geometry, {color:accent, weight:5, opacity:.95, className:'fleet-road-line', interactive:false}));
      for (const [index, stop] of revision.stops.entries()) {
        const title = index === 0 ? 'Road origin' : index === revision.stops.length - 1 ? 'Road destination' : 'Road waypoint ' + index;
        place('road-stop:' + index, signature, () => L.circleMarker([stop.latitude,stop.longitude],
          {className:'fleet-road-stop',radius:6,color:accent,fillColor:land,fillOpacity:1}).bindPopup(title));
      }
    }
    if (fleet?.layers.observed !== false) for (const d of data.devices) {
      const obs = reportedPosition(d);
      if (!obs) continue;
      const p = [obs.gps.latitude, obs.gps.longitude];
      bounds.push(p);
      const stale = Date.now() - Date.parse(obs.occurred_at) > 15 * 60 * 1000;
      place('device:' + d.registry.id, JSON.stringify([obs,d.registry.label,stale,signalColor]), () => L.circleMarker(p, {
        className: 'ux-device-position' + (stale ? ' fleet-stale-fix' : ''),
        radius: 7,
        color: signalColor,
        fillColor: signalColor,
        fillOpacity: 0.9
      })
        .bindPopup(
          '<strong>' +
            esc(d.registry.label) +
            '</strong><p>' + (obs.trust === 'unverified' ? 'Last known fix: ' : 'Last reported: ') +
            esc(obs.trust === 'unverified' ? obs.occurred_at : date(obs.occurred_at)) +
            ' · ' + (stale ? 'Older than 15 minutes' : 'Recent sample') +
            (obs.received_at ? '</p><p>Gateway received: ' + esc(date(obs.received_at)) : '') +
            '</p><p>Source: ' +
            esc(obs.trust || 'unknown') +
            '</p><p>' +
            obs.gps.latitude +
            ', ' +
            obs.gps.longitude +
            '</p>'
        ));
    }
    for (const [key, record] of mapLayers) if (!seen.has(key)) {
      record.layer.remove();
      mapLayers.delete(key);
    }
    if (fresh) {
      if (lastView?.page === page) map.setView(lastView.center, lastView.zoom);
      else if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
      countryLabels();
      map.invalidateSize();
    }
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
  }
  function focusMap(key) {
    if (!mapInstance) return;
    const target = mapLayers.get(key)?.layer;
    const layers = target ? [target] : key ? [] : [...mapLayers.values()].map(record => record.layer);
    if (!layers.length) return;
    const bounds = L.latLngBounds([]);
    for (const layer of layers) bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
    mapInstance.fitBounds(bounds, {
      padding: [30, 30], animate: false, maxZoom: document.documentElement.dataset.roadTileMaxZoom ? 16 : 8
    });
    target?.openPopup();
  }
  root.TrackiumComponents = {
    esc,
    date,
    label,
    pagination,
    chart,
    connection,
    beforeRender,
    mountMap,
    focusShipment(id) {
      focusMap(mapLayers.has('road:' + id) ? 'road:' + id : 'shipment:' + id);
    },
    focusMap,
    reportedPosition,
    roadGeometry,
    historyPosition,
    positionHistory
  };
})(window);
