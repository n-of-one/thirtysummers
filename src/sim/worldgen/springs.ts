import * as C from "../../config.ts";
import { mulberry32, shuffle } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceNode, Vec2 } from "../types.ts";

/** True if any of the eight neighbours of (x, y) is stream. */
function touchesStream(map: TileMap, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx !== 0 || dy !== 0) && map.get(x + dx, y + dy) === "stream") return true;
    }
  }
  return false;
}

/**
 * Put springs along the streams: reeds on the bank, where the player drinks.
 *
 * A spring is not terrain. It stands on a walkable tile touching the stream on
 * any of its eight sides, so the player drinks at the water's edge and walks
 * over it like any other bank. Bridges are left out, since a spring belongs to
 * the bank and not to what was built across the water, and so are the camp's
 * clearing and tiles a node already grows on.
 *
 * The candidates are shuffled by `seed` and taken with `SPRING_SPACING_TILES`
 * between them, counting diagonals, so they sit along the water the way the
 * old water nodes did rather than bunching at the top of the map. The same
 * seed always gives the same springs, which is what lets this run over a
 * hand-edited map, with a fixed seed, as well as over a generated one.
 *
 * Returns the tiles, as integer tile coordinates, in the order they were taken.
 */
export function placeSprings(
  map: TileMap,
  camp: Vec2,
  nodes: readonly ResourceNode[],
  seed: number,
): Vec2[] {
  const occupied = new Set(nodes.map((n) => Math.floor(n.y) * map.width + Math.floor(n.x)));
  const candidates: Vec2[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!map.isPassable(x, y) || map.get(x, y) === "bridge") continue;
      if (occupied.has(y * map.width + x)) continue;
      const fromCamp = Math.max(Math.abs(x + 0.5 - camp.x), Math.abs(y + 0.5 - camp.y));
      if (fromCamp < C.SPRING_CAMP_CLEARANCE) continue;
      if (touchesStream(map, x, y)) candidates.push({ x, y });
    }
  }

  // Salted, so the springs are not drawn from the same stream as anything
  // else seeded with this number.
  shuffle(mulberry32(seed ^ 0x5eed5), candidates);
  const placed: Vec2[] = [];
  for (const tile of candidates) {
    const tooClose = placed.some(
      (p) => Math.max(Math.abs(p.x - tile.x), Math.abs(p.y - tile.y)) < C.SPRING_SPACING_TILES,
    );
    if (!tooClose) placed.push(tile);
  }
  return placed;
}
