import net from 'node:net';
import http from 'node:http';
import { createLineFramer } from './framing.js';

// The injected journal keeps TCP lifecycle tests independent of PostgreSQL.
export function createGateway({ journal, config, logger = console, requestHandler }) {
  const sessions = new Set();
  let pendingFrames = 0;
  let pendingBytes = 0;
  let stopping = false;
  let shutdownPromise;
  let startPromise;

  const tcp = net.createServer(socket => {
    // A disconnected client keeps its slot until accepted writes settle.
    if (stopping || sessions.size >= config.maxConnections) { socket.destroy(); return; }
    const session = { socket, chain: Promise.resolve(), pending: 0, closed: false, failed: false };
    sessions.add(session);
    const release = () => {
      if (session.closed && session.pending === 0) sessions.delete(session);
    };
    socket.setTimeout(config.socketTimeoutMs);
    const framer = createLineFramer({
      maxFrameBytes: config.maxFrameBytes,
      onError: () => socket.destroy(),
      onFrame: payload => {
        if (stopping || session.failed || pendingFrames >= config.maxPendingFrames ||
            pendingBytes + payload.length > config.maxPendingBytes) {
          socket.destroy();
          return false;
        }
        pendingFrames++;
        pendingBytes += payload.length;
        session.pending++;
        socket.pause();
        session.chain = session.chain.then(async () => {
          // Never write later frames from this connection after a journal failure.
          if (!session.failed) await journal.persistPacket({ payload, remoteAddress: socket.remoteAddress });
        }).catch(err => {
          session.failed = true;
          logger.error('journal write failed', err.message);
          socket.destroy();
        }).finally(() => {
          pendingFrames--;
          pendingBytes -= payload.length;
          session.pending--;
          if (!socket.destroyed && !stopping && session.pending === 0) socket.resume();
          release();
        });
        return true;
      }
    });
    socket.on('data', chunk => { if (!framer.push(chunk)) socket.destroy(); });
    socket.on('timeout', () => socket.destroy());
    socket.on('error', err => logger.warn('tcp connection error:', err.message));
    socket.on('close', () => {
      session.closed = true;
      framer.discard(); // EOF is not a frame delimiter; retain complete frames only.
      release();
    });
  });

  const api = http.createServer(async (req, res) => {
    if (requestHandler && req.url.startsWith('/v1/')) {
      if (stopping) { res.writeHead(503); res.end(); return; }
      await requestHandler(req, res);
      return;
    }
    if (req.method !== 'GET' || !['/healthz', '/readyz'].includes(req.url)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    let ok = !stopping;
    if (req.url === '/readyz' && ok) {
      try { await journal.checkReady(); } catch { ok = false; }
      ok &&= !stopping;
    }
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'not_ready', service: 'trackium-gateway', mode: 'raw-capture-only' }));
  });
  api.requestTimeout = 10000;
  api.headersTimeout = 5000;

  const listen = (server, port) => new Promise((resolve, reject) => {
    const onError = err => { server.off('listening', onListening); reject(err); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, config.host ?? '0.0.0.0');
  });
  const close = server => new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close(err => err ? reject(err) : resolve());
  });

  function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    shutdownPromise = (async () => {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          api.closeAllConnections();
          reject(new Error('gateway shutdown timed out; accepted writes may be incomplete'));
        }, config.shutdownTimeoutMs);
      });
      const drain = (async () => {
        // A signal can arrive while initialization or listen() is still pending.
        await startPromise?.catch(() => {});
        const closed = Promise.all([close(tcp), close(api)]);
        api.closeIdleConnections();
        const writes = [...sessions].map(session => {
          session.socket.destroy(); // Stop receiving; already accepted writes still drain.
          return session.chain;
        });
        await Promise.all([closed, ...writes]);
        await journal.close();
      })();
      try { await Promise.race([drain, timeout]); } finally { clearTimeout(timer); }
    })();
    return shutdownPromise;
  }

  return {
    tcp, api, shutdown,
    async start() {
      if (startPromise || stopping) throw new Error('gateway cannot be started twice or after shutdown');
      startPromise = (async () => {
        await journal.initialize();
        if (stopping) return;
        await listen(tcp, config.tcpPort);
        if (stopping) return;
        await listen(api, config.httpPort);
      })();
      try {
        await startPromise;
      } catch (err) {
        await shutdown();
        throw err;
      }
    }
  };
}
