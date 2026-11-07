import { ApiError, object, text, uuid } from '../telemetry/schema.js';
import { reply, body, query } from '../telemetry/api.js';
export function createCargoApi({
  telemetry,
  shipments,
  simulator,
  pairing,
  config,
  telemetryApi,
  logger = console
}) {
  const authenticate = async (req) =>
    req.headers.authorization
      ? telemetry.authenticate(req.headers.authorization)
      : pairing.authenticate(req, !['GET', 'HEAD'].includes(req.method));
  return async (req, res) => {
    req.on('error', () => {});
    try {
      const url = new URL(req.url, 'http://gateway.invalid'),
        path = url.pathname;
      if (!['GET', 'HEAD'].includes(req.method)) query(url, []);
      if (!config.webEnabled && path.startsWith('/v1/pairing'))
        throw new ApiError(404, 'not found');
      if (path === '/v1/pairing/challenges' && req.method === 'POST') {
        query(url, []);
        const input = (await body(req)).input;
        object(input, ['tenant_id']);
        return reply(res, 201, await pairing.challenge(req, res, input.tenant_id));
      }
      if (path === '/v1/pairing/session' && req.method === 'POST') {
        query(url, []);
        return reply(res, 201, await pairing.claim(req, res));
      }
      const identity = await authenticate(req),
        tenant = identity.tenant_id;
      const scope = (name) => {
        if (!identity.scopes.includes(name)) throw new ApiError(403, 'insufficient scope');
      };
      const approval = /^\/v1\/pairing\/challenges\/([^/]+)\/approve$/.exec(path);
      if (approval && req.method === 'POST') {
        const input = (await body(req)).input;
        object(input, ['scopes']);
        return reply(res, 200, await pairing.approve(identity, approval[1], input.scopes));
      }
      if (path === '/v1/session') {
        if (identity.kind !== 'session') throw new ApiError(403, 'browser session required');
        if (req.method === 'GET') return reply(res, 200, identity);
        if (req.method === 'DELETE') {
          await pairing.revoke(identity, identity.id);
          pairing.clear(res);
          return reply(res, 200, { revoked: true });
        }
      }
      const revoke = /^\/v1\/sessions\/([^/]+)$/.exec(path);
      if (revoke && req.method === 'DELETE') {
        scope('admin');
        return reply(res, 200, await pairing.revoke(identity, revoke[1]));
      }
      if (path === '/v1/simulated-devices' && req.method === 'POST') {
        scope('simulate');
        if (!config.simulatorEnabled) throw new ApiError(403, 'server simulation disabled');
        const input = (await body(req)).input;
        object(input, ['label']);
        text(input.label, 120);
        return reply(
          res,
          201,
          await telemetry.register(tenant, { label: input.label, mode: 'synthetic' }, 'simulator')
        );
      }
      if (path === '/v1/shipments') {
        if (req.method === 'GET') {
          scope('read');
          const q = query(url, ['limit', 'cursor']);
          return reply(res, 200, await shipments.list(tenant, q.limit, q.cursor));
        }
        if (req.method === 'POST') {
          scope('shipments');
          return reply(res, 201, await shipments.create(tenant, (await body(req)).input));
        }
      }
      const match = /^\/v1\/shipments\/([^/]+)(?:\/(transitions|events|simulations))?$/.exec(path);
      if (match) {
        const [, id, action] = match;
        uuid(id);
        if (req.method === 'GET') {
          scope('read');
          if (action === 'events') {
            for (const k of url.searchParams.keys())
              if (!['after', 'limit'].includes(k)) throw new ApiError(400, 'invalid query');
            return reply(
              res,
              200,
              await shipments.events(
                tenant,
                id,
                Number(url.searchParams.get('after') ?? 0),
                Number(url.searchParams.get('limit') ?? 100)
              )
            );
          }
          if (!action) return reply(res, 200, await shipments.detail(tenant, id));
        }
        if (req.method === 'PATCH' && !action) {
          scope('shipments');
          return reply(res, 200, await shipments.update(tenant, id, (await body(req)).input));
        }
        if (req.method === 'POST' && action === 'transitions') {
          scope('shipments');
          const input = (await body(req)).input;
          object(input, ['status']);
          return reply(res, 200, await shipments.change(tenant, id, input.status));
        }
        if (req.method === 'POST' && action === 'simulations') {
          scope('simulate');
          const input = (await body(req)).input;
          object(input, ['scenario']);
          return reply(res, 201, await simulator.start(tenant, id, input.scenario));
        }
      }
      if (path === '/v1/simulations' && req.method === 'GET') {
        scope('read');
        return reply(res, 200, await simulator.list(tenant));
      }
      const control = /^\/v1\/simulations\/([^/]+)\/(pause|resume|finish)$/.exec(path);
      if (control && req.method === 'POST') {
        scope('simulate');
        return reply(res, 200, await simulator.control(tenant, uuid(control[1]), control[2]));
      }
      // Existing telemetry routes retain scopes; sessions have no admin/fixture grants.
      if (path.startsWith('/v1/devices') || path.startsWith('/v1/fixtures/'))
        return telemetryApi(req, res);
      reply(res, 404, { error: 'not found' });
    } catch (err) {
      if (!(err instanceof ApiError) && err.code !== '23505')
        logger.error('cargo request failed', err.code ?? 'internal');
      if (!res.destroyed && !res.headersSent)
        reply(res, err instanceof ApiError ? err.status : err.code === '23505' ? 409 : 503, {
          error:
            err instanceof ApiError
              ? err.message
              : err.code === '23505'
                ? 'conflicting active record'
                : 'service unavailable'
        });
    }
  };
}
