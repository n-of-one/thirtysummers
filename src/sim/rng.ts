/** A seeded pseudo-random number generator: returns a float in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32 -- a small, fast, well-distributed 32-bit PRNG.
 * Same seed always produces the same stream, which is what makes worldgen
 * reproducible and testable.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, maxExclusive). */
export function randInt(rng: Rng, min: number, maxExclusive: number): number {
  return min + Math.floor(rng() * (maxExclusive - min));
}

/** Uniform pick from a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length)]!;
}

/** Fisher-Yates, in place. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/**
 * Deterministic value in [0, 1) for a grid position.
 *
 * Unlike `mulberry32` this is a spatial hash, not a stream: it can be sampled
 * for any tile in any order and always gives the same answer, which is what
 * scattering features across a map needs.
 */
export function hash2d(seed: number, x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
