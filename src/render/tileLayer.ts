import { Container, Sprite } from "pixi.js";
import { TILE } from "../config.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { TerrainKind } from "../sim/types.ts";
import { E, N, NE, NW, S, SE, SW, W } from "./packs/autotile.ts";
import type { AssetPack } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { Camera } from "./camera.ts";
import { ScrollWindow } from "./scrollWindow.ts";

/**
 * The ground a terrain is drawn on, for autotiling purposes.
 *
 * Trees, thicket and underbrush share one: a wood is a floor of undergrowth
 * with trunks standing on it and a thicket is that undergrowth grown too dense
 * to pass, so comparing raw terrain would ring every tree and every bramble
 * with a transition back to open grass. Everything else is its own surface --
 * including a bridge, which is planks laid over the water and reads as its own
 * thing crossing it, and a spring, a pool that must never read as part of a
 * stream beside it. Exported so the placement tests can agree about what
 * autotiles with what.
 */
export function surfaceOf(kind: TerrainKind): TerrainKind {
  return kind === "tree" || kind === "thicket" ? "underbrush" : kind;
}

/**
 * Draws one z-layer of the map with a pool of sprites just large enough to
 * cover the screen. Cost is bound to the size of the viewport, not the size of
 * the map, so a bigger world -- or a stack of layers -- costs nothing extra.
 *
 * Textures are only reassigned when the camera crosses a tile boundary or the
 * water animation advances; the sub-tile fraction is handled by shifting the
 * whole container, which is one transform instead of a thousand.
 */
export class TileLayer {
  readonly container = new Container();

  private sprites: Sprite[] = [];
  /** Ground never reaches outside its own tile, so one tile all round is enough. */
  private readonly window = new ScrollWindow({ left: 1, top: 1, right: 1, bottom: 1 });
  private frame = 0;
  private drawnFrame = -1;
  private dirty = true;

  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
    private readonly z = 0,
  ) {
    this.container.isRenderGroup = true;
  }

  resize(widthPx: number, heightPx: number): void {
    if (!this.window.resize(widthPx, heightPx)) return;
    this.dirty = true;
    const { cols, rows } = this.window;

    this.container.removeChildren();
    for (const sprite of this.sprites) sprite.destroy();

    const scale = TILE / this.pack.tileSize;
    this.sprites = new Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sprite = new Sprite();
        sprite.x = col * TILE;
        sprite.y = row * TILE;
        sprite.scale.set(scale);
        this.sprites[row * cols + col] = sprite;
        this.container.addChild(sprite);
      }
    }
  }

  /**
   * Force a re-texture on the next update, after the map itself has changed.
   *
   * The pool only reassigns textures when the camera crosses a tile boundary,
   * so a cut thicket tile would otherwise stay drawn as thicket until the
   * player walked far enough to scroll the window -- the one moment the change
   * most needs to be visible is the one moment nothing would redraw it.
   */
  invalidate(): void {
    this.dirty = true;
  }

  /** Advance animated terrain (water). Takes a frame index; packs wrap it. */
  setAnimationFrame(frame: number): void {
    this.frame = frame;
  }

  update(camera: Camera): void {
    const scrolled = this.window.moveTo(camera.leftPx, camera.topPx);
    if (scrolled || this.dirty || this.frame !== this.drawnFrame) {
      this.dirty = false;
      this.drawnFrame = this.frame;
      this.refill();
    }

    // Sub-tile scroll: shift the whole grid rather than every sprite.
    this.container.x = this.window.offsetX;
    this.container.y = this.window.offsetY;
  }

  /**
   * Which of the 8 neighbours continue the same ground. Out-of-bounds reads come
   * back as rock, so the map border autotiles against the world edge instead of
   * showing a cut edge.
   *
   * Neighbours are compared by {@link surfaceOf}, not by terrain, so a tree does
   * not punch a hole in the forest floor it is standing on.
   */
  private mask(x: number, y: number, kind: TerrainKind): number {
    const surface = surfaceOf(kind);
    const same = (dx: number, dy: number) =>
      surfaceOf(this.map.get(x + dx, y + dy, this.z)) === surface;
    let mask = 0;
    if (same(0, -1)) mask |= N;
    if (same(1, 0)) mask |= E;
    if (same(0, 1)) mask |= S;
    if (same(-1, 0)) mask |= W;
    if (same(1, -1)) mask |= NE;
    if (same(1, 1)) mask |= SE;
    if (same(-1, 1)) mask |= SW;
    if (same(-1, -1)) mask |= NW;
    return mask;
  }

  private refill(): void {
    const { originX, originY, cols, rows } = this.window;
    for (let row = 0; row < rows; row++) {
      const tileY = originY + row;
      for (let col = 0; col < cols; col++) {
        const tileX = originX + col;
        const kind = this.map.get(tileX, tileY, this.z);
        const sprite = this.sprites[row * cols + col]!;
        sprite.texture = this.pack.ground(
          kind,
          this.mask(tileX, tileY, kind),
          tileHash(tileX, tileY),
          this.frame,
        );
        sprite.tint = this.pack.groundTint(kind);
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
