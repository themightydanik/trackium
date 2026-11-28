import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function xyz(latitude,longitude,zoom) {
  const n=2**zoom;
  return [Math.floor((longitude+180)/360*n),
    Math.floor((1-Math.asinh(Math.tan(latitude*Math.PI/180))/Math.PI)*n/2)];
}

export function regionalJobs(region, archiveDate) {
  const {id,etag,archiveSize,bounds,minZoom,maxZoom}=region;
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || archiveDate !== region.archiveDate ||
      !/^"[\w-]+"$/.test(etag) || !Number.isSafeInteger(archiveSize) || archiveSize <= 0 ||
      !Array.isArray(bounds) || bounds.length!==4 || !bounds.every(Number.isFinite) ||
      !Number.isInteger(minZoom) || !Number.isInteger(maxZoom) ||
      minZoom < 8 || maxZoom > 15 || minZoom > maxZoom) throw Error('Invalid regional release');
  const [west,south,east,north]=bounds;
  if (west < -180 || east >= 180 || south < -85 || north > 85 ||
      west >= east || south >= north) throw Error('Invalid regional bounds');
  const jobs=[];
  for (let z=minZoom;z<=maxZoom;z++) {
    const [left,top]=xyz(north,west,z), [right,bottom]=xyz(south,east,z);
    if (jobs.length+(right-left+1)*(bottom-top+1)>1800) throw Error('Tile budget exceeded');
    for (let x=left;x<=right;x++) for(let y=top;y<=bottom;y++) jobs.push([z,x,y].join('/'));
  }
  return jobs;
}

export async function atomicWrite(path,bytes) {
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.'+randomUUID()+'.tmp';
  await writeFile(temp,bytes,{flag:'wx'});
  await rename(temp,path);
}

export function verifyTile(bytes, entry, decode) {
  if (bytes.length!==entry.bytes || bytes.length>512*1024 || sha256(bytes)!==entry.sha256) return false;
  try { return decode(gunzipSync(bytes,{maxOutputLength:16*1024*1024}))===entry.roads; }
  catch { return false; }
}

export async function reusableTile(path, identity, decode) {
  try {
    const entry=JSON.parse(await readFile(path+'.json','utf8'));
    if (entry.identity!==identity || !Number.isInteger(entry.roads) || entry.roads<0) return null;
    const bytes=await readFile(path);
    if (!verifyTile(bytes,entry,decode)) return null;
    return {bytes:entry.bytes,sha256:entry.sha256,roads:entry.roads};
  } catch (error) {
    if (['ENOENT','Z_DATA_ERROR','Z_BUF_ERROR'].includes(error.code) ||
        error instanceof SyntaxError) return null;
    throw error;
  }
}

export function nearestRoad(point, lines) {
  let best=Infinity, road=null;
  // Local tangent-plane approximation for short point-to-segment distances.
  const latScale=111194.93, lonScale=latScale*Math.cos(point.latitude*Math.PI/180);
  const xy=([lon,lat])=>[(lon-point.longitude)*lonScale,(lat-point.latitude)*latScale];
  for (const line of lines) {
    const {coordinates}=line;
    let [ax,ay]=xy(coordinates[0]);
    for (let i=1; i<coordinates.length; i++) {
      const [bx,by]=xy(coordinates[i]);
      const dx=bx-ax, dy=by-ay;
      const n=dx*dx+dy*dy;
      const t=n ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/n)) : 0;
      const meters=Math.hypot(ax+t*dx,ay+t*dy);
      if (meters<best) {
        best=meters;
        road={id:line.id,kind:line.kind,name:line.name};
      }
      ax=bx;
      ay=by;
    }
  }
  return {meters:best,road};
}
