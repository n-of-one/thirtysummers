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
import type { Facing, ResourceKind } from "../../sim/types.ts";

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
  /** The waterfall, three layers of four frames each: see WATERFALL. */
  fallsGround: `${FP}/Tileset/River/Waterfall/Minifantasy_ForgottenPlainsWaterfallGroundLayer.png`,
  fallsDrop: `${FP}/Tileset/River/Waterfall/Minifantasy_ForgottenPlainsWaterfallDropLayer.png`,
  fallsSplash: `${FP}/Tileset/River/Waterfall/Minifantasy_ForgottenPlainsWaterfallSplashEffectLayer.png`,
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

/**
 * The multiply for dense underbrush: darker than full underbrush and well
 * short of thicket, so it reads as the same growth grown older and matted,
 * slow but not a wall. [GUESS]
 */
export const DENSE_TINT = [0x7c, 0x98, 0x68] as const;

/**
 * The multiply for underbrush worn by walking, one per trail stage from
 * trodden to flat. Flat is towards none at all, and a little warm, so the
 * growth reads as pressed into the earth rather than as a lighter kind of
 * plant; the two trodden stages are a third and two thirds of the way there
 * from `BRUSH_STENCIL.tint`, so each walk shows as much as the last. A first
 * stage further out made the first walk the only one that showed. The
 * stencil's rim is shaded whatever the tint, so even flat keeps the ragged
 * outline of underbrush and does not become grass. [GUESS]
 */
export const TRODDEN_TINTS = [
  [0xba, 0xcb, 0x9b],
  [0xd5, 0xdb, 0xaf],
  [0xf0, 0xea, 0xc4],
] as const;

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

/**
 * The ravine's edge, cut from the one-level earth plateau on the tileset: the
 * plus-shaped piece whose outline starts at (268, 64). Every entry is the
 * top-left pixel of an 8x8 cut, read off the pixels.
 *
 * The plus is a raised block seen from the south: a black outline and a brown
 * lip where it ends to the north, a strip of its side where it ends east or
 * west, and a face where it ends to the south. The valley floor is the block,
 * and the river is what is cut out of it, so a cliff tile takes the piece for
 * the side the water is on.
 *
 * `face` is the face, three tiles tall: the plus's own is 12 pixels, and the
 * waterfall drops 20, so its middle rows are repeated to make it as deep.
 * `faceRows` lists the plus's rows, top to bottom, that make the 24 rows of a
 * face: four of grass above it, two of its ragged top edge, sixteen of the
 * face, and its bottom two. `faceColumns` is where a column of face is cut:
 * with the water to its west, straight, and with the water to its east.
 */
export const CLIFF = {
  rimN: [292, 64],
  convexNW: [284, 64],
  convexNE: [308, 64],
  sideW: [268, 88],
  sideE: [324, 88],
  concaveNW: [284, 80],
  concaveNE: [308, 80],
  concaveSW: [284, 104],
  concaveSE: [308, 104],
  faceColumns: { west: 284, straight: [292, 300], east: 308 },
  faceRows: [
    112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 118, 119, 120, 121, 122, 123, 124, 125,
    126, 127,
  ],
  /** The water under an edge's clear pixels: the water block's middle tile. */
  under: [208, 32],
} as const;

/**
 * Where the first stream falls into the lake: the waterfall's three layers,
 * each four frames `frameStep` apart. A frame's stream is `width` pixels wide
 * from column `left`, and the drop starts at row `dropTop`. Its first rows,
 * above that, are the stream still running, which lines up with the top of a
 * face's `faceRows`, grass and all, at `faceOffset` rows down the frame.
 */
export const WATERFALL = {
  frames: 4,
  frameStep: 32,
  left: 8,
  width: 24,
  faceOffset: 16,
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
  ore: ["mining", 13, 1],
  vine: ["fibres", 9, 1],
  stick: ["logging", 23, 11],
  // The oak log, seen end-on. Brown and chunky, so it is not taken for the
  // pale birch stick beside it in the pack.
  log: ["logging", 2, 13],
  // A low heap of the pale blue-white ore, the lightest thing on the mining
  // sheet, standing in for shells: there are none in the packs.
  shell: ["mining", 11, 9],
} as const satisfies Record<Exclude<ResourceKind, "feather">, readonly [SheetName, number, number]>;

/**
 * Quarter turns clockwise a kind's cell is drawn at, wherever it is drawn: on
 * the map, dropped, and in the HUD. A quarter turn keeps every art pixel on
 * the grid, which is why it is the only rotation there is.
 *
 * Three for the log, so it lies on its side with the dark bark underneath and
 * reads as long, which is what its two slots in the pack say it is.
 */
export const RESOURCE_TURNS: Partial<Record<ResourceKind, 1 | 2 | 3>> = {
  log: 3,
};

/**
 * The RGBA pixels of a square cell `size` across, turned `turns` quarter turns
 * clockwise. Pixel for pixel, so nothing is resampled.
 */
export function turnPixels(
  from: Uint8ClampedArray,
  size: number,
  turns: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(from.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tx = x;
      let ty = y;
      // One clockwise quarter turn sends (x, y) to (size - 1 - y, x).
      for (let i = 0; i < turns; i++) [tx, ty] = [size - 1 - ty, tx];
      const at = (y * size + x) * 4;
      out.set(from.subarray(at, at + 4), (ty * size + tx) * 4);
    }
  }
  return out;
}

/**
 * The feather, drawn here because no pack has one: a white quill with the
 * packs' black outline, slanted like the stick. One character per pixel of an
 * 8x8 cell: `.` clear, `k` outline, `w` vane, `g` its shade, `b` the shaft.
 */
export const FEATHER_PIXELS: readonly string[] = [
  "......kk",
  ".....kwk",
  "....kwgk",
  "...kwgk.",
  "..kwgk..",
  ".kwgk...",
  ".kbk....",
  "kbk.....",
];
export const FEATHER_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  k: [0, 0, 0],
  w: [244, 242, 232],
  g: [184, 180, 166],
  b: [120, 96, 70],
};

/**
 * A sapling, drawn here: every tree in the packs is a grown one, three to four
 * tiles across and up to eight tall, and a copse with one on every tile is
 * then a wall of canopy with no ground to see or to aim at. This is one tile
 * wide and two tall, a thin pale trunk under a small crown, in a yellower
 * green than the woods, so a copse reads as young trees an axe could clear.
 *
 * One character per pixel, bottom row last: `.` clear, `k` outline, `l` the
 * lit crown, `c` its body, `s` its shade, `t` trunk, `b` the trunk's shade.
 */
export const SAPLING_PIXELS: readonly string[] = [
  "...kk...",
  "..klck..",
  ".klccsk.",
  "kllccssk",
  "klcccssk",
  ".kcctsk.",
  "..kktk..",
  "...ktk..",
  "...ktk..",
  "..klctk.",
  "..kctbk.",
  "...ktbk.",
  "...ktb..",
  "...ktb..",
  "..kttbk.",
  "..kkkk..",
];
export const SAPLING_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  k: [26, 40, 20],
  l: [168, 196, 72],
  c: [124, 162, 52],
  s: [86, 122, 40],
  t: [196, 186, 160],
  b: [138, 128, 106],
};

/**
 * A well: the farm's water trough, standing upright, one tile wide and two
 * tall. Water in a built thing, so it reads apart from the reeds of a spring.
 */
export const WELL_CELL = ["farmProps", 18, 2, 1, 2] as const;

/**
 * The coin the HUD draws money with, in the same eight-by-eight cell as
 * everything else, because no pack has money in it.
 *
 * Six pixels across and four tall: a coin lying at an angle. A round one
 * needs seven or eight pixels to read as a circle rather than an octagon, and
 * at that size it sits beside a number like a plate. It keeps the pack's own
 * conventions -- pure black outline all the way round, lit from the
 * north-west -- and the pack's own gold, sampled off the trinket sheet: white
 * (255,255,255), light (232,205,109), mid (218,174,20). Only the shade is not
 * sampled; it is the mid tone darkened, since the pack's gold has no fourth
 * tone.
 *
 * The rounder, smaller and stacked coins that were drawn beside it, and the
 * trinket sheet's own gold bead, are in docs/archive/coin-drawings.md.
 *
 * `.` clear, `k` outline, `w` the highlight, `l` the lit face, `g` the gold,
 * `d` its shade.
 */
export const COIN_PIXELS: readonly string[] = [
  "........",
  "........",
  "..kkkk..",
  ".kwllgk.",
  ".klggdk.",
  "..kkkk..",
  "........",
  "........",
];

export const COIN_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  k: [0, 0, 0],
  w: [255, 255, 255],
  l: [232, 205, 109],
  g: [218, 174, 20],
  d: [150, 118, 12],
};

/**
 * A spring on the bank: the reeds the discovery test drew its water nodes with.
 * Upright green against the grass and the blue beside it, so it reads as
 * something standing at the water's edge rather than as more water.
 */
export const SPRING_CELL = ["farmCrops", 16, 7] as const satisfies readonly [
  SheetName,
  number,
  number,
];

/** One tile on a sheet. */
export type NarrowTile = readonly [x: number, y: number];

/** How the loader addresses a sheet: by name, not by URL. */
export type SheetName = keyof typeof SHEETS;
