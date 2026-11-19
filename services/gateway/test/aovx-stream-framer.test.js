import test from 'node:test';
import assert from 'node:assert/strict';
import { createAovxStreamFramer } from '../src/aovx/stream-framer.js';
import { encodeAovxFrame } from '../src/aovx/frame.js';

const DEVICE = Buffer.from('221042214328', 'hex');

function sample(sequenceNumber, body = Buffer.from([0x11, 0x22])) {
  return encodeAovxFrame({ messageId: 0x0200, deviceIdBcd: DEVICE, sequenceNumber, body });
}

test('reassembles one frame split across arbitrary TCP chunks', () => {
  const wire = sample(1);
  const frames = [];
  const framer = createAovxStreamFramer({ onFrame: frame => frames.push(frame) });

  assert.equal(framer.push(wire.subarray(0, 1)), true);
  assert.equal(framer.push(wire.subarray(1, 7)), true);
  assert.equal(framer.push(wire.subarray(7)), true);

  assert.deepEqual(frames, [wire]);
  assert.equal(framer.remainingBytes(), 0);
});

test('extracts multiple coalesced frames without changing their wire bytes', () => {
  const first = sample(1, Buffer.from([0x7e, 0x7d]));
  const second = sample(2, Buffer.from([0x00, 0xff]));
  const frames = [];
  const framer = createAovxStreamFramer({ onFrame: frame => frames.push(frame) });

  framer.push(Buffer.concat([first, second]));

  assert.deepEqual(frames, [first, second]);
});

test('ignores bytes before a start flag and empty repeated flags', () => {
  const wire = sample(7);
  const frames = [];
  const framer = createAovxStreamFramer({ onFrame: frame => frames.push(frame) });

  framer.push(Buffer.concat([Buffer.from([0x00, 0x01, 0x7e, 0x7e]), wire]));

  assert.deepEqual(frames, [wire]);
});

test('keeps escaped flag bytes inside the frame instead of treating them as delimiters', () => {
  const wire = sample(8, Buffer.from([0x7e, 0x7d, 0x7e]));
  const frames = [];
  const framer = createAovxStreamFramer({ onFrame: frame => frames.push(frame) });

  for (const byte of wire) framer.push(Buffer.from([byte]));

  assert.deepEqual(frames, [wire]);
});

test('discards an incomplete frame on connection close', () => {
  const frames = [];
  const wire = sample(9);
  const framer = createAovxStreamFramer({ onFrame: frame => frames.push(frame) });

  framer.push(wire.subarray(0, -1));
  assert.ok(framer.remainingBytes() > 0);
  framer.discard();

  assert.equal(framer.remainingBytes(), 0);
  assert.equal(framer.push(wire), false);
  assert.deepEqual(frames, []);
});

test('rejects an oversized frame and stops processing that stream', () => {
  const errors = [];
  const frames = [];
  const framer = createAovxStreamFramer({
    maxFrameBytes: 8,
    onFrame: frame => frames.push(frame),
    onError: error => errors.push(error)
  });

  assert.equal(framer.push(Buffer.from([0x7e, 1, 2, 3, 4, 5, 6, 7])), false);
  assert.equal(framer.push(sample(10)), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /exceeds configured size/);
  assert.deepEqual(frames, []);
});

test('consumer refusal stops scanning remaining coalesced frames', () => {
  const frames = [];
  const framer = createAovxStreamFramer({
    onFrame: frame => {
      frames.push(frame);
      return false;
    }
  });

  assert.equal(framer.push(Buffer.concat([sample(1), sample(2)])), false);
  assert.equal(frames.length, 1);
});

test('validates its frame-size configuration and callback', () => {
  assert.throws(() => createAovxStreamFramer({ maxFrameBytes: 1, onFrame() {} }), /at least 2/);
  assert.throws(() => createAovxStreamFramer({ onFrame: null }), /onFrame/);
});
