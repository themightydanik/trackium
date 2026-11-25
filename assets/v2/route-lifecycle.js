(function (root) {
  'use strict';
  const C = root.TrackiumComponents;
  const {esc} = C;
  const label = state => ({proposed:'Proposed',approved:'Approved',active:'Active',superseded:'Superseded'}[state] || 'Unavailable');
  const profile = value => ({auto:'Passenger car',truck:'Truck'}[value] || 'Unavailable');
  const readAllowed = session => session?.customer === true && session.scopes?.includes('read');
  const manage = session => root.TrackiumRoutePlanner.allowed(session) && ['owner','admin'].includes(session.role);
  const action = (title, name, value = '', disabled = false) =>
    '<button class="button secondary" type="button" data-route-action="' + name +
    '" data-route-value="' + esc(value) + '"' + (disabled ? ' disabled' : '') + '>' + esc(title) + '</button>';
  const facts = rows => '<dl class="lifecycle-facts">' + rows.map(([key,value]) =>
    '<div><dt>' + esc(key) + '</dt><dd>' + esc(value ?? 'Unavailable') + '</dd></div>').join('') + '</dl>';
  const metric = (n,div,unit) => Number.isFinite(n) ? (n/div).toLocaleString(undefined,{maximumFractionDigits:2}) + ' ' + unit : 'Unavailable';
  const distance = n => metric(n,1000,'km');
  const duration = n => metric(n,60,'min');
  const delta = (value, format) => (value > 0 ? '+' : '') + format(value);
  function stopChanges(from, to) {
    const changes = [];
    for (let i=0; i<Math.max(from.length,to.length); i++) {
      const a = from[i], b = to[i];
      if (a?.latitude === b?.latitude && a?.longitude === b?.longitude) continue;
      const text = p => p ? p.latitude + ', ' + p.longitude : '—';
      changes.push('<li>Stop ' + (i+1) + ' · ' + esc(text(a) + ' → ' + text(b)) + '</li>');
    }
    return changes.length ? '<ul aria-label="Changed ordered stops">' + changes.join('') + '</ul>' :
      '<p>Same ordered stop coordinates.</p>';
  }
  const summary = route => facts([
    ['Vehicle',profile(route.profile)],['Distance',distance(route.distance_m)],
    ['Estimated driving time',duration(route.estimated_duration_s)],
    ['Graph release',route.graph?.id],['Engine version',route.graph?.engine_version],['OSM snapshot',route.graph?.osm_snapshot],
    ['Calculated at',route.calculated_at]
  ]);
  function truck(values) {
    return values ? facts([
      ['Height',metric(values.height_m,1,'m')],['Width',metric(values.width_m,1,'m')],
      ['Length',metric(values.length_m,1,'m')],['Gross weight',metric(values.weight_t,1,'t')],
      ['Axle load',metric(values.axle_load_t,1,'t')]
    ]) : '';
  }
  function stops(rows) {
    return '<ol>' + rows.map((point,index) => '<li>' +
      esc(root.TrackiumRoutePlanner.stopName(index,rows.length) + ' · ' + point.latitude + ', ' + point.longitude) +
      '</li>').join('') + '</ol>';
  }
  const messages = {
    ROUTE_GENERATION_CONFLICT:'Another operator changed the route history. Review the refreshed revisions before making a new decision.',
    ROUTE_STATE_CONFLICT:'That transition is no longer available. Review the current route state.',
    ROUTE_REQUEST_CONFLICT:'This request ID belongs to a different proposal. Review history before submitting again.',
    ROUTE_HISTORY_LIMIT:'This shipment has reached its 100-revision limit.',
    ROUTE_RESOURCE_NOT_FOUND:'This shipment or revision is no longer available in this company.',
    COVERAGE_UNAVAILABLE:'A stop is outside supported roads. Review the draft coordinates.',
    ROUTE_NOT_FOUND:'No connected route was found for this vehicle and stops.',
    ROUTING_RATE_LIMITED:'Routing capacity reached. Wait before explicitly submitting again.',
    ROUTING_TIMEOUT:'The calculation timed out. Check connectivity before retrying.'
  };

  function create(request, changed, refreshRoad, dialog) {
    let context, scope, read, write, confirmation, uncertain;
    const path = () => '/v1/shipments/' + encodeURIComponent(context.shipment.id) + '/road-routes';
    const clearRead = () => { read?.abort(); read = null; };
    function cancelContext() {
      clearRead();
      write?.abort();
      write = null;
      confirmation = null;
      dialog.close();
      context = null;
    }
    function sync(key, shipment, session, road) {
      if (key !== scope) {
        cancelContext();
        scope = key;
        uncertain = null;
      }
      if (!shipment || !readAllowed(session)) {
        if (context) cancelContext();
        return;
      }
      if (context?.shipment.id !== shipment.id) {
        cancelContext();
        context = {shipment,session,road:null,detail:null,comparison:null,note:'',waiting:false};
      }
      context.shipment = shipment;
      if (road === context.blockedRoad) return;
      context.blockedRoad = null;
      if (road?.history?.generation !== context.road?.history?.generation) {
        clearRead();
        context.waiting = false;
        if (context.detailGeneration !== road?.history?.generation) context.detail = null;
        context.comparison = null;
      }
      context.road = road;
    }
    async function load(queries, apply) {
      clearRead();
      const current = context, controller = new AbortController();
      read = controller;
      current.waiting = true;
      changed();
      try {
        const result = await Promise.all(queries.map(query => request(query,'GET',undefined,controller.signal)));
        if (context !== current || read !== controller) return;
        const generation = current.road?.history?.generation;
        if (result.some(row => row.generation !== generation)) {
          current.note = messages.ROUTE_GENERATION_CONFLICT;
          refreshRoad(current.shipment.id,true);
        } else apply(current,result);
      } catch (_) {
        if (context === current && read === controller) current.note = 'Revision data unavailable. Refresh history and try again.';
      } finally {
        if (context === current && read === controller) {
          controller.abort();
          read = null;
          current.waiting = false;
          changed();
        }
      }
    }
    function inspect(id) {
      if (!context.road?.history?.revisions.some(row => row.id === id)) return;
      void load([path() + '/' + encodeURIComponent(id)], (current,[result]) => {
        current.detail = result.revision;
        current.detailGeneration = result.generation;
        current.note = '';
      });
    }
    function compare(base, target) {
      const ids = new Set(context.road?.history?.revisions.map(row => row.id));
      if (base === target || !ids.has(base) || !ids.has(target)) {
        context.note = 'Choose two different revisions.';
        changed();
        return;
      }
      const url = path(), query = new URLSearchParams({base_revision:base,target_revision:target});
      void load([url + '/compare?' + query,url + '/' + encodeURIComponent(base),url + '/' + encodeURIComponent(target)],
        (current,[diff,from,to]) => {
          current.comparison = {diff, routes:[from.revision,to.revision]};
          current.note = '';
        });
    }
    function ask(kind, draft, id) {
      if (!context || write || dialog.open) return;
      const history = context.road?.history;
      const revision = history?.revisions.find(row => row.id === id);
      const canPropose = root.TrackiumRoutePlanner.allowed(context.session);
      let intent, content;
      if (kind === 'retry' && canPropose && uncertain?.shipment === context.shipment.id) {
        intent = uncertain;
        content = '<p>Retry the exact proposal with its original request ID. Gateway returns the existing revision if it already committed.</p>' + intent.review;
      } else if (kind === 'propose' && canPropose && !uncertain && history &&
          draft?.shipment === context.shipment.id && draft.preview && draft.preview.id !== context.submittedPreview) {
        const {input,calculation} = draft.preview;
        const review = summary({...calculation,...calculation.route}) + truck(input.truck) + stops(draft.preview.stops);
        intent = {kind,shipment:context.shipment.id,url:path(),review,previewId:draft.preview.id,body:{
          expected_generation:history.generation,request_id:root.crypto.randomUUID(),calculation:structuredClone(input)
        }};
        content = '<p>Gateway recalculates and stores a new revision. The active route stays in place.</p>' + review;
      } else if (manage(context.session) && history && revision &&
          ((kind === 'approve' && revision.state === 'proposed') || (kind === 'activate' && revision.state === 'approved'))) {
        const active = history.revisions.find(row => row.id === history.active_revision_id);
        intent = {kind,shipment:context.shipment.id,url:path() + '/' + encodeURIComponent(id) + '/' + kind,
          body:{expected_generation:history.generation}};
        content = '<p>Revision v' + esc(revision.version) + ' · ' + esc(label(revision.state)) + '</p>' +
          (kind === 'approve' ? '<p>Approval leaves the active planning route unchanged.</p>' :
            '<p>Replace the active planning route' + (active ? ' v' + esc(active.version) : ' (none currently active)') +
            '. Shipment checkpoints and observations stay in place.</p>' +
            (active ? facts([['Distance delta',delta(revision.distance_m-active.distance_m,distance)],
              ['Driving time delta',delta(revision.estimated_duration_s-active.estimated_duration_s,duration)]]) : '') +
            '<p>Estimates use the saved road graph. Traffic and temporary restrictions are outside this calculation.</p>' +
            (revision.profile === 'truck' ? '<p>Verify HGV restrictions independently.</p>' : '')) + summary(revision);
      }
      if (!intent) return;
      confirmation = {context,intent};
      dialog.returnValue = '';
      const title = kind === 'retry' ? 'Retry proposal' : kind === 'propose' ? 'Propose route' :
        kind === 'approve' ? 'Approve revision' : 'Activate revision';
      dialog.querySelector('#route-confirmation-content').innerHTML =
        '<h2 id="route-confirmation-title">' + title + '</h2><p>Shipment: ' + esc(context.shipment.name) + '</p>' + content;
      dialog.querySelector('#route-confirm-submit').textContent = title;
      dialog.showModal();
    }
    dialog.addEventListener('close', async () => {
      if (dialog.open) return;
      const command = confirmation;
      confirmation = null;
      dialog.querySelector('#route-confirmation-content').replaceChildren();
      if (dialog.returnValue !== 'confirm' || !command || command.context !== context || write) return;
      const {intent} = command, controller = new AbortController(), current = context;
      const proposal = intent.kind === 'propose';
      if (proposal) uncertain = intent;
      write = controller;
      current.note = 'Submitting to Gateway…';
      changed();
      try {
        const result = await request(intent.url,'POST',intent.body,controller.signal);
        if (context !== current || write !== controller) return;
        if (proposal) {
          uncertain = null;
          current.submittedPreview = intent.previewId;
        }
        current.note = result.replayed ? 'Existing proposal recovered.' : proposal ? 'Proposal stored.' :
          intent.kind === 'approve' ? 'Revision approved.' : 'Revision activated.';
        current.detail = result.revision;
        current.detailGeneration = result.generation;
        // A mutation response is newer than the cached list. Hide obsolete controls until re-read.
        current.blockedRoad = current.road;
        current.road = null;
        refreshRoad(current.shipment.id,true);
      } catch (error) {
        if (context !== current || write !== controller) return;
        const unknown = !error.status || error.status >= 500;
        if (proposal && !unknown) uncertain = null;
        current.note = proposal && unknown ? 'Proposal outcome unknown. Review history, then retry the exact proposal.' :
          !proposal && unknown ? 'Transition outcome unknown. Review refreshed history before deciding again.' :
          messages[error.code] || (error.status === 403 ? 'Your company role cannot perform this action.' : 'Route request failed.');
        current.blockedRoad = current.road;
        current.road = null;
        refreshRoad(current.shipment.id,true);
      } finally {
        if (write === controller) {
          write = null;
          changed();
          if (context === current && document.activeElement === document.body)
            document.getElementById('route-history-title')?.focus();
        }
      }
    });
    return {
      sync, ask, inspect, compare,
      clearComparison() { if (context) { clearRead(); context.waiting = false; context.comparison = null; changed(); } },
      get view() {
        if (!context) return null;
        return {...context, busy:Boolean(write), uncertain:uncertain ? {
          here:uncertain.shipment === context.shipment.id
        } : null};
      }
    };
  }

  function render(view) {
    if (!view) return '';
    const history = view.road?.history, rows = history?.revisions ?? [], selected = view.detail;
    const comparison = view.comparison?.diff;
    const controls = row => manage(view.session) && !view.busy
      ? row.state === 'proposed' ? action('Approve v' + row.version,'approve',row.id) :
        row.state === 'approved' ? action('Activate v' + row.version,'activate',row.id) : '' : '';
    const options = rows.map(row => '<option value="' + esc(row.id) + '">v' + esc(row.version) +
      ' · ' + label(row.state) + '</option>').join('');
    return '<section class="fleet-lifecycle" aria-labelledby="route-history-title"><h3 id="route-history-title" tabindex="-1">Road route history</h3>' +
      '<p role="status">' + esc(view.note || (view.waiting ? 'Loading revision details…' :
        view.road?.status === 'unavailable' ? 'Route history unavailable. Refresh to retry.' : !history ? 'Waiting for route history.' : '')) + '</p>' +
      (!history ? action('Refresh route history','refresh') : '') +
      (view.uncertain ? '<p>' + (view.uncertain.here ? 'A proposal may already have been stored.' :
        'Another shipment has an unresolved proposal in this session. Return to that shipment to retry it.') + '</p>' +
        (view.uncertain.here && root.TrackiumRoutePlanner.allowed(view.session) ? action('Retry exact proposal','retry','',view.busy) : '') : '') +
      (history && !rows.length ? '<p>No revisions yet.</p>' : '') +
      (rows.length ? '<ul class="lifecycle-revisions">' + rows.map(row =>
        '<li data-view-key="revision:' + esc(row.id) + '"><strong>v' + esc(row.version) + ' · ' + esc(label(row.state)) +
        '</strong><span>' + esc(profile(row.profile) + ' · ' + distance(row.distance_m) + ' · ' + duration(row.estimated_duration_s)) +
        '</span><div class="planner-actions">' + action('Inspect v' + row.version,'inspect',row.id) + controls(row) + '</div></li>').join('') + '</ul>' : '') +
      (selected ? '<section aria-label="Revision details"><h4>Revision v' + esc(selected.version) + ' · ' + label(selected.state) + '</h4>' +
        summary({...selected.calculation,...selected.calculation.route}) + truck(selected.calculation.truck) + stops(selected.stops) +
        '<h4>Audit timeline</h4><ol>' + selected.audit.map(entry => '<li>' +
          esc(label(entry.state) + ' · ' + entry.occurred_at + ' · account ' + entry.actor_account_id) + '</li>').join('') +
        '</ol></section>' : '') +
      (rows.length > 1 ? '<form id="route-compare"><label>Base revision<select class="text-input" name="base" aria-label="Base revision">' + options +
        '</select></label><label>Target revision<select class="text-input" name="target" aria-label="Target revision">' + options +
        '</select></label><button class="button secondary">Compare revisions</button></form>' : '') +
      (comparison ? '<section aria-label="Revision comparison"><h4>Revision comparison</h4><p>Dashed terracotta: base. Dotted blue: target.</p>' +
        facts([['Distance delta',delta(comparison.delta.distance_m,distance)],['Driving time delta',delta(comparison.delta.estimated_duration_s,duration)]]) +
        stopChanges(comparison.from.stops,comparison.to.stops) +
        '<div class="lifecycle-comparison">' + [comparison.from,comparison.to].map(row => '<div><h4>v' + esc(row.version) +
          '</h4>' + summary(row) + truck(row.truck) + stops(row.stops) + '</div>').join('') + '</div>' +
        action('Fit comparison','fit') + action('Clear comparison','clear') + '</section>' : '') + '</section>';
  }

  root.TrackiumRouteLifecycle = {create,render,readAllowed,
    proposal(view,draft) {
      return view?.road?.history && !view.uncertain && draft?.preview?.id !== view.submittedPreview && root.TrackiumRoutePlanner.allowed(view.session)
        ? action('Propose route','propose','',view.busy) : '';
    }};
})(window);
