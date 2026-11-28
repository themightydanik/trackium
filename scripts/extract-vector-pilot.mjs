/* Export small, bounded XYZ windows of a dated Protomaps archive for local review. */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { PMTiles } = await import(pathToFileURL(require.resolve('pmtiles')));
const [output, release = '20261124'] = process.argv.slice(2);
if (!output || !/^\d{8}$/.test(release)) throw Error('Usage: extract-vector-pilot.mjs OUTPUT YYYYMMDD');
const url = 'https://build.protomaps.com/' + release + '.pmtiles';
const http = promisify(execFile);
let requests = 0, bytes = 0, etag, archiveSize;
const archive = new PMTiles({
  getKey: () => url,
  async getBytes(offset, length, signal) {
    if (length > 1024 * 1024 || ++requests > 1800 || bytes + length > 96 * 1024 * 1024)
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
        !identity || etag && etag !== identity) throw Error('Archive version or byte range changed');
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
const jobs = new Set();
for (const [lat,lon] of Object.values(sites)) for (let z=8;z<=Math.min(15,header.maxZoom);z++) {
  const scale=2**z;
  const x=Math.floor((lon+180)/360*scale);
  const y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*scale/2);
  for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) jobs.add([z,x+dx,y+dy].join('/'));
}
const queue=[...jobs], tiles={};
await Promise.all(Array.from({length:5},async()=>{
  for (;;) {
    const job=queue.pop();
    if (!job) return;
    const tile=await archive.getZxy(...job.split('/').map(Number));
    if (!tile) continue;
    const contents=gzipSync(Buffer.from(tile.data),{level:6});
    const target=resolve(dir,job+'.pbf');
    await mkdir(resolve(target,'..'),{recursive:true});
    await writeFile(target,contents);
    tiles[job]={bytes:contents.length,sha256:createHash('sha256').update(contents).digest('hex')};
  }
}));
const manifest={source:url,etag,archiveSize,release,sites,minimumZoom:8,
  maximumZoom:Math.min(15,header.maxZoom),requests,bytes,tiles:Object.fromEntries(Object.entries(tiles).sort())};
await writeFile(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({release,requests,bytes,tiles:Object.keys(tiles).length,
  tileBytes:Object.values(tiles).reduce((sum,t)=>sum+t.bytes,0)}));
