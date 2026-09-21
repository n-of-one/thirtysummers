import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { Stats } from "../src/sim/stats.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";

/** Run `seconds` of simulated time at the real tick rate. */
function run(stats: Stats, seconds: number): Stats {
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) stats.step(C.TICK_SEC);
  return stats;
}

describe("Stats — hydration", () => {
  it("starts full", () => {
    expect(new Stats().hydration).toBe(C.HYDRATION_MAX);
  });

  it("empties a full bar at the drain rate, and goes no lower", () => {
    const stats = new Stats();
    const empty = C.HYDRATION_MAX / C.HYDRATION_DRAIN;
    run(stats, empty / 2);
    expect(stats.hydration).toBeCloseTo(C.HYDRATION_MAX / 2, 6);
    run(stats, empty / 2);
    expect(stats.hydration).toBeCloseTo(0, 6);
    run(stats, 10);
    expect(stats.hydration).toBe(0);
  });

  it("runs dry long before the summer is out, so water has to be found", () => {
    // Comfortably more than one refill a summer, so hydration is a reason to
    // route past water rather than a bar that happens to empty as the light goes.
    expect(C.HYDRATION_MAX / C.HYDRATION_DRAIN).toBeLessThan(C.SUMMER_LENGTH_SEC / 2);
  });

  it("fills to full on a drink", () => {
    const stats = new Stats();
    stats.hydration = 3;
    stats.drink();
    expect(stats.hydration).toBe(C.HYDRATION_MAX);
  });
});

/** A 64-tile map of one terrain, with whatever the test paints over it. */
function worldOn(fill: TerrainKind = "grass", paint: (map: TileMap) => void = () => {}): World {
  const size = 64;
  const map = new TileMap(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) map.set(x, y, fill);
  paint(map);
  return new World({
    seed: 1,
    map,
    camp: { x: 32.5, y: 32.5 },
    nodes: [],
    springs: [],
    reachable: new Uint8Array(size * size),
  });
}

/** Stand the player at (x, y), without walking there. */
function at(world: World, x: number, y = 32.5): World {
  world.player.x = x;
  world.player.y = y;
  return world;
}

/** A band of mud five tiles wide, x = 10 to 14, the full height of the map. */
function mudBand(map: TileMap): void {
  for (let y = 0; y < map.height; y++) for (let x = 10; x <= 14; x++) map.set(x, y, "mud");
}

const still: InputState = NO_INPUT;
const east: InputState = { ...NO_INPUT, moveX: 1 };

/** Step with `input` until `done` says so, or give up after a minute of game time. */
function walkUntil(world: World, input: InputState, done: () => boolean): void {
  for (let i = 0; i < 60 * 60 && !done(); i++) world.step(C.TICK_SEC, input);
}

/** Hold `input` for `seconds` of simulated time at the real tick rate. */
function hold(world: World, input: InputState, seconds: number): void {
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, input);
}

describe("World — rough ground", () => {
  it("moves at walking speed on grass and slower in mud", () => {
    expect(worldOn("grass").speed()).toBeCloseTo(C.WALK_SPEED, 6);
    expect(worldOn("mud").speed()).toBeCloseTo(C.WALK_SPEED * C.DIFFICULT_SPEED_MUL, 6);
  });

  it("wades through at DIFFICULT_SPEED_MUL", () => {
    const world = at(worldOn("grass", mudBand), 10.5);
    hold(world, east, 1);
    expect(world.player.x).toBeCloseTo(10.5 + C.WALK_SPEED * C.DIFFICULT_SPEED_MUL, 6);
  });

  it("never refuses a step into it", () => {
    const world = at(worldOn("grass", mudBand), 8.5);
    walkUntil(world, east, () => world.player.x >= 20);
    expect(world.player.x).toBeGreaterThanOrEqual(20);
  });

  it("costs nothing but time: hydration and the clock run as they do standing still", () => {
    const wading = at(worldOn("grass", mudBand), 10.5);
    const standing = at(worldOn("grass"), 10.5);
    hold(wading, east, 1);
    hold(standing, still, 1);
    expect(wading.stats.hydration).toBe(standing.stats.hydration);
    expect(wading.elapsedSec).toBe(standing.elapsedSec);
  });
});

describe("World — the end of a summer", () => {
  it("counts down in real seconds and ends at zero", () => {
    const world = worldOn("grass");
    expect(world.remainingSec).toBe(C.SUMMER_LENGTH_SEC);
    expect(world.summerOver).toBe(false);

    for (let i = 0; i < 60 * 60; i++) world.step(C.TICK_SEC, still);
    expect(world.remainingSec).toBeCloseTo(C.SUMMER_LENGTH_SEC - 60, 6);

    const ticks = Math.ceil(C.SUMMER_LENGTH_SEC / C.TICK_SEC);
    for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, still);
    expect(world.elapsedSec).toBe(C.SUMMER_LENGTH_SEC);
    expect(world.remainingSec).toBe(0);
    expect(world.summerOver).toBe(true);
  });

  it("banks the whole pack when the clock stops, and flags ending away from camp", () => {
    const world = at(worldOn(), 8.5);
    world.inventory.add("ore", 3);
    world.inventory.add("fruit", 1);
    world.inventory.add("stick", 1);
    world.elapsedSec = C.SUMMER_LENGTH_SEC - C.TICK_SEC / 2;
    world.step(C.TICK_SEC, still);

    expect(world.summerOver).toBe(true);
    expect(world.store.count("ore")).toBe(3);
    expect(world.inventory.count("ore")).toBe(0);
    expect(world.inventory.count("fruit")).toBe(0);
    expect(world.store.count("fruit")).toBe(1);
    // The stick goes into the store with the fruit: camp takes everything.
    expect(world.inventory.count("stick")).toBe(0);
    expect(world.store.count("stick")).toBe(1);
    expect(world.awayAtEnd).toBe(true);
    expect(world.events[world.events.length - 1]).toEqual({
      type: "summerEnded",
      away: true,
      stored: 5,
      at: C.SUMMER_LENGTH_SEC,
    });
  });

  it("ends early from camp, and that is not away", () => {
    const world = worldOn(); // the player starts at camp
    world.endSummer();
    expect(world.summerOver).toBe(true);
    expect(world.awayAtEnd).toBe(false);
    expect(world.remainingSec).toBeGreaterThan(0);
  });

  it("does nothing once the summer has ended", () => {
    const world = at(worldOn(), 8.5);
    world.endSummer();
    const { x } = world.player;
    const { elapsedSec } = world;
    hold(world, east, 1);
    expect(world.player.x).toBe(x);
    expect(world.elapsedSec).toBe(elapsedSec);
    world.endSummer();
    expect(world.events.filter((e) => e.type === "summerEnded")).toHaveLength(1);
  });

  it("starts the next summer with full hydration, and keeps the away flag for winter", () => {
    const world = at(worldOn(), 8.5);
    world.stats.hydration = 3;
    world.endSummer();
    world.nextSummer();
    expect(world.summerOver).toBe(false);
    expect(world.stats.hydration).toBe(C.HYDRATION_MAX);
    expect(world.awayAtEnd).toBe(true);
  });
});
