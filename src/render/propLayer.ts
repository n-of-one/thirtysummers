import {
  ColorMatrixFilter,
  Container,
  RenderTexture,
  Sprite,
  type Renderer,
  type Texture,
} from "pixi.js";
import { PIXEL_SETTLE_SEC, SILHOUETTE_ALPHA, SILHOUETTE_COLOR, TILE } from "../config.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { ResourceNode, Vec2 } from "../sim/types.ts";
import type { AssetPack, Bounds } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { Camera } from "./camera.ts";

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
 * resolves in the player's favour.
 *
 * Standing dead centre on the camp gives the player and the chest identical
 * depth, and the tie then fell to insertion order -- which hid the player
 * completely, on the very tile they spawn on. A tie means the two are at the
 * same depth and either order is equally defensible, so pick the one that keeps
 * the player visible. Half a unit is far less than the one-unit gap between
 * adjacent props in a row, so this can never leapfrog a prop that is genuinely
 * in front.
 */
const PLAYER_TIEBREAK = 0.5;

/**
 * How far a prop may be nudged off its tile centre, in ASSET pixels.
 *
 * The nudge has to be a whole number of source pixels. Offsetting by screen
 * pixels instead shifts a sprite by a fraction of an art pixel, so two trees
 * end up on grids a pixel or two apart and the pixel-art illusion collapses.
 */
const PROP_JITTER_PX = 1;

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
 * in means seven more forward. `dir === 0` (nothing has moved yet) falls back to
 * nearest, the one case with no travel to agree with.
 *
 * `anchorPx` is the distance from the sprite's top-left to its anchor, folded in
 * because that is the corner the art is laid out from and it is rarely a whole
 * number of scaled pixels. `scale` is screen pixels per asset pixel.
 */
export function snapToward(value: number, anchorPx: number, scale: number, dir: number): number {
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
 * sorted container so the player interleaves with the props properly; a prop
 * that ends up in front of the player is faded so the player stays visible.
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
  /** The player redrawn flat, above everything, where a tree covers them. */
  private readonly silhouette = new Sprite();

  /**
   * The silhouette is masked so it only appears on the covered part of the
   * player. Pixi's alpha mask must be a single Sprite, so the covering canopies
   * are first drawn into a small render texture -- just the size of one player
   * frame, not the viewport -- and that texture becomes the mask.
   */
  /**
   * The filter and the mask sit on different objects on purpose. Putting both
   * on one sprite makes Pixi run the colour matrix over an already-masked,
   * already-premultiplied intermediate texture, and the flat colour comes out
   * muddied. Filtering the sprite and masking its parent keeps the two passes
   * independent.
   */
  private readonly silhouetteHolder = new Container();
  private readonly maskScene = new Container();
  private readonly maskPool: Sprite[] = [];
  private readonly maskSprite = new Sprite();
  private maskTexture: RenderTexture | null = null;

  private readonly scale: number;

  /** Sub-pixel nudge easing the resting player onto the art grid, in screen px. */
  private settleX = 0;
  private settleY = 0;
  private lastPlayerX = Number.NaN;
  private lastPlayerY = Number.NaN;
  /** Sign of the last movement on each axis; the settle only ever snaps this way. */
  private dirX = 0;
  private dirY = 0;

  private originX = Number.NaN;
  private originY = Number.NaN;
  private cols = 0;
  private rows = 0;
  private dirty = true;

  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
    private readonly renderer: Renderer,
    private readonly z = 0,
  ) {
    this.scale = TILE / pack.tileSize;
    this.container.sortableChildren = true;
    this.playerSprite.scale.set(this.scale);
    this.playerSprite.anchor.set(pack.playerAnchor.x, pack.playerAnchor.y);
    this.playerSprite.visible = false;

    // A tint would only multiply the sprite's own shading; this matrix discards
    // the incoming colour entirely and emits one flat colour, keeping alpha, so
    // the result is a true silhouette. The colour is written pre-multiplied by
    // alpha because that is how Pixi composites.
    const flatten = new ColorMatrixFilter();
    const r = ((SILHOUETTE_COLOR >> 16) & 0xff) / 255;
    const g = ((SILHOUETTE_COLOR >> 8) & 0xff) / 255;
    const b = (SILHOUETTE_COLOR & 0xff) / 255;
    flatten.matrix = [0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 0, 1, 0];
    this.silhouette.filters = [flatten];
    this.silhouette.scale.set(this.scale);
    this.silhouette.anchor.set(pack.playerAnchor.x, pack.playerAnchor.y);
    this.silhouette.visible = false;

    // Pixi's alpha mask samples the RED channel by default, not alpha. Canopies
    // are green, so masking with them directly produced a faint, patchy stencil
    // that only showed through the yellower leaves. Flattening the mask scene to
    // white makes red follow alpha, so the mask is the canopy's exact shape.
    const toWhite = new ColorMatrixFilter();
    toWhite.matrix = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    this.maskScene.filters = [toWhite];

    this.silhouetteHolder.addChild(this.silhouette);
    this.silhouetteHolder.mask = this.maskSprite;
    this.silhouetteHolder.zIndex = Number.MAX_SAFE_INTEGER;
    // The mask sprite is never drawn itself; Pixi clears `renderable` on it.
    this.container.addChild(this.playerSprite, this.maskSprite, this.silhouetteHolder);
  }

  /** Draw the covering canopies into the mask texture, aligned to the player. */
  private renderMask(playerTexture: Texture, occluders: Sprite[]): void {
    const w = Math.ceil(playerTexture.width * this.scale);
    const h = Math.ceil(playerTexture.height * this.scale);
    if (!this.maskTexture || this.maskTexture.width !== w || this.maskTexture.height !== h) {
      this.maskTexture?.destroy(true);
      this.maskTexture = RenderTexture.create({ width: w, height: h, antialias: false });
      this.maskSprite.texture = this.maskTexture;
    }

    // Top-left of the player's frame, in this container's coordinates.
    const frameX = this.playerSprite.x - this.pack.playerAnchor.x * w;
    const frameY = this.playerSprite.y - this.pack.playerAnchor.y * h;
    this.maskSprite.position.set(frameX, frameY);

    // Shift the copies so that frame corner maps to the texture's origin.
    this.maskScene.position.set(-frameX, -frameY);

    for (let i = 0; i < occluders.length; i++) {
      let copy = this.maskPool[i];
      if (!copy) {
        copy = new Sprite();
        this.maskPool.push(copy);
        this.maskScene.addChild(copy);
      }
      const from = occluders[i]!;
      copy.visible = true;
      copy.texture = from.texture;
      copy.anchor.copyFrom(from.anchor);
      copy.scale.copyFrom(from.scale);
      copy.position.copyFrom(from.position);
    }
    for (let i = occluders.length; i < this.maskPool.length; i++) this.maskPool[i]!.visible = false;

    this.renderer.render({ container: this.maskScene, target: this.maskTexture, clear: true });
  }

  resize(widthPx: number, heightPx: number): void {
    // Trees are four tiles tall, so ones rooted below the view still hang into
    // it; the bottom margin is deeper than the others for that reason.
    this.cols = Math.ceil(widthPx / TILE) + 4;
    this.rows = Math.ceil(heightPx / TILE) + 6;
    this.dirty = true;
  }

  /**
   * Snap a screen coordinate so the sprite's drawn pixels land on whole asset
   * pixels. `anchorPx` is the distance from the sprite's top-left to its anchor;
   * it is folded in because that is the corner the art is actually laid out
   * from, and it is rarely a whole number of scaled pixels.
   */
  private snap(value: number, anchorPx: number): number {
    return Math.round((value - anchorPx) / this.scale) * this.scale + anchorPx;
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
  ): void {
    const originX = Math.floor(camera.leftPx / TILE) - 2;
    const originY = Math.floor(camera.topPx / TILE) - 2;

    if (this.dirty || originX !== this.originX || originY !== this.originY) {
      this.originX = originX;
      this.originY = originY;
      this.dirty = false;
      this.rebuild(camp, nodes);
    }

    this.container.x = Math.round(originX * TILE - camera.leftPx);
    this.container.y = Math.round(originY * TILE - camera.topPx);

    if (!player || !playerTexture) {
      this.playerSprite.visible = false;
      this.silhouetteHolder.visible = false;
      return;
    }

    this.playerSprite.visible = true;
    this.playerSprite.texture = playerTexture;
    // While it moves the player is deliberately NOT snapped to the art grid,
    // unlike the props.
    //
    // Props sit at fixed world positions, so snapping them is free. The player
    // moves continuously while the camera pans smoothly behind it, and
    // quantising only the player makes the two fight: the sprite holds still
    // for a frame or two while the camera keeps drifting, so it visibly slides
    // backwards before catching up. The slower the terrain, the longer it holds
    // and the worse it looks -- it was plain in underbrush and nearly invisible
    // on grass.
    //
    // Standing still there is nothing to fight, so each axis eases onto the grid
    // as soon as it stops, always in the direction it was last travelling. The
    // axes settle independently, so sliding along a wall still lines up the
    // blocked one.
    const rawX = (player.x - originX) * TILE;
    const rawY = (player.y - originY) * TILE;
    const anchorPxX = this.pack.playerAnchor.x * playerTexture.width * this.scale;
    const anchorPxY = this.pack.playerAnchor.y * playerTexture.height * this.scale;

    const deltaX = player.x - this.lastPlayerX;
    const deltaY = player.y - this.lastPlayerY;
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

    this.silhouetteHolder.visible = occluders.length > 0;
    this.silhouette.visible = true;
    if (occluders.length > 0) {
      this.silhouette.texture = playerTexture;
      this.silhouette.x = this.playerSprite.x;
      this.silhouette.y = this.playerSprite.y;
      // The mask already limits the silhouette to the covered pixels, so it is
      // drawn at full strength -- no need to fade it by how much is covered.
      this.silhouette.alpha = SILHOUETTE_ALPHA;
      this.renderMask(playerTexture, occluders);
    }
  }

  private rebuild(camp: Vec2, nodes: readonly ResourceNode[]): void {
    this.used = 0;
    const { originX, originY, cols, rows } = this;

    const place = (
      worldX: number,
      worldY: number,
      texture: Texture,
      anchorX: number,
      anchorY: number,
      bounds: Bounds,
      jitter = 0,
      occludes = false,
    ): void => {
      const sprite = this.take();
      sprite.texture = texture;
      sprite.anchor.set(anchorX, anchorY);

      let dx = 0;
      let dy = 0;
      if (jitter > 0) {
        // Break the grid so a forest reads as trees rather than a hedge row --
        // but only ever by whole art pixels.
        const h = tileHash(Math.floor(worldX), Math.floor(worldY));
        dx = (((h % (jitter * 2 + 1)) - jitter) | 0) * this.scale;
        dy = (((h >>> 8) % (jitter * 2 + 1)) - jitter) * this.scale;
      }
      const spriteW = texture.width * this.scale;
      const spriteH = texture.height * this.scale;
      sprite.x = this.snap((worldX - originX) * TILE + dx, anchorX * spriteW);
      sprite.y = this.snap((worldY - originY) * TILE + dy, anchorY * spriteH);
      sprite.zIndex = depthOf(worldX, worldY);

      this.occludes[this.used - 1] = occludes;
      const box = this.boxes[this.used - 1]!;
      box.x0 = worldX + bounds.left;
      box.y0 = worldY + bounds.top;
      box.x1 = worldX + bounds.right;
      box.y1 = worldY + bounds.bottom;
    };

    for (let row = 0; row < rows; row++) {
      const tileY = originY + row;
      for (let col = 0; col < cols; col++) {
        const tileX = originX + col;
        const kind = this.map.get(tileX, tileY, this.z);
        if (kind !== "tree" && kind !== "underbrush") continue;
        const prop = this.pack.prop(kind, tileHash(tileX, tileY));
        if (!prop) continue;
        // A prop stands on the bottom edge of its tile, so it sorts in front of
        // anything whose feet are further north.
        place(tileX + 0.5, tileY + 1, prop.texture, prop.anchorX, prop.anchorY, prop.bounds,
              PROP_JITTER_PX, kind === "tree");
      }
    }

    const inView = (x: number, y: number) =>
      x >= originX && x <= originX + cols && y >= originY && y <= originY + rows;

    if (inView(camp.x, camp.y)) {
      const art = this.pack.camp;
      place(camp.x, camp.y, art.texture, art.anchorX, art.anchorY, art.bounds);
    }

    for (const node of nodes) {
      if (node.harvested || !inView(node.x, node.y)) continue;
      const art = this.pack.resource(node.kind);
      place(node.x, node.y, art.texture, art.anchorX, art.anchorY, art.bounds);
    }

    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }

  destroy(): void {
    this.maskTexture?.destroy(true);
    this.maskScene.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
