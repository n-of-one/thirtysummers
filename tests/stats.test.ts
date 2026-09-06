import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { Stats, type Effort } from "../src/sim/stats.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";

/** Run `seconds` of simulated time at the real tick rate. */
function run(stats: Stats, effort: Effort, seconds: number): Stats {
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) stats.step(C.TICK_SEC, effort);
  return stats;
}

/** Stats at a chosen starting point, so a rule can be watched away from the caps. */
function at(stamina: number, hydration = 100): Stats {
  const stats = new Stats();
  stats.stamina = stamina;
  stats.hydration = hydration;
  return stats;
}

describe("Stats — the design doc's stamina rates", () => {
  it("starts both bars full", () => {
    const stats = new Stats();
    expect(stats.stamina).toBe(100);
    expect(stats.hydration).toBe(100);
    expect(stats.canEat).toBe(true);
  });

  it("drops 5%/s while sprinting", () => {
    expect(run(at(100), "sprinting", 10).stamina).toBeCloseTo(50, 6);
  });

  it("drops 1%/s over difficult terrain", () => {
    expect(run(at(100), "difficult", 10).stamina).toBeCloseTo(90, 6);
  });

  it("restores 0.2%/s walking over easy terrain", () => {
    expect(run(at(50), "walking", 10).stamina).toBeCloseTo(52, 6);
  });

  it("restores 1%/s standing still while watered", () => {
    expect(run(at(50), "standing", 10).stamina).toBeCloseTo(60, 6);
  });

  it("restores 0.5%/s standing still once parched", () => {
    expect(run(at(50, 40), "standing", 10).stamina).toBeCloseTo(55, 6);
  });

  it("empties after 20 seconds of sprinting from full, and goes no lower", () => {
    const stats = at(100);
    run(stats, "sprinting", 20);
    expect(stats.stamina).toBeCloseTo(0, 6);
    run(stats, "sprinting", 5);
    expect(stats.stamina).toBe(0);
    expect(stats.exhausted).toBe(true);
  });

  it("never recovers past 100", () => {
    expect(run(at(99), "standing", 60).stamina).toBe(100);
  });

  it("recovers twice as fast rested and watered as rested and dry", () => {
    const watered = run(at(20, 100), "standing", 20).stamina - 20;
    const dry = run(at(20, 10), "standing", 20).stamina - 20;
    expect(watered).toBeCloseTo(dry * 2, 6);
  });

  it("charges the sprint rate, not the sum, when sprinting over difficult ground", () => {
    // The doc gives one rate per situation and never says they stack.
    expect(run(at(100), "sprinting", 10).stamina).toBeCloseTo(50, 6);
  });

  it("gives the same answer however the time is chopped up", () => {
    const coarse = new Stats();
    const fine = new Stats();
    for (let i = 0; i < 600; i++) coarse.step(1 / 60, "sprinting");
    for (let i = 0; i < 1200; i++) fine.step(1 / 120, "sprinting");
    expect(coarse.stamina).toBeCloseTo(fine.stamina, 9);
    expect(coarse.hydration).toBeCloseTo(fine.hydration, 9);
  });
});

describe("Stats — hydration", () => {
  it("empties a full bar in 100 seconds", () => {
    const stats = new Stats();
    run(stats, "standing", 50);
    expect(stats.hydration).toBeCloseTo(50, 6);
    run(stats, "standing", 50);
    expect(stats.hydration).toBeCloseTo(0, 6);
  });

  it("runs dry long before the summer is out, so water has to be found", () => {
    const stats = new Stats();
    run(stats, "standing", C.SUMMER_LENGTH_SEC);
    expect(stats.hydration).toBe(0);
    // Comfortably more than one refill a summer, so hydration is a reason to
    // route past water rather than a bar that happens to empty as the light goes.
    expect(100 / C.HYDRATION_DRAIN).toBeLessThan(C.SUMMER_LENGTH_SEC / 2);
  });

  it("halves the resting rate below 50% rather than stopping it", () => {
    const stats = at(40, 49);
    run(stats, "standing", 10);
    expect(stats.stamina).toBeCloseTo(45, 6);
  });

  it("counts exactly 50% as parched, since the doc only rules on either side", () => {
    const stats = at(40, C.HYDRATION_LOW_THRESHOLD);
    expect(stats.parched).toBe(true);
    run(stats, "standing", 10);
    expect(stats.stamina).toBeCloseTo(45, 6);
  });

  it("does not gate the cost of effort, or the gain from walking, on hydration", () => {
    expect(run(at(100, 40), "sprinting", 10).stamina).toBeCloseTo(50, 6);
    expect(run(at(100, 40), "difficult", 10).stamina).toBeCloseTo(90, 6);
    expect(run(at(50, 40), "walking", 10).stamina).toBeCloseTo(52, 6);
  });

  it("costs nothing extra at zero: running dry only halves the rest", () => {
    const stats = at(50, 0);
    run(stats, "standing", 10);
    expect(stats.stamina).toBeCloseTo(55, 6);
  });

  it("never drains below zero", () => {
    const stats = at(100, 5);
    run(stats, "standing", 200);
    expect(stats.hydration).toBe(0);
  });
});

describe("Stats — eating and the full stomach", () => {
  it("restores 20% stamina and starts the 60s cooldown", () => {
    const stats = at(30);
    expect(stats.eat()).toBe(true);
    expect(stats.stamina).toBe(50);
    expect(stats.stomachCooldownSec).toBe(C.FULL_STOMACH_SEC);
    expect(stats.canEat).toBe(false);
  });

  it("refuses a second helping until the cooldown runs out", () => {
    const stats = at(30);
    stats.eat();
    run(stats, "standing", 59);
    expect(stats.canEat).toBe(false);
    expect(stats.eat()).toBe(false);
    expect(stats.stomachCooldownSec).toBeCloseTo(1, 6);

    run(stats, "standing", 1.1);
    expect(stats.stomachCooldownSec).toBe(0);
    expect(stats.canEat).toBe(true);
    expect(stats.eat()).toBe(true);
  });

  it("leaves stamina alone when the meal is refused", () => {
    const stats = at(30);
    stats.eat();
    const after = stats.stamina;
    expect(stats.eat()).toBe(false);
    expect(stats.stamina).toBe(after);
  });

  it("caps a meal at full rather than overflowing", () => {
    const stats = at(95);
    stats.eat();
    expect(stats.stamina).toBe(100);
  });
});

describe("Stats — drinking", () => {
  it("restores 50% hydration, with no cooldown", () => {
    const stats = at(100, 10);
    stats.drink();
    expect(stats.hydration).toBe(60);
    stats.drink();
    expect(stats.hydration).toBe(100); // capped, not 110
  });

  it("buys 50 seconds of drinking-nothing before it is needed again", () => {
    const stats = at(100, 0);
    stats.drink();
    run(stats, "standing", C.WATER_HYDRATION / C.HYDRATION_DRAIN);
    expect(stats.hydration).toBeCloseTo(0, 6);
  });
});

/** An open map of uniform terrain. */
function arena(fill: TerrainKind = "grass", size = 64): TileMap {
  const map = new TileMap(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) map.set(x, y, fill);
  return map;
}

function worldOn(fill: TerrainKind): World {
  const map = arena(fill);
  return new World({
    seed: 1,
    map,
    camp: { x: 32.5, y: 32.5 },
    nodes: [],
    reachable: new Uint8Array(map.width * map.height),
  });
}

const still: InputState = NO_INPUT;
const walkEast: InputState = { ...NO_INPUT, moveX: 1 };
const sprintEast: InputState = { ...NO_INPUT, moveX: 1, sprint: true };

describe("World — which stamina rule a tick uses", () => {
  it("recovers while standing still and while walking on grass", () => {
    const world = worldOn("grass");
    world.stats.stamina = 50;
    for (let i = 0; i < 60; i++) world.step(C.TICK_SEC, still);
    expect(world.stats.stamina).toBeCloseTo(51, 6); // watered, so the fast rate
    for (let i = 0; i < 60; i++) world.step(C.TICK_SEC, walkEast);
    expect(world.stats.stamina).toBeCloseTo(51.2, 6);
  });

  it("drains while walking through mud", () => {
    const world = worldOn("mud");
    for (let i = 0; i < 600; i++) world.step(C.TICK_SEC, walkEast);
    expect(world.stats.stamina).toBeCloseTo(90, 6);
  });

  it("counts a blocked shove as standing still, not as sprinting", () => {
    const world = worldOn("grass");
    for (let y = 0; y < world.map.height; y++) world.map.set(33, y, "tree");
    world.player.x = 33 - C.PLAYER_RADIUS - 0.001;
    world.stats.stamina = 50;
    for (let i = 0; i < 60; i++) world.step(C.TICK_SEC, sprintEast);
    expect(world.player.moving).toBe(false);
    expect(world.stats.stamina).toBeCloseTo(51, 6);
  });

  it("stops the player sprinting once stamina runs out", () => {
    const world = worldOn("grass");
    // Turn round every second so a 30-second run never reaches the map edge --
    // hitting a wall would stop the sprint for the wrong reason.
    for (let i = 0; i < 60 * 30; i++) {
      const east = Math.floor(i / 60) % 2 === 0;
      world.step(C.TICK_SEC, { ...NO_INPUT, moveX: east ? 1 : -1, sprint: true });
    }
    expect(world.stats.stamina).toBeLessThanOrEqual(C.SPRINT_MIN_STAMINA);
    expect(world.player.sprinting).toBe(false);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED, 6); // walking, not sprinting
  });
});

describe("World — the day clock", () => {
  it("counts down in real seconds and stops at zero", () => {
    const world = worldOn("grass");
    expect(world.remainingSec).toBe(C.SUMMER_LENGTH_SEC);
    expect(world.dayOver).toBe(false);

    for (let i = 0; i < 60 * 60; i++) world.step(C.TICK_SEC, still);
    expect(world.remainingSec).toBeCloseTo(C.SUMMER_LENGTH_SEC - 60, 6);

    const ticks = Math.ceil(C.SUMMER_LENGTH_SEC / C.TICK_SEC);
    for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, still);
    expect(world.elapsedSec).toBe(C.SUMMER_LENGTH_SEC);
    expect(world.remainingSec).toBe(0);
    expect(world.dayOver).toBe(true);
  });
});
