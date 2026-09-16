import * as C from "../../config.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceNode, Vec2 } from "../types.ts";

/**
 * How far (x, y) is from the nearest stream tile, counting diagonals, or
 * `limit + 1` when none is that close.
 */
function streamDistance(map: TileMap, x: number, y: number, limit: number): number {
  for (let d = 1; d <= limit; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        if (map.get(x + dx, y + dy) === "stream") return d;
      }
    }
  }
  return limit + 1;
}

/** All eight neighbours can be walked on, so a solid tile here shuts nothing in. */
function openAllRound(map: TileMap, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx !== 0 || dy !== 0) && !map.isPassable(x + dx, y + dy)) return false;
    }
  }
  return true;
}

/**
 * Put springs along the streams: the places to drink, near the water but never
 * in it, so the stream is only ever somewhere to bridge.
 *
 * A spring goes on open grass exactly `SPRING_STREAM_DISTANCE` from the stream,
 * on either side, with all eight neighbours walkable so that a solid pool never
 * closes a path, and no nearer another spring than `SPRING_SPACING_TILES`. The
 * tiles are taken in reading order rather than at random: the same map always
 * gets the same springs, which is what lets this run over a hand-edited map as
 * well as a generated one.
 *
 * Returns how many were placed.
 */
export function placeSprings(map: TileMap, camp: Vec2, nodes: readonly ResourceNode[] = []): number {
  const occupied = new Set(nodes.map((n) => Math.floor(n.y) * map.width + Math.floor(n.x)));
  const placed: Vec2[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) !== "grass") continue;
      if (occupied.has(y * map.width + x)) continue;
      const fromCamp = Math.max(Math.abs(x + 0.5 - camp.x), Math.abs(y + 0.5 - camp.y));
      if (fromCamp < C.SPRING_CAMP_CLEARANCE) continue;
      if (streamDistance(map, x, y, C.SPRING_STREAM_DISTANCE) !== C.SPRING_STREAM_DISTANCE) continue;
      if (!openAllRound(map, x, y)) continue;
      const tooClose = placed.some(
        (p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < C.SPRING_SPACING_TILES,
      );
      if (tooClose) continue;
      map.set(x, y, "spring");
      placed.push({ x, y });
    }
  }
  return placed.length;
}
