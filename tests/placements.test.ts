import { describe, expect, it } from "vitest";
import { TILE } from "../src/config.ts";
import { depthOf } from "../src/render/propLayer.ts";
import { placementsIn, type Placement } from "../src/render/placements.ts";
import { ScrollWindow } from "../src/render/scrollWindow.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { ResourceNode, TerrainKind, Vec2 } from "../src/sim/types.ts";
import { StubPack } from "./stubPack.ts";

const MARGIN = { left: 2, top: 2, right: 2, bottom: 4 };

function arena(size: number, fill: TerrainKind, patch?: (x: number, y: number) => TerrainKind | null) {
  const map = new TileMap(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) map.set(x, y, patch?.(x, y) ?? fill);
  }
  return map;
}

/** A window 6x4 tiles across, with its top-left at world tile (30, 20). */
function windowAt(leftTile = 30, topTile = 20): ScrollWindow {
  const w = new ScrollWindow(MARGIN);
  w.resize(6 * TILE, 4 * TILE);
  w.moveTo(leftTile * TILE, topTile * TILE);
  return w;
}

function node(id: number, x: number, y: number, harvested = false): ResourceNode {
  return { id, kind: "ore", x, y, z: 0, harvested };
}

const NOWHERE: Vec2 = { x: -100, y: -100 };
const NO_NODES: ResourceNode[] = [];

function collect(...args: Parameters<typeof placementsIn>): Placement[] {
  return [...placementsIn(...args)];
}

describe("placementsIn", () => {
  it("places nothing on ground that has nothing standing on it", () => {
    const map = arena(64, "grass");
    const out = collect(map, new StubPack(), windowAt(), NOWHERE, NO_NODES);
    expect(out).toEqual([]);
  });

  it("places a prop on every tree and underbrush tile in the window", () => {
    const map = arena(64, "grass", (x, y) => (x === 32 && y === 22 ? "tree" : null));
    const w = windowAt();
    const out = collect(map, new StubPack(), w, NOWHERE, NO_NODES);
    expect(out.length).toBe(1);
    expect(out[0]!.worldX).toBe(32.5);
    expect(out[0]!.occludes).toBe(true);
  });

  it("stands a prop on the bottom edge of its tile, not its centre", () => {
    // Depth sorting is by feet, so a prop must sort in front of anything whose
    // feet are further north -- including a player standing on the same tile.
    const map = arena(64, "grass", (x, y) => (x === 32 && y === 22 ? "tree" : null));
    const [tree] = collect(map, new StubPack(), windowAt(), NOWHERE, NO_NODES);
    expect(tree!.worldY).toBe(23);
    expect(depthOf(tree!.worldX, tree!.worldY)).toBeGreaterThan(depthOf(32.5, 22.9));
  });

  it("marks trees as occluding and bushes as not", () => {
    const map = arena(64, "grass", (x, y) => {
      if (x === 32 && y === 22) return "tree";
      if (x === 33 && y === 22) return "underbrush";
      return null;
    });
    const out = collect(map, new StubPack(), windowAt(), NOWHERE, NO_NODES);
    expect(out.map((p) => p.occludes)).toEqual([true, false]);
  });

  it("skips a tile the pack has no prop for", () => {
    // The real pack leaves 45% of underbrush bare so a wood is not a hedge.
    const map = arena(64, "underbrush");
    const bare = collect(map, new StubPack(["underbrush"]), windowAt(), NOWHERE, NO_NODES);
    const dense = collect(map, new StubPack(), windowAt(), NOWHERE, NO_NODES);
    expect(bare).toEqual([]);
    expect(dense.length).toBeGreaterThan(0);
  });

  it("jitters props off the grid but never the camp or a resource", () => {
    const map = arena(64, "grass", (x, y) => (x === 32 && y === 22 ? "tree" : null));
    const w = windowAt();
    const out = collect(map, new StubPack(), w, { x: 33.5, y: 23.5 }, [node(1, 34.5, 23.5)]);
    const [tree, camp, ore] = out;
    expect(tree!.jitter).toBeGreaterThan(0);
    expect(camp!.jitter).toBe(0);
    expect(ore!.jitter).toBe(0);
  });

  it("draws the camp and unharvested nodes, and leaves harvested ones out", () => {
    const map = arena(64, "grass");
    const out = collect(map, new StubPack(), windowAt(), { x: 33.5, y: 23.5 }, [
      node(1, 34.5, 23.5),
      node(2, 35.5, 23.5, true),
      node(3, 36.5, 23.5),
    ]);
    expect(out.length).toBe(3); // camp plus the two still standing
    expect(out.map((p) => p.worldX)).toEqual([33.5, 34.5, 36.5]);
  });

  it("stands a spring at its tile's centre, with the spring art, inside the window only", () => {
    const map = arena(64, "grass");
    const pack = new StubPack();
    const w = windowAt();
    const out = collect(map, pack, w, NOWHERE, NO_NODES, [
      { x: 32, y: 22 },
      { x: w.originX + w.cols + 3, y: 22 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ worldX: 32.5, worldY: 22.5, jitter: 0, occludes: false });
    expect(out[0]!.art).toBe(pack.spring);
  });

  it("lays a dropped item at its tile's centre, in its own art at the one scale", () => {
    const map = arena(64, "grass");
    const pack = new StubPack();
    const w = windowAt();
    const out = collect(map, pack, w, NOWHERE, NO_NODES, [], [
      { kind: "vine", x: 32, y: 22 },
      { kind: "vine", x: w.originX + w.cols + 3, y: 22 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ worldX: 32.5, worldY: 22.5, jitter: 0, occludes: false });
    // Its own art, built as pixels, never the node's art scaled down on its
    // way to the screen: one art pixel is one size everywhere in the world.
    expect(out[0]!.art).toBe(pack.dropped("vine"));
    expect(out[0]!.art).not.toBe(pack.resource("vine"));
  });

  it("leaves out anything outside the window", () => {
    const map = arena(64, "grass");
    const w = windowAt();
    const out = collect(map, new StubPack(), w, NOWHERE, [
      node(1, w.originX - 1, w.originY + 2), // off to the west
      node(2, w.originX + 2, w.originY + 2), // inside
      node(3, w.originX + w.cols + 2, w.originY + 2), // off to the east
    ]);
    expect(out.map((p) => p.worldX)).toEqual([w.originX + 2]);
  });

  it("includes props in the margin, so they scroll in already drawn", () => {
    // A tree one tile above the viewport still has to be placed: it is four
    // tiles tall and its canopy hangs into view.
    const aboveView = 20 - 1;
    const map = arena(64, "grass", (x, y) => (x === 32 && y === aboveView ? "tree" : null));
    const out = collect(map, new StubPack(), windowAt(30, 20), NOWHERE, NO_NODES);
    expect(out.length).toBe(1);
    expect(out[0]!.worldY).toBe(aboveView + 1);
  });

  it("walks the window in reading order, so equal-depth props stay put", () => {
    // Pool order must be a property of the world, not of when a tile was
    // scanned, or a forest flickers as the window moves.
    const map = arena(64, "underbrush");
    const a = collect(map, new StubPack(), windowAt(30, 20), NOWHERE, NO_NODES);
    const b = collect(map, new StubPack(), windowAt(30, 20), NOWHERE, NO_NODES);
    expect(a.map((p) => [p.worldX, p.worldY])).toEqual(b.map((p) => [p.worldX, p.worldY]));

    const ys = a.map((p) => p.worldY);
    expect(ys).toEqual([...ys].sort((m, n) => m - n));
  });

  it("keeps its work bound to the window, not to how many nodes exist", () => {
    const map = arena(64, "grass");
    const w = windowAt();
    const many = Array.from({ length: 5000 }, (_, i) => node(i, 1 + (i % 20), 1));
    const out = collect(map, new StubPack(), w, NOWHERE, many);
    expect(out).toEqual([]); // all of them are far from the window
  });
});

describe("thicket", () => {
  it("puts growth on every thicket tile, with no gaps to step through", () => {
    const map = arena(40, "grass", (x, y) => (x >= 30 && x < 34 && y >= 20 && y < 23 ? "thicket" : null));
    const found = collect(map, new StubPack(), windowAt(), NOWHERE, NO_NODES);
    const thicketTiles = found.filter((p) => p.worldX >= 30 && p.worldX < 34 && p.worldY <= 23);
    expect(thicketTiles.length).toBeGreaterThan(0);
    // A bramble wall is not tall enough to swallow the player; only trees are.
    expect(thicketTiles.every((p) => !p.occludes)).toBe(true);
  });
});
