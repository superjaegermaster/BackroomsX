// Deterministic PRNG (mulberry32). Same seed => same level, every build.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0);
  };
  return {
    randi: next,                       // uint32
    randf: () => next() / 4294967296,  // [0,1)
    ri: (lo, hi) => lo + (next() % (hi - lo + 1)), // int in [lo,hi]
  };
}
// string seed -> uint32 (for style shuffles etc.)
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
