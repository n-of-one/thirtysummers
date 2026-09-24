import { createNoise2D } from "simplex-noise";
import * as C from "../../config.ts";
import { hash2d, mulberry32, randInt, type Rng } from "../rng.ts";
import { TileMap } from "../tilemap.ts";
import type { TerrainKind, Vec2 } from "../types.ts";

type Noise2D = (x: number, y: number) => number;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Fractional Brownian motion: stacked octaves of simplex, normalised to ~[-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves: number): number {
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
 * Paint the terrain of a fresh map from noise: a rock border, a winding stream,
 * woods thinning towards their edges, and mud in the damp hollows between.
 *
 * `rng` supplies the derived seeds for the noise fields, so the same master
 * stream produces the same landscape. `seed` scatters the trees, which is a
 * spatial hash rather than a stream because it has to answer per tile.
 *
 * `stages`, if given, is filled with the trail stage each underbrush tile
 * starts at, read off the same noise by `UNDERBRUSH_THRESHOLDS`, so
 * underbrush is thin where the noise has only just crossed into it.
 *
 * `streams` false leaves the winding stream out, and paints what the forest
 * and moisture noise say there instead. A layout that lays its own water asks
 * for that: erasing the stream afterwards left a scar the shape of it, a band
 * of one ground drawn straight through whatever the noise had around it.
 */
export function paintTerrain(
  seed: number,
  rng: Rng,
  width = C.MAP_W,
  height = C.MAP_H,
  border = C.BORDER_THICKNESS,
  stages?: Uint8Array,
  streams = true,
): TileMap {
  // Independent noise fields, each with its own derived seed.
  const forestNoise = createNoise2D(mulberry32(randInt(rng, 0, 2 ** 31)));
  const moistureNoise = createNoise2D(mulberry32(randInt(rng, 0, 2 ** 31)));
  const streamNoise = createNoise2D(mulberry32(randInt(rng, 0, 2 ** 31)));

  const map = new TileMap(width, height, C.MAP_LAYERS);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nearEdge = x < border || y < border || x >= width - border || y >= height - border;
      if (nearEdge) {
        map.set(x, y, "rock");
        continue;
      }

      // A narrow band around zero of a low-frequency field carves a winding river.
      // The stream's noise is still made without streams, so the forest and
      // moisture fields keep the seeds they have always had.
      const stream = fbm(streamNoise, x / C.STREAM_SCALE, y / C.STREAM_SCALE, 1);
      if (streams && Math.abs(stream) < C.STREAM_WIDTH) {
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
      } else if (forest >= C.UNDERBRUSH_THRESHOLD) {
        kind = "underbrush";
        if (stages) stages[y * width + x] = underbrushStage(forest);
      } else {
        const moisture = fbm(moistureNoise, x / C.MOISTURE_SCALE, y / C.MOISTURE_SCALE, 3);
        kind = moisture >= C.MUD_THRESHOLD ? "mud" : "grass";
      }
      map.set(x, y, kind);
    }
  }

  return map;
}

/** The trail stage underbrush starts at for a forest noise value: the last threshold it reaches. */
export function underbrushStage(forest: number): number {
  let stage = 0;
  for (const band of C.UNDERBRUSH_THRESHOLDS) if (forest >= band.from) stage = band.stage;
  return stage;
}

/**
 * Clear the stage of every tile that is no longer underbrush, after a layout
 * has stamped over the landscape: a stage belongs to the underbrush the noise
 * painted, and grass or a wall stamped over it keeps none.
 */
export function keepStagesOnUnderbrush(map: TileMap, stages: Uint8Array): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) !== "underbrush") stages[y * map.width + x] = 0;
    }
  }
}

/** Nearest passable tile to the map centre with all 8 neighbours passable too. */
export function findCamp(map: TileMap): Vec2 {
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
