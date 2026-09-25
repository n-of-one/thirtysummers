import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { formatMap } from "../src/sim/mapfile.ts";
import { decodeSave, encodeSave, SaveError, type SaveState } from "../src/sim/save.ts";
import { summarise } from "../src/sim/summary.ts";
import { World } from "../src/sim/world.ts";
import { layoutSummerWorld } from "../src/sim/worldgen/layout.ts";

const INTERACT: InputState = { ...NO_INPUT, interact: true };

function hold(world: World, seconds: number): void {
  world.step(C.TICK_SEC, NO_INPUT);
  for (let i = 0; i < Math.round(seconds / C.TICK_SEC); i++) world.step(C.TICK_SEC, INTERACT);
  world.step(C.TICK_SEC, NO_INPUT);
}

/** Find a tile of `kind` with walkable ground on one side, and aim at it from there. */
function aimAt(world: World, kind: string): { x: number; y: number } {
  const { map } = world;
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.get(x, y) !== kind) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!world.teleport(x - dx + 0.5, y - dy + 0.5)) continue;
        world.player.heading = { x: dx, y: dy };
        return { x, y };
      }
    }
  }
  throw new Error(`no ${kind} to aim at`);
}

/** A summer with a bit of everything in it: picks, a cut, a fell, a bridge, a drop. */
function played(): World {
  const world = World.fromSeed(1337);
  world.tools.add("axe");
  for (const node of world.nodes.filter((n) => n.kind === "feather").slice(0, 12)) {
    world.teleport(node.x, node.y);
    hold(world, C.HARVEST_TIME + 0.1);
    world.teleport(world.camp.x, world.camp.y);
    hold(world, C.TICK_SEC);
  }
  const cut = aimAt(world, "thicket");
  hold(world, C.CUT_TIME + 0.1);
  expect(world.map.get(cut.x, cut.y)).toBe(C.CUT_LEAVES);
  const felled = aimAt(world, "sapling");
  hold(world, C.FELL_TIME + 0.1);
  expect(world.map.get(felled.x, felled.y)).toBe("grass");
  world.inventory.add("stick", 1);
  world.inventory.add("vine", 1);
  world.buildMode = "bridge";
  const bridge = aimAt(world, "stream");
  hold(world, C.BUILD_TIME + 0.1);
  expect(world.map.get(bridge.x, bridge.y)).toBe("bridge");
  world.inventory.add("fruit", 3);
  world.dropSelected();
  world.store.add("fruit", 9);
  world.family = 12;
  world.list = [{ kind: "food" }, { kind: "item", id: "cart" }];
  world.endSummer();
  return world;
}

/**
 * Everything the next winter and summer read, as plain values. The summary is
 * passed in: a restored world has no event log to count it from, which is why
 * the save carries it.
 */
function state(world: World, summary: ReturnType<typeof summarise>) {
  return { map: dump(world), save: world.snapshot(summary) };
}

/** The map as a file: terrain, nodes, wells and camp. */
const dump = (w: World) =>
  formatMap({ seed: w.seed, map: w.map, camp: w.camp, nodes: w.nodes, springs: w.springs, reachable: new Uint8Array(0) });

describe("a saved game", () => {
  it("restores onto a fresh world from the same seed, exactly as it was saved", () => {
    const world = played();
    const summary = summarise(world);
    const text = encodeSave(world.snapshot(summary));
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);

    const restored = World.fromSeed(1337);
    const saved = decodeSave(text);
    restored.restore(saved);
    expect(restored.summerOver).toBe(true);
    expect(saved.summary).toEqual(summary);
    expect(state(restored, summary)).toEqual(state(world, summary));
    expect(restored.dropped).toEqual(world.dropped);
    expect(restored.seen).toEqual(world.seen);
    expect(restored.seenCount).toBe(world.seenCount);
  });

  it("goes on through the winter the same as the game it was saved from", () => {
    const world = played();
    const restored = World.fromSeed(1337);
    restored.restore(decodeSave(encodeSave(world.snapshot(summarise(world)))));
    for (const w of [world, restored]) {
      w.endWinter(w.winterInput(), new Set(["food", "rent", "level"]));
      w.nextSummer();
    }
    expect(dump(restored)).toEqual(dump(world));
    expect(restored.nodes.map((n) => n.harvested)).toEqual(world.nodes.map((n) => n.harvested));
    expect(restored.family).toBe(world.family);
    expect(restored.list).toEqual(world.list);
  });

  it("is refused on another map, and when it is not a save at all", () => {
    const world = played();
    const text = encodeSave(world.snapshot(summarise(world)));
    expect(() => World.fromSeed(1338).restore(decodeSave(text))).toThrow(SaveError);
    expect(() => decodeSave("not a save")).toThrow(SaveError);
    // A version 3 save has no seen tiles, and would bring the map back blank.
    const old = { ...world.snapshot(summarise(world)), v: 3 };
    expect(() => decodeSave(encodeSave(old as unknown as SaveState))).toThrow(SaveError);
  });

  it("is short enough to sit in a URL", () => {
    const world = played();
    expect(encodeSave(world.snapshot(summarise(world))).length).toBeLessThan(4000);
    // The map the save is made on is laid out from the seed, not carried.
    expect(layoutSummerWorld(1337).map.width).toBe(world.map.width);
  });
});
