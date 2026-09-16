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
