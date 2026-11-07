import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineFramer } from '../src/framing.js';

test('reassembles split newline frames and preserves raw bytes', () => {
  const frames = [], errors = [];
  const framer = createLineFramer({ onFrame: p => frames.push(p), onError: e => errors.push(e) });
  framer.push(Buffer.from('abc'));
  framer.push(Buffer.from('def\nxyz\n'));
  assert.deepEqual(frames.map(b => b.toString()), ['abcdef', 'xyz']);
  assert.equal(errors.length, 0);
});

test('rejects oversized incomplete frames', () => {
  const errors = [];
  const framer = createLineFramer({ maxFrameBytes: 3, onFrame: () => {}, onError: e => errors.push(e) });
  assert.equal(framer.push(Buffer.from('abcd')), false);
  assert.equal(errors.length, 1);
});
