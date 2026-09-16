import * as C from "../config.ts";
import { TERRAIN, TERRAIN_ORDER } from "./terrain.ts";
import { TileMap } from "./tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind, Vec2 } from "./types.ts";
import { reachableFrom } from "./worldgen/reachability.ts";
import { placeSprings } from "./worldgen/springs.ts";
import type { GeneratedWorld } from "./worldgen.ts";

/**
 * The text map format: one character per tile, one line per row.
 *
 * It is exactly what `npm run map` has always printed, promoted from a debug
 * dump to something the game can read back. That is the whole point of it --
 * the discovery test needs maps that hold a particular chain of barriers, and
 * teaching the generator to build one is a great deal more work than editing a
 * dump it already produces. So: generate, edit by hand, play blind.
 *
 * Nothing here is a renderer or a file system. Reading the file is the caller's
 * job, which is what lets the round trip be tested and lets the same code serve
 * the dump script, the checker and the browser.
 */

/** Glyph for each resource node, as it appears over the ground it grows on. */
export const RESOURCE_GLYPH: Record<ResourceKind, string> = {
  fruit: "f",
  ore: "v",
  vine: "y",
  stick: "s",
};

/** The camp, which is also where the player starts. */
export const CAMP_GLYPH = "C";

/**
 * What a node glyph is standing on, since one character cannot say both.
 *
 * Every resource but the vine grows on open grass; the vine grows in the mud
 * pocket that is its whole reason for being a soft barrier, so a `y` implies
 * mud under it. An editor who wants a node on some other ground can say so by
 * moving it, which is the kind of thing the format is deliberately too small
 * to express.
 */
export const NODE_GROUND: Record<ResourceKind, TerrainKind> = {
  fruit: "grass",
  ore: "grass",
  vine: "mud",
  stick: "grass",
};

/** The camp stands on grass, cleared. */
export const CAMP_GROUND: TerrainKind = "grass";

const TERRAIN_BY_GLYPH = new Map<string, TerrainKind>(
  TERRAIN_ORDER.map((kind) => [TERRAIN[kind].glyph, kind]),
);
const RESOURCE_BY_GLYPH = new Map<string, ResourceKind>(
  Object.entries(RESOURCE_GLYPH).map(([kind, glyph]) => [glyph, kind as ResourceKind]),
);

export class MapFileError extends Error {}

/**
 * Read a map file into a world the simulation can run.
 *
 * Strict on purpose: these files are edited by hand, and a typo that silently
 * became grass would be a barrier quietly missing from a playtest. Every
 * complaint names the line and column, counting from 1, so an editor can find
 * it in a text editor without arithmetic.
 *
 * `seed` is carried through only so the readout and the URL have something to
 * show; nothing is generated from it.
 */
export function parseMap(text: string, seed = 0): GeneratedWorld {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  // A trailing newline is what every text editor writes, so it is not an error.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (lines.length === 0) throw new MapFileError("map file is empty");

  const width = lines[0]!.length;
  const height = lines.length;
  for (let y = 0; y < height; y++) {
    if (lines[y]!.length !== width) {
      throw new MapFileError(
        `line ${y + 1} is ${lines[y]!.length} tiles wide, but line 1 is ${width}`,
      );
    }
  }

  const map = new TileMap(width, height);
  const nodes: ResourceNode[] = [];
  let camp: Vec2 | null = null;

  for (let y = 0; y < height; y++) {
    const line = lines[y]!;
    for (let x = 0; x < width; x++) {
      const glyph = line[x]!;

      const terrain = TERRAIN_BY_GLYPH.get(glyph);
      if (terrain) {
        map.set(x, y, terrain);
        continue;
      }

      const resource = RESOURCE_BY_GLYPH.get(glyph);
      if (resource) {
        map.set(x, y, NODE_GROUND[resource]);
        nodes.push({
          id: nodes.length + 1,
          kind: resource,
          x: x + 0.5,
          y: y + 0.5,
          z: 0,
          harvested: false,
        });
        continue;
      }

      if (glyph === CAMP_GLYPH) {
        if (camp) {
          throw new MapFileError(
            `line ${y + 1}, column ${x + 1}: a second camp; there can only be one`,
          );
        }
        map.set(x, y, CAMP_GROUND);
        camp = { x: x + 0.5, y: y + 0.5 };
        continue;
      }

      throw new MapFileError(`line ${y + 1}, column ${x + 1}: unknown glyph "${glyph}"`);
    }
  }

  if (!camp) throw new MapFileError(`no camp: the map needs one "${CAMP_GLYPH}"`);

  // The file carries no springs. They are placed by the generator's own pass,
  // on a fixed seed, so the same file gets the same springs every load.
  const springs = placeSprings(map, camp, nodes, C.MAP_SPRING_SEED);
  return { seed, map, camp, nodes, springs, reachable: reachableFrom(map, camp) };
}

/**
 * Write a world back out as a map file.
 *
 * The inverse of {@link parseMap} for everything the format carries, which is
 * terrain, nodes and the camp. Springs are not written: reading the file back
 * places them again. It is not an inverse for anything else, and is
 * not meant to be: a round trip through a file is how a generated map becomes
 * an edited one, so what survives the trip is exactly what an editor is allowed
 * to change.
 */
export function formatMap(world: GeneratedWorld, z = 0): string {
  const { map } = world;
  const overlay = new Map<number, string>();
  for (const node of world.nodes) {
    overlay.set(Math.floor(node.y) * map.width + Math.floor(node.x), RESOURCE_GLYPH[node.kind]);
  }
  // The camp goes on last, so a node generated onto the camp tile cannot bury
  // the one glyph the file cannot do without.
  overlay.set(Math.floor(world.camp.y) * map.width + Math.floor(world.camp.x), CAMP_GLYPH);

  const lines: string[] = [];
  for (let y = 0; y < map.height; y++) {
    let row = "";
    for (let x = 0; x < map.width; x++) {
      row += overlay.get(y * map.width + x) ?? TERRAIN[map.get(x, y, z)].glyph;
    }
    lines.push(row);
  }
  return `${lines.join("\n")}\n`;
}

/** The legend, for the dump script's footer and the checker's. */
export function mapLegend(): string {
  const terrain = TERRAIN_ORDER.map((kind) => `${TERRAIN[kind].glyph} ${kind}`).join("   ");
  const resources = Object.entries(RESOURCE_GLYPH)
    .map(([kind, glyph]) => `${glyph} ${kind}`)
    .join("   ");
  return `${terrain}\n           ${CAMP_GLYPH} camp   ${resources}`;
}
