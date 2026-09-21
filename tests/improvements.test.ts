import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { summarise } from "../src/sim/summary.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { ResourceKind, ResourceNode } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { hudModel } from "../src/ui/hud.ts";

const INTERACT: InputState = { ...NO_INPUT, interact: true };
const SIZE = 48;

/** Hold `input` for `seconds` of simulated time at the real tick rate. */
function hold(world: World, input: InputState, seconds: number): void {
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, input);
}

let nextId = 1;
const node = (kind: ResourceKind, x: number, y: number): ResourceNode => ({
  id: nextId++,
  kind,
  x,
  y,
  z: 0,
  harvested: false,
});

/**
 * A grass arena big enough to be far from water, the camp in a corner, and the
 * player at (24.5, 24.5) last walked east, so the tile ahead is (25, 24).
 */
function arena(paint: (map: TileMap) => void = () => {}, nodes: ResourceNode[] = []): World {
  const map = new TileMap(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) map.set(x, y, "grass");
  paint(map);
  const world = new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes,
    springs: [],
    reachable: new Uint8Array(SIZE * SIZE),
  });
  world.player.x = 24.5;
  world.player.y = 24.5;
  world.player.heading = { x: 1, y: 0 };
  return world;
}

const types = (world: World) => world.events.map((e) => e.type);

describe("felling a sapling", () => {
  const copse = () => arena((map) => map.set(25, 24, "sapling"));

  it("needs the axe, and says so once", () => {
    const world = copse();
    expect(world.availableAction()).toEqual({ type: "fell", x: 25, y: 24, blocked: "noAxe" });
    expect(hudModel(world).prompt).toMatchObject({ blocked: true });
    hold(world, INTERACT, C.FELL_TIME * 2);
    expect(world.map.get(25, 24)).toBe("sapling");
    expect(types(world)).toEqual(["blocked"]);
  });

  it("takes its full hold with the axe, and leaves grass and a log", () => {
    const world = copse();
    world.tools.add("axe");
    expect(world.availableAction()).toEqual({ type: "fell", x: 25, y: 24, blocked: null });

    hold(world, INTERACT, C.FELL_TIME - 2 * C.TICK_SEC);
    expect(world.map.get(25, 24)).toBe("sapling");
    expect(world.inventory.count("log")).toBe(0);

    hold(world, INTERACT, 3 * C.TICK_SEC);
    expect(world.map.get(25, 24)).toBe("grass");
    expect(world.map.isPassable(25, 24)).toBe(true);
    expect(world.inventory.count("log")).toBe(1);
    expect(world.inventory.carried).toBe(2);
    expect(summarise(world).saplingsFelled).toBe(1);
  });

  it("refuses when the pack has no room for a log's two slots", () => {
    const world = copse();
    world.tools.add("axe");
    world.inventory.add("ore", C.BACKPACK_CAPACITY - 1);
    expect(world.availableAction()).toEqual({
      type: "fell",
      x: 25,
      y: 24,
      blocked: "backpackFull",
    });
  });
});

describe("a node that takes two slots", () => {
  it("cannot be picked into a pack with one slot free", () => {
    const log = node("log", 24.5, 25.2);
    const world = arena(() => {}, [log]);
    world.inventory.add("ore", C.BACKPACK_CAPACITY - 1);
    expect(world.availableAction()).toMatchObject({ type: "harvest", blocked: "backpackFull" });
    world.inventory.remove("ore");
    expect(world.availableAction()).toMatchObject({ type: "harvest", blocked: null });
  });
});

describe("digging a well", () => {
  function stocked(paint?: (map: TileMap) => void): World {
    const world = arena(paint);
    world.recipes.add("well");
    world.inventory.add("log", C.WELL_LOGS);
    world.inventory.add("stick", C.WELL_STICKS);
    world.buildMode = "well";
    return world;
  }

  it("is not on the menu until it is known", () => {
    const world = arena();
    world.inventory.add("log", C.WELL_LOGS);
    world.inventory.add("stick", C.WELL_STICKS);
    expect(world.buildOptions().map((o) => o.build)).toEqual(["bridge"]);
    world.recipes.add("well");
    expect(world.buildOptions().map((o) => o.build)).toEqual(["bridge", "well"]);
  });

  it("is a hold that spends the materials and makes a drinking spot", () => {
    const world = stocked();
    expect(world.availableAction()).toEqual({ type: "dig", x: 25, y: 24, blocked: null });
    hold(world, INTERACT, C.WELL_TIME + C.TICK_SEC);
    expect(world.springs).toEqual([{ x: 25, y: 24, well: true }]);
    expect(world.inventory.carried).toBe(0);
    expect(types(world)).toEqual(["dug"]);

    // It drinks like any spring.
    world.stats.hydration = 20;
    hold(world, NO_INPUT, C.TICK_SEC);
    expect(world.availableAction()).toEqual({ type: "drink", x: 25, y: 24, blocked: null });
    hold(world, INTERACT, C.DRINK_TIME + C.TICK_SEC);
    // Full on the tick it drank, less a tick of drain since.
    expect(world.stats.hydration).toBeGreaterThan(C.HYDRATION_MAX - 1);
    expect(types(world)).toContain("drank");
  });

  it("refuses within the clearance of a stream, and says why", () => {
    const near = C.WELL_WATER_CLEARANCE;
    const world = stocked((map) => map.set(25 + near, 24, "stream"));
    expect(world.availableAction()).toEqual({ type: "dig", x: 25, y: 24, blocked: "nearWater" });
    hold(world, INTERACT, C.WELL_TIME * 2);
    expect(world.springs).toEqual([]);
    expect(types(world)).toEqual(["blocked"]);
  });

  it("is allowed one tile past the clearance", () => {
    const far = C.WELL_WATER_CLEARANCE + 1;
    const world = stocked((map) => map.set(25 + far, 24, "stream"));
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: null });
  });

  it("refuses near another spring or well", () => {
    const world = stocked();
    world.springs.push({ x: 25, y: 24 - C.WELL_WATER_CLEARANCE });
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: "nearWater" });
  });

  it("is refused on a tile something already stands on", () => {
    const world = stocked();
    // A node already picked still holds its tile: it grows back next summer.
    const picked = node("fruit", 25.5, 24.5);
    picked.harvested = true;
    world.nodes.push(picked);
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: "occupied" });
  });

  it("is refused on anything but open grass", () => {
    const world = stocked((map) => map.set(25, 24, "mud"));
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: "wrongGround" });
  });

  it("is refused without the materials, and says what it needs", () => {
    const world = stocked();
    world.inventory.remove("log");
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: "noMaterials" });
    expect(hudModel(world).prompt?.text).toBe(
      `A well needs ${C.WELL_STICKS} stick and ${C.WELL_LOGS} log`,
    );
  });
});

describe("the build menu", () => {
  it("lists what is known, with whether the pack can pay for it", () => {
    const world = arena();
    world.recipes.add("well");
    expect(world.buildOptions()).toEqual([
      { build: "bridge", cost: { stick: C.BRIDGE_STICKS, vine: C.BRIDGE_VINES }, affordable: false },
      { build: "well", cost: { log: C.WELL_LOGS, stick: C.WELL_STICKS }, affordable: false },
    ]);

    world.inventory.add("stick", C.BRIDGE_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    const affordable = world.buildOptions().filter((o) => o.affordable).map((o) => o.build);
    expect(affordable).toEqual(["bridge"]);
  });

  it("builds nothing until something is chosen", () => {
    const world = arena();
    world.inventory.add("stick", C.BRIDGE_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    // Carrying the materials is not choosing to build: grass says nothing.
    expect(world.availableAction()).toBeNull();
    expect(hudModel(world).prompt).toBeNull();
  });

  it("says nothing about building until the water's edge, and nothing there once chosen", () => {
    const world = arena((map) => map.set(25, 24, "stream"));
    expect(world.buildHint()).toBe("bridge");
    world.player.heading = { x: 0, y: 1 };
    expect(world.buildHint()).toBeNull();
    world.player.heading = { x: 1, y: 0 };
    world.buildMode = "bridge";
    expect(world.buildHint()).toBeNull();
  });

  it("builds only what was chosen, and refuses it on the wrong ground", () => {
    const world = arena((map) => map.set(25, 24, "stream"));
    world.recipes.add("well");
    world.inventory.add("stick", C.WELL_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    world.inventory.add("log", C.WELL_LOGS);
    // A well and a bridge are both paid for, so the choice is what decides,
    // not the ground.
    world.buildMode = "well";
    expect(world.availableAction()).toMatchObject({ type: "dig", blocked: "wrongGround" });
    world.buildMode = "bridge";
    expect(world.availableAction()).toMatchObject({ type: "build", blocked: null });
    hold(world, INTERACT, C.BUILD_TIME + C.TICK_SEC);
    expect(world.map.get(25, 24)).toBe("bridge");
  });

  it("is put down at the end of a summer", () => {
    const world = arena();
    world.buildMode = "bridge";
    world.endSummer();
    world.nextSummer();
    expect(world.buildMode).toBeNull();
  });
});

describe("what is owned", () => {
  it("starts with the knife and no recipe, and a summer hands nothing over", () => {
    const world = arena();
    expect([...world.tools]).toEqual(["knife"]);
    expect([...world.recipes]).toEqual([]);
    expect(types(world)).toEqual([]);
    world.nextSummer();
    world.nextSummer();
    expect([...world.tools]).toEqual(["knife"]);
    expect(hudModel(world).tools).toBe("knife");
  });
});
