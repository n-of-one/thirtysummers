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

/** Tile index used when a shape has no representation in a 15-tile set. */
export const FILL = 4;

/**
 * Map an 8-neighbour connectivity mask to a tile index in the block.
 *
 * A 15-tile set cannot express narrow shapes -- an isolated tile, a dead end,
 * or a one-tile-wide strip -- because those need edges on opposite sides at
 * once. Those fall back to the solid fill, which reads better than an
 * arbitrary edge piece pointing the wrong way.
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

  return FILL;
}
