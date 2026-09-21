import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { tileAhead } from "../src/sim/interaction.ts";
import { Inventory } from "../src/sim/inventory.ts";
import { headingFor } from "../src/sim/player.ts";
import { parseMap } from "../src/sim/mapfile.ts";
import { RESOURCES } from "../src/sim/resources.ts";
import { summarise } from "../src/sim/summary.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { ResourceKind, ResourceNode } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { hudModel } from "../src/ui/hud.ts";

const INTERACT: InputState = { ...NO_INPUT, interact: true };

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
 * A grass arena with the camp in a corner, whatever terrain the test paints,
 * and the player standing at (8.5, 8.5), last walked east, unless it says
 * otherwise.
 */
function arena(paint: (map: TileMap) => void = () => {}, nodes: ResourceNode[] = []): World {
  const map = new TileMap(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) map.set(x, y, "grass");
  paint(map);
  const world = new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes,
    springs: [],
    reachable: new Uint8Array(16 * 16),
  });
  world.player.x = 8.5;
  world.player.y = 8.5;
  world.player.heading = { x: 1, y: 0 };
  return world;
}

const types = (world: World) => world.events.map((e) => e.type);

describe("tileAhead", () => {
  const map = new TileMap(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) map.set(x, y, "grass");

  it("is the neighbour of the player's tile along the heading, eight ways", () => {
    expect(tileAhead(map, 4.5, 4.5, { x: 1, y: 0 })).toEqual({ x: 5, y: 4 });
    expect(tileAhead(map, 4.5, 4.5, { x: 0, y: -1 })).toEqual({ x: 4, y: 3 });
    expect(tileAhead(map, 4.5, 4.5, headingFor(-1, 1))).toEqual({ x: 3, y: 5 });
  });

  it("is the same tile wherever the player stands inside their own", () => {
    for (const x of [4.01, 4.3, 4.5, 4.7, 4.99]) {
      for (const y of [4.01, 4.5, 4.99]) {
        expect(tileAhead(map, x, y, { x: 1, y: 0 })).toEqual({ x: 5, y: 4 });
      }
    }
  });

  it("is nothing before the first step, and nothing off the map", () => {
    expect(tileAhead(map, 4.5, 4.5, null)).toBeNull();
    expect(tileAhead(map, 7.5, 4.5, { x: 1, y: 0 })).toBeNull();
  });
});

describe("aiming a tool along the heading", () => {
  /**
   * A stream four tiles across, x 6 to 9, with the bridge laid over its first
   * two, (6, 8) and (7, 8). The next tile to bridge is (8, 8), with stream
   * above and below the player's own bridge tile as well.
   */
  function midBridge(): World {
    const world = arena((map) => {
      for (let y = 0; y < 16; y++) for (let x = 6; x <= 9; x++) map.set(x, y, "stream");
      map.set(6, 8, "bridge");
      map.set(7, 8, "bridge");
    });
    world.inventory.add("stick", 5);
    world.inventory.add("vine", 5);
    world.player.x = 6.5;
    world.player.y = 8.5;
    return world;
  }

  it("takes the next tile along from anywhere on the bridge tile, never one beside it", () => {
    const world = midBridge();
    world.buildMode = "bridge";
    // Walked east, as a player would, into the end of the bridge.
    hold(world, { ...NO_INPUT, moveX: 1 }, 1);
    // Collision stops a tick short of the stream, not flush against it.
    expect(world.player.x).toBeGreaterThan(7.5);
    expect(world.availableAction()).toMatchObject({ type: "build", x: 8, y: 8 });
    expect(world.player.heading).toEqual({ x: 1, y: 0 });
    for (const x of [7.01, 7.2, 7.4, 7.5, 7.6, 7.7]) {
      world.player.x = x;
      expect(world.availableAction()).toMatchObject({ type: "build", x: 8, y: 8 });
    }
  });

  it("offers no tool before the first step, even with stream all round", () => {
    const world = midBridge();
    world.player.x = 7.5;
    world.player.heading = null;
    expect(world.availableAction()).toBeNull();
  });

  it("offers nothing when the tile ahead is ground, whatever is beside it", () => {
    const world = midBridge();
    world.player.x = 7.5;
    // Heading back west along the bridge: the tile ahead is bridge, and the
    // stream above and below is not in that direction.
    world.player.heading = { x: -1, y: 0 };
    expect(world.availableAction()).toBeNull();
  });

  it("aims from where the input pointed, kept while standing still", () => {
    const world = midBridge();
    world.buildMode = "bridge";
    world.player.x = 7.5;
    // Pressing south into the stream moves nothing but still says which tile.
    hold(world, { ...NO_INPUT, moveY: 1 }, C.TICK_SEC * 2);
    hold(world, NO_INPUT, 1);
    expect(world.player.heading).toEqual({ x: 0, y: 1 });
    expect(world.availableAction()).toMatchObject({ type: "build", x: 7, y: 9 });
  });

  it("takes only the tile ahead, not a thicket two tiles along", () => {
    const world = arena((map) => map.set(10, 8, "thicket"));
    world.player.heading = { x: 1, y: 0 };
    expect(world.availableAction()).toBeNull();
  });

  it("reads a diagonal input as a diagonal heading", () => {
    const diagonal = headingFor(0.7, -0.7)!;
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(headingFor(0, 0)).toBeNull();
  });
});

describe("cutting a thicket", () => {
  const withThicket = () => arena((map) => map.set(9, 8, "thicket"));

  it("offers the cut when one is in reach", () => {
    const world = withThicket();
    expect(world.availableAction()).toEqual({ type: "cut", x: 9, y: 8, blocked: null });
    expect(hudModel(world).prompt?.text).toBe("Hold E to cut through");
  });

  it("does not cut before the full time is held", () => {
    const world = withThicket();
    hold(world, INTERACT, C.CUT_TIME - 2 * C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe("thicket");
    expect(world.harvestProgress).toBeGreaterThan(0.9);
    expect(types(world)).not.toContain("cut");
  });

  it("turns the tile into CUT_LEAVES once it is, and says so once", () => {
    const world = withThicket();
    hold(world, INTERACT, C.CUT_TIME + C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe(C.CUT_LEAVES);
    expect(world.map.isPassable(9, 8)).toBe(true);
    expect(types(world).filter((t) => t === "cut")).toHaveLength(1);
    expect(world.events.find((e) => e.type === "cut")).toMatchObject({ x: 9, y: 8 });
  });

  it("throws the progress away when the key comes up", () => {
    const world = withThicket();
    hold(world, INTERACT, C.CUT_TIME * 0.8);
    hold(world, NO_INPUT, C.TICK_SEC);
    expect(world.harvestProgress).toBe(0);
    hold(world, INTERACT, C.CUT_TIME * 0.8);
    expect(world.map.get(9, 8)).toBe("thicket");
  });

  it("throws it away when the player walks out of reach", () => {
    const world = withThicket();
    hold(world, INTERACT, C.CUT_TIME * 0.8);
    world.player.x = 4.5;
    hold(world, INTERACT, C.TICK_SEC);
    expect(world.harvestProgress).toBe(0);
    expect(world.map.get(9, 8)).toBe("thicket");
  });

  it("loses nothing but time: cutting puts nothing in the pack", () => {
    const world = withThicket();
    hold(world, INTERACT, C.CUT_TIME + C.TICK_SEC);
    expect(world.inventory.carried).toBe(0);
  });
});

describe("harvesting versus cutting", () => {
  it("picks the node when both are in reach", () => {
    // A vine growing against the thicket that walls it in is still a vine.
    const world = arena((map) => map.set(9, 8, "thicket"), [node("vine", 8.5, 9.2)]);
    const action = world.availableAction();
    expect(action?.type).toBe("harvest");
    hold(world, INTERACT, C.HARVEST_TIME + C.TICK_SEC);
    expect(world.inventory.count("vine")).toBe(1);
    expect(world.map.get(9, 8)).toBe("thicket");
  });
});

describe("laying a bridge", () => {
  /** Water ahead, and the build menu set to a bridge, as a player would set it. */
  const withStream = () => {
    const world = arena((map) => map.set(9, 8, "stream"));
    world.buildMode = "bridge";
    return world;
  };

  function stocked(): World {
    const world = withStream();
    world.inventory.add("stick", C.BRIDGE_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    return world;
  }

  it("is not built by the interact key alone, which says what to press", () => {
    const world = arena((map) => map.set(9, 8, "stream"));
    world.inventory.add("stick", C.BRIDGE_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    expect(world.availableAction()).toBeNull();
    expect(world.buildHint()).toBe("bridge");
    expect(hudModel(world).prompt?.text).toBe("Press B to build a bridge tile");

    hold(world, INTERACT, C.BUILD_TIME * 2);
    expect(world.map.get(9, 8)).toBe("stream");
    expect(world.inventory.count("stick")).toBe(C.BRIDGE_STICKS);
  });

  it("says the price at the water's edge with nothing chosen and nothing carried", () => {
    const world = arena((map) => map.set(9, 8, "stream"));
    expect(hudModel(world).prompt?.text).toBe(
      "A bridge tile needs 1 stick and 1 vine. Press B to build",
    );
  });

  it("refuses without the materials, and says why once", () => {
    const world = withStream();
    expect(world.availableAction()).toEqual({ type: "build", x: 9, y: 8, blocked: "noMaterials" });
    expect(hudModel(world).prompt?.text).toBe("A bridge tile needs 1 stick and 1 vine");
    expect(hudModel(world).prompt?.blocked).toBe(true);

    hold(world, INTERACT, C.BUILD_TIME * 2);
    // One refusal on the press, not sixty a second.
    expect(types(world).filter((t) => t === "blocked")).toHaveLength(1);
    expect(world.events[0]).toMatchObject({ type: "blocked", reason: "noMaterials" });
    expect(world.map.get(9, 8)).toBe("stream");
  });

  it("offers the build once the materials are in the pack", () => {
    const world = stocked();
    expect(world.availableAction()).toEqual({ type: "build", x: 9, y: 8, blocked: null });
    expect(hudModel(world).prompt?.text).toBe("Hold E to lay a bridge tile (1 stick and 1 vine)");
  });

  it("does not build before the full time is held", () => {
    const world = stocked();
    hold(world, INTERACT, C.BUILD_TIME - 2 * C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe("stream");
    expect(world.inventory.count("stick")).toBe(C.BRIDGE_STICKS);
  });

  it("spends the materials and leaves a tile that can be walked on", () => {
    const world = stocked();
    hold(world, INTERACT, C.BUILD_TIME + C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe("bridge");
    expect(world.map.isPassable(9, 8)).toBe(true);
    expect(world.inventory.count("stick")).toBe(0);
    expect(world.inventory.count("vine")).toBe(0);
    expect(types(world).filter((t) => t === "built")).toHaveLength(1);
  });

  it("only ever pays for one tile per hold", () => {
    // Two tiles of water and materials for one bridge: holding through the
    // first must not quietly take a second payment for the second.
    const world = stocked();
    world.map.set(10, 8, "stream");
    hold(world, INTERACT, C.BUILD_TIME * 2 + C.TICK_SEC);
    expect(types(world).filter((t) => t === "built")).toHaveLength(1);
    expect(world.inventory.count("stick")).toBe(0);
  });
});

describe("the next summer", () => {
  function played(): World {
    const world = arena((map) => {
      map.set(9, 8, "thicket");
      map.set(4, 4, "stream");
    }, [node("ore", 8.5, 9.2)]);
    hold(world, INTERACT, C.HARVEST_TIME + C.TICK_SEC);
    hold(world, NO_INPUT, C.TICK_SEC);
    hold(world, INTERACT, C.CUT_TIME + C.TICK_SEC);
    hold(world, NO_INPUT, C.TICK_SEC);
    world.player.x = 1.5;
    world.player.y = 1.5;
    hold(world, INTERACT, C.TICK_SEC);
    hold(world, NO_INPUT, C.TICK_SEC);
    return world;
  }

  it("keeps the map the player changed, and the gold they banked", () => {
    const world = played();
    expect(world.map.get(9, 8)).toBe(C.CUT_LEAVES);
    expect(world.inventory.gold).toBe(RESOURCES.ore.price);

    world.nextSummer();

    expect(world.map.get(9, 8)).toBe(C.CUT_LEAVES);
    expect(world.map.get(4, 4)).toBe("stream");
    expect(world.inventory.gold).toBe(RESOURCES.ore.price);
  });

  it("keeps everything in the store, everything but fruit in a cache, and nothing on the ground", () => {
    const world = arena();
    world.store.add("fruit", 3);
    world.store.add("vine", 2);
    const cache = { x: 12, y: 12, contents: new Inventory(Infinity) };
    cache.contents.add("fruit", 4);
    cache.contents.add("log", 1);
    world.caches.push(cache);
    world.inventory.add("stick", 2);
    world.dropSelected();
    expect(world.dropped).toHaveLength(2);

    world.nextSummer();

    // Camp keeps the lot, and is the only place a fruit becomes winter food.
    expect(world.store.count("fruit")).toBe(3);
    expect(world.store.count("vine")).toBe(2);
    // A box is a box, but a fruit is a fruit anywhere.
    expect(cache.contents.count("fruit")).toBe(0);
    expect(cache.contents.count("log")).toBe(1);
    // A heap in a field is scattered by a year of rain and animals.
    expect(world.dropped).toHaveLength(0);
  });

  it("regrows every node, refills hydration and restarts the clock", () => {
    const world = played();
    world.stats.hydration = 3;
    world.elapsedSec = C.SUMMER_LENGTH_SEC;
    expect(world.nodes.every((n) => n.harvested)).toBe(true);

    world.nextSummer();

    expect(world.nodes.every((n) => !n.harvested)).toBe(true);
    expect(world.stats.hydration).toBe(C.HYDRATION_MAX);
    expect(world.elapsedSec).toBe(0);
    expect(world.remainingSec).toBe(C.SUMMER_LENGTH_SEC);
    expect(world.summerOver).toBe(false);
  });

  it("puts the player back at camp and counts the year up", () => {
    const world = played();
    world.player.x = 12.5;
    world.player.y = 12.5;

    world.nextSummer();

    expect(world.year).toBe(2);
    expect(world.player.x).toBe(world.camp.x);
    expect(world.player.y).toBe(world.camp.y);
    expect(world.events.find((e) => e.type === "summerStarted")).toMatchObject({
      type: "summerStarted",
      year: 2,
    });
  });

  it("summarises the new summer on its own, not the old one as well", () => {
    const world = played();
    expect(summarise(world).harvested.ore).toBe(1);
    expect(summarise(world).tilesCut).toBe(1);

    world.nextSummer();

    const summer = summarise(world);
    expect(summer.year).toBe(2);
    expect(summer.harvested.ore).toBe(0);
    expect(summer.tilesCut).toBe(0);
    // Gold is the score, so it carries: it is the one number that is not a
    // record of what happened between this summer's start and its end.
    expect(summer.gold).toBe(RESOURCES.ore.price);
  });

  it("does not carry a held key into the new summer", () => {
    const world = arena((map) => map.set(9, 8, "thicket"));
    world.nextSummer();
    world.player.x = 8.5;
    world.player.y = 8.5;
    // The key was already down when the summer turned over; the cut only
    // starts once it has been let go and pressed again.
    hold(world, INTERACT, C.CUT_TIME + C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe("thicket");
    hold(world, NO_INPUT, C.TICK_SEC);
    hold(world, INTERACT, C.CUT_TIME + C.TICK_SEC);
    expect(world.map.get(9, 8)).toBe(C.CUT_LEAVES);
  });
});

describe("a map file played as a world", () => {
  it("builds a world the simulation can step", () => {
    const world = new World(
      parseMap(["#######", "#..%..#", "#.Cy=v#", "#..%..#", "#######"].join("\n")),
    );
    expect(world.camp).toEqual({ x: 2.5, y: 2.5 });
    expect(world.player.x).toBe(2.5);
    world.step(C.TICK_SEC, NO_INPUT);
    expect(world.remainingSec).toBeLessThan(C.SUMMER_LENGTH_SEC);
    // The vine is in reach of the camp here, and a vine is what the mud pocket
    // in a real map hands over.
    expect(world.availableAction()?.type).toBe("harvest");
  });
});
