import { describe, expect, it } from "vitest";
import { Sprite } from "pixi.js";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { Camera } from "../src/render/camera.ts";
import { placementsIn } from "../src/render/placements.ts";
import { ScrollWindow } from "../src/render/scrollWindow.ts";
import { TileLayer } from "../src/render/tileLayer.ts";
import { decodeSave, encodeSave } from "../src/sim/save.ts";
import { summarise } from "../src/sim/summary.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import { StubPack } from "./stubPack.ts";

const EAST: InputState = { ...NO_INPUT, moveX: 1 };
const WEST: InputState = { ...NO_INPUT, moveX: -1 };

/**
 * A field 20 by 7 with camp at (2, 2), grass round camp and `ground` from
 * column 4 on: the row camp stands on runs straight into it, with the rows
 * either side of it the same ground, so a walk can be checked for wearing only
 * its own row.
 */
function field(ground: TerrainKind = "underbrush", edge: TerrainKind = ground): World {
  const w = 20;
  const h = 7;
  const map = new TileMap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = y === 2 ? ground : edge;
      map.set(x, y, x >= 4 && y >= 1 && y <= 3 ? row : "grass");
    }
  }
  return new World({
    seed: 7,
    map,
    camp: { x: 2.5, y: 2.5 },
    nodes: [],
    springs: [],
    reachable: new Uint8Array(w * h),
  });
}

/** Walk the player along their row until their centre is past `x`, by real ticks. */
function walkTo(world: World, x: number): void {
  const input = x > world.player.x ? EAST : WEST;
  for (let i = 0; i < 10_000; i++) {
    if (input === EAST ? world.player.x >= x : world.player.x <= x) break;
    world.step(C.TICK_SEC, input);
  }
  world.step(C.TICK_SEC, NO_INPUT);
}

/**
 * The trail row, columns 4 to 15: what one walk from the start out to column
 * 16 walks over and leaves. Column 16 is where it stops, entered but not left.
 */
const TRAIL = Array.from({ length: 12 }, (_, i) => 4 + i);
const START = 3.5;
const FAR = 16.5;

/** One walk out over the trail row from its start, as a player would repeat a route. */
function pass(world: World): number {
  world.teleport(START, 2.5);
  const start = world.elapsedSec;
  walkTo(world, FAR);
  return world.elapsedSec - start;
}

/** What `pass` should take with every trail tile at `mul`: half a tile of grass, the trail, half a tile untouched. */
const passAt = (mul: number) =>
  0.5 / C.WALK_SPEED + 12 / (C.WALK_SPEED * mul) + 0.5 / (C.WALK_SPEED * C.UNDERBRUSH_SPEED_MUL);

/** The thicket tiles `cutThrough` cuts, on the trail row. */
const CUT = [4, 5, 6, 7];

/**
 * A field of thicket, cut into from the start one tile at a time with the
 * knife, walking into each cut before cutting the next, as a player does.
 */
function cutThrough(): World {
  const world = field("thicket");
  world.teleport(START, 2.5);
  for (const x of CUT) {
    // Pressing into the wall is what aims the knife at it.
    world.step(C.TICK_SEC, EAST);
    const ticks = Math.round(C.CUT_TIME / C.TICK_SEC) + 2;
    for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, { ...NO_INPUT, interact: true });
    world.step(C.TICK_SEC, NO_INPUT);
    expect(world.map.get(x, 2)).toBe(C.CUT_LEAVES);
    walkTo(world, x + 0.5);
  }
  return world;
}

describe("a trail worn by walking", () => {
  it("treads every underbrush tile the centre walks over and leaves, and makes it faster", () => {
    const world = field();
    pass(world);

    for (const x of TRAIL) {
      expect(world.wornAt(x, 2)).toBe(1);
      expect(world.trailStage(x, 2)).toBe(1);
    }
    // Standing on it is not having walked over it: the tile the walk ends on
    // is untouched, so a first crossing is at the underbrush speed.
    expect(world.trailStage(16, 2)).toBe(0);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.UNDERBRUSH_SPEED_MUL);
    // The rows either side are only brushed past, never entered.
    for (const x of TRAIL) {
      expect(world.wornAt(x, 1)).toBe(0);
      expect(world.wornAt(x, 3)).toBe(0);
    }
    world.teleport(10.5, 2.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.TRAIL_SPEED_MULS[0]);
    world.teleport(10.5, 1.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.UNDERBRUSH_SPEED_MUL);
  });

  it("wears a stage a walk, each faster, until it is flat, and stays underbrush", () => {
    const world = field();
    for (let walk = 1; walk <= C.TRAIL_STAGES + 2; walk++) {
      pass(world);
      const stage = Math.min(walk, C.TRAIL_STAGES);
      for (const x of TRAIL) {
        expect(world.trailStage(x, 2)).toBe(stage);
        expect(world.map.get(x, 2)).toBe("underbrush");
      }
      world.teleport(10.5, 2.5);
      expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.TRAIL_SPEED_MULS[stage - 1]!);
    }
    // Flat is the end: walking it more wears nothing and says nothing.
    const events = world.events.filter((e) => e.type === "trodden");
    expect(events.length).toBe(TRAIL.length * C.TRAIL_STAGES);
    for (const x of TRAIL) expect(world.wornAt(x, 2)).toBe(C.TRAIL_STAGES);
  });

  it("is quicker on each walk, at each stage's speed", () => {
    const world = field();
    const times = Array.from({ length: C.TRAIL_STAGES + 1 }, () => pass(world));
    expect(times[0]).toBeCloseTo(passAt(C.UNDERBRUSH_SPEED_MUL), 1);
    C.TRAIL_SPEED_MULS.forEach((mul, i) => expect(times[i + 1]).toBeCloseTo(passAt(mul), 1));
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeLessThan(times[i - 1]!);
  });

  it("lets a tired summer slow a trodden trail but not a flat one", () => {
    const world = field();
    world.tired = true;
    pass(world);
    world.teleport(10.5, 2.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.TRAIL_SPEED_MULS[0] * C.TIRED_ROUGH_MUL);
    for (let i = 1; i < C.TRAIL_STAGES; i++) pass(world);
    world.teleport(10.5, 2.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED);
  });

  it("does not count moving about inside one tile", () => {
    const world = field();
    world.teleport(8.5, 2.5);
    for (let i = 0; i < 10; i++) {
      walkTo(world, 8.8);
      walkTo(world, 8.2);
    }
    expect(world.wornAt(8, 2)).toBe(0);
  });

  it("leaves mud and thicket alone however often they are crossed", () => {
    const mud = field("mud");
    for (let i = 0; i < C.TRAIL_STAGES + 1; i++) pass(mud);
    for (const x of TRAIL) {
      expect(mud.map.get(x, 2)).toBe("mud");
      expect(mud.wornAt(x, 2)).toBe(0);
    }

    const thicket = field("thicket");
    pass(thicket);
    expect(thicket.player.x).toBeLessThan(4);
    expect(thicket.wornAt(4, 2)).toBe(0);
  });

  it("wears a path cut through thicket like any other underbrush", () => {
    const world = cutThrough();
    for (const x of CUT) expect(world.map.get(x, 2)).toBe("underbrush");
    // Cut and walked through once on the way in.
    for (const x of CUT.slice(0, -1)) expect(world.trailStage(x, 2)).toBe(1);
    // And back out: the last was only left once, on the way back.
    walkTo(world, START);
    for (const x of CUT) expect(world.trailStage(x, 2)).toBe(x === CUT.at(-1) ? 1 : 2);
  });

  it("forgets the trail through a cut the thicket grows back over", () => {
    const world = cutThrough();
    walkTo(world, START);
    let crept = 0;
    for (let year = 0; year < 10; year++) {
      world.endSummer();
      world.endWinter(world.winterInput(), new Set(["food", "rent"]));
      world.nextSummer();
      for (const x of CUT) {
        if (world.map.get(x, 2) !== "thicket") continue;
        crept++;
        expect(world.wornAt(x, 2)).toBe(0);
      }
    }
    expect(crept).toBeGreaterThan(0);
  });

  it("does not wear from a teleport", () => {
    const world = field();
    for (const x of TRAIL) world.teleport(x + 0.5, 2.5);
    for (const x of TRAIL) expect(world.wornAt(x, 2)).toBe(0);
  });
});

describe("a trail across winters and saves", () => {
  /** A trail worn unevenly: flat out to column 9, a stage less beyond. */
  function uneven(edge: TerrainKind = "underbrush"): World {
    const world = field("underbrush", edge);
    for (let i = 0; i < C.TRAIL_STAGES - 1; i++) pass(world);
    world.teleport(START, 2.5);
    walkTo(world, 10.5);
    return world;
  }

  function expectUneven(world: World): void {
    for (const x of TRAIL) {
      expect(world.map.get(x, 2)).toBe("underbrush");
      expect(world.trailStage(x, 2)).toBe(x < 10 ? C.TRAIL_STAGES : C.TRAIL_STAGES - 1);
    }
  }

  it("keeps every stage through winters, even against thicket", () => {
    // Thicket on both sides of the line, so creep has every chance.
    const world = uneven("thicket");
    expectUneven(world);
    for (let year = 0; year < 10; year++) {
      world.endSummer();
      world.endWinter(world.winterInput(), new Set(["food", "rent"]));
      world.nextSummer();
    }
    expectUneven(world);
  });

  it("comes back from a save with the same wear and the same ground", () => {
    const world = uneven();
    world.endSummer();
    const text = encodeSave(world.snapshot(summarise(world)));

    const restored = field();
    restored.restore(decodeSave(text));
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 7; y++) {
        expect(restored.wornAt(x, y)).toBe(world.wornAt(x, y));
        expect(restored.map.get(x, y)).toBe(world.map.get(x, y));
      }
    }
    expectUneven(restored);
  });
});

describe("a trail drawn", () => {
  /** Row 2 worn from column 4, a stage further every four columns. */
  const trail = (x: number, y: number) => (y === 2 && x >= 4 ? Math.min(1 + Math.floor((x - 4) / 4), 3) : 0);

  it("asks the pack for the trail's stage on a worn tile, and for underbrush elsewhere", () => {
    const map = new TileMap(16, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) map.set(x, y, "underbrush");
    const pack = new StubPack();
    const layer = new TileLayer(map, pack, 0, trail);
    layer.resize(10 * C.TILE, 4 * C.TILE);
    const camera = new Camera();
    camera.resize(10 * C.TILE, 4 * C.TILE);
    camera.centreOn({ x: 8, y: 3 });
    layer.update(camera);

    const window = new ScrollWindow({ left: 1, top: 1, right: 1, bottom: 1 });
    window.resize(10 * C.TILE, 4 * C.TILE);
    window.moveTo(camera.leftPx, camera.topPx);
    const expected: number[] = [];
    for (let row = 0; row < window.rows; row++) {
      for (let col = 0; col < window.cols; col++) {
        const stage = trail(window.originX + col, window.originY + row);
        if (stage > 0) expected.push(stage);
      }
    }
    expect(new Set(expected).size).toBe(3);
    const drawn = layer.container.children.filter((c): c is Sprite => c instanceof Sprite);
    expect(drawn.filter((s) => s.texture === pack.troddenTexture).length).toBe(expected.length);
    expect(pack.troddenCalls.map((c) => c.stage)).toEqual(expected);
  });

  it("stands no bush on a worn tile", () => {
    const map = new TileMap(16, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) map.set(x, y, "underbrush");
    const window = new ScrollWindow({ left: 0, top: 0, right: 0, bottom: 0 });
    window.resize(16 * C.TILE, 6 * C.TILE);
    window.moveTo(0, 0);
    const bushes = [...placementsIn(map, new StubPack(), window, { x: -5, y: -5 }, [], [], [], 0, trail)];
    expect(bushes.some((p) => Math.floor(p.worldY - 1) === 2 && p.worldX >= 4)).toBe(false);
    expect(bushes.some((p) => Math.floor(p.worldY - 1) === 2 && p.worldX < 4)).toBe(true);
  });
});
