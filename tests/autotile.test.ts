import { describe, expect, it } from "vitest";
import { autotileIndex, E, FILL, N, NE, NW, S, SE, SW, W } from "../src/render/packs/autotile.ts";

const ALL_SIDES = N | E | S | W;
const ALL_CORNERS = NE | SE | SW | NW;

describe("autotileIndex", () => {
  it("reproduces the 3x3 side table read from the tileset", () => {
    // (sides that continue) -> tile index, exactly as decoded from the dirt block
    const table: [number, number][] = [
      [E | S, 0],
      [E | S | W, 1],
      [S | W, 2],
      [N | E | S, 3],
      [ALL_SIDES | ALL_CORNERS, 4],
      [N | S | W, 5],
      [N | E, 6],
      [N | E | W, 7],
      [N | W, 8],
    ];
    for (const [mask, expected] of table) expect(autotileIndex(mask)).toBe(expected);
  });

  it("picks an inner corner when all sides continue but one diagonal does not", () => {
    expect(autotileIndex(ALL_SIDES | (ALL_CORNERS & ~NW))).toBe(9);
    expect(autotileIndex(ALL_SIDES | (ALL_CORNERS & ~NE))).toBe(10);
    expect(autotileIndex(ALL_SIDES | (ALL_CORNERS & ~SW))).toBe(12);
    expect(autotileIndex(ALL_SIDES | (ALL_CORNERS & ~SE))).toBe(13);
  });

  it("uses the diagonal-pair tiles when two opposite corners are missing", () => {
    expect(autotileIndex(ALL_SIDES | NE | SW)).toBe(11);
    expect(autotileIndex(ALL_SIDES | NW | SE)).toBe(14);
  });

  it("ignores diagonals when a side is open", () => {
    // A corner tile already has grass on two sides; the diagonals cannot change it.
    expect(autotileIndex(E | S)).toBe(0);
    expect(autotileIndex(E | S | ALL_CORNERS)).toBe(0);
  });

  it("falls back to fill for shapes a 15-tile set cannot express", () => {
    expect(autotileIndex(0)).toBe(FILL); // isolated
    expect(autotileIndex(N)).toBe(FILL); // dead end
    expect(autotileIndex(N | S)).toBe(FILL); // one-tile-wide vertical strip
    expect(autotileIndex(E | W)).toBe(FILL); // one-tile-wide horizontal strip
  });

  it("always returns a valid index", () => {
    for (let mask = 0; mask < 256; mask++) {
      const i = autotileIndex(mask);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(15);
    }
  });
});
