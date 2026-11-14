const MAX_BUFFER_S = 30;
export function getBufferAhead(video) {
  if (!video || video.readyState < 2) return null;
  const t = video.currentTime;
  const r = video.buffered;
  for (let i = 0; i < r.length; i++) {
    if (r.start(i) <= t && t < r.end(i)) return Math.min(r.end(i) - t, MAX_BUFFER_S);
  }
  return 0;
}
