import { createNoise2D } from "simplex-noise";
import * as C from "../../config.ts";
import { mulberry32, type Rng } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { Vec2 } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";
import { groundAt, groundBand } from "./terrain.ts";

/**
 * The bramble bay the sticks lie in: a clearing at the edge of a wood, with brambles
 * on the wood's floor all round it, about as deep from every side.
 * docs/current/m10-5-thicket.md is the design.
 *
 * It replaced a sapling stand, a disc of saplings in a ring of thicket three
 * tiles deep. That did the first summer's two jobs -- the knife's first cut,
 * and a cut that grows back over winter -- but it looked stamped on. The bramble
 * bay does both jobs on ground the noise already made: it goes where a wood wraps
 * round open ground furthest, and its brambles follow the noise into the wood.
 */
export interface BrambleBay {
  /** The middle of the floor. */
  centre: Vec2;
  /** The floor's tiles, as `y * width + x`. */
  floor: ReadonlySet<number>;
  /** Which way from `centre` the wood is furthest off, in radians: the open side. */
  open: number;
  /** The furthest any of its brambles are from `centre`. */
  reach: number;
}

/** How far the floor grows from the spot the bramble bay was found at. */
const FLOOR_REACH = 5;

/**
 * Find the bramble bay in the near ring and grow its floor. The map is only
 * changed where the spot needed a wood raised round it; `carveBrambleBay`
 * lays the bramble bay down.
 *
 * Every spot of open ground in the ring, a walk from camp and well off the
 * stream, is judged by rays cast out from it: the share of them that meet a
 * wood is how far the wood wraps round. The spot where it wraps furthest wins,
 * and the seed decides between spots that are equally good. The open side is the way the wood is furthest off.
 *
 * `ring` is the near ring's mask, `forest` the forest noise (raised in place
 * when a wood has to grow), `moisture` and `stages` what `paintTerrain` filled
 * in, kept in step with any tile painted again.
 */
export function findBrambleBay(
  map: TileMap,
  seed: number,
  rng: Rng,
  camp: Vec2,
  ring: Uint8Array,
  forest: Float32Array,
  moisture: Float32Array,
  stages: Uint8Array,
): BrambleBay {
  const grid = new Grid(map.width, map.height);
  const R = C.NEAR_RING_RADIUS;
  let best: { at: Vec2; wrap: number; open: number; score: number } | null = null;
  for (let y = C.LAYOUT_BORDER; y < camp.y; y += 2) {
    for (let x = C.LAYOUT_BORDER; x < map.width - C.LAYOUT_BORDER; x += 2) {
      const out = Math.hypot(x - camp.x, y - camp.y);
      if (out < C.BRAMBLE_BAY_FROM_CAMP || out > R - C.BRAMBLE_BAY_FROM_STREAM) continue;
      if (!ring[grid.index(x, y)] || !(forest[grid.index(x, y)]! < 0)) continue;
      const judged = judge(grid, forest, x, y);
      // A share of the rays is a sixteenth apart, so the seed's draw only ever
      // settles a tie.
      const score = judged.wrap + rng() * 0.01;
      if (!best || score > best.score) best = { at: { x, y }, ...judged, score };
    }
  }
  // The band is inside the ring on every seed; this is only a guard.
  const at = best?.at ?? { x: Math.round(camp.x), y: Math.round(camp.y - (R / 2)) };
  const open = best?.open ?? -Math.PI / 2;
  if (!best || best.wrap < C.BRAMBLE_BAY_WRAP_MIN) raiseWood(map, seed, grid, forest, moisture, stages, at, open);

  const floor = growFloor(map, grid, forest, at);
  let sx = 0;
  let sy = 0;
  for (const i of floor) {
    sx += grid.xOf(i);
    sy += grid.yOf(i);
  }
  const centre = { x: sx / floor.size, y: sy / floor.size };
  let far = 0;
  for (const i of floor) far = Math.max(far, Math.hypot(grid.xOf(i) - centre.x, grid.yOf(i) - centre.y));
  return { centre, floor, open, reach: far + C.BRAMBLE_BAY_THINNEST + C.BRAMBLE_BAY_WOOD_EXTRA + C.BRAMBLE_BAY_EDGE_CLUMPS + 1 };
}

/**
 * How far the wood wraps round (x, y): the share of `BRAMBLE_BAY_RAYS` rays that meet
 * a wood within `BRAMBLE_BAY_REACH`, and the way the wood is furthest off, which is
 * the open side. Each ray's distance is taken with its two neighbours, so the
 * open side faces a gap rather than one lucky ray.
 */
function judge(grid: Grid, forest: Float32Array, x: number, y: number): { wrap: number; open: number } {
  const n = C.BRAMBLE_BAY_RAYS;
  const dist: number[] = [];
  let wooded = 0;
  for (let r = 0; r < n; r++) {
    const a = (r / n) * Math.PI * 2;
    let hit = C.BRAMBLE_BAY_REACH + 1;
    for (let s = 1; s <= C.BRAMBLE_BAY_REACH; s++) {
      const tx = Math.round(x + Math.cos(a) * s);
      const ty = Math.round(y + Math.sin(a) * s);
      if (!grid.contains(tx, ty)) break;
      if (forest[grid.index(tx, ty)]! >= C.TREE_THRESHOLD) {
        hit = s;
        break;
      }
    }
    if (hit <= C.BRAMBLE_BAY_REACH) wooded++;
    dist.push(hit);
  }
  let open = 0;
  let widest = -1;
  for (let r = 0; r < n; r++) {
    const around = dist[(r + n - 1) % n]! + 2 * dist[r]! + dist[(r + 1) % n]!;
    if (around > widest) {
      widest = around;
      open = (r / n) * Math.PI * 2;
    }
  }
  return { wrap: wooded / n, open };
}

/**
 * Raise the forest noise round a spot the wood does not wrap far enough, on
 * every side but the open one, and paint those tiles again. The spot itself and
 * the ground next to it are left open for the floor, and the raise fades out
 * past `BRAMBLE_BAY_REACH`, so the new wood joins whatever the noise had there.
 */
function raiseWood(
  map: TileMap,
  seed: number,
  grid: Grid,
  forest: Float32Array,
  moisture: Float32Array,
  stages: Uint8Array,
  at: Vec2,
  open: number,
): void {
  const outer = C.BRAMBLE_BAY_REACH + 4;
  for (let y = Math.floor(at.y - outer); y <= at.y + outer; y++) {
    for (let x = Math.floor(at.x - outer); x <= at.x + outer; x++) {
      if (!grid.contains(x, y)) continue;
      const i = grid.index(x, y);
      const kind = map.get(x, y);
      if (Number.isNaN(forest[i]!) || kind === "stream" || kind === "rock") continue;
      const d = Math.hypot(x - at.x, y - at.y);
      const raise =
        C.BRAMBLE_BAY_RAISE *
        clamp01((d - 3) / 3) *
        clamp01((outer - d) / 4) *
        (1 - onOpenSide(angleOff(Math.atan2(y - at.y, x - at.x), open)));
      if (raise <= 0) continue;
      forest[i] = forest[i]! + raise;
      const ground = groundAt(
        seed,
        x,
        y,
        forest[i]!,
        Number.isNaN(moisture[i]!) ? -Infinity : moisture[i]!,
        C.RING_GROUND,
      );
      map.set(x, y, ground.kind);
      stages[i] = ground.stage;
      if (ground.kind === "tree" || ground.kind === "denseUnderbrush") moisture[i] = NaN;
    }
  }
}

/**
 * The floor: `BRAMBLE_BAY_FLOOR_TILES` tiles grown from the spot, the lowest noise at
 * its edge first, the way the vines' pocket fills along the wettest ground. So
 * its outline follows the noise's contours and not a circle. It never takes a
 * tree, and stays within `FLOOR_REACH` of the spot.
 */
function growFloor(map: TileMap, grid: Grid, forest: Float32Array, at: Vec2): Set<number> {
  const floor = new Set<number>();
  const edge = new Map<number, number>();
  const take = (i: number) => {
    floor.add(i);
    edge.delete(i);
    const x = grid.xOf(i);
    const y = grid.yOf(i);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.contains(nx, ny)) continue;
      const n = grid.index(nx, ny);
      if (floor.has(n) || edge.has(n)) continue;
      if (Math.hypot(nx - at.x, ny - at.y) > FLOOR_REACH) continue;
      const kind = map.get(nx, ny);
      if (kind === "tree" || kind === "stream" || kind === "rock" || Number.isNaN(forest[n]!)) continue;
      edge.set(n, forest[n]!);
    }
  };
  take(grid.index(at.x, at.y));
  while (floor.size < C.BRAMBLE_BAY_FLOOR_TILES && edge.size > 0) {
    let next = -1;
    let lowest = Infinity;
    for (const [i, noise] of edge) {
      if (noise < lowest) {
        lowest = noise;
        next = i;
      }
    }
    take(next);
  }
  return floor;
}

/**
 * Lay the bramble bay down: its floor as open ground, and brambles round it.
 *
 * The floor is grass where the noise is open, and thin underbrush elsewhere;
 * the lowest third of it is grass whatever the noise says, so the sticks have
 * room. Mud on it is painted over.
 *
 * A tile becomes thicket when it is no further from the floor, in steps, than
 * the depth there. The depth is `BRAMBLE_BAY_THINNEST` all round, up to
 * `BRAMBLE_BAY_WOOD_EXTRA` more where the noise is a wood and up to `BRAMBLE_BAY_EDGE_CLUMPS`
 * more in clumps, so the brambles are about as deep from every side and their
 * edge is still uneven. There is no one mouth: a playtest with one thin side
 * and thick brambles everywhere else left one reasonable way in. Trees stay
 * where they are. A walk moves a step at a time and every tile
 * `BRAMBLE_BAY_THINNEST` or less from the floor is thicket or a tree, so no way in
 * cuts fewer.
 */
export function carveBrambleBay(
  map: TileMap,
  seed: number,
  camp: Vec2,
  forest: Float32Array,
  stages: Uint8Array,
  bay: BrambleBay,
): void {
  const grid = new Grid(map.width, map.height);
  // A fine noise of its own, so the brambles' outer edge comes out in clumps
  // and bights rather than as a ring at a fixed distance. It only ever adds.
  const clumps = createNoise2D(mulberry32(seed ^ 0xba1));
  const byNoise = [...bay.floor].sort((a, b) => forest[a]! - forest[b]!);
  const grass = new Set(byNoise.slice(0, Math.ceil(byNoise.length / 3)));
  for (const i of bay.floor) {
    const noise = forest[i]!;
    const x = grid.xOf(i);
    const y = grid.yOf(i);
    if (grass.has(i) || noise < C.UNDERBRUSH_THRESHOLD) {
      map.set(x, y, "grass");
      stages[i] = 0;
    } else {
      map.set(x, y, "underbrush");
      stages[i] = Math.max(2, groundBand(noise, C.RING_GROUND.bands).stage ?? 0);
    }
  }

  // Steps from the floor, over every tile but the map's edge and the water,
  // so the brambles are measured the way a walk crosses them.
  const most = C.BRAMBLE_BAY_THINNEST + C.BRAMBLE_BAY_WOOD_EXTRA + C.BRAMBLE_BAY_EDGE_CLUMPS;
  const steps = new Map<number, number>();
  const queue: number[] = [];
  for (const i of bay.floor) {
    steps.set(i, 0);
    queue.push(i);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const d = steps.get(i)!;
    if (d >= most) continue;
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = grid.xOf(i) + dx;
      const ny = grid.yOf(i) + dy;
      if (!grid.contains(nx, ny)) continue;
      const n = grid.index(nx, ny);
      const kind = map.get(nx, ny);
      if (steps.has(n) || kind === "stream" || kind === "rock") continue;
      steps.set(n, d + 1);
      queue.push(n);
    }
  }

  for (const [i, d] of steps) {
    if (d === 0) continue;
    const x = grid.xOf(i);
    const y = grid.yOf(i);
    if (map.get(x, y) === "tree") continue;
    // Brambles keep off camp's clearing and the band along the banks, where
    // the springs are. `BRAMBLE_BAY_FROM_CAMP` and `BRAMBLE_BAY_FROM_STREAM` leave room for
    // the brambles, so this only ever trims a clump.
    const out = Math.hypot(x - camp.x, y - camp.y);
    if (out <= C.CAMP_CLEARING + 2 || out >= C.NEAR_RING_RADIUS - 5) continue;
    const noise = Number.isNaN(forest[i]!) ? 0 : forest[i]!;
    const woodiness = clamp01(noise / C.TREE_THRESHOLD);
    // Only the noise's upper half adds, so about half the edge is left at
    // the thinnest and the rest comes out in clumps.
    const clump = clamp01(clumps(x / C.BRAMBLE_BAY_CLUMP_SCALE, y / C.BRAMBLE_BAY_CLUMP_SCALE));
    const depth = C.BRAMBLE_BAY_THINNEST + C.BRAMBLE_BAY_WOOD_EXTRA * woodiness + C.BRAMBLE_BAY_EDGE_CLUMPS * clump;
    if (d <= depth) {
      map.set(x, y, "thicket");
      stages[i] = 0;
    }
  }
}

/**
 * How much of the open side an angle `off` it is in: all of it across the
 * middle half of `BRAMBLE_BAY_OPEN_HALF_ANGLE`, none past it.
 */
function onOpenSide(off: number): number {
  const half = C.BRAMBLE_BAY_OPEN_HALF_ANGLE;
  return clamp01((half - off) / (half / 2));
}

/** How far apart two angles are, from 0 to pi. */
function angleOff(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
