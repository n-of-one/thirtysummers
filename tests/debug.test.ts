import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { formatReadout, gridOffset, type Readout } from "../src/debug/overlay.ts";
import { NO_INPUT } from "../src/input/keyboard.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import { World } from "../src/sim/world.ts";

/** Grass arena with a rock wall down the eastern edge. */
function world(): World {
  const map = new TileMap(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) map.set(x, y, x >= 14 ? "rock" : "grass");
  }
  return new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes: [],
    reachable: new Uint8Array(256),
  });
}

describe("gridOffset", () => {
  it("lands the grid on tile boundaries", () => {
    expect(gridOffset(0, 64)).toBe(0);
    expect(gridOffset(64, 64)).toBe(0);
    expect(gridOffset(10, 64)).toBe(-10);
    expect(gridOffset(64 * 7 + 10, 64)).toBe(-10);
  });

  it("handles a camera left of the origin, which a small map produces", () => {
    // -10 puts world pixel 0 ten pixels into the view, so the first line inside
    // the screen is at 10 -- one whole tile on from the offset.
    expect(gridOffset(-10, 64)).toBe(-54);
    expect(gridOffset(-64, 64)).toBe(0);
  });

  it("defaults to the configured tile size", () => {
    expect(gridOffset(C.TILE * 3 + 5)).toBe(-5);
  });
});

describe("formatReadout", () => {
  const base: Readout = {
    x: 64.5,
    y: 64.5,
    facing: "southEast",
    terrain: "grass",
    speed: 7,
    hydration: 100,
    elapsedSec: 0,
    seed: 1337,
    pack: "minifantasy",
    fps: 60,
  };

  /** The readout pads and labels with non-breaking spaces; see `formatReadout`. */
  const nb = (text: string) => text.replaceAll(" ", "\u00a0");

  it("says what the frame was drawn with", () => {
    const line = formatReadout(base);
    expect(line).toContain(nb("pos  64.50, 64.50"));
    expect(line).toContain(nb("on grass"));
    expect(line).toContain(nb("seed 1337"));
    expect(line).toContain(nb("pack minifantasy"));
  });

  it("only ever breaks a line between fields, never inside one", () => {
    // With `white-space: pre-wrap` every ordinary space is somewhere the line
    // may wrap. The only ones left are the pairs that separate fields.
    const line = formatReadout({ ...base, terrain: "underbrush" });
    expect(line.replaceAll("  ", "")).not.toContain(" ");
  });

  it("keeps the line exactly as long whatever the numbers do", () => {
    // The panel is as wide as this line, so a digit appearing or disappearing
    // would resize it under the cursor -- 80.0 to 80.01 being the whole point.
    const lines = [
      base,
      { ...base, x: 8, y: 8 },
      { ...base, x: 127.99, y: 0.01 },
      { ...base, facing: "northWest" as const },
      { ...base, terrain: "underbrush" as const, speed: 12.6 },
      { ...base, hydration: 9.05 },
      { ...base, elapsedSec: 900 },
      { ...base, fps: 6 },
      { ...base, fps: 144 },
    ].map(formatReadout);
    const lengths = new Set(lines.map((l) => l.length));
    expect([...lengths]).toEqual([lines[0]!.length]);
  });

  it("keeps every column in the same place, not just the total length", () => {
    const a = formatReadout(base);
    const b = formatReadout({ ...base, x: 7.5, terrain: "mud", hydration: 8, fps: 7 });
    const columnOf = (line: string, label: string) => line.indexOf(label);
    for (const label of [nb("on "), "tiles/s", nb("hyd "), "fps", nb("seed ")]) {
      expect(columnOf(b, label)).toBe(columnOf(a, label));
    }
  });

  it("puts the two fields it cannot pad at the end", () => {
    const long = formatReadout({ ...base, seed: 123456789, pack: "placeholder" });
    const short = formatReadout(base);
    // Everything up to the seed is unmoved; only the tail can grow.
    expect(long.indexOf("seed")).toBe(short.indexOf("seed"));
  });
});

describe("the freeze", () => {
  it("holds hydration and the clock still while it is set", () => {
    const w = world();
    w.stats.hydration = 60;
    w.frozen = true;
    for (let i = 0; i < 600; i++) w.step(C.TICK_SEC, NO_INPUT);
    expect(w.stats.hydration).toBe(60);
    expect(w.elapsedSec).toBe(0);
  });

  it("thaws exactly where it froze", () => {
    const w = world();
    w.frozen = true;
    for (let i = 0; i < 60; i++) w.step(C.TICK_SEC, NO_INPUT);
    w.frozen = false;
    for (let i = 0; i < 60; i++) w.step(C.TICK_SEC, NO_INPUT);
    expect(w.stats.hydration).toBeCloseTo(C.HYDRATION_MAX - C.HYDRATION_DRAIN, 6);
    expect(w.elapsedSec).toBeCloseTo(1, 6);
  });

  it("still lets the player walk and drink, so a held state can be poked at", () => {
    const w = world();
    w.map.set(2, 1, "spring");
    w.stats.hydration = 10;
    w.frozen = true;
    const drinking = { ...NO_INPUT, interact: true };
    for (let i = 0; i <= Math.ceil(C.DRINK_TIME / C.TICK_SEC); i++) w.step(C.TICK_SEC, drinking);
    expect(w.stats.hydration).toBe(C.HYDRATION_MAX);

    for (let i = 0; i < 60; i++) w.step(C.TICK_SEC, { ...NO_INPUT, moveY: 1 });
    expect(w.player.y).toBeGreaterThan(1.5);
    expect(w.elapsedSec).toBe(0);
  });
});

describe("teleport", () => {
  it("puts the player down where it is asked to", () => {
    const w = world();
    expect(w.teleport(9.25, 4.75)).toBe(true);
    expect(w.player.x).toBe(9.25);
    expect(w.player.y).toBe(4.75);
  });

  it("refuses a spot the player could not walk out of", () => {
    const w = world();
    const { x, y } = w.player;
    expect(w.teleport(14.5, 5)).toBe(false); // inside the rock wall
    expect(w.teleport(-3, 5)).toBe(false); // off the map, which reads as rock
    expect(w.player.x).toBe(x);
    expect(w.player.y).toBe(y);
  });

  it("does not count as distance walked", () => {
    const w = world();
    w.teleport(11.5, 11.5);
    expect(w.player.distanceWalked).toBe(0);
  });

  it("drops any harvest in progress rather than finishing it elsewhere", () => {
    const w = world();
    const node = { id: 1, kind: "ore" as const, x: 1.5, y: 2.5, z: 0, harvested: false };
    w.nodes.push(node);
    const hold = { ...NO_INPUT, interact: true };
    // Part-way through the pick, then away across the map.
    for (let i = 0; i < 20; i++) w.step(C.TICK_SEC, hold);
    expect(w.harvestProgress).toBeGreaterThan(0);

    w.teleport(11.5, 11.5);
    expect(w.harvestProgress).toBe(0);
    for (let i = 0; i < 20; i++) w.step(C.TICK_SEC, hold);
    expect(node.harvested).toBe(false);
    expect(w.inventory.carried).toBe(0);
  });
});
