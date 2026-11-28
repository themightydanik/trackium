import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const prefix = '/app/assets/vector-tiles/';
const maximumBytes = 512 * 1024;
const maximumReads = 24;

// The release identifies an operator-mounted, immutable Protomaps-schema XYZ tree.
export function vectorTilesConfig(env) {
  const directory = env.LITE_VECTOR_TILES_DIR;
  const release = env.LITE_VECTOR_TILES_RELEASE;
  if (directory === undefined && release === undefined) return null;
  if (env.ENABLE_WEB_WORKSPACE !== 'true' || !directory || !isAbsolute(directory) ||
      !release || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(release))
    throw new Error('Vector tiles require ENABLE_WEB_WORKSPACE, an absolute directory and a release ID');
  return {directory:resolve(directory),release};
}

export function createVectorTileHandler(config) {
  let reading = 0;
  return async (path, res) => {
    if (!path.startsWith(prefix)) return false;
    const headers = {'cache-control':'no-store','x-content-type-options':'nosniff'};
    const reply = (status, extra, body) => {
      res.writeHead(status,{...headers,...extra});
      res.end(body);
      return true;
    };
    const rootPath = config && prefix + config.release + '/';
    if (!rootPath || !path.startsWith(rootPath)) return reply(404);
    const resource = path.slice(rootPath.length);
    const coverage = resource === 'coverage.json';
    const tile = /^(8|9|1[0-5])\/(0|[1-9]\d{0,4})\/(0|[1-9]\d{0,4})\.pbf$/.exec(resource);
    const glyph = /^glyphs\/NotoSansRegular\/(0|[1-9]\d{0,4})-([1-9]\d{0,4})\.pbf$/.exec(resource);
    if ((!coverage && !tile && !glyph) ||
        (tile && (+tile[2] >= 2**(+tile[1]) || +tile[3] >= 2**(+tile[1]))) ||
        (glyph && (+glyph[1] % 256 || +glyph[2] !== +glyph[1]+255 || +glyph[2] > 65535))) return reply(404);
    if (reading >= maximumReads) return reply(503,{'retry-after':'2'});
    reading++;
    let file;
    try {
      const root = await realpath(config.directory);
      const target = await realpath(resolve(root,tile || coverage ? resource : 'glyphs/' + glyph[1] + '-' + glyph[2] + '.pbf'));
      const within = relative(root,target);
      if (!within || within === '..' || within.startsWith('..'+sep) || isAbsolute(within)) return reply(404);
      file = await open(target,constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      const stat = await file.stat();
      if (!stat.isFile() || !stat.size || stat.size > maximumBytes) return reply(404);
      const contents = Buffer.alloc(stat.size);
      const {bytesRead} = await file.read(contents);
      if (bytesRead !== contents.length) return reply(404);
      return reply(200,{
        'content-type':coverage ? 'application/json' : tile ? 'application/vnd.mapbox-vector-tile' : 'application/x-protobuf',
        'cache-control':'public, max-age=86400, immutable',
        'cross-origin-resource-policy':'same-origin',
        ...(contents[0] === 0x1f && contents[1] === 0x8b ? {'content-encoding':'gzip'} : {})
      },contents);
    } catch {
      return reply(404);
    } finally {
      await file?.close().catch(()=>{});
      reading--;
    }
  };
}
