import * as C from "../config.ts";
import { seenRadiusTiles } from "../sim/stats.ts";
import type { Vec2 } from "../sim/types.ts";
import type { World } from "../sim/world.ts";
import { dryBrightness, fade, isLandmark, mapMarks, tileColour } from "./mapPicture.ts";

/**
 * Where a map is drawn: the circle round the player in the corner, or the
 * whole valley in place of the tile view, which `MAP_KEY` opens.
 */
export type MapLayout = "corner" | "whole";

/** The corner map's circle radius, in tiles: the player's tile and this many either side. */
const MAP_RADIUS = (C.MAP_DIAMETER_TILES - 1) / 2;

/**
 * How many tiles of circle the corner map draws round the player's tile, at a
 * hydration.
 *
 * A dry player could otherwise navigate by the map while the fog has closed
 * in, which undoes what the fog is for. So the whole circle down to the fog's
 * threshold, then closing a whole ring at a time to meet what the player sees
 * -- the seen radius -- at `MAP_SHRINK_CATCH_UP_HYDRATION`, and following that
 * below it: from there the map is never a better guide than the eyes.
 */
export function minimapRadius(hydration: number): number {
  const from = C.HYDRATION_FOG_THRESHOLD;
  const meet = C.MAP_SHRINK_CATCH_UP_HYDRATION;
  if (hydration >= from) return MAP_RADIUS;
  if (hydration < meet) return Math.round(seenRadiusTiles(hydration));
  const target = seenRadiusTiles(meet);
  return Math.round(target + ((MAP_RADIUS - target) * (hydration - meet)) / (from - meet));
}

/**
 * The seen drinking spots within the corner map's full circle, as offsets
 * from the player's tile. Drawn whatever the circle has shrunk to, so a dry
 * player still sees where the water near them is.
 */
export function nearDrinks(world: World, px: number, py: number): { dx: number; dy: number }[] {
  const w = world.map.width;
  const out: { dx: number; dy: number }[] = [];
  for (const s of world.springs) {
    if (!world.seen[s.y * w + s.x]) continue;
    const dx = s.x - px;
    const dy = s.y - py;
    if (dx * dx + dy * dy <= MAP_RADIUS * MAP_RADIUS) out.push({ dx, dy });
  }
  return out;
}

/**
 * The drinking spot the pointer to water is for, or null before any water has
 * been seen.
 *
 * The nearest seen spot in a straight line, the way the player remembers
 * water to be, not the way there. But `held`, the one it was for last time,
 * is kept until another is `MAP_POINTER_HOLD_TILES` nearer: springs come in
 * rows along a bank, and without the hold the pointer would flick between two
 * as the player walked along it.
 */
export function drinkTarget(world: World, px: number, py: number, held: Vec2 | null = null): Vec2 | null {
  const w = world.map.width;
  let best: Vec2 | null = null;
  let bestD = Infinity;
  let heldD = Infinity;
  for (const s of world.springs) {
    if (!world.seen[s.y * w + s.x]) continue;
    const d = Math.hypot(s.x - px, s.y - py);
    if (held && s.x === held.x && s.y === held.y) heldD = d;
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  if (heldD < Infinity && bestD > heldD - C.MAP_POINTER_HOLD_TILES) return held;
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Where the pointer to `target` goes, as an offset from the player's tile on
 * the ring just outside the corner map's circle, or null while the target is
 * within the circle: then it is drawn itself, and the pointer, which stood at
 * the same bearing one tile further out, gives way to it without a jump.
 */
export function drinkPointer(target: Vec2 | null, px: number, py: number): { dx: number; dy: number } | null {
  if (!target) return null;
  const tx = target.x - px;
  const ty = target.y - py;
  const d2 = tx * tx + ty * ty;
  if (d2 <= MAP_RADIUS * MAP_RADIUS) return null;
  // The first cell outside the circle along the bearing, so the pointer sits
  // against the circle's edge whichever way it points; rounding a point a
  // fixed distance out would leave a gap on the diagonals.
  const d = Math.sqrt(d2);
  for (let t = MAP_RADIUS; ; t += 0.25) {
    const dx = Math.round((tx * t) / d);
    const dy = Math.round((ty * t) / d);
    if (dx * dx + dy * dy > MAP_RADIUS * MAP_RADIUS) return { dx, dy };
  }
}

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
  /** The drinking spot the corner's pointer to water is holding, if any. */
  private drinkTarget: Vec2 | null = null;
  /** The corner map's circle radius as last cut, in tiles. */
  private circle = MAP_RADIUS;

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
    // A ring wider than the circle, for the pointer to water.
    if (layout === "corner") this.resize(C.MAP_DIAMETER_TILES + 2, C.MAP_DIAMETER_TILES + 2);
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
      this.cut(this.circle);
      // Top right, on the art grid whatever the margin says, under the clock
      // and the hydration bar. They are centred over it, so they take its
      // left and width, and it goes under wherever they end.
      left = Math.floor((this.view.width - C.MAP_MARGIN_PX - width * perTile) / art) * art;
      const parent = this.canvas.parentElement;
      parent?.style.setProperty("--map-left", `${left}px`);
      parent?.style.setProperty("--map-width", `${width * perTile}px`);
      const above = parent?.querySelector<HTMLElement>(".hud-tr");
      const bottom = above ? above.offsetTop + above.offsetHeight : 0;
      top = Math.ceil((bottom + C.MAP_MARGIN_PX / 2) / art) * art;    } else {
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

  /**
   * Draw the corner's cells out to `radius` tiles from the middle one and no
   * further: the same rule the seen circle is marked by, a cell's offset in
   * whole tiles, so the circle's edge is tiles in or out.
   */
  private cut(radius: number): void {
    this.circle = radius;
    const c = Math.floor(this.width / 2);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.inside[y * this.width + x] = (x - c) ** 2 + (y - c) ** 2 <= radius * radius ? 1 : 0;
      }
    }
    this.dirty = true;
  }

  /** Shrink the corner's circle as the player runs dry: cut it to its radius when that has changed. */
  private applySight(hydration: number): void {
    const radius = minimapRadius(hydration);
    if (radius !== this.circle) this.cut(radius);
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
    // Another world, or a new summer starting at camp: point afresh.
    this.drinkTarget = null;
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
    if (this.layout === "corner") this.applySight(world.stats.hydration);
    if (this.hidden) return;

    // The whole map fades as the player runs dry, all but its landmarks; the
    // corner shrinks instead.
    const brightness = this.layout === "whole" ? dryBrightness(world.stats.hydration) : 1;
    const key = `${px},${py},${world.seenCount},${brightness}`;
    if (key === this.drawnKey && !this.dirty) return;
    this.drawnKey = key;
    this.dirty = false;
    this.draw(world, ox, oy, px - ox, py - oy, brightness);
  }

  private draw(world: World, ox: number, oy: number, playerX: number, playerY: number, brightness: number): void {
    const marks = mapMarks(world);
    const unseen = abgr(C.MAP_COLORS.unseen);
    // A handful of colours on a map, so each is faded once a drawing.
    const faded = new Map<number, number>();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        if (!this.inside[i]) {
          this.pixels[i] = 0;
          continue;
        }
        let colour = tileColour(world, marks, ox + x, oy + y);
        if (colour !== null && brightness < 1 && !isLandmark(world, marks, ox + x, oy + y)) {
          const was = colour;
          colour = faded.get(was) ?? fade(was, brightness);
          faded.set(was, colour);
        }
        this.pixels[i] = colour === null ? unseen : abgr(colour);
      }
    }
    if (this.layout === "corner") {
      // Water the player has seen: every spot within the full circle, even
      // where thirst has cut the circle back, and a pointer on the ring
      // outside it to the nearest one beyond.
      const drink = abgr(C.MAP_COLORS.drink);
      const put = ({ dx, dy }: { dx: number; dy: number }) => {
        this.pixels[(playerY + dy) * this.width + playerX + dx] = drink;
      };
      for (const at of nearDrinks(world, ox + playerX, oy + playerY)) put(at);
      this.drinkTarget = drinkTarget(world, ox + playerX, oy + playerY, this.drinkTarget);
      const pointer = drinkPointer(this.drinkTarget, ox + playerX, oy + playerY);
      if (pointer) put(pointer);
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
