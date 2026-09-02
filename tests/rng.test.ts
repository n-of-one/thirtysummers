import { describe, expect, it } from "vitest";
import { mulberry32, randInt, shuffle } from "../src/sim/rng.ts";

describe("mulberry32", () => {
  it("produces the same stream for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randInt covers its range and never exceeds it", () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = randInt(rng, 3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(8);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it("shuffle is a permutation and is seed-stable", () => {
    const source = Array.from({ length: 100 }, (_, i) => i);
    const a = shuffle(mulberry32(5), source.slice());
    const b = shuffle(mulberry32(5), source.slice());
    expect(a).toEqual(b);
    expect(a.slice().sort((x, y) => x - y)).toEqual(source);
  });
});
