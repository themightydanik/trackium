import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function createWebHandler({ webEnabled, webRoot }) {
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
    const relative = url.pathname.slice('/app/'.length) || 'index.html';
    if (
      !['index.html', 'mds.js', 'icon.png'].includes(relative) &&
      !/^assets\/v2\/[a-z0-9-]+\.(js|css)$/.test(relative) &&
      !/^assets\/v2\/brand\/(mark|app-(32|48|180|192|512))\.png$/.test(relative) &&
      relative !== 'assets/v2/brand/site.webmanifest'
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
                : 'image/png',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  };
}
