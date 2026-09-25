/**
 * What the family has seen: one byte a tile, 1 once it has been inside the
 * seen circle round the player in any summer. The map in the corner draws it,
 * and M10.7 picks camp sites off it.
 *
 * The circle is centred on the player's tile, not on the player, so what is
 * seen changes only when the tile does, and a walk can be checked against it
 * exactly: a tile is seen when its centre is within the radius of the centre
 * of the tile the player stands on.
 */

/**
 * Set every tile of `mask` whose centre is within `radius` of tile (tx, ty),
 * clipped to the map. Returns how many were not set before.
 */
export function markCircle(
  mask: Uint8Array,
  width: number,
  height: number,
  tx: number,
  ty: number,
  radius: number,
): number {
  const r = Math.floor(radius);
  const r2 = radius * radius;
  let added = 0;
  for (let dy = -r; dy <= r; dy++) {
    const y = ty + dy;
    if (y < 0 || y >= height) continue;
    const span = Math.floor(Math.sqrt(r2 - dy * dy));
    const x0 = Math.max(0, tx - span);
    const x1 = Math.min(width - 1, tx + span);
    for (let i = y * width + x0, end = y * width + x1; i <= end; i++) {
      if (mask[i] === 0) {
        mask[i] = 1;
        added++;
      }
    }
  }
  return added;
}

/**
 * The mask as run lengths, alternating unseen and seen and starting with an
 * unseen run, which is 0 when the first tile is seen. Most of the mask is
 * blank early in a life and most of it is set late, so either way it is a
 * short list where a tile list would not be.
 */
export function packSeen(mask: Uint8Array): number[] {
  const runs: number[] = [];
  let value = 0;
  let run = 0;
  for (const bit of mask) {
    if ((bit !== 0 ? 1 : 0) === value) {
      run++;
    } else {
      runs.push(run);
      value = 1 - value;
      run = 1;
    }
  }
  runs.push(run);
  return runs;
}

/** Fill `mask` back in from {@link packSeen}'s runs. Returns how many tiles are set. */
export function unpackSeen(runs: readonly number[], mask: Uint8Array): number {
  let i = 0;
  let count = 0;
  runs.forEach((run, n) => {
    const value = n % 2;
    const end = Math.min(i + run, mask.length);
    mask.fill(value, i, end);
    if (value) count += end - i;
    i = end;
  });
  mask.fill(0, i);
  return count;
}
