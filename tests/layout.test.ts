import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { RESOURCES } from "../src/sim/resources.ts";
import { layoutSummerWorld } from "../src/sim/worldgen/layout.ts";
import { nearRing } from "../src/sim/worldgen/reachability.ts";
import { checkRows, cutsFromCamp, THIN_CUTS } from "../src/sim/worldgen/rows.ts";
import { formatMap, parseMap } from "../src/sim/mapfile.ts";
import type { Vec2 } from "../src/sim/types.ts";
import type { GeneratedWorld } from "../src/sim/worldgen.ts";

/**
 * A spread of seeds rather than one: the layout is jittered and mirrored by
 * the seed, so one seed proves only that one arrangement holds. This is the
 * whole guarantee behind playing seeds rather than shipped map files, so it
 * is a spread wide enough to mean something.
 */
const SEEDS = [1337, 2026, 31, 555, 808, 7, 99, 1, 2, 3, 12, 64, 128, 404, 777, 9001, 5150, 42, 2718, 31415];

/** One world per seed: every test here wants the same map, and building it is
 *  the slow part. */
const built = new Map<number, GeneratedWorld>();
const mapFor = (n: number): GeneratedWorld => {
  const had = built.get(n);
  if (had) return had;
  const made = layoutSummerWorld(n);
  built.set(n, made);
  return made;
};

const key = (x: number, y: number) => `${x},${y}`;
const tileKey = (n: { x: number; y: number }) => key(Math.floor(n.x), Math.floor(n.y));

/** The eight tiles round one, the ground a tree's fruit stands on. */
const around = (x: number, y: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
};

/**
 * The fruit trees, found the way a player finds them: a knot of fruit with a
 * tree in the middle of it.
 *
 * Nothing in the data says a tree and a fruit belong together, so the fruit is
 * clustered instead. A canopy is under three tiles across and two trees stand
 * at least `NEAR_RING_SPACING - 1` apart, so a knot belongs to one tree, and
 * the trunk is the tree tile that touches every fruit in it. A tree the
 * landscape happened to grow beside one cannot touch the whole knot, since the
 * ground all round a planted trunk is open.
 */
const fruitTrees = (world: GeneratedWorld): { at: Vec2; fruit: Vec2[] }[] => {
  const fruit = world.nodes
    .filter((n) => n.kind === "fruit")
    .map((n) => ({ x: Math.floor(n.x), y: Math.floor(n.y) }));
  const left = new Set(fruit.map((f) => key(f.x, f.y)));
  const out: { at: Vec2; fruit: Vec2[] }[] = [];

  for (const seedFruit of fruit) {
    if (!left.has(key(seedFruit.x, seedFruit.y))) continue;
    const knot: Vec2[] = [];
    const queue = [seedFruit];
    left.delete(key(seedFruit.x, seedFruit.y));
    while (queue.length > 0) {
      const here = queue.pop()!;
      knot.push(here);
      for (const f of fruit) {
        if (!left.has(key(f.x, f.y))) continue;
        if (Math.hypot(f.x - here.x, f.y - here.y) > 2.9) continue;
        left.delete(key(f.x, f.y));
        queue.push(f);
      }
    }
    const trunk = around(knot[0]!.x, knot[0]!.y).find(
      (t) =>
        world.map.get(t.x, t.y) === "tree" &&
        knot.every((f) => Math.abs(f.x - t.x) <= 1 && Math.abs(f.y - t.y) <= 1),
    );
    if (trunk) out.push({ at: trunk, fruit: knot });
  }
  return out;
};

describe("the five-summer layout", () => {
  it.each(SEEDS)("holds every row of the table (seed %i)", (seed) => {
    const rows = checkRows(mapFor(seed));
    expect(rows.filter((row) => !row.ok).map((row) => `${row.summer}: ${row.label} (${row.detail})`))
      .toEqual([]);
  });

  it("is the same map for the same seed, and another for another", () => {
    expect(formatMap(layoutSummerWorld(42))).toBe(formatMap(layoutSummerWorld(42)));
    expect(formatMap(layoutSummerWorld(42))).not.toBe(formatMap(layoutSummerWorld(43)));
  });

  it("round trips through the map file, which is what the shipped maps are", () => {
    const world = layoutSummerWorld(1337);
    const parsed = parseMap(formatMap(world));
    expect(formatMap(parsed)).toBe(formatMap(world));
    expect(parsed.springs).toEqual(world.springs);
  });

  it.each(SEEDS)("puts every node on the ground its glyph implies (seed %i)", (seed) => {
    const world = mapFor(seed);
    for (const node of world.nodes) {
      expect(world.map.get(Math.floor(node.x), Math.floor(node.y))).toBe(RESOURCES[node.kind].ground);
    }
  });

  it.each(SEEDS)("gives the first summer a near ring to explore (seed %i)", (seed) => {
    const world = mapFor(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    let walkable = 0;
    for (let i = 0; i < onFoot.length; i++) if (onFoot[i] === 0) walkable++;
    // The ring it replaced was a half circle of radius 20 with the strip below
    // camp, about a thousand tiles gross and some 850 of them walkable. Six
    // times that is what this asks for.
    expect(walkable).toBeGreaterThan(850 * 6);
  });

  it.each(SEEDS)("spreads the near ring's nodes out rather than clumping them (seed %i)", (seed) => {
    const world = mapFor(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    const inRing = world.nodes.filter(
      (n) =>
        (n.kind === "fruit" || n.kind === "feather") &&
        onFoot[Math.floor(n.y) * world.map.width + Math.floor(n.x)] === 0,
    );
    expect(inRing.length).toBe(C.LAYOUT_NODES.nearRingFruit + C.LAYOUT_NODES.nearRingFeathers);

    // What is held apart is the stops, not the nodes: a tree's fruit is
    // meant to stand together, and that is the whole point of the tree. So
    // every fruit answers for its trunk, and a feather for itself. The spacing
    // loses a tile that way, since a feather keeps its distance from the fruit
    // rather than from the trunk they hang on.
    const trunk = new Map<string, Vec2>();
    for (const tree of fruitTrees(world)) {
      for (const f of tree.fruit) trunk.set(key(f.x, f.y), tree.at);
    }
    const stops = new Map<string, Vec2>();
    for (const n of inRing) {
      const at = trunk.get(tileKey(n)) ?? { x: Math.floor(n.x), y: Math.floor(n.y) };
      stops.set(key(at.x, at.y), at);
    }
    expect(stops.size).toBe(C.LAYOUT_NODES.nearRingTrees + C.LAYOUT_NODES.nearRingFeathers);
    for (const a of stops.values()) {
      for (const b of stops.values()) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(C.NEAR_RING_SPACING - 1);
      }
    }
  });

  it.each(SEEDS)("hangs every fruit on a tree, on open ground, reachable on foot (seed %i)", (seed) => {
    const world = mapFor(seed);
    const trees = fruitTrees(world);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    const N = C.LAYOUT_NODES;

    expect(trees.length).toBe(N.nearRingTrees + N.featherFieldTrees);
    // Every fruit on the map is under one of them: no fruit is scattered any
    // more, and no tree has lost one to the ground it stands on.
    const under = new Set(trees.flatMap((t) => t.fruit.map((f) => key(f.x, f.y))));
    expect(world.nodes.filter((n) => n.kind === "fruit").map(tileKey).sort()).toEqual(
      [...under].sort(),
    );

    // Open tiles, every one of them walked to on foot with nothing cut: the
    // ring's food is a handful of stops, not a wall to be opened. Across the
    // stream the same trunk is behind the bridge, which is what makes it
    // summer 2's.
    const cost = (f: Vec2) => onFoot[f.y * world.map.width + f.x]!;
    const inRing = trees.filter((t) => t.fruit.every((f) => cost(f) === 0));
    expect(inRing.length).toBe(N.nearRingTrees);
    for (const tree of trees) {
      for (const f of tree.fruit) expect(world.map.get(f.x, f.y)).toBe("grass");
    }

    // The ring's fruit is shared out between its trees, unevenly but inside
    // the bounds, and the tree across the stream has its own.
    expect(inRing.reduce((n, t) => n + t.fruit.length, 0)).toBe(N.nearRingFruit);
    for (const tree of trees) {
      expect(tree.fruit.length).toBeGreaterThanOrEqual(C.FRUIT_PER_TREE_MIN);
      expect(tree.fruit.length).toBeLessThanOrEqual(C.FRUIT_PER_TREE_MAX);
    }
    for (const tree of trees.filter((t) => !inRing.includes(t))) {
      expect(tree.fruit.every((f) => cost(f) === Infinity)).toBe(true);
    }
  });

  it.each(SEEDS)("keeps a tree's fruit in front of it, and at most one behind (seed %i)", (seed) => {
    // A tree is drawn from the foot of its trunk upwards, so a fruit on the
    // row north of it is under the canopy. Three fruit or fewer are all in the
    // open; a fourth is sometimes hidden, and never more than that one.
    const world = mapFor(seed);
    for (const tree of fruitTrees(world)) {
      const behind = tree.fruit.filter((f) => f.y < tree.at.y);
      expect(behind.length).toBeLessThanOrEqual(1);
      if (tree.fruit.length <= 3) expect(behind.length).toBe(0);

      // And nothing else is drawn over them: a tree or a sapling on the row
      // south of a fruit covers it the same way its own trunk would, so the
      // ground there is kept clear of both.
      for (const f of tree.fruit) {
        for (let dx = -1; dx <= 1; dx++) {
          const at = { x: f.x + dx, y: f.y + 1 };
          if (at.x === tree.at.x && at.y === tree.at.y) continue;
          expect(world.map.get(at.x, at.y)).not.toBe("tree");
          expect(world.map.get(at.x, at.y)).not.toBe("sapling");
        }
      }
    }
  });

  it("hangs a different number of fruit on different trees, in different places", () => {
    const trees = SEEDS.flatMap((seed) => fruitTrees(mapFor(seed)));
    // Both ends of the range are reached, so the fruit is shared out rather
    // than divided evenly: a tree is a place, not a count.
    const sizes = new Set(trees.map((t) => t.fruit.length));
    expect(sizes.has(C.FRUIT_PER_TREE_MIN)).toBe(true);
    expect(sizes.has(C.FRUIT_PER_TREE_MAX)).toBe(true);
    // And the fruit of two trees with the same number of it is not the same
    // rosette every time: the tiles it hangs on are shuffled.
    const shapes = new Set(
      trees.map((t) =>
        t.fruit
          .map((f) => `${f.x - t.at.x},${f.y - t.at.y}`)
          .sort()
          .join(" "),
      ),
    );
    expect(shapes.size).toBeGreaterThan(sizes.size);
    // Some tree, somewhere in the spread, does hide one behind its trunk.
    expect(trees.some((t) => t.fruit.some((f) => f.y < t.at.y))).toBe(true);
  });

  it.each(SEEDS)("leaves the vines open to wade to, and walls the sticks (seed %i)", (seed) => {
    const world = mapFor(seed);
    const onFoot = cutsFromCamp(world, { bridge: false, fell: false });
    const cut = cutsFromCamp(world, { bridge: false, fell: false });
    const reach = (w: GeneratedWorld, cost: Float64Array, kind: string, cuts: number) =>
      w.nodes.filter(
        (n) => n.kind === kind && cost[Math.floor(n.y) * w.map.width + Math.floor(n.x)]! <= cuts,
      ).length;

    expect(reach(world, onFoot, "vine", 0)).toBe(C.LAYOUT_NODES.pocketVines);
    expect(reach(world, onFoot, "stick", 0)).toBe(0);
    expect(reach(world, cut, "stick", THIN_CUTS)).toBe(C.LAYOUT_NODES.standSticks);
  });

  it.each(SEEDS)("keeps every vine well inside the mud, never on its rim (seed %i)", (seed) => {
    const world = mapFor(seed);
    const vines = world.nodes.filter((n) => n.kind === "vine");
    expect(vines.length).toBe(C.LAYOUT_NODES.pocketVines);
    for (const vine of vines) {
      const x = Math.floor(vine.x);
      const y = Math.floor(vine.y);
      for (let dy = -C.MUD_VINE_INSET; dy <= C.MUD_VINE_INSET; dy++) {
        for (let dx = -C.MUD_VINE_INSET; dx <= C.MUD_VINE_INSET; dx++) {
          expect(world.map.get(x + dx, y + dy)).toBe("mud");
        }
      }
    }
  });

  it.each(SEEDS)("puts every feather field node across the stream, and every shell behind the copse (seed %i)", (seed) => {
    const world = mapFor(seed);
    const at = (cost: Float64Array, kind: string) =>
      world.nodes.filter(
        (n) => n.kind === kind && cost[Math.floor(n.y) * world.map.width + Math.floor(n.x)]! <= THIN_CUTS,
      ).length;
    const home = cutsFromCamp(world, { bridge: false, fell: false });
    const bridged = cutsFromCamp(world, { bridge: true, fell: false });
    const felled = cutsFromCamp(world, { bridge: true, fell: true });
    const N = C.LAYOUT_NODES;

    expect(at(bridged, "feather") - at(home, "feather")).toBe(N.featherFieldFeathers);
    expect(at(bridged, "fruit") - at(home, "fruit")).toBe(N.featherFieldFruit);
    expect(at(bridged, "shell")).toBe(0);
    expect(at(felled, "shell")).toBe(N.shellFieldShells);
    expect(world.nodes.filter((n) => n.kind === "ore")).toEqual([]);
  });

  it.each(SEEDS)("measures the near ring from the map, and a bridge does not move it (seed %i)", (seed) => {
    const generated = mapFor(seed);
    const ring = nearRing(generated.map, generated.camp);
    const home = cutsFromCamp(generated, { bridge: false, fell: false });
    const w = generated.map.width;
    // Every node the first summer can reach is in the ring, and none of the
    // fields across the stream is.
    for (const n of generated.nodes) {
      const i = Math.floor(n.y) * w + Math.floor(n.x);
      expect(ring[i] === 1).toBe(home[i]! <= THIN_CUTS);
    }
    const stream = generated.map.clone();
    let bridged = 0;
    for (let i = 0; i < ring.length && bridged < 4; i++) {
      if (stream.get(i % w, Math.floor(i / w)) === "stream") {
        stream.set(i % w, Math.floor(i / w), "bridge");
        bridged++;
      }
    }
    expect(nearRing(stream, generated.camp)).toEqual(ring);
  });
});
