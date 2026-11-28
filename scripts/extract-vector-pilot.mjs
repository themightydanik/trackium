/* Export small, bounded XYZ windows of a dated Protomaps archive for local review. */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import {sha256,regionalJobs,reusableTile,atomicWrite,verifyTile} from './vector-release.mjs';

const require = createRequire(import.meta.url);
const { PMTiles } = await import(pathToFileURL(require.resolve('pmtiles')));
const [output, release = '20261124', regionFile, mode] = process.argv.slice(2);
if (!output || !/^\d{8}$/.test(release) || mode && (mode!=='--verify' || !regionFile))
  throw Error('Usage: extract-vector-pilot.mjs OUTPUT YYYYMMDD [REGION_JSON [--verify]]');
const region=regionFile ? JSON.parse(await readFile(regionFile,'utf8')) : null;
const planned=region && regionalJobs(region,release);
const dep=name=>import(pathToFileURL(require.resolve(name)));
const [{VectorTile},{default:Pbf}]=await Promise.all([dep('@mapbox/vector-tile'),dep('pbf')]);
function roadCount(bytes) {
  if (!bytes.length || bytes.length>16*1024*1024) throw Error('Invalid decoded tile size');
  const layers=new VectorTile(new Pbf(bytes)).layers;
  if (!Object.keys(layers).length) throw Error('Empty MVT layer set');
  let count=0;
  for(let i=0; layers.roads && i<layers.roads.length; i++) {
    const feature=layers.roads.feature(i);
    if(feature.type===2 && feature.properties.kind!=='path' && feature.loadGeometry().length) count++;
  }
  return count;
}
if (mode==='--verify') {
  const manifest=JSON.parse(await readFile(resolve(output,'manifest.json'),'utf8'));
  const coverage=JSON.parse(await readFile(resolve(output,'coverage.json'),'utf8'));
  const permitted=new Set(planned), keys=Object.keys(manifest.tiles);
  if (manifest.source!=='https://build.protomaps.com/'+release+'.pmtiles' ||
      manifest.release!==region.id || manifest.etag!==region.etag || manifest.archiveSize!==region.archiveSize ||
      JSON.stringify(manifest.bounds)!==JSON.stringify(region.bounds) || manifest.requested!==permitted.size ||
      manifest.minimumZoom!==region.minZoom || manifest.maximumZoom!==region.maxZoom ||
      coverage.release!==region.id || coverage.minZoom!==region.minZoom || coverage.maxZoom!==region.maxZoom ||
      JSON.stringify(coverage.roads)!==JSON.stringify(keys.filter(key=>manifest.tiles[key].roads>0)))
    throw Error('Release manifest mismatch');
  for(const key of keys) {
    if (!permitted.has(key) || !verifyTile(await readFile(resolve(output,key+'.pbf')),manifest.tiles[key],roadCount))
      throw Error('Missing, corrupted or out-of-region tile: '+key);
  }
  console.log(JSON.stringify({verified:keys.length,absent:permitted.size-keys.length,roadTiles:coverage.roads.length}));
  process.exit(0);
}
const url = 'https://build.protomaps.com/' + release + '.pmtiles';
const http = promisify(execFile);
let requests = 0, bytes = 0, etag, archiveSize;
const archive = new PMTiles({
  getKey: () => url,
  async getBytes(offset, length, signal) {
    if (length > 1024 * 1024 || ++requests > 1800 || bytes + length > 200 * 1024 * 1024)
      throw Error('Pilot range budget exceeded');
    bytes += length;
    const end = offset + length - 1;
    const {stdout} = await http('curl',[
      '--silent','--show-error','--fail','--include','--suppress-connect-headers',
      '--max-time','25','--retry','1','--max-filesize',String(length),'--range',offset+'-'+end,url
    ],{encoding:'buffer',maxBuffer:length+16384,signal});
    const split = stdout.indexOf('\r\n\r\n');
    const headers = stdout.subarray(0,split).toString();
    const data = stdout.subarray(split+4);
    const range = /^content-range: bytes (\d+)-(\d+)\/(\d+)\r?$/im.exec(headers);
    const identity = /^etag: (.+)\r?$/im.exec(headers)?.[1].trim();
    if (!range || +range[1] !== offset || +range[2] !== end || data.length !== length ||
        !identity || etag && etag !== identity ||
        region && (region.etag!==identity || region.archiveSize!==+range[3])) throw Error('Archive version or byte range changed');
    etag = identity;
    archiveSize = +range[3];
    return {data:Uint8Array.from(data).buffer,etag};
  }
});
const sites = {
  kyiv:[50.4504,30.5236], kyivWest:[50.447,30.296], lviv:[49.8419,24.0315],
  warsaw:[52.2175,20.9755], berlin:[52.52,13.405], essen:[51.4556,7.0116],
  corridor:[49.960722,23.055853], crossBorderOverview:[50.0,23.0]
};
const dir = resolve(output);
await mkdir(dir,{recursive:true});
const header = await archive.getHeader();
if (region && header.maxZoom<region.maxZoom) throw Error('Archive has insufficient zoom coverage');
const jobs = new Set(planned || []);
for (const [lat,lon] of (region ? [] : Object.values(sites))) for (let z=8;z<=Math.min(15,header.maxZoom);z++) {
  const scale=2**z;
  const x=Math.floor((lon+180)/360*scale);
  const y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*scale/2);
  for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) jobs.add([z,x+dx,y+dy].join('/'));
}
const queue=[...jobs], tiles={};
let reused=0;
const identity=JSON.stringify([url,etag,region?.id ?? release]);
await Promise.all(Array.from({length:5},async()=>{
  for (;;) {
    const job=queue.pop();
    if (!job) return;
    const target=resolve(dir,job+'.pbf');
    const existing=await reusableTile(target,identity,roadCount);
    if (existing) {tiles[job]=existing; reused++; continue;}
    const tile=await archive.getZxy(...job.split('/').map(Number));
    if (!tile) continue;
    const roads=roadCount(new Uint8Array(tile.data));
    const contents=gzipSync(Buffer.from(tile.data),{level:6});
    if (contents.length>512*1024) throw Error('Tile exceeds Gateway limit: '+job);
    const entry={bytes:contents.length,sha256:sha256(contents),roads};
    await atomicWrite(target,contents);
    await atomicWrite(target+'.json',JSON.stringify({identity,...entry}));
    tiles[job]=entry;
  }
}));
const manifest={source:url,etag,archiveSize,release:region?.id ?? release,
  ...(region ? {bounds:region.bounds} : {sites}),minimumZoom:region?.minZoom ?? 8,
  maximumZoom:region?.maxZoom ?? Math.min(15,header.maxZoom),requested:jobs.size,
  tiles:Object.fromEntries(Object.entries(tiles).sort())};
const coverage={release:manifest.release,minZoom:manifest.minimumZoom,maxZoom:manifest.maximumZoom,
  roads:Object.keys(manifest.tiles).filter(key=>manifest.tiles[key].roads>0)};
await atomicWrite(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await atomicWrite(resolve(dir,'coverage.json'),JSON.stringify(coverage)+'\n');
console.log(JSON.stringify({release:manifest.release,reused,requests,bytes,requested:jobs.size,
  tiles:Object.keys(tiles).length,roadTiles:coverage.roads.length,peakRssKiB:process.resourceUsage().maxRSS,
  tileBytes:Object.values(tiles).reduce((sum,t)=>sum+t.bytes,0)}));
