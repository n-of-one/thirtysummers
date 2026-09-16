import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { nearestTileWithin } from "../src/sim/interaction.ts";
import { parseMap } from "../src/sim/mapfile.ts";
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
 * and the player standing at (8.5, 8.5) unless it says otherwise.
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
    reachable: new Uint8Array(16 * 16),
  });
  world.player.x = 8.5;
  world.player.y = 8.5;
  return world;
}

const types = (world: World) => world.events.map((e) => e.type);

describe("nearestTileWithin", () => {
  const map = new TileMap(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) map.set(x, y, "grass");
  map.set(3, 4, "thicket");
  map.set(5, 4, "thicket");

  it("finds a tile of the kind inside the radius", () => {
    expect(nearestTileWithin(map, 4.2, 4.5, "thicket")).toEqual({ x: 3, y: 4 });
  });

  it("ignores tiles beyond the radius", () => {
    expect(nearestTileWithin(map, 4.5, 7.5, "thicket")).toBeNull();
  });

  it("ignores tiles of another kind", () => {
    expect(nearestTileWithin(map, 4.2, 4.5, "stream")).toBeNull();
  });

  it("breaks a tie on the lower tile index, so a hold can finish", () => {
    // Dead centre between the two thicket tiles: the answer has to be the same
    // every tick, or the hold resets every tick and the cut never completes.
    const first = nearestTileWithin(map, 4.5, 4.5, "thicket");
    const second = nearestTileWithin(map, 4.5, 4.5, "thicket");
    expect(first).toEqual({ x: 3, y: 4 });
    expect(second).toEqual(first);
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
  const withStream = () => arena((map) => map.set(9, 8, "stream"));

  function stocked(): World {
    const world = withStream();
    world.inventory.add("stick", C.BRIDGE_STICKS);
    world.inventory.add("vine", C.BRIDGE_VINES);
    return world;
  }

  it("refuses without the materials, and says why once", () => {
    const world = withStream();
    expect(world.availableAction()).toEqual({ type: "build", x: 9, y: 8, blocked: "noMaterials" });
    expect(hudModel(world).prompt?.text).toBe("A bridge tile needs 1 vine and 1 stick");
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
    expect(hudModel(world).prompt?.text).toBe("Hold E to lay a bridge tile");
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
    expect(world.inventory.gold).toBe(1);

    world.nextSummer();

    expect(world.map.get(9, 8)).toBe(C.CUT_LEAVES);
    expect(world.map.get(4, 4)).toBe("stream");
    expect(world.inventory.gold).toBe(1);
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
    expect(world.events[world.events.length - 1]).toMatchObject({
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
    expect(summer.gold).toBe(1);
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
