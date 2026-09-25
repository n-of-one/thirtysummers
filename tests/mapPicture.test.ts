import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { mapMarks, tileColour } from "../src/ui/mapPicture.ts";
import { wholeArtPx } from "../src/ui/mapWidget.ts";

const SIZE = 40;

function world(): World {
  const map = new TileMap(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) map.set(x, y, "grass");
  return new World({
    seed: 1,
    map,
    camp: { x: 5.5, y: 5.5 },
    nodes: [{ id: 0, kind: "feather", x: 7.5, y: 5.5, z: 0, harvested: false }],
    springs: [{ x: 8, y: 8, well: true }, { x: 9, y: 8 }],
    reachable: new Uint8Array(SIZE * SIZE),
  });
}

const colour = (w: World, x: number, y: number) => tileColour(w, mapMarks(w), x, y);

describe("the whole map's size", () => {
  const HD = { width: 1920, height: 1080 };
  it("takes the most art pixels a tile that fit the view", () => {
    // 200 by 180 at 4 logical pixels an art pixel: 1 fits, 2 would be 1440 tall.
    expect(wholeArtPx(200, 180, 4, HD)).toBe(1);
    // The placeholder's art pixel is 2: 3 of them a tile is exactly 1080 tall.
    expect(wholeArtPx(200, 180, 2, HD)).toBe(3);
  });

  it("never goes past the cap, or below one art pixel", () => {
    expect(wholeArtPx(20, 20, 4, HD)).toBe(C.MAP_WHOLE_MAX_ART_PX);
    expect(wholeArtPx(2000, 2000, 4, HD)).toBe(1);
  });
});

describe("the map picture", () => {
  it("draws each ground in its class, trees and saplings alike", () => {
    const w = world();
    const cases: [TerrainKind, number][] = [
      ["grass", C.MAP_COLORS.grass],
      ["underbrush", C.MAP_COLORS.underbrush],
      ["denseUnderbrush", C.MAP_COLORS.denseUnderbrush],
      ["mud", C.MAP_COLORS.mud],
      ["stream", C.MAP_COLORS.stream],
      ["tree", C.MAP_COLORS.tree],
      ["sapling", C.MAP_COLORS.tree],
      ["rock", C.MAP_COLORS.rock],
      ["thicket", C.MAP_COLORS.thicket],
      ["bridge", C.MAP_COLORS.bridge],
    ];
    for (const [kind, want] of cases) {
      w.map.set(10, 5, kind);
      expect(colour(w, 10, 5), kind).toBe(want);
    }
  });

  it("draws worn underbrush as underbrush: trails are not drawn", () => {
    const w = world();
    w.map.set(10, 5, "underbrush");
    for (let stage = 0; stage <= C.TRAIL_STAGES; stage++) {
      w.wear[5 * SIZE + 10] = stage;
      expect(colour(w, 10, 5)).toBe(C.MAP_COLORS.underbrush);
    }
  });

  it("draws camp and wells, and not springs or what else there is to pick", () => {
    const w = world();
    expect(colour(w, 5, 5)).toBe(C.MAP_COLORS.camp);
    expect(colour(w, 8, 8)).toBe(C.MAP_COLORS.well);
    expect(colour(w, 9, 8)).toBe(C.MAP_COLORS.grass);
    expect(colour(w, 7, 5)).toBe(C.MAP_COLORS.grass);
  });

  it("draws a fruit tree as a 2 by 2 block from its trunk, picked or not, and not its fruit", () => {
    const w = world();
    w.map.set(10, 9, "tree");
    const fruit = { id: 1, kind: "fruit" as const, x: 9.5, y: 10.5, z: 0, harvested: false };
    w.nodes.push(fruit);
    const block = () => [colour(w, 10, 9), colour(w, 11, 9), colour(w, 10, 10), colour(w, 11, 10)];
    expect(block()).toEqual(Array(4).fill(C.MAP_COLORS.fruitTree));
    expect(colour(w, 9, 10)).toBe(C.MAP_COLORS.grass);
    fruit.harvested = true;
    expect(block()).toEqual(Array(4).fill(C.MAP_COLORS.fruitTree));
  });

  it("does not mark a tree with no fruit beside it", () => {
    const w = world();
    w.map.set(15, 8, "tree");
    expect(colour(w, 15, 8)).toBe(C.MAP_COLORS.tree);
  });

  it("draws nothing where the family has not been, or off the map", () => {
    const w = world();
    expect(w.seen[35 * SIZE + 35]).toBe(0);
    expect(colour(w, 35, 35)).toBeNull();
    expect(colour(w, -1, 5)).toBeNull();
    expect(colour(w, SIZE, 5)).toBeNull();
  });
});
