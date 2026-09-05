import * as C from "../config.ts";

/**
 * What the player is doing this tick, as far as stamina is concerned.
 *
 * The design doc gives four rates, one per situation, and does not say what
 * happens when two apply at once. They are treated as exclusive and resolved by
 * this order: sprinting beats difficult ground, which beats easy ground, which
 * beats standing. So sprinting through mud costs the sprint rate, not the sum
 * of both -- adding them would invent a number the doc never gives.
 */
export type Effort = "sprinting" | "difficult" | "walking" | "standing";

/**
 * Percentage points per second for each effort, straight from the doc.
 *
 * Only standing still cares about hydration: resting recovers at the full rate
 * while you are watered and at half that once you are not, which is the whole
 * of what hydration does. Nothing else is gated on it, and running dry has no
 * separate penalty of its own.
 */
function baseStaminaRate(effort: Effort, parched: boolean): number {
  switch (effort) {
    case "sprinting":
      return C.STAMINA_SPRINT;
    case "difficult":
      return C.STAMINA_DIFFICULT;
    case "walking":
      return C.STAMINA_WALK_EASY;
    case "standing":
      return parched ? C.STAMINA_STAND_PARCHED : C.STAMINA_STAND_HYDRATED;
  }
}

const clamp = (v: number): number => Math.min(Math.max(v, 0), C.STAT_MAX);

/**
 * Stamina, hydration, and the full-stomach cooldown.
 *
 * Everything here is a percentage in [0, 100] moving at a per-second rate, and
 * every rate lives in config.ts. No DOM, no renderer: a whole day can be
 * simulated in a test and the numbers checked exactly.
 */
export class Stats {
  stamina = C.STAT_MAX;
  hydration = C.STAT_MAX;
  /** Seconds left of the full-stomach cooldown. Zero means you may eat. */
  stomachCooldownSec = 0;

  /**
   * While set, {@link step} does nothing: stamina, hydration and the stomach
   * all hold where they are. Only the debug overlay sets it, and it is here
   * rather than in the overlay so that "the numbers stopped moving" is one
   * flag the simulation owns, not a rate the renderer reaches in and rewrites.
   *
   * Eating and drinking still take effect, so the freeze is a way to hold a
   * state still and poke at it rather than a way to switch the stats off.
   */
  frozen = false;

  /** Out of stamina. Walking still works; sprinting does not. */
  get exhausted(): boolean {
    return this.stamina <= 0;
  }

  /** Not watered enough to rest at the full rate. Exactly 50% counts as parched. */
  get parched(): boolean {
    return this.hydration <= C.HYDRATION_LOW_THRESHOLD;
  }

  /** Sprinting needs a little in the tank, so exhaustion is not a one-tick state. */
  get canSprint(): boolean {
    return this.stamina > C.SPRINT_MIN_STAMINA;
  }

  get canEat(): boolean {
    return this.stomachCooldownSec <= 0;
  }

  /**
   * Advance by exactly `dt` seconds.
   *
   * Hydration is read before it is drained, so crossing 50% takes effect from
   * the next tick rather than partway through this one. At a 1/60s step that is
   * worth eight thousandths of a stamina point, and reading one consistent
   * hydration value for the whole tick is worth more than chasing it.
   *
   * Does nothing at all while {@link frozen}.
   */
  step(dt: number, effort: Effort): void {
    if (this.frozen) return;
    const rate = baseStaminaRate(effort, this.parched);
    this.stamina = clamp(this.stamina + rate * dt);
    this.hydration = clamp(this.hydration - C.HYDRATION_DRAIN * dt);
    this.stomachCooldownSec = Math.max(0, this.stomachCooldownSec - dt);
  }

  /**
   * Eat a piece of fruit. Refuses, and reports false, while the stomach is
   * full, so the caller can leave the fruit in the backpack.
   */
  eat(): boolean {
    if (!this.canEat) return false;
    this.stamina = clamp(this.stamina + C.FRUIT_STAMINA);
    this.stomachCooldownSec = C.FULL_STOMACH_SEC;
    return true;
  }

  /** Drink. Water has no cooldown, so this always takes. */
  drink(): void {
    this.hydration = clamp(this.hydration + C.WATER_HYDRATION);
  }
}
