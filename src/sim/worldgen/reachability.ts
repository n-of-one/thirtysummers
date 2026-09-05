import type { TileMap } from "../tilemap.ts";
import type { Vec2 } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";

/**
 * Breadth-first flood fill over passable tiles.
 *
 * A winding stream can cut the map in two, which would strand resources behind
 * impassable water. Rather than constrain the generator, we generate freely and
 * then only place resources in the region actually walkable from camp.
 */
export function reachableFrom(map: TileMap, start: Vec2, z = 0): Uint8Array {
  const grid = new Grid(map.width, map.height);
  const seen = new Uint8Array(grid.size);
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (!map.isPassable(sx, sy, z)) return seen;

  const queue = new Int32Array(grid.size);
  let head = 0;
  let tail = 0;
  queue[tail++] = grid.index(sx, sy);
  seen[grid.index(sx, sy)] = 1;

  while (head < tail) {
    const idx = queue[head++]!;
    const x = grid.xOf(idx);
    const y = grid.yOf(idx);
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.contains(nx, ny)) continue;
      const nIdx = grid.index(nx, ny);
      if (seen[nIdx]) continue;
      if (!map.isPassable(nx, ny, z)) continue;
      seen[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return seen;
}
