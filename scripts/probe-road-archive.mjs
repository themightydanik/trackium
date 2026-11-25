/* Road coverage spot-check against a pinned, publicly downloadable PMTiles release. */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const dependency = name => import(pathToFileURL(require.resolve(name)));
const [{ PMTiles }, { VectorTile }, { default: Pbf }] = await Promise.all(
  ['pmtiles', '@mapbox/vector-tile', 'pbf'].map(dependency)
);
const release = process.argv[2] ?? '20261124';
if (!/^\d{8}$/.test(release)) throw Error('Expected an eight-digit Protomaps build date');
const url = 'https://build.protomaps.com/' + release + '.pmtiles';
const fetchRange = promisify(execFile);
const stats = { requests: 0, bytes: 0 };
let fileBytes = null;
const archive = new PMTiles({
  getKey: () => url,
  async getBytes(offset, length) {
    if (length <= 0 || length > 1024 * 1024 || stats.requests >= 128 ||
        stats.bytes + length > 12 * 1024 * 1024) throw Error('Spot-check byte budget exceeded');
    const end = offset + length - 1;
    const { stdout } = await fetchRange('curl', [
      '--silent', '--show-error', '--fail', '--include', '--suppress-connect-headers',
      '--max-time', '20', '--retry', '1', '--max-filesize', String(length),
      '--range', offset + '-' + end, url
    ], { encoding: 'buffer', maxBuffer: length + 16384 });
    const split = stdout.indexOf('\r\n\r\n');
    const headers = stdout.subarray(0, split).toString();
    const range = /^content-range: bytes (\d+)-(\d+)\/(\d+)\r?$/im.exec(headers);
    const data = stdout.subarray(split + 4);
    if (!/^HTTP\/\S+ 206\b/.test(headers) || !range || Number(range[1]) !== offset ||
        Number(range[2]) !== end || data.length !== length) throw Error('Unexpected archive range response');
    fileBytes = Number(range[3]);
    stats.requests++;
    stats.bytes += length;
    return { data: Uint8Array.from(data).buffer, etag: /^etag: (.+)\r?$/im.exec(headers)?.[1].trim() };
  }
});

const sites = [
  ['UA','Kyiv',50.4504,30.5236], ['UA','Lviv',49.8419,24.0315], ['UA','Odesa',46.4845,30.7385],
  ['UA','Kharkiv',49.9935,36.2304], ['UA','Dnipro',48.4647,35.0462], ['UA','Burshtyn',49.2586,24.6294],
  ['UA','Holohory',49.7627,24.7527], ['UA/PL','Shehyni–Medyka',49.7998,22.9488],
  ['DE','Berlin',52.52,13.405], ['PL','Warsaw',52.23,21.01], ['CZ','Brno',49.195,16.607],
  ['SK','Bratislava',48.148,17.108], ['RO','Bucharest',44.433,26.102], ['HU','Budapest',47.498,19.041],
  ['AT','Vienna',48.208,16.374], ['FR','Paris',48.856,2.352], ['IT','Milan',45.465,9.19],
  ['ES','Madrid',40.416,-3.704], ['NL','Amsterdam',52.373,4.894], ['BE','Brussels',50.847,4.352],
  ['EE','Tallinn',59.437,24.753], ['LV','Riga',56.949,24.106], ['LT','Vilnius',54.688,25.28],
  ['SI','Ljubljana',46.056,14.506], ['HR','Zagreb',45.814,15.977], ['BA','Sarajevo',43.856,18.413],
  ['RS','Belgrade',44.817,20.461], ['ME','Podgorica',42.441,19.263], ['XK','Pristina',42.663,21.165],
  ['AL','Tirana',41.328,19.818], ['MK','Skopje',41.998,21.425], ['BG','Sofia',42.697,23.322],
  ['GR','Athens',37.984,23.728], ['MD','Chișinău',47.01,28.864]
];

const header = await archive.getHeader();
if (header.maxZoom < 14) throw Error('Expected native z14 road tiles');
const n = 2 ** 14;
const results = [];
for (const [country, site, lat, lon] of sites) {
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) * n / 2);
  const tile = await archive.getZxy(14, x, y);
  const roads = tile && new VectorTile(new Pbf(new Uint8Array(tile.data))).layers.roads;
  if (!roads?.length) throw Error('No road features in sample: ' + site);
  results.push({ country, site, z: 14, x, y, roadFeatures: roads.length });
  console.error(country, site, roads.length);
}
console.log(JSON.stringify({ release, url, fileBytes, maxZoom: header.maxZoom, ...stats, results }, null, 2));
