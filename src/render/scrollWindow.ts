import { TILE } from "../config.ts";

/**
 * Tiles of slack kept outside the viewport on each side.
 *
 * Sprites in the margin are drawn but not seen, so they can scroll in already
 * correct. How much slack a layer needs depends on how far its content can
 * reach outside its own tile: ground never does, so one tile all round is
 * enough, while a tree rooted several tiles below the view still hangs into it.
 */
export interface Margin {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The grid of tiles a layer keeps sprites for: a window over the map, big
 * enough to cover the viewport plus its margins, that slides as the camera
 * moves.
 *
 * Both layers scroll the same way, and it is worth having the rule in one
 * place. Sprites hold whole-tile positions and are only refilled when the
 * camera crosses a tile boundary; the leftover fraction of a tile is applied
 * once to the container, so scrolling is one transform rather than a thousand.
 *
 * This is deliberately free of Pixi: it computes indices and offsets, and the
 * layers decide what to do about them.
 */
export class ScrollWindow {
  /** Size of the grid, in tiles. */
  cols = 0;
  rows = 0;

  /** Map tile drawn at grid slot (0, 0). NaN until the first {@link moveTo}. */
  originX = Number.NaN;
  originY = Number.NaN;

  /** Where to put the container so slot (0, 0) lands correctly, in screen px. */
  offsetX = 0;
  offsetY = 0;

  constructor(private readonly margin: Margin) {}

  /**
   * Fit the window to a viewport size.
   *
   * Returns true if the grid changed shape, meaning the caller's sprite pool no
   * longer matches and has to be rebuilt. A window that changed shape is also
   * marked as needing a refill, so the caller does not have to track that too.
   */
  resize(widthPx: number, heightPx: number): boolean {
    const cols = Math.ceil(widthPx / TILE) + this.margin.left + this.margin.right;
    const rows = Math.ceil(heightPx / TILE) + this.margin.top + this.margin.bottom;
    if (cols === this.cols && rows === this.rows) return false;
    this.cols = cols;
    this.rows = rows;
    this.originX = Number.NaN; // force the next moveTo to report a move
    return true;
  }

  /**
   * Slide to a camera position, given the world-space pixel coordinate of the
   * top-left of the view.
   *
   * Returns true when the origin moved, i.e. the sprites now stand for
   * different tiles and their contents are stale. Callers with other reasons to
   * refill -- an advancing animation, a harvested resource -- should OR those
   * in; this only reports the scrolling.
   */
  moveTo(leftPx: number, topPx: number): boolean {
    const originX = Math.floor(leftPx / TILE) - this.margin.left;
    const originY = Math.floor(topPx / TILE) - this.margin.top;
    const moved = originX !== this.originX || originY !== this.originY;
    this.originX = originX;
    this.originY = originY;
    this.offsetX = Math.round(originX * TILE - leftPx);
    this.offsetY = Math.round(originY * TILE - topPx);
    return moved;
  }

  /** Is this map tile inside the window, margins included? */
  covers(tileX: number, tileY: number): boolean {
    return (
      tileX >= this.originX &&
      tileY >= this.originY &&
      tileX <= this.originX + this.cols &&
      tileY <= this.originY + this.rows
    );
  }
}
