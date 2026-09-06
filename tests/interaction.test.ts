import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { nearestNodeWithin, withinReach } from "../src/sim/interaction.ts";
import { summarise } from "../src/sim/summary.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { ResourceKind, ResourceNode } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";

let nextId = 1;
const node = (kind: ResourceKind, x: number, y: number): ResourceNode => ({
  id: nextId++,
  kind,
  x,
  y,
  z: 0,
  harvested: false,
});

/** Grass arena, camp in the far corner, and whatever nodes the test wants. */
function worldWith(nodes: ResourceNode[]): World {
  const map = new TileMap(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) map.set(x, y, "grass");
  const world = new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes,
    reachable: new Uint8Array(16 * 16),
  });
  // Away from camp unless a test says otherwise, so harvesting is what happens.
  world.player.x = 8.5;
  world.player.y = 8.5;
  return world;
}

const INTERACT: InputState = { ...NO_INPUT, interact: true };
const EAT: InputState = { ...NO_INPUT, eat: true };
const DRINK: InputState = { ...NO_INPUT, drink: true };

/** Hold `input` for `seconds` of simulated time at the real tick rate. */
function hold(world: World, input: InputState, seconds: number): void {
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, input);
}

/** Press and release, which is what an edge-triggered action needs. */
function tap(world: World, input: InputState): void {
  world.step(C.TICK_SEC, input);
  world.step(C.TICK_SEC, NO_INPUT);
}

const types = (world: World) => world.events.map((e) => e.type);

describe("nearestNodeWithin", () => {
  it("finds the closest node inside the radius and ignores the rest", () => {
    const near = node("ore", 5.5, 5.0);
    const far = node("fruit", 5.5, 9.0);
    const found = nearestNodeWithin([far, near], 5.5, 5.5);
    expect(found).toBe(near);
    expect(nearestNodeWithin([far], 5.5, 5.5)).toBeNull();
  });

  it("skips nodes already harvested", () => {
    const picked = node("ore", 5.5, 5.5);
    picked.harvested = true;
    expect(nearestNodeWithin([picked], 5.5, 5.5)).toBeNull();
  });

  it("breaks an exact tie the same way every time", () => {
    // Standing dead between two nodes must not flicker: that would reset the
    // harvest progress on every tick and make the hold impossible to finish.
    const west = node("ore", 4.5, 5.5);
    const east = node("ore", 6.5, 5.5);
    const pick = (list: ResourceNode[]) => nearestNodeWithin(list, 5.5, 5.5)?.id;
    expect(pick([west, east])).toBe(pick([east, west]));
  });

  it("measures reach from the player to the target centre", () => {
    expect(withinReach(5.5, 5.5, { x: 6.5, y: 5.5 })).toBe(true);
    expect(withinReach(5.5, 5.5, { x: 6.5, y: 6.5 })).toBe(false); // diagonal is 1.41
  });
});

describe("harvesting", () => {
  it("takes a held key and HARVEST_TIME to pick a node", () => {
    const fruit = node("fruit", 9.5, 8.5);
    const world = worldWith([fruit]);

    hold(world, INTERACT, C.HARVEST_TIME / 2);
    expect(fruit.harvested).toBe(false);
    expect(world.harvestProgress).toBeGreaterThan(0.4);
    expect(world.harvestProgress).toBeLessThan(0.6);

    hold(world, INTERACT, C.HARVEST_TIME);
    expect(fruit.harvested).toBe(true);
    expect(world.inventory.count("fruit")).toBe(1);
    expect(world.harvestProgress).toBe(0);
    expect(world.events).toEqual([
      { type: "harvested", kind: "fruit", at: expect.any(Number) },
    ]);
  });

  it("does nothing while the key is up", () => {
    const ore = node("ore", 9.5, 8.5);
    const world = worldWith([ore]);
    hold(world, NO_INPUT, 5);
    expect(ore.harvested).toBe(false);
    expect(world.harvestProgress).toBe(0);
  });

  it("throws the progress away when the key is released", () => {
    const world = worldWith([node("ore", 9.5, 8.5)]);
    hold(world, INTERACT, C.HARVEST_TIME * 0.9);
    expect(world.harvestProgress).toBeGreaterThan(0.8);
    world.step(C.TICK_SEC, NO_INPUT);
    expect(world.harvestProgress).toBe(0);
  });

  it("throws the progress away when you walk out of reach", () => {
    const world = worldWith([node("ore", 9.5, 8.5)]);
    hold(world, INTERACT, C.HARVEST_TIME * 0.9);
    world.player.x = 12.5;
    world.step(C.TICK_SEC, INTERACT);
    expect(world.harvestProgress).toBe(0);
    expect(world.availableAction()).toBeNull();
  });

  it("keeps going through a row of nodes on one continuous hold", () => {
    // Only the tap actions spend a press; harvesting does not, so clearing a
    // patch does not mean tapping once per node.
    const world = worldWith([node("ore", 9.5, 8.5), node("ore", 7.5, 8.5)]);
    hold(world, INTERACT, C.HARVEST_TIME * 2.2);
    expect(world.nodes.every((n) => n.harvested)).toBe(true);
    expect(world.inventory.count("ore")).toBe(2);
  });

  it("starts the next node from scratch rather than inheriting progress", () => {
    const first = node("ore", 9.5, 8.5);
    const second = node("ore", 7.5, 8.5);
    const world = worldWith([first, second]);
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(first.harvested).toBe(true);
    expect(second.harvested).toBe(false);
    expect(world.harvestProgress).toBeLessThan(0.2);
  });

  it("refuses to pick anything into a full backpack, and says so once", () => {
    const ore = node("ore", 9.5, 8.5);
    const world = worldWith([ore]);
    world.inventory.add("fruit", C.BACKPACK_CAPACITY);

    hold(world, INTERACT, C.HARVEST_TIME * 3);
    expect(ore.harvested).toBe(false);
    expect(world.harvestProgress).toBe(0);
    // One complaint for one press, not one per tick.
    expect(world.events).toEqual([
      { type: "blocked", reason: "backpackFull", at: expect.any(Number) },
    ]);
  });
});

describe("banking ore at camp", () => {
  it("turns the whole load into gold on a press", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 4);
    world.player.x = 1.5;
    world.player.y = 1.5;

    expect(world.availableAction()).toEqual({ type: "deposit", ore: 4, blocked: false });
    tap(world, INTERACT);
    expect(world.inventory.gold).toBe(4 * C.ORE_GOLD);
    expect(world.inventory.count("ore")).toBe(0);
    expect(world.events).toEqual([{ type: "deposited", gold: 4, at: expect.any(Number) }]);
  });

  it("banks once per press, not once per tick", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 3);
    world.player.x = 1.5;
    world.player.y = 1.5;
    hold(world, INTERACT, 2);
    expect(world.inventory.gold).toBe(3);
    expect(types(world)).toEqual(["deposited"]);
  });

  it("says there is nothing to bank when the pack has no ore", () => {
    const world = worldWith([]);
    world.player.x = 1.5;
    world.player.y = 1.5;
    expect(world.availableAction()).toEqual({ type: "deposit", ore: 0, blocked: true });
    tap(world, INTERACT);
    expect(world.events).toEqual([{ type: "blocked", reason: "noOre", at: expect.any(Number) }]);
  });

  it("still lets an empty-handed player harvest a node beside the camp", () => {
    const fruit = node("fruit", 2.5, 1.5);
    const world = worldWith([fruit]);
    world.player.x = 1.5;
    world.player.y = 1.5;
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(true);
  });

  it("banks rather than harvests when both are in reach and ore is carried", () => {
    const fruit = node("fruit", 2.5, 1.5);
    const world = worldWith([fruit]);
    world.inventory.add("ore", 2);
    world.player.x = 1.5;
    world.player.y = 1.5;
    // One press does one thing: banking spends it, so the fruit beside the camp
    // is not picked by the same hold.
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(false);
    expect(world.inventory.gold).toBe(2);

    // Release and press again, and now there is no ore, so it picks.
    world.step(C.TICK_SEC, NO_INPUT);
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(true);
  });
});

describe("eating and drinking", () => {
  it("eats one fruit per press", () => {
    const world = worldWith([]);
    world.inventory.add("fruit", 2);
    world.stats.stamina = 40;

    hold(world, EAT, 2); // held down for two seconds
    expect(world.inventory.count("fruit")).toBe(1); // still only one eaten
    expect(world.stats.stamina).toBeGreaterThan(59);
    expect(types(world)).toEqual(["ate"]);
  });

  it("refuses a second fruit until the stomach cooldown is up, and keeps it", () => {
    const world = worldWith([]);
    world.inventory.add("fruit", 2);
    world.stats.stamina = 40;

    tap(world, EAT);
    tap(world, EAT);
    expect(world.inventory.count("fruit")).toBe(1);
    expect(types(world)).toEqual(["ate", "blocked"]);

    hold(world, NO_INPUT, C.FULL_STOMACH_SEC + 1);
    tap(world, EAT);
    expect(world.inventory.count("fruit")).toBe(0);
    expect(types(world)).toEqual(["ate", "blocked", "ate"]);
  });

  it("says when there is no fruit to eat", () => {
    const world = worldWith([]);
    tap(world, EAT);
    expect(world.events).toEqual([{ type: "blocked", reason: "noFruit", at: expect.any(Number) }]);
  });

  it("drinks one water per press, with no cooldown", () => {
    const world = worldWith([]);
    world.inventory.add("water", 2);
    world.stats.hydration = 5;

    tap(world, DRINK);
    // 50% a bottle, less the trickle drained by the two ticks the tap took.
    expect(world.stats.hydration).toBeCloseTo(55 - 2 * C.TICK_SEC * C.HYDRATION_DRAIN, 6);
    tap(world, DRINK);
    expect(world.inventory.count("water")).toBe(0);
    expect(world.stats.hydration).toBeGreaterThan(99);
    expect(types(world)).toEqual(["drank", "drank"]);
  });

  it("says when there is no water to drink", () => {
    const world = worldWith([]);
    tap(world, DRINK);
    expect(world.events).toEqual([{ type: "blocked", reason: "noWater", at: expect.any(Number) }]);
  });
});

describe("a day played end to end", () => {
  it("picks, eats, drinks, banks, and totals up", () => {
    const world = worldWith([
      node("ore", 9.5, 8.5),
      node("ore", 7.5, 8.5),
      node("fruit", 8.5, 9.5),
      node("water", 8.5, 7.5),
    ]);
    world.stats.stamina = 50;
    world.stats.hydration = 50;

    // Four nodes in reach of where the player stands; hold long enough for each.
    for (let i = 0; i < 4; i++) hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(world.inventory.carried).toBe(4);
    expect(world.nodes.every((n) => n.harvested)).toBe(true);

    tap(world, EAT);
    tap(world, DRINK);

    world.player.x = 1.5;
    world.player.y = 1.5;
    tap(world, INTERACT);

    const day = summarise(world);
    expect(day.gold).toBe(2);
    expect(day.harvested).toEqual({ ore: 2, fruit: 1, water: 1, vine: 0, stick: 0 });
    expect(day.fruitEaten).toBe(1);
    expect(day.waterDrunk).toBe(1);
    expect(day.oreUnbanked).toBe(0);
    expect(world.inventory.carried).toBe(0);
  });

  it("counts ore still in the pack at nightfall as unbanked", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 3);
    expect(summarise(world).oreUnbanked).toBe(3);
    expect(summarise(world).gold).toBe(0);
  });

  it("reports an untouched day as all zeroes", () => {
    const day = summarise(worldWith([]));
    expect(day).toEqual({
      year: 1,
      gold: 0,
      harvested: { fruit: 0, water: 0, ore: 0, vine: 0, stick: 0 },
      fruitEaten: 0,
      waterDrunk: 0,
      oreUnbanked: 0,
      tilesCut: 0,
      bridgesBuilt: 0,
      distanceWalked: 0,
    });
  });
});
