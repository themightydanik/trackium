(function(root) {
  'use strict';
  const legacy=root.TrackiumServerView;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const arr=v=>Array.isArray(v)?v:[];
  const value=(v,unit='')=>v===null||v===undefined||v===''?'Not reported':esc(v)+unit;
  const date=v=>v?esc(new Date(v).toLocaleString()):'Not reported';
  const badge=(label,kind='neutral')=>'<span class="badge '+kind+'">'+esc(label??'Unknown')+'</span>';
  const action=(label,type,id='',disabled=false)=>'<button class="button secondary" data-server-action="'+type+'" data-server-id="'+esc(id)+'" '+(disabled?'disabled':'')+'>'+esc(label)+'</button>';
  const panel=(title,body,cls='')=>'<section class="panel server-content '+cls+'"><div class="section-title"><h2>'+esc(title)+'</h2></div>'+body+'</section>';
  const empty=(title,text)=>'<div class="ux-empty"><span class="empty-glyph" aria-hidden="true">◇</span><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p></div>';
  const metric=(label,v,unit='')=>'<div class="ux-metric"><span>'+esc(label)+'</span><strong>'+value(v,unit)+'</strong></div>';
  const fields=rows=>'<dl class="evidence-grid">'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+value(v)+'</dd></div>').join('')+'</dl>';
  const stateLabel=p=>({pending:'Pending · no inclusion evidence',submitting:'Preparing · not included',submitted:'Submitted · inclusion not established',included:'Inclusion observed',confirmed:'Gateway reports confirmed · recheck independently',failed:'Failed',retryable_error:'Retryable error'})[p.state]||'Unknown';
  const heading=(page,state)=>'<div class="page-heading"><div><div class="eyebrow">TRACKIUM CORE · TENANT WORKSPACE</div><h1>'+({dashboard:'Your operations at a glance',shipments:'Shipments',devices:'Devices',map:'Routes & reported positions',events:'Event history',proofs:'Proof records',settings:'Gateway settings'})[page]+'</h1><p>'+ (state.updated?'Observed '+date(state.updated)+' · loaded snapshot, not a live stream':'Waiting for an authenticated observation')+'</p></div>'+action('Refresh','refresh','',state.loading)+'</div>';
  function search(page,view,data) {
    const q=esc(view.query||'');
    const options=['all',...new Set((page==='shipments'?data.shipments:page==='devices'?data.devices.map(d=>d.registry):page==='events'?data.events:data.proofs).flatMap(r=>[r.status,r.mode,r.source_trust,r.event_type,r.state]).filter(Boolean))];
    return '<div class="toolbar ux-filter"><label class="search-field" for="server-search"><span>Search loaded '+esc(page)+'</span><input id="server-search" class="text-input" type="search" value="'+q+'" placeholder="Name, identifier or status" autocomplete="off"></label><label>Filter<select id="server-filter" class="text-input">'+options.map(v=>'<option value="'+esc(v)+'" '+(view.filter===v?'selected':'')+'>'+esc(v==='all'?'All records':v)+'</option>').join('')+'</select></label><small>Only the returned snapshot is searched.</small></div>';
  }
  const matches=(r,view)=>{
    const fields=[r.name,r.label,r.id,r.status,r.state,r.mode,r.source_trust,r.event_type,r.shipment_id,r.identity_kind].filter(v=>typeof v==='string');
    return fields.join(' ').toLowerCase().includes((view.query||'').toLowerCase())&&(!view.filter||view.filter==='all'||fields.includes(view.filter));
  };
  function shipmentActions(s,state,data) {
    const can=scope=>state.session.scopes.includes(scope),next={draft:['active','cancelled'],active:['cancelled'],delivered:['completed']}[s.status]||[];
    const run=arr(data.simulations).find(r=>r.shipment_id===s.id&&['running','paused'].includes(r.state));
    return '<div class="form-actions">'+next.map(n=>action(n==='active'?'Activate':n==='completed'?'Complete shipment':'Cancel','transition:'+n,s.id,!can('shipments'))).join('')+'</div>'+
      (state.session.simulation_enabled&&can('simulate')?'<div class="simulation-tools"><h3>Synthetic simulation</h3><p>Authorized server simulation; never a physical tracker connection.</p>'+(run?badge('Synthetic run · '+run.state)+action(run.state==='running'?'Pause':'Resume',run.state==='running'?'pause':'resume',run.id)+action('Finish simulation','finish',run.id):s.status==='active'?action('Start normal simulation','start:normal',s.id)+action('Start temperature excursion','start:temperature-excursion',s.id):'')+'</div>':'');
  }
  function shipmentCard(s,state) {
    const data=state.data,device=data.devices.find(d=>d.registry.id===s.device_id);
    return '<article class="panel server-content server-shipment"><div class="server-shipment-heading"><h2>'+esc(s.name)+'</h2>'+badge(s.status)+badge(s.source_trust,'synthetic')+'</div><p>'+esc(device?.registry.label||s.device_id)+'</p><ol class="ux-route">'+arr(s.checkpoints).map(cp=>'<li class="'+(cp.visited_at?'visited':'')+'"><strong>'+esc(cp.name)+'</strong><span>'+ (cp.visited_at?'Reached '+date(cp.visited_at):'Arrival not recorded')+'</span></li>').join('')+'</ol>'+action('Open shipment','view-shipment',s.id)+shipmentActions(s,state,data)+'</article>';
  }
  function deviceTable(items) {
    return '<div class="table-wrap"><table class="ux-device-table"><thead><tr><th>Device</th><th>Reported state</th><th>Temperature</th><th>Humidity</th><th>Battery</th><th>Provenance / measured</th><th>Details</th></tr></thead><tbody>'+items.map(d=>{
      const e=d.history?.events?.[0],p=e?.payload||{};
      return '<tr><td data-label="Device"><strong>'+esc(d.registry.label)+'</strong><small class="cell-note">'+esc(d.registry.id)+'</small></td><td data-label="Reported state">'+badge(d.status?.status||'unknown')+'</td><td data-label="Temperature">'+value(p.temperature_c,' °C')+'</td><td data-label="Humidity">'+value(p.humidity_pct,' %')+'</td><td data-label="Battery">'+value(p.battery_pct,' %')+'</td><td data-label="Provenance / measured">'+badge(p.trust||'unknown','synthetic')+'<small class="cell-note">'+date(e?.occurred_at)+'</small></td><td data-label="Details">'+action('Device details','view-device',d.registry.id)+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  }
  function map(data) {
    const points=arr(data.shipments).flatMap(s=>arr(s.route)).concat(arr(data.devices).map(d=>d.location?.location?.gps).filter(Boolean)).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
    if(!points.length)return empty('No positions loaded','No GPS values or route points are available. Missing coordinates are not replaced with zeros.');
    const xs=points.map(p=>p.longitude),ys=points.map(p=>p.latitude),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    const project=p=>[50+(p.longitude-xmin)/(xmax-xmin||1)*800,350-(p.latitude-ymin)/(ymax-ymin||1)*280];
    return '<div class="ux-map"><svg viewBox="0 0 900 420" role="img" aria-label="Schematic routes and last reported positions, not navigation">'+data.shipments.map(s=>'<polyline class="route-line" points="'+arr(s.route).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).map(p=>project(p).join(',')).join(' ')+'"/>').join('')+data.devices.filter(d=>d.location?.location?.gps&&Number.isFinite(d.location.location.gps.latitude)&&Number.isFinite(d.location.location.gps.longitude)).map(d=>{const [x,y]=project(d.location.location.gps);return '<g><circle cx="'+x+'" cy="'+y+'" r="8"/><text x="'+x+'" y="'+(y-18)+'">'+esc(d.registry.label)+'</text></g>';}).join('')+'</svg><p class="map-caption">Schematic · last reported samples · no external tiles · not for navigation</p></div>';
  }
  function proofCards(items) {
    return '<div class="ux-card-grid">'+items.map(p=>'<article class="panel server-content"><div class="section-title"><h2>'+esc(p.commitment?.event_type||'Proof')+'</h2>'+badge(p.mode,'synthetic')+'</div><h3>'+esc(stateLabel(p))+'</h3><p>Reported confirmations '+value(p.confirmations)+' / '+value(p.required_depth)+'</p><p>Checked '+date(p.last_checked_at)+'</p>'+badge(p.commitment?.source_trust||'unknown','synthetic')+'<div class="form-actions">'+action('Evidence details','view-proof',p.id)+action('Verify','proof-verify',p.id)+action('Export bundle','proof-export',p.id)+(p.publisher_kind==='local'?action('Export Local Core job','local-job',p.id):'')+'</div></article>').join('')+'</div>';
  }
  function render(page,state,view={}) {
    if(!state.data)return heading(page,state)+panel('Loading your workspace','<div role="status" class="loading-state">Loading authenticated Gateway data…</div>');
    const d=state.data,can=scope=>state.session.scopes.includes(scope),old=()=>{const t=document.createElement('template');t.innerHTML=legacy.render(page,state);return t.content;};
    let body='';
    if(page==='dashboard')body='<div class="summary-grid ux-summary">'+[['Shipments',d.shipments.length,'shipments'],['Devices',d.devices.length,'devices'],['Proof records',arr(d.proofs).length,'proofs'],['Loaded events',d.events.length,'events']].map(([label,n,path])=>'<a class="panel ux-kpi" href="#'+path+'"><span>'+label+'</span><strong>'+n+'</strong><small>In the loaded snapshot →</small></a>').join('')+'</div><div class="ux-dashboard-grid">'+panel('Routes & positions',map(d)+'<a class="text-link" href="#map">Open map →</a>')+panel('Recent recorded events',d.events.length?'<ol class="ux-timeline">'+d.events.slice(0,5).map(e=>'<li><strong>'+esc(e.event_type)+'</strong><time>'+date(e.event_time)+'</time>'+badge(e.source_trust,'synthetic')+action('Event details','view-event',e.id)+'</li>').join('')+'</ol>':empty('No events in this snapshot','New events appear after the Gateway records them.'))+'</div>'+panel('Shipments',d.shipments.length?'<div class="ux-card-grid">'+d.shipments.slice(0,3).map(s=>shipmentCard(s,state)).join('')+'</div>':empty('No shipments loaded','An authorized operator can create a shipment on the Shipments page.'));
    if(page==='shipments')body=search(page,view,d)+'<div class="toolbar"><p>First 25 shipments · scoped to your tenant</p>'+action('Create shipment','create','',!can('shipments'))+'</div><div class="ux-card-grid">'+d.shipments.filter(s=>matches(s,view)).map(s=>shipmentCard(s,state)).join('')+'</div>'+(d.shipments.filter(s=>matches(s,view)).length?'':empty('No matching shipments','Change the loaded-snapshot filters or refresh the Gateway.'));
    if(page==='devices')body=search(page,view,d)+panel('Tenant devices','<div class="toolbar"><p>Latest reported samples with measurement time and provenance.</p>'+action('Create simulator identity','device','',!can('simulate')||!state.session.simulation_enabled)+'</div>'+deviceTable(d.devices.filter(x=>matches(x.registry,view))))+(d.devices.filter(x=>matches(x.registry,view)).length?'':empty('No matching devices','No device records match the loaded snapshot.'));
    if(page==='map')body=panel('Routes & last reported locations',map(d))+'<div class="ux-card-grid">'+d.devices.map(x=>panel(x.registry.label,fields([['Measured',x.location?.location?.occurred_at],['Latitude',x.location?.location?.gps?.latitude],['Longitude',x.location?.location?.gps?.longitude],['Source trust',x.location?.location?.trust]])+action('Device details','view-device',x.registry.id))).join('')+'</div>';
    if(page==='events')body=search(page,view,d)+panel('Recorded event timeline','<p>Outbox state describes worker delivery, never blockchain confirmation. First 50 events per loaded shipment.</p><ol class="ux-timeline">'+d.events.filter(e=>matches(e,view)).map(e=>'<li><div class="section-title"><h3>'+esc(e.event_type)+'</h3>'+badge(e.source_trust,'synthetic')+'</div><p>'+esc(d.shipments.find(s=>s.id===e.shipment_id)?.name||e.shipment_id)+'</p><time>'+date(e.event_time)+'</time><p>'+esc(e.outbox_state||'unknown')+' · delivery only</p>'+action('Event details','view-event',e.id)+'</li>').join('')+'</ol>')+(d.events.filter(e=>matches(e,view)).length?'':empty('No matching events','No event history matches the loaded snapshot.'));
    if(page==='proofs'){
      const controls=old().querySelector('section.panel.server-content');
      body='<div class="notice"><p>Submission, chain inclusion and physical sensor authenticity are different claims. Gateway confirmation is a past observation; Verify performs a fresh reader check. Test receipts are not blockchain transactions.</p></div>'+search(page,view,d)+proofCards(arr(d.proofs).filter(p=>matches(p,view)))+(!arr(d.proofs).filter(p=>matches(p,view)).length?empty('No matching proof records','Publication stays governed by the existing owner policy.'): '')+'<details class="panel ux-advanced"><summary>Advanced publisher policy & Local Core exchange</summary>'+(controls?.innerHTML||'')+'</details>';
    }
    if(page==='settings'){
      const original=old().querySelector('section.settings-panel');
      body=root.TrackiumAppearance.form()+panel('Gateway origin & tenant',fields([['Origin',location.origin],['Tenant',state.session.tenant_id],['Session audience',state.session.audience],['Expires',state.session.expires_at],['Scopes',state.session.scopes.join(', ')]])+'<p>Owner-approved, short-lived session. HttpOnly cookies remain unavailable to JavaScript. No owner key or bearer-token form.</p>'+action('Disconnect and revoke','disconnect'))+'<details class="panel ux-advanced"><summary>Session & technical details</summary>'+(original?.innerHTML||'')+'</details>';
    }
    const age=state.updated?Date.now()-Date.parse(state.updated):0;
    return heading(page,state)+'<div class="ux-observation" role="status">'+badge('Authenticated observation','teal')+'<span>First 25 devices/shipments; only loaded records are counted.</span>'+(age>300000?badge('Snapshot older than five minutes · refresh','warning'):'')+(state.loading?'<span>Refreshing…</span>':'')+'</div>'+body;
  }
  function detail(type,id,data) {
    let title='Reported evidence',body='',record;
    if(type==='shipment'){
      record=data.shipments.find(s=>s.id===id);if(!record)return null;title=record.name;
      body=fields([['Status',record.status],['Device',record.device_id],['Source trust',record.source_trust],['Identifier',record.id]])+panel('Cargo conditions',fields([['Minimum temperature (°C)',record.conditions?.temperature_min_c],['Maximum temperature (°C)',record.conditions?.temperature_max_c],['Tolerance (°C)',record.conditions?.tolerance_c],['Route deviation limit (m)',record.conditions?.max_deviation_m]]))+panel('Route & checkpoints','<ol class="ux-timeline">'+arr(record.checkpoints).map(cp=>'<li><h3>'+esc(cp.name)+'</h3>'+fields([['Latitude',cp.latitude],['Longitude',cp.longitude],['Visited',cp.visited_at],['Source trust',cp.source_trust]])+'</li>').join('')+'</ol>')+panel('Event history',arr(data.events).filter(e=>e.shipment_id===id).map(e=>'<p>'+esc(e.event_type)+' · '+date(e.event_time)+' · '+esc(e.source_trust)+'</p>').join('')||'No events')+panel('Linked proofs',proofCards(arr(data.proofs).filter(p=>p.shipment_id===id)));
    }else if(type==='device'){
      const d=data.devices.find(x=>x.registry.id===id);if(!d)return null;record=d;title=d.registry.label;
      const latest=d.history?.events?.[0];body=fields([['Identifier',d.registry.id],['Identity',d.registry.identity_kind],['Status',d.status?.status],['Last activity',d.status?.last_event_at],['Latitude',d.location?.location?.gps?.latitude],['Longitude',d.location?.location?.gps?.longitude],['Position measured',d.location?.location?.occurred_at],['Position trust',d.location?.location?.trust],['Sensors measured',latest?.occurred_at],['Sensor trust',latest?.payload?.trust]])+'<div class="ux-sensors">'+metric('Temperature',latest?.payload?.temperature_c,' °C')+metric('Humidity',latest?.payload?.humidity_pct,' %')+metric('Battery',latest?.payload?.battery_pct,' %')+'</div>'+panel('Returned telemetry history','<ol class="ux-timeline">'+arr(d.history?.events).map(e=>'<li><time>'+date(e.occurred_at)+'</time>'+badge(e.payload?.trust||'unknown','synthetic')+'<div class="ux-sensors">'+metric('Temperature',e.payload?.temperature_c,' °C')+metric('Humidity',e.payload?.humidity_pct,' %')+metric('Battery',e.payload?.battery_pct,' %')+'</div></li>').join('')+'</ol>');
    }else{
      record=arr(type==='proof'?data.proofs:data.events).find(e=>e.id===id);if(!record)return null;title=type==='proof'?'Proof evidence':record.event_type;
      body=fields(type==='proof'?[['State',stateLabel(record)],['Confirmations',record.confirmations],['Required depth',record.required_depth],['Last checked',record.last_checked_at],['Source trust',record.commitment?.source_trust],['TxPoW',record.txpow_id],['Commitment',record.wire?.slice(14)],['Error',record.last_error_code]]:[['Event',record.event_type],['Measured / recorded',record.event_time],['Shipment',record.shipment_id],['Source trust',record.source_trust],['SHA-256',record.sha256],['Previous hash',record.previous_hash],['Outbox',record.outbox_state]]);
    }
    return '<h2 id="dialog-title">'+esc(title)+'</h2><p>Reported evidence only. Measurement time, source trust and fetch time are separate; missing readings are not zeros.</p>'+body+'<details class="ux-advanced"><summary>Advanced Raw Data</summary><pre>'+esc(JSON.stringify(record,null,2))+'</pre></details>';
  }
  function stopFields(p,i) {
    return '<div data-route-stop><h3>Stop '+(i+1)+'</h3>'+[['name','Name','text'],['latitude','Latitude','number'],['longitude','Longitude','number'],['radius_m','Radius (m)','number']].map(([key,label,type])=>'<label>'+label+'<input class="text-input" data-route-field="'+key+'" type="'+type+'" '+(type==='number'?'step="any"':'')+' value="'+esc(p[key] ?? '')+'" required></label>').join('')+'<button class="button secondary" type="button" data-route-remove>Remove stop</button></div>';
  }
  function createForm(devices) {
    const t=document.createElement('template');t.innerHTML=legacy.createForm(devices);
    const raw=t.content.querySelector('[name=route]');const points=JSON.parse(raw.value);
    raw.closest('label').outerHTML='<fieldset class="ux-route-editor"><legend>Draft route · edit stops before saving</legend><div id="route-stops">'+points.map(stopFields).join('')+'</div><button class="button secondary" type="button" data-route-add>Add route stop</button><p>2–32 ordered checkpoints; the Gateway validates the final route.</p><details><summary>Advanced route JSON</summary><label>Route JSON<textarea id="advanced-route-json" class="text-input" rows="6">'+esc(JSON.stringify(points,null,2))+'</textarea></label><button class="button secondary" type="button" data-route-apply>Use JSON stops</button></details><p id="route-feedback" role="status"></p></fieldset>';
    return t.innerHTML;
  }
  function route(form) {return [...form.querySelectorAll('[data-route-stop]')].map(stop=>Object.fromEntries(['name','latitude','longitude','radius_m'].map(key=>[key,key==='name'?stop.querySelector('[data-route-field='+key+']').value:Number(stop.querySelector('[data-route-field='+key+']').value)])));}
  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-route-add]'),remove=event.target.closest('[data-route-remove]'),apply=event.target.closest('[data-route-apply]');if(!add&&!remove&&!apply)return;
    const form=event.target.closest('form'),list=form.querySelector('#route-stops'),feedback=form.querySelector('#route-feedback');
    if(add){if(list.children.length>=32){feedback.textContent='Maximum 32 stops.';return;}list.insertAdjacentHTML('beforeend',stopFields({},list.children.length));list.lastElementChild.querySelector('input').focus();}
    if(remove){if(list.children.length<=2){feedback.textContent='At least two stops are required.';return;}remove.closest('[data-route-stop]').remove();}
    if(apply){try{const points=JSON.parse(form.querySelector('#advanced-route-json').value);if(!Array.isArray(points)||points.length<2||points.length>32||points.some(p=>!p||typeof p!=='object'))throw Error();list.innerHTML=points.map(stopFields).join('');feedback.textContent='Draft stops updated; nothing saved yet.';}catch(_){feedback.textContent='Enter an array of 2–32 route points.';}}
  });
  function observation(title,result) {
    return '<h2 id="dialog-title">'+esc(title)+'</h2>'+fields(Object.entries(result).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v)).slice(0,40).map(([k,v])=>[k.replaceAll('_',' '),v]))+'<p>Connected peers and a recent tip do not establish global synchronization. Inspect the actual Core before any separately authorized operation.</p><details><summary>Advanced Raw Data</summary><pre>'+esc(JSON.stringify(result,null,2))+'</pre></details>';
  }
  root.TrackiumServerView={...legacy,render,detail,createForm,route,observation};
})(window);
