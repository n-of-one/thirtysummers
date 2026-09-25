import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT } from "../src/input/keyboard.ts";
import { markCircle, packSeen, unpackSeen } from "../src/sim/seen.ts";
import { seenRadiusTiles, sightRadiusTiles } from "../src/sim/stats.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import { World } from "../src/sim/world.ts";

const SIZE = 80;

/** Open grass, camp in the middle. */
function world(): World {
  const map = new TileMap(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) map.set(x, y, "grass");
  return new World({
    seed: 1,
    map,
    camp: { x: 40.5, y: 40.5 },
    nodes: [],
    springs: [],
    reachable: new Uint8Array(SIZE * SIZE),
  });
}

/** The tiles a circle of `radius` round (tx, ty) covers, counted the slow way. */
function circle(tx: number, ty: number, radius: number, width = SIZE, height = SIZE): Set<number> {
  const tiles = new Set<number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x - tx) ** 2 + (y - ty) ** 2 <= radius * radius) tiles.add(y * width + x);
    }
  }
  return tiles;
}

const setTiles = (mask: Uint8Array) => new Set([...mask.keys()].filter((i) => mask[i] === 1));

describe("sightRadiusTiles", () => {
  it("rings the view at its widest from full hydration down to the threshold", () => {
    expect(sightRadiusTiles(100)).toBe(C.FOG_MAX_RADIUS_TILES);
    expect(sightRadiusTiles(C.HYDRATION_FOG_THRESHOLD)).toBe(C.FOG_MAX_RADIUS_TILES);
  });

  it("closes from the widest circle to a few tiles at zero", () => {
    expect(sightRadiusTiles(C.HYDRATION_FOG_THRESHOLD - 1e-9)).toBeCloseTo(C.FOG_MAX_RADIUS_TILES, 6);
    expect(sightRadiusTiles(0)).toBe(C.FOG_MIN_RADIUS_TILES);
  });

  it("shrinks steadily as hydration falls", () => {
    const radii = [35, 25, 15, 5, 0].map(sightRadiusTiles);
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeLessThan(radii[i - 1]!);
  });

  it("sees 14 tiles at full hydration, and shrinks with the fog", () => {
    expect(seenRadiusTiles(100)).toBe(14);
    expect(seenRadiusTiles(0)).toBeCloseTo(C.FOG_MIN_RADIUS_TILES * C.SEEN_RADIUS_MUL, 10);
  });
});

describe("markCircle", () => {
  it("sets exactly the tiles whose centres are within the radius", () => {
    for (const r of [0, 1, 4.2, 15]) {
      const mask = new Uint8Array(SIZE * SIZE);
      const added = markCircle(mask, SIZE, SIZE, 40, 30, r);
      expect(setTiles(mask)).toEqual(circle(40, 30, r));
      expect(added).toBe(circle(40, 30, r).size);
    }
  });

  it("clips at the edge of the map", () => {
    const mask = new Uint8Array(SIZE * SIZE);
    markCircle(mask, SIZE, SIZE, 1, SIZE - 2, 15);
    expect(setTiles(mask)).toEqual(circle(1, SIZE - 2, 15));
  });

  it("counts only the tiles it newly set", () => {
    const mask = new Uint8Array(SIZE * SIZE);
    markCircle(mask, SIZE, SIZE, 40, 40, 5);
    const both = new Set([...circle(40, 40, 5), ...circle(43, 40, 5)]);
    expect(markCircle(mask, SIZE, SIZE, 43, 40, 5)).toBe(both.size - circle(40, 40, 5).size);
  });
});

describe("packSeen", () => {
  const roundTrip = (mask: Uint8Array) => {
    const back = new Uint8Array(mask.length).fill(1);
    const count = unpackSeen(packSeen(mask), back);
    expect(back).toEqual(mask);
    expect(count).toBe(setTiles(mask).size);
  };

  it("round trips an empty mask, a full one and a ragged one", () => {
    roundTrip(new Uint8Array(500));
    roundTrip(new Uint8Array(500).fill(1));
    const ragged = new Uint8Array(SIZE * SIZE);
    markCircle(ragged, SIZE, SIZE, 0, 0, 7);
    markCircle(ragged, SIZE, SIZE, 50, 60, 12);
    ragged[SIZE * SIZE - 1] = 1;
    roundTrip(ragged);
  });

  it("is one number for an empty mask, and starts with an empty run when the first tile is seen", () => {
    expect(packSeen(new Uint8Array(500))).toEqual([500]);
    expect(packSeen(Uint8Array.of(1, 1, 0))).toEqual([0, 2, 1]);
  });
});

describe("the world's seen tiles", () => {
  it("are the middle of the corner map, which shows twice their radius", () => {
    expect((C.MAP_DIAMETER_TILES - 1) / 2).toBe(2 * seenRadiusTiles(100));
  });

  it("start with the circle round camp", () => {
    const w = world();
    expect(setTiles(w.seen)).toEqual(circle(40, 40, seenRadiusTiles(100)));
    expect(w.seenCount).toBe(w.seen.reduce((a, b) => a + b, 0));
  });

  it("grow as the player walks, by the circle round each tile crossed", () => {
    const w = world();
    const expected = circle(40, 40, seenRadiusTiles(100));
    const right = { ...NO_INPUT, moveX: 1 };
    while (w.player.x < 60) {
      w.step(C.TICK_SEC, right);
      for (const i of circle(Math.floor(w.player.x), 40, seenRadiusTiles(w.stats.hydration))) expected.add(i);
    }
    expect(setTiles(w.seen)).toEqual(expected);
    expect(w.seenCount).toBe(expected.size);
  });

  it("see less when dry", () => {
    const w = world();
    w.stats.hydration = 0;
    w.teleport(10.5, 10.5);
    const round = circle(10, 10, seenRadiusTiles(0));
    const all = setTiles(w.seen);
    expect([...round].every((i) => all.has(i))).toBe(true);
    expect([...circle(10, 10, seenRadiusTiles(100))].some((i) => !all.has(i))).toBe(true);
  });

  it("widen again at a drink on the same tile", () => {
    const w = world();
    w.stats.hydration = 0;
    w.teleport(10.5, 10.5);
    w.stats.drink();
    w.step(C.TICK_SEC, NO_INPUT);
    expect([...circle(10, 10, seenRadiusTiles(100))].every((i) => w.seen[i] === 1)).toBe(true);
  });

  it("are only where a teleport lands, not the ground between", () => {
    const w = world();
    w.teleport(75.5, 75.5);
    expect(w.seen[40 * SIZE + 60]).toBe(0);
    expect(w.seen[75 * SIZE + 75]).toBe(1);
  });

  it("are kept over a winter", () => {
    const w = world();
    w.teleport(75.5, 75.5);
    const before = w.seen.slice();
    w.endSummer();
    w.endWinter(w.winterInput(), new Set());
    w.nextSummer();
    expect([...before.keys()].every((i) => before[i] === 0 || w.seen[i] === 1)).toBe(true);
    expect(w.seenCount).toBe(setTiles(w.seen).size);
  });
});
