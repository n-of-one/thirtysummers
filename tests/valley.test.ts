import { describe, expect, it } from "vitest";
import { planValley } from "../src/sim/worldgen/valley.ts";

/** Seeds that come out both ways round: the plan is mirrored by the seed. */
const SEEDS = [1337, 2026, 7, 31, 555, 808];

describe("the valley plan", () => {
  it("is the same valley for the same seed", () => {
    const a = planValley(42);
    const b = planValley(42);
    expect(a.camp).toEqual(b.camp);
    expect(a.floor).toEqual(b.floor);
    expect(a.river).toEqual(b.river);
    expect(a.stream).toEqual(b.stream);
  });

  it("is a tall map, not a square, at the plan's scale", () => {
    const { width, height } = planValley(1337);
    // The sketch it came from, at a scale of 1.3, was 312 by 465.
    expect(width).toBeGreaterThan(290);
    expect(width).toBeLessThan(335);
    expect(height).toBeGreaterThan(440);
    expect(height).toBeLessThan(490);
  });

  it("is mirrored on some seeds and not on others, with camp in its part either way", () => {
    const sides = new Set<boolean>();
    for (const seed of SEEDS) {
      const plan = planValley(seed);
      const i = Math.floor(plan.camp.y) * plan.width + Math.floor(plan.camp.x);
      expect(plan.ring[i]).toBe(1);
      // The first stream comes off the west wall, or the east one once
      // mirrored: its tiles lie on one side of the map's middle or the other.
      let west = 0;
      let east = 0;
      for (let j = 0; j < plan.stream.length; j++) {
        if (!plan.stream[j]) continue;
        if (j % plan.width < plan.width / 2) west++;
        else east++;
      }
      sides.add(west > east);
    }
    expect(sides.size).toBe(2);
  });

  it("has one run of river on each row below the lake: the river, and no channel beside it", () => {
    // Straightening the shore under the falls once filled a column with no
    // lake under it all the way down the valley, on seed 423 among others.
    for (const seed of [...SEEDS, 423, 421]) {
      const plan = planValley(seed);
      for (let y = Math.floor(plan.camp.y) - 30; y < plan.height; y++) {
        let runs = 0;
        for (let x = 0; x < plan.width; x++) {
          if (plan.river[y * plan.width + x] && !plan.river[y * plan.width + x - 1]) runs++;
        }
        expect(runs, `seed ${seed}, row ${y}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts camp three quarters of the way down its part", () => {
    for (const seed of SEEDS) {
      const plan = planValley(seed);
      let top = plan.height;
      let bottom = 0;
      for (let i = 0; i < plan.ring.length; i++) {
        if (!plan.ring[i]) continue;
        top = Math.min(top, Math.floor(i / plan.width));
        bottom = Math.max(bottom, Math.floor(i / plan.width));
      }
      expect(Math.abs((plan.camp.y - 0.5 - top) / (bottom - top) - 0.75)).toBeLessThan(0.01);
    }
  });
});
