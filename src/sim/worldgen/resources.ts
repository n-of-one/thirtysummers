import * as C from "../../config.ts";
import { shuffle, type Rng } from "../rng.ts";
import type { TileMap } from "../tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind, Vec2 } from "../types.ts";
import { Grid } from "./grid.ts";

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

/**
 * Scatter the resources over ground the player can actually walk to.
 *
 * Each kind draws from its own pool of candidate tiles, so where a resource
 * grows says something about the terrain: fruit at the forest edge, ore
 * across open ground. A tile is only ever used once.
 */
export function placeResources(
  map: TileMap,
  reachable: Uint8Array,
  camp: Vec2,
  rng: Rng,
): ResourceNode[] {
  const grid = new Grid(map.width, map.height);
  const campX = Math.floor(camp.x);
  const campY = Math.floor(camp.y);

  const nearTrees: number[] = [];
  const open: number[] = [];

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const idx = grid.index(x, y);
      if (!reachable[idx]) continue;
      if (x === campX && y === campY) continue;
      const kind = map.get(x, y);
      const brush = kind === "underbrush" || kind === "denseUnderbrush";
      if (kind !== "grass" && !brush && kind !== "mud") continue;

      if (touches(map, x, y, "tree")) nearTrees.push(idx);
      if (kind === "grass" || brush) open.push(idx);
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
      nodes.push({
        id: nextId++,
        kind,
        x: grid.xOf(idx) + 0.5,
        y: grid.yOf(idx) + 0.5,
        z: 0,
        harvested: false,
      });
    }
  };

  place("fruit", nearTrees, C.FRUIT_NODES);
  place("ore", open, C.ORE_NODES);

  return nodes;
}
