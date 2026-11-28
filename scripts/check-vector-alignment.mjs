/* Compare actual Valhalla polyline6 vertices with roads in a mounted pilot tile window. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { xyz, nearestRoad } from './vector-release.mjs';
import { decodeShape } from '../services/gateway/src/routing/contract.js';

const require = createRequire(import.meta.url);
const dep = name => import(pathToFileURL(require.resolve(name)));
const [{VectorTile},{default:Pbf}] = await Promise.all([dep('@mapbox/vector-tile'),dep('pbf')]);
const [directory,...routes] = process.argv.slice(2);
if (!directory || !routes.length) throw Error('Usage: check-vector-alignment.mjs TILE_DIR RAW_ROUTE_JSON...');
const zoom=Number(process.env.TRACKIUM_ALIGNMENT_ZOOM ?? 15);
if (!Number.isInteger(zoom) || zoom<8 || zoom>15) throw Error('Invalid alignment zoom');
const includePaths=process.env.TRACKIUM_ALIGNMENT_INCLUDE_PATHS==='1';
const cache=new Map();
const maximumCacheEntries=128;
const neighbors=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const tileOf = point => xyz(point.latitude,point.longitude,zoom);
async function tileRoads(x,y) {
  const key=x+'/'+y;
  if (cache.has(key)) return cache.get(key);
  let data;
  try {
    data=await readFile(directory+'/'+zoom+'/'+key+'.pbf');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    cache.set(key,null);
    if (cache.size > maximumCacheEntries) cache.delete(cache.keys().next().value);
    return null;
  }
  if (data[0]===31 && data[1]===139) data=gunzipSync(data,{maxOutputLength:16*1024*1024});
  const layer=new VectorTile(new Pbf(data)).layers.roads;
  const lines=[];
  for (let i=0; layer && i<layer.length; i++) {
    const feature=layer.feature(i);
    if ((!includePaths && feature.properties.kind==='path') || feature.type!==2) continue;
    const geometry=feature.toGeoJSON(x,y,zoom).geometry;
    for (const coordinates of (geometry.type==='LineString' ? [geometry.coordinates] : geometry.coordinates))
      lines.push({coordinates,id:feature.id ?? null,kind:feature.properties.kind ?? null,name:feature.properties.name ?? null});
  }
  cache.set(key,lines);
  if (cache.size > maximumCacheEntries) cache.delete(cache.keys().next().value);
  return lines;
}
const rounded = number => Number(number.toFixed(2));
for (const file of routes) {
  const {trip}=JSON.parse(await readFile(file));
  const legs=trip.legs.map(leg=>decodeShape(leg.shape));
  const points=legs.flat();
  const distances=[];
  let fileVertices=0, maximum=null, segments=0, roadSegments=0, crossings=0;
  let sampledMeters=0, fileMeters=0, roadMeters=0;
  for (const [index,point] of points.entries()) {
    const [x,y]=tileOf(point);
    const center=await tileRoads(x,y);
    if (center) fileVertices++;
    if (!center?.length) continue;
    const adjacent=await Promise.all(neighbors.map(([dx,dy])=>tileRoads(x+dx,y+dy)));
    const match=nearestRoad(point,center.concat(...adjacent.filter(Boolean)));
    distances.push(match.meters);
    if (!maximum || match.meters>maximum.meters) maximum={index,point,tile:[zoom,x,y],...match};
  }
  for(const leg of legs) for(let i=1;i<leg.length;i++) {
    const a=leg[i-1],b=leg[i];
    const meters=111194.93*Math.hypot(b.latitude-a.latitude,
      (b.longitude-a.longitude)*Math.cos((a.latitude+b.latitude)*Math.PI/360));
    if (!meters) continue;
    segments++;
    if (String(tileOf(a))!==String(tileOf(b))) crossings++;
    const steps=Math.ceil(meters/25), weight=meters/steps;
    let covered=true;
    for(let j=0;j<steps;j++) {
      const t=(j+.5)/steps;
      const tile=await tileRoads(...tileOf({latitude:a.latitude+t*(b.latitude-a.latitude),
        longitude:a.longitude+t*(b.longitude-a.longitude)}));
      sampledMeters+=weight;
      if(tile) fileMeters+=weight;
      if(tile?.length) roadMeters+=weight;
      else covered=false;
    }
    if(covered) roadSegments++;
  }
  distances.sort((a,b)=>a-b);
  const percentile=p=>distances.length ? rounded(distances[Math.ceil(distances.length*p)-1]) : null;
  console.log(JSON.stringify({file,zoom,includePaths,vertices:points.length,fileVertices,roadVertices:distances.length,
    segments,roadSegments,crossings,sampledMeters:rounded(sampledMeters),fileMeters:rounded(fileMeters),
    roadMeters:rounded(roadMeters),distanceKm:trip.summary.length,estimatedSeconds:trip.summary.time,
    medianMeters:percentile(.5),p95Meters:percentile(.95),maximum}));
}
