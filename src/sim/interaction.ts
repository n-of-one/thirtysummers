import { INTERACT_RADIUS } from "../config.ts";
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
