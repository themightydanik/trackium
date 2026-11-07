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

test('accepts exact limit, ignores empty lines and preserves binary bytes and CR', () => {
  const frames = [];
  const framer = createLineFramer({ maxFrameBytes: 3, onFrame: p => frames.push(p), onError: assert.fail });
  framer.push(Buffer.from([0, 255]));
  framer.push(Buffer.from([13, 10, 10, 120, 10]));
  assert.deepEqual(frames, [Buffer.from([0, 255, 13]), Buffer.from('x')]);
  assert.equal(framer.remainingBytes(), 0);
});

test('rejects oversized terminated frames and stays stopped', () => {
  const errors = [], frames = [];
  const framer = createLineFramer({ maxFrameBytes: 3, onFrame: p => frames.push(p), onError: e => errors.push(e) });
  framer.push(Buffer.from('ab'));
  assert.equal(framer.push(Buffer.from('cd\nok\n')), false);
  assert.equal(framer.push(Buffer.from('ok\n')), false);
  assert.equal(errors.length, 1);
  assert.deepEqual(frames, []);
  assert.equal(framer.remainingBytes(), 0);
});

test('consumer refusal stops scanning remaining coalesced frames', () => {
  const frames = [];
  const framer = createLineFramer({ onFrame: p => { frames.push(p.toString()); return false; }, onError: assert.fail });
  assert.equal(framer.push(Buffer.from('one\ntwo\n')), false);
  assert.deepEqual(frames, ['one']);
});
