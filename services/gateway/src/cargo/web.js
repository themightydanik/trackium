import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoadTileHandler } from './road-tiles.js';
import { createVectorTileHandler } from './vector-tiles.js';
export function createWebHandler({ webEnabled, webRoot, customerMail, demoEnabled, roadTiles, vectorTiles, coreDeviceAccessEnabled, coreAndroidFingerprint }) {
  const serveTile = createRoadTileHandler(roadTiles);
  const serveVectorTile = createVectorTileHandler(vectorTiles);
  const root = resolve(webRoot || fileURLToPath(new URL('../../../../', import.meta.url)));
  return async (req, res) => {
    const url = new URL(req.url, 'http://gateway.invalid');
    if (!webEnabled || req.method !== 'GET') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (url.pathname === '/app') {
      res.writeHead(302, { location: '/app/' });
      res.end();
      return;
    }
    if (url.pathname === '/.well-known/assetlinks.json' && coreDeviceAccessEnabled && coreAndroidFingerprint) {
      res.writeHead(200, {'content-type':'application/json', 'cache-control':'no-store'});
      res.end(JSON.stringify([{
        relation:['delegate_permission/common.handle_all_urls'],
        target:{namespace:'android_app',package_name:'tech.trackium.core.prototype',
          sha256_cert_fingerprints:[coreAndroidFingerprint]}
      }]));
      return;
    }
    if (url.pathname === '/app/connect-core') {
      res.writeHead(200, {
        'content-type':'text/html; charset=utf-8', 'cache-control':'no-store',
        'referrer-policy':'no-referrer', 'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
      });
      res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Connect Trackium Core</title><main><h1>Connect Trackium Core</h1>' +
        '<p>Copy this address. In Trackium Core choose Devices, then Enter activation card or connection link.</p>' +
        '<p>Return to My Devices on the website to confirm the installation fingerprint.</p></main></html>');
      return;
    }
    if (await serveTile(url.pathname, res) || await serveVectorTile(url.pathname, res)) return;
    const relative = url.pathname === '/app/core' ? 'index.html'
      : url.pathname.slice('/app/'.length) || 'index.html';
    if (
      !['index.html', 'mds.js', 'icon.png'].includes(relative) &&
      !/^assets\/v2\/[a-z0-9-]+\.(js|css)$/.test(relative) &&
      !/^assets\/v2\/brand\/(mark|app-(32|48|180|192|512))\.png$/.test(relative) &&
      !/^assets\/v2\/visual\/(terminal-(480|960)|warehouse-(480|960)|matte-grain)\.webp$/.test(relative) &&
      !['assets/v2/brand/site.webmanifest', 'assets/v2/brand/lite.webmanifest'].includes(relative)
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const data = await readFile(resolve(root, relative));
      res.writeHead(200, {
        'content-type': relative.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : relative.endsWith('.js')
            ? 'text/javascript; charset=utf-8'
            : relative.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : relative.endsWith('.webmanifest')
                ? 'application/manifest+json'
                : relative.endsWith('.webp') ? 'image/webp' : 'image/png',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
      });
      res.end(relative === 'index.html'
        ? data.toString('utf8')
          .replace('<html lang="en">', (customerMail || demoEnabled) && url.pathname !== '/app/core'
            ? '<html lang="en" data-customer-accounts="true"' +
                (demoEnabled ? ' data-customer-demo="true">' : '>')
            : '<html lang="en">')
          .replace(/<html lang="en"/, (tag) => roadTiles && url.pathname === '/app/'
            ? tag + ' data-road-tile-max-zoom="' + roadTiles.maxZoom + '"' +
              (roadTiles.darkDirectory ? ' data-road-tile-dark="true"' : '') +
              (roadTiles.date ? ' data-road-tile-date="' + roadTiles.date + '"' : '') : tag)
          .replace(/<html lang="en"/, (tag) => vectorTiles && url.pathname === '/app/'
            ? tag + ' data-vector-tile-release="' + vectorTiles.release + '"' : tag)
          .replace('assets/v2/brand/site.webmanifest', 'assets/v2/brand/lite.webmanifest')
          .replace('<script defer src="mds.js"></script>', '')
          .replace('<script defer src="assets/v2/mds-bridge.js"></script>', '')
        : data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  };
}
