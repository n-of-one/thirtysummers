import * as C from "../config.ts";

/**
 * Hydration, the one bar.
 *
 * It drains at a constant rate whatever the player does and is refilled to
 * full at a spring. Running dry costs the view and nothing else: the fog is
 * drawn from it. No DOM, no renderer: a whole summer can be simulated in a test
 * and the numbers checked exactly.
 */
export class Stats {
  /** A percentage, 0 to 100. */
  hydration = C.HYDRATION_MAX;

  /** Fill the bar for the start of a summer. */
  startSummer(): void {
    this.hydration = C.HYDRATION_MAX;
  }

  /** Drink your fill. */
  drink(): void {
    this.hydration = C.HYDRATION_MAX;
  }

  /** Advance by exactly `dt` seconds. */
  step(dt: number): void {
    this.hydration = Math.max(0, this.hydration - C.HYDRATION_DRAIN * dt);
  }
}

/**
 * How far the player can see before the dark begins, in tiles.
 *
 * The view is always ringed. Fog is the only cost of running dry, so it has to
 * be felt: the widest circle down to the threshold, then one that shrinks
 * linearly to a few tiles at zero. The HUD draws the fog from it, and the map
 * marks what is seen from it, so the two cannot disagree.
 */
export function sightRadiusTiles(hydration: number): number {
  const share = Math.min(Math.max(hydration, 0) / C.HYDRATION_FOG_THRESHOLD, 1);
  return C.FOG_MIN_RADIUS_TILES + (C.FOG_MAX_RADIUS_TILES - C.FOG_MIN_RADIUS_TILES) * share;
}

/** How far round the player a tile counts as seen, for the map: past the clear circle, into the fade. */
export function seenRadiusTiles(hydration: number): number {
  return sightRadiusTiles(hydration) * C.SEEN_RADIUS_MUL;
}
