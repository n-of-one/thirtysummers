import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { RESOURCES } from "../src/sim/resources.ts";
import { layoutSummerWorld } from "../src/sim/worldgen/layout.ts";
import { checkRows, cutsFromCamp, THIN_CUTS, waterDistance } from "../src/sim/worldgen/rows.ts";
import { formatMap, parseMap } from "../src/sim/mapfile.ts";
import type { GeneratedWorld } from "../src/sim/worldgen.ts";

/**
 * A handful of seeds rather than one: the layout is jittered and mirrored by
 * the seed, so one seed proves only that one arrangement holds.
 */
const SEEDS = [1337, 2026, 31, 555, 808, 7, 99];

describe("the five-summer layout", () => {
  it.each(SEEDS)("holds every row of the table (seed %i)", (seed) => {
    const rows = checkRows(layoutSummerWorld(seed));
    expect(rows.filter((row) => !row.ok).map((row) => `${row.summer}: ${row.label} (${row.detail})`))
      .toEqual([]);
  });

  it("is the same map for the same seed, and another for another", () => {
    expect(formatMap(layoutSummerWorld(42))).toBe(formatMap(layoutSummerWorld(42)));
    expect(formatMap(layoutSummerWorld(42))).not.toBe(formatMap(layoutSummerWorld(43)));
  });

  it("round trips through the map file, which is what the shipped maps are", () => {
    const world = layoutSummerWorld(1337);
    const parsed = parseMap(formatMap(world));
    expect(formatMap(parsed)).toBe(formatMap(world));
    expect(parsed.springs).toEqual(world.springs);
  });

  it.each(SEEDS)("puts every node on the ground its glyph implies (seed %i)", (seed) => {
    const world = layoutSummerWorld(seed);
    for (const node of world.nodes) {
      expect(world.map.get(Math.floor(node.x), Math.floor(node.y))).toBe(RESOURCES[node.kind].ground);
    }
  });

  it.each(SEEDS)("gives the first summer a near ring to explore (seed %i)", (seed) => {
    const world = layoutSummerWorld(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    let walkable = 0;
    for (let i = 0; i < onFoot.length; i++) if (onFoot[i] === 0) walkable++;
    // The ring it replaced was a half circle of radius 20 with the strip below
    // camp, about a thousand tiles gross and some 850 of them walkable. Six
    // times that is what this asks for.
    expect(walkable).toBeGreaterThan(850 * 6);
  });

  it.each(SEEDS)("spreads the near ring's nodes out rather than clumping them (seed %i)", (seed) => {
    const world = layoutSummerWorld(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    const inRing = world.nodes.filter(
      (n) =>
        (n.kind === "fruit" || n.kind === "feather") &&
        onFoot[Math.floor(n.y) * world.map.width + Math.floor(n.x)] === 0,
    );
    expect(inRing.length).toBe(C.LAYOUT_NODES.nearRingFruit + C.LAYOUT_NODES.nearRingFeathers);
    for (const a of inRing) {
      for (const b of inRing) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(C.NEAR_RING_SPACING);
      }
    }
  });

  it.each(SEEDS)("leaves the vines open to wade to, and walls the sticks (seed %i)", (seed) => {
    const world = layoutSummerWorld(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    const cut = cutsFromCamp(world, { bridge: false, fell: false });
    const reach = (w: GeneratedWorld, cost: Float64Array, kind: string, cuts: number) =>
      w.nodes.filter(
        (n) => n.kind === kind && cost[Math.floor(n.y) * w.map.width + Math.floor(n.x)]! <= cuts,
      ).length;

    expect(reach(world, onFoot, "vine", 0)).toBe(C.LAYOUT_NODES.pocketVines);
    expect(reach(world, onFoot, "stick", 0)).toBe(0);
    expect(reach(world, cut, "stick", THIN_CUTS)).toBe(C.LAYOUT_NODES.standSticks);
  });

  it.each(SEEDS)("keeps the shells of the dry pocket away from water (seed %i)", (seed) => {
    const world = layoutSummerWorld(seed);
    const felled = cutsFromCamp(world, { bridge: true, fell: true });
    const reached = world.nodes.filter(
      (n) =>
        n.kind === "shell" &&
        felled[Math.floor(n.y) * world.map.width + Math.floor(n.x)]! <= THIN_CUTS,
    );
    expect(reached.length).toBe(C.LAYOUT_NODES.dryPocketShells);
    for (const shell of reached) {
      expect(waterDistance(world, Math.floor(shell.x), Math.floor(shell.y))).toBeGreaterThan(
        C.WELL_WATER_CLEARANCE,
      );
    }
  });
});
