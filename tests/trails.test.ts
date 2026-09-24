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

/** Seconds of ticks to walk from where the player is to `x`. */
function timeTo(world: World, x: number): number {
  const start = world.elapsedSec;
  walkTo(world, x);
  return world.elapsedSec - start;
}

/**
 * The trail row, columns 4 to 15: what a walk from camp out to column 16 and
 * back walks over. Column 16 is where it turns, entered once and left once.
 */
const TRAIL = Array.from({ length: 12 }, (_, i) => 4 + i);
const FAR = 16.5;

describe("a trail worn by walking", () => {
  it("treads every underbrush tile the centre walks over and leaves, and makes it faster", () => {
    const world = field();
    walkTo(world, FAR);

    for (const x of TRAIL) {
      expect(world.wornAt(x, 2)).toBe(1);
      expect(world.trodden(x, 2)).toBe(true);
      expect(world.map.get(x, 2)).toBe("underbrush");
    }
    // Standing on it is not having walked over it: the tile the walk ends on
    // is not trodden yet, so a first crossing is at the underbrush speed.
    expect(world.wornAt(16, 2)).toBe(0);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.UNDERBRUSH_SPEED_MUL);
    // The rows either side are only brushed past, never entered.
    for (const x of TRAIL) {
      expect(world.wornAt(x, 1)).toBe(0);
      expect(world.wornAt(x, 3)).toBe(0);
    }
    world.teleport(10.5, 2.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.TRAIL_SPEED_MUL);
    world.teleport(10.5, 1.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.UNDERBRUSH_SPEED_MUL);
  });

  it("wears the line through to grass on the next walk, and nothing beside it", () => {
    const world = field();
    walkTo(world, FAR);
    walkTo(world, 3.5);

    for (const x of TRAIL) expect(world.map.get(x, 2)).toBe("grass");
    for (const x of TRAIL) {
      expect(world.map.get(x, 1)).toBe("underbrush");
      expect(world.map.get(x, 3)).toBe("underbrush");
    }
    // Where it turned was walked over once, on the way back.
    expect(world.trodden(16, 2)).toBe(true);
    // Each tile gives way once, and says so.
    const grassed = world.events.filter((e) => e.type === "trodden" && e.grass);
    expect(grassed.length).toBe(TRAIL.length);
  });

  it("is quicker on the second walk and quicker again on grass", () => {
    const world = field();
    const first = timeTo(world, FAR);
    walkTo(world, 3.5);
    // The way out and the way back have made the line grass, so this third
    // walk over it is the grass one.
    const third = timeTo(world, FAR);

    const once = field();
    walkTo(once, FAR);
    once.teleport(3.5, 2.5);
    const second = timeTo(once, FAR);

    // Camp to column 16: 1.5 tiles of grass, then 12.5 of what the walk wore.
    const at = (mul: number) => 1.5 / C.WALK_SPEED + 12.5 / (C.WALK_SPEED * mul);
    expect(first).toBeCloseTo(at(C.UNDERBRUSH_SPEED_MUL), 1);
    expect(second).toBeLessThan(first);
    expect(third).toBeLessThan(second);
    expect(third).toBeLessThan(at(C.TRAIL_SPEED_MUL));
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
    for (let i = 0; i < 3; i++) {
      walkTo(mud, FAR);
      walkTo(mud, 3.5);
    }
    for (const x of TRAIL) {
      expect(mud.map.get(x, 2)).toBe("mud");
      expect(mud.wornAt(x, 2)).toBe(0);
    }

    const thicket = field("thicket");
    walkTo(thicket, FAR);
    expect(thicket.player.x).toBeLessThan(4);
    expect(thicket.wornAt(4, 2)).toBe(0);
  });

  it("does not wear from a teleport", () => {
    const world = field();
    for (const x of TRAIL) world.teleport(x + 0.5, 2.5);
    for (const x of TRAIL) expect(world.wornAt(x, 2)).toBe(0);
  });
});

describe("a trail across winters and saves", () => {
  /** A trail half worn: out to column 16 and back to column 9, which leaves 10 onwards. */
  function halfWorn(edge: TerrainKind = "underbrush"): World {
    const world = field("underbrush", edge);
    walkTo(world, FAR);
    walkTo(world, 9.5);
    return world;
  }

  function expectHalfWorn(world: World): void {
    for (const x of TRAIL) {
      if (x >= 10) expect(world.map.get(x, 2)).toBe("grass");
      else expect(world.trodden(x, 2)).toBe(true);
    }
  }

  it("keeps trodden and grass tiles through winters, even against thicket", () => {
    // Thicket on both sides of the line, so creep has every chance.
    const world = halfWorn("thicket");
    expectHalfWorn(world);
    for (let year = 0; year < 10; year++) {
      world.endSummer();
      world.endWinter(world.winterInput(), new Set(["food", "rent"]));
      world.nextSummer();
    }
    expectHalfWorn(world);
  });

  it("comes back from a save with the same wear and the same ground", () => {
    const world = halfWorn();
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
    expectHalfWorn(restored);
  });
});

describe("a trail drawn", () => {
  const worn = (x: number, y: number) => y === 2 && x >= 4;

  it("asks the pack for trodden ground on a trodden tile, and for underbrush elsewhere", () => {
    const map = new TileMap(12, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) map.set(x, y, "underbrush");
    const pack = new StubPack();
    const layer = new TileLayer(map, pack, 0, worn);
    layer.resize(6 * C.TILE, 4 * C.TILE);
    const camera = new Camera();
    camera.resize(6 * C.TILE, 4 * C.TILE);
    camera.centreOn({ x: 6, y: 3 });
    layer.update(camera);

    const drawn = layer.container.children.filter((c): c is Sprite => c instanceof Sprite);
    const trodden = drawn.filter((s) => s.texture === pack.troddenTexture);
    const window = new ScrollWindow({ left: 1, top: 1, right: 1, bottom: 1 });
    window.resize(6 * C.TILE, 4 * C.TILE);
    window.moveTo(camera.leftPx, camera.topPx);
    let expected = 0;
    for (let row = 0; row < window.rows; row++) {
      for (let col = 0; col < window.cols; col++) {
        if (worn(window.originX + col, window.originY + row)) expected++;
      }
    }
    expect(expected).toBeGreaterThan(0);
    expect(trodden.length).toBe(expected);
    expect(pack.troddenCalls.length).toBe(expected);
  });

  it("stands no bush on a trodden tile", () => {
    const map = new TileMap(12, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) map.set(x, y, "underbrush");
    const window = new ScrollWindow({ left: 0, top: 0, right: 0, bottom: 0 });
    window.resize(12 * C.TILE, 6 * C.TILE);
    window.moveTo(0, 0);
    const bushes = [...placementsIn(map, new StubPack(), window, { x: -5, y: -5 }, [], [], [], 0, worn)];
    expect(bushes.some((p) => Math.floor(p.worldY - 1) === 2 && p.worldX >= 4)).toBe(false);
    expect(bushes.some((p) => Math.floor(p.worldY - 1) === 2 && p.worldX < 4)).toBe(true);
  });
});
