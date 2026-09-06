import { describe, expect, it } from "vitest";
import { Sprite } from "pixi.js";
import { TILE } from "../src/config.ts";
import { Camera } from "../src/render/camera.ts";
import { E, N, NE, NW, S, SE, SW, W } from "../src/render/packs/autotile.ts";
import { TileLayer } from "../src/render/tileLayer.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { TerrainKind } from "../src/sim/types.ts";
import { StubPack } from "./stubPack.ts";

/** A map of `fill`, with `patch` painted in wherever the callback says so. */
function arena(
  size: number,
  fill: TerrainKind,
  patch?: (x: number, y: number) => TerrainKind | null,
): TileMap {
  const map = new TileMap(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      map.set(x, y, patch?.(x, y) ?? fill);
    }
  }
  return map;
}

/** A camera 6x4 tiles across, looking at the given world position. */
function cameraAt(x: number, y: number): Camera {
  const camera = new Camera();
  camera.resize(6 * TILE, 4 * TILE);
  camera.centreOn({ x, y });
  return camera;
}

function scene(map: TileMap, propless: TerrainKind[] = []) {
  const pack = new StubPack(propless);
  const layer = new TileLayer(map, pack);
  layer.resize(6 * TILE, 4 * TILE);
  return { pack, layer };
}

/** The sprites of a layer, in pool order, as the layer laid them out. */
function sprites(layer: TileLayer): Sprite[] {
  return layer.container.children.filter((c): c is Sprite => c instanceof Sprite);
}

describe("TileLayer", () => {
  it("builds one sprite per tile of the window, laid out in a grid", () => {
    const { layer } = scene(arena(64, "grass"));
    // 6x4 tiles of view, plus one tile of margin on every side.
    expect(sprites(layer).length).toBe(8 * 6);

    const pool = sprites(layer);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        const sprite = pool[row * 8 + col]!;
        expect(sprite.x).toBe(col * TILE);
        expect(sprite.y).toBe(row * TILE);
      }
    }
  });

  it("shows each pool slot the tile that belongs there", () => {
    // A diagonal stripe of mud, so no two rows look alike.
    const map = arena(64, "grass", (x, y) => (x === y ? "mud" : null));
    const { pack, layer } = scene(map);
    const camera = cameraAt(30.5, 30.5);
    layer.update(camera);

    const pool = sprites(layer);
    const originX = Math.floor(camera.leftPx / TILE) - 1;
    const originY = Math.floor(camera.topPx / TILE) - 1;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        const kind = map.get(originX + col, originY + row);
        expect(pool[row * 8 + col]!.texture).toBe(pack.groundTextures.get(kind));
      }
    }
    // The stripe really is in there, or the assertion above proves nothing.
    expect(pack.groundCalls.some((c) => c.kind === "mud")).toBe(true);
    expect(pack.groundCalls.some((c) => c.kind === "grass")).toBe(true);
  });

  it("reads past the map edge as rock, so the border autotiles against it", () => {
    const map = arena(8, "grass");
    const { pack, layer } = scene(map);
    layer.update(cameraAt(1, 1)); // clamped nowhere; the window hangs off the map
    expect(pack.groundCalls.some((c) => c.kind === "rock")).toBe(true);
  });

  it("passes the 8-neighbour mask of the surface, not of the terrain", () => {
    // One tree in a field of underbrush. They are one surface, so the tree's
    // mask must be fully connected rather than isolated.
    const map = arena(64, "underbrush", (x, y) => (x === 30 && y === 30 ? "tree" : null));
    const { pack, layer } = scene(map);
    layer.update(cameraAt(30.5, 30.5));

    const tree = pack.groundCalls.find((c) => c.kind === "tree");
    expect(tree).toBeDefined();
    expect(tree!.mask).toBe(N | E | S | W | NE | SE | SW | NW);
  });

  it("gives an isolated tile a mask of nothing", () => {
    const map = arena(64, "grass", (x, y) => (x === 30 && y === 30 ? "mud" : null));
    const { pack, layer } = scene(map);
    layer.update(cameraAt(30.5, 30.5));

    const mud = pack.groundCalls.find((c) => c.kind === "mud");
    expect(mud!.mask).toBe(0);
  });

  it("refills only when the camera crosses a tile boundary", () => {
    const { pack, layer } = scene(arena(64, "grass"));
    const camera = cameraAt(30, 30);
    layer.update(camera);
    const perRefill = pack.groundCalls.length;
    expect(perRefill).toBe(8 * 6);

    // A third of a tile: same tiles, so nothing is re-textured.
    camera.centreOn({ x: 30 + 1 / 3, y: 30 });
    layer.update(camera);
    camera.centreOn({ x: 30 + 2 / 3, y: 30 });
    layer.update(camera);
    expect(pack.groundCalls.length).toBe(perRefill);

    // Over the boundary, and it refills exactly once.
    camera.centreOn({ x: 31, y: 30 });
    layer.update(camera);
    expect(pack.groundCalls.length).toBe(perRefill * 2);
  });

  it("scrolls by shifting the container, so a sprite lands where the camera says", () => {
    const { layer } = scene(arena(64, "grass"));
    const camera = cameraAt(30 + 19 / TILE, 12 + 7 / TILE);
    layer.update(camera);

    const originX = Math.floor(camera.leftPx / TILE) - 1;
    const originY = Math.floor(camera.topPx / TILE) - 1;
    const pool = sprites(layer);
    for (const [row, col] of [
      [0, 0],
      [2, 3],
      [5, 7],
    ]) {
      const sprite = pool[row! * 8 + col!]!;
      const screenX = sprite.x + layer.container.x;
      const screenY = sprite.y + layer.container.y;
      expect(screenX).toBeCloseTo((originX + col!) * TILE - camera.leftPx, 6);
      expect(screenY).toBeCloseTo((originY + row!) * TILE - camera.topPx, 6);
    }
  });

  it("refills when the water animation advances, without the camera moving", () => {
    const { pack, layer } = scene(arena(64, "stream"));
    const camera = cameraAt(30, 30);
    layer.update(camera);
    const perRefill = pack.groundCalls.length;

    layer.update(camera);
    expect(pack.groundCalls.length).toBe(perRefill);

    layer.setAnimationFrame(1);
    layer.update(camera);
    expect(pack.groundCalls.length).toBe(perRefill * 2);
    expect(pack.groundCalls.at(-1)!.frame).toBe(1);
  });

  it("keeps its sprite count bound to the viewport, not the map", () => {
    const small = new TileLayer(arena(32, "grass"), new StubPack());
    const huge = new TileLayer(arena(512, "grass"), new StubPack());
    small.resize(6 * TILE, 4 * TILE);
    huge.resize(6 * TILE, 4 * TILE);
    expect(sprites(huge).length).toBe(sprites(small).length);
  });

  it("rebuilds the pool when the viewport grows, and reuses it when it does not", () => {
    const { layer } = scene(arena(64, "grass"));
    expect(sprites(layer).length).toBe(8 * 6);
    layer.resize(6 * TILE - 4, 4 * TILE); // same tile count
    expect(sprites(layer).length).toBe(8 * 6);
    layer.resize(12 * TILE, 4 * TILE);
    expect(sprites(layer).length).toBe(14 * 6);
  });
});

describe("invalidate", () => {
  it("re-textures the pool without the camera moving", () => {
    // Cutting a thicket changes the ground under a standing player. The pool
    // only re-textures when the window scrolls, so without this the tile stays
    // drawn as thicket until the player walks -- which is the one moment the
    // change most needs to be visible.
    const map = arena(40, "grass", (x, y) => (x === 20 && y === 20 ? "thicket" : null));
    const { pack, layer } = scene(map);
    const camera = cameraAt(20.5, 20.5);
    layer.update(camera);
    expect(pack.groundCalls.some((c) => c.kind === "thicket")).toBe(true);

    map.set(20, 20, "grass");
    pack.groundCalls.length = 0;
    layer.update(camera);
    expect(pack.groundCalls).toHaveLength(0);

    layer.invalidate();
    layer.update(camera);
    expect(pack.groundCalls.some((c) => c.kind === "thicket")).toBe(false);
    expect(pack.groundCalls.some((c) => c.kind === "grass")).toBe(true);
  });
});

describe("thicket", () => {
  it("autotiles as one surface with the wood around it", () => {
    // A thicket is undergrowth grown too dense to walk through, so a wall of it
    // has to meet the wood it stands in without a transition back to grass.
    const map = arena(40, "grass", (x) => (x === 20 ? "thicket" : x === 21 ? "underbrush" : null));
    const { pack, layer } = scene(map);
    layer.update(cameraAt(20.5, 20.5));
    const call = pack.groundCalls.find((c) => c.kind === "thicket")!;
    expect(call.mask & E).toBe(E);
    // ...and still ends where the open grass begins.
    expect(call.mask & W).toBe(0);
  });
});
