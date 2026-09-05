/**
 * Minifantasy terrain blocks are 15 tiles laid out 3 wide by 5 tall:
 *
 *    0  1  2      the 3x3 gives corners, edges and the solid fill, chosen by
 *    3  4  5      which of the four SIDES continue the same terrain
 *    6  7  8
 *    9 10 11      the last six are inner (concave) corners, used when all four
 *   12 13 14      sides continue but a diagonal does not
 *
 * Decoded from the pixels of the dirt block rather than assumed -- see
 * tests/autotile.test.ts for the table this reproduces.
 */

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const NE = 16;
export const SE = 32;
export const SW = 64;
export const NW = 128;

/** Tile index used when a shape has no representation at all. */
export const FILL = 4;

/**
 * Indices past the 15-tile block, one per shape that block cannot express.
 *
 * The 3x3 covers only the nine side combinations that read as a corner, an edge
 * or the interior of a wide blob. The other seven are narrow: nothing adjacent,
 * a dead end pointing one of four ways, or a one-tile-wide strip. All seven need
 * grass on two opposite sides at once, which no piece of a 3x3 has.
 *
 * A pack that owns art for them maps these indices to it; one that does not
 * points them all at {@link FILL}, which is what the whole set used to do.
 */
export const NARROW_NONE = 15;
export const NARROW_N = 16;
export const NARROW_E = 17;
export const NARROW_S = 18;
export const NARROW_W = 19;
export const NARROW_NS = 20;
export const NARROW_EW = 21;

/** Total indices `autotileIndex` can return, narrow shapes included. */
export const TILE_COUNT = 22;

/** The seven narrow shapes, keyed by side bits, in NARROW_* order. */
const NARROW: ReadonlyMap<number, number> = new Map([
  [0, NARROW_NONE],
  [N, NARROW_N],
  [E, NARROW_E],
  [S, NARROW_S],
  [W, NARROW_W],
  [N | S, NARROW_NS],
  [E | W, NARROW_EW],
]);

/**
 * Map an 8-neighbour connectivity mask to a tile index.
 *
 * Returns 0-14 for the shapes the 15-tile block covers and a NARROW_* index for
 * the seven it does not; see {@link NARROW_NONE}.
 */
export function autotileIndex(mask: number): number {
  const n = (mask & N) !== 0;
  const e = (mask & E) !== 0;
  const s = (mask & S) !== 0;
  const w = (mask & W) !== 0;

  if (n && e && s && w) {
    const nw = (mask & NW) !== 0;
    const ne = (mask & NE) !== 0;
    const sw = (mask & SW) !== 0;
    const se = (mask & SE) !== 0;
    if (nw && ne && sw && se) return FILL;
    if (!nw && !se && ne && sw) return 11; // both corners on one diagonal
    if (!ne && !sw && nw && se) return 14; // both corners on the other
    if (!nw) return 9;
    if (!ne) return 10;
    if (!sw) return 12;
    if (!se) return 13;
    return FILL;
  }

  if (!n && e && s && !w) return 0;
  if (!n && e && s && w) return 1;
  if (!n && !e && s && w) return 2;
  if (n && e && s && !w) return 3;
  if (n && !e && s && w) return 5;
  if (n && e && !s && !w) return 6;
  if (n && e && !s && w) return 7;
  if (n && !e && !s && w) return 8;

  return NARROW.get(mask & (N | E | S | W))!;
}
