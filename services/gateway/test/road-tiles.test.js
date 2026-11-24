import { createServer } from 'node:http';
import { mkdtemp, mkdir, copyFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { roadTilesConfig } from '../src/cargo/road-tiles.js';
import { createWebHandler } from '../src/cargo/web.js';

const fixture = fileURLToPath(new URL('./fixtures/road-tiles/17/70416/42986.png', import.meta.url));

test('road tiles are opt-in and reject an invalid mount or max zoom', () => {
  assert.equal(roadTilesConfig({}), null);
  assert.throws(() => roadTilesConfig({ ENABLE_WEB_WORKSPACE: 'true', LITE_ROAD_TILES_DIR: 'relative' }));
  assert.throws(() => roadTilesConfig({ LITE_ROAD_TILES_DIR: '/tiles' }));
  assert.throws(() => roadTilesConfig({
    ENABLE_WEB_WORKSPACE: 'true', LITE_ROAD_TILES_DIR: '/tiles', LITE_ROAD_TILES_MAX_ZOOM: '20'
  }));
});

test('only bounded same-origin XYZ PNGs are served and Core receives no road configuration', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'trackium-tiles-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tiles = join(directory, 'tiles');
  const row = join(tiles, '17', '70416');
  await mkdir(row, { recursive: true });
  await copyFile(fixture, join(row, '42986.png'));
  await symlink(fixture, join(row, '42987.png'));
  await writeFile(join(row, '42988.png'), '<html>Wrong content</html>'.padEnd(64));
  await writeFile(join(row, '42989.png'), Buffer.alloc(256 * 1024 + 1));

  const app = createWebHandler({
    webEnabled: true, roadTiles: { directory: tiles, maxZoom: 17 }, demoEnabled: true
  });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = path => fetch(base + path);
  const lite = await get('/app/');
  assert.match(await lite.text(), /data-road-tile-max-zoom="17" data-customer-accounts="true"/);
  assert.match(lite.headers.get('content-security-policy'), /img-src 'self' data:/);
  assert.doesNotMatch(await (await get('/app/core')).text(), /data-road-tile-max-zoom/);
  const tile = await get('/app/assets/road-tiles/17/70416/42986.png');
  assert.equal(tile.status, 200);
  assert.equal(tile.headers.get('content-type'), 'image/png');
  assert.equal(tile.headers.get('cross-origin-resource-policy'), 'same-origin');
  for (const file of ['17/70416/42987.png','17/70416/42988.png','17/70416/42989.png',
    '17/70416/42990.png','17/131072/42986.png','18/140832/85972.png','17/%2f/42986.png','17/70416/42986.svg']) {
    assert.equal((await get('/app/assets/road-tiles/' + file)).status, 404, file);
  }
});
