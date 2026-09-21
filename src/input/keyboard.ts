import { DROP_KEY, DROP_SWITCH_KEY } from "../config.ts";

/** What the simulation needs to know about the controls this tick. */
export interface InputState {
  /** Desired direction, already normalised so diagonals are not faster. */
  moveX: number;
  moveY: number;
  /**
   * Held to harvest, drink, cut and build; tapped to bank at camp, and held
   * there to open the transfer panel.
   */
  interact: boolean;
  /** Throws every item of the selected kind on the ground. One shot per press. */
  drop: boolean;
  /** Moves the selection on to the next kind in the pack. One shot per press. */
  dropSwitch: boolean;
}

/** Nothing held. Spread it to build an input in a test. */
export const NO_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  interact: false,
  drop: false,
  dropSwitch: false,
};

const LEFT = ["a", "arrowleft"];
const RIGHT = ["d", "arrowright"];
const UP = ["w", "arrowup"];
const DOWN = ["s", "arrowdown"];
const INTERACT = ["e", " "];
const DROP = [DROP_KEY];
const DROP_SWITCH = [DROP_SWITCH_KEY];

/**
 * Is this event headed for something the user is typing or clicking in?
 *
 * Exported because the debug overlay's own shortcuts need the same exemption:
 * a backtick typed into the seed box is a character, not a command.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "BUTTON" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

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
    // Typing a seed into the debug panel is not walking north-east. Key events
    // bubble to the window, so the controls have to be excused explicitly.
    if (isTypingTarget(e.target)) return;
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
      interact: this.any(INTERACT),
      drop: this.any(DROP),
      dropSwitch: this.any(DROP_SWITCH),
    };
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
  }
}
