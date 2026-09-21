import type { TileMap } from "../tilemap.ts";
import type { Vec2 } from "../types.ts";
import { Grid, NEIGHBOURS_4 } from "./grid.ts";

/**
 * Can the player stand on this tile? The default is what the terrain says.
 *
 * Taking it as an argument is what lets the same fill answer a different
 * question: "where could I get to if the thicket were not there" is the fill
 * with thicket counted as passable, and that is how the map checker proves a
 * chain of barriers is really a chain rather than a scenic route.
 */
export type Passable = (x: number, y: number) => boolean;

/**
 * Breadth-first flood fill over passable tiles.
 *
 * A winding stream can cut the map in two, which would strand resources behind
 * impassable water. Rather than constrain the generator, we generate freely and
 * then only place resources in the region actually walkable from camp.
 */
export function reachableFrom(
  map: TileMap,
  start: Vec2,
  z = 0,
  passable: Passable = (x, y) => map.isPassable(x, y, z),
): Uint8Array {
  const grid = new Grid(map.width, map.height);
  const seen = new Uint8Array(grid.size);
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  if (!passable(sx, sy)) return seen;

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
      if (!passable(nx, ny)) continue;
      seen[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return seen;
}

/**
 * The near ring: everything camp reaches without crossing water, walls and
 * all. 1 for a tile inside it.
 *
 * Worked out from the map rather than remembered from the layout, so a
 * hand-edited file keeps the rule that inside the first stream everything is
 * back every year. Thicket, saplings and trees count as inside, since they are
 * walls within the ring rather than its edge; a bridge counts as water, so a
 * ring measured after the stream was crossed is still the same ring.
 */
export function nearRing(map: TileMap, camp: Vec2, z = 0): Uint8Array {
  return reachableFrom(map, camp, z, (x, y) => {
    const kind = map.get(x, y, z);
    return kind !== "stream" && kind !== "bridge" && kind !== "rock";
  });
}
