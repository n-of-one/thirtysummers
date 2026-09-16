import { isTypingTarget } from "./keyboard.ts";

const PAUSE_KEYS = ["p", "P"];

/** Keys that are only ever half of a key press, and so do not resume. */
const MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock"];

/**
 * Pausing: `P` pauses, and the window losing focus pauses too, since a
 * five-minute clock and a doorbell do not mix. Any key resumes.
 *
 * Coming back to the window resumes nothing, because returning to it is not the
 * same as being ready to play; a key press is. The frame loop reads
 * {@link paused} each frame; the card is shown and hidden here.
 */
export class Pause {
  paused = false;

  constructor(
    private readonly card: HTMLElement,
    private readonly target: EventTarget = window,
    /** Whether a toggle is allowed right now; the summary card turns it off. */
    private readonly allowed: () => boolean = () => true,
  ) {
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("blur", this.onBlur);
    this.card.hidden = true;
  }

  set(paused: boolean): void {
    if (paused && !this.allowed()) return;
    this.paused = paused;
    this.card.hidden = !paused;
  }

  private readonly onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.repeat || isTypingTarget(e.target) || MODIFIER_KEYS.includes(e.key)) return;
    if (this.paused) {
      this.set(false);
      // The key that resumes does nothing else: Q pressed to carry on at camp
      // must not also end the summer. Listeners added after this one, which is
      // the summer key and the debug panel, never see it. A movement key is
      // still held once the game runs again, which is carrying on.
      e.stopImmediatePropagation();
      return;
    }
    if (PAUSE_KEYS.includes(e.key)) this.set(true);
  };

  private readonly onBlur = (): void => {
    this.set(true);
  };

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("blur", this.onBlur);
  }
}
