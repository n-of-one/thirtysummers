import { INTERACT_RADIUS } from "../config.ts";
import type { TileMap } from "./tilemap.ts";
import type { ResourceNode, TerrainKind, Vec2 } from "./types.ts";

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

/** A tile, by its integer coordinates. What cutting and building act on. */
export interface TileRef {
  x: number;
  y: number;
}

/**
 * The nearest tile of `kind` within reach of (x, y), measured centre to centre,
 * or null.
 *
 * Tools work on a tile rather than on a node, but they are aimed the same way
 * harvesting is: at whatever is nearest. Facing would be the obvious
 * alternative and is no use here -- every facing is diagonal, so "the tile in
 * front of you" is between two tiles and names neither.
 *
 * Only the square of tiles the radius can possibly reach is scanned, so this
 * costs the same whatever size the map is. Ties break on the lower tile index,
 * for the reason {@link nearestNodeWithin} breaks them on the lower id: a tie
 * that resolves differently each tick resets the hold every tick, and the cut
 * can never finish.
 */
export function nearestTileWithin(
  map: TileMap,
  x: number,
  y: number,
  kind: TerrainKind,
  radius = INTERACT_RADIUS,
  z = 0,
): TileRef | null {
  let best: TileRef | null = null;
  let bestDist = Infinity;
  let bestIndex = Infinity;

  const x0 = Math.floor(x - radius);
  const x1 = Math.floor(x + radius);
  const y0 = Math.floor(y - radius);
  const y1 = Math.floor(y + radius);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!map.inBounds(tx, ty, z)) continue;
      if (map.get(tx, ty, z) !== kind) continue;
      const dist = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      if (dist > radius) continue;
      const index = ty * map.width + tx;
      if (dist < bestDist || (dist === bestDist && index < bestIndex)) {
        best = { x: tx, y: ty };
        bestDist = dist;
        bestIndex = index;
      }
    }
  }
  return best;
}
