import type { Renderer, Texture } from "pixi.js";
import type { Facing, ResourceKind, TerrainKind } from "../../sim/types.ts";

/**
 * Where a sprite's drawn pixels sit, in tiles, relative to its anchor point.
 * A tree standing on its base has bottom 0 and a negative top.
 *
 * This is the drawn content, not the texture: art rarely fills its cell, and
 * using the cell would make a sprite claim space it does not visibly occupy.
 */
export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A texture plus where its origin sits, so packs can align art to a tile. */
export interface PropSprite {
  readonly texture: Texture;
  /** Anchor inside the texture, 0..1. y near 1 puts the base on the tile. */
  readonly anchorX: number;
  readonly anchorY: number;
  /** Extent of the drawn pixels, for overlap tests. */
  readonly bounds: Bounds;
}

/**
 * How much of its art a kind keeps when it is lying on the ground: three
 * quarters of the pixels, so an eight-pixel cell becomes six.
 *
 * Small enough to read as a loose item rather than one growing there, and
 * large enough that every kind is still recognisably itself. Marking the art
 * instead -- a bar under it, or laying it on its side -- was tried and dropped:
 * the bar read as a shelf, and a quarter turn does nothing for the kinds whose
 * art is round.
 *
 * The vine is the one that loses by it: its art is sparse, so dropping every
 * fourth row and column takes more of the shape than it does from the others.
 * Accepted for now; if it is ever worth fixing, the fix is six pixels drawn by
 * hand for that kind, not a different factor for every kind.
 */
export const DROPPED_ART_SHARE = 0.75;

/**
 * How dark the shadow under a dropped item is, 0 to 1.
 *
 * Part of the sprite rather than a second one: it is composited into the art
 * before it is ever a texture, so it snaps, sorts and scrolls with the item and
 * cannot drift a pixel away from it. Transparent, so the terrain it lies on
 * still shows through -- a shadow that hid the grass would read as a hole.
 */
export const DROPPED_SHADOW_ALPHA = 0.35;

/**
 * Everything the renderer is allowed to ask for. Nothing outside this folder
 * knows which art pack is loaded, so swapping art -- or shipping a public repo
 * with no licensed art in it at all -- never touches game code.
 */
export interface AssetPack {
  readonly id: string;
  /** Source size of one tile, in pixels. The renderer scales to config.TILE. */
  readonly tileSize: number;

  /**
   * Ground texture for a tile.
   * @param mask  8-neighbour connectivity, see autotile.ts. Packs without
   *              autotiling ignore it.
   * @param variant  per-tile hash, for packs offering interchangeable variants.
   * @param frame  free-running animation frame index; packs wrap it themselves.
   */
  ground(kind: TerrainKind, mask: number, variant: number, frame: number): Texture;

  /**
   * Underbrush worn by walking, at `stage` 1 to `TRAIL_STAGES`: each flatter
   * than the last, so a line forming behind the player is seen on the first
   * walk, and the last, flat, still reads as underbrush rather than grass so
   * a path stays a path. Autotiled as underbrush, with the same mask and
   * variant.
   */
  trodden(stage: number, mask: number, variant: number): Texture;

  /** Multiplied into the ground tile; 0xffffff leaves it untouched. */
  groundTint(kind: TerrainKind): number;

  /** Overlay drawn above the ground and sorted by depth; null when none. */
  prop(kind: TerrainKind, variant: number): PropSprite | null;

  resource(kind: ResourceKind): PropSprite;
  /**
   * The same kind lying on the ground after being dropped: the node art with
   * {@link DROPPED_ART_SHARE} of its pixels.
   *
   * Built as pixels before it is a sprite, never scaled on the way to the
   * screen: architecture.md's rule is that one art pixel is one size
   * everywhere in the world.
   */
  dropped(kind: ResourceKind): PropSprite;
  readonly camp: PropSprite;
  /** A spring on the bank, where the player drinks. */
  readonly spring: PropSprite;
  /** A well, which drinks like a spring and stands where there is no stream. */
  readonly well: PropSprite;

  walk(facing: Facing): readonly Texture[];
  idle(facing: Facing): Texture;

  /**
   * Where the character's feet sit inside a walk frame, as a fraction of the
   * frame. The renderer anchors the sprite here so that the drawn feet land on
   * the player's world position -- which is what decides the tile they are
   * standing on. Getting this wrong shifts the sprite away from its own
   * collision and terrain checks.
   */
  readonly playerAnchor: { readonly x: number; readonly y: number };

  /** Extent of the drawn character, in tiles relative to its feet. */
  readonly playerBounds: Bounds;

  destroy(): void;
}

export interface AssetPackSource {
  readonly id: string;
  /** Cheap probe run before loading: is this pack's data actually present? */
  available(): Promise<boolean>;
  load(renderer: Renderer): Promise<AssetPack>;
}

/** Deterministic per-tile hash, used to pick a variant. */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
