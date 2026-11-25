(function (root) {
  'use strict';
  const {esc} = root.TrackiumComponents;
  const truckFields = {
    height_m:['Height (m)',1,5], width_m:['Width (m)',1,3], length_m:['Length (m)',2,25],
    weight_t:['Gross weight (t)',2,60], axle_load_t:['Axle load (t)',1,15]
  };
  const blank = () => ({latitude:'',longitude:''});
  const allowed = session => session?.customer && ['owner','admin','dispatcher'].includes(session.role) &&
    session.scopes?.includes('shipments');
  const number = (value,min,max,precision) => {
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim())) return null;
    const n = Number(value), scale = 10 ** precision;
    return Number.isFinite(n) && n >= min && n <= max && Math.round(n*scale)/scale === n ? n : null;
  };
  function point(row) {
    const latitude = number(row.latitude,-90,90,6), longitude = number(row.longitude,-180,180,6);
    return latitude === null || longitude === null ? null : {latitude,longitude};
  }
  const stopName = (index,length) => index === 0 ? 'Origin' : index === length-1 ? 'Destination' : 'Waypoint ' + index;
  const errors = {
    INVALID_COORDINATES:'Check the latitude and longitude of every stop.',
    INVALID_WAYPOINTS:'Use distinct stops at least 10 m apart and a total distance within 3,000 km.',
    INVALID_VEHICLE_DIMENSIONS:'Check all truck dimensions and weights.',
    COVERAGE_UNAVAILABLE:'A stop could not be matched to a covered road. Check its coordinates.',
    ROUTE_NOT_FOUND:'No connected route for these stops and vehicle. Adjust a stop or review the vehicle profile.',
    ROUTING_RATE_LIMITED:'Routing capacity reached. Wait a minute before calculating again.',
    ROUTING_TIMEOUT:'Routing timed out. Check connectivity and calculate again.',
    ROUTING_RESPONSE_INVALID:'Gateway returned an invalid route. Try again later.',
    GRAPH_RELEASE_MISMATCH:'Road graph is unavailable. Ask your Gateway operator to check the routing release.'
  };
  function errorText(error) {
    if (error.name === 'AbortError') return errors.ROUTING_TIMEOUT;
    if ([401,403].includes(error.status)) return 'Routing permission denied. Check your company role and session.';
    return errors[error.code] || 'Routing unavailable. Check the Gateway connection and calculate again.';
  }
  function payload(draft) {
    const stops = draft.rows.map(point);
    const invalid = stops.indexOf(null);
    if (invalid !== -1) throw new Error(stopName(invalid,stops.length) + ': enter valid latitude and longitude with up to six decimals.');
    const result = {origin:stops[0],destination:stops.at(-1),waypoints:stops.slice(1,-1),profile:draft.profile};
    if (draft.profile === 'truck') {
      const truck = {};
      for (const [key,[label,min,max]] of Object.entries(truckFields)) {
        truck[key] = number(draft.truck[key],min,max,3);
        if (truck[key] === null) throw new Error(label + ': use ' + min + '–' + max + ' with up to three decimals.');
      }
      if (truck.axle_load_t > truck.weight_t) throw new Error('Axle load must not exceed gross weight.');
      result.truck = truck;
    }
    return {result,stops};
  }
  function create(request, changed) {
    let draft, serial = 0;
    function invalidate() {
      draft.pending?.abort();
      draft.pending = null;
      draft.preview = null;
      draft.error = '';
    }
    return {
      get draft() { return draft; },
      close(force = false) {
        if (!draft) return true;
        if (!force && draft.dirty && !root.confirm('Discard the unsaved route draft?')) return false;
        invalidate();
        draft = null;
        return true;
      },
      start(shipment, fromPlan) {
        const checkpoints = shipment.checkpoints?.length >= 2 ? shipment.checkpoints : shipment.route;
        const rows = fromPlan ? (checkpoints || []).map(point).filter(Boolean) : [];
        draft = { shipment:shipment.id, rows:rows.length >= 2 && rows.length <= 10 ? rows : [blank(),blank()],
          profile:'auto', truck:{}, pick:null, dirty:false, preview:null, error:'', token:++serial };
        if (fromPlan && (rows.length < 2 || rows.length > 10 || rows.length !== checkpoints?.length)) {
          draft.rows = [blank(),blank()];
          draft.error = 'The existing plan needs 2–10 valid stops to import. Start with the blank draft.';
        }
      },
      edit(change) {
        if (!draft) return;
        invalidate();
        draft.dirty = true;
        change(draft);
        changed();
      },
      pick(latlng) {
        if (draft?.pick == null) return;
        this.edit(d => {
          d.rows[d.pick] = {latitude:Math.max(-90,Math.min(90,latlng.lat)).toFixed(6),
            longitude:((latlng.lng + 180) % 360 + 360) % 360 - 180};
          d.rows[d.pick].longitude = d.rows[d.pick].longitude.toFixed(6);
          d.pick = null;
        });
      },
      async calculate() {
        if (!draft || draft.pending) return;
        let input;
        invalidate();
        try { input = payload(draft); }
        catch (error) { draft.error = error.message; changed(); return; }
        const owner = draft, controller = new AbortController();
        owner.pending = controller;
        owner.pick = null;
        changed();
        try {
          const calculation = await request('/v1/routes/calculate','POST',input.result,controller.signal);
          if (draft !== owner || owner.pending !== controller) return;
          const preview = {id:++serial, calculation, stops:input.stops, input:input.result};
          if (!Number.isFinite(calculation.route?.distance_m) || calculation.route.distance_m <= 0 ||
              !Number.isFinite(calculation.route?.estimated_duration_s) || calculation.route.estimated_duration_s <= 0 ||
              calculation.profile !== input.result.profile || !root.TrackiumComponents.routeGeometry(preview))
            throw Object.assign(new Error('Invalid route'),{code:'ROUTING_RESPONSE_INVALID'});
          owner.preview = preview;
        } catch (error) {
          if (draft === owner && owner.pending === controller) owner.error = errorText(error);
        } finally {
          if (draft === owner && owner.pending === controller) {
            owner.pending = null;
            changed();
          }
        }
      }
    };
  }
  const button = (label, action, index, disabled = false) =>
    '<button type="button" class="button secondary" data-planner="' + action + '"' +
    (index === undefined ? '' : ' data-index="' + index + '"') + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  function render(draft, proposal = '') {
    const preview = draft.preview?.calculation, route = preview?.route, graph = preview?.graph;
    const rows = draft.rows.map((row,i) => {
      const intermediate = i > 0 && i < draft.rows.length-1;
      const title = stopName(i,draft.rows.length);
      return '<fieldset class="planner-stop"><legend>' + title + '</legend>' +
        '<div class="planner-coordinates">' + ['latitude','longitude'].map(key =>
          '<label>' + (key === 'latitude' ? 'Latitude' : 'Longitude') +
          '<input class="text-input" inputmode="decimal" aria-label="' + title + ' ' + key +
          '" data-planner-coordinate="' + key + '" data-index="' + i + '" value="' + esc(row[key]) + '"></label>').join('') +
        '</div><div class="planner-actions">' + button(draft.pick === i ? 'Cancel map pick' : 'Pick on map','pick',i) +
        (intermediate ? button('Move up','up',i,i === 1) + button('Move down','down',i,i === draft.rows.length-2) +
          button('Remove waypoint','remove',i) : '') + '</div></fieldset>';
    }).join('');
    const truck = draft.profile === 'truck' ? '<div class="planner-coordinates">' +
      Object.entries(truckFields).map(([key,[label,min,max]]) =>
        '<label>' + label + ' <small>' + min + '–' + max +
        '</small><input class="text-input" inputmode="decimal" data-planner-truck="' + key +
        '" value="' + esc(draft.truck[key] || '') + '"></label>').join('') + '</div>' : '';
    const minutes = route ? Math.ceil(route.estimated_duration_s/60) : 0;
    const duration = (minutes >= 60 ? Math.floor(minutes/60) + ' h ' : '') + minutes % 60 + ' min';
    const maneuvers = route?.legs.flatMap(leg => Array.isArray(leg.maneuvers) ? leg.maneuvers : []).slice(0,512) || [];
    return '<section class="fleet-planner" data-view-key="planner:' + draft.token + '" aria-labelledby="planner-title">' +
      '<header><h2 id="planner-title">Road route planner</h2>' + button('Return to fleet view','close') + '</header>' +
      '<form id="fleet-planner-form" novalidate>' + rows +
      button('Add waypoint','add',undefined,draft.rows.length >= 10) +
      '<label class="planner-profile">Vehicle profile<select class="text-input" id="planner-profile">' +
      '<option value="auto"' + (draft.profile === 'auto' ? ' selected' : '') + '>Passenger car</option>' +
      '<option value="truck"' + (draft.profile === 'truck' ? ' selected' : '') + '>Truck</option></select></label>' + truck +
      '<div class="planner-actions"><button type="submit" class="button"' + (draft.pending ? ' disabled' : '') +
      '>' + (draft.pending ? 'Calculating…' : 'Calculate route') + '</button>' +
      button('Reset draft','reset') + '</div><p role="status">' + esc(draft.error ||
        (draft.pending ? 'Waiting for Gateway routing.' : '')) + '</p></form>' +
      (preview ? '<section aria-label="Calculated preview"><h3>Calculated preview</h3>' +
        '<strong>' + esc((route.distance_m/1000).toLocaleString(undefined,{maximumFractionDigits:1})) +
        ' km · ' + duration + ' estimated driving</strong> · ' +
        (preview.profile === 'truck' ? 'Truck' : 'Passenger car') +
        '<p>Driving estimate excludes traffic, border delays and mandatory rests.</p>' +
        (preview.profile === 'truck' ? '<p class="fleet-warning">Truck restrictions may be incomplete. Verify legal clearance independently.</p>' : '') +
        (preview.warnings?.includes('COVERAGE_MAY_BE_INCOMPLETE') ? '<p class="fleet-warning">Road network coverage may be incomplete.</p>' : '') +
        button('Fit preview','fit') + proposal +
        '<details><summary>Preview stops</summary><ol>' + draft.preview.stops.map((stop,index,stops) =>
          '<li>' + stopName(index,stops.length) + ' · ' + stop.latitude + ', ' + stop.longitude + '</li>').join('') +
        '</ol></details>' +
        '<details><summary>Graph provenance</summary><dl><dt>Graph release</dt><dd>' + esc(graph?.id || 'Unavailable') +
        '</dd><dt>Engine</dt><dd>' + esc(graph?.engine_version || 'Unavailable') +
        '</dd><dt>OSM snapshot</dt><dd>' + esc(graph?.osm_snapshot || 'Unavailable') +
        '</dd><dt>Calculated at</dt><dd>' + esc(preview.calculated_at || 'Unavailable') + '</dd></dl></details>' +
        (maneuvers.length ? '<details><summary>Maneuvers</summary><ol>' +
          maneuvers.map(step => '<li>' + esc(step.instruction) + '</li>').join('') + '</ol></details>' : '') +
        '</section>' : '') + '</section>';
  }
  root.TrackiumRoutePlanner = {create, allowed, render, point, stopName};
})(window);
