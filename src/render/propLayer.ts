import { ColorMatrixFilter, Container, Sprite, type Texture } from "pixi.js";
import { SILHOUETTE_ALPHA, SILHOUETTE_COLOR, TILE } from "../config.ts";
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
  private used = 0;
  private readonly playerSprite = new Sprite();
  /** The player redrawn flat, above everything, when a tree covers them. */
  private readonly silhouette = new Sprite();
  private readonly scale: number;

  private originX = Number.NaN;
  private originY = Number.NaN;
  private cols = 0;
  private rows = 0;
  private dirty = true;

  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
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
    this.silhouette.zIndex = Number.MAX_SAFE_INTEGER;

    this.container.addChild(this.playerSprite, this.silhouette);
  }

  resize(widthPx: number, heightPx: number): void {
    // Trees are four tiles tall, so ones rooted below the view still hang into
    // it; the bottom margin is deeper than the others for that reason.
    this.cols = Math.ceil(widthPx / TILE) + 4;
    this.rows = Math.ceil(heightPx / TILE) + 6;
    this.dirty = true;
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
      this.silhouette.visible = false;
      return;
    }

    this.playerSprite.visible = true;
    this.playerSprite.texture = playerTexture;
    this.playerSprite.x = Math.round((player.x - originX) * TILE);
    this.playerSprite.y = Math.round((player.y - originY) * TILE);
    const playerDepth = depthOf(player.x, player.y) + PLAYER_TIEBREAK;
    this.playerSprite.zIndex = playerDepth;

    // Only trees can swallow the player whole; a berry bush or an ore chunk in
    // front simply reads as being in front, and needs no help.
    const pb = this.pack.playerBounds;
    const px0 = player.x + pb.left;
    const px1 = player.x + pb.right;
    const py0 = player.y + pb.top;
    const py1 = player.y + pb.bottom;

    // How much of the player the nearest covering canopy hides. Going fully flat
    // the instant a trunk clips your elbow reads as a glitch; fading in with the
    // amount actually covered makes it feel like the tree is doing the hiding.
    const playerArea = Math.max((px1 - px0) * (py1 - py0), 1e-6);
    let covered = 0;
    for (let i = 0; i < this.used; i++) {
      if (!this.occludes[i]) continue;
      if (this.pool[i]!.zIndex <= playerDepth) continue;
      const box = this.boxes[i]!;
      const w = Math.min(box.x1, px1) - Math.max(box.x0, px0);
      const h = Math.min(box.y1, py1) - Math.max(box.y0, py0);
      if (w <= 0 || h <= 0) continue;
      const fraction = (w * h) / playerArea;
      if (fraction > covered) covered = fraction;
    }

    this.silhouette.visible = covered > 0;
    if (covered > 0) {
      this.silhouette.texture = playerTexture;
      this.silhouette.x = this.playerSprite.x;
      this.silhouette.y = this.playerSprite.y;
      this.silhouette.alpha = SILHOUETTE_ALPHA * Math.min(1, covered);
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
        // Break the grid so a forest reads as trees rather than a hedge row.
        const h = tileHash(Math.floor(worldX), Math.floor(worldY));
        dx = ((h % (jitter * 2 + 1)) - jitter) | 0;
        dy = (((h >>> 8) % (jitter + 1)) - (jitter >> 1)) | 0;
      }
      sprite.x = Math.round((worldX - originX) * TILE + dx);
      sprite.y = Math.round((worldY - originY) * TILE + dy);
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
        place(tileX + 0.5, tileY + 1, prop.texture, prop.anchorX, prop.anchorY, prop.bounds, 5, kind === "tree");
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
    this.container.destroy({ children: true });
  }
}
