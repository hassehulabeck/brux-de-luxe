/**
 * A small seeded random number generator (mulberry32). The state is a plain
 * number, so a generator can be saved and restored. This is the only source
 * of randomness in the engine: Math.random() is not allowed here.
 */

export interface Rng {
  /** A number in [0, 1). */
  next(): number;
  /** A whole number in [0, max). */
  int(max: number): number;
}

export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (max) => Math.floor(next() * max) };
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
