import type { TerrainKind } from "./types.ts";
import { MUD_SPEED_MUL, UNDERBRUSH_SPEED_MUL } from "../config.ts";

export interface TerrainDef {
  kind: TerrainKind;
  /** Can the player stand here? */
  passable: boolean;
  /** Difficult terrain slows you down, and that is all it does. */
  difficult: boolean;
  /** Movement speed multiplier while standing on this tile. */
  speedMul: number;
  /** Single character used by the headless ASCII map dump. */
  glyph: string;
}

const def = (
  kind: TerrainKind,
  passable: boolean,
  difficult: boolean,
  glyph: string,
  speedMul = 1,
): TerrainDef => ({
  kind,
  passable,
  difficult,
  speedMul: difficult ? speedMul : 1,
  glyph,
});

export const TERRAIN: Record<TerrainKind, TerrainDef> = {
  grass: def("grass", true, false, "."),
  // The two rough grounds walk at their own speeds: pushing through is not
  // wading.
  underbrush: def("underbrush", true, true, ",", UNDERBRUSH_SPEED_MUL),
  mud: def("mud", true, true, "~", MUD_SPEED_MUL),
  tree: def("tree", false, false, "T"),
  stream: def("stream", false, false, "="),
  rock: def("rock", false, false, "#"),
  // A wall of brambles, thin enough to see over. The knife cuts it, which is
  // the only way past: nothing else in the prototype turns it into ground.
  thicket: def("thicket", false, false, "%"),
  // Planks laid over the stream, one tile at a time. Easy ground, because the
  // whole point of building one is that the crossing stops costing anything.
  bridge: def("bridge", true, false, "-"),
  // A copse of young trees. A wall like a grown tree, but the axe fells it,
  // leaving grass and a log.
  sapling: def("sapling", false, false, "t"),
  // Underbrush grown too old and matted for feet to wear down: as slow as full
  // underbrush, and it never becomes a trail. Not a wall either, so the knife
  // has nothing to cut. It is what the ground is near trees.
  denseUnderbrush: def("denseUnderbrush", true, true, ";", UNDERBRUSH_SPEED_MUL),
  // The edge of the ravine the river runs in: a wall, like rock. Nothing
  // stands at the river's level, so the river is never reached.
  cliff: def("cliff", false, false, "^"),
};

/** Stable id order -- the tile grid stores these indices, so do not reorder. */
export const TERRAIN_ORDER: readonly TerrainKind[] = [
  "grass",
  "underbrush",
  "mud",
  "tree",
  "stream",
  "rock",
  "thicket",
  "bridge",
  "sapling",
  "denseUnderbrush",
  "cliff",
];

export const TERRAIN_ID: Record<TerrainKind, number> = Object.fromEntries(
  TERRAIN_ORDER.map((k, i) => [k, i]),
) as Record<TerrainKind, number>;
