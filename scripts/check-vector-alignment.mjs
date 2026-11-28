/* Compare actual Valhalla polyline6 vertices with roads in a mounted pilot tile window. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { decodeShape } from '../services/gateway/src/routing/contract.js';

const require = createRequire(import.meta.url);
const dep = name => import(pathToFileURL(require.resolve(name)));
const [{VectorTile},{default:Pbf}] = await Promise.all([dep('@mapbox/vector-tile'),dep('pbf')]);
const [directory,...routes] = process.argv.slice(2);
if (!directory || !routes.length) throw Error('Usage: check-vector-alignment.mjs TILE_DIR RAW_ROUTE_JSON...');
const zoom=15, scale=2**zoom;
const cache=new Map();
const maximumCacheEntries=48;
const toTile = (lat,lon) => [
  Math.floor((lon+180)/360*scale),
  Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*scale/2)
];
async function tileRoads(x,y) {
  const key=x+'/'+y;
  if (cache.has(key)) return cache.get(key);
  let data;
  try {
    data=await readFile(directory+'/'+zoom+'/'+key+'.pbf');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return null;
  }
  if (data[0]===31 && data[1]===139) data=gunzipSync(data,{maxOutputLength:16*1024*1024});
  const layer=new VectorTile(new Pbf(data)).layers.roads;
  const lines=[];
  for (let i=0; layer && i<layer.length; i++) {
    const feature=layer.feature(i);
    if (feature.properties.kind==='path' || feature.type!==2) continue;
    const geometry=feature.toGeoJSON(x,y,zoom).geometry;
    lines.push(...(geometry.type==='LineString' ? [geometry.coordinates] : geometry.coordinates));
  }
  cache.set(key,lines);
  if (cache.size > maximumCacheEntries) cache.delete(cache.keys().next().value);
  return lines;
}
function distance(point, lines) {
  let best=Infinity;
  // Local tangent-plane approximation for short point-to-segment distances.
  const latScale=111194.93, lonScale=latScale*Math.cos(point.latitude*Math.PI/180);
  const xy=([lon,lat])=>[(lon-point.longitude)*lonScale,(lat-point.latitude)*latScale];
  for (const line of lines) {
    let [ax,ay]=xy(line[0]);
    for (let i=1; i<line.length; i++) {
      const [bx,by]=xy(line[i]);
      const dx=bx-ax, dy=by-ay;
      const n=dx*dx+dy*dy;
      const t=n ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/n)) : 0;
      best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
      ax=bx;
      ay=by;
    }
  }
  return best;
}
for (const file of routes) {
  const {trip}=JSON.parse(await readFile(file));
  const points=trip.legs.flatMap(leg=>decodeShape(leg.shape));
  const distances=[];
  for (const point of points) {
    const [x,y]=toTile(point.latitude,point.longitude);
    const center=await tileRoads(x,y);
    if (!center?.length) continue;
    const neighbors=await Promise.all([[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>tileRoads(x+dx,y+dy)));
    distances.push(distance(point,center.concat(...neighbors.filter(Boolean))));
  }
  distances.sort((a,b)=>a-b);
  const percentile=p=>Number(distances[Math.ceil(distances.length*p)-1]?.toFixed(2) ?? NaN);
  console.log(JSON.stringify({file,zoom,vertices:points.length,compared:distances.length,
    distanceKm:trip.summary.length,estimatedSeconds:trip.summary.time,medianMeters:percentile(.5),
    p95Meters:percentile(.95),maximumMeters:percentile(1)}));
}
