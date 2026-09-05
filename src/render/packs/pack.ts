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

  /** Distinct animation frames for this terrain; 1 means static. */
  frameCount(kind: TerrainKind): number;

  /** Multiplied into the ground tile; 0xffffff leaves it untouched. */
  groundTint(kind: TerrainKind): number;

  /** Overlay drawn above the ground and sorted by depth; null when none. */
  prop(kind: TerrainKind, variant: number): PropSprite | null;

  resource(kind: ResourceKind): PropSprite;
  readonly camp: PropSprite;

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
