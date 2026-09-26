import { Container, Sprite } from "pixi.js";
import { TILE } from "../config.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { TerrainKind } from "../sim/types.ts";
import { CLIFF_FALLS, CLIFF_FALLS_E, CLIFF_FALLS_W, CLIFF_S2, CLIFF_S3, E, N, NE, NW, S, SE, SW, W } from "./packs/autotile.ts";
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
 * with a transition back to open grass. Saplings stand on grass. Everything else is its own surface --
 * including a bridge, which is planks laid over the water and reads as its own
 * thing crossing it. Exported so the placement tests can agree about what
 * autotiles with what.
 */
export function surfaceOf(kind: TerrainKind): TerrainKind {
  if (kind === "tree" || kind === "thicket" || kind === "denseUnderbrush") return "underbrush";
  // Water runs straight to the cliff's foot, with no bank against it: the
  // cliff draws the edge.
  if (kind === "cliff") return "stream";
  // A sapling stands on open grass, which is what felling it leaves.
  if (kind === "sapling") return "grass";
  return kind;
}

/**
 * A cliff tile's mask, which is not a same-ground mask like every other.
 *
 * A cliff is the edge of the valley floor above the river, and what it looks
 * like depends on where the water is, not on where more cliff is: the floor
 * and the cliff are one high surface, and the river is what is cut out of it.
 * So a bit is set for each neighbour that is not water. {@link CLIFF_S2} and
 * {@link CLIFF_S3} say whether the water is two and three tiles south, since a
 * face is three tiles tall and each tile is one row of it.
 */
export function cliffMask(map: TileMap, x: number, y: number, z = 0): number {
  const high = (dx: number, dy: number) => map.get(x + dx, y + dy, z) !== "stream";
  let mask = 0;
  if (high(0, -1)) mask |= N;
  if (high(1, 0)) mask |= E;
  if (high(0, 1)) mask |= S;
  if (high(-1, 0)) mask |= W;
  if (high(1, -1)) mask |= NE;
  if (high(1, 1)) mask |= SE;
  if (high(-1, 1)) mask |= SW;
  if (high(-1, -1)) mask |= NW;
  if (!high(0, 2)) mask |= CLIFF_S2;
  if (!high(0, 3)) mask |= CLIFF_S3;
  if (isFalls(map, x, y, z)) {
    mask |= CLIFF_FALLS;
    if (isFalls(map, x - 1, y, z)) mask |= CLIFF_FALLS_W;
    if (isFalls(map, x + 1, y, z)) mask |= CLIFF_FALLS_E;
  }
  return mask;
}

/**
 * Is the cliff tile at (x, y) part of the falls: the first stream straight
 * above it, through no more than the face's three tiles of cliff?
 *
 * What tells the stream from the river is its bank: along the row of the
 * water above, the first tile past the water is walkable ground on one side
 * or the other. The river has cliff on both.
 */
function isFalls(map: TileMap, x: number, y: number, z: number): boolean {
  if (map.get(x, y, z) !== "cliff") return false;
  for (let up = 1; up <= 3; up++) {
    const wy = y - up;
    const kind = map.get(x, wy, z);
    if (kind === "cliff") continue;
    if (kind !== "stream") return false;
    for (const step of [-1, 1]) {
      let wx = x;
      for (let n = 0; n < 4 && map.get(wx, wy, z) === "stream"; n++) wx += step;
      if (map.isPassable(wx, wy, z)) return true;
    }
    return false;
  }
  return false;
}

/** How far a trail has worn the tile at (x, y, z): 0 for not at all. */
export type TrailStageAt = (x: number, y: number, z: number) => number;

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

  /**
   * @param trail  how far a trail has worn each tile. The world answers it;
   *               the layer only reads.
   */
  constructor(
    private readonly map: TileMap,
    private readonly pack: AssetPack,
    private readonly z = 0,
    private readonly trail: TrailStageAt = () => 0,
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
    if (kind === "cliff") return cliffMask(this.map, x, y, this.z);
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
        const mask = this.mask(tileX, tileY, kind);
        const stage = this.trail(tileX, tileY, this.z);
        sprite.texture =
          stage > 0
            ? this.pack.trodden(stage, mask, tileHash(tileX, tileY))
            : this.pack.ground(kind, mask, tileHash(tileX, tileY), this.frame);
        sprite.tint = this.pack.groundTint(kind);
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
