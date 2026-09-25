import type { Amounts } from "./inventory.ts";
import type { ListLine } from "./list.ts";
import type { SummerSummary } from "./summary.ts";
import type { TileMap } from "./tilemap.ts";
import type { Recipe, ResourceKind, ResourceNode, Tool, Vec2 } from "./types.ts";

/**
 * A game saved at the end of a summer, so a scenario can be picked up again
 * at its winter without replaying the summers before it.
 *
 * It does not carry the map. The map comes from the same `?map=` or `?seed=`
 * as before, and the save holds only what the summers changed on it: the
 * tiles that differ, the nodes picked, the wells, what camp and the pack hold,
 * and the bookkeeping the next winter needs. `fingerprint` is the map as it
 * came, so a save read onto the wrong map is refused rather than applied to
 * tiles it was never about.
 */
export interface SaveState {
  v: 4;
  fingerprint: string;
  year: number;
  elapsedSec: number;
  awayAtEnd: boolean;
  family: number;
  tired: boolean;
  list: ListLine[];
  tools: Tool[];
  recipes: Recipe[];
  pack: Amounts;
  camp: Amounts;
  /** Tile index and terrain id, for every tile that is not what the map came with. */
  terrain: [number, number][];
  /** Ids of the nodes picked and not back yet. */
  harvested: number[];
  /** Ids of the nodes picked this summer, a share of which comes back. */
  picked: number[];
  /** Tile index and the summer it was felled in. */
  felled: [number, number][];
  /** Tile indices cut, which thicket can creep back onto. */
  cut: number[];
  /**
   * Tile index and wear, for every tile whose wear is not what the map came
   * with: a trail is nothing but its wear, and the thin underbrush the map
   * starts with comes from the same seed again.
   */
  worn: [number, number][];
  /** The tiles the family has seen, as run lengths from `seen.ts`: unseen, seen, unseen... */
  seen: number[];
  wells: [number, number][];
  dropped: [ResourceKind, number, number][];
  /** The summer in numbers, for the winter screen: the event log is not saved. */
  summary: SummerSummary;
}

/**
 * The format's version. 4 since the map: a version 3 save has no seen tiles,
 * and would come back with the map in the corner blank. 3 was trails, and 2 camp no longer
 * selling.
 */
const VERSION = 4;

/**
 * A short hash of a map as it came: its terrain, its nodes and its camp. Two
 * loads of the same file or seed give the same string.
 */
export function fingerprint(map: TileMap, nodes: readonly ResourceNode[], camp: Vec2): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  mix(map.width);
  mix(map.width >> 8);
  mix(map.height);
  mix(map.height >> 8);
  for (const id of map.layerData(0)) mix(id);
  for (const n of nodes) {
    mix(n.id);
    mix(Math.floor(n.x));
    mix(Math.floor(n.y));
    mix(n.kind.charCodeAt(0));
  }
  mix(Math.floor(camp.x));
  mix(Math.floor(camp.y));
  return (h >>> 0).toString(36);
}

export class SaveError extends Error {}

/** The save as a string that sits in a URL: JSON, in base64url. */
export function encodeSave(state: SaveState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeSave(text: string): SaveState {
  let state: SaveState;
  try {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    state = JSON.parse(new TextDecoder().decode(bytes)) as SaveState;
  } catch {
    throw new SaveError("the save in the URL is not readable");
  }
  if (state?.v !== VERSION) throw new SaveError(`the save is version ${state?.v}, not ${VERSION}`);
  return state;
}
