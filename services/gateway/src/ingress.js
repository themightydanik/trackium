// One-instance test deployment limits. Never derive identity or origin from
// Forwarded/X-Forwarded-* headers: Railway terminates TLS, not authentication.
import { publicOrigin } from './cargo/pairing.js';
import { reply } from './telemetry/api.js';

export function createIngressGuard(config, { now = Date.now } = {}) {
  const origin = publicOrigin(config.publicOrigin), host = new URL(origin).host;
  let windowStart = now(), requests = 0, pairing = 0, active = 0, health = 0, healthActive = 0;
  return (req, res) => {
    const deny = (status, error) => {
      req.resume();
      reply(res, status, { error });
      return false;
    };
    if (now() - windowStart >= 60000) {
      windowStart = now(); requests = 0; pairing = 0; health = 0;
    }
    // Railway probes use healthcheck.railway.app rather than the public Host.
    // Reserve a separate bounded budget so API load cannot starve probes and
    // public readiness requests cannot create an unbounded database queue.
    if (req.method === 'GET' && ['/healthz', '/readyz'].includes(req.url)) {
      if (++health > 120 || healthActive >= 2) return deny(429, 'health request limit');
      healthActive++;
      let released = false;
      const release = () => { if (!released) { released = true; healthActive--; } };
      res.once('finish', release); res.once('close', release);
      return true;
    }
    if (req.headers.host !== host ||
        (req.headersDistinct?.host?.length ?? 1) !== 1 ||
        (req.headers.origin !== undefined && req.headers.origin !== origin))
      return deny(403, 'configured Host and Origin required');
    // Global budgets deliberately share all proxy peers; spoofing an address
    // cannot create another bucket. Existing tenant/session quotas still apply.
    const isPairing = /^\/v1\/(native\/(challenges|claim)|pairing\/)/.test(req.url);
    requests++;
    if (isPairing) pairing++;
    if (requests > 1200 || (isPairing && pairing > 60) || active >= 32) {
      res.setHeader('Retry-After', '60');
      return deny(429, 'test deployment request limit');
    }
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    res.once('finish', release);
    res.once('close', release);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return true;
  };
}
