import type { ResourceKind } from "../../sim/types.ts";
import {
  COIN_COLORS,
  COIN_PIXELS,
  FEATHER_COLORS,
  FEATHER_PIXELS,
  RESOURCE_CELL,
  SHEETS,
  T,
  WELL_CELL,
  type SheetName,
} from "./minifantasy.sheets.ts";

/**
 * The same art the map is drawn with, cut out for the HUD.
 *
 * The HUD is HTML, not Pixi, so it cannot hold a texture: what it needs is a
 * picture it can put in an `<img>`. This cuts the cells out with a 2D canvas
 * and hands back data URLs -- no renderer, no Pixi, and nothing outside this
 * folder learns which art pack is on disk, which is the rule the rest of
 * `packs/` keeps.
 *
 * Without the licensed art it falls back to a flat chip in the kind's own
 * colour, so a fresh clone still shows a row per kind rather than a gap.
 */

export type IconName = ResourceKind | "well" | "gold";

export interface Icons {
  /** `minifantasy` or `flat`, so a screenshot can say which it drew. */
  readonly id: string;
  /** A data URL for one icon, ready for an `<img>`. */
  url(name: IconName): string;
}

/** Where each icon is cut from: sheet, tile x, tile y, tiles across, tiles down. */
type Cell = readonly [SheetName, number, number, number, number];

const cell = ([sheet, x, y]: readonly [SheetName, number, number]): Cell => [sheet, x, y, 1, 1];

const CELLS: Partial<Record<IconName, Cell>> = {
  fruit: cell(RESOURCE_CELL.fruit),
  stick: cell(RESOURCE_CELL.stick),
  vine: cell(RESOURCE_CELL.vine),
  ore: cell(RESOURCE_CELL.ore),
  log: cell(RESOURCE_CELL.log),
  shell: cell(RESOURCE_CELL.shell),
  // A well is one tile wide and two tall, the only icon that is not square.
  well: WELL_CELL,
};

/**
 * What each icon is drawn as when the art is not on disk. Not an attempt at
 * the sprite: one colour, so the rows are still told apart at a glance.
 */
const FLAT: Record<IconName, string> = {
  fruit: "#c0392b",
  feather: "#f4f2e8",
  stick: "#c4baa0",
  vine: "#6f9c3a",
  ore: "#e8e0c8",
  log: "#805719",
  shell: "#bcd4dc",
  well: "#4d8fb0",
  gold: "#e8b43c",
};

const NAMES = Object.keys(FLAT) as IconName[];

/**
 * Cut every icon out of the art, at `scale` screen pixels per art pixel.
 *
 * 4 is the scale the world is drawn at, so an icon beside a row of text is the
 * same size as the thing standing in the field.
 */
export async function loadIcons(scale = 4): Promise<Icons> {
  const sheets = await loadSheets();
  const urls = Object.fromEntries(
    NAMES.map((name) => [name, draw(name, sheets, scale)]),
  ) as Record<IconName, string>;
  return { id: sheets ? "minifantasy" : "flat", url: (name) => urls[name] };
}

/** Every sheet an icon is cut from, or null when the art is not there. */
async function loadSheets(): Promise<Record<SheetName, HTMLImageElement> | null> {
  const wanted = [...new Set(Object.values(CELLS).map(([sheet]) => sheet))];
  try {
    const loaded = await Promise.all(wanted.map((name) => image(SHEETS[name])));
    return Object.fromEntries(wanted.map((name, i) => [name, loaded[i]!])) as Record<
      SheetName,
      HTMLImageElement
    >;
  } catch {
    return null;
  }
}

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no sheet: ${src}`));
    img.src = src;
  });
}

function draw(
  name: IconName,
  sheets: Record<SheetName, HTMLImageElement> | null,
  scale: number,
): string {
  // Two are drawn from pixels in every pack, because no pack has either: the
  // feather, and the coin the money is counted in.
  if (name === "feather") return fromPixels(FEATHER_PIXELS, FEATHER_COLORS, scale);
  if (name === "gold") return fromPixels(COIN_PIXELS, COIN_COLORS, scale);
  const spec = CELLS[name];
  if (!sheets || !spec) return flat(FLAT[name], scale);

  const [sheet, x, y, w, h] = spec;
  const canvas = surface(w * T * scale, h * T * scale);
  const ctx = context(canvas);
  ctx.drawImage(
    sheets[sheet],
    x * T,
    y * T,
    w * T,
    h * T,
    0,
    0,
    w * T * scale,
    h * T * scale,
  );
  return canvas.toDataURL();
}

/** An icon painted a pixel at a time, from a table of character rows. */
function fromPixels(
  rows: readonly string[],
  colors: Readonly<Record<string, readonly [number, number, number]>>,
  scale: number,
): string {
  const canvas = surface(rows[0]!.length * scale, rows.length * scale);
  const ctx = context(canvas);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const rgb = colors[ch];
      if (!rgb) return;
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas.toDataURL();
}

/** One flat chip, for when the art is not on disk. */
function flat(color: string, scale: number): string {
  const canvas = surface(T * scale, T * scale);
  const ctx = context(canvas);
  ctx.fillStyle = color;
  ctx.fillRect(scale, scale, (T - 2) * scale, (T - 2) * scale);
  return canvas.toDataURL();
}

function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Nearest neighbour, always: a smoothed pixel icon is a blurred one. */
function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
