import { MAX_FRAME_SEC, TICK_SEC } from "./config.ts";

/** What one rendered frame turns into: real time to draw with, and ticks to run. */
export interface Frame {
  /** Seconds this frame covers, after clamping. Use this for anything smooth. */
  readonly frameSec: number;
  /** Whole fixed steps accrued. Run the simulation exactly this many times. */
  readonly steps: number;
}

/**
 * Turns real elapsed time into whole simulation ticks.
 *
 * The simulation advances in fixed steps so that per-second rates -- stamina,
 * hydration, movement -- come out identical whatever the frame rate. Frames do
 * not arrive in whole ticks, so the remainder is carried to the next frame and
 * the leftover fraction is never lost or double-counted.
 *
 * A frame is clamped before it is accumulated. Without that, a tab left in the
 * background comes back with a frame worth minutes, asks for thousands of steps
 * at once, takes longer than a frame to run them, and accrues more time than it
 * just spent -- so it never catches up. Clamping drops that time on the floor,
 * which is the right trade: the world falls behind the wall clock, and stays
 * responsive.
 *
 * Pure, so a stall can be tested without a browser.
 */
export class FrameClock {
  /** Simulation time owed but not yet stepped. Always less than one tick. */
  private accumulator = 0;

  constructor(
    private readonly tickSec: number = TICK_SEC,
    private readonly maxFrameSec: number = MAX_FRAME_SEC,
  ) {}

  /** Account for a rendered frame of `rawFrameSec` real seconds. */
  tick(rawFrameSec: number): Frame {
    const frameSec = Math.min(Math.max(rawFrameSec, 0), this.maxFrameSec);
    this.accumulator += frameSec;
    let steps = 0;
    while (this.accumulator >= this.tickSec) {
      this.accumulator -= this.tickSec;
      steps++;
    }
    return { frameSec, steps };
  }

  /** Simulation time carried into the next frame. Between 0 and one tick. */
  get pending(): number {
    return this.accumulator;
  }
}
