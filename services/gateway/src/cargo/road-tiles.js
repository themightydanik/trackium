import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const prefix = '/app/assets/road-tiles/';
const png = Buffer.from('89504e470d0a1a0a', 'hex');
const maxBytes = 256 * 1024;
const maxReads = 24;

export function roadTilesConfig(env) {
  const darkDirectory = env.LITE_ROAD_TILES_DARK_DIR;
  const date = env.LITE_ROAD_TILES_DATE;
  if (env.LITE_ROAD_TILES_DIR === undefined) {
    if (darkDirectory !== undefined || date !== undefined)
      throw new Error('Road tile styles and date require LITE_ROAD_TILES_DIR');
    return null;
  }
  if (env.ENABLE_WEB_WORKSPACE !== 'true' || !isAbsolute(env.LITE_ROAD_TILES_DIR))
    throw new Error('LITE_ROAD_TILES_DIR requires an absolute path and ENABLE_WEB_WORKSPACE=true');
  const zoom = env.LITE_ROAD_TILES_MAX_ZOOM ?? '18';
  if (!/^(?:[1-9]|1[0-9])$/.test(zoom))
    throw new Error('LITE_ROAD_TILES_MAX_ZOOM must be between 1 and 19');
  if (darkDirectory !== undefined && !isAbsolute(darkDirectory))
    throw new Error('LITE_ROAD_TILES_DARK_DIR must be an absolute path');
  if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
    throw new Error('LITE_ROAD_TILES_DATE must be a calendar date in YYYY-MM-DD form');
  return { directory: resolve(env.LITE_ROAD_TILES_DIR), darkDirectory, maxZoom: Number(zoom), date };
}

export function createRoadTileHandler(config) {
  let reading = 0;
  return async (path, res) => {
    if (!path.startsWith(prefix)) return false;
    const coords = /^(dark\/)?(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.png$/.exec(path.slice(prefix.length));
    const codes = {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    };
    const reply = (status, headers = codes, body) => {
      res.writeHead(status, headers);
      res.end(body);
      return true;
    };
    if (!config || !coords) return reply(404);
    const directory = coords[1] ? config.darkDirectory : config.directory;
    if (!directory) return reply(404);
    const [z, x, y] = coords.slice(2).map(Number);
    if (z > config.maxZoom || x >= 2 ** z || y >= 2 ** z)
      return reply(404);
    if (reading >= maxReads) return reply(503, { ...codes, 'retry-after': '2' });
    reading++;
    let file;
    try {
      const root = await realpath(directory);
      const target = await realpath(resolve(root, String(z), String(x), y + '.png'));
      const filename = relative(root, target);
      if (!filename || filename === '..' || filename.startsWith('..' + sep) || isAbsolute(filename))
        return reply(404);
      file = await open(target, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
      const stat = await file.stat();
      const {size} = stat;
      if (!stat.isFile() || size < 33 || size > maxBytes) return reply(404);
      const contents = Buffer.alloc(size);
      const {bytesRead} = await file.read(contents);
      if (bytesRead !== size || !contents.subarray(0, 8).equals(png) ||
          contents.readUInt32BE(8) !== 13 || contents.toString('ascii', 12, 16) !== 'IHDR' ||
          contents.readUInt32BE(16) !== 256 || contents.readUInt32BE(20) !== 256)
        return reply(404);
      return reply(200, {
        ...codes, 'content-type': 'image/png', 'cache-control': 'public, max-age=3600',
        'cross-origin-resource-policy': 'same-origin'
      }, contents);
    } catch {
      return reply(404);
    } finally {
      await file?.close().catch(() => {});
      reading--;
    }
  };
}
