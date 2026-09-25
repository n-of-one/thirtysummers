import { MAP_COLORS } from "../config.ts";
import type { TerrainKind } from "../sim/types.ts";
import type { World } from "../sim/world.ts";

/**
 * The valley as the family has seen it, a colour a tile. The map in the corner
 * draws a window of it, and M10.5's winter screen draws it larger, so there is
 * one picture of the valley and not two.
 *
 * It shows the terrain -- ground, water, walls, the woods, bridges -- with
 * wells, camp and fruit trees on it, and never what there is to pick:
 * remembering the field is the player's. A trail is not terrain until it is
 * walked into grass, so its stages of wear are not drawn.
 */

const GROUND: Record<TerrainKind, number> = {
  grass: MAP_COLORS.grass,
  underbrush: MAP_COLORS.underbrush,
  denseUnderbrush: MAP_COLORS.denseUnderbrush,
  mud: MAP_COLORS.mud,
  stream: MAP_COLORS.stream,
  tree: MAP_COLORS.tree,
  sapling: MAP_COLORS.tree,
  rock: MAP_COLORS.rock,
  thicket: MAP_COLORS.thicket,
  bridge: MAP_COLORS.bridge,
};

/**
 * What is drawn over the ground, by tile index: fruit, wells and camp. Worked
 * out once per drawing, since a tile-by-tile search of the nodes and the
 * springs would be the whole cost of it.
 *
 * A fruit tree is a landmark, drawn as a 2 by 2 block in the fruit colour:
 * its trunk and the tiles east, south and south-east of it. Always, picked or
 * not, because the tree is the place to come back to. Nothing in the
 * simulation says which tree is one: the layout hangs its fruit on the eight
 * tiles round the trunk and keeps every other tree two tiles off, so a tree
 * with a fruit node beside it is a fruit tree.
 */
export function mapMarks(world: World): Map<number, number> {
  const { map } = world;
  const w = map.width;
  const marks = new Map<number, number>();
  const trunks = new Set<number>();
  for (const node of world.nodes) {
    if (node.kind !== "fruit") continue;
    const nx = Math.floor(node.x);
    const ny = Math.floor(node.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (map.inBounds(nx + dx, ny + dy) && map.get(nx + dx, ny + dy) === "tree") trunks.add((ny + dy) * w + nx + dx);
      }
    }
  }
  for (const t of trunks) {
    const x = t % w;
    const y = (t - x) / w;
    for (const [dx, dy] of FRUIT_TREE_BLOCK) {
      if (map.inBounds(x + dx, y + dy)) marks.set((y + dy) * w + x + dx, MAP_COLORS.fruitTree);
    }
  }
  for (const s of world.springs) if (s.well) marks.set(s.y * w + s.x, MAP_COLORS.well);
  marks.set(Math.floor(world.camp.y) * w + Math.floor(world.camp.x), MAP_COLORS.camp);
  return marks;
}

/** The tiles a fruit tree's mark covers, from its trunk. */
const FRUIT_TREE_BLOCK: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** The colour of tile (x, y) as `0xrrggbb`, or null where the family has not been, or off the map. */
export function tileColour(world: World, marks: ReadonlyMap<number, number>, x: number, y: number): number | null {
  const { width, height } = world.map;
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const i = y * width + x;
  if (world.seen[i] === 0) return null;
  const mark = marks.get(i);
  if (mark !== undefined) return mark;
  return GROUND[world.map.get(x, y)];
}
