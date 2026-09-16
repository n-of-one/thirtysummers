import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { canStand, createPlayer, facingFor, moveWithCollision } from "../src/sim/player.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { generateWorld } from "../src/sim/worldgen.ts";

/** An open map of uniform terrain, big enough for the test at hand. */
function arena(fill: TerrainKind = "grass", size = 9): TileMap {
  const map = new TileMap(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) map.set(x, y, fill);
  return map;
}

/** A World over a bare arena, with no resources or camp to get in the way. */
function worldOn(map: TileMap, spawn: { x: number; y: number }): World {
  return new World({
    seed: 1,
    map,
    camp: spawn,
    nodes: [],
    reachable: new Uint8Array(map.width * map.height),
  });
}

const still: InputState = NO_INPUT;
const east: InputState = { ...NO_INPUT, moveX: 1 };

describe("canStand", () => {
  it("allows open ground and refuses impassable tiles", () => {
    const map = arena();
    map.set(4, 4, "tree");
    expect(canStand(map, 2.5, 2.5)).toBe(true);
    expect(canStand(map, 4.5, 4.5)).toBe(false);
  });

  it("refuses a position whose body overlaps a wall even if its centre does not", () => {
    const map = arena();
    map.set(4, 4, "stream");
    // centre is in tile 3, but the body reaches into tile 4
    expect(canStand(map, 4 - C.PLAYER_RADIUS / 2, 4.5)).toBe(false);
    expect(canStand(map, 4 - C.PLAYER_RADIUS - 0.05, 4.5)).toBe(true);
  });

  it("treats everything outside the map as solid", () => {
    const map = arena();
    expect(canStand(map, -0.5, 4.5)).toBe(false);
    expect(canStand(map, 100, 4.5)).toBe(false);
  });
});

describe("moveWithCollision", () => {
  it("moves freely across open ground", () => {
    const map = arena();
    const player = createPlayer({ x: 2.5, y: 2.5 });
    const travelled = moveWithCollision(map, player, 0.1, 0);
    expect(player.x).toBeCloseTo(2.6, 6);
    expect(travelled).toBeCloseTo(0.1, 6);
  });

  it("stops at a wall instead of entering it", () => {
    const map = arena();
    map.set(4, 2, "tree");
    const player = createPlayer({ x: 3.5, y: 2.5 });
    for (let i = 0; i < 100; i++) moveWithCollision(map, player, 0.05, 0);
    expect(player.x).toBeLessThan(4 - C.PLAYER_RADIUS + 1e-6);
    expect(canStand(map, player.x, player.y)).toBe(true);
  });

  it("slides along a wall when pushed into it diagonally", () => {
    const map = arena();
    for (let y = 0; y < 9; y++) map.set(4, y, "tree"); // a wall running north-south
    // Start with the body already touching the wall: centre + radius reaches 3.99.
    const startX = 4 - C.PLAYER_RADIUS - 0.01;
    const player = createPlayer({ x: startX, y: 2.5 });
    // Push east (blocked) and south (free) at once.
    const travelled = moveWithCollision(map, player, 0.1, 0.1);
    expect(player.x).toBeCloseTo(startX, 6); // held back by the wall
    expect(player.y).toBeCloseTo(2.6, 6); // but still slid along it
    expect(travelled).toBeCloseTo(0.1, 6); // all of the motion went south
  });

  it("never tunnels through a one-tile wall at twice walking speed", () => {
    const map = arena();
    map.set(5, 4, "rock");
    const player = createPlayer({ x: 4.5, y: 4.5 });
    const step = (C.WALK_SPEED * 2) / 60;
    for (let i = 0; i < 600; i++) {
      moveWithCollision(map, player, step, 0);
      expect(map.isPassable(Math.floor(player.x), Math.floor(player.y))).toBe(true);
    }
  });
});

describe("facingFor", () => {
  it("picks the matching diagonal for each quadrant", () => {
    expect(facingFor(1, 1, "northWest")).toBe("southEast");
    expect(facingFor(-1, 1, "northEast")).toBe("southWest");
    expect(facingFor(1, -1, "southWest")).toBe("northEast");
    expect(facingFor(-1, -1, "southEast")).toBe("northWest");
  });

  it("keeps the horizontal side when moving straight up or down", () => {
    expect(facingFor(0, -1, "southEast")).toBe("northEast");
    expect(facingFor(0, -1, "southWest")).toBe("northWest");
    expect(facingFor(0, 1, "northEast")).toBe("southEast");
    expect(facingFor(0, 1, "northWest")).toBe("southWest");
  });

  it("always faces the camera when moving straight left or right", () => {
    // Only the southward poses show the face, so horizontal movement uses them
    // regardless of which way the character was facing before.
    expect(facingFor(1, 0, "northWest")).toBe("southEast");
    expect(facingFor(1, 0, "northEast")).toBe("southEast");
    expect(facingFor(-1, 0, "northEast")).toBe("southWest");
    expect(facingFor(-1, 0, "southEast")).toBe("southWest");
  });

  it("is unchanged when standing still", () => {
    expect(facingFor(0, 0, "northWest")).toBe("northWest");
    expect(facingFor(0, 0, "southEast")).toBe("southEast");
  });
});

describe("World.step", () => {
  it("advances the same distance regardless of how the time is divided", () => {
    // Wide enough that a second of walking cannot reach the map edge.
    const map = arena("grass", 64);
    const a = worldOn(map, { x: 2.5, y: 2.5 });
    const b = worldOn(map, { x: 2.5, y: 2.5 });
    for (let i = 0; i < 60; i++) a.step(1 / 60, east);
    for (let i = 0; i < 120; i++) b.step(1 / 120, east);
    expect(a.player.x).toBeCloseTo(b.player.x, 6);
    expect(a.player.x - 2.5).toBeCloseTo(C.WALK_SPEED, 6); // one second of walking
  });

  it("walks at one speed on easy ground and slower on difficult terrain", () => {
    const grass = worldOn(arena("grass"), { x: 4.5, y: 4.5 });
    const mud = worldOn(arena("mud"), { x: 4.5, y: 4.5 });
    expect(grass.speed()).toBeCloseTo(C.WALK_SPEED, 6);
    expect(mud.speed()).toBeCloseTo(grass.speed() * C.DIFFICULT_SPEED_MUL, 6);
  });

  it("reports standing still when no key is held, and when walled in", () => {
    const map = arena();
    for (let y = 0; y < 9; y++) map.set(4, y, "tree");
    const world = worldOn(map, { x: 3.5, y: 4.5 });

    world.step(1 / 60, still);
    expect(world.player.moving).toBe(false);

    for (let i = 0; i < 200; i++) world.step(1 / 60, east); // jam into the wall
    world.step(1 / 60, east);
    expect(world.player.moving).toBe(false); // pressed against it, not walking
    expect(world.player.facing).toBe("southEast");
  });

  it("spawns the player somewhere legal on a generated world", () => {
    for (const seed of [1, 42, 1337]) {
      const world = new World(generateWorld(seed));
      expect(canStand(world.map, world.player.x, world.player.y)).toBe(true);
    }
  });

  it("keeps the player on passable ground through a long random walk", () => {
    const world = World.fromSeed(1337);
    let bearingX = 1;
    let bearingY = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 90 === 0) {
        const angle = (i * 2.3994) % (Math.PI * 2); // deterministic wander
        bearingX = Math.cos(angle);
        bearingY = Math.sin(angle);
      }
      world.step(1 / 60, { ...NO_INPUT, moveX: bearingX, moveY: bearingY });
      expect(canStand(world.map, world.player.x, world.player.y)).toBe(true);
    }
  });
});
