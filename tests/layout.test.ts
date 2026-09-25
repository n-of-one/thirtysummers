import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { RESOURCES } from "../src/sim/resources.ts";
import { layoutSummerWorld } from "../src/sim/worldgen/layout.ts";
import { nearRing } from "../src/sim/worldgen/reachability.ts";
import { checkRows, cutsFromCamp, measureBrambleBay, THIN_CUTS } from "../src/sim/worldgen/rows.ts";
import { reachedDry } from "../src/sim/worldgen/springs.ts";
import { formatMap, parseMap } from "../src/sim/mapfile.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import type { Vec2 } from "../src/sim/types.ts";
import { World } from "../src/sim/world.ts";
import type { GeneratedWorld } from "../src/sim/worldgen.ts";

const INTERACT: InputState = { ...NO_INPUT, interact: true };

/** Keep `input` down for `seconds` of simulated time at the tick rate, then let go. */
function hold(world: World, input: InputState, seconds: number): void {
  world.step(C.TICK_SEC, NO_INPUT);
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, input);
  world.step(C.TICK_SEC, NO_INPUT);
}

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

  it.each(SEEDS)("puts every node on the ground its glyph implies, fruit on any it can be picked from (seed %i)", (seed) => {
    const world = mapFor(seed);
    for (const node of world.nodes) {
      const ground = world.map.get(Math.floor(node.x), Math.floor(node.y));
      // A fruit tree stands in underbrush as well as on grass, so its fruit
      // does too. A map file still puts grass under a fruit's glyph.
      if (node.kind === "fruit") expect(["grass", "underbrush", "denseUnderbrush"]).toContain(ground);
      else expect(ground).toBe(RESOURCES[node.kind].ground);
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

  it.each(SEEDS)("hangs every fruit on a tree, on walkable ground, reachable on foot (seed %i)", (seed) => {
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
      for (const f of tree.fruit) {
        expect(["grass", "underbrush", "denseUnderbrush"]).toContain(world.map.get(f.x, f.y));
      }
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
    expect(reach(world, cut, "stick", THIN_CUTS)).toBe(C.LAYOUT_NODES.brambleBaySticks);
  });

  describe("the bramble bay", () => {
    /** Where the sticks lie: the middle of them, in tiles from camp and degrees off north. */
    const whereFrom = (world: GeneratedWorld) => {
      const sticks = world.nodes.filter((n) => n.kind === "stick");
      const x = sticks.reduce((s, n) => s + n.x, 0) / sticks.length;
      const y = sticks.reduce((s, n) => s + n.y, 0) / sticks.length;
      return {
        x,
        y,
        out: Math.hypot(x - world.camp.x, y - world.camp.y),
        angle: (Math.atan2(x - world.camp.x, world.camp.y - y) * 180) / Math.PI,
      };
    };

    /**
     * The cheapest way onto the floor, outside in: the tile it enters the
     * floor at, and the thicket tiles cut on the way, each with the step it is
     * cut from. Walked back from the floor along the 0-1 fill's own costs.
     */
    const thinnestPath = (world: GeneratedWorld) => {
      const { map } = world;
      const W = map.width;
      const bay = measureBrambleBay(world);
      const cost = cutsFromCamp(world, { bridge: false, fell: false }, bay.floor);
      let at = -1;
      for (const i of bay.floor) if (at < 0 || cost[i]! < cost[at]!) at = i;
      const cuts: { x: number; y: number; dx: number; dy: number }[] = [];
      let here = at;
      while (cost[here]! > 0 || map.get(here % W, Math.floor(here / W)) === "thicket") {
        const x = here % W;
        const y = Math.floor(here / W);
        const paid = map.get(x, y) === "thicket" ? 1 : 0;
        const from = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .map(([dx, dy]) => ({ dx, dy, n: (y + dy) * W + x + dx }))
          .find(({ n }) => !bay.floor.has(n) && cost[n]! + paid === cost[here]!)!;
        if (paid) cuts.unshift({ x, y, dx: -from.dx, dy: -from.dy });
        here = from.n;
      }
      return { bay, at, cuts };
    };

    it("lands in different parts of the ring on different seeds", () => {
      const spots = SEEDS.map((seed) => whereFrom(mapFor(seed)));
      // Both sides of the way north out of camp, and near and far.
      expect(spots.some((s) => s.angle < -20)).toBe(true);
      expect(spots.some((s) => s.angle > 20)).toBe(true);
      const outs = spots.map((s) => s.out);
      expect(Math.max(...outs) - Math.min(...outs)).toBeGreaterThan(15);
    });

    it.each(SEEDS)("is a floor that is not a disc, in brambles with an uneven edge (seed %i)", (seed) => {
      const world = mapFor(seed);
      const { map } = world;
      const W = map.width;
      const { floor } = measureBrambleBay(world);
      const tiles = [...floor].map((i) => ({ x: i % W, y: Math.floor(i / W) }));
      const cx = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
      const cy = tiles.reduce((s, t) => s + t.y, 0) / tiles.length;
      const far = tiles.reduce((r, t) => Math.max(r, Math.hypot(t.x - cx, t.y - cy)), 0);
      expect(floor.size / (Math.PI * (far + 0.5) ** 2)).toBeLessThan(0.8);

      // How far the brambles reach from the floor's middle, looking out along
      // 32 directions: the furthest thicket tile before a stretch of four
      // tiles with none. A ring at a fixed depth reaches the same distance
      // every way.
      const reach: number[] = [];
      for (let r = 0; r < 32; r++) {
        const a = (r / 32) * Math.PI * 2;
        let last = 0;
        for (let s = 1; s < 30 && s - last <= 4; s++) {
          if (map.get(Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s)) === "thicket") last = s;
        }
        reach.push(last);
      }
      expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(4);
    });

    it.each(SEEDS)("leaves no saplings in the near ring (seed %i)", (seed) => {
      const world = mapFor(seed);
      const ring = nearRing(world.map, world.camp);
      let saplings = 0;
      for (let i = 0; i < ring.length; i++) {
        if (ring[i] && world.map.get(i % world.map.width, Math.floor(i / world.map.width)) === "sapling") saplings++;
      }
      expect(saplings).toBe(0);
    });

    describe("its row fails a bramble bay that does not hold", () => {
      const row = (world: GeneratedWorld) =>
        checkRows(world).find(
          (r) => r.label === "the sticks lie in one bramble bay, in brambles about as deep all round",
        )!;
      const others = (world: GeneratedWorld) =>
        checkRows(world).find((r) => r.label === "nothing but sticks in the bramble bay")!;
      const edited = (world: GeneratedWorld): GeneratedWorld => ({
        ...world,
        map: world.map.clone(),
        nodes: world.nodes.map((n) => ({ ...n })),
      });

      it.each(SEEDS.slice(0, 5))("holds as generated (seed %i)", (seed) => {
        expect(row(mapFor(seed)).ok).toBe(true);
        expect(others(mapFor(seed)).ok).toBe(true);
      });

      it.each(SEEDS.slice(0, 5))("with its thinnest way in cut down to one tile (seed %i)", (seed) => {
        const world = edited(mapFor(seed));
        const { cuts } = thinnestPath(world);
        expect(cuts.length).toBe(C.BRAMBLE_BAY_THINNEST);
        for (const c of cuts.slice(0, -1)) world.map.set(c.x, c.y, "underbrush");
        expect(row(world).ok).toBe(false);
      });

      it.each(SEEDS.slice(0, 5))("with thick brambles everywhere but its thinnest way in (seed %i)", (seed) => {
        // What the first playtests had: one thin way in, and every other side
        // so deep that only one approach made sense.
        const world = edited(mapFor(seed));
        const { map } = world;
        const W = map.width;
        const { bay, cuts } = thinnestPath(world);
        const keep = new Set(cuts.map((c) => c.y * W + c.x));
        const steps = new Map<number, number>([...bay.floor].map((i) => [i, 0]));
        const queue = [...bay.floor];
        for (let head = 0; head < queue.length; head++) {
          const i = queue[head]!;
          const d = steps.get(i)!;
          if (d >= 10) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const x = (i % W) + dx;
            const y = Math.floor(i / W) + dy;
            const n = y * W + x;
            const kind = map.get(x, y);
            if (steps.has(n) || kind === "stream" || kind === "rock") continue;
            steps.set(n, d + 1);
            queue.push(n);
            if (!keep.has(n) && kind !== "tree") map.set(x, y, "thicket");
          }
        }
        // The thinnest way in stays as it was, and a clear run leads up to
        // its outermost cut from outside the new brambles.
        const first = cuts[0]!;
        for (let s = 1; s <= 12; s++) {
          const x = first.x - first.dx * s;
          const y = first.y - first.dy * s;
          if (map.get(x, y) === "thicket") map.set(x, y, "underbrush");
        }
        expect(measureBrambleBay(world).thinnest).toBe(C.BRAMBLE_BAY_THINNEST);
        expect(row(world).ok).toBe(false);
      });

      it.each(SEEDS.slice(0, 5))("with a feather on its floor (seed %i)", (seed) => {
        const world = edited(mapFor(seed));
        const { floor } = measureBrambleBay(world);
        const stick = world.nodes.find((n) => n.kind === "stick")!;
        const free = [...floor].find(
          (i) => !world.nodes.some((n) => Math.floor(n.y) * world.map.width + Math.floor(n.x) === i),
        )!;
        world.nodes.push({
          ...stick,
          id: world.nodes.length + 1,
          kind: "feather",
          x: (free % world.map.width) + 0.5,
          y: Math.floor(free / world.map.width) + 0.5,
        });
        expect(others(world).ok).toBe(false);
      });
    });

    it("grows back over a cut through the brambles", () => {
      // The knife cuts the cheapest way in on each seed, the sticks can then
      // be walked to, and after one winter some of what was cut is thicket
      // again: every tile of a cut through the brambles has thicket beside it.
      let cut = 0;
      let back = 0;
      for (const seed of SEEDS) {
        // The world plays on the generated map itself, so the fill below
        // sees what the knife did.
        const generated = layoutSummerWorld(seed);
        const world = new World(generated);
        const { cuts, at } = thinnestPath(generated);
        for (const c of cuts) {
          expect(world.teleport(c.x + 0.5 - c.dx, c.y + 0.5 - c.dy)).toBe(true);
          world.player.heading = { x: c.dx, y: c.dy };
          hold(world, INTERACT, C.CUT_TIME + 0.1);
          expect(world.map.get(c.x, c.y)).toBe(C.CUT_LEAVES);
        }
        expect(cutsFromCamp(generated, { bridge: false, fell: false })[at]).toBe(0);
        world.endSummer();
        world.nextSummer();
        cut += cuts.length;
        back += cuts.filter((c) => world.map.get(c.x, c.y) === "thicket").length;
      }
      expect(cut).toBe(SEEDS.length * C.BRAMBLE_BAY_THINNEST);
      expect(back).toBeGreaterThan(0);
      expect(back).toBeLessThan(cut);
    });
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

  it.each(SEEDS)("never puts a spring in mud, or behind it (seed %i)", (seed) => {
    const world = mapFor(seed);
    const dry = reachedDry(world.map, world.camp);
    for (const s of world.springs) {
      expect(world.map.get(s.x, s.y)).not.toBe("mud");
      expect(dry[s.y * world.map.width + s.x]).toBe(1);
    }
  });

  describe("the ring's mud", () => {
    /** Steps from the nearest stream tile, for every tile. */
    const fromWater = (world: GeneratedWorld): Int32Array => {
      const { map } = world;
      const dist = new Int32Array(map.width * map.height).fill(-1);
      const queue: number[] = [];
      for (let i = 0; i < dist.length; i++) {
        if (map.get(i % map.width, Math.floor(i / map.width)) === "stream") {
          dist[i] = 0;
          queue.push(i);
        }
      }
      for (let head = 0; head < queue.length; head++) {
        const i = queue[head]!;
        const x = i % map.width;
        const y = (i - x) / map.width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (x + dx < 0 || y + dy < 0 || x + dx >= map.width || y + dy >= map.height) continue;
          const n = (y + dy) * map.width + x + dx;
          if (dist[n]! >= 0) continue;
          dist[n] = dist[i]! + 1;
          queue.push(n);
        }
      }
      return dist;
    };

    it.each(SEEDS)("is more than the one pocket the ring used to have (seed %i)", (seed) => {
      const world = mapFor(seed);
      const ring = nearRing(world.map, world.camp);
      let tiles = 0;
      let mud = 0;
      for (let i = 0; i < ring.length; i++) {
        if (!ring[i]) continue;
        tiles++;
        if (world.map.get(i % world.map.width, Math.floor(i / world.map.width)) === "mud") mud++;
      }
      // The disc alone was about 4% of the ring. The ring's own ground needs
      // wetter ground for mud than the valley does; measured, every test seed
      // has 4.3% or more, and 8% on average.
      expect(mud / tiles).toBeGreaterThan(0.04);
    });

    it("gathers by the water", () => {
      // Over the spread, the mud within WET_REACH of water is a larger share
      // of the mud than that ground is of the ring. Measured, about 1.5 times.
      let byWater = 0;
      let area = 0;
      for (const seed of SEEDS) {
        const world = mapFor(seed);
        const ring = nearRing(world.map, world.camp);
        const dist = fromWater(world);
        let tiles = 0;
        let near = 0;
        let mud = 0;
        let mudNear = 0;
        for (let i = 0; i < ring.length; i++) {
          if (!ring[i]) continue;
          const isNear = dist[i]! <= C.WET_REACH;
          tiles++;
          if (isNear) near++;
          if (world.map.get(i % world.map.width, Math.floor(i / world.map.width)) !== "mud") continue;
          mud++;
          if (isNear) mudNear++;
        }
        byWater += mudNear / mud;
        area += near / tiles;
      }
      expect(byWater / area).toBeGreaterThan(1.3);
    });

    it.each(SEEDS)("has a pocket for the vines that is not a stamped disc (seed %i)", (seed) => {
      const world = mapFor(seed);
      const { map } = world;
      const ring = nearRing(map, world.camp);
      const vine = world.nodes.find((n) => n.kind === "vine")!;
      // The patch of the ring's mud the vines are in.
      const patch: Vec2[] = [];
      const seen = new Set<string>();
      const stack = [{ x: Math.floor(vine.x), y: Math.floor(vine.y) }];
      seen.add(tileKey(stack[0]!));
      while (stack.length > 0) {
        const t = stack.pop()!;
        patch.push(t);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = { x: t.x + dx, y: t.y + dy };
          if (seen.has(tileKey(n)) || map.get(n.x, n.y) !== "mud" || !ring[n.y * map.width + n.x]) continue;
          seen.add(tileKey(n));
          stack.push(n);
        }
      }
      const cx = patch.reduce((s, t) => s + t.x, 0) / patch.length;
      const cy = patch.reduce((s, t) => s + t.y, 0) / patch.length;
      const far = patch.reduce((r, t) => Math.max(r, Math.hypot(t.x - cx, t.y - cy)), 0);
      // The old disc filled 87% of the circle round it; measured, no test seed
      // now fills more than 59%.
      expect(patch.length / (Math.PI * (far + 0.5) ** 2)).toBeLessThan(0.8);
    });
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
