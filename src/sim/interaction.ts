import { INTERACT_RADIUS } from "../config.ts";
import type { TileMap } from "./tilemap.ts";
import type { ResourceNode, Vec2 } from "./types.ts";

/** Is `target` close enough to act on from (x, y)? */
export function withinReach(x: number, y: number, target: Vec2, radius = INTERACT_RADIUS): boolean {
  return Math.hypot(target.x - x, target.y - y) <= radius;
}

/**
 * The unharvested node nearest (x, y) and within reach, or null.
 *
 * A flat scan of every node on the map. There are 230 of them and this runs
 * once a tick, so an index would buy nothing but a structure to keep in step
 * with the harvesting.
 *
 * Ties break on the lower id so that standing exactly between two nodes picks
 * the same one every tick rather than flickering between them, which would
 * reset the harvest progress each frame.
 */
export function nearestNodeWithin(
  nodes: readonly ResourceNode[],
  x: number,
  y: number,
  radius = INTERACT_RADIUS,
): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (const node of nodes) {
    if (node.harvested) continue;
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist > radius) continue;
    if (dist < bestDist || (dist === bestDist && best && node.id < best.id)) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * The spring nearest (x, y) and within reach of its tile's centre, or null.
 *
 * Nearest to the player, not aimed: springs are sparse, and one is drunk from
 * by standing at it. Ties break on list order, which is fixed for a map.
 */
export function nearestSpringWithin(
  springs: readonly Vec2[],
  x: number,
  y: number,
  radius = INTERACT_RADIUS,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const spring of springs) {
    const dist = Math.hypot(spring.x + 0.5 - x, spring.y + 0.5 - y);
    if (dist <= radius && dist < bestDist) {
      best = spring;
      bestDist = dist;
    }
  }
  return best;
}

/** A tile, by its integer coordinates. What cutting and building act on. */
export interface TileRef {
  x: number;
  y: number;
}

/**
 * The tile a tool acts on: the neighbour of the player's own tile in the
 * direction they last walked, one of eight, or null before the first step or
 * off the map.
 *
 * Only ever that one tile. Choosing among the tiles in reach, even aimed
 * along the heading, still let a tile beside the player win wherever the one
 * ahead was a little out of reach, so the target could turn sideways while the
 * player walked straight. The neighbour of the tile being stood on is always
 * close enough to work on, and it never changes while the player crosses a
 * tile, so a hold is never restarted by a shift inside one.
 */
export function tileAhead(map: TileMap, x: number, y: number, heading: Vec2 | null, z = 0): TileRef | null {
  if (!heading) return null;
  const tx = Math.floor(x) + Math.sign(heading.x);
  const ty = Math.floor(y) + Math.sign(heading.y);
  return map.inBounds(tx, ty, z) ? { x: tx, y: ty } : null;
}
