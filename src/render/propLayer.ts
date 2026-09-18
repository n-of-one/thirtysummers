import { Container, Sprite, type Renderer, type Texture } from "pixi.js";
import { PIXEL_SETTLE_SEC, TILE } from "../config.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { ResourceNode, Spring, Vec2 } from "../sim/types.ts";
import type { AssetPack } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { Camera } from "./camera.ts";
import { placementsIn, type Placement } from "./placements.ts";
import { ScrollWindow } from "./scrollWindow.ts";
import { Silhouette } from "./silhouette.ts";

/**
 * Depth key for a thing standing at a world position.
 *
 * Sorting on world y alone leaves every prop in a tile row tied, and Pixi then
 * falls back to child order -- which is pool-slot order, and reshuffles each
 * time the scan window moves. That is what makes a forest flicker. Folding x in
 * as a tiebreak makes the order a property of the world rather than of the
 * pool, so it stays put.
 *
 * The x term is not globally negligible -- across the full width of the map it
 * is worth about an eighth of a tile row. It does not need to be. Two sprites
 * can only be drawn over one another if they are within a few tiles
 * horizontally, and over that range x shifts the key by at most a few
 * thousandths of a row, so y decides every comparison that is actually visible.
 */
export function depthOf(x: number, y: number): number {
  return y * 1024 + x;
}

/**
 * Nudge applied to the player's depth so that an exact tie with a static prop
 * resolves in the player's favour -- standing dead centre on the camp is one.
 * At a tie the two are at the same depth and either order is equally
 * defensible, so pick the one that keeps the player visible. Half a unit is far
 * less than the one-unit gap between adjacent props in a row, so this can never
 * leapfrog a prop that is genuinely in front.
 */
const PLAYER_TIEBREAK = 0.5;

/**
 * Tolerance, in asset pixels, for "already on the grid" in {@link snapToward}.
 * Without it a coordinate sitting on a grid line only through accumulated float
 * error reads as a hair past it, and `ceil` throws away a whole pixel.
 */
const SNAP_EPS = 1e-6;

/**
 * Snap `value` onto the asset-pixel grid, but never backwards along `dir`.
 *
 * Rounding to the *nearest* asset pixel can undo a step: creep one screen pixel
 * into a new pixel and the nearest grid point is the one just left, so the
 * sprite settles where it started and the step reads as lost. Rounding with the
 * direction of travel instead always finishes the crossing -- one screen pixel
 * in means seven more forward.
 *
 * `dir` defaults to 0, which rounds to nearest. That is the right answer for
 * anything with no travel to agree with: a prop at a fixed world position, and
 * the player on the first frame, before anything has moved.
 *
 * `anchorPx` is the distance from the sprite's top-left to its anchor, folded in
 * because that is the corner the art is laid out from and it is rarely a whole
 * number of scaled pixels. `scale` is screen pixels per asset pixel.
 */
export function snapToward(value: number, anchorPx: number, scale: number, dir = 0): number {
  const units = (value - anchorPx) / scale;
  const whole =
    dir > 0
      ? Math.ceil(units - SNAP_EPS)
      : dir < 0
        ? Math.floor(units + SNAP_EPS)
        : Math.round(units);
  return whole * scale + anchorPx;
}

/** World-space box a sprite covers, used for the occlusion test. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Everything that stands on the ground rather than being part of it: trees,
 * underbrush, resource nodes, the camp and the player.
 *
 * Trees are taller than the tile they occupy, so they cannot live in the tile
 * grid -- they have to overlap the tiles behind them. Everything here shares one
 * sorted container so the player interleaves with the props properly. A tree
 * that ends up in front of the player hands its sprite to {@link Silhouette},
 * which redraws the covered pixels on top so the player stays findable.
 *
 * Static props are only repositioned when the camera crosses a tile boundary;
 * between rebuilds the whole container is shifted. The player moves every frame.
 */
export class PropLayer {
  readonly container = new Container();

  private readonly pool: Sprite[] = [];
  private readonly boxes: Box[] = [];
  /** Which pooled sprites are tall enough to hide the player behind them. */
  private readonly occludes: boolean[] = [];
  /** Reused each frame so the occlusion test allocates nothing. */
  private readonly occluderScratch: Sprite[] = [];
  private used = 0;
  private readonly playerSprite = new Sprite();
  /** The player redrawn flat where a tree covers them. */
  private readonly silhouette: Silhouette;

  private readonly scale: number;

  /** Sub-pixel nudge easing the resting player onto the art grid, in screen px. */
  private settleX = 0;
  private settleY = 0;
  private lastPlayerX = Number.NaN;
  private lastPlayerY = Number.NaN;
  /** Sign of the last movement on each axis; the settle only ever snaps this way. */
  private dirX = 0;
  private dirY = 0;

  /**
   * Trees are four tiles tall, so ones rooted below the view still hang into
   * it; the bottom margin is deeper than the others for that reason.
   */
  private readonly window = new ScrollWindow({ left: 2, top: 2, right: 2, bottom: 4 });
  private dirty = true;

  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
    renderer: Renderer,
    private readonly z = 0,
  ) {
    this.scale = TILE / pack.tileSize;
    this.container.sortableChildren = true;
    this.playerSprite.scale.set(this.scale);
    this.playerSprite.anchor.set(pack.playerAnchor.x, pack.playerAnchor.y);
    this.playerSprite.visible = false;
    this.container.addChild(this.playerSprite);

    this.silhouette = new Silhouette(pack, renderer, this.scale);
    this.silhouette.addTo(this.container);
  }

  resize(widthPx: number, heightPx: number): void {
    if (this.window.resize(widthPx, heightPx)) this.dirty = true;
  }

  /** Force a rebuild, e.g. after a resource node is harvested. */
  invalidate(): void {
    this.dirty = true;
  }

  private take(): Sprite {
    let sprite = this.pool[this.used];
    if (!sprite) {
      sprite = new Sprite();
      sprite.scale.set(this.scale);
      this.pool.push(sprite);
      this.boxes.push({ x0: 0, y0: 0, x1: 0, y1: 0 });
      this.occludes.push(false);
      this.container.addChild(sprite);
    }
    this.used++;
    sprite.visible = true;
    return sprite;
  }

  update(
    camera: Camera,
    camp: Vec2,
    nodes: readonly ResourceNode[],
    player: Vec2 | null = null,
    playerTexture: Texture | null = null,
    dt = 0,
    springs: readonly Spring[] = [],
    caches: readonly Vec2[] = [],
  ): void {
    const scrolled = this.window.moveTo(camera.leftPx, camera.topPx);
    if (scrolled || this.dirty) {
      this.dirty = false;
      this.rebuild(camp, nodes, springs, caches);
    }

    this.container.x = this.window.offsetX;
    this.container.y = this.window.offsetY;

    if (!player || !playerTexture) {
      this.playerSprite.visible = false;
      this.silhouette.hide();
      return;
    }

    this.playerSprite.visible = true;
    this.playerSprite.texture = playerTexture;
    // While it moves the player is deliberately NOT snapped to the art grid,
    // unlike the props: quantising only the player fights the smoothly panning
    // camera and the sprite visibly slides backwards. Standing still there is
    // nothing to fight, so each axis eases onto the grid as soon as it stops,
    // always in the direction it was last travelling. The axes settle
    // independently, so sliding along a wall still lines up the blocked one.
    const rawX = (player.x - this.window.originX) * TILE;
    const rawY = (player.y - this.window.originY) * TILE;
    const anchorPxX = this.pack.playerAnchor.x * playerTexture.width * this.scale;
    const anchorPxY = this.pack.playerAnchor.y * playerTexture.height * this.scale;

    // On the very first frame there is no previous position, so both deltas are
    // zero: nothing has moved yet and `snapToward` falls back to nearest.
    const deltaX = Number.isFinite(this.lastPlayerX) ? player.x - this.lastPlayerX : 0;
    const deltaY = Number.isFinite(this.lastPlayerY) ? player.y - this.lastPlayerY : 0;
    if (deltaX !== 0) this.dirX = Math.sign(deltaX);
    if (deltaY !== 0) this.dirY = Math.sign(deltaY);
    const movingX = Math.abs(deltaX) > 1e-6;
    const movingY = Math.abs(deltaY) > 1e-6;
    this.lastPlayerX = player.x;
    this.lastPlayerY = player.y;

    const wantX = movingX ? 0 : snapToward(rawX, anchorPxX, this.scale, this.dirX) - rawX;
    const wantY = movingY ? 0 : snapToward(rawY, anchorPxY, this.scale, this.dirY) - rawY;
    const ease = dt > 0 ? 1 - Math.exp(-dt / PIXEL_SETTLE_SEC) : 1;
    this.settleX += (wantX - this.settleX) * ease;
    this.settleY += (wantY - this.settleY) * ease;

    this.playerSprite.x = Math.round(rawX + this.settleX);
    this.playerSprite.y = Math.round(rawY + this.settleY);
    const playerDepth = depthOf(player.x, player.y) + PLAYER_TIEBREAK;
    this.playerSprite.zIndex = playerDepth;

    // Only trees can swallow the player whole; a berry bush or an ore chunk in
    // front simply reads as being in front, and needs no help.
    const pb = this.pack.playerBounds;
    const px0 = player.x + pb.left;
    const px1 = player.x + pb.right;
    const py0 = player.y + pb.top;
    const py1 = player.y + pb.bottom;

    // Canopies drawn in front of the player and overlapping it. These become
    // the mask, so the silhouette shows exactly where the leaves cover you.
    const occluders: Sprite[] = this.occluderScratch;
    occluders.length = 0;
    for (let i = 0; i < this.used; i++) {
      if (!this.occludes[i]) continue;
      const sprite = this.pool[i]!;
      if (sprite.zIndex <= playerDepth) continue;
      const box = this.boxes[i]!;
      if (box.x0 < px1 && box.x1 > px0 && box.y0 < py1 && box.y1 > py0) occluders.push(sprite);
    }

    if (occluders.length > 0) {
      this.silhouette.show(playerTexture, this.playerSprite.x, this.playerSprite.y, occluders);
    } else {
      this.silhouette.hide();
    }
  }

  private rebuild(
    camp: Vec2,
    nodes: readonly ResourceNode[],
    springs: readonly Spring[],
    caches: readonly Vec2[],
  ): void {
    this.used = 0;
    for (const placement of placementsIn(
      this.map,
      this.pack,
      this.window,
      camp,
      nodes,
      springs,
      caches,
      this.z,
    )) {
      this.draw(placement);
    }
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }

  /** Turn one placement into a positioned, snapped, depth-sorted sprite. */
  private draw({ worldX, worldY, art, jitter, occludes }: Placement): void {
    const { originX, originY } = this.window;
    const sprite = this.take();
    sprite.texture = art.texture;
    sprite.anchor.set(art.anchorX, art.anchorY);

    let dx = 0;
    let dy = 0;
    if (jitter > 0) {
      // Break the grid so a forest reads as trees rather than a hedge row --
      // but only ever by whole art pixels.
      const h = tileHash(Math.floor(worldX), Math.floor(worldY));
      dx = (((h % (jitter * 2 + 1)) - jitter) | 0) * this.scale;
      dy = (((h >>> 8) % (jitter * 2 + 1)) - jitter) * this.scale;
    }
    const spriteW = art.texture.width * this.scale;
    const spriteH = art.texture.height * this.scale;
    sprite.x = snapToward((worldX - originX) * TILE + dx, art.anchorX * spriteW, this.scale);
    sprite.y = snapToward((worldY - originY) * TILE + dy, art.anchorY * spriteH, this.scale);
    sprite.zIndex = depthOf(worldX, worldY);

    this.occludes[this.used - 1] = occludes;
    const box = this.boxes[this.used - 1]!;
    box.x0 = worldX + art.bounds.left;
    box.y0 = worldY + art.bounds.top;
    box.x1 = worldX + art.bounds.right;
    box.y1 = worldY + art.bounds.bottom;
  }

  destroy(): void {
    this.silhouette.destroy();
    this.container.destroy({ children: true });
  }
}
