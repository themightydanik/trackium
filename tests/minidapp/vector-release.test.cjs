const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {gzipSync}=require('node:zlib');

test('regional jobs are continuous and resume rejects stale checksums and malformed payloads',async t=>{
  const {regionalJobs,atomicWrite,reusableTile,verifyTile,sha256}=await import('../../scripts/vector-release.mjs');
  const region=require('../../routing/maps/kyiv-zhytomyr.json');
  const jobs=regionalJobs(region,'20261124');
  assert.equal(jobs.length,968);
  assert.equal(new Set(jobs).size,jobs.length);
  assert.throws(()=>regionalJobs({...region,bounds:[1,82,0,84]},'20261124'),/bounds/);
  assert.throws(()=>regionalJobs(region,'20261125'),/release/);
  assert.throws(()=>regionalJobs({...region,maxZoom:15},'20261124'),/budget/);
  const dir=await fs.mkdtemp(join(tmpdir(),'trackium-vector-release-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const path=join(dir,'tile.pbf');
  const bytes=gzipSync(Buffer.from('one road'));
  const entry={identity:'archive A',bytes:bytes.length,sha256:sha256(bytes),roads:1};
  const decode=payload=>{assert.equal(payload.toString(),'one road');return 1;};
  await atomicWrite(path,bytes);
  assert.equal(await reusableTile(path,'archive A',decode),null);
  await atomicWrite(path+'.json',JSON.stringify(entry));
  assert.ok(await reusableTile(path,'archive A',decode));
  assert.equal(await reusableTile(path,'archive B',decode),null);
  const corrupt=Buffer.from(bytes);
  corrupt[0]^=1;
  await atomicWrite(path,corrupt);
  assert.equal(await reusableTile(path,'archive A',decode),null);
  assert.equal(verifyTile(corrupt,{...entry,sha256:sha256(corrupt)},decode),false);
});

test('nearest-road alignment uses GeoJSON longitude first and retains the matching class',async()=>{
  const {nearestRoad}=await import('../../scripts/vector-release.mjs');
  const vertex={latitude:50,longitude:30};
  const track={id:1,kind:'path',name:null,coordinates:[[29.999,50],[30.001,50]]};
  const road={id:2,kind:'minor_road',name:null,coordinates:[[29.999,50.00024],[30.001,50.00024]]};
  assert.ok(nearestRoad(vertex,[road]).meters>26);
  const match=nearestRoad(vertex,[road,track]);
  assert.equal(match.meters,0);
  assert.equal(match.road.id,1);
  assert.equal(match.road.kind,'path');
});
