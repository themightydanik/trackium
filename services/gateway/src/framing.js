// Temporary newline framing for synthetic fixtures ONLY.
// Real GL110-GL framing and acknowledgements require captured firmware packets.
export function createLineFramer({ maxFrameBytes = 65536, onFrame, onError }) {
  if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 1) {
    throw new Error('maxFrameBytes must be a positive safe integer');
  }
  let pending;
  let length = 0;
  let stopped = false;
  const stop = () => { stopped = true; pending = undefined; length = 0; };
  return {
    push(chunk) {
      if (stopped) return false;
      let offset = 0;
      while (offset < chunk.length) {
        const newline = chunk.indexOf(10, offset);
        const end = newline === -1 ? chunk.length : newline;
        const size = end - offset;
        // Check before copying/allocating; a TCP chunk may contain many frames.
        if (length + size > maxFrameBytes) {
          stop();
          onError(new Error('frame exceeds configured size'));
          return false;
        }
        if (newline === -1 || length) {
          if (size) {
            pending ??= Buffer.allocUnsafe(maxFrameBytes);
            chunk.copy(pending, length, offset, end);
            length += size;
          }
        }
        if (newline === -1) return true;
        const frame = length
          ? Buffer.from(pending.subarray(0, length))
          : Buffer.from(chunk.subarray(offset, end));
        length = 0;
        if (frame.length && onFrame(frame) === false) {
          stop();
          return false;
        }
        offset = newline + 1;
      }
      return true;
    },
    remainingBytes() { return length; },
    discard: stop
  };
}
