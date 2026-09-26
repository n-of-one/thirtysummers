import * as C from "../../config.ts";
import { perfectPlayer, referencePlayer, type MapCounts } from "../economy.ts";
import { RESOURCES } from "../resources.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceKind, ResourceNode } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";
import { nearRing } from "./reachability.ts";
import { thickenStream } from "./water.ts";
import type { GeneratedWorld } from "../worldgen.ts";

/**
 * Does a map hold the table of the first three summers?
 *
 * Each summer opens one thing, and each barrier is short in the one currency
 * the summer before supplied (docs/current/five-summers.md). A map either
 * holds that chain or it does not, and the failure is invisible until someone
 * plays it and simply walks in -- so it is measured rather than eyeballed,
 * whether the map came out of the layout pass or was edited by hand.
 *
 * The map is filled from camp the way the player gets about in each summer: on
 * foot; with thin thicket cut; with the stream bridged; and with the saplings
 * felled. The fill counts how many thicket tiles the cheapest way to each tile
 * cuts, so thin thicket is told apart by its depth rather than by where it is,
 * and the bramble bay by what it costs to cut onto its floor from each side.
 *
 * The last rows are the economy: the perfect player played over the map's
 * counts through the winter model, so a number changed in config shows up
 * here as a margin.
 */
export interface Row {
  /** The summer this stands for, or 0 for a rule that is not a summer's. */
  summer: number;
  label: string;
  ok: boolean;
  /** The numbers behind it, for a person reading the output. */
  detail: string;
  /**
   * A row about a field of the table: the bramble bay, the vines, the
   * feather field, the copse and the shells, and the economy they pay for.
   * M10.6a builds the valley without them, so these rows are off until
   * M10.6b puts the fields back.
   */
  field?: true;
}

/** Most thicket a thin ring may take to cut through: "about three tiles". */
export const THIN_CUTS = 4;

/** How the player can get about: what is open besides walkable ground. */
interface Means {
  bridge: boolean;
  fell: boolean;
}

/**
 * The fewest thicket tiles cut to reach each tile from camp, or Infinity.
 *
 * A 0-1 breadth-first search: a step onto walkable ground costs nothing, onto
 * thicket one cut, and a stream or a sapling is walkable only when `means`
 * says so. A tile in `stopAt` is reached but never gone on from, so what it
 * costs is what it costs to get onto it from outside.
 */
export function cutsFromCamp(
  world: GeneratedWorld,
  means: Means,
  stopAt?: ReadonlySet<number>,
): Float64Array {
  const { map } = world;
  const grid = new Grid(map.width, map.height);
  const cost = new Float64Array(grid.size).fill(Infinity);
  const start = grid.index(Math.floor(world.camp.x), Math.floor(world.camp.y));
  const deque = new Int32Array(grid.size * 4 + 8);
  let head = grid.size * 2;
  let tail = head;
  cost[start] = 0;
  deque[tail++] = start;

  while (head < tail) {
    const idx = deque[head++]!;
    if (stopAt?.has(idx)) continue;
    const x = grid.xOf(idx);
    const y = grid.yOf(idx);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.contains(nx, ny)) continue;
      const kind = map.get(nx, ny);
      const step =
        map.isPassable(nx, ny) ||
        (means.bridge && kind === "stream") ||
        (means.fell && kind === "sapling")
          ? 0
          : kind === "thicket"
            ? 1
            : Infinity;
      if (step === Infinity) continue;
      const nIdx = grid.index(nx, ny);
      if (cost[idx]! + step >= cost[nIdx]!) continue;
      cost[nIdx] = cost[idx]! + step;
      if (step === 0) deque[--head] = nIdx;
      else deque[tail++] = nIdx;
    }
  }
  return cost;
}

/** Breadth-first steps over tiles `open` allows, from each of `from`. */
function fill(
  map: TileMap,
  from: readonly number[],
  open: (x: number, y: number) => boolean,
): Int32Array {
  const grid = new Grid(map.width, map.height);
  const dist = new Int32Array(grid.size).fill(-1);
  const queue = new Int32Array(grid.size);
  let head = 0;
  let tail = 0;
  for (const idx of from) {
    dist[idx] = 0;
    queue[tail++] = idx;
  }
  while (head < tail) {
    const idx = queue[head++]!;
    const x = grid.xOf(idx);
    const y = grid.yOf(idx);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.contains(nx, ny)) continue;
      const nIdx = grid.index(nx, ny);
      if (dist[nIdx]! >= 0 || !open(nx, ny)) continue;
      dist[nIdx] = dist[idx]! + 1;
      queue[tail++] = nIdx;
    }
  }
  return dist;
}

const tileOf = (world: GeneratedWorld, n: { x: number; y: number }) =>
  Math.floor(n.y) * world.map.width + Math.floor(n.x);

/** The nodes whose tile the cost map reaches within `cuts`. */
function within(
  world: GeneratedWorld,
  cost: Float64Array,
  cuts: number,
  kinds?: readonly ResourceKind[],
): ResourceNode[] {
  return world.nodes.filter(
    (n) => (!kinds || kinds.includes(n.kind)) && cost[tileOf(world, n)]! <= cuts,
  );
}

const minus = (a: readonly ResourceNode[], b: readonly ResourceNode[]) => {
  const ids = new Set(b.map((n) => n.id));
  return a.filter((n) => !ids.has(n.id));
};

const count = (nodes: readonly ResourceNode[], kind: ResourceKind) =>
  nodes.filter((n) => n.kind === kind).length;

/** Walking steps from the nearest drinking spot, with everything opened. */
function stepsFromWater(world: GeneratedWorld): Int32Array {
  const { map } = world;
  const from = world.springs.map((s) => s.y * map.width + s.x);
  return fill(map, from, (x, y) => {
    const kind = map.get(x, y);
    return map.isPassable(x, y) || kind === "thicket" || kind === "sapling";
  });
}

/** "12, 71-85 steps from water" for a group of nodes. */
function describe(world: GeneratedWorld, nodes: readonly ResourceNode[], steps: Int32Array): string {
  if (nodes.length === 0) return "none";
  const d = nodes.map((n) => steps[tileOf(world, n)]!).sort((a, b) => a - b);
  return `${nodes.length}, ${d[0]}-${d[d.length - 1]} steps from water`;
}

/** What the bramble bay's rows are measured from. */
export interface BrambleBayMeasure {
  /** How many separate floors the sticks lie on: one, for a bramble bay. */
  floors: number;
  /** The floor the first stick lies on, as `y * width + x`. */
  floor: Set<number>;
  /** The fewest cuts onto the floor from camp: the thinnest way in. */
  thinnest: number;
  /**
   * The share of the floor's edge that is cut onto with no more than
   * `BRAMBLE_BAY_EVEN_SLACK` cuts over the thinnest: how even the brambles are.
   */
  even: number;
}

/**
 * The bramble bay, measured from the map alone, so a file edited by hand is
 * checked the same way: the open ground the sticks lie on, and what it costs
 * to cut onto it at each tile of its edge.
 *
 * The edge is every floor tile beside thicket. Most of it should cost about
 * what the thinnest way in costs, so the bramble bay can be approached from
 * more than one side.
 */
export function measureBrambleBay(world: GeneratedWorld): BrambleBayMeasure {
  const { map } = world;
  const grid = new Grid(map.width, map.height);
  const sticks = world.nodes.filter((n) => n.kind === "stick").map((n) => tileOf(world, n));
  const floorOf = new Int32Array(grid.size).fill(-1);
  const floors: Set<number>[] = [];
  for (const start of sticks) {
    if (floorOf[start]! >= 0) continue;
    const floor = new Set<number>([start]);
    floorOf[start] = floors.length;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const idx = queue[head]!;
      for (const [dx, dy] of NEIGHBOURS_4) {
        const nx = grid.xOf(idx) + dx;
        const ny = grid.yOf(idx) + dy;
        if (!grid.contains(nx, ny) || !map.isPassable(nx, ny)) continue;
        const n = grid.index(nx, ny);
        if (floorOf[n]! >= 0) continue;
        floorOf[n] = floors.length;
        floor.add(n);
        queue.push(n);
      }
    }
    floors.push(floor);
  }
  const floor = floors[0] ?? new Set<number>();
  const cost = cutsFromCamp(world, { bridge: false, fell: false }, floor);
  let thinnest = Infinity;
  for (const i of floor) thinnest = Math.min(thinnest, cost[i]!);
  let edge = 0;
  let near = 0;
  for (const i of floor) {
    const byThicket = NEIGHBOURS_4.some(([dx, dy]) => map.get(grid.xOf(i) + dx, grid.yOf(i) + dy) === "thicket");
    if (!byThicket) continue;
    edge++;
    if (cost[i]! <= thinnest + C.BRAMBLE_BAY_EVEN_SLACK) near++;
  }
  return { floors: floors.length, floor, thinnest, even: edge > 0 ? near / edge : 0 };
}

/** How many tiles the generator's own thickening rule would still change. */
const pinches = (world: GeneratedWorld) => thickenStream(world.map.clone());

/** Every row of the table, measured. */
export function checkRows(world: GeneratedWorld): Row[] {
  const { map } = world;
  const noBridge = cutsFromCamp(world, { bridge: false, fell: false });
  const bridged = cutsFromCamp(world, { bridge: true, fell: false });
  const felled = cutsFromCamp(world, { bridge: true, fell: true });
  const steps = stepsFromWater(world);
  // Drinking is never behind a wade: every spring is reached from camp without
  // setting foot in mud, with water, thicket and saplings all crossed.
  const dry = fill(map, [Math.floor(world.camp.y) * map.width + Math.floor(world.camp.x)], (x, y) => {
    const kind = map.get(x, y);
    return kind !== "mud" && kind !== "rock" && kind !== "cliff" && kind !== "tree";
  });
  const wadedTo = world.springs.filter(
    (s) => map.get(s.x, s.y) === "mud" || dry[s.y * map.width + s.x]! < 0,
  );

  // Summer 1: the near ring. Vines are waded to, sticks are cut to.
  const onFoot = within(world, noBridge, 0);
  const nearRing = within(world, noBridge, THIN_CUTS);
  const pockets = minus(nearRing, onFoot);
  const springsOnFoot = world.springs.filter((s) => noBridge[s.y * map.width + s.x]! === 0);
  const springsAcross = world.springs.filter(
    (s) =>
      noBridge[s.y * map.width + s.x]! === Infinity &&
      bridged[s.y * map.width + s.x]! <= THIN_CUTS,
  );

  // Summer 2: across the stream. Summer 3: behind the copse.
  const across = minus(within(world, bridged, THIN_CUTS), nearRing);
  const farField = minus(within(world, felled, THIN_CUTS), within(world, bridged, THIN_CUTS));

  // Every node reachable, and no wall thicker than a thin one: the thick wall
  // is parked, and a node behind one would be a node nobody can have.
  const beyond = world.nodes.filter((n) => felled[tileOf(world, n)]! > THIN_CUTS);

  // The bramble bay: the sticks on one floor, in brambles about as deep from
  // every side, with nothing on that floor but the sticks.
  const bay = measureBrambleBay(world);
  const inBay = world.nodes.filter((n) => n.kind !== "stick" && bay.floor.has(tileOf(world, n)));
  const springsInBay = world.springs.filter((s) => bay.floor.has(s.y * map.width + s.x));

  const rows: Row[] = [
    {
      summer: 1,
      label: "fruit and feathers on foot",
      ok: count(onFoot, "fruit") > 0 && count(onFoot, "feather") > 0,
      detail: `fruit ${count(onFoot, "fruit")}, feathers ${count(onFoot, "feather")}`,
    },
    {
      summer: 1,
      label: "vines waded to, sticks behind thin thicket",
      field: true,
      ok:
        count(onFoot, "vine") > 0 &&
        count(onFoot, "stick") === 0 &&
        count(pockets, "stick") > 0,
      detail:
        `vines on foot ${count(onFoot, "vine")}; sticks ${count(onFoot, "stick")} on foot, ` +
        `${count(pockets, "stick")} once ${THIN_CUTS} or fewer tiles are cut`,
    },
    {
      summer: 1,
      label: "the sticks lie in one bramble bay, in brambles about as deep all round",
      field: true,
      ok:
        bay.floors === 1 &&
        bay.thinnest >= 2 &&
        bay.thinnest <= C.BRAMBLE_BAY_THINNEST &&
        bay.even >= C.BRAMBLE_BAY_EVEN_SHARE,
      detail:
        `${bay.floors} floor${bay.floors === 1 ? "" : "s"}, ${bay.thinnest} cuts at the thinnest, ` +
        `${Math.round(bay.even * 100)}% of the edge within ${bay.thinnest + C.BRAMBLE_BAY_EVEN_SLACK}`,
    },
    {
      summer: 1,
      label: "springs on both sides of the stream",
      ok: springsOnFoot.length > 0 && springsAcross.length > 0,
      detail: `${springsOnFoot.length} inside, ${springsAcross.length} across`,
    },
    {
      summer: 2,
      label: "feathers across the stream, no shells",
      field: true,
      ok: count(across, "feather") > 0 && count(across, "shell") === 0,
      detail:
        `feathers ${describe(world, across.filter((n) => n.kind === "feather"), steps)}; ` +
        `shells ${count(across, "shell")}`,
    },
    {
      summer: 3,
      label: "shells only behind the copse",
      field: true,
      ok: count(farField, "shell") > 0 && count(nearRing, "shell") === 0 && count(across, "shell") === 0,
      detail: `shells ${describe(world, farField.filter((n) => n.kind === "shell"), steps)}`,
    },
    {
      summer: 0,
      label: "every node within a thin cut",
      ok: beyond.length === 0,
      detail: `${beyond.length} beyond`,
    },
    {
      summer: 0,
      label: "nothing but sticks in the bramble bay",
      field: true,
      ok: inBay.length === 0 && springsInBay.length === 0,
      detail: `${inBay.length} other nodes, ${springsInBay.length} springs`,
    },
    {
      summer: 0,
      label: "every spring reached without wading",
      ok: wadedTo.length === 0,
      detail: `${wadedTo.length} of ${world.springs.length} behind mud`,
    },
    {
      summer: 0,
      label: "stream is nowhere one tile across",
      ok: pinches(world) === 0,
      detail: `${pinches(world)} pinched tiles`,
    },
  ];

  const saplings = countTiles(map, felled, "sapling");
  return [
    ...valleyRows(world, noBridge, felled, steps),
    ...rows,
    // Every economy row counts what the fields hold, so all of them wait for
    // the fields.
    ...economyRows({
      ringFruit: count(nearRing, "fruit"),
      ringFeathers: count(nearRing, "feather"),
      sticks: count(nearRing, "stick"),
      vines: count(nearRing, "vine"),
      fieldFeathers: count(across, "feather"),
      shells: count(farField, "shell"),
      saplings,
    }).map((row) => ({ ...row, field: true as const })),
  ];
}

/**
 * The valley's own rows (docs/current/five-summers.md, "The map"), measured from the map
 * alone, so a file edited by hand is held to them too.
 *
 * `onFoot` is the cost map from camp with nothing bridged, and `felled` the
 * one with every stream bridged and every sapling felled: the most the player
 * can ever open. `steps` is the walk from the nearest spring.
 */
function valleyRows(world: GeneratedWorld, onFoot: Float64Array, felled: Float64Array, steps: Int32Array): Row[] {
  const { map } = world;
  const W = map.width;
  const ring = nearRing(map, world.camp);
  let ringWalkable = 0;
  for (let i = 0; i < ring.length; i++) {
    if (ring[i] && map.isPassable(i % W, Math.floor(i / W))) ringWalkable++;
  }

  // The river and the lake are the water with no walkable tile beside it:
  // cliff and rock all round. A stream the player can reach has a bank.
  const bodies = waterBodies(map);
  const walled = bodies.filter((tiles) =>
    tiles.every((i) =>
      NEIGHBOURS_4.every(([dx, dy]) => {
        const kind = map.get((i % W) + dx, Math.floor(i / W) + dy);
        return kind === "stream" || !map.isPassable((i % W) + dx, Math.floor(i / W) + dy);
      }),
    ),
  );
  const reachedWalled = walled.filter((tiles) => tiles.some((i) => felled[i]! < Infinity));

  // The fewest bridge tiles from camp onto walkable ground outside the ring.
  const crossing = narrowestCrossing(world, ring);

  // Water in the ring: every walkable tile of it within a walk of a spring,
  // and somewhere outside it that is not, so thirst is still a thing there.
  // Only ground the player gets to counts: a clearing shut in by trees is not
  // a walk from anywhere. In the ring that means on foot, since ground only a
  // bridge over a pond reaches is not ground anyone walks to.
  let dryInRing = 0;
  let farthestInRing = 0;
  let dryOutside = 0;
  for (let i = 0; i < ring.length; i++) {
    if (!map.isPassable(i % W, Math.floor(i / W))) continue;
    if ((ring[i] ? onFoot : felled)[i] === Infinity) continue;
    const d = steps[i]!;
    if (ring[i]) {
      if (d < 0 || d > C.VALLEY.ringWaterReach) dryInRing++;
      farthestInRing = Math.max(farthestInRing, d < 0 ? Infinity : d);
    } else if (d > C.VALLEY.ringWaterReach) {
      dryOutside++;
    }
  }

  // The cliff's art has a piece for none of these: a cliff tile with water
  // on three or four sides, a spike or a crumb; water straight above it and
  // again within a face's height below, which leaves room for only the
  // bottom of a face; and water to its west with more within two tiles east,
  // where two banks' edges meet.
  const water = (x: number, y: number) => map.get(x, y) === "stream";
  const odd: string[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < W; x++) {
      if (map.get(x, y) !== "cliff") continue;
      const n = water(x, y - 1);
      const s = water(x, y + 1);
      const e = water(x + 1, y);
      const w = water(x - 1, y);
      let below = false;
      for (let k = 1; k <= C.CLIFF_FACE_TILES && !below; k++) below = water(x, y + k);
      // The falls are this, with the first stream above and the lake below,
      // and the waterfall draws them. The stream is told from the river by
      // its bank: along its row, walkable ground past the water.
      const falls = n && [-1, 1].some((step) => {
        let wx = x;
        for (let k = 0; k < 4 && water(wx, y - 1); k++) wx += step;
        return map.isPassable(wx, y - 1);
      });
      if (+n + +s + +e + +w >= 3 || (w && (e || water(x + 2, y))) || (n && below && !falls)) odd.push(`${x},${y}`);
    }
  }

  return [
    {
      summer: 0,
      label: "every cliff tile has a piece to draw it with",
      ok: odd.length === 0,
      detail: odd.length === 0 ? "none too thin" : `${odd.length} too thin, at ${odd.slice(0, 4).join(" ")}`,
    },
    {
      summer: 1,
      label: "the near ring is large enough to explore",
      ok: ringWalkable >= C.VALLEY.ringMin,
      detail: `${ringWalkable} walkable tiles, at least ${C.VALLEY.ringMin}`,
    },
    // One body: a river broken in two has ground between the pieces, and
    // that ground is a way across.
    {
      summer: 0,
      label: "the river and the lake are one, and never reached, whatever is bridged",
      ok: walled.length === 1 && reachedWalled.length === 0,
      detail: `${walled.length} walled water bodies, ${reachedWalled.length} reached`,
    },
    {
      summer: 1,
      label: `the first stream's narrowest crossing is ${C.FIRST_CROSSING_TILES} tiles`,
      ok: crossing === C.FIRST_CROSSING_TILES,
      detail: `${crossing} bridge tiles`,
    },
    {
      summer: 1,
      label: `the near ring is all within ${C.VALLEY.ringWaterReach} steps of a spring, and somewhere outside it is not`,
      ok: dryInRing === 0 && dryOutside > 0,
      detail: `farthest in the ring ${farthestInRing}, ${dryInRing} tiles too far; ${dryOutside} tiles outside too far`,
    },
  ];
}

/** The stream tiles, in 4-connected bodies of water, as `y * width + x`. */
function waterBodies(map: TileMap): number[][] {
  const W = map.width;
  const seen = new Uint8Array(W * map.height);
  const bodies: number[][] = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || map.get(start % W, Math.floor(start / W)) !== "stream") continue;
    seen[start] = 1;
    const tiles = [start];
    for (let head = 0; head < tiles.length; head++) {
      const i = tiles[head]!;
      for (const [dx, dy] of NEIGHBOURS_4) {
        const x = (i % W) + dx;
        const y = Math.floor(i / W) + dy;
        if (x < 0 || y < 0 || x >= W || y >= map.height) continue;
        const n = y * W + x;
        if (seen[n] || map.get(x, y) !== "stream") continue;
        seen[n] = 1;
        tiles.push(n);
      }
    }
    bodies.push(tiles);
  }
  return bodies;
}

/**
 * The fewest stream tiles crossed on the way from camp to walkable ground
 * outside the near ring, with everything that can be cut or felled opened:
 * what the first bridge costs at its narrowest. Infinity if nothing gets out.
 */
function narrowestCrossing(world: GeneratedWorld, ring: Uint8Array): number {
  const { map } = world;
  const grid = new Grid(map.width, map.height);
  const cost = new Float64Array(grid.size).fill(Infinity);
  const start = grid.index(Math.floor(world.camp.x), Math.floor(world.camp.y));
  const deque = new Int32Array(grid.size * 4 + 8);
  let head = grid.size * 2;
  let tail = head;
  cost[start] = 0;
  deque[tail++] = start;
  while (head < tail) {
    const idx = deque[head++]!;
    const x = grid.xOf(idx);
    const y = grid.yOf(idx);
    if (!ring[idx] && map.isPassable(x, y)) return cost[idx]!;
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.contains(nx, ny)) continue;
      const kind = map.get(nx, ny);
      const step =
        kind === "stream" ? 1 : map.isPassable(nx, ny) || kind === "thicket" || kind === "sapling" ? 0 : Infinity;
      if (step === Infinity) continue;
      const n = grid.index(nx, ny);
      if (cost[idx]! + step >= cost[n]!) continue;
      cost[n] = cost[idx]! + step;
      if (step === 0) deque[--head] = n;
      else deque[tail++] = n;
    }
  }
  return Infinity;
}

/** Tiles of `kind` the cost map reaches at all. */
function countTiles(map: TileMap, cost: Float64Array, kind: string): number {
  let n = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) === kind && cost[y * map.width + x]! < Infinity) n++;
    }
  }
  return n;
}

/**
 * The two players over the map's counts, through the winter model: the chain
 * five-summers.md asks the first winters for, each row with its margin.
 *
 * The chain is what is asserted, not the gold in that document's tables: they
 * are M10.8's arithmetic, and until it lands upkeep is flat at level 0's row,
 * which runs both families a few gold high. The reference player's family
 * total is printed for that reason and held to nothing.
 */
function economyRows(counts: MapCounts): Row[] {
  const [w1, w2, w3] = perfectPlayer(counts, 3);
  const [r1, r2, r3, r4] = referencePlayer(counts, 4);
  const L = C.FAMILY_LEVELS;
  const ringGold = counts.ringFeathers * RESOURCES.feather.price;
  const shortOnFoot = C.UPKEEP_GOLD + L[0]! - ringGold;
  const cart = w3!.model.shop.find((line) => line.item.id === "cart");
  return [
    {
      summer: 1,
      label: "the near ring feeds the winter",
      ok: counts.ringFruit >= C.UPKEEP_FRUIT,
      detail: `fruit ${counts.ringFruit} of ${C.UPKEEP_FRUIT}`,
    },
    {
      summer: 1,
      label: "the near ring alone is short of rent and level 1",
      ok: shortOnFoot > 0,
      detail: `counted ${ringGold}, short by ${shortOnFoot}`,
    },
    {
      summer: 1,
      label: "the bridge reaches level 1",
      ok: w1!.model.family.level >= 1,
      detail: `counted ${w1!.counted}, family ${w1!.model.family.total}, margin ${w1!.model.family.total - L[0]!}`,
    },
    {
      summer: 2,
      label: "winter 2 buys the axe and reaches level 2",
      ok: w2!.bought.includes("axe") && w2!.model.family.level >= 2,
      detail:
        `counted ${w2!.counted}, ${w2!.bought.join(", ") || "nothing"} bought, ` +
        `family ${w2!.model.family.total}, margin ${w2!.model.family.total - L[1]!}`,
    },
    {
      summer: 3,
      label: "winter 3 buys the cart",
      ok: w3!.bought.includes("cart"),
      detail:
        `counted ${w3!.counted}, ${w3!.bought.join(", ") || "nothing"} bought` +
        (cart && !cart.bought ? ` (short ${cart.shortGold} gold)` : "") +
        `, left ${w3!.model.left}, family ${w3!.model.family.total}`,
    },
    {
      summer: 1,
      label: "a reference player reaches level 1 too",
      ok: r1!.model.family.level >= 1,
      detail: `counted ${r1!.counted}, family ${r1!.model.family.total}`,
    },
    {
      summer: 2,
      label: "a reference player buys the axe, and not level 2",
      ok: r2!.bought.includes("axe") && r2!.model.family.level < 2,
      detail: `counted ${r2!.counted}, family ${r2!.model.family.total}`,
    },
    {
      summer: 3,
      label: "the cart is a winter later for them",
      ok: !r3!.bought.includes("cart") && r4!.bought.includes("cart"),
      detail:
        `winter 3 counted ${r3!.counted}, ${r3!.bought.join(", ") || "nothing"} bought, ` +
        `family ${r3!.model.family.total} (level ${r3!.model.family.level}; ` +
        `M10.8's upkeep is what makes this one 78 and level 2); ` +
        `winter 4 ${r4!.bought.join(", ") || "nothing"} bought`,
    },
  ];
}
