import { createNoise2D } from "simplex-noise";
import { hash2d, mulberry32, randInt, shuffle, type Rng } from "./rng.ts";
import { TileMap } from "./tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind, Vec2 } from "./types.ts";
import * as C from "../config.ts";

export interface GeneratedWorld {
  seed: number;
  map: TileMap;
  /** Tile the camp sits on; also the player spawn. */
  camp: Vec2;
  nodes: ResourceNode[];
  /** Mask of tiles walkable from the camp, indexed y * width + x. */
  reachable: Uint8Array;
}

type Noise2D = (x: number, y: number) => number;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Fractional Brownian motion: stacked octaves of simplex, normalised to ~[-1, 1]. */
function fbm(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/**
 * Breadth-first flood fill over passable tiles.
 *
 * A winding stream can cut the map in two, which would strand resources behind
 * impassable water. Rather than constrain the generator, we generate freely and
 * then only place resources in the region actually walkable from camp.
 */
export function reachableFrom(map: TileMap, start: Vec2, z = 0): Uint8Array {
  const { width, height } = map;
  const seen = new Uint8Array(width * height);
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (!map.isPassable(sx, sy, z)) return seen;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = sy * width + sx;
  seen[sy * width + sx] = 1;

  while (head < tail) {
    const idx = queue[head++]!;
    const x = idx % width;
    const y = (idx - x) / width;
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const;
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (seen[nIdx]) continue;
      if (!map.isPassable(nx, ny, z)) continue;
      seen[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return seen;
}

/**
 * Streams generated from a noise band happily cut the map into islands. Rather
 * than constrain the generator, we find each stranded region and carve the
 * shortest crossing back to camp, turning the water into a muddy ford (and any
 * blocking trees into underbrush).
 *
 * Fords are difficult terrain, so a crossing still costs stamina -- exactly the
 * kind of friction a bridge would later remove.
 */
export function carveFords(map: TileMap, camp: Vec2, minRegion = 25, maxFords = 60): number {
  const { width, height } = map;
  let carved = 0;

  for (let iter = 0; iter < maxFords; iter++) {
    const reachable = reachableFrom(map, camp);

    // Largest passable region that camp cannot walk to.
    const seen = new Uint8Array(width * height);
    let bestSeed = -1;
    let bestSize = 0;
    for (let idx = 0; idx < width * height; idx++) {
      if (seen[idx] || reachable[idx]) continue;
      const x0 = idx % width;
      const y0 = (idx - x0) / width;
      if (!map.isPassable(x0, y0)) continue;

      let size = 0;
      const stack = [idx];
      seen[idx] = 1;
      while (stack.length) {
        const cur = stack.pop()!;
        size++;
        const cx = cur % width;
        const cy = (cur - cx) / width;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
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
    if (bestSeed < 0 || bestSize < minRegion) break;

    // Shortest path from the stranded region back to reachable ground,
    // travelling through anything that is not the rock border.
    const parent = new Int32Array(width * height).fill(-1);
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    queue[tail++] = bestSeed;
    visited[bestSeed] = 1;
    let target = -1;

    while (head < tail && target < 0) {
      const cur = queue[head++]!;
      const cx = cur % width;
      const cy = (cur - cx) / width;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
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
    if (target < 0) break; // nothing to connect to; give up rather than loop

    for (let node = target; node !== -1; node = parent[node]!) {
      const x = node % width;
      const y = (node - x) / width;
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

/** Which tiles are stream, as a flat mask over the layer. */
function streamMask(map: TileMap, z = 0): Uint8Array {
  const mask = new Uint8Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y, z) === "stream") mask[y * map.width + x] = 1;
    }
  }
  return mask;
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

/** Give up rather than loop; two passes is already more than any seed needs. */
const MAX_THICKEN_PASSES = 8;

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
 * The condition enforced is that every stream tile sits inside some 2x2 square
 * of stream, which is what "two tiles across everywhere" means on a grid. A
 * corner touch is repaired by filling both of the tiles between, which turns the
 * pair into such a square rather than into a one-wide elbow.
 *
 * Only pinches are widened. A stretch already two or more across is left exactly
 * as the noise drew it, so the river keeps its shape and only its narrowest
 * points give. Filling can create new pinches at the edges of what it filled, so
 * this runs to a fixed point; in practice that is one or two passes.
 *
 * Rock is never overwritten, so the map border stays sealed, and neither is
 * anything in `keep` -- which is how a ford already cut through the water
 * survives a second pass.
 */
export function thickenStream(map: TileMap, z = 0, keep?: ReadonlySet<number>): number {
  const isStream = (x: number, y: number) => map.get(x, y, z) === "stream";
  const takeable = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height &&
    map.get(x, y, z) !== "rock" &&
    !keep?.has(y * map.width + x);
  const cells = (sx: number, sy: number) =>
    [
      [sx, sy],
      [sx + 1, sy],
      [sx, sy + 1],
      [sx + 1, sy + 1],
    ] as const;

  let added = 0;
  for (let pass = 0; pass < MAX_THICKEN_PASSES; pass++) {
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
          fill.add(by * map.width + ax);
          fill.add(ay * map.width + bx);
        }
      }
    }

    // A pinch: a tile in no 2x2 square of stream. Complete whichever square
    // needs the least filling, so the widening hugs the water already there.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!isStream(x, y)) continue;
        const options = SQUARES.map(([dx, dy]) => cells(x + dx, y + dy)).filter((square) =>
          square.every(([cx, cy]) => takeable(cx, cy)),
        );
        const costs = options.map((square) => square.filter(([cx, cy]) => !isStream(cx, cy)).length);
        const cheapest = Math.min(...costs);
        if (options.length === 0 || cheapest === 0) continue; // hemmed in, or already wide
        // Ties are broken by position, so a long pinch does not widen the same
        // way down its whole length.
        const tied = options.filter((_, i) => costs[i] === cheapest);
        const square = tied[Math.floor(hash2d(1, x, y) * tied.length) % tied.length]!;
        for (const [cx, cy] of square) {
          if (!isStream(cx, cy)) fill.add(cy * map.width + cx);
        }
      }
    }

    if (fill.size === 0) break;
    for (const idx of fill) {
      const x = idx % map.width;
      const y = (idx - x) / map.width;
      map.set(x, y, "stream", z);
      added++;
    }
  }
  return added;
}

/** True if any of the 8 neighbours is the given terrain. */
function touches(map: TileMap, x: number, y: number, kind: TerrainKind): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (map.get(x + dx, y + dy) === kind) return true;
    }
  }
  return false;
}

/** Nearest passable tile to the map centre with all 8 neighbours passable too. */
function findCamp(map: TileMap): Vec2 {
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  const maxRadius = Math.max(map.width, map.height);

  for (let r = 0; r < maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only test the ring at distance r, not the filled square.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (map.get(x, y) !== "grass") continue;
        let clear = true;
        for (let ny = -1; ny <= 1 && clear; ny++) {
          for (let nx = -1; nx <= 1 && clear; nx++) {
            if (!map.isPassable(x + nx, y + ny)) clear = false;
          }
        }
        if (clear) return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  // Degenerate map; caller still gets something in bounds.
  return { x: cx + 0.5, y: cy + 0.5 };
}

export function generateWorld(seed: number = C.DEFAULT_SEED): GeneratedWorld {
  const master = mulberry32(seed);
  // Independent noise fields, each with its own derived seed.
  const forestNoise = createNoise2D(mulberry32(randInt(master, 0, 2 ** 31)));
  const moistureNoise = createNoise2D(mulberry32(randInt(master, 0, 2 ** 31)));
  const streamNoise = createNoise2D(mulberry32(randInt(master, 0, 2 ** 31)));

  const map = new TileMap(C.MAP_W, C.MAP_H, C.MAP_LAYERS);

  for (let y = 0; y < C.MAP_H; y++) {
    for (let x = 0; x < C.MAP_W; x++) {
      const nearEdge =
        x < C.BORDER_THICKNESS ||
        y < C.BORDER_THICKNESS ||
        x >= C.MAP_W - C.BORDER_THICKNESS ||
        y >= C.MAP_H - C.BORDER_THICKNESS;
      if (nearEdge) {
        map.set(x, y, "rock");
        continue;
      }

      // A narrow band around zero of a low-frequency field carves a winding river.
      const stream = fbm(streamNoise, x / C.STREAM_SCALE, y / C.STREAM_SCALE, 1);
      if (Math.abs(stream) < C.STREAM_WIDTH) {
        map.set(x, y, "stream");
        continue;
      }

      // One field drives grass -> underbrush -> forest. Because the underbrush
      // band sits directly below the tree threshold, trees come out ringed by
      // underbrush automatically.
      const forest = fbm(forestNoise, x / C.FOREST_SCALE, y / C.FOREST_SCALE, 4);
      let kind: TerrainKind;
      if (forest >= C.TREE_THRESHOLD) {
        // Inside a wood the floor is underbrush and trees are scattered over
        // it, thickening towards the middle. Scattering by a spatial hash --
        // rather than filling every tile -- leaves organic gaps you can
        // sometimes squeeze through, instead of a solid block of canopy.
        const depth = clamp01(
          (forest - C.TREE_THRESHOLD) / (C.FOREST_NOISE_MAX - C.TREE_THRESHOLD),
        );
        const density = C.TREE_DENSITY_EDGE + (C.TREE_DENSITY_CORE - C.TREE_DENSITY_EDGE) * depth;
        kind = hash2d(seed, x, y) < density ? "tree" : "underbrush";
      } else if (forest >= C.UNDERBRUSH_THRESHOLD) kind = "underbrush";
      else {
        const moisture = fbm(moistureNoise, x / C.MOISTURE_SCALE, y / C.MOISTURE_SCALE, 3);
        kind = moisture >= C.MUD_THRESHOLD ? "mud" : "grass";
      }
      map.set(x, y, kind);
    }
  }

  thickenStream(map);

  const camp = findCamp(map);
  // A ford cuts a one-tile line through the water, which leaves the stream on
  // either side of the cut thinner than the noise drew it -- often back to a
  // single tile. Repair those pinches afterwards, with the crossings themselves
  // held back so the repair cannot undo the very thing it is repairing around.
  const beforeFords = streamMask(map);
  carveFords(map, camp);
  const fords = new Set<number>();
  for (let idx = 0; idx < beforeFords.length; idx++) {
    const x = idx % map.width;
    const y = (idx - x) / map.width;
    if (beforeFords[idx] && map.get(x, y) !== "stream") fords.add(idx);
  }
  if (thickenStream(map, 0, fords) > 0) {
    // Widening can seal a gap somewhere else; give the fords another look.
    carveFords(map, camp);
  }
  const reachable = reachableFrom(map, camp);

  const nodes = placeResources(map, reachable, camp, master);
  return { seed, map, camp, nodes, reachable };
}

function placeResources(
  map: TileMap,
  reachable: Uint8Array,
  camp: Vec2,
  rng: Rng,
): ResourceNode[] {
  const campX = Math.floor(camp.x);
  const campY = Math.floor(camp.y);

  const nearTrees: number[] = [];
  const nearStream: number[] = [];
  const open: number[] = [];

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const idx = y * map.width + x;
      if (!reachable[idx]) continue;
      if (x === campX && y === campY) continue;
      const kind = map.get(x, y);
      if (kind !== "grass" && kind !== "underbrush" && kind !== "mud") continue;

      if (touches(map, x, y, "tree")) nearTrees.push(idx);
      if (touches(map, x, y, "stream")) nearStream.push(idx);
      if (kind === "grass" || kind === "underbrush") open.push(idx);
    }
  }

  const taken = new Set<number>();
  const nodes: ResourceNode[] = [];
  let nextId = 1;

  const place = (kind: ResourceKind, pool: number[], count: number): void => {
    let placed = 0;
    for (const idx of shuffle(rng, pool.slice())) {
      if (placed >= count) break;
      if (taken.has(idx)) continue;
      taken.add(idx);
      placed++;
      const x = idx % map.width;
      const y = (idx - x) / map.width;
      nodes.push({
        id: nextId++,
        kind,
        x: x + 0.5,
        y: y + 0.5,
        z: 0,
        harvested: false,
      });
    }
  };

  // Fruit grows at the forest edge, water is drawn at the stream bank, and
  // ores are scattered across open ground.
  place("fruit", nearTrees, C.FRUIT_NODES);
  place("water", nearStream, C.WATER_NODES);
  place("ore", open, C.ORE_NODES);

  return nodes;
}
