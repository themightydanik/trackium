import net from 'node:net';
import http from 'node:http';
import { diagnosePortConflict } from './port-diagnostics.js';
import { createLineFramer } from './framing.js';
import { createAovxStreamFramer } from './aovx/stream-framer.js';
import { decodeAovxFrame } from './aovx/frame.js';
import { parseAovxMessage } from './aovx/messages.js';
import { encodeAovxQueryCommand, parseAovxGeneralQueryResponse, parseAovxConfigurationResponse } from './aovx/config-query.js';

function jsonSafe(value) {
  if (Buffer.isBuffer(value)) return { encoding: 'hex', value: value.toString('hex') };
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function inspectAovxFrame(payload, logger) {
  const decoded = decodeAovxFrame(payload);
  if (!decoded.checksumMatchesXor) {
    logger.warn('AOVX frame captured with protocol checksum mismatch');
  }

  try {
    const parsed = parseAovxMessage(decoded);
    return {
      messageId: decoded.messageId,
      deviceIdBcd: decoded.deviceIdBcd.toString('hex'),
      sequenceNumber: decoded.sequenceNumber,
      checksumStatus: decoded.checksumStatus,
      parseStatus: parsed.data.parsing === 'not-implemented' ? 'opaque' : 'parsed',
      parseError: null,
      parsedPayload: jsonSafe(parsed.data)
    };
  } catch (err) {
    // Semantic parsing is observational: preserve the structurally valid raw
    // frame even when a known message body is truncated or not yet understood.
    logger.warn('AOVX message body parse failed; preserving raw frame:', err.message);
    return {
      messageId: decoded.messageId,
      deviceIdBcd: decoded.deviceIdBcd.toString('hex'),
      sequenceNumber: decoded.sequenceNumber,
      checksumStatus: decoded.checksumStatus,
      parseStatus: 'error',
      parseError: String(err.message).slice(0, 1000),
      parsedPayload: null
    };
  }
}

// The injected journal keeps TCP lifecycle tests independent of PostgreSQL.
export function createGateway({ journal, config, logger = console, requestHandler, assetHandler, ingressGuard }) {
  const sessions = new Set();
  const aovxDeviceSessions = new Map();
  const pendingAovxQueries = new Map();
  let nextAovxSequence = Date.now() & 0xffff;
  let pendingFrames = 0;
  let pendingBytes = 0;
  let stopping = false;
  let shutdownPromise;
  let startPromise;

  const tcp = net.createServer(socket => {
    // A disconnected client keeps its slot until accepted writes settle.
    if (stopping || sessions.size >= config.maxConnections) { socket.destroy(); return; }
    const session = { socket, chain: Promise.resolve(), pending: 0, closed: false, failed: false, deviceIdBcd: null };
    sessions.add(session);
    const peer = { remoteAddress: socket.remoteAddress ?? null, remotePort: socket.remotePort ?? null };
    logger.info?.('tcp client connected:', JSON.stringify(peer));
    const release = () => {
      if (session.closed && session.pending === 0) sessions.delete(session);
    };
    socket.setTimeout(config.socketTimeoutMs);
    const onFrame = payload => {
      let aovx = null;
      let decodedAovx = null;
      if (config.tcpProtocol === 'aovx') {
        try {
          aovx = inspectAovxFrame(payload, logger);
          decodedAovx = decodeAovxFrame(payload);
        } catch (err) {
          logger.warn('invalid AOVX frame:', err.message);
          socket.destroy();
          return false;
        }
      }
      if (decodedAovx?.messageId === 0x0200 && decodedAovx.checksumMatchesXor) {
        const deviceId = decodedAovx.deviceIdBcd.toString('hex');
        if (session.deviceIdBcd !== deviceId) {
          if (session.deviceIdBcd) {
            const previous = aovxDeviceSessions.get(session.deviceIdBcd);
            previous?.delete(session);
            if (previous?.size === 0) aovxDeviceSessions.delete(session.deviceIdBcd);
            for (const [key, pending] of pendingAovxQueries) {
              if (pending.session === session) {
                clearTimeout(pending.timer);
                pendingAovxQueries.delete(key);
                pending.reject(new Error('AOVX session identity changed during configuration query'));
              }
            }
          }
          const previousDeviceIdBcd = session.deviceIdBcd;
          session.deviceIdBcd = null;
          if (/^[0-9]{12}$/.test(deviceId)) {
            session.deviceIdBcd = deviceId;
            let active = aovxDeviceSessions.get(deviceId);
            if (!active) aovxDeviceSessions.set(deviceId, active = new Set());
            active.add(session);
          }
          logger.info?.('tcp client AOVX identity updated:', JSON.stringify({
            ...peer, previousDeviceIdBcd, deviceIdBcd: session.deviceIdBcd
          }));
        }
      }
      if (decodedAovx && [0x0001, 0x0104].includes(decodedAovx.messageId) && decodedAovx.checksumMatchesXor) {
        try {
          const parsed = decodedAovx.messageId === 0x0001
            ? parseAovxGeneralQueryResponse(decodedAovx)
            : parseAovxConfigurationResponse(decodedAovx);
          const responseSequence = parsed.responseSequenceNumber;
          const key = `${decodedAovx.deviceIdBcd.toString('hex')}:${responseSequence}`;
          const pending = pendingAovxQueries.get(key);
          if (pending && pending.session === session) {
            if (decodedAovx.messageId === 0x0001) {
              if (parsed.correspondingMessageId !== 0x8104 || parsed.result !== 0) {
                clearTimeout(pending.timer);
                pendingAovxQueries.delete(key);
                pending.reject(new Error(`AOVX query acknowledgement failed (result ${parsed.result})`));
              } else {
                pending.acknowledged = true;
              }
            } else {
              clearTimeout(pending.timer);
              pendingAovxQueries.delete(key);
              pending.resolve({
                device_id_bcd: decodedAovx.deviceIdBcd.toString('hex'),
                sequence_number: responseSequence,
                gnss: parsed.gnssEnabled,
                acknowledged: pending.acknowledged,
                parameter_present: parsed.gnssRaw !== null
              });
            }
          }
        } catch (error) {
          logger.warn('AOVX configuration response rejected:', error.message);
        }
      }
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
        if (!session.failed) await journal.persistPacket({ payload, remoteAddress: socket.remoteAddress, aovx });
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
    };
    const framer = config.tcpProtocol === 'aovx'
      ? createAovxStreamFramer({ maxFrameBytes: config.maxFrameBytes, onError: err => {
          logger.warn('AOVX stream framing failed:', err.message);
          socket.destroy();
        }, onFrame })
      : createLineFramer({ maxFrameBytes: config.maxFrameBytes, onError: () => socket.destroy(), onFrame });
    socket.on('data', chunk => { if (!framer.push(chunk)) socket.destroy(); });
    socket.on('end', () => logger.info?.('tcp client half-closed:', JSON.stringify({
      ...peer, deviceIdBcd: session.deviceIdBcd, pendingWrites: session.pending
    })));
    socket.on('timeout', () => {
      logger.warn('tcp client timeout:', JSON.stringify({
        ...peer, deviceIdBcd: session.deviceIdBcd, timeoutMs: config.socketTimeoutMs,
        pendingWrites: session.pending
      }));
      socket.destroy();
    });
    socket.on('error', err => logger.warn('tcp connection error:', JSON.stringify({
      ...peer, deviceIdBcd: session.deviceIdBcd, code: err.code ?? null, message: err.message
    })));
    socket.on('close', hadError => {
      session.closed = true;
      logger.info?.('tcp client closed:', JSON.stringify({
        ...peer, deviceIdBcd: session.deviceIdBcd, hadError,
        pendingWrites: session.pending, journalFailed: session.failed
      }));
      if (session.deviceIdBcd) {
        const active = aovxDeviceSessions.get(session.deviceIdBcd);
        active?.delete(session);
        if (active?.size === 0) aovxDeviceSessions.delete(session.deviceIdBcd);
      }
      for (const [key, pending] of pendingAovxQueries) {
        if (pending.session === session) {
          clearTimeout(pending.timer);
          pendingAovxQueries.delete(key);
          pending.reject(new Error('AOVX device disconnected during configuration query'));
        }
      }
      framer.discard(); // EOF is not a frame delimiter; retain complete frames only.
      release();
    });
  });

  const api = http.createServer(async (req, res) => {
    if (ingressGuard && !ingressGuard(req, res)) return;
    if (assetHandler && (req.url === '/app' || req.url.startsWith('/app/'))) { await assetHandler(req,res);return; }
    if (requestHandler && (req.url.startsWith('/v1/') || req.url.startsWith('/internal/'))) {
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
    res.end(JSON.stringify({ status: ok ? 'ok' : 'not_ready', service: 'trackium-gateway', mode: config.tcpProtocol === 'aovx' ? 'aovx-frame-capture-only' : 'raw-capture-only' }));
  });
  api.requestTimeout = 10000;
  api.headersTimeout = 5000;

  const listen = async (server, port, serverType) => {
    const host = config.host ?? '0.0.0.0';
    logger.info?.('gateway server listen starting:', JSON.stringify({ serverType, port, host, serverListening: server.listening, serverAddress: server.address() }));
    if (server === tcp && Number.isInteger(port) && port > 0) {
      try {
        const report = await diagnosePortConflict(port);
        (logger.info ?? console.info).call(logger, 'tcp port listen boundary:', JSON.stringify({
          phase: 'immediately_before_server_listen',
          serverType,
          port,
          host,
          serverListening: server.listening,
          serverAddress: server.address(),
          report
        }));
      } catch (diagnosticError) {
        (logger.warn ?? console.warn).call(logger, 'tcp port listen boundary diagnostics unavailable:', diagnosticError.message);
      }
    }
    return new Promise((resolve, reject) => {
      const onError = err => {
        server.off('listening', onListening);
        logger.error('gateway server listen failed:', JSON.stringify({ serverType, port, host, code: err.code ?? null, message: err.message, serverListening: server.listening, serverAddress: server.address() }));
        if (err.code === 'EADDRINUSE' && server === tcp && Number.isInteger(port) && port > 0) {
          void diagnosePortConflict(port).then(report => {
            logger.error('bind conflict diagnostics:', JSON.stringify({ serverType, ...report }));
          }).catch(diagnosticError => {
            logger.error('bind conflict diagnostics failed:', diagnosticError.message);
          }).finally(() => reject(err));
          return;
        }
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        logger.info?.('gateway server listening:', JSON.stringify({ serverType, port, host, serverListening: server.listening, serverAddress: server.address() }));
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });
  };
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

  function queryAovxConfiguration(deviceIdBcd) {
    if (config.tcpProtocol !== 'aovx') throw new Error('AOVX command channel is disabled');
    if (typeof deviceIdBcd !== 'string' || !/^[0-9]{12}$/.test(deviceIdBcd))
      throw new TypeError('deviceIdBcd must be 12 decimal digits');
    const active = [...(aovxDeviceSessions.get(deviceIdBcd) ?? [])]
      .filter(item => !item.closed && !item.socket.destroyed && item.socket.writable);
    if (active.length !== 1)
      throw new Error(active.length === 0
        ? 'AOVX device has no active TCP session'
        : 'AOVX device has multiple active TCP sessions; refusing ambiguous command routing');

    const session = active[0];
    let sequenceNumber;
    for (let attempt = 0; attempt < 0x10000; attempt += 1) {
      const candidate = nextAovxSequence;
      nextAovxSequence = (nextAovxSequence + 1) & 0xffff;
      if (!pendingAovxQueries.has(`${deviceIdBcd}:${candidate}`)) {
        sequenceNumber = candidate;
        break;
      }
    }
    if (sequenceNumber === undefined) {
      throw new Error('all AOVX query sequence numbers are currently in use for this device');
    }
    const key = `${deviceIdBcd}:${sequenceNumber}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingAovxQueries.delete(key);
        reject(new Error('AOVX configuration query timed out; no 0x0104 parameter response received'));
      }, 12000);
      pendingAovxQueries.set(key, { session, timer, resolve, reject, acknowledged: false });
      const frame = encodeAovxQueryCommand({
        deviceIdBcd: Buffer.from(deviceIdBcd, 'hex'),
        sequenceNumber
      });
      session.socket.write(frame, error => {
        if (!error) return;
        clearTimeout(timer);
        pendingAovxQueries.delete(key);
        reject(error);
      });
      logger.info?.('AOVX read-only configuration query sent:', JSON.stringify({
        deviceIdBcd, messageId: '0x8104', sequenceNumber
      }));
    });
  }

  return {
    tcp, api, shutdown, queryAovxConfiguration,
    async start() {
      if (startPromise || stopping) throw new Error('gateway cannot be started twice or after shutdown');
      startPromise = (async () => {
        await journal.initialize();
        if (stopping) return;
        if (config.tcpEnabled !== false) await listen(tcp, config.tcpPort, 'tcp');
        if (stopping) return;
        await listen(api, config.httpPort, 'http');
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
