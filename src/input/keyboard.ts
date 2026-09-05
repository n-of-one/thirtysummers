/** What the simulation needs to know about the controls this tick. */
export interface InputState {
  /** Desired direction, already normalised so diagonals are not faster. */
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** Held to harvest, tapped to drop ore off at camp. */
  interact: boolean;
  eat: boolean;
  drink: boolean;
}

/** Nothing held. Spread it to build an input in a test. */
export const NO_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  sprint: false,
  interact: false,
  eat: false,
  drink: false,
};

const LEFT = ["a", "arrowleft"];
const RIGHT = ["d", "arrowright"];
const UP = ["w", "arrowup"];
const DOWN = ["s", "arrowdown"];
const INTERACT = ["e", " "];
const EAT = ["f"];
const DRINK = ["r"];

/**
 * Tracks which keys are down and reports a direction.
 *
 * Reading state rather than reacting to events keeps input in step with the
 * fixed-timestep loop: a tick asks "what is held now", so a slow frame cannot
 * lose or double-apply a keypress.
 */
export class Keyboard {
  private readonly held = new Set<string>();

  constructor(private readonly target: EventTarget = window) {
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    // Releasing focus mid-stride would otherwise leave the player walking.
    this.target.addEventListener("blur", this.onBlur);
  }

  private readonly onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    this.held.add(e.key.toLowerCase());
    if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
  };

  private readonly onKeyUp = (event: Event): void => {
    this.held.delete((event as KeyboardEvent).key.toLowerCase());
  };

  private readonly onBlur = (): void => {
    this.held.clear();
  };

  private any(keys: readonly string[]): boolean {
    return keys.some((k) => this.held.has(k));
  }

  state(): InputState {
    let moveX = (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
    let moveY = (this.any(DOWN) ? 1 : 0) - (this.any(UP) ? 1 : 0);
    if (moveX !== 0 && moveY !== 0) {
      const inv = Math.SQRT1_2;
      moveX *= inv;
      moveY *= inv;
    }
    return {
      moveX,
      moveY,
      sprint: this.held.has("shift"),
      interact: this.any(INTERACT),
      eat: this.any(EAT),
      drink: this.any(DRINK),
    };
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
  }
}
