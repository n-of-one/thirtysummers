import { describe, expect, it } from "vitest";
import {
  autotileIndex,
  E,
  N,
  NARROW_E,
  NARROW_EW,
  NARROW_N,
  NARROW_NONE,
  NARROW_NS,
  NARROW_S,
  NARROW_W,
  NE,
  NW,
  S,
  SE,
  SW,
  TILE_COUNT,
  W,
} from "../src/render/packs/autotile.ts";

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

  it("names the narrow shapes a 15-tile set cannot express", () => {
    expect(autotileIndex(0)).toBe(NARROW_NONE); // nothing adjacent
    expect(autotileIndex(N)).toBe(NARROW_N); // dead end, joined northwards
    expect(autotileIndex(E)).toBe(NARROW_E);
    expect(autotileIndex(S)).toBe(NARROW_S);
    expect(autotileIndex(W)).toBe(NARROW_W);
    expect(autotileIndex(N | S)).toBe(NARROW_NS); // one-tile-wide vertical strip
    expect(autotileIndex(E | W)).toBe(NARROW_EW); // one-tile-wide horizontal strip
  });

  it("ignores diagonals on the narrow shapes too", () => {
    // A dead end is already open on three sides; a diagonal cannot change it.
    expect(autotileIndex(N | ALL_CORNERS)).toBe(NARROW_N);
    expect(autotileIndex(E | W | ALL_CORNERS)).toBe(NARROW_EW);
  });

  it("gives every one of the sixteen side shapes its own tile", () => {
    const seen = new Set<number>();
    for (let sides = 0; sides < 16; sides++) seen.add(autotileIndex(sides));
    expect(seen.size).toBe(16);
  });

  it("always returns a valid index", () => {
    for (let mask = 0; mask < 256; mask++) {
      const i = autotileIndex(mask);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(TILE_COUNT);
    }
  });
});
