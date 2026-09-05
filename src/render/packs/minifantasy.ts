import { ImageSource, Rectangle, Texture } from "pixi.js";
import type { Facing, ResourceKind, TerrainKind } from "../../sim/types.ts";
import { autotileIndex, FILL, TILE_COUNT } from "./autotile.ts";
import type { AssetPack, AssetPackSource, Bounds, PropSprite } from "./pack.ts";

/**
 * Minifantasy art by Krishna Palacio, loaded from public/assets/minifantasy/.
 *
 * The art is a paid licence and is NOT in the repository -- see
 * public/assets/README.md. When the files are absent this pack reports itself
 * unavailable and the code-drawn placeholder is used instead.
 *
 * Everything here is source coordinates read off the actual sheets: the grid is
 * 8px, terrain comes as 3x5 autotile blocks (see autotile.ts), and grass is the
 * base layer that every other terrain is cut into.
 */

const ROOT = "/assets/minifantasy";
const FP = `${ROOT}/Minifantasy_ForgottenPlains_v3.6_Commercial_Version/Minifantasy_ForgottenPlains_Assets`;
const FARM = `${ROOT}/Minifantasy_Farm_v3.0/Minifantasy_Farm_Assets`;
const CRAFT = `${ROOT}/Minifantasy_CraftingAndProfessions_v1.0/Minifantasy_CraftingAndProfessions_Assets`;
const NPC = `${ROOT}/Minifantasy_AMyriadOfNPCs_v.1.0/Minifantasy_NPCs_Assets/Premade_NPCs`;

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
const WALK_ROWS: Record<Facing, number> = {
  southEast: 0,
  southWest: 1,
  northEast: 2,
  northWest: 3,
};

const SHEETS = {
  tiles: `${FP}/Tileset/Minifantasy_ForgottenPlainsTiles.png`,
  props: `${FP}/props/Minifantasy_ForgottenPlainsProps.png`,
  farmCrops: `${FARM}/Crops/Minifantasy_FarmSeedsAndCrops.png`,
  farmProps: `${FARM}/Props/Minifantasy_FarmProps.png`,
  mining: `${CRAFT}/Gathering_Professions/Mining/Minifantasy_CraftingAndProfessionsMining.png`,
  walk: `${NPC}/${CHARACTER}/Minifantasy_NPCs${CHARACTER}Walk.png`,
} as const;

const T = 8; // source tile size

/** Top-left tile coordinate of each 3x5 autotile block on the tileset sheet. */
const BLOCK = {
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
const DIRT_NARROW: readonly NarrowTile[] = [
  [5, 1],
  [6, 12],
  [7, 9],
  [6, 10],
  [9, 9],
  [6, 11],
  [8, 9],
];

/** Half or quarter of a tile, named by where in the tile it sits. */
type Region = "left" | "right" | "top" | "bottom" | "nw" | "ne" | "sw" | "se";

const REGIONS: Record<Region, readonly [x: number, y: number, w: number, h: number]> = {
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
const SYNTH_NARROW: readonly (readonly (readonly [index: number, region: Region])[])[] = [
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

/** One tile on a sheet, optionally mirrored top to bottom. */
type NarrowTile = readonly [x: number, y: number, flipY?: boolean];


export const minifantasyPackSource: AssetPackSource = {
  id: "minifantasy",
  async available() {
    try {
      // A HEAD on one sheet is enough: the pack is all-or-nothing.
      const res = await fetch(SHEETS.tiles, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  },
  async load() {
    const urls = Object.values(SHEETS);
    const sheets: Record<string, Sheet> = {};
    await Promise.all(
      urls.map(async (url) => {
        sheets[url] = await loadSheet(url);
      }),
    );
    return new MinifantasyPack(sheets);
  },
};

/** A loaded sheet: the texture source, plus its pixels for measuring content. */
interface Sheet {
  source: ImageSource;
  pixels: CanvasRenderingContext2D;
}

/**
 * Load a sheet straight into a texture source.
 *
 * Deliberately not using Pixi's `Assets` loader: these pack folders have version
 * numbers in their names (`_v.1.0`, `_v3.6_Commercial_Version`) and the resolver
 * never settles its promise on them, which hangs startup with no error. We know
 * every URL up front, so the resolver and its cache buy us nothing anyway.
 */
async function loadSheet(url: string): Promise<Sheet> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const pixels = canvas.getContext("2d", { willReadFrequently: true })!;
  pixels.drawImage(image, 0, 0);
  return { source: new ImageSource({ resource: image, scaleMode: "nearest" }), pixels };
}

/** Convert a pixel-space content box into tile-space bounds around an anchor. */
function boundsFrom(
  box: { x0: number; y0: number; x1: number; y1: number } | null,
  anchorPxX: number,
  anchorPxY: number,
  w: number,
  h: number,
): Bounds {
  const b = box ?? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  return {
    left: (b.x0 - anchorPxX) / T,
    top: (b.y0 - anchorPxY) / T,
    right: (b.x1 + 1 - anchorPxX) / T,
    bottom: (b.y1 + 1 - anchorPxY) / T,
  };
}

/** Bounding box of the non-transparent pixels in a region, or null if empty. */
function contentBox(
  pixels: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const { data } = pixels.getImageData(x, y, w, h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (data[(py * w + px) * 4 + 3] === 0) continue;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

class MinifantasyPack implements AssetPack {
  readonly id = "minifantasy";
  readonly tileSize = T;

  private readonly made: Texture[] = [];
  private readonly grass: Texture[];
  private readonly dirt: Texture[];
  private readonly stone: Texture[];
  private readonly water: Texture[][];
  private readonly trees: PropSprite[];
  private readonly bushes: PropSprite[];
  private readonly resources: Record<ResourceKind, PropSprite>;
  private readonly walks: Record<Facing, Texture[]>;
  readonly camp: PropSprite;

  /**
   * Measured from the walk frames at load time rather than hard-coded: the
   * character sits high inside its 32px frame, and guessing this offset is what
   * puts the drawn feet somewhere other than the tile the player is actually
   * standing on.
   */
  readonly playerAnchor: { readonly x: number; readonly y: number };
  readonly playerBounds: Bounds;

  constructor(private readonly sheets: Record<string, Sheet>) {
    this.grass = this.block(SHEETS.tiles, ...BLOCK.grass);
    this.dirt = this.block(SHEETS.tiles, ...BLOCK.dirt, this.narrow(SHEETS.tiles, DIRT_NARROW));
    this.stone = this.block(SHEETS.tiles, ...BLOCK.stone, this.synth(SHEETS.tiles, ...BLOCK.stone));
    // The lake block and the river sheet animate independently, so the two
    // ripple frames are paired with river frames 0 and 2 -- half a cycle apart,
    // matching the lake's own two-frame cadence.
    this.water = [
      this.block(SHEETS.tiles, ...BLOCK.waterFrame0, this.synth(SHEETS.tiles, ...BLOCK.waterFrame0)),
      this.block(SHEETS.tiles, ...BLOCK.waterFrame1, this.synth(SHEETS.tiles, ...BLOCK.waterFrame1)),
    ];

    // Trees are 3x4 tiles; anchor at the foot of the trunk so they sit on the
    // tile they occupy and overlap the tiles behind them.
    this.trees = [
      this.prop24(SHEETS.props, 19, 0, 3, 4),
      this.prop24(SHEETS.props, 19, 4, 3, 4),
    ];
    // Ferns and shrubs, one tile wide and two tall.
    this.bushes = [];
    for (let x = 12; x <= 18; x++) this.bushes.push(this.prop24(SHEETS.props, x, 5, 1, 2));

    this.resources = {
      fruit: this.prop24(SHEETS.farmCrops, 16, 1, 1, 1),
      water: this.prop24(SHEETS.farmCrops, 16, 7, 1, 1),
      ore: this.prop24(SHEETS.mining, 13, 1, 1, 1),
    };
    this.camp = this.prop24(SHEETS.farmProps, 15, 5, 2, 1);

    this.walks = {} as Record<Facing, Texture[]>;
    for (const facing of Object.keys(WALK_ROWS) as Facing[]) {
      const row = WALK_ROWS[facing];
      this.walks[facing] = Array.from({ length: 4 }, (_, col) =>
        this.sub(SHEETS.walk, col * 32, row * 32, 32, 32),
      );
    }

    // Union of the drawn pixels across every walk frame.
    const walkPixels = this.sheets[SHEETS.walk]!.pixels;
    let union: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const box = contentBox(walkPixels, col * 32, row * 32, 32, 32);
        if (!box) continue;
        union = union
          ? {
              x0: Math.min(union.x0, box.x0),
              y0: Math.min(union.y0, box.y0),
              x1: Math.max(union.x1, box.x1),
              y1: Math.max(union.y1, box.y1),
            }
          : box;
      }
    }
    const anchorPxX = union ? (union.x0 + union.x1 + 1) / 2 : 16;
    const anchorPxY = union ? union.y1 + 1 : 32;
    this.playerAnchor = { x: anchorPxX / 32, y: anchorPxY / 32 };
    this.playerBounds = boundsFrom(union, anchorPxX, anchorPxY, 32, 32);
  }

  private sub(sheet: string, x: number, y: number, w: number, h: number): Texture {
    const texture = new Texture({
      source: this.sheets[sheet]!.source,
      frame: new Rectangle(x, y, w, h),
    });
    this.made.push(texture);
    return texture;
  }

  /**
   * One tile copied into its own source, mirrored top to bottom.
   *
   * A `Texture` cannot flip a region of a shared sheet on its own, and the sheet
   * only draws a river running one way, so the opposite cap is drawn here. One
   * 8x8 canvas per flipped tile costs nothing.
   */
  private flippedY(sheet: string, x: number, y: number, w: number, h: number): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(this.sheets[sheet]!.pixels.canvas, x, y, w, h, 0, 0, w, h);
    return this.fromCanvas(canvas);
  }

  /** A texture backed by its own small canvas, for tiles built rather than cut. */
  private fromCanvas(canvas: HTMLCanvasElement): Texture {
    const texture = new Texture({
      source: new ImageSource({ resource: canvas, scaleMode: "nearest" }),
    });
    this.made.push(texture);
    return texture;
  }

  /** The seven narrow shapes, cut from the block at (bx, by). See SYNTH_NARROW. */
  private synth(sheet: string, bx: number, by: number): Texture[] {
    return SYNTH_NARROW.map((parts) => {
      const canvas = document.createElement("canvas");
      canvas.width = T;
      canvas.height = T;
      const ctx = canvas.getContext("2d")!;
      for (const [index, region] of parts) {
        const [rx, ry, rw, rh] = REGIONS[region];
        const tx = (bx + (index % 3)) * T;
        const ty = (by + Math.floor(index / 3)) * T;
        ctx.drawImage(this.sheets[sheet]!.pixels.canvas, tx + rx, ty + ry, rw, rh, rx, ry, rw, rh);
      }
      return this.fromCanvas(canvas);
    });
  }

  /** Resolve a narrow-shape table to textures, offset by `dx` tiles. */
  private narrow(sheet: string, tiles: readonly NarrowTile[], dx = 0): Texture[] {
    return tiles.map(([x, y, flipY]) =>
      flipY
        ? this.flippedY(sheet, (x + dx) * T, y * T, T, T)
        : this.sub(sheet, (x + dx) * T, y * T, T, T),
    );
  }

  /**
   * The 15 tiles of a 3x5 block, followed by the seven narrow shapes.
   *
   * `narrow` is optional: a terrain with no art for those shapes gets the solid
   * fill in their place, so every index `autotileIndex` can return is populated.
   */
  private block(sheet: string, bx: number, by: number, narrow?: readonly Texture[]): Texture[] {
    const out: Texture[] = [];
    for (let i = 0; i < 15; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      out.push(this.sub(sheet, (bx + c) * T, (by + r) * T, T, T));
    }
    for (let i = 15; i < TILE_COUNT; i++) {
      out.push(narrow?.[i - 15] ?? out[FILL]!);
    }
    return out;
  }

  /**
   * A prop anchored to the bottom centre of the pixels it actually draws.
   *
   * Measuring beats guessing here: art rarely fills its cell, and an anchor
   * that assumes it does leaves the sprite floating above or sunk below the
   * tile it belongs to -- visibly out of step with collision and terrain.
   */
  private prop24(sheet: string, tx: number, ty: number, tw: number, th: number): PropSprite {
    const w = tw * T;
    const h = th * T;
    const box = contentBox(this.sheets[sheet]!.pixels, tx * T, ty * T, w, h);
    const anchorPxX = box ? (box.x0 + box.x1 + 1) / 2 : w / 2;
    const anchorPxY = box ? box.y1 + 1 : h;
    return {
      texture: this.sub(sheet, tx * T, ty * T, w, h),
      anchorX: anchorPxX / w,
      anchorY: anchorPxY / h,
      bounds: boundsFrom(box, anchorPxX, anchorPxY, w, h),
    };
  }

  frameCount(kind: TerrainKind): number {
    return kind === "stream" ? this.water.length : 1;
  }

  ground(kind: TerrainKind, mask: number, variant: number, frame: number): Texture {
    switch (kind) {
      // Grass is the base layer; underbrush and trees are props standing on it.
      case "grass":
      case "underbrush":
      case "tree":
        return this.grass[variant % this.grass.length]!;
      case "mud":
        return this.dirt[autotileIndex(mask)]!;
      case "rock":
        return this.stone[autotileIndex(mask)]!;
      case "stream": {
        const frames = this.water[frame % this.water.length]!;
        return frames[autotileIndex(mask)]!;
      }
    }
  }

  prop(kind: TerrainKind, variant: number): PropSprite | null {
    if (kind === "tree") return this.trees[variant % this.trees.length]!;
    if (kind === "underbrush") {
      // A shrub on every single tile reads as a hedge and costs a lot of
      // overdraw; the darker ground tint carries the terrain, the shrubs just
      // break it up.
      if (variant % 100 < 45) return null;
      return this.bushes[variant % this.bushes.length]!;
    }
    return null;
  }

  /**
   * Underbrush shares the grass tile, so it is darkened to read as denser
   * growth -- without it, difficult terrain is invisible to the player.
   */
  groundTint(kind: TerrainKind): number {
    return kind === "underbrush" ? 0x9fbc86 : 0xffffff;
  }

  resource(kind: ResourceKind): PropSprite {
    return this.resources[kind];
  }

  walk(facing: Facing): readonly Texture[] {
    return this.walks[facing];
  }

  idle(facing: Facing): Texture {
    return this.walks[facing][0]!;
  }

  destroy(): void {
    for (const texture of this.made) texture.destroy(false);
    this.made.length = 0;
  }
}
