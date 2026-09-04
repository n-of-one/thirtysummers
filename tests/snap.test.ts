import { describe, expect, it } from "vitest";
import { snapToward } from "../src/render/propLayer.ts";

/**
 * The player sprite is drawn unsnapped while it moves and eased onto the asset
 * grid once it stops. These cover the property that made the plain nearest-
 * rounding version feel wrong: a settle must never undo travel.
 */
describe("snapToward", () => {
  const SCALE = 8; // screen px per asset px at TILE 64 / 8px art
  const ANCHOR = 0; // anchor offsets are exercised separately below

  it("finishes the crossing instead of rounding a step away", () => {
    // One screen pixel into the next asset pixel, heading right: the settle
    // must carry the remaining seven, not slide the one back.
    expect(snapToward(1, ANCHOR, SCALE, +1)).toBe(8);
    expect(snapToward(1, ANCHOR, SCALE, -1)).toBe(0);
  });

  it("never moves against the direction of travel", () => {
    for (let phase = 0; phase < SCALE * 4; phase++) {
      const value = phase * 0.25;
      expect(snapToward(value, ANCHOR, SCALE, +1)).toBeGreaterThanOrEqual(value);
      expect(snapToward(value, ANCHOR, SCALE, -1)).toBeLessThanOrEqual(value);
    }
  });

  it("moves by less than one asset pixel", () => {
    for (let phase = 0; phase < SCALE * 4; phase++) {
      const value = phase * 0.25;
      for (const dir of [+1, -1, 0]) {
        expect(Math.abs(snapToward(value, ANCHOR, SCALE, dir) - value)).toBeLessThan(SCALE);
      }
    }
  });

  it("leaves a position already on the grid alone, whichever way it came", () => {
    for (const dir of [+1, -1, 0]) {
      expect(snapToward(0, ANCHOR, SCALE, dir)).toBe(0);
      expect(snapToward(24, ANCHOR, SCALE, dir)).toBe(24);
      // Float error must not be read as "a hair past the line".
      expect(snapToward(24 + 1e-9, ANCHOR, SCALE, dir)).toBeCloseTo(24, 6);
    }
  });

  it("still rounds to nearest before the player has ever moved", () => {
    expect(snapToward(1, ANCHOR, SCALE, 0)).toBe(0);
    expect(snapToward(7, ANCHOR, SCALE, 0)).toBe(8);
  });

  it("snaps relative to the anchor, not the sprite corner", () => {
    // A measured anchor is rarely a whole number of scaled pixels; the grid the
    // art actually lands on is offset by that remainder.
    const anchor = 108; // 108 mod 8 = 4
    for (const dir of [+1, -1]) {
      const out = snapToward(30, anchor, SCALE, dir);
      expect((out - anchor) % SCALE).toBeCloseTo(0, 9);
    }
    expect(snapToward(30, anchor, SCALE, +1)).toBe(36);
    expect(snapToward(30, anchor, SCALE, -1)).toBe(28);
  });
});
