import { HYDRATION_FOG_THRESHOLD, MAP_COLORS, MAP_DRY_FADE_STEPS } from "../config.ts";
import type { TerrainKind } from "../sim/types.ts";
import type { World } from "../sim/world.ts";

/**
 * The valley as the family has seen it, a colour a tile. The map in the corner
 * draws a window of it, and M10.7's winter screen draws it larger, so there is
 * one picture of the valley and not two.
 *
 * It shows the terrain -- ground, water, walls, the woods, bridges -- with
 * springs, wells, camp and fruit trees on it, and never what there is to pick:
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
 * What is drawn over the ground, by tile index: fruit trees, springs and wells, and camp. Worked
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
  // Every drinking spot, a spring in the reeds as much as a well: where to
  // drink is what a thirsty player opens the map for.
  for (const s of world.springs) marks.set(s.y * w + s.x, MAP_COLORS.drink);
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

/**
 * The ground that stays on the whole map however dry the player is: the river
 * and its bridges, and thicket, the walls a way round is found by. With the
 * marks -- drinking spots, fruit trees, camp -- these are the landmarks.
 */
const LANDMARK_GROUND: ReadonlySet<TerrainKind> = new Set(["stream", "bridge", "thicket"]);

/** Is tile (x, y) a landmark, kept in its full colour on the whole map when the rest fades? */
export function isLandmark(world: World, marks: ReadonlyMap<number, number>, x: number, y: number): boolean {
  return marks.has(y * world.map.width + x) || LANDMARK_GROUND.has(world.map.get(x, y));
}

/**
 * How much of its brightness the whole map keeps at a hydration, as the eye
 * judges brightness: 1 down to the fog's threshold, falling evenly to 0 at
 * none, in `MAP_DRY_FADE_STEPS` steps so it is redrawn a few dozen times
 * rather than every frame.
 */
export function dryBrightness(hydration: number): number {
  const share = Math.min(Math.max(hydration / HYDRATION_FOG_THRESHOLD, 0), 1);
  return Math.round(share * MAP_DRY_FADE_STEPS) / MAP_DRY_FADE_STEPS;
}

/**
 * `colour` faded towards the unseen blank until it looks `brightness` as
 * bright, 1 untouched and 0 the blank.
 *
 * Not a straight mix of the numbers: the eye judges brightness roughly as the
 * cube root of the light, so the light is taken as `brightness` cubed, and the
 * mix is done in linear light rather than in the screen's gamma-encoded
 * values. A straight mix would look as if it held on and then fell away at the
 * end; this looks like an even fall.
 */
export function fade(colour: number, brightness: number): number {
  if (brightness >= 1) return colour;
  const light = brightness ** 3;
  const u = MAP_COLORS.unseen;
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const from = toLinear((u >> shift) & 0xff);
    const to = toLinear((colour >> shift) & 0xff);
    out |= toSrgb(from + (to - from) * light) << shift;
  }
  return out;
}

/** An sRGB channel, 0 to 255, as linear light, 0 to 1. */
function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Linear light, 0 to 1, as an sRGB channel, 0 to 255. */
function toSrgb(l: number): number {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(Math.max(s, 0), 1) * 255);
}

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
