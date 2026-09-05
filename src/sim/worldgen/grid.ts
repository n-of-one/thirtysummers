/**
 * Index arithmetic for the flat arrays worldgen works in.
 *
 * Reachability masks, flood-fill queues and visited sets are all `y * width + x`
 * typed arrays rather than a grid of objects, because a 128x128 map is 16k
 * entries and worldgen walks them repeatedly. The arithmetic that goes with that
 * choice was written out at every use, ten times over, which is ten chances to
 * transpose an axis. It lives here instead.
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly size: number;

  // Plain fields, not constructor parameter properties: everything under
  // src/sim/ has to run under bare `node --experimental-strip-types`, which
  // strips types without rewriting code and so cannot synthesise the
  // assignments a parameter property implies. `npm run map` is what breaks.
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = width * height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  xOf(index: number): number {
    return index % this.width;
  }

  yOf(index: number): number {
    return (index - (index % this.width)) / this.width;
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
}

/**
 * The four orthogonal neighbours, as [dx, dy].
 *
 * Every flood fill here moves orthogonally: a diagonal step between two
 * impassable tiles touching at a corner would walk through a wall, so "can I get
 * there" has to mean the same thing as "can I walk there".
 */
export const NEIGHBOURS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
