import type { TerrainKind } from "./types.ts";
import { DIFFICULT_SPEED_MUL } from "../config.ts";

export interface TerrainDef {
  kind: TerrainKind;
  /** Can the player stand here? */
  passable: boolean;
  /** Difficult terrain drains stamina while moving and slows you down. */
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
): TerrainDef => ({
  kind,
  passable,
  difficult,
  speedMul: difficult ? DIFFICULT_SPEED_MUL : 1,
  glyph,
});

export const TERRAIN: Record<TerrainKind, TerrainDef> = {
  grass: def("grass", true, false, "."),
  underbrush: def("underbrush", true, true, ","),
  mud: def("mud", true, true, "~"),
  tree: def("tree", false, false, "T"),
  stream: def("stream", false, false, "="),
  rock: def("rock", false, false, "#"),
};

/** Stable id order -- the tile grid stores these indices, so do not reorder. */
export const TERRAIN_ORDER: readonly TerrainKind[] = [
  "grass",
  "underbrush",
  "mud",
  "tree",
  "stream",
  "rock",
];

export const TERRAIN_ID: Record<TerrainKind, number> = Object.fromEntries(
  TERRAIN_ORDER.map((k, i) => [k, i]),
) as Record<TerrainKind, number>;
