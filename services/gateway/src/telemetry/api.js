import { ApiError, invalid, timestamp } from './schema.js';
export const reply = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    connection: 'close'
  });
  res.end(JSON.stringify(body));
};
export async function body(req) {
  if (req.destroyed || req.aborted) throw new ApiError(400, 'request aborted');
  if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] ?? ''))
    throw new ApiError(415, 'application/json required');
  const chunks = [];
  let length = 0;
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      req.off('data', data);
      req.off('end', end);
      req.off('aborted', aborted);
      req.off('error', error);
    };
    const error = (err) => {
      cleanup();
      reject(err);
    };
    const aborted = () => error(new ApiError(400, 'request aborted'));
    const end = () => {
      cleanup();
      resolve();
    };
    const data = (chunk) => {
      length += chunk.length;
      if (length > 16384) {
        cleanup();
        req.resume();
        reject(new ApiError(413, 'request body too large'));
      } else chunks.push(chunk);
    };
    req.on('data', data);
    req.once('end', end);
    req.once('aborted', aborted);
    req.once('error', error);
  });
  const raw = Buffer.concat(chunks);
  try {
    return { input: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)), raw };
  } catch {
    invalid('invalid JSON');
  }
}
export function query(url, allowed) {
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      invalid('unsupported query parameter');
  const limit = url.searchParams.get('limit') ?? '100';
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200)
    invalid('limit must be 1..200');
  const cursor = url.searchParams.get('cursor');
  if (cursor && cursor.length > 256) invalid('invalid cursor');
  const from = url.searchParams.get('from'),
    to = url.searchParams.get('to');
  if (from) timestamp(from);
  if (to) timestamp(to);
  if (from && to && from > to) invalid('from must not exceed to');
  return { limit: Number(limit), cursor, from: from || undefined, to: to || undefined };
}
export function createTelemetryApi(
  service,
  { fixturesEnabled = false, logger = console, authenticate } = {}
) {
  return async (req, res) => {
    // A client can disconnect while database authentication is still pending.
    req.on('error', () => {});
    try {
      const url = new URL(req.url, 'http://gateway.invalid');
      const identity = authenticate
        ? await authenticate(req)
        : await service.authenticate(req.headers.authorization);
      const requireScope = (scope) => {
        if (!identity.scopes.includes(scope)) throw new ApiError(403, 'insufficient scope');
      };
      const tenant = identity.tenant_id;
      if (url.pathname === '/v1/devices') {
        if (req.method === 'GET') {
          requireScope('read');
          const q = query(url, ['limit', 'cursor']);
          reply(res, 200, await service.list(tenant, q.limit, q.cursor));
          return;
        }
        if (req.method === 'POST') {
          requireScope('admin');
          query(url, []);
          reply(res, 201, await service.register(tenant, (await body(req)).input));
          return;
        }
      }
      const match = /^\/v1\/devices\/([^/]+)(?:\/(events|location|status))?$/.exec(url.pathname);
      if (match) {
        const [, id, action] = match;
        if (req.method === 'PATCH' && !action) {
          requireScope('admin');
          query(url, []);
          reply(res, 200, await service.setEnabled(tenant, id, (await body(req)).input));
          return;
        }
        if (req.method === 'GET') {
          requireScope('read');
          const q = query(url, action === 'events' ? ['limit', 'cursor', 'from', 'to'] : []);
          const result =
            action === 'events'
              ? await service.history(tenant, id, q)
              : action === 'location'
                ? await service.latest(tenant, id, true)
                : action === 'status'
                  ? await service.latest(tenant, id)
                  : await service.getDevice(tenant, id);
          reply(res, 200, result);
          return;
        }
      }
      const fixture = /^\/v1\/fixtures\/devices\/([^/]+)\/events$/.exec(url.pathname);
      if (fixture && req.method === 'POST' && fixturesEnabled) {
        requireScope('fixture');
        query(url, []);
        const { input, raw } = await body(req);
        const result = await service.ingestFixture(tenant, fixture[1], input, raw);
        reply(res, result.duplicate ? 200 : 201, result);
        return;
      }
      reply(res, 404, { error: 'not found' });
    } catch (err) {
      if (!(err instanceof ApiError))
        logger.error('telemetry request failed', err.code ?? 'internal');
      if (!res.destroyed && !res.headersSent)
        reply(res, err instanceof ApiError ? err.status : 503, {
          error: err instanceof ApiError ? err.message : 'service unavailable'
        });
    }
  };
}
