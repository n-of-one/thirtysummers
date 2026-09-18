import * as C from "../../config.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceKind, ResourceNode } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";
import { thickenStream } from "./water.ts";
import type { GeneratedWorld } from "../worldgen.ts";

/**
 * Does a map hold the table of the first five summers?
 *
 * Each summer opens one thing, and each barrier is short in the one currency
 * the summer before supplied (docs/current/five-summers.md). A map either
 * holds that chain or it does not, and the failure is invisible until someone
 * plays it and simply walks in -- so it is measured rather than eyeballed,
 * whether the map came out of the layout pass or was edited by hand.
 *
 * The map is filled from camp the way the player gets about in each summer: on
 * foot; with thin thicket cut; with the stream bridged; with the saplings
 * felled; and with the thick wall cut as well. The fill counts how many
 * thicket tiles the cheapest way to each tile cuts, so a thin ring and a thick
 * wall are told apart by their depth rather than by where they are.
 */
export interface Row {
  /** The summer this stands for, or 0 for a rule that is not a summer's. */
  summer: number;
  label: string;
  ok: boolean;
  /** The numbers behind it, for a person reading the output. */
  detail: string;
}

/** Most thicket a thin ring may take to cut through: "about three tiles". */
export const THIN_CUTS = 4;
/** Least thicket the wall into the last pocket may take: twelve tiles. */
export const THICK_CUTS = 12;

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
 * says so.
 */
export function cutsFromCamp(world: GeneratedWorld, means: Means): Float64Array {
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

/** Chebyshev distance from (x, y) to the nearest stream tile or spring. */
export function waterDistance(world: GeneratedWorld, x: number, y: number): number {
  const { map } = world;
  let best = Infinity;
  for (const s of world.springs) {
    best = Math.min(best, Math.max(Math.abs(s.x - x), Math.abs(s.y - y)));
  }
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (map.get(tx, ty) !== "stream") continue;
      best = Math.min(best, Math.max(Math.abs(tx - x), Math.abs(ty - y)));
    }
  }
  return best;
}

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

/** How many tiles the generator's own thickening rule would still change. */
const pinches = (world: GeneratedWorld) => thickenStream(world.map.clone());

/** Every row of the table, measured. */
export function checkRows(world: GeneratedWorld): Row[] {
  const { map } = world;
  const noBridge = cutsFromCamp(world, { bridge: false, fell: false });
  const bridged = cutsFromCamp(world, { bridge: true, fell: false });
  const felled = cutsFromCamp(world, { bridge: true, fell: true });
  const steps = stepsFromWater(world);

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

  // Summer 2: across the stream, and behind the copse.
  const across = minus(within(world, bridged, THIN_CUTS), nearRing);
  const farField = minus(within(world, felled, THIN_CUTS), within(world, bridged, THIN_CUTS));

  // Summer 3: a cart route. The cart runs on grass and bridge, so a route is
  // grass the whole way once the stream is bridged, the copse felled and the
  // thicket cut -- and it has to need the cutting, or there is no work in it.
  const campIdx = tileOf(world, world.camp);
  const cartGround = (cut: boolean) => (x: number, y: number) => {
    const kind = map.get(x, y);
    return (
      kind === "grass" ||
      kind === "bridge" ||
      kind === "stream" ||
      kind === "sapling" ||
      (cut && kind === "thicket")
    );
  };
  const cartCut = fill(map, [campIdx], cartGround(true));
  const cartUncut = fill(map, [campIdx], cartGround(false));
  const cartReaches = farField.filter((n) => cartCut[tileOf(world, n)]! >= 0);
  const cartWithoutCut = farField.filter((n) => cartUncut[tileOf(world, n)]! >= 0);
  const walk = fill(map, [campIdx], (x, y) => {
    const kind = map.get(x, y);
    return map.isPassable(x, y) || kind === "stream" || kind === "sapling" || kind === "thicket";
  });
  const farWalk = farField.map((n) => walk[tileOf(world, n)]!).sort((a, b) => a - b);

  // Summer 4: the dry pocket. Shells reachable without the thick wall, every
  // one too far from water to be dry ground for nothing, and a spot among them
  // where a well is allowed.
  const reachedShells = within(world, felled, THIN_CUTS, ["shell"]);
  const dryShells = reachedShells.filter(
    (n) => waterDistance(world, Math.floor(n.x), Math.floor(n.y)) > C.WELL_WATER_CLEARANCE,
  );
  const wellSpot = reachedShells.some((n) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.floor(n.x) + dx;
        const y = Math.floor(n.y) + dy;
        if (map.get(x, y) !== "grass" || felled[y * map.width + x]! > THIN_CUTS) continue;
        if (waterDistance(world, x, y) > C.WELL_WATER_CLEARANCE) return true;
      }
    }
    return false;
  });

  // Summer 5: the last pocket, and no barrier between thin and thick, so every
  // wall is plainly one or the other.
  const lastPocket = world.nodes.filter((n) => felled[tileOf(world, n)]! >= THICK_CUTS);
  const inBetween = world.nodes.filter((n) => {
    const c = felled[tileOf(world, n)]!;
    return c > THIN_CUTS && c < THICK_CUTS;
  });
  const unreachable = world.nodes.filter((n) => felled[tileOf(world, n)]! === Infinity);

  return [
    {
      summer: 1,
      label: "fruit and feathers on foot",
      ok: count(onFoot, "fruit") > 0 && count(onFoot, "feather") > 0,
      detail: `fruit ${count(onFoot, "fruit")}, feathers ${count(onFoot, "feather")}`,
    },
    {
      summer: 1,
      label: "vines waded to, sticks behind thin thicket",
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
      label: "springs on both sides of the stream",
      ok: springsOnFoot.length > 0 && springsAcross.length > 0,
      detail: `${springsOnFoot.length} inside, ${springsAcross.length} across`,
    },
    {
      summer: 2,
      label: "ore only across the stream",
      ok: count(nearRing, "ore") === 0 && count(across, "ore") > 0,
      detail:
        `before a bridge ${count(nearRing, "ore")}, after ` +
        describe(world, across.filter((n) => n.kind === "ore"), steps),
    },
    {
      summer: 2,
      label: "a second field behind the copse",
      ok: count(farField, "ore") > 0,
      detail: `ore ${describe(world, farField.filter((n) => n.kind === "ore"), steps)}`,
    },
    {
      summer: 3,
      label: "a cart route from it that needs cutting",
      ok: farField.length > 0 && cartReaches.length === farField.length && cartWithoutCut.length === 0,
      detail:
        `cart reaches ${cartReaches.length} of ${farField.length} once cut, ` +
        `${cartWithoutCut.length} uncut; ${farWalk[0] ?? "-"}-${farWalk[farWalk.length - 1] ?? "-"} ` +
        `steps from camp`,
    },
    {
      summer: 4,
      label: "shells in a dry pocket, with room for a well",
      ok: reachedShells.length > 0 && dryShells.length === reachedShells.length && wellSpot,
      detail:
        `${dryShells.length} of ${reachedShells.length} dry, ${describe(world, reachedShells, steps)}, ` +
        `well spot ${wellSpot ? "yes" : "no"}`,
    },
    {
      summer: 5,
      label: `a pocket behind ${THICK_CUTS} tiles of thicket`,
      ok: lastPocket.length > 0 && inBetween.length === 0 && unreachable.length === 0,
      detail:
        `${describe(world, lastPocket, steps)}; ${inBetween.length} between thin and thick, ` +
        `${unreachable.length} unreachable`,
    },
    {
      summer: 0,
      label: "stream is nowhere one tile across",
      ok: pinches(world) === 0,
      detail: `${pinches(world)} pinched tiles`,
    },
  ];
}
