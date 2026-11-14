/**
 * fuzzy.js — in-browser mirror of the fuzzy membership functions and rule
 * base from `engine/fuzzy_engine.py` (scikit-fuzzy Mamdani system).
 *
 * This is a VISUALISATION only. The authoritative quality decision always
 * comes from the server / Flask engine over POST /api/network-status.
 * These functions never decide anything — they just show, for the inputs
 * that were sent, how strongly each label applies and which rules fired.
 *
 * Membership functions are copied verbatim from fuzzy_engine.py:
 *   trapmf [a, b, c, d]: 0 below a, ramp a->b, 1 in b..c, ramp down c->d, 0 above d
 *   trimf  [a, b, c]:    0 below a, ramp a->b, ramp down b->c, 0 above c
 */

export function trapmf(x, [a, b, c, d]) {
  // Max-min form, exactly equivalent to scikit-fuzzy's trapmf
  // (skfuzzy/membership/generatemf.py): 1 on the plateau b..c, linear
  // ramps on a..b and c..d, 0 outside a..d. A zero-width ramp (a == b
  // or c == d) is a shoulder, not a gap: e.g. trapmf(0, [0,0,2,4]) = 1
  // and trapmf(16, [10,13,16,16]) = 1.
  if (x < a || x > d) return 0;
  const left = b === a ? 1 : (x - a) / (b - a);
  const right = d === c ? 1 : (d - x) / (d - c);
  return Math.max(0, Math.min(left, 1, right));
}

export function trimf(x, [a, b, c]) {
  // Same idea as scikit-fuzzy's trimf: 1 at the peak b, linear ramps
  // either side, 0 outside a..c. A zero-width side (a == b or b == c)
  // is a shoulder: trimf(144, [144,144,280]) = 1,
  // trimf(1080, [800,1080,1080]) = 1.
  if (x < a || x > c) return 0;
  const left = b === a ? 1 : (x - a) / (b - a);
  const right = c === b ? 1 : (c - x) / (c - b);
  return Math.max(0, Math.min(left, right));
}

// ---- Membership tables, exactly as defined in fuzzy_engine.py ----
export const MEMBERSHIP = {
  bandwidth: {
    unit: 'Mbps',
    labels: {
      low: { fn: trapmf, params: [0, 0, 2, 4] },
      medium: { fn: trimf, params: [3, 5, 7] },
      high: { fn: trimf, params: [6, 8, 11] },
      excellent: { fn: trapmf, params: [10, 13, 16, 16] },
    },
  },
  buffer: {
    unit: 's',
    labels: {
      draining: { fn: trapmf, params: [0, 0, 3, 8] },
      healthy: { fn: trimf, params: [5, 14, 22] },
      full: { fn: trapmf, params: [18, 25, 30, 30] },
    },
  },
  delay: {
    unit: 'ms',
    labels: {
      low: { fn: trapmf, params: [0, 0, 50, 100] },
      high: { fn: trapmf, params: [100, 150, 400, 400] },
    },
  },
};

export const QUALITY_SETS = {
  panic: { fn: trimf, params: [144, 144, 280] },
  low: { fn: trimf, params: [240, 400, 560] },
  medium: { fn: trimf, params: [480, 700, 880] },
  high: { fn: trimf, params: [800, 1080, 1080] },
};

/**
 * Fuzzify one input value: { label: membership 0..1, ... }.
 */
export function fuzzifyInput(inputName, value) {
  const def = MEMBERSHIP[inputName];
  const out = {};
  for (const [label, { fn, params }] of Object.entries(def.labels)) {
    out[label] = Math.max(0, Math.min(1, fn(value, params)));
  }
  return out;
}

/**
 * Fuzzify all three inputs at once.
 * Returns { bandwidth: {low, medium, ...}, buffer: {...}, delay: {...} }.
 */
export function fuzzify(bandwidth, buffer, delay) {
  return {
    bandwidth: fuzzifyInput('bandwidth', bandwidth),
    buffer: fuzzifyInput('buffer', buffer),
    delay: fuzzifyInput('delay', delay),
  };
}

// ---- Rule base, exactly as in fuzzy_engine.py (AND = min) ----
export const RULES = [
  {
    id: 'A',
    text: 'IF delay is high THEN quality is panic',
    output: 'panic',
    strength: (m) => m.delay.high,
  },
  {
    id: 'B',
    text: 'IF buffer is draining THEN quality is low',
    output: 'low',
    strength: (m) => m.buffer.draining,
  },
  {
    id: 'C',
    text: 'IF bandwidth is low THEN quality is low',
    output: 'low',
    strength: (m) => m.bandwidth.low,
  },
  {
    id: 'D',
    text: 'IF bandwidth is excellent AND buffer is full AND delay is low THEN quality is high',
    output: 'high',
    strength: (m) =>
      Math.min(m.bandwidth.excellent, m.buffer.full, m.delay.low),
  },
  {
    id: 'E',
    text: 'IF bandwidth is high AND buffer is healthy AND delay is low THEN quality is medium',
    output: 'medium',
    strength: (m) =>
      Math.min(m.bandwidth.high, m.buffer.healthy, m.delay.low),
  },
  {
    id: 'F',
    text: 'IF bandwidth is medium AND buffer is healthy THEN quality is medium',
    output: 'medium',
    strength: (m) => Math.min(m.bandwidth.medium, m.buffer.healthy),
  },
];

/**
 * Evaluate every rule for a fuzzified input set.
 * Returns [{ id, text, output, strength }] — a rule counts as "fired"
 * when strength > 0.
 */
export function evaluateRules(memberships) {
  return RULES.map((rule) => ({
    id: rule.id,
    text: rule.text,
    output: rule.output,
    strength: Math.max(0, Math.min(1, rule.strength(memberships))),
  }));
}

/** Map a fuzzy output value (144-1080) to the closest level height. */
export function closestLevelHeight(value, heights) {
  if (!heights || heights.length === 0) return null;
  let best = heights[0];
  let bestDiff = Math.abs(heights[0] - value);
  for (const h of heights) {
    const diff = Math.abs(h - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

/** The standard HLS ladder this stream offers (used as a placeholder until the player reports its real levels). */
export const STANDARD_LADDER = [144, 240, 360, 480, 720, 1080];
