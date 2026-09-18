import * as C from "../config.ts";
import { mulberry32 } from "./rng.ts";
import type { TileMap } from "./tilemap.ts";
import type { ResourceNode, Spring, Vec2 } from "./types.ts";
import { reachableFrom } from "./worldgen/reachability.ts";
import { placeResources } from "./worldgen/resources.ts";
import { placeSprings } from "./worldgen/springs.ts";
import { findCamp, paintTerrain } from "./worldgen/terrain.ts";
import { connectAcrossWater, thickenStream } from "./worldgen/water.ts";

export { reachableFrom } from "./worldgen/reachability.ts";
export { carveFords, streamMask, thickenStream } from "./worldgen/water.ts";
export { fbm, findCamp, paintTerrain } from "./worldgen/terrain.ts";
export { placeResources } from "./worldgen/resources.ts";
export { placeSprings } from "./worldgen/springs.ts";
export { layoutSummerWorld } from "./worldgen/layout.ts";
export { Grid, NEIGHBOURS_4 } from "./worldgen/grid.ts";

export interface GeneratedWorld {
  seed: number;
  map: TileMap;
  /** Tile the camp sits on; also the player spawn. */
  camp: Vec2;
  nodes: ResourceNode[];
  /** Tiles with a spring or a well on them, in integer tile coordinates. */
  springs: Spring[];
  /** Mask of tiles walkable from the camp, indexed y * width + x. */
  reachable: Uint8Array;
}

/**
 * A seed in, a world out.
 *
 * The order matters and each step depends on the last: the stream has to be
 * wide enough to draw before the camp is placed, because the camp needs solid
 * ground; the camp has to exist before fords can be cut, because a ford is
 * defined as a crossing back to the camp; only then is it known which ground is
 * reachable, which is the only ground worth putting resources on. The springs
 * go in last, on the bank, clear of the camp and of the nodes, from their own
 * stream of numbers so that moving them never moves a resource.
 *
 * The steps themselves live in ./worldgen/.
 */
export function generateWorld(seed: number = C.DEFAULT_SEED): GeneratedWorld {
  const master = mulberry32(seed);

  const map = paintTerrain(seed, master);
  thickenStream(map);

  const camp = findCamp(map);
  connectAcrossWater(map, camp);

  const reachable = reachableFrom(map, camp);
  const nodes = placeResources(map, reachable, camp, master);
  const springs = placeSprings(map, camp, nodes, seed);

  return { seed, map, camp, nodes, springs, reachable };
}
