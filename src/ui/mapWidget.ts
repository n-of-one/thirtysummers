import * as C from "../config.ts";
import type { World } from "../sim/world.ts";
import { mapMarks, tileColour } from "./mapPicture.ts";

/**
 * Where a map is drawn: the circle round the player in the corner, or the
 * whole valley in place of the tile view, which `MAP_KEY` opens.
 */
export type MapLayout = "corner" | "whole";

/**
 * A map of the valley as the family has seen it, drawn from `mapPicture.ts`.
 *
 * It is the one part of the HUD that keeps the art-pixel rule. The canvas has
 * a pixel a tile and is shown at a whole number of art pixels a tile,
 * `TILE / pack.tileSize` logical pixels each, scaled without smoothing, with
 * its corner on that grid.
 *
 * - `corner` is a circle round the player, `MAP_DIAMETER_TILES` across at one
 *   art pixel a tile, in the top right.
 *   The player's tile is always the middle cell, so it moves a whole tile at a
 *   time, and its edge is tiles in or out, never a curve through a pixel.
 * - `whole` is the entire map at the most art pixels a tile that fit the view,
 *   up to `MAP_WHOLE_MAX_ART_PX`, centred.
 *
 * It draws only when something it shows has changed: the player's tile, the
 * seen count, or the ground under a tile it shows. Everything else is a frame
 * that writes nothing.
 */
export class MapWidget {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private image: ImageData;
  private pixels: Uint32Array;
  /** Which cells are drawn at all, 1 a cell: the circle, or all of them. */
  private inside: Uint8Array;
  private width = 0;
  private height = 0;
  /** What the canvas was last drawn from, so an unchanged frame draws nothing. */
  private drawnKey = "";
  /** How far through `world.events` the widget has got. */
  private seenEvents = 0;
  /** A tile it shows changed its ground since the last drawing. */
  private dirty = true;
  /** Frames drawn, for measuring what the widget costs. */
  draws = 0;

  constructor(
    parent: HTMLElement,
    private readonly layout: MapLayout,
    private readonly artPx: number,
    private readonly view: { width: number; height: number },
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = layout === "corner" ? "map" : "map-whole";
    // First, so everything else in the HUD is painted over it.
    parent.prepend(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(1, 1);
    this.pixels = new Uint32Array(0);
    this.inside = new Uint8Array(0);
    if (layout === "corner") this.resize(C.MAP_DIAMETER_TILES, C.MAP_DIAMETER_TILES);
  }

  /**
   * Size the canvas to `width` by `height` tiles and place it. The corner's is
   * fixed; the whole map's follows the map, which a regenerate can change.
   */
  private resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.image = this.ctx.createImageData(width, height);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.inside = new Uint8Array(width * height).fill(1);
    const art = this.artPx;
    let perTile: number;
    let left: number;
    let top: number;
    if (this.layout === "corner") {
      perTile = art;
      // The same rule `markCircle` marks by: a cell's offset from the middle
      // cell, in whole tiles, within the radius. So the seen circle sits in
      // it cell for tile.
      const c = Math.floor(width / 2);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          this.inside[y * width + x] = (x - c) ** 2 + (y - c) ** 2 <= c * c ? 1 : 0;
        }
      }
      // Top right, on the art grid, whatever the margin says. What sits
      // under it -- the hydration bar -- is placed from where it ends.
      left = Math.floor((this.view.width - C.MAP_MARGIN_PX - width * perTile) / art) * art;
      top = Math.ceil(C.MAP_MARGIN_PX / art) * art;
      this.canvas.parentElement?.style.setProperty("--map-bottom", `${top + height * perTile}px`);
    } else {
      perTile = wholeArtPx(width, height, art, this.view) * art;
      left = Math.floor((this.view.width - width * perTile) / 2 / art) * art;
      top = Math.floor((this.view.height - height * perTile) / 2 / art) * art;
    }
    Object.assign(this.canvas.style, {
      width: `${width * perTile}px`,
      height: `${height * perTile}px`,
      left: `${left}px`,
      top: `${top}px`,
    });
    this.dirty = true;
  }

  get hidden(): boolean {
    return this.canvas.hidden === true;
  }

  /** Set every frame, so setting what it already is does nothing. */
  set hidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.canvas.hidden = hidden;
    // Shown again, it draws at once rather than waiting for something to change.
    if (!hidden) this.dirty = true;
  }

  /**
   * Start reading the log from `cursor`, and draw on the next update. The same
   * two callers as the HUD's: a regenerated world from 0, the next summer from
   * where the log had got to.
   */
  reset(cursor = 0): void {
    this.seenEvents = cursor;
    this.dirty = true;
  }

  update(world: World): void {
    if (this.layout === "whole" && (this.width !== world.map.width || this.height !== world.map.height)) {
      this.resize(world.map.width, world.map.height);
    }
    const px = Math.floor(world.player.x);
    const py = Math.floor(world.player.y);
    // The world tile in the canvas's top left cell.
    const ox = this.layout === "corner" ? px - Math.floor(this.width / 2) : 0;
    const oy = this.layout === "corner" ? py - Math.floor(this.height / 2) : 0;
    const events = world.events;
    for (let i = this.seenEvents; i < events.length && !this.dirty; i++) {
      const e = events[i]!;
      if (e.type === "summerStarted") this.dirty = true;
      else if (
        e.type === "cut" ||
        e.type === "built" ||
        e.type === "felled" ||
        // Only a trail walked flat into grass changes the terrain; a stage of
        // wear is not drawn.
        (e.type === "trodden" && e.grass) ||
        e.type === "dug"
      ) {
        if (e.x >= ox && e.y >= oy && e.x < ox + this.width && e.y < oy + this.height) this.dirty = true;
      }
    }
    this.seenEvents = events.length;
    if (this.hidden) return;

    const key = `${px},${py},${world.seenCount}`;
    if (key === this.drawnKey && !this.dirty) return;
    this.drawnKey = key;
    this.dirty = false;
    this.draw(world, ox, oy, px - ox, py - oy);
  }

  private draw(world: World, ox: number, oy: number, playerX: number, playerY: number): void {
    const marks = mapMarks(world);
    const unseen = abgr(C.MAP_COLORS.unseen);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        if (!this.inside[i]) {
          this.pixels[i] = 0;
          continue;
        }
        const colour = tileColour(world, marks, ox + x, oy + y);
        this.pixels[i] = colour === null ? unseen : abgr(colour);
      }
    }
    if (playerX >= 0 && playerY >= 0 && playerX < this.width && playerY < this.height) {
      this.pixels[playerY * this.width + playerX] = abgr(C.MAP_COLORS.player);
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.draws++;
  }
}

/**
 * How many art pixels a tile the whole map is drawn at: the most that fit the
 * view both ways, from 1 up to `MAP_WHOLE_MAX_ART_PX`. Never below 1, so a
 * map too big for the view overhangs it rather than breaking the rule.
 */
export function wholeArtPx(
  widthTiles: number,
  heightTiles: number,
  artPx: number,
  view: { width: number; height: number },
): number {
  const fit = Math.floor(Math.min(view.width / (widthTiles * artPx), view.height / (heightTiles * artPx)));
  return Math.max(1, Math.min(C.MAP_WHOLE_MAX_ART_PX, fit));
}

/** `0xrrggbb` as an opaque pixel in the little-endian byte order `ImageData` is read in. */
function abgr(rgb: number): number {
  return (
    (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0
  );
}
