const FLAG = 0x7e;

export function createAovxStreamFramer({ maxFrameBytes = 4096, onFrame, onError = () => {} }) {
  if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 2) {
    throw new Error('maxFrameBytes must be a safe integer of at least 2');
  }
  if (typeof onFrame !== 'function') throw new TypeError('onFrame must be a function');
  if (typeof onError !== 'function') throw new TypeError('onError must be a function');

  let buffer;
  let length = 0;
  let inFrame = false;
  let stopped = false;

  const reset = () => {
    buffer = undefined;
    length = 0;
    inFrame = false;
  };

  const stop = () => {
    stopped = true;
    reset();
  };

  const append = byte => {
    if (!buffer) buffer = Buffer.allocUnsafe(Math.min(256, maxFrameBytes - 2));
    if (length === buffer.length) {
      const capacity = Math.min(maxFrameBytes - 2, Math.max(1, buffer.length * 2));
      if (capacity <= buffer.length) return false;
      const grown = Buffer.allocUnsafe(capacity);
      buffer.copy(grown, 0, 0, length);
      buffer = grown;
    }
    buffer[length++] = byte;
    return true;
  };

  return {
    push(chunk) {
      if (stopped) return false;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      for (const byte of bytes) {
        if (byte === FLAG) {
          if (inFrame && length > 0) {
            const frame = Buffer.allocUnsafe(length + 2);
            frame[0] = FLAG;
            buffer.copy(frame, 1, 0, length);
            frame[frame.length - 1] = FLAG;
            reset();
            if (onFrame(frame) === false) {
              stop();
              return false;
            }
          } else {
            reset();
          }
          inFrame = true;
          continue;
        }

        if (!inFrame) continue;
        if (length >= maxFrameBytes - 2 || !append(byte)) {
          stop();
          onError(new Error('AOVX frame exceeds configured size'));
          return false;
        }
      }
      return true;
    },

    remainingBytes() {
      return inFrame && length > 0 ? length + 1 : 0;
    },

    discard() {
      stop();
    }
  };
}
