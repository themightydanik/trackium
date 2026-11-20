import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { createGateway } from '../src/gateway.js';
import { readConfig } from '../src/config.js';
import { encodeAovxFrame, decodeAovxFrame } from '../src/aovx/frame.js';

const deviceIdBcd = Buffer.from('944063243931', 'hex');
const quiet = { info() {}, warn() {}, error() {} };
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture(t) {
  const gateway = createGateway({
    logger: quiet,
    config: {
      ...readConfig({ DATABASE_URL: 'postgres://unused', TCP_PROTOCOL: 'aovx' }),
      host: '127.0.0.1', tcpPort: 0, httpPort: 0
    },
    journal: { async initialize() {}, async persistPacket() {}, async checkReady() {}, async close() {} }
  });
  await gateway.start();
  t.after(() => gateway.shutdown());
  return gateway;
}

async function connect(gateway, t) {
  const socket = net.connect(gateway.tcp.address().port, '127.0.0.1');
  socket.on('error', () => {});
  t.after(() => socket.destroy());
  await once(socket, 'connect');
  return socket;
}

function telemetryFrame(id = deviceIdBcd) {
  return encodeAovxFrame({
    messageId: 0x0200, deviceIdBcd: id, sequenceNumber: 10,
    body: Buffer.alloc(40)
  });
}

test('sends 0x8104 only to the unique active session and resolves matching 0x0104', async t => {
  const gateway = await fixture(t);
  const socket = await connect(gateway, t);
  const incoming = new Promise(resolve => socket.once('data', resolve));
  socket.write(telemetryFrame());
  await new Promise(resolve => setTimeout(resolve, 25));

  const resultPromise = gateway.queryAovxConfiguration('944063243931');
  const wireCommand = await incoming;
  const command = decodeAovxFrame(wireCommand, { checksumPolicy: 'require-xor-match' });
  assert.equal(command.messageId, 0x8104);
  assert.equal(command.body.length, 0);
  assert.deepEqual(command.deviceIdBcd, deviceIdBcd);

  const acknowledgementBody = Buffer.alloc(5);
  acknowledgementBody.writeUInt16BE(command.sequenceNumber, 0);
  acknowledgementBody.writeUInt16BE(0x8104, 2);
  acknowledgementBody[4] = 0;
  socket.write(encodeAovxFrame({
    messageId: 0x0001, deviceIdBcd, sequenceNumber: 12, body: acknowledgementBody
  }));
  await tick();

  const responseBody = Buffer.alloc(9);
  responseBody.writeUInt16BE(command.sequenceNumber, 0);
  responseBody[2] = 1;
  responseBody.writeUInt32BE(0x0000f029, 3);
  responseBody[7] = 1;
  responseBody[8] = 1;
  socket.write(encodeAovxFrame({
    messageId: 0x0104, deviceIdBcd, sequenceNumber: 11, body: responseBody
  }));

  const result = await resultPromise;
  assert.deepEqual(result, {
    device_id_bcd: '944063243931',
    sequence_number: command.sequenceNumber,
    gnss: 'enabled',
    acknowledged: true,
    parameter_present: true
  });
});

test('does not route a command when a device has ambiguous active sessions', async t => {
  const gateway = await fixture(t);
  const first = await connect(gateway, t);
  const second = await connect(gateway, t);
  first.write(telemetryFrame());
  second.write(telemetryFrame());
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.throws(
    () => gateway.queryAovxConfiguration('944063243931'),
    /multiple active TCP sessions/
  );
});

test('does not route a command to a device without an active session', async t => {
  const gateway = await fixture(t);
  assert.throws(() => gateway.queryAovxConfiguration('944063243931'), /no active TCP session/);
});

test('removes a session from its previous device identity before rerouting', async t => {
  const gateway = await fixture(t);
  const socket = await connect(gateway, t);
  const otherDevice = Buffer.from('123456789012', 'hex');
  socket.write(telemetryFrame());
  await new Promise(resolve => setTimeout(resolve, 25));
  socket.write(telemetryFrame(otherDevice));
  await new Promise(resolve => setTimeout(resolve, 25));

  assert.throws(
    () => gateway.queryAovxConfiguration('944063243931'),
    /no active TCP session/
  );

  const incoming = new Promise(resolve => socket.once('data', resolve));
  const resultPromise = gateway.queryAovxConfiguration('123456789012');
  const command = decodeAovxFrame(await incoming, { checksumPolicy: 'require-xor-match' });
  assert.equal(command.messageId, 0x8104);
  assert.deepEqual(command.deviceIdBcd, otherDevice);

  const responseBody = Buffer.alloc(9);
  responseBody.writeUInt16BE(command.sequenceNumber, 0);
  responseBody[2] = 1;
  responseBody.writeUInt32BE(0x0000f029, 3);
  responseBody[7] = 1;
  responseBody[8] = 0;
  socket.write(encodeAovxFrame({
    messageId: 0x0104, deviceIdBcd: otherDevice, sequenceNumber: 11, body: responseBody
  }));
  const result = await resultPromise;
  assert.equal(result.device_id_bcd, '123456789012');
  assert.equal(result.gnss, 'disabled');
});
