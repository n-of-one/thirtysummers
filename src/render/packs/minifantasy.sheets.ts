/**
 * Where everything is on the Minifantasy sheets: file paths, tile coordinates,
 * and the tables that say how the pieces fit together.
 *
 * Art by Krishna Palacio. It is a paid licence and is NOT in the repository --
 * see public/assets/README.md.
 *
 * All of it was read off the actual pixels rather than taken from any layout
 * document, because the packs' own documentation does not describe these grids.
 * Splitting it from the loader means pointing the pack at different art is an
 * edit to this file alone.
 */
import type { Facing } from "../../sim/types.ts";

const ROOT = "/assets/minifantasy";
const FP = `${ROOT}/Minifantasy_ForgottenPlains_v3.6_Commercial_Version/Minifantasy_ForgottenPlains_Assets`;
const FARM = `${ROOT}/Minifantasy_Farm_v3.0/Minifantasy_Farm_Assets`;
const CRAFT = `${ROOT}/Minifantasy_CraftingAndProfessions_v1.0/Minifantasy_CraftingAndProfessions_Assets`;
const NPC = `${ROOT}/Minifantasy_AMyriadOfNPCs_v.1.0/Minifantasy_NPCs_Assets/Premade_NPCs`;
const SWAMP = `${ROOT}/Minifantasy_SilentSwamp_v1.0/Minifantasy_SilentSwamp_Assets`;

/** Which premade NPC the player is. Any folder under Premade_NPCs works. */
const CHARACTER = "Alchemist";

/**
 * Which sheet row holds each facing, four frames across.
 *
 * The art is a three-quarter view with four diagonal poses, not the N/S/E/W
 * layout a 4x4 sheet suggests. Rows 0 and 1 show the face (moving toward the
 * camera) and rows 2 and 3 show the back of the head; within each pair the
 * character's mass leans opposite ways. Confirmed on the Alchemist, whose
 * features are the clearest in the pack.
 */
export const WALK_ROWS: Record<Facing, number> = {
  southEast: 0,
  southWest: 1,
  northEast: 2,
  northWest: 3,
};

export const SHEETS = {
  tiles: `${FP}/Tileset/Minifantasy_ForgottenPlainsTiles.png`,
  props: `${FP}/props/Minifantasy_ForgottenPlainsProps.png`,
  farmCrops: `${FARM}/Crops/Minifantasy_FarmSeedsAndCrops.png`,
  farmProps: `${FARM}/Props/Minifantasy_FarmProps.png`,
  farmTiles: `${FARM}/Tileset/Minifantasy_FarmTileset.png`,
  mining: `${CRAFT}/Gathering_Professions/Mining/Minifantasy_CraftingAndProfessionsMining.png`,
  fibres: `${CRAFT}/Gathering_Professions/Harvesting/Minifantasy_CraftingAndProfessionsFibresPlants.png`,
  logging: `${CRAFT}/Gathering_Professions/Logging/Minifantasy_CraftingAndProfessionsLogging.png`,
  walk: `${NPC}/${CHARACTER}/Minifantasy_NPCs${CHARACTER}Walk.png`,
  /**
   * Undergrowth. The swamp pack ships this expressly to meet Forgotten Plains
   * grass -- the whole 24x40 file is one 3x5 block, and its light half is our
   * two grass colours exactly, (111,164,48) and (68,137,26), so the two sheets
   * butt together with no seam.
   */
  brushStencil: `${SWAMP}/Tileset/GrassLinkToForgottenPlains/Minifantasy_MurkySwampGrassToGrass.png`,
} as const;

export const T = 8; // source tile size

/**
 * Tiles in a drawn 3x5 block, before the narrow shapes are appended.
 *
 * Worth naming, because the two counts are easy to confuse: a block ends up
 * TILE_COUNT long, but only the first BLOCK_TILES of it are art the sheet
 * actually draws. Anything walking a block as source tiles -- picking a grass
 * variant, painting undergrowth through a stencil -- must stop here, or it reads
 * past the block and off into blank sheet.
 */
export const BLOCK_TILES = 15;

/** Top-left tile coordinate of each 3x5 autotile block on the tileset sheet. */
export const BLOCK = {
  grass: [2, 3],
  dirt: [7, 3],
  stone: [12, 3],
  // The two ripple frames sit side by side. The blocks directly below these
  // ((25,9) and (29,9)) are the same water with dirt banks instead of grass --
  // not animation frames. Verified by pixel diff: the horizontal pair differs
  // by 15% (ripples), the vertical pair by 32% (the whole bank changes colour).
  waterFrame0: [25, 3],
  waterFrame1: [29, 3],
} as const;

/**
 * The narrow dirt shapes a 3x5 block cannot hold, in NARROW_* order: nothing
 * adjacent, then dead ends pointing N / E / S / W, then the two one-wide strips.
 *
 * Six of them sit in a second block at (6,9), laid out by connectivity -- column
 * 6 joins nothing sideways, 7 joins east, 8 joins both, 9 joins west; row 9
 * joins nothing vertically, 10 joins south, 11 joins both, 12 joins north. Its
 * "joins nothing at all" corner is blank on the sheet, so the lone dirt blob at
 * (5,1) stands in. Read off the pixels, not the layout docs: every tile here was
 * classified by which of its four borders are dirt rather than grass.
 */
export const DIRT_NARROW: readonly NarrowTile[] = [
  [5, 1],
  [6, 12],
  [7, 9],
  [6, 10],
  [9, 9],
  [6, 11],
  [8, 9],
];

/**
 * How the undergrowth block is painted through the swamp block's outline.
 *
 * The swamp art gives a ragged, organic edge that a 3x5 grass block cannot
 * express, which is the whole reason for using it. Its colours are no good
 * though -- swamp greens, and flat where grass has a speckle -- so it is treated
 * as a stencil: each pixel is looked up by which of its three tones it carries,
 * and the corresponding pixel of the GRASS tile is painted instead, darkened
 * where the stencil says undergrowth.
 *
 * `tint` is the multiply the ground used to be drawn with before undergrowth had
 * tiles of its own, so the interior keeps exactly the colour and the speckle it
 * has always had. `rim` is the ratio the swamp artist uses between their two
 * dark tones, transplanted onto our palette so the boundary keeps its shading --
 * all 70 rim pixels in that block touch open ground, so it reads as the step up
 * into denser growth.
 */
/**
 * The multiply used in place of `BRUSH_STENCIL.tint` for a thicket.
 *
 * Roughly half the light, so the wall is unmistakably darker than the
 * undergrowth it is made of, while still being the same growth: what has
 * changed is the density, and density in this palette reads as shade.
 */
export const THICKET_TINT = [0x52, 0x66, 0x44] as const;

export const BRUSH_STENCIL = {
  bulk: [47, 90, 50],
  rim: [39, 73, 52],
  tint: [0x9f, 0xbc, 0x86],
} as const;

/**
 * The plank decking a bridge tile is drawn with, as [tile x, tile y] on the
 * farm tileset, and the ground it is laid over.
 *
 * The farm tileset draws boards three tiles long in two orientations and three
 * tones; these are the middle tiles of the mid-tone board, which are the ones
 * that repeat without a seam. They are rails with gaps between them -- alone
 * they show the water straight through -- so each is composited over the dirt
 * block's solid fill, which is what turns a rail into a deck.
 *
 * The orientation follows the run of bridge tiles, so a crossing built north to
 * south has its timbers running north to south. A single tile has no run yet
 * and gets the horizontal one.
 */
export const BRIDGE_PLANK = {
  horizontal: [2, 6],
  vertical: [2, 2],
} as const;

/** Half or quarter of a tile, named by where in the tile it sits. */
export type Region = "left" | "right" | "top" | "bottom" | "nw" | "ne" | "sw" | "se";

export const REGIONS: Record<Region, readonly [x: number, y: number, w: number, h: number]> = {
  left: [0, 0, T / 2, T],
  right: [T / 2, 0, T / 2, T],
  top: [0, 0, T, T / 2],
  bottom: [0, T / 2, T, T / 2],
  nw: [0, 0, T / 2, T / 2],
  ne: [T / 2, 0, T / 2, T / 2],
  sw: [0, T / 2, T / 2, T / 2],
  se: [T / 2, T / 2, T / 2, T / 2],
};

/**
 * How to cut each narrow shape out of a block's own edge pieces, in NARROW_*
 * order. Every entry is a list of [tile index in the block, region to take].
 *
 * The nine pieces of a 3x3 carry a bank on one or two sides each, and the bank
 * occupies only the outer two pixels or so of an 8px tile. A shape needing banks
 * on opposite sides can therefore be assembled from halves: a channel one tile
 * across is the left half of the piece banked on the west beside the right half
 * of the piece banked on the east. The seam falls in open water, where the two
 * halves are the same colour.
 *
 * This works from any 15-tile block, so a terrain with no drawn narrow art still
 * meets the grass with a proper bank instead of a square edge.
 */
export const SYNTH_NARROW: readonly (readonly (readonly [index: number, region: Region])[])[] = [
  // nothing adjacent: one quadrant from each of the four outer corners
  [
    [0, "nw"],
    [2, "ne"],
    [6, "sw"],
    [8, "se"],
  ],
  // joins north: banked west, south and east
  [
    [6, "left"],
    [8, "right"],
  ],
  // joins east: banked north, west and south
  [
    [0, "top"],
    [6, "bottom"],
  ],
  // joins south: banked north, west and east
  [
    [0, "left"],
    [2, "right"],
  ],
  // joins west: banked north, east and south
  [
    [2, "top"],
    [8, "bottom"],
  ],
  // north and south: a vertical channel, banked on both sides
  [
    [3, "left"],
    [5, "right"],
  ],
  // east and west: a horizontal channel, banked above and below
  [
    [1, "top"],
    [7, "bottom"],
  ],
];

/**
 * Where each resource node is cut from, as [sheet, tile x, tile y].
 *
 * Every one is a single 8x8 cell, decoded from the pixels the way the rest of
 * this file was. The two new ones are picked for contrast rather than for
 * botany: a node has to be recognisable from across the barrier it is behind,
 * which rules out anything that sits in the same green as the ground.
 *
 * `vine` is the crafting pack's agave, whose teal spikes read at a distance
 * against the mud it grows in -- hemp and ramie are the same greens as the
 * undergrowth. `stick` is the birch pickup icon from the logging sheet, a pale
 * cut length that stands out on the forest floor of the stand it comes from.
 * `ore` is the gold node it has always been.
 */
export const RESOURCE_CELL = {
  fruit: ["farmCrops", 16, 1],
  water: ["farmCrops", 16, 7],
  ore: ["mining", 13, 1],
  vine: ["fibres", 9, 1],
  stick: ["logging", 23, 11],
} as const satisfies Record<string, readonly [SheetName, number, number]>;

/** One tile on a sheet. */
export type NarrowTile = readonly [x: number, y: number];

/** How the loader addresses a sheet: by name, not by URL. */
export type SheetName = keyof typeof SHEETS;
