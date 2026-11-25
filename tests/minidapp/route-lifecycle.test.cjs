const assert = require('node:assert/strict');
const test = require('node:test');
const {join} = require('node:path');
const {fixturePage,fixture,start,stop} = require('./fixture.cjs');

const stops = [{latitude:51,longitude:17},{latitude:50,longitude:30}];
const roads = [
  {id:'00000000-0000-4000-8000-000000000001',version:1,state:'superseded',profile:'auto',
    stops,shape:'_kxg`B_crl_@~b`|@_smxW',distance_m:950000,estimated_duration_s:36000},
  {id:'00000000-0000-4000-8000-000000000002',version:2,state:'active',profile:'truck',
    stops,shape:'_kxg`B_crl_@~flW_{fjL~zrc@_wemJ',distance_m:953000,estimated_duration_s:36500}
];
function detail(row) {
  return {...row,calculation:{profile:row.profile,truck:row.truck,graph:row.graph,calculated_at:row.calculated_at,
    route:{geometry_format:'polyline6',distance_m:row.distance_m,estimated_duration_s:row.estimated_duration_s,
      legs:[{shape:row.shape}]}},
  audit:['proposed','approved','active',...(row.state === 'superseded' ? ['superseded'] : [])].map(state =>
    ({state,occurred_at:'2026-01-01T00:00:00Z',actor_account_id:'fixture-account'}))};
}
for (const [i,row] of roads.entries()) {
  row.graph = {id:String(i+1).repeat(64),engine_version:'3.6.3',osm_snapshot:'2026-01-01'};
  row.calculated_at = '2026-01-01T00:00:00Z';
}
roads[1].truck = {height_m:3.9,width_m:2.5,length_m:16,weight_t:35,axle_load_t:10};
const select = page => page.locator('.fleet-manifest-list button').first().click();

test('read-only history and bounded comparison keep the mint route and telemetry visible at four viewports', async () => {
  await start();
  try {
    for (const [width,theme] of [[1440,'dark'],[768,'light'],[390,'light'],[320,'dark']]) {
      const posts = [];
      const source = {customer:true,role:'viewer',touch:width <= 390,
        lifecycle(path,method) {
          if (method !== 'GET') posts.push(path);
          const envelope = {generation:6,active_revision_id:roads[1].id};
          const last = path.split('/').at(-1);
          if (last === 'active') return {body:{...envelope,revision:detail(roads[1])}};
          if (last === 'road-routes') return {body:{...envelope,revisions:[...roads].reverse()}};
          if (last === 'compare') return {body:{...envelope,from:roads[0],to:roads[1],
            delta:{distance_m:3000,estimated_duration_s:500}}};
          return {body:{...envelope,revision:detail(roads.find(row => row.id === last))}};
        }};
      const {page,context} = await fixturePage(width,theme,source);
      try {
        await select(page);
        const history = page.getByRole('region',{name:'Road route history'});
        await history.locator('.lifecycle-revisions').getByText('v1 · Superseded',{exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Plan from checkpoints'}).count(),0);
        assert.equal(await history.getByRole('button',{name:/Approve|Activate/}).count(),0);
        await history.getByRole('button',{name:'Inspect v1'}).click();
        await history.getByText(/Superseded · 2026-01-01.*fixture-account/).waitFor();
        await history.getByLabel('Base revision').selectOption(roads[0].id);
        await history.getByLabel('Target revision').selectOption(roads[1].id);
        await history.getByRole('button',{name:'Compare revisions'}).press('Enter');
        const compare = history.getByRole('region',{name:'Revision comparison'});
        await compare.waitFor();
        assert.equal(await page.locator('.fleet-road-line').count(),1);
        assert.equal(await page.locator('.route-comparison-base,.route-comparison-target').count(),2);
        assert.equal(await page.locator('.ux-device-position').count(),1);
        assert.equal(await page.locator('.ux-route-stop').count(),2);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.TRACKIUM_LIFECYCLE_SCREENSHOTS && [1440,390].includes(width)) {
          for (const scheme of ['light','dark']) {
            await page.emulateMedia({colorScheme:scheme});
            await page.evaluate(() => scrollTo(0,0));
            await page.screenshot({path:join(process.env.TRACKIUM_LIFECYCLE_SCREENSHOTS,'lifecycle-'+width+'-'+scheme+'.png'),fullPage:true});
          }
        }
        await compare.getByRole('button',{name:'Clear comparison'}).click();
        assert.equal(await page.locator('.route-comparison-base,.route-comparison-target').count(),0);
        source.tenant = 'unrelated company';
        await page.getByRole('button',{name:'Refresh',exact:true}).click();
        await page.locator('.connection-state').waitFor();
        assert.equal(await history.count(),0);
        assert.deepEqual(posts,[]);
      } finally { await context.close(); }
    }
  } finally { await stop(); }
});

test('proposal confirmation, retry and repeated clicks use one logical operation',async () => {
  await start();
  try {
    const posts = [];
    const source = {customer:true,role:'dispatcher',
      calculate:() => ({body:detail(roads[0]).calculation}),
      lifecycle(path,method,body) {
        if (method === 'POST') {
          posts.push(body);
          if (posts.length === 1) return {abort:true};
          return {body:{generation:2,active_revision_id:null,replayed:true,revision:detail({...roads[0],state:'proposed'})}};
        }
        const active = path.endsWith('/active');
        return {body:{generation:posts.length ? 2 : 1,active_revision_id:null,
          ...(active ? {revision:null} : {revisions:posts.length ? [{...roads[0],state:'proposed'}] : []})}};
      }};
    const {page,context} = await fixturePage(390,'light',source);
    try {
      await select(page);
      await page.getByRole('button',{name:'Plan from checkpoints'}).click();
      await page.getByRole('button',{name:'Calculate route'}).click();
      await page.getByRole('button',{name:'Propose route',exact:true}).click();
      const dialog = page.locator('#route-confirmation');
      await dialog.getByRole('button',{name:'Cancel'}).click();
      assert.equal(posts.length,0);
      await page.getByRole('button',{name:'Propose route',exact:true}).click();
      await dialog.getByRole('button',{name:'Propose route',exact:true}).evaluate(button => {
        button.click();
        button.click();
      });
      await page.getByText(/Proposal outcome unknown/).waitFor();
      assert.equal(posts.length,1);
      await page.getByRole('textbox',{name:'Origin latitude'}).fill('51.12');
      await page.getByRole('button',{name:'Retry exact proposal'}).click();
      await dialog.getByRole('button',{name:'Retry proposal',exact:true}).click();
      await page.getByText('Existing proposal recovered.',{exact:true}).waitFor();
      assert.equal(posts.length,2);
      assert.deepEqual(posts[1],posts[0]);
      assert.equal(posts[1].calculation.origin.latitude,51);
      assert.equal(await page.getByRole('button',{name:/Approve v|Activate v/}).count(),0);
      source.role = 'viewer';
      await page.getByRole('button',{name:'Refresh',exact:true}).click();
      await page.locator('.lifecycle-revisions').getByText('v1 · Proposed',{exact:true}).waitFor();
      assert.equal(await page.locator('.fleet-planner').count(),0);
      assert.equal(await page.getByRole('region',{name:'Revision details'}).count(),0);
    } finally { await context.close(); }
  } finally { await stop(); }
});
