import { timingSafeEqual } from 'node:crypto';
import { ApiError, object, text, uuid } from '../telemetry/schema.js';
import { reply, body, query } from '../telemetry/api.js';
import { MAX_BODY, parseCalculation } from '../routing/contract.js';
function requireEmptyRequestBody(req) {
  const contentLength = req.headers['content-length'];
  if (req.headers['transfer-encoding'] ||
      (contentLength !== undefined && contentLength !== '0')) {
    throw new ApiError(400, 'request body not allowed');
  }
}

export function createCargoApi({
  pool,
  accounts,
  coreDevices,
  aovxConfigQuery,
  aovxGnssEnable,
  telemetry,
  authenticate: suppliedAuthenticate,
  native,
  proofs,
  integritas,
  shipments,
  simulator,
  notifications,
  pairing,
  aovxObservations,
  config,
  telemetryApi,
  routing,
  roadRoutes,
  logger = console
}) {
  const authenticate =
    suppliedAuthenticate ??
    (async (req) =>
      req.headers.authorization
        ? telemetry.authenticate(req.headers.authorization)
        : pairing.authenticate(req, !['GET', 'HEAD'].includes(req.method)));
  return async (req, res) => {
    req.on('error', () => {});
    try {
      const url = new URL(req.url, 'http://gateway.invalid'),
        path = url.pathname;
      if (path === '/internal/aovx/packets') {
        const expected = config.aovxObservationsToken;
        if (!expected) throw new ApiError(404, 'not found');
        if (req.method !== 'GET') throw new ApiError(405, 'method not allowed');
        const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
        const a = Buffer.from(supplied), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'operator authentication required');
        for (const key of url.searchParams.keys())
          if (!['limit', 'before', 'device_id'].includes(key) || url.searchParams.getAll(key).length !== 1)
            throw new ApiError(400, 'unsupported query parameter');
        const rawLimit = url.searchParams.get('limit') ?? '25';
        if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50)
          throw new ApiError(400, 'limit must be 1..50');
        return reply(res, 200, await aovxObservations.packets({
          limit: Number(rawLimit),
          before: url.searchParams.get('before') ?? undefined,
          deviceId: url.searchParams.get('device_id') ?? undefined
        }));
      }
      const aovxConfigQueryMatch = /^\/internal\/aovx\/devices\/([0-9a-fA-F]{12})\/config-query$/.exec(path);
      if (aovxConfigQueryMatch) {
        const expected = config.aovxObservationsToken;
        if (!expected) throw new ApiError(404, 'not found');
        if (req.method !== 'POST') throw new ApiError(405, 'method not allowed');
        const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
        const a = Buffer.from(supplied), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b))
          throw new ApiError(401, 'operator authentication required');
        query(url, []);
        requireEmptyRequestBody(req);
        const deviceIdBcd = aovxConfigQueryMatch[1].toLowerCase();
        const binding = await pool.query(
          `SELECT b.device_id_bcd, b.trust
           FROM telemetry_aovx_device_bindings b
           JOIN telemetry_devices d ON d.tenant_id=b.tenant_id AND d.id=b.device_id
           WHERE b.device_id_bcd=$1 AND b.state='active'
             AND d.enabled=true AND d.mode='real' AND d.identity_kind='physical'
           ORDER BY b.created_at DESC LIMIT 2`,
          [deviceIdBcd]
        );
        if (binding.rowCount !== 1) throw new ApiError(404, 'no unique active physical AOVX device binding');
        logger.info?.('AOVX read-only configuration query requested:', JSON.stringify({
          deviceIdBcd, trust: binding.rows[0].trust, parameter: '0xF029'
        }));
        try {
          const result = await aovxConfigQuery(deviceIdBcd);
          logger.info?.('AOVX read-only configuration query completed:', JSON.stringify(result));
          return reply(res, 200, result);
        } catch (error) {
          logger.warn?.('AOVX read-only configuration query failed:', JSON.stringify({
            deviceIdBcd, reason: error.message
          }));
          throw new ApiError(/timed out/.test(error.message) ? 504 : 409,
            /timed out/.test(error.message) ? 'AOVX device did not return configuration parameters before timeout' : 'AOVX device is not available for an unambiguous read-only query');
        }
      }
      const aovxGnssEnableMatch = /^\/internal\/aovx\/devices\/([0-9a-fA-F]{12})\/gnss-enable$/.exec(path);
      if (aovxGnssEnableMatch) {
        const expected = config.aovxObservationsToken;
        if (!expected) throw new ApiError(404, 'not found');
        if (req.method !== 'POST') throw new ApiError(405, 'method not allowed');
        const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
        const a = Buffer.from(supplied), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'operator authentication required');
        query(url, []);
        requireEmptyRequestBody(req);
        const deviceIdBcd = aovxGnssEnableMatch[1].toLowerCase();
        const binding = await pool.query(
          `SELECT b.device_id_bcd FROM telemetry_aovx_device_bindings b
           JOIN telemetry_devices d ON d.tenant_id=b.tenant_id AND d.id=b.device_id
           WHERE b.device_id_bcd=$1 AND b.state='active'
             AND d.enabled=true AND d.mode='real' AND d.identity_kind='physical'
           ORDER BY b.created_at DESC LIMIT 2`,
          [deviceIdBcd]
        );
        if (binding.rowCount !== 1) throw new ApiError(404, 'no unique active physical AOVX device binding');
        logger.warn?.('AOVX GNSS configuration change requested:', JSON.stringify({ deviceIdBcd, parameter: '0xF029', value: 1 }));
        try {
          const result = await aovxGnssEnable(deviceIdBcd);
          logger.info?.('AOVX GNSS configuration change result:', JSON.stringify(result));
          return reply(res, result.verified ? 200 : 409, result);
        } catch (error) {
          logger.warn?.('AOVX GNSS configuration change failed:', JSON.stringify({ deviceIdBcd, reason: error.message }));
          throw new ApiError(/timed out/.test(error.message) ? 504 : 409,
            /timed out/.test(error.message) ? 'AOVX device did not acknowledge the GNSS configuration command' : 'AOVX GNSS configuration command could not be completed safely');
        }
      }
      const aovxDevice = /^\/internal\/aovx\/devices(?:\/([0-9a-fA-F]{12}))?$/.exec(path);
      if (aovxDevice) {
        const expected = config.aovxObservationsToken;
        if (!expected) throw new ApiError(404, 'not found');
        if (req.method !== 'GET') throw new ApiError(405, 'method not allowed');
        const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? '';
        const a = Buffer.from(supplied), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'operator authentication required');
        const q = query(url, aovxDevice[1] ? [] : ['limit', 'cursor']);
        return reply(res, 200, aovxDevice[1] ? await aovxObservations.get(aovxDevice[1]) : await aovxObservations.list(q.limit, q.cursor));
      }
      if (!['GET', 'HEAD'].includes(req.method)) query(url, []);
      if (!config.nativeEnabled && path.startsWith('/v1/native/'))
        throw new ApiError(404, 'native clients disabled');
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
      if (path === '/v1/native/challenges' && req.method === 'POST') {
        if (req.headers.origin || req.headers.cookie)
          throw new ApiError(403, 'native client required');
        return reply(res, 201, await native.challenge((await body(req)).input));
      }
      if (path === '/v1/native/claim' && req.method === 'POST') {
        if (req.headers.origin || req.headers.cookie)
          throw new ApiError(403, 'native client required');
        return reply(res, 201, await native.claim((await body(req)).input));
      }
      if (path.startsWith('/v1/core-devices/')) {
        if (!coreDevices) throw new ApiError(404,'not found');
        return await coreDevices(req,res,path.slice('/v1/core-devices/'.length));
      }
      if (accounts && path.startsWith('/v1/account/')) return await accounts.route(req, res, url);
      const identity = await authenticate(req),
        tenant = identity.tenant_id;
      if (identity.customer && !identity.role && path !== '/v1/session')
        throw new ApiError(403, 'Choose a company first');
      if (identity.demo && (/^\/v1\/(?:proofs|proof-publisher)(?:\/|$)/.test(path) ||
          /^\/v1\/shipments\/[^/]+\/proofs$/.test(path)))
        throw new ApiError(404, 'Not found');
      const scope = (name) => {
        if (!identity.scopes.includes(name)) throw new ApiError(403, 'insufficient scope');
      };
      if (path === '/v1/routes/calculate') {
        if (!routing) throw new ApiError(404, 'not found');
        if (req.method !== 'POST') throw new ApiError(405, 'method not allowed');
        if (identity.kind !== 'session' || identity.customer !== true || req.headers.authorization ||
            !tenant || !identity.account_id || !['owner', 'admin', 'dispatcher'].includes(identity.role))
          throw new ApiError(403, 'customer routing permission required');
        scope('shipments');
        const calculation = parseCalculation((await body(req, MAX_BODY)).input);
        const abort = new AbortController();
        const disconnected = () => abort.abort();
        res.once('close', disconnected);
        if (res.destroyed) return;
        try {
          return reply(res, 200, await routing.calculate(identity, calculation, abort.signal));
        } finally {
          res.off('close', disconnected);
        }
      }
      const nativeApproval = /^\/v1\/native\/challenges\/([^/]+)\/approve$/.exec(path);
      if (nativeApproval && req.method === 'POST') {
        object((await body(req)).input, []);
        return reply(res, 200, await native.approve(identity, nativeApproval[1]));
      }
      if (path === '/v1/native/session') {
        if (identity.kind !== 'native') throw new ApiError(403, 'native session required');
        if (req.method === 'GET') return reply(res, 200, identity);
        if (req.method === 'DELETE') return reply(res, 200, await native.revoke(identity));
      }
      const nativeRevoke = /^\/v1\/native\/sessions\/([^/]+)$/.exec(path);
      if (nativeRevoke && req.method === 'DELETE')
        return reply(res, 200, await native.revoke(identity, nativeRevoke[1]));
      const approval = /^\/v1\/pairing\/challenges\/([^/]+)\/approve$/.exec(path);
      if (approval && req.method === 'POST') {
        const input = (await body(req)).input;
        object(input, ['scopes']);
        return reply(res, 200, await pairing.approve(identity, approval[1], input.scopes));
      }
      if (path === '/v1/session') {
        if (identity.kind !== 'session') throw new ApiError(403, 'browser session required');
        if (req.method === 'GET')
          return reply(res, 200, {
            ...identity,
            ...(notifications && { local_notifications: true }),
            ...(integritas && { integritas_proofs: true })
          });
        if (req.method === 'DELETE') {
          if (identity.customer) {
            await pool.query('DELETE FROM customer_sessions WHERE id=$1', [identity.id]);
            accounts.clear(res);
          } else {
            await pairing.revoke(identity, identity.id);
            pairing.clear(res);
          }
          return reply(res, 200, { revoked: true });
        }
      }
      if (integritas && path === '/v1/integritas/proofs') {
        query(url, []);
        if (req.method === 'GET') {
          scope('read');
          return reply(res, 200, await integritas.list(tenant));
        }
        if (req.method === 'POST') {
          scope('admin');
          const input = (await body(req)).input;
          object(input, ['event_id']);
          return reply(res, 202, await integritas.prepare(tenant, input.event_id));
        }
      }
      const integritasProof = /^\/v1\/integritas\/proofs\/([^/]+)\/(bundle|verify)$/.exec(path);
      if (integritas && integritasProof) {
        scope('read');
        query(url, []);
        const [, id, action] = integritasProof;
        if (action === 'bundle' && req.method === 'GET')
          return reply(res, 200, await integritas.bundle(tenant, id));
        if (action === 'verify' && req.method === 'POST') {
          object((await body(req)).input, []);
          return reply(res, 200, await integritas.verify(tenant, id));
        }
      }
      if (notifications && path === '/v1/notifications') {
        if (req.method === 'GET') {
          scope('read');
          query(url, []);
          return reply(res, 200, await notifications.status(tenant));
        }
        if (req.method === 'PUT') {
          scope('admin');
          return reply(res, 200, await notifications.setPreferences(tenant, (await body(req)).input));
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
      if (path === '/v1/proof-publisher') {
        scope('read');
        if (req.method === 'GET') return reply(res, 200, await proofs.owner.status(tenant));
      }
      if (path === '/v1/proof-publisher/policy' && req.method === 'POST') {
        scope('admin');
        return reply(res, 200, await proofs.owner.policy(tenant, (await body(req)).input));
      }
      if (path === '/v1/proof-publisher/preflight' && req.method === 'POST') {
        scope('read');
        object((await body(req)).input, []);
        return reply(res, 200, await proofs.owner.preflight(tenant));
      }
      const approvalProof = /^\/v1\/proof-publisher\/events\/([^/]+)\/approve$/.exec(path);
      if (approvalProof && req.method === 'POST') {
        scope('admin');
        return reply(
          res,
          201,
          await proofs.owner.approve(tenant, approvalProof[1], (await body(req)).input)
        );
      }
      const localProof = /^\/v1\/proofs\/([^/]+)\/(local-job|local-checkpoint|local-result)$/.exec(
        path
      );
      if (localProof) {
        if (req.method === 'GET' && localProof[2] === 'local-job') {
          scope('read');
          query(url, []);
          return reply(res, 200, await proofs.owner.job(tenant, localProof[1]));
        }
        if (req.method === 'POST' && localProof[2] !== 'local-job') {
          if (!identity.scopes.includes('publish') && !identity.scopes.includes('admin'))
            throw new ApiError(403, 'publish scope required');
          const input = (await body(req, 262144)).input;
          return reply(
            res,
            200,
            await proofs.owner[localProof[2] === 'local-checkpoint' ? 'checkpoint' : 'result'](
              tenant,
              localProof[1],
              input
            )
          );
        }
      }
      const proofList = /^\/v1\/shipments\/([^/]+)\/proofs$/.exec(path);
      if (proofList && req.method === 'GET') {
        scope('read');
        const q = query(url, ['limit', 'cursor']);
        return reply(res, 200, await proofs.list(tenant, proofList[1], q.limit, q.cursor));
      }
      const proof = /^\/v1\/proofs\/([^/]+)(?:\/(verify|bundle))?$/.exec(path);
      if (proof) {
        scope('read');
        query(url, []);
        if (req.method === 'GET') {
          if (!proof[2]) return reply(res, 200, await proofs.get(tenant, proof[1]));
          if (proof[2] === 'bundle') return reply(res, 200, await proofs.bundle(tenant, proof[1]));
        }
        if (req.method === 'POST' && proof[2] === 'verify') {
          object((await body(req)).input, []);
          return reply(res, 200, await proofs.verify(tenant, proof[1]));
        }
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
      const road = /^\/v1\/shipments\/([^/]+)\/road-routes(?:\/(active|compare|[^/]+)(?:\/(approve|activate))?)?$/.exec(path);
      if (road) {
        const [, shipmentId, segment, transition] = road;
        if (identity.kind !== 'session' || identity.customer !== true || req.headers.authorization ||
            !tenant || !identity.account_id)
          throw new ApiError(403, 'customer routing permission required');
        const keys = [tenant, uuid(shipmentId)];
        if (req.method === 'GET' && !transition) {
          scope('read');
          if (segment === 'compare') {
            query(url, ['base_revision','target_revision']);
            const ids = ['base_revision','target_revision'].map(key => uuid(url.searchParams.get(key)));
            if (ids[0] === ids[1]) throw new ApiError(400, 'choose two different revisions');
            return reply(res, 200, await roadRoutes.read(keys, 'compare', ids));
          }
          query(url, []);
          const action = !segment ? 'list' : segment === 'active' ? 'active' : 'detail';
          return reply(res, 200, await roadRoutes.read(keys, action, action === 'detail' ? [uuid(segment)] : []));
        }
        if (req.method !== 'POST' || (segment && !transition)) throw new ApiError(405, 'method not allowed');
        scope('shipments');
        if (!(transition ? ['owner','admin'] : ['owner','admin','dispatcher']).includes(identity.role))
          throw new ApiError(403, 'customer routing permission required');
        query(url, []);
        const {input} = await body(req, MAX_BODY);
        object(input, transition ? ['expected_generation'] : ['expected_generation','request_id','calculation']);
        const expected = input.expected_generation;
        if (!Number.isInteger(expected) || expected < 0 || expected > 300)
          throw new ApiError(400, 'invalid expected_generation');
        if (transition)
          return reply(res, 200, await roadRoutes.transition(identity, keys, uuid(segment), transition, expected));
        const abort = new AbortController();
        const disconnected = () => abort.abort();
        if (res.destroyed) return;
        res.once('close', disconnected);
        try {
          const result = await roadRoutes.propose(identity, keys, parseCalculation(input.calculation),
            expected, uuid(input.request_id), abort.signal);
          return reply(res, result.replayed ? 200 : 201, result);
        } finally { res.off('close', disconnected); }
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
      if (path.startsWith('/v1/devices') || path.startsWith('/v1/fixtures/') || path.startsWith('/v1/aovx/'))
        return telemetryApi(req, res);
      reply(res, 404, { error: 'not found' });
    } catch (err) {
      if (!(err instanceof ApiError) && err.code !== '23505')
        logger.error('cargo request failed', err.code ?? 'internal');
      if (!res.destroyed && !res.headersSent)
        reply(res, err instanceof ApiError ? err.status : err.code === '23505' ? 409 : 503, {
          ...(err.routingCode && {code: err.routingCode}),
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
