import net from 'node:net';
import http from 'node:http';
import { initialize, persistPacket, pool } from './journal.js';
import { createLineFramer } from './framing.js';

const TCP_PORT = Number(process.env.TCP_PORT ?? 9000);
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8080);
const MAX_FRAME_BYTES = Number(process.env.MAX_FRAME_BYTES ?? 65536);
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS ?? 100);
const MAX_PENDING_FRAMES = Number(process.env.MAX_PENDING_FRAMES ?? 100);
let ready = false;
let active = 0;
let accepting = true;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (![TCP_PORT, HTTP_PORT].every(p => Number.isInteger(p) && p > 0 && p <= 65535)) throw new Error('invalid port');

await initialize();
ready = true;

const tcp = net.createServer(socket => {
  if (!accepting || active >= MAX_CONNECTIONS) { socket.destroy(); return; }
  active++;
  socket.setTimeout(120000);
  let pendingWrites = 0;
  let chain = Promise.resolve();
  const fail = () => socket.destroy();
  const framer = createLineFramer({
    maxFrameBytes: MAX_FRAME_BYTES,
    onError: fail,
    onFrame: payload => {
      if (++pendingWrites > MAX_PENDING_FRAMES) { fail(); return; }
      socket.pause();
      chain = chain.then(async () => {
        // Persist before any downstream processing. No device ACK until protocol is known.
        await persistPacket({ payload, remoteAddress: socket.remoteAddress });
      }).catch(err => {
        console.error('journal write failed', err.message);
        fail();
      }).finally(() => {
        pendingWrites--;
        if (!socket.destroyed && pendingWrites < MAX_PENDING_FRAMES) socket.resume();
      });
    }
  });
  socket.on('data', chunk => { if (!framer.push(chunk)) fail(); });
  socket.on('timeout', fail);
  socket.on('error', err => console.warn('tcp connection error:', err.message));
  socket.on('close', () => { active--; });
});
tcp.maxConnections = MAX_CONNECTIONS;

const api = http.createServer(async (req, res) => {
  if (req.method !== 'GET' || !['/healthz','/readyz'].includes(req.url)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  if (req.url === '/readyz') {
    try { await pool.query('SELECT 1'); } catch { ready = false; }
  }
  const ok = req.url === '/healthz' || ready;
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ status: ok ? 'ok' : 'not_ready', service: 'trackium-gateway', mode: 'raw-capture-only' }));
});

tcp.listen(TCP_PORT, '0.0.0.0', () => console.log('gateway TCP listening', TCP_PORT));
api.listen(HTTP_PORT, '0.0.0.0', () => console.log('gateway HTTP listening', HTTP_PORT));

async function shutdown() {
  accepting = false;
  ready = false;
  tcp.close();
  api.close();
  await pool.end();
}
process.once('SIGTERM', () => { shutdown().catch(console.error); });
process.once('SIGINT', () => { shutdown().catch(console.error); });
