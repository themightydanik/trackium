import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProcNetListeners } from '../src/port-diagnostics.js';

test('parseProcNetListeners returns only LISTEN sockets on the requested port', () => {
  const proc = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 00000000:2328 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000 0 12345',
    '   1: 0100007F:2328 00000000:0000 01 00000000:00000000 00:00000000 00000000  1000 0 12346',
    '   2: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000 0 12347'
  ].join('\n');
  assert.deepEqual(parseProcNetListeners(proc, 9000), [
    { localAddressHex: '00000000:2328', inode: '12345' }
  ]);
});

test('parseProcNetListeners safely handles empty proc data', () => {
  assert.deepEqual(parseProcNetListeners('', 9000), []);
});
