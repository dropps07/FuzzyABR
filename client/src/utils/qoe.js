// Best output the engine produces (bw=16, buffer=30, delay=0).
// Centroid defuzzification never reaches the 1080 edge. Re-measure
// this if you change the rule base or membership functions.
const MAX_QUALITY = 990;

export function computeQoe(history) {
  // Fallback ticks are placeholders, not real decisions
  const recent = history.filter(h => h.source === 'fuzzy_engine').slice(-10);
  if (recent.length === 0) return null;

  const avgQuality = recent.reduce((s, h) => s + h.quality, 0) / recent.length;
  const qualityScore = Math.min(avgQuality / MAX_QUALITY, 1) * 100;

  let switches = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].quality !== recent[i - 1].quality) switches++;
  }

  const rebufferPenalty =
    recent.reduce((s, h) => {
      if (h.buffer < 2) return s + 15;
      if (h.buffer < 5) return s + 5;
      return s;
    }, 0) / recent.length;

  return Math.max(0, Math.min(100, Math.round(qualityScore - switches * 6 - rebufferPenalty)));
}

export const qoeClass = s => (s === null ? '' : s >= 70 ? 'good' : s >= 40 ? 'warning' : 'bad');