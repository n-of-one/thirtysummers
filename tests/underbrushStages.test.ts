import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { decodeSave, encodeSave } from "../src/sim/save.ts";
import { summarise } from "../src/sim/summary.ts";
import { layoutSummerWorld, underbrushStage } from "../src/sim/worldgen.ts";
import { World } from "../src/sim/world.ts";

describe("underbrush in stages from the noise", () => {
  it("reads each band of the forest noise as its stage", () => {
    const bands = C.UNDERBRUSH_THRESHOLDS;
    bands.forEach((band, i) => {
      const next = bands[i + 1]?.from ?? band.from + 0.05;
      expect(underbrushStage((band.from + next) / 2)).toBe(band.stage);
    });
    expect(underbrushStage(C.TREE_THRESHOLD)).toBe(bands.at(-1)!.stage);
  });

  it("gives a seed thin underbrush, and a stage only to underbrush", () => {
    const world = layoutSummerWorld(1337);
    const stages = world.underbrushStages!;
    let thin = 0;
    for (let i = 0; i < stages.length; i++) {
      if (stages[i] === 0) continue;
      thin++;
      expect(world.map.get(i % world.map.width, Math.floor(i / world.map.width))).toBe("underbrush");
    }
    expect(thin).toBeGreaterThan(0);
  });

  it("puts the thin underbrush at the edges, next to grass, more than the full", () => {
    const world = layoutSummerWorld(1337);
    const { map } = world;
    const stages = world.underbrushStages!;
    const touches = { thin: 0, thinAll: 0, full: 0, fullAll: 0 };
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.get(x, y) !== "underbrush") continue;
        const byGrass = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.get(x + dx!, y + dy!) === "grass");
        if (stages[y * map.width + x]! > 0) {
          touches.thinAll++;
          if (byGrass) touches.thin++;
        } else {
          touches.fullAll++;
          if (byGrass) touches.full++;
        }
      }
    }
    expect(touches.thin / touches.thinAll).toBeGreaterThan((2 * touches.full) / touches.fullAll);
  });
});

describe("a world that starts with thin underbrush", () => {
  it("starts its wear from the stages, with thin tiles walked faster", () => {
    const world = World.fromSeed(1337);
    const i = [...world.wear.keys()].find((j) => world.wear[j] === 1)!;
    const x = i % world.map.width;
    const y = Math.floor(i / world.map.width);
    expect(world.trailStage(x, y)).toBe(1);
    expect(world.teleport(x + 0.5, y + 0.5)).toBe(true);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.TRAIL_SPEED_MULS[0]);
  });

  it("saves only what walking changed, and loads the stages back", () => {
    const world = World.fromSeed(1337);
    world.endSummer();
    const save = world.snapshot(summarise(world));
    expect(save.worn).toEqual([]);

    const restored = World.fromSeed(1337);
    restored.restore(decodeSave(encodeSave(save)));
    expect([...restored.wear]).toEqual([...world.wear]);
  });
});
