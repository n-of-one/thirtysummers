import * as C from "../../config.ts";
import { hash2d } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { Vec2 } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";
import { reachableFrom } from "./reachability.ts";

/** Which tiles are stream, as a flat mask over the layer. */
export function streamMask(map: TileMap, z = 0): Uint8Array {
  const grid = new Grid(map.width, map.height);
  const mask = new Uint8Array(grid.size);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y, z) === "stream") mask[grid.index(x, y)] = 1;
    }
  }
  return mask;
}

/**
 * Streams generated from a noise band happily cut the map into islands. Rather
 * than constrain the generator, we find each stranded region and carve the
 * shortest crossing back to camp, turning the water into a muddy ford (and any
 * blocking trees into underbrush).
 *
 * Fords are difficult terrain, so a crossing is still slow -- exactly the kind
 * of friction a bridge would later remove.
 */
export function carveFords(
  map: TileMap,
  camp: Vec2,
  minRegion = C.FORD_MIN_REGION,
  maxFords = C.FORD_MAX_COUNT,
): number {
  const grid = new Grid(map.width, map.height);
  let carved = 0;

  for (let iter = 0; iter < maxFords; iter++) {
    const reachable = reachableFrom(map, camp);
    const stranded = largestStrandedRegion(map, grid, reachable);
    if (stranded.seed < 0 || stranded.size < minRegion) break;

    const crossing = pathToReachableGround(map, grid, stranded.seed, reachable);
    if (!crossing) break; // nothing to connect to; give up rather than loop

    for (const idx of crossing) {
      const x = grid.xOf(idx);
      const y = grid.yOf(idx);
      const kind = map.get(x, y);
      if (kind === "stream") {
        map.set(x, y, "mud");
        carved++;
      } else if (kind === "tree") {
        map.set(x, y, "underbrush");
        carved++;
      }
    }
  }
  return carved;
}

/** The biggest patch of walkable ground the camp cannot walk to. */
function largestStrandedRegion(
  map: TileMap,
  grid: Grid,
  reachable: Uint8Array,
): { seed: number; size: number } {
  const seen = new Uint8Array(grid.size);
  let bestSeed = -1;
  let bestSize = 0;

  for (let idx = 0; idx < grid.size; idx++) {
    if (seen[idx] || reachable[idx]) continue;
    if (!map.isPassable(grid.xOf(idx), grid.yOf(idx))) continue;

    let size = 0;
    const stack = [idx];
    seen[idx] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      const cx = grid.xOf(cur);
      const cy = grid.yOf(cur);
      for (const [dx, dy] of NEIGHBOURS_4) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!grid.contains(nx, ny)) continue;
        const n = grid.index(nx, ny);
        if (seen[n] || !map.isPassable(nx, ny)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestSeed = idx;
    }
  }
  return { seed: bestSeed, size: bestSize };
}

/**
 * Shortest path from a stranded region back to ground the camp can reach,
 * travelling through anything that is not the rock border. Returns the tiles
 * along it, or null when there is nothing to connect to.
 */
function pathToReachableGround(
  map: TileMap,
  grid: Grid,
  from: number,
  reachable: Uint8Array,
): number[] | null {
  const parent = new Int32Array(grid.size).fill(-1);
  const visited = new Uint8Array(grid.size);
  const queue = new Int32Array(grid.size);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  visited[from] = 1;
  let target = -1;

  while (head < tail && target < 0) {
    const cur = queue[head++]!;
    const cx = grid.xOf(cur);
    const cy = grid.yOf(cur);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.contains(nx, ny)) continue;
      const n = grid.index(nx, ny);
      if (visited[n]) continue;
      if (map.get(nx, ny) === "rock") continue;
      visited[n] = 1;
      parent[n] = cur;
      if (reachable[n]) {
        target = n;
        break;
      }
      queue[tail++] = n;
    }
  }
  if (target < 0) return null;

  const path: number[] = [];
  for (let node = target; node !== -1; node = parent[node]!) path.push(node);
  return path;
}

/**
 * The four 2x2 squares a tile belongs to, as offsets to the square's top-left.
 */
const SQUARES = [
  [-1, -1],
  [0, -1],
  [-1, 0],
  [0, 0],
] as const;

/**
 * Thicken the stream until it is nowhere one tile across.
 *
 * The stream is the zero band of a noise field, so its width follows the slope
 * of that field: where the field is steep the band pinches to a single tile, or
 * to a staircase of tiles touching only at their corners. Both are wrong twice
 * over. They cannot be drawn -- a tile whose own kind never continues to two
 * opposite sides has no piece in a blob tileset, and a corner touch has none at
 * all -- and they are not barriers, since a stream one tile across still reads
 * as a stream the player cannot cross, but a corner touch has a hole in it.
 *
 * The condition enforced is that every stream tile, and every neighbouring pair
 * of them, sits inside some 2x2 square of stream. The pairs are what make it
 * mean "two tiles across": a channel can satisfy the tile condition on both
 * sides of a sideways step and still put the entire flow through a single tile's
 * width at the step, which no real water would do -- it would cut itself a wider
 * bed. A corner touch is repaired by filling both of the tiles between, which
 * turns the pair into such a square rather than into a one-wide elbow.
 *
 * Only pinches are widened. A stretch already two or more across is left exactly
 * as the noise drew it, so the river keeps its shape and only its narrowest
 * points give. Filling can create new pinches at the edges of what it filled, so
 * this runs to a fixed point; in practice that is one or two passes.
 *
 * Rock is never overwritten, so the map border stays sealed, nor is cliff, so
 * the river never widens into the ravine that walls it, and neither is
 * anything in `keep` -- which is how a ford already cut through the water
 * survives a second pass.
 */
export function thickenStream(map: TileMap, z = 0, keep?: ReadonlySet<number>): number {
  const grid = new Grid(map.width, map.height);
  const isStream = (x: number, y: number) => map.get(x, y, z) === "stream";
  const takeable = (x: number, y: number) =>
    grid.contains(x, y) &&
    map.get(x, y, z) !== "rock" &&
    map.get(x, y, z) !== "cliff" &&
    !keep?.has(grid.index(x, y));
  const cells = (sx: number, sy: number) =>
    [
      [sx, sy],
      [sx + 1, sy],
      [sx, sy + 1],
      [sx + 1, sy + 1],
    ] as const;

  let added = 0;
  for (let pass = 0; pass < C.STREAM_THICKEN_PASSES; pass++) {
    // Collect against the state at the start of the pass: writing as we scan
    // would let each new tile seed more work and run the river wide.
    const fill = new Set<number>();

    // A corner touch: two stream tiles sharing only a corner, with both tiles
    // between them dry. Fill both, so the four together make a 2x2 block.
    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width - 1; x++) {
        for (const [ax, ay, bx, by] of [
          [x, y, x + 1, y + 1],
          [x + 1, y, x, y + 1],
        ] as const) {
          if (!isStream(ax, ay) || !isStream(bx, by)) continue;
          if (isStream(ax, by) || isStream(bx, ay)) continue;
          if (!takeable(ax, by) || !takeable(bx, ay)) continue;
          fill.add(grid.index(ax, by));
          fill.add(grid.index(bx, ay));
        }
      }
    }

    // A pinch: something that no 2x2 square of stream contains. Widening it
    // completes whichever square needs the least filling, so the water hugs
    // what is already there. Ties break on position, so a long pinch does not
    // widen the same way down its whole length.
    const widen = (parts: readonly (readonly [number, number])[]) => {
      const [ax, ay] = parts[0]!;
      const options = SQUARES.map(([dx, dy]) => cells(ax + dx, ay + dy))
        .filter((square) =>
          parts.every(([px, py]) => square.some(([cx, cy]) => cx === px && cy === py)),
        )
        .filter((square) => square.every(([cx, cy]) => takeable(cx, cy)));
      const costs = options.map((square) => square.filter(([cx, cy]) => !isStream(cx, cy)).length);
      if (options.length === 0 || Math.min(...costs) === 0) return; // hemmed in, or already wide
      const tied = options.filter((_, i) => costs[i] === Math.min(...costs));
      const square = tied[Math.floor(hash2d(1, ax, ay) * tied.length) % tied.length]!;
      for (const [cx, cy] of square) {
        if (!isStream(cx, cy)) fill.add(grid.index(cx, cy));
      }
    };

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!isStream(x, y)) continue;
        widen([[x, y]]);
        // Neighbouring pairs have to fit in a square too, not just single
        // tiles. A channel can be two tiles across on both sides of a sideways
        // step and still leave the water only one tile wide across the step
        // itself -- the whole flow through a slit. Water that narrow would
        // simply cut itself a wider bed, so it is widened here instead.
        if (isStream(x + 1, y)) {
          widen([
            [x, y],
            [x + 1, y],
          ]);
        }
        if (isStream(x, y + 1)) {
          widen([
            [x, y],
            [x, y + 1],
          ]);
        }
      }
    }

    if (fill.size === 0) break;
    for (const idx of fill) {
      map.set(grid.xOf(idx), grid.yOf(idx), "stream", z);
      added++;
    }
  }
  return added;
}

/**
 * Carve fords, then repair the pinches carving them created.
 *
 * A ford cuts a one-tile line through the water, which leaves the stream on
 * either side of the cut thinner than the noise drew it -- often back to a
 * single tile. The repair holds the crossings themselves back, so it cannot
 * undo the very thing it is repairing around, and widening can seal a gap
 * somewhere else, so the fords get one more look afterwards.
 */
export function connectAcrossWater(map: TileMap, camp: Vec2): void {
  const before = streamMask(map);
  carveFords(map, camp);

  const grid = new Grid(map.width, map.height);
  const fords = new Set<number>();
  for (let idx = 0; idx < before.length; idx++) {
    if (before[idx] && map.get(grid.xOf(idx), grid.yOf(idx)) !== "stream") fords.add(idx);
  }

  if (thickenStream(map, 0, fords) > 0) carveFords(map, camp);
}
