import { CAMERA_STIFFNESS, TILE } from "../config.ts";
import type { Vec2 } from "../sim/types.ts";

/**
 * Where the view is looking, in tile units. Rendering reads `leftPx`/`topPx`;
 * everything else in the game thinks purely in tiles.
 */
export class Camera {
  /** Centre of the view, in tile units. */
  x = 0;
  y = 0;
  viewWidthPx = 0;
  viewHeightPx = 0;

  resize(widthPx: number, heightPx: number): void {
    this.viewWidthPx = widthPx;
    this.viewHeightPx = heightPx;
  }

  centreOn(target: Vec2): void {
    this.x = target.x;
    this.y = target.y;
  }

  /** Follow with a little lag so the view glides rather than snaps. */
  follow(target: Vec2, dt: number, stiffness = CAMERA_STIFFNESS): void {
    const t = 1 - Math.exp(-stiffness * dt);
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
  }

  /** Keep the view inside the map, or centre it if the map is smaller. */
  clampTo(mapWidth: number, mapHeight: number): void {
    const halfW = this.viewWidthPx / 2 / TILE;
    const halfH = this.viewHeightPx / 2 / TILE;
    this.x = mapWidth <= halfW * 2 ? mapWidth / 2 : clamp(this.x, halfW, mapWidth - halfW);
    this.y = mapHeight <= halfH * 2 ? mapHeight / 2 : clamp(this.y, halfH, mapHeight - halfH);
  }

  /** World-space pixel coordinate of the top-left corner of the view. */
  get leftPx(): number {
    return this.x * TILE - this.viewWidthPx / 2;
  }
  get topPx(): number {
    return this.y * TILE - this.viewHeightPx / 2;
  }

  /** Convert a world position (tiles) to a screen position (pixels). */
  toScreen(world: Vec2): Vec2 {
    return { x: world.x * TILE - this.leftPx, y: world.y * TILE - this.topPx };
  }

  /** The inverse: where on the map a point on the canvas is. */
  toWorld(screen: Vec2): Vec2 {
    return { x: (screen.x + this.leftPx) / TILE, y: (screen.y + this.topPx) / TILE };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
