import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { dryBrightness, fade, isLandmark, mapMarks, tileColour } from "../src/ui/mapPicture.ts";
import { drinkPointer, drinkTarget, minimapRadius, nearDrinks, wholeArtPx } from "../src/ui/mapWidget.ts";
import { seenRadiusTiles } from "../src/sim/stats.ts";

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

describe("the corner map running dry", () => {
  const R = (C.MAP_DIAMETER_TILES - 1) / 2;
  const sees = (h: number) => Math.round(seenRadiusTiles(h));

  it("is the whole circle down to the fog's threshold, what the player sees from the catch-up point", () => {
    expect(minimapRadius(100)).toBe(R);
    expect(minimapRadius(C.HYDRATION_FOG_THRESHOLD)).toBe(R);
    expect(minimapRadius(C.HYDRATION_FOG_THRESHOLD - 1)).toBeLessThan(R);
    for (const h of [C.MAP_SHRINK_CATCH_UP_HYDRATION, 20, 10, 0]) expect(minimapRadius(h)).toBe(sees(h));
  });

  it("shrinks a whole ring at a time, never growing as it drains", () => {
    let last = R;
    for (let h = 100; h >= 0; h -= 0.5) {
      const r = minimapRadius(h);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeLessThanOrEqual(last);
      expect(last - r).toBeLessThanOrEqual(1);
      last = r;
    }
  });
});

describe("water on the corner map", () => {
  const R = (C.MAP_DIAMETER_TILES - 1) / 2;
  const BIG = 120;

  /** Grass with springs at `at`, the player at (60, 60), every spring seen unless told otherwise. */
  function valley(at: [number, number][], unseen: [number, number][] = []): World {
    const map = new TileMap(BIG, BIG);
    for (let y = 0; y < BIG; y++) for (let x = 0; x < BIG; x++) map.set(x, y, "grass");
    const w = new World({
      seed: 1,
      map,
      camp: { x: 60.5, y: 60.5 },
      nodes: [],
      springs: [...at, ...unseen].map(([x, y]) => ({ x, y })),
      reachable: new Uint8Array(BIG * BIG),
    });
    for (const [x, y] of at) w.seen[y * BIG + x] = 1;
    for (const [x, y] of unseen) w.seen[y * BIG + x] = 0;
    return w;
  }

  /** The pointer from (60, 60), with nothing held. */
  const pointer = (w: World) => drinkPointer(drinkTarget(w, 60, 60), 60, 60);

  it("lists every seen spot within the full circle, and none beyond it or unseen", () => {
    const w = valley([[70, 60], [60, 60 + R], [60 + R, 60 + 1]], [[65, 65]]);
    expect(nearDrinks(w, 60, 60)).toEqual([{ dx: 10, dy: 0 }, { dx: 0, dy: R }]);
  });

  it("points at the nearest seen spot beyond the circle, on the ring just outside it", () => {
    const w = valley([[60 + 50, 60], [60, 60 - 40]], [[60, 60 + 35]]);
    // The unseen spring is nearer, but only water seen before is pointed at.
    expect(pointer(w)).toEqual({ dx: 0, dy: -(R + 1) });
    // Whichever way it points, it touches the circle: outside it, with a cell
    // of the circle beside it towards the player.
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const w = valley([[60 + Math.round(Math.cos(a) * 45), 60 + Math.round(Math.sin(a) * 45)]]);
      const p = pointer(w)!;
      expect(p.dx * p.dx + p.dy * p.dy).toBeGreaterThan(R * R);
      expect(Math.max(Math.abs(p.dx), Math.abs(p.dy))).toBeLessThanOrEqual(R + 1);
      const touches = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(
        ([sx, sy]) => (p.dx + sx!) ** 2 + (p.dy + sy!) ** 2 <= R * R,
      );
      expect(touches).toBe(true);
    }
  });

  it("gives way to the spot itself once it is on the map, at the same bearing", () => {
    const outside = valley([[60, 60 - (R + 1)]]);
    expect(pointer(outside)).toEqual({ dx: 0, dy: -(R + 1) });
    const inside = valley([[60, 60 - R]]);
    expect(pointer(inside)).toBeNull();
    expect(nearDrinks(inside, 60, 60)).toEqual([{ dx: 0, dy: -R }]);
  });

  it("has nothing to point at before any water has been seen", () => {
    expect(pointer(valley([], [[70, 60]]))).toBeNull();
  });

  it("holds the spot it points at until another is the hold's tiles nearer", () => {
    // Two springs along a bank to the north, 8 apart, the player walking east
    // along it: each is nearest for half the walk.
    const w = valley([[56, 20], [64, 20]]);
    const held = { x: 56, y: 20 };
    // Just past the halfway point the other is nearer, but by less than 3.
    expect(drinkTarget(w, 61, 60, null)).toEqual({ x: 64, y: 20 });
    expect(drinkTarget(w, 61, 60, held)).toEqual(held);
    // Shuffling back and forth across the halfway point, a tile either side:
    // without the hold it would change every step; with it, never.
    const changes = (hold: boolean) => {
      let target = drinkTarget(w, 58, 60, null);
      let n = 0;
      for (let step = 0; step < 20; step++) {
        const next = drinkTarget(w, step % 2 === 0 ? 61 : 59, 60, hold ? target : null);
        if (next!.x !== target!.x) n++;
        target = next;
      }
      return n;
    };
    expect(changes(false)).toBe(20);
    expect(changes(true)).toBe(0);
  });

  it("lets go when another is nearer by the full hold", () => {
    const w = valley([[40, 60], [90, 60]]);
    expect(drinkTarget(w, 60, 60, { x: 90, y: 60 })).toEqual({ x: 40, y: 60 });
  });
});

describe("the whole map running dry", () => {
  const green = (c: number) => (c >> 8) & 0xff;

  it("keeps its brightness down to the fog's threshold, and has none left at zero, in steps", () => {
    expect(dryBrightness(100)).toBe(1);
    expect(dryBrightness(C.HYDRATION_FOG_THRESHOLD)).toBe(1);
    expect(dryBrightness(C.HYDRATION_FOG_THRESHOLD / 2)).toBeCloseTo(0.5, 1);
    expect(dryBrightness(0)).toBe(0);
    const levels = new Set<number>();
    for (let h = 0; h <= 100; h += 0.1) levels.add(dryBrightness(h));
    expect(levels.size).toBe(C.MAP_DRY_FADE_STEPS + 1);
  });

  it("fades a colour to the unseen blank, untouched at full and the blank at none", () => {
    expect(fade(C.MAP_COLORS.grass, 1)).toBe(C.MAP_COLORS.grass);
    expect(fade(C.MAP_COLORS.grass, 0)).toBe(C.MAP_COLORS.unseen);
    let last = green(C.MAP_COLORS.grass);
    for (let b = 0.95; b >= 0; b -= 0.05) {
      const now = green(fade(C.MAP_COLORS.grass, b));
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
  });

  it("fades as the eye sees it: half as bright is well below the numbers' halfway mark", () => {
    const halfway = (green(C.MAP_COLORS.grass) + green(C.MAP_COLORS.unseen)) / 2;
    expect(green(fade(C.MAP_COLORS.grass, 0.5))).toBeLessThan(halfway);
  });

  it("keeps the river, its bridges, thicket and every mark as landmarks, and nothing else", () => {
    const w = world();
    const marks = mapMarks(w);
    const at = (kind: TerrainKind) => {
      w.map.set(12, 12, kind);
      return isLandmark(w, marks, 12, 12);
    };
    expect(["stream", "bridge", "thicket"].map((k) => at(k as TerrainKind))).toEqual([true, true, true]);
    for (const k of ["grass", "underbrush", "denseUnderbrush", "mud", "tree", "sapling", "rock"] as const) {
      expect(at(k), k).toBe(false);
    }
    // Camp, a well, a spring.
    expect([isLandmark(w, marks, 5, 5), isLandmark(w, marks, 8, 8), isLandmark(w, marks, 9, 8)]).toEqual([
      true,
      true,
      true,
    ]);
  });
});

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

  it("draws camp, and every drinking spot alike, a well or a spring, but not what there is to pick", () => {
    const w = world();
    expect(colour(w, 5, 5)).toBe(C.MAP_COLORS.camp);
    expect(colour(w, 8, 8)).toBe(C.MAP_COLORS.drink);
    expect(colour(w, 9, 8)).toBe(C.MAP_COLORS.drink);
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
