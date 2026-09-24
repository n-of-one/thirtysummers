import { ImageSource, Rectangle, Texture } from "pixi.js";
import { RESOURCE_KINDS } from "../../sim/resources.ts";
import type { Facing, ResourceKind, TerrainKind } from "../../sim/types.ts";
import { autotileIndex, E, FILL, N, S, TILE_COUNT, W } from "./autotile.ts";
import { DROPPED_ART_SHARE, DROPPED_SHADOW_ALPHA } from "./pack.ts";
import type { AssetPack, AssetPackSource, Bounds, PropSprite } from "./pack.ts";
import {
  BLOCK,
  BLOCK_TILES,
  BRIDGE_PLANK,
  BRUSH_STENCIL,
  DIRT_NARROW,
  FEATHER_COLORS,
  FEATHER_PIXELS,
  REGIONS,
  RESOURCE_CELL,
  RESOURCE_TURNS,
  SAPLING_COLORS,
  SAPLING_PIXELS,
  SHEETS,
  SPRING_CELL,
  WELL_CELL,
  SYNTH_NARROW,
  T,
  THICKET_TINT,
  TRODDEN_TINT,
  turnPixels,
  WALK_ROWS,
  type NarrowTile,
  type SheetName,
} from "./minifantasy.sheets.ts";

/**
 * Loads the Minifantasy art into an AssetPack: cutting tiles out of the sheets,
 * and building the ones the sheets do not draw.
 *
 * When the files are absent this pack reports itself unavailable and the
 * code-drawn placeholder is used instead, so a fresh clone still runs. Where
 * everything sits on the sheets is in ./minifantasy.sheets.ts.
 */

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
    const names = Object.keys(SHEETS) as SheetName[];
    const loaded = await Promise.all(names.map((name) => loadSheet(SHEETS[name])));
    const sheets = Object.fromEntries(
      names.map((name, i) => [name, loaded[i]!]),
    ) as Record<SheetName, Sheet>;
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

/** A blank canvas of art pixels, and its context, ready to be written into. */
function pixelCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
}

/**
 * The same picture with three quarters of the pixels: 8x8 becomes 6x6.
 *
 * Nearest, chosen pixel by pixel, so no colour is invented and nothing is
 * blended: an art pixel of the result is one art pixel of the original, and the
 * result is then drawn at the same size as everything else. Every fourth row
 * and column is simply not there, which is what makes the shape coarser.
 */
function fewerPixels(source: HTMLCanvasElement): HTMLCanvasElement {
  const size = Math.round(T * DROPPED_ART_SHARE);
  const from = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, T, T);
  const [canvas, ctx] = pixelCanvas(size, size);
  const out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(T - 1, Math.floor(((x + 0.5) * T) / size));
      const sy = Math.min(T - 1, Math.floor(((y + 0.5) * T) / size));
      const at = (sy * T + sx) * 4;
      out.data.set(from.data.subarray(at, at + 4), (y * size + x) * 4);
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/**
 * The same art with a shadow under it: a flat dark ellipse, wide enough to
 * show past the item on both sides and deep enough to show below it.
 *
 * It is what separates a dropped vine from a growing one at a glance -- fewer
 * pixels alone is a difference you have to look for. Composited here rather
 * than drawn as a second sprite so it can never be a pixel out of step with
 * what it belongs to.
 */
function onShadow(art: HTMLCanvasElement): HTMLCanvasElement {
  const w = T;
  const h = art.height + 2;
  const at = Math.round((w - art.width) / 2);
  // Fitted to what the art actually draws, not to its cell: these cells are
  // mostly empty, and a shadow sized to one is a puddle the item floats on.
  const box = contentBox(
    art.getContext("2d", { willReadFrequently: true })!,
    0,
    0,
    art.width,
    art.height,
  ) ?? { x0: 0, y0: 0, x1: art.width - 1, y1: art.height - 1 };

  const [canvas, ctx] = pixelCanvas(w, h);
  const shadow = ctx.createImageData(w, h);
  const alpha = Math.round(255 * DROPPED_SHADOW_ALPHA);
  const cx = at + (box.x0 + box.x1 + 1) / 2;
  const cy = box.y1 + 1.5;
  // Half a pixel wider than the art each side, so it shows past it.
  const rx = (box.x1 - box.x0 + 1) / 2 + 0.5;
  const ry = 1.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      shadow.data.set([0, 0, 0, alpha], (y * w + x) * 4);
    }
  }
  ctx.putImageData(shadow, 0, 0);
  // The art over the shadow. Its own pixels are opaque or clear, never in
  // between, so nothing blends with what is behind them.
  ctx.drawImage(art, at, 0);
  return canvas;
}

class MinifantasyPack implements AssetPack {
  readonly id = "minifantasy";
  readonly tileSize = T;

  private readonly made: Texture[] = [];
  private readonly grass: Texture[];
  private readonly brush: Texture[][];
  /** The same blocks again, painted darker: the wall version of undergrowth. */
  private readonly thicket: Texture[][];
  /** And painted lighter: undergrowth walked over and not yet worn through. */
  private readonly troddenBrush: Texture[][];
  private readonly dirt: Texture[];
  private readonly stone: Texture[];
  private readonly water: Texture[][];
  /** The two plank decks, [horizontal, vertical]. See BRIDGE_PLANK. */
  private readonly bridge: Texture[];
  private readonly trees: PropSprite[];
  private readonly bushes: PropSprite[];
  private readonly sapling: PropSprite;
  private readonly resources: Record<ResourceKind, PropSprite>;
  private readonly droppedArt: Record<ResourceKind, PropSprite>;
  private readonly walks: Record<Facing, Texture[]>;
  readonly camp: PropSprite;
  readonly spring: PropSprite;
  readonly well: PropSprite;

  /**
   * Measured from the walk frames at load time rather than hard-coded: the
   * character sits high inside its 32px frame, and guessing this offset is what
   * puts the drawn feet somewhere other than the tile the player is actually
   * standing on.
   */
  readonly playerAnchor: { readonly x: number; readonly y: number };
  readonly playerBounds: Bounds;

  constructor(private readonly sheets: Record<SheetName, Sheet>) {
    this.grass = this.block("tiles", ...BLOCK.grass);
    // One undergrowth block per grass variant, so undergrowth keeps the same
    // variety of speckle the open grass has.
    this.brush = Array.from({ length: BLOCK_TILES }, (_, v) => this.brushBlock(v));
    // A thicket has to read as a wall from across the map, and one shade of
    // green and a few more ferns is not a difference you can see while
    // playing. It is painted through the same stencil rather than tinted as a
    // whole tile, so the dark stops exactly where the growth does: tinting the
    // finished tile would darken the open ground inside it too, and turn every
    // ragged edge the stencil draws into a square.
    this.thicket = Array.from({ length: BLOCK_TILES }, (_, v) =>
      this.brushBlock(v, THICKET_TINT),
    );
    // A trail being worn: the same growth, lighter, and the same shapes, so it
    // meets the undergrowth around it without a seam.
    this.troddenBrush = Array.from({ length: BLOCK_TILES }, (_, v) =>
      this.brushBlock(v, TRODDEN_TINT),
    );
    this.dirt = this.block("tiles", ...BLOCK.dirt, this.narrow("tiles", DIRT_NARROW));
    this.stone = this.block("tiles", ...BLOCK.stone, this.synth("tiles", ...BLOCK.stone));
    // The two ripple frames of the tileset's own water, alternated.
    this.water = [
      this.block("tiles", ...BLOCK.waterFrame0, this.synth("tiles", ...BLOCK.waterFrame0)),
      this.block("tiles", ...BLOCK.waterFrame1, this.synth("tiles", ...BLOCK.waterFrame1)),
    ];

    this.bridge = [
      this.deck(...BRIDGE_PLANK.horizontal),
      this.deck(...BRIDGE_PLANK.vertical),
    ];

    // Trees are 3x4 tiles; anchor at the foot of the trunk so they sit on the
    // tile they occupy and overlap the tiles behind them.
    this.trees = [
      this.prop24("props", 19, 0, 3, 4),
      this.prop24("props", 19, 4, 3, 4),
    ];
    // Ferns and shrubs, one tile wide and two tall.
    this.bushes = [];
    for (let x = 12; x <= 18; x++) this.bushes.push(this.prop24("props", x, 5, 1, 2));

    this.sapling = this.drawn(SAPLING_PIXELS, SAPLING_COLORS);

    this.resources = Object.fromEntries(
      RESOURCE_KINDS.map((kind) => [kind, this.spriteFrom(this.resourceCanvas(kind))]),
    ) as Record<ResourceKind, PropSprite>;
    this.droppedArt = Object.fromEntries(
      RESOURCE_KINDS.map((kind) => [
        kind,
        this.spriteFrom(onShadow(fewerPixels(this.resourceCanvas(kind)))),
      ]),
    ) as Record<ResourceKind, PropSprite>;
    this.camp = this.prop24("farmProps", 15, 5, 2, 1);
    this.spring = this.prop24(SPRING_CELL[0], SPRING_CELL[1], SPRING_CELL[2], 1, 1);
    this.well = this.prop24(...WELL_CELL);

    this.walks = {} as Record<Facing, Texture[]>;
    for (const facing of Object.keys(WALK_ROWS) as Facing[]) {
      const row = WALK_ROWS[facing];
      this.walks[facing] = Array.from({ length: 4 }, (_, col) =>
        this.sub("walk", col * 32, row * 32, 32, 32),
      );
    }

    // Union of the drawn pixels across every walk frame.
    const walkPixels = this.sheets.walk.pixels;
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

  private sub(sheet: SheetName, x: number, y: number, w: number, h: number): Texture {
    const texture = new Texture({
      source: this.sheets[sheet].source,
      frame: new Rectangle(x, y, w, h),
    });
    this.made.push(texture);
    return texture;
  }

  /**
   * A prop drawn from a pixel table rather than cut from a sheet, for art no
   * pack has: one tile wide, as many tall as the table is. Anchored at the
   * bottom centre of what it draws, as a cut prop is.
   */
  private drawn(
    rows: readonly string[],
    colors: Readonly<Record<string, readonly [number, number, number]>>,
  ): PropSprite {
    const h = rows.length;
    const canvas = document.createElement("canvas");
    canvas.width = T;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const image = ctx.createImageData(T, h);
    rows.forEach((row, y) => {
      for (let x = 0; x < T; x++) {
        const rgb = colors[row[x] ?? "."];
        if (!rgb) continue;
        const at = (y * T + x) * 4;
        image.data.set([...rgb, 255], at);
      }
    });
    ctx.putImageData(image, 0, 0);
    return this.spriteFrom(canvas);
  }

  /**
   * A prop from a canvas of art pixels, anchored at the bottom centre of what
   * it actually draws, as a cut prop is.
   */
  private spriteFrom(canvas: HTMLCanvasElement): PropSprite {
    const { width: w, height: h } = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const box = contentBox(ctx, 0, 0, w, h);
    const anchorPxX = box ? (box.x0 + box.x1 + 1) / 2 : w / 2;
    const anchorPxY = box ? box.y1 + 1 : h;
    return {
      texture: this.fromCanvas(canvas),
      anchorX: anchorPxX / w,
      anchorY: anchorPxY / h,
      bounds: boundsFrom(box, anchorPxX, anchorPxY, w, h),
    };
  }

  /**
   * A kind's node art on a canvas of its own, to be transformed from. Six are
   * cut from the sheets; the feather is drawn here, so it is painted the same
   * way {@link drawn} paints it.
   */
  private resourceCanvas(kind: ResourceKind): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = T;
    canvas.height = T;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    if (kind === "feather") {
      const image = ctx.createImageData(T, T);
      FEATHER_PIXELS.forEach((row, y) => {
        for (let x = 0; x < T; x++) {
          const rgb = FEATHER_COLORS[row[x] ?? "."];
          if (!rgb) continue;
          image.data.set([...rgb, 255], (y * T + x) * 4);
        }
      });
      ctx.putImageData(image, 0, 0);
      return canvas;
    }
    const [sheet, tx, ty] = RESOURCE_CELL[kind];
    ctx.drawImage(this.sheets[sheet].pixels.canvas, tx * T, ty * T, T, T, 0, 0, T, T);
    const turns = RESOURCE_TURNS[kind];
    if (turns) {
      const image = ctx.getImageData(0, 0, T, T);
      ctx.putImageData(new ImageData(turnPixels(image.data, T, turns), T, T), 0, 0);
    }
    return canvas;
  }

  /** A texture backed by its own small canvas, for tiles built rather than cut. */
  private fromCanvas(canvas: HTMLCanvasElement): Texture {
    const texture = new Texture({
      source: new ImageSource({ resource: canvas, scaleMode: "nearest" }),
    });
    this.made.push(texture);
    return texture;
  }

  /**
   * One plank deck tile: the dirt block's solid fill with a board laid over it.
   *
   * The board art is rails with daylight between them, drawn to sit on top of
   * something. Over nothing it shows the stream straight through, which reads
   * as a hole rather than as a bridge; over the dirt fill it reads as timber on
   * a solid deck, and meets the water at the edge of the tile the way a real
   * bridge ends.
   */
  private deck(px: number, py: number): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = T;
    canvas.height = T;
    const ctx = canvas.getContext("2d")!;
    const [bx, by] = BLOCK.dirt;
    // FILL is the centre of the 3x3, the tile with no bank on any side.
    const fx = (bx + (FILL % 3)) * T;
    const fy = (by + Math.floor(FILL / 3)) * T;
    ctx.drawImage(this.sheets.tiles.pixels.canvas, fx, fy, T, T, 0, 0, T, T);
    ctx.drawImage(this.sheets.farmTiles.pixels.canvas, px * T, py * T, T, T, 0, 0, T, T);
    return this.fromCanvas(canvas);
  }

  /** The seven narrow shapes, cut from the block at (bx, by). See SYNTH_NARROW. */
  private synth(sheet: SheetName, bx: number, by: number): Texture[] {
    return SYNTH_NARROW.map((parts) => {
      const canvas = document.createElement("canvas");
      canvas.width = T;
      canvas.height = T;
      const ctx = canvas.getContext("2d")!;
      for (const [index, region] of parts) {
        const [rx, ry, rw, rh] = REGIONS[region];
        const tx = (bx + (index % 3)) * T;
        const ty = (by + Math.floor(index / 3)) * T;
        ctx.drawImage(this.sheets[sheet].pixels.canvas, tx + rx, ty + ry, rw, rh, rx, ry, rw, rh);
      }
      return this.fromCanvas(canvas);
    });
  }

  /**
   * The undergrowth block for one grass variant: the grass tile painted through
   * the stencil, then the seven narrow shapes cut from its own edges.
   *
   * Everything lands in one strip of TILE_COUNT tiles so a block is a single
   * texture and the tile sprites keep batching.
   */
  private brushBlock(grassIndex: number, tint: readonly number[] = BRUSH_STENCIL.tint): Texture[] {
    const atlas = document.createElement("canvas");
    atlas.width = TILE_COUNT * T;
    atlas.height = T;
    const ctx = atlas.getContext("2d")!;

    const stencil = this.sheets.brushStencil.pixels;
    const grass = this.sheets.tiles.pixels.getImageData(
      (BLOCK.grass[0] + (grassIndex % 3)) * T,
      (BLOCK.grass[1] + Math.floor(grassIndex / 3)) * T,
      T,
      T,
    );
    const is = (data: Uint8ClampedArray, at: number, colour: readonly number[]) =>
      data[at] === colour[0] && data[at + 1] === colour[1] && data[at + 2] === colour[2];

    for (let i = 0; i < BLOCK_TILES; i++) {
      const shape = stencil.getImageData((i % 3) * T, Math.floor(i / 3) * T, T, T);
      const out = ctx.createImageData(T, T);
      for (let at = 0; at < T * T * 4; at += 4) {
        const rim = is(shape.data, at, BRUSH_STENCIL.rim);
        const inside = rim || is(shape.data, at, BRUSH_STENCIL.bulk);
        for (let c = 0; c < 3; c++) {
          let value = grass.data[at + c]!;
          if (inside) value = (value * tint[c]!) / 255;
          if (rim) value = (value * BRUSH_STENCIL.rim[c]!) / BRUSH_STENCIL.bulk[c]!;
          out.data[at + c] = Math.round(value);
        }
        out.data[at + 3] = 255;
      }
      ctx.putImageData(out, i * T, 0);
    }

    // The narrow shapes are cut from the strip, so they inherit the painting.
    SYNTH_NARROW.forEach((parts, k) => {
      for (const [index, region] of parts) {
        const [rx, ry, rw, rh] = REGIONS[region];
        ctx.drawImage(atlas, index * T + rx, ry, rw, rh, (BLOCK_TILES + k) * T + rx, ry, rw, rh);
      }
    });

    const source = new ImageSource({ resource: atlas, scaleMode: "nearest" });
    return Array.from({ length: TILE_COUNT }, (_, i) => {
      const texture = new Texture({ source, frame: new Rectangle(i * T, 0, T, T) });
      this.made.push(texture);
      return texture;
    });
  }

  /** Resolve a narrow-shape table to textures. */
  private narrow(sheet: SheetName, tiles: readonly NarrowTile[]): Texture[] {
    return tiles.map(([x, y]) => this.sub(sheet, x * T, y * T, T, T));
  }

  /**
   * The 15 tiles of a 3x5 block, followed by the seven narrow shapes.
   *
   * `narrow` is optional: a terrain with no art for those shapes gets the solid
   * fill in their place, so every index `autotileIndex` can return is populated.
   */
  private block(sheet: SheetName, bx: number, by: number, narrow?: readonly Texture[]): Texture[] {
    const out: Texture[] = [];
    for (let i = 0; i < BLOCK_TILES; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      out.push(this.sub(sheet, (bx + c) * T, (by + r) * T, T, T));
    }
    for (let i = BLOCK_TILES; i < TILE_COUNT; i++) {
      out.push(narrow?.[i - BLOCK_TILES] ?? out[FILL]!);
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
  private prop24(sheet: SheetName, tx: number, ty: number, tw: number, th: number): PropSprite {
    const w = tw * T;
    const h = th * T;
    const box = contentBox(this.sheets[sheet].pixels, tx * T, ty * T, w, h);
    const anchorPxX = box ? (box.x0 + box.x1 + 1) / 2 : w / 2;
    const anchorPxY = box ? box.y1 + 1 : h;
    return {
      texture: this.sub(sheet, tx * T, ty * T, w, h),
      anchorX: anchorPxX / w,
      anchorY: anchorPxY / h,
      bounds: boundsFrom(box, anchorPxX, anchorPxY, w, h),
    };
  }

  ground(kind: TerrainKind, mask: number, variant: number, frame: number): Texture {
    switch (kind) {
      // A sapling is a prop standing on open grass.
      case "grass":
      case "sapling":
        return this.grass[variant % BLOCK_TILES]!;
      // A wood is a floor of undergrowth with trunks standing on it, so both
      // draw the same ground and autotile as one surface. Thicket joins them:
      // it is the same undergrowth, grown too dense to walk through, and a wall
      // of it should meet the wood around it without a seam.
      case "underbrush":
      case "tree":
        return this.brush[variant % BLOCK_TILES]![autotileIndex(mask)]!;
      case "thicket":
        return this.thicket[variant % BLOCK_TILES]![autotileIndex(mask)]!;
      case "mud":
        return this.dirt[autotileIndex(mask)]!;
      // Timbers running the way the bridge does. The mask counts neighbouring
      // bridge tiles, so the run is known from the tiles already laid.
      case "bridge": {
        const northSouth = (mask & (N | S)) !== 0 && (mask & (E | W)) === 0;
        return this.bridge[northSouth ? 1 : 0]!;
      }
      case "rock":
        return this.stone[autotileIndex(mask)]!;
      case "stream": {
        const frames = this.water[frame % this.water.length]!;
        return frames[autotileIndex(mask)]!;
      }
    }
  }

  trodden(mask: number, variant: number): Texture {
    return this.troddenBrush[variant % BLOCK_TILES]![autotileIndex(mask)]!;
  }

  prop(kind: TerrainKind, variant: number): PropSprite | null {
    if (kind === "tree") return this.trees[variant % this.trees.length]!;
    if (kind === "sapling") return this.sapling;
    // A shrub on every single tile, with no gaps: the 45% of bare ground below
    // is exactly what makes underbrush read as something you can walk through,
    // so a thicket has to be the version without it.
    if (kind === "thicket") return this.bushes[variant % this.bushes.length]!;
    if (kind === "underbrush") {
      // A shrub on every single tile reads as a hedge and costs a lot of
      // overdraw; the darker ground tint carries the terrain, the shrubs just
      // break it up.
      if (variant % 100 < 45) return null;
      return this.bushes[variant % this.bushes.length]!;
    }
    return null;
  }

  /** Every terrain is drawn in its own colours; nothing needs tinting. */
  groundTint(_kind: TerrainKind): number {
    return 0xffffff;
  }

  dropped(kind: ResourceKind): PropSprite {
    return this.droppedArt[kind];
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
