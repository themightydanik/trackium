// Temporary newline framing for synthetic fixtures ONLY.
// Real GL110-GL framing and acknowledgements require captured firmware packets.
export function createLineFramer({ maxFrameBytes = 65536, onFrame, onError }) {
  let pending = Buffer.alloc(0);
  return {
    push(chunk) {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > maxFrameBytes && !pending.includes(10)) {
        onError(new Error('frame exceeds configured size'));
        return false;
      }
      let pos;
      while ((pos = pending.indexOf(10)) !== -1) {
        const frame = pending.subarray(0, pos);
        pending = pending.subarray(pos + 1);
        if (frame.length > maxFrameBytes) {
          onError(new Error('frame exceeds configured size'));
          return false;
        }
        if (frame.length) onFrame(Buffer.from(frame));
      }
      if (pending.length > maxFrameBytes) {
        onError(new Error('frame exceeds configured size'));
        return false;
      }
      return true;
    },
    remainingBytes() { return pending.length; }
  };
}
