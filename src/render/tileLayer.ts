import { Container, Sprite } from "pixi.js";
import { TILE } from "../config.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { TerrainKind } from "../sim/types.ts";
import { E, N, NE, NW, S, SE, SW, W } from "./packs/autotile.ts";
import type { AssetPack } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { Camera } from "./camera.ts";

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
  private cols = 0;
  private rows = 0;
  private originX = Number.NaN;
  private originY = Number.NaN;
  private frame = 0;
  private drawnFrame = -1;

  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
    private readonly z = 0,
  ) {
    this.container.isRenderGroup = true;
  }

  resize(widthPx: number, heightPx: number): void {
    // One extra column and row on each side so tiles scroll in already drawn.
    const cols = Math.ceil(widthPx / TILE) + 2;
    const rows = Math.ceil(heightPx / TILE) + 2;
    if (cols === this.cols && rows === this.rows) return;

    this.cols = cols;
    this.rows = rows;
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
    this.originX = Number.NaN; // force a texture refill
  }

  /** Advance animated terrain (water). Call with the elapsed seconds. */
  setAnimationFrame(frame: number): void {
    this.frame = frame;
  }

  update(camera: Camera): void {
    const left = camera.leftPx;
    const top = camera.topPx;
    const originX = Math.floor(left / TILE) - 1;
    const originY = Math.floor(top / TILE) - 1;

    if (originX !== this.originX || originY !== this.originY || this.frame !== this.drawnFrame) {
      this.originX = originX;
      this.originY = originY;
      this.drawnFrame = this.frame;
      this.refill();
    }

    // Sub-tile scroll: shift the whole grid rather than every sprite.
    this.container.x = Math.round(originX * TILE - left);
    this.container.y = Math.round(originY * TILE - top);
  }

  /**
   * Which of the 8 neighbours continue the same terrain. Out-of-bounds reads
   * come back as rock, so the map border autotiles against the world edge
   * instead of showing a cut edge.
   */
  private mask(x: number, y: number, kind: TerrainKind): number {
    const same = (dx: number, dy: number) => this.map.get(x + dx, y + dy, this.z) === kind;
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
    for (let row = 0; row < this.rows; row++) {
      const tileY = this.originY + row;
      for (let col = 0; col < this.cols; col++) {
        const tileX = this.originX + col;
        const kind = this.map.get(tileX, tileY, this.z);
        const sprite = this.sprites[row * this.cols + col]!;
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
