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
    springs: [],
    reachable: new Uint8Array(16 * 16),
  });
  // Away from camp unless a test says otherwise, so harvesting is what happens.
  // Last walked east, so a tool acts on the tile to the east.
  world.player.x = 8.5;
  world.player.y = 8.5;
  world.player.heading = { x: 1, y: 0 };
  return world;
}

const INTERACT: InputState = { ...NO_INPUT, interact: true };

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

const backpackOf = (world: World) => ({
  fruit: world.inventory.count("fruit"),
  ore: world.inventory.count("ore"),
});

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

  it("takes a feather on the press, with no hold and no progress", () => {
    const feather = node("feather", 9.5, 8.5);
    const world = worldWith([feather]);

    world.step(C.TICK_SEC, INTERACT);
    expect(feather.harvested).toBe(true);
    expect(world.inventory.count("feather")).toBe(1);
    expect(world.harvestProgress).toBe(0);
    expect(world.events).toEqual([
      { type: "harvested", kind: "feather", at: expect.any(Number) },
    ]);
  });

  it("sweeps a feather field on a held key, taking each as it comes in reach", () => {
    const world = worldWith([node("feather", 9.5, 8.5), node("feather", 7.5, 8.5)]);
    hold(world, INTERACT, C.TICK_SEC * 3);
    expect(world.inventory.count("feather")).toBe(2);

    // And walking on with the key still down takes the next ones on the way.
    const field = worldWith([10, 11, 12, 13].map((x) => node("feather", x + 0.5, 8.5)));
    const east: InputState = { ...INTERACT, moveX: 1 };
    hold(field, east, 1);
    expect(field.inventory.count("feather")).toBe(4);
    expect(field.events.filter((e) => e.type === "harvested")).toHaveLength(4);
  });

  it("says a held key into a full pack cannot take a feather once, on the press", () => {
    const world = worldWith([node("feather", 9.5, 8.5)]);
    world.inventory.add("fruit", C.BACKPACK_CAPACITY);
    hold(world, INTERACT, 1);
    expect(world.inventory.count("feather")).toBe(0);
    expect(types(world)).toEqual(["blocked"]);
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

describe("banking at camp", () => {
  it("stores the whole load at camp on a press, and sells none of it", () => {
    const world = worldWith([]);
    world.inventory.add("feather", 2);
    world.inventory.add("shell", 3);
    world.player.x = 1.5;
    world.player.y = 1.5;

    expect(world.availableAction()).toEqual({ type: "deposit", stored: 5, blocked: null });
    tap(world, INTERACT);
    expect(world.inventory.carried).toBe(0);
    expect(world.store.count("feather")).toBe(2);
    expect(world.store.count("shell")).toBe(3);
    expect(world.events).toEqual([{ type: "deposited", stored: 5, at: expect.any(Number) }]);
  });

  it("stores fruit, money and building material in the same press", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 3);
    world.inventory.add("fruit", 2);
    world.inventory.add("stick", 1);
    world.inventory.add("vine", 1);
    world.player.x = 1.5;
    world.player.y = 1.5;

    expect(world.availableAction()).toEqual({ type: "deposit", stored: 7, blocked: null });
    tap(world, INTERACT);
    expect(world.store.count("ore")).toBe(3);
    expect(world.store.count("fruit")).toBe(2);
    expect(backpackOf(world)).toEqual({ fruit: 0, ore: 0 });
    // Camp takes every kind. A pack filled with building material used to be a
    // dead end for the whole run, because nothing at camp would take it.
    expect(world.inventory.carried).toBe(0);
    expect(world.store.count("stick")).toBe(1);
    expect(world.store.count("vine")).toBe(1);
  });

  it("empties a pack of ten vines to nothing carried", () => {
    const world = worldWith([]);
    world.inventory.add("vine", C.BACKPACK_CAPACITY);
    world.player.x = 1.5;
    world.player.y = 1.5;
    tap(world, INTERACT);
    expect(world.inventory.carried).toBe(0);
    expect(world.store.count("vine")).toBe(C.BACKPACK_CAPACITY);
  });

  it("banks fruit alone, with no ore in the pack", () => {
    const world = worldWith([]);
    world.inventory.add("fruit", 4);
    world.player.x = 1.5;
    world.player.y = 1.5;
    tap(world, INTERACT);
    expect(world.store.count("fruit")).toBe(4);
  });

  it("offers to take sticks and vines too, which camp used to refuse", () => {
    const world = worldWith([]);
    world.inventory.add("stick", 2);
    world.player.x = 1.5;
    world.player.y = 1.5;
    expect(world.availableAction()).toEqual({ type: "deposit", stored: 2, blocked: null });
  });

  it("banks once per press, not once per tick", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 3);
    world.player.x = 1.5;
    world.player.y = 1.5;
    // Pressed and let go several times over, which is the shape a tap has now:
    // the same key held opens the panel, so the bank waits for the release.
    tap(world, INTERACT);
    tap(world, INTERACT);
    expect(world.store.count("ore")).toBe(3);
    expect(types(world)).toEqual(["deposited", "blocked"]);
  });

  it("opens the transfer panel when the key is held rather than tapped", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 4);
    world.player.x = 1.5;
    world.player.y = 1.5;

    hold(world, INTERACT, C.TRANSFER_HOLD_TIME * 2);
    expect(types(world)).toEqual(["transferOpened"]);
    // The panel is the choice, so the hold does not also bank the load.
    expect(world.inventory.count("vine")).toBe(4);
  });

  it("sells nothing as the panel opens: feathers and shells are lines in it like the rest", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 2);
    world.inventory.add("vine", 1);
    world.player.x = 1.5;
    world.player.y = 1.5;

    hold(world, INTERACT, C.TRANSFER_HOLD_TIME * 2);
    expect(types(world)).toEqual(["transferOpened"]);
    expect(world.inventory.count("ore")).toBe(2);
    expect(world.inventory.count("vine")).toBe(1);
  });

  it("opens no panel away from camp", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 2);

    hold(world, INTERACT, C.TRANSFER_HOLD_TIME * 2);
    expect(types(world)).toEqual([]);
    expect(world.transferTarget()).toBeNull();
  });

  it("puts things in and takes them back out through the panel", () => {
    const world = worldWith([]);
    world.inventory.add("vine", C.BACKPACK_CAPACITY);
    world.player.x = 1.5;
    world.player.y = 1.5;
    const target = world.transferTarget()!;
    expect(target.store).toBe(world.store);

    expect(world.putAway(target, "vine", C.BACKPACK_CAPACITY)).toBe(C.BACKPACK_CAPACITY);
    expect(world.inventory.carried).toBe(0);
    expect(world.store.count("vine")).toBe(C.BACKPACK_CAPACITY);

    expect(world.takeOut(target, "vine", 3)).toBe(3);
    expect(world.inventory.count("vine")).toBe(3);
    expect(world.store.count("vine")).toBe(C.BACKPACK_CAPACITY - 3);
  });

  it("takes fruit back out of the store, leaving the store's count lower", () => {
    const world = worldWith([]);
    world.store.add("fruit", 5);
    world.player.x = 1.5;
    world.player.y = 1.5;
    const target = world.transferTarget()!;

    expect(world.takeOut(target, "fruit", 2)).toBe(2);
    expect(world.store.count("fruit")).toBe(3);
    expect(world.inventory.count("fruit")).toBe(2);
  });

  it("refuses a take that will not fit, rather than taking part of one", () => {
    const world = worldWith([]);
    world.store.add("log", 1);
    world.inventory.add("vine", C.BACKPACK_CAPACITY - 1);
    world.player.x = 1.5;
    world.player.y = 1.5;
    const target = world.transferTarget()!;

    // A log takes two slots and there is one free.
    expect(world.takeOut(target, "log", 1)).toBe(0);
    expect(world.store.count("log")).toBe(1);
  });

  it("keeps an ore put away at camp as ore", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 2);
    world.player.x = 1.5;
    world.player.y = 1.5;
    expect(world.putAway(world.transferTarget()!, "ore", 1)).toBe(1);
    expect(world.store.count("ore")).toBe(1);
  });

  it("says there is nothing to bank when the pack is empty", () => {
    const world = worldWith([]);
    world.player.x = 1.5;
    world.player.y = 1.5;
    expect(world.availableAction()).toEqual({ type: "deposit", stored: 0, blocked: "nothingToBank" });
    tap(world, INTERACT);
    expect(world.events).toEqual([
      { type: "blocked", reason: "nothingToBank", at: expect.any(Number) },
    ]);
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
    // One press does one thing: the hold opens the panel and spends it, so the
    // fruit beside the camp is not picked by the same hold.
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(false);
    expect(types(world)).toEqual(["transferOpened"]);

    // A tap banks the ore; press again, and with an empty pack it picks.
    world.step(C.TICK_SEC, NO_INPUT);
    tap(world, INTERACT);
    expect(world.store.count("ore")).toBe(2);
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(true);
  });
});

describe("dropping", () => {
  const DROP: InputState = { ...NO_INPUT, drop: true };
  const SWITCH: InputState = { ...NO_INPUT, dropSwitch: true };

  it("names the kind that takes the most slots, and never nothing", () => {
    const world = worldWith([]);
    expect(world.dropKind).toBeNull();
    world.inventory.add("vine", 3);
    expect(world.dropKind).toBe("vine");
    // A log is two slots, so two of them outweigh three vines.
    world.inventory.add("log", 2);
    world.inventory.remove("vine", 3);
    expect(world.dropKind).toBe("log");
  });

  it("cycles the selection through what the pack holds, and only that", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 3);
    world.inventory.add("fruit", 1);
    // It starts on the kind taking the most slots, and wraps round the table
    // order from there.
    expect(world.dropKind).toBe("vine");
    world.cycleDropKind();
    expect(world.dropKind).toBe("fruit");
    world.cycleDropKind();
    expect(world.dropKind).toBe("vine");
  });

  it("falls back to the biggest kind once the selected one runs out", () => {
    const world = worldWith([]);
    world.inventory.add("fruit", 2);
    world.inventory.add("vine", 5);
    world.cycleDropKind();
    expect(world.dropKind).toBe("fruit");
    world.inventory.remove("fruit", 2);
    expect(world.dropKind).toBe("vine");
  });

  it("scatters six vines one to a tile, and the pack has them back when picked up", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 6);
    world.step(C.TICK_SEC, DROP);

    expect(world.dropped).toHaveLength(6);
    expect(world.inventory.count("vine")).toBe(0);
    const tiles = new Set(world.dropped.map((d) => `${d.x},${d.y}`));
    expect(tiles.size).toBe(6);
    expect(types(world)).toEqual(["dropped"]);

    // Picking up is a tap, one item at a time.
    for (let i = 0; i < 6; i++) {
      // Stand over each one in turn: they spilled outward by ring.
      const item = world.dropped[0]!;
      world.player.x = item.x + 0.5;
      world.player.y = item.y + 0.5;
      tap(world, INTERACT);
    }
    expect(world.dropped).toHaveLength(0);
    expect(world.inventory.count("vine")).toBe(6);
  });

  it("never drops on water, a node or a spring", () => {
    const world = worldWith([node("ore", 8.5, 7.5)]);
    world.map.set(9, 8, "stream");
    world.springs.push({ x: 7, y: 8 });
    world.inventory.add("vine", 6);
    world.step(C.TICK_SEC, DROP);

    expect(world.dropped).toHaveLength(6);
    for (const item of world.dropped) {
      expect(world.map.get(item.x, item.y)).toBe("grass");
      expect(world.nodes.some((n) => Math.floor(n.x) === item.x && Math.floor(n.y) === item.y))
        .toBe(false);
      expect(world.springs.some((s) => s.x === item.x && s.y === item.y)).toBe(false);
    }
  });

  it("refuses when there is nowhere at all to put anything, and keeps the load", () => {
    const world = worldWith([]);
    // Walled in: every tile within the spill rings but the one stood on is rock.
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) world.map.set(x, y, "rock");
    world.map.set(8, 8, "grass");
    world.inventory.add("vine", 2);
    world.dropped.push({ kind: "vine", x: 8, y: 8 });

    world.step(C.TICK_SEC, DROP);
    expect(world.inventory.count("vine")).toBe(2);
    expect(types(world)).toEqual(["blocked"]);
  });

  it("is one drop per press, not one per tick", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 3);
    hold(world, DROP, 1);
    expect(world.dropped).toHaveLength(3);
    expect(types(world)).toEqual(["dropped"]);
  });

  it("switches once per press too", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 3);
    world.inventory.add("fruit", 1);
    hold(world, SWITCH, 1);
    expect(world.dropKind).toBe("fruit");
  });

  it("harvests the node under a pack that has just been emptied of vines", () => {
    const fruit = node("fruit", 8.5, 8.5);
    const world = worldWith([fruit]);
    world.inventory.add("vine", C.BACKPACK_CAPACITY);
    expect(world.availableAction()).toEqual({ type: "harvest", node: fruit, blocked: "backpackFull" });

    world.step(C.TICK_SEC, DROP);
    world.step(C.TICK_SEC, NO_INPUT);
    // The node wins over the vines now lying at the player's feet, so the same
    // E picks the fruit.
    hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(fruit.harvested).toBe(true);
    expect(world.inventory.count("fruit")).toBe(1);
  });

  it("does not put what was dropped back in the pack on a key held for the fruit beside it", () => {
    const fruit = node("fruit", 8.5, 8.5);
    const world = worldWith([fruit]);
    world.inventory.add("vine", C.BACKPACK_CAPACITY);
    world.step(C.TICK_SEC, DROP);
    world.step(C.TICK_SEC, NO_INPUT);
    const lying = world.dropped.length;

    hold(world, INTERACT, C.HARVEST_TIME * 3);
    expect(fruit.harvested).toBe(true);
    expect(world.dropped).toHaveLength(lying);
    expect(world.inventory.count("vine")).toBe(0);
  });

  it("will not pick one up into a full pack", () => {
    const world = worldWith([]);
    world.dropped.push({ kind: "vine", x: 8, y: 8 });
    world.inventory.add("fruit", C.BACKPACK_CAPACITY);
    tap(world, INTERACT);
    expect(world.dropped).toHaveLength(1);
    expect(types(world)).toEqual(["blocked"]);
  });
});

describe("drinking", () => {
  it("drinks its fill beside a spring, as a hold", () => {
    const world = worldWith([]);
    world.springs.push({ x: 9, y: 8 });
    world.stats.hydration = 30;
    expect(world.availableAction()).toEqual({ type: "drink", x: 9, y: 8, blocked: null });

    hold(world, INTERACT, C.DRINK_TIME / 2);
    expect(world.stats.hydration).toBeLessThan(30);
    hold(world, INTERACT, C.DRINK_TIME * 0.6);
    expect(world.stats.hydration).toBeGreaterThan(C.HYDRATION_MAX - 1);
    expect(types(world)).toEqual(["drank"]);
  });

  it("walks over a spring, which stands on the bank rather than being ground", () => {
    const world = worldWith([]);
    world.springs.push({ x: 9, y: 8 });
    hold(world, { ...NO_INPUT, moveX: 1 }, 0.5);
    expect(world.player.x).toBeGreaterThan(10);
  });

  it("drinks at the stream only where there is a spring", () => {
    const world = worldWith([]);
    world.map.set(9, 8, "stream");
    world.buildMode = "bridge";
    world.stats.hydration = 30;
    expect(world.availableAction()).toMatchObject({ type: "build", blocked: "noMaterials" });
  });

  it("on a spring's tile beside the stream, drinks when thirsty and bridges otherwise", () => {
    const world = worldWith([]);
    world.map.set(9, 8, "stream");
    world.buildMode = "bridge";
    world.springs.push({ x: 8, y: 8 });
    world.stats.hydration = 30;
    expect(world.availableAction()).toMatchObject({ type: "drink", x: 8, y: 8 });
    world.stats.hydration = C.DRINK_OFFER_BELOW + 1;
    expect(world.availableAction()).toMatchObject({ type: "build", x: 9, y: 8 });
  });

  it("leaves a spring be while the bar is nearly full, so the tools stay in reach", () => {
    const world = worldWith([]);
    world.springs.push({ x: 9, y: 8 });
    world.map.set(8, 9, "thicket");
    world.player.heading = { x: 0, y: 1 };
    world.stats.hydration = C.DRINK_OFFER_BELOW + 5;
    expect(world.availableAction()).toMatchObject({ type: "cut" });
    world.stats.hydration = C.DRINK_OFFER_BELOW - 5;
    expect(world.availableAction()).toMatchObject({ type: "drink" });
  });

  it("has nothing to drink away from a spring", () => {
    const world = worldWith([]);
    world.stats.hydration = 30;
    expect(world.availableAction()).toBeNull();
  });
});

describe("a summer played end to end", () => {
  it("picks, drinks, banks, and totals up", () => {
    const world = worldWith([
      node("ore", 9.5, 8.5),
      node("ore", 7.5, 8.5),
      node("fruit", 8.5, 9.5),
    ]);
    world.springs.push({ x: 8, y: 7 });
    world.stats.hydration = 50;

    // Three nodes in reach of where the player stands; hold long enough for each.
    for (let i = 0; i < 3; i++) hold(world, INTERACT, C.HARVEST_TIME * 1.1);
    expect(world.inventory.carried).toBe(3);
    expect(world.nodes.every((n) => n.harvested)).toBe(true);

    // With the nodes picked, the spring above is what the key reaches.
    world.step(C.TICK_SEC, NO_INPUT);
    hold(world, INTERACT, C.DRINK_TIME * 1.1);

    world.player.x = 1.5;
    world.player.y = 1.5;
    world.step(C.TICK_SEC, NO_INPUT);
    tap(world, INTERACT);

    const summer = summarise(world);
    expect(world.store.count("ore")).toBe(2);
    expect(summer.harvested).toEqual({
      fruit: 1,
      feather: 0,
      stick: 0,
      vine: 0,
      ore: 2,
      log: 0,
      shell: 0,
    });
    expect(summer.drinks).toBe(1);
    expect(summer.storedAtEnd).toBe(0);
    // The fruit went into the store with the ore.
    expect(summer.fruitStored).toBe(1);
    expect(backpackOf(world)).toEqual({ fruit: 0, ore: 0 });
  });

  it("banks the whole pack when the summer ends, and says where it ended", () => {
    const world = worldWith([]);
    world.inventory.add("ore", 3);
    world.inventory.add("fruit", 2);
    world.inventory.add("vine", 1);
    world.endSummer();
    expect(summarise(world).storedAtEnd).toBe(6);
    expect(world.store.count("ore")).toBe(3);
    expect(summarise(world).fruitStored).toBe(2);
    expect(summarise(world).endedAway).toBe(true);
    expect(world.inventory.carried).toBe(0);
    expect(world.store.count("vine")).toBe(1);
  });

  it("banks what is carried at the end but leaves what was dropped where it lies", () => {
    const world = worldWith([]);
    world.inventory.add("vine", 4);
    world.dropSelected();
    expect(world.dropped).toHaveLength(4);
    world.inventory.add("ore", 2);
    world.endSummer();

    expect(summarise(world).storedAtEnd).toBe(2);
    expect(summarise(world).dropped).toBe(4);
    expect(world.dropped).toHaveLength(4);

    // The winter clears the ground, and leaves the store as it is.
    world.nextSummer();
    expect(world.dropped).toHaveLength(0);
    expect(world.store.count("vine")).toBe(0);
  });

  it("reports an untouched summer as all zeroes", () => {
    const summer = summarise(worldWith([]));
    expect(summer).toEqual({
      year: 1,
      fruitStored: 0,
      harvested: { fruit: 0, feather: 0, stick: 0, vine: 0, ore: 0, log: 0, shell: 0 },
      drinks: 0,
      storedAtEnd: 0,
      dropped: 0,
      endedAway: false,
      tilesCut: 0,
      bridgesBuilt: 0,
      saplingsFelled: 0,
      wellsDug: 0,
      distanceWalked: 0,
    });
  });
});
