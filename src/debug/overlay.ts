import * as C from "../config.ts";
import { isTypingTarget } from "../input/keyboard.ts";
import type { Camera } from "../render/camera.ts";
import type { Facing, TerrainKind } from "../sim/types.ts";
import { formatClock, need } from "../ui/hud.ts";
/**
 * Where to put the one-tile grid background so its lines land on real tile
 * boundaries.
 *
 * The grid is a single tile-sized background image repeated across the screen,
 * so the whole of scrolling it is this offset: the sub-tile fraction of the
 * camera, pulled back to the nearest boundary behind it. JavaScript's `%` keeps
 * the sign of the left operand, and a camera can sit at a negative pixel when
 * the map is narrower than the view, hence the second modulo.
 */
export function gridOffset(cameraPx: number, tile: number = C.TILE): number {
  const into = ((cameraPx % tile) + tile) % tile;
  // Negated only when there is something to negate: `-0` would reach the style
  // sheet as "-0px", which is legal but reads as a bug in a devtools panel.
  return into === 0 ? 0 : -into;
}

/** How long a note about a refused click stays up, in milliseconds. */
const NOTE_MS = 1400;

/** Opens and closes the panel. Works whether or not the panel is up. */
const TOGGLE_KEYS = ["`", "~"];
/** Step the seed one down or one up, and regenerate on the spot. */
const SEED_DOWN_KEYS = ["[", "{", ","];
const SEED_UP_KEYS = ["]", "}", "."];

/**
 * Everything the readout says, before it is written as a line.
 *
 * Taking it as plain values rather than reaching into the world keeps the
 * formatting testable, and keeps the overlay from being a second place that
 * knows how a `World` is put together.
 */
export interface Readout {
  x: number;
  y: number;
  facing: Facing;
  terrain: TerrainKind;
  /** Tiles per second. */
  speed: number;
  hydration: number;
  elapsedSec: number;
  seed: number;
  pack: string;
  fps: number;
}

/**
 * Column widths for the readout, in characters.
 *
 * Every one is the longest that field can ever be: three digits for a
 * coordinate on a 128-tile map, `underbrush` for a terrain name, `900.0` for a
 * summer. Numbers are padded on the left and words on the right, so each field
 * keeps its column and the line stays exactly as long from one frame to the
 * next. Without that, the panel resizes under the cursor every time a
 * coordinate passes 80.0 on its way to 80.01.
 */
const W = {
  coord: 6,
  facing: 9,
  terrain: 10,
  speed: 5,
  stat: 6,
  elapsed: 5,
  fps: 3,
} as const;

/**
 * The space the readout pads and labels with.
 *
 * A non-breaking one, so a line that has to wrap can only break between fields
 * and never between a label and its number. Monospace gives it the same advance
 * as an ordinary space, so the columns still line up.
 */
const NBSP = "\u00a0";

const num = (value: number, width: number, places: number): string =>
  value.toFixed(places).padStart(width, NBSP);

/**
 * The readout as one fixed-width line.
 *
 * The seed and the pack name are the two fields that are not padded, and they
 * are last: both only change when a world is rebuilt, so nothing that moves
 * every frame can shift a column.
 */
export function formatReadout(r: Readout): string {
  return [
    `pos${NBSP}${num(r.x, W.coord, 2)},${num(r.y, W.coord, 2)}`,
    r.facing.padEnd(W.facing, NBSP),
    `on${NBSP}${r.terrain.padEnd(W.terrain, NBSP)}`,
    `${num(r.speed, W.speed, 2)}${NBSP}tiles/s`,
    `hyd${NBSP}${num(r.hydration, W.stat, 2)}`,
    `t${NBSP}${num(r.elapsedSec, W.elapsed, 1)}`,
    `${num(r.fps, W.fps, 0)}fps`,
    `seed${NBSP}${r.seed}`,
    `pack${NBSP}${r.pack}`,
  ].join("  ");
}

/** What the overlay needs from the rest of the program to do its job. */
export interface DebugOptions {
  /** Seed the world on screen was built from. Fills the seed box. */
  seed: number;
  /** Throw the summer away and build a new one on this seed. */
  regenerate(seed: number): void;
  /**
   * Put the player at this point on the canvas, in CSS pixels from its
   * top-left. False means nothing can stand there, and the overlay says so.
   */
  teleport(screenX: number, screenY: number): boolean;
  /** The canvas host. Clicks on it teleport; clicks on the panel do not. */
  clickTarget: HTMLElement;
  /** Set hydration to this, for looking at what running dry does without waiting for it. */
  setHydration?(hydration: number): void;
  /** Start with the panel up. `?debug=1` does; otherwise the key opens it. */
  open?: boolean;
  root?: ParentNode;
  /** Where the shortcut keys are listened for. The window, outside a test. */
  keyTarget?: EventTarget;
}

/**
 * The developer's half of the screen: seed, speed, grid, freeze, teleport.
 *
 * Two of the four controls are read rather than pushed. Time scale and the
 * freeze are left as fields for the frame loop to pick up, because they are
 * states rather than events, and reading them each frame means a world built
 * after the box was ticked is frozen too -- with a callback, a regenerate would
 * quietly thaw it. Regenerating and teleporting are events and stay callbacks.
 *
 * The panel is always built and starts hidden unless `?debug=1` asked for it;
 * a backtick opens and closes it. Nothing in the game reads the overlay, so a
 * summer plays exactly the same whether it has ever been opened.
 */
export class DebugOverlay {
  /** Simulated seconds per real second. The frame loop reads this. */
  timeScale = C.TIME_SCALE_MIN;
  /** Hold hydration and the clock where they are. The frame loop reads this too. */
  frozen = false;
  /** Draw the map in the corner. Off only to measure what it costs; the frame loop reads it. */
  mapShown = true;
  /** Is the panel up? Closing it hides the panel, not what it was set to. */
  open = false;

  private readonly panel: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly seedInput: HTMLInputElement;
  private readonly speed: HTMLInputElement;
  private readonly speedValue: HTMLElement;
  private readonly gridToggle: HTMLInputElement;
  private readonly freezeToggle: HTMLInputElement;
  private readonly hydration: HTMLInputElement;
  private readonly hydrationValue: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly hintText: string;
  private readonly keyTarget: EventTarget;
  private noteTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: DebugOptions) {
    const root = options.root ?? document;
    this.panel = need(root, "#debug");
    this.grid = need(root, "#grid");
    this.readout = need(root, "#debug-readout");
    this.seedInput = need(root, "#debug-seed");
    this.speed = need(root, "#debug-speed");
    this.speedValue = need(root, "#debug-speed-value");
    this.gridToggle = need(root, "#debug-grid");
    this.freezeToggle = need(root, "#debug-freeze");
    this.hint = need(root, ".debug-hint");
    this.hintText = this.hint.textContent ?? "";

    this.keyTarget = options.keyTarget ?? window;
    this.setOpen(options.open ?? false);
    this.grid.style.backgroundSize = `${C.TILE}px ${C.TILE}px`;

    this.seedInput.value = String(options.seed);
    this.speed.min = String(C.TIME_SCALE_MIN);
    this.speed.max = String(C.TIME_SCALE_MAX);
    this.speed.step = String(C.TIME_SCALE_STEP);
    this.speed.value = String(this.timeScale);
    this.showSpeed();

    need<HTMLButtonElement>(root, "#debug-regen").addEventListener("click", () => this.regenerate());
    this.seedInput.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter") this.regenerate();
    });
    this.speed.addEventListener("input", () => {
      this.timeScale = Number(this.speed.value);
      this.showSpeed();
    });
    this.gridToggle.addEventListener("change", () => {
      this.grid.hidden = !this.gridToggle.checked;
    });
    this.freezeToggle.addEventListener("change", () => {
      this.frozen = this.freezeToggle.checked;
    });
    const mapToggle = need<HTMLInputElement>(root, "#debug-map");
    mapToggle.addEventListener("change", () => {
      this.mapShown = mapToggle.checked;
    });
    this.hydration = need(root, "#debug-hydration");
    this.hydrationValue = need(root, "#debug-hydration-value");
    this.hydration.addEventListener("input", () => {
      options.setHydration?.(Number(this.hydration.value));
    });
    this.hydration.addEventListener("change", () => this.hydration.blur());
    options.clickTarget.addEventListener("click", this.onClick);
    this.keyTarget.addEventListener("keydown", this.onKeyDown);
  }

  /** Show or hide the panel. The grid, the speed and the freeze keep their state. */
  setOpen(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
  }

  /**
   * Draw the grid where the camera is, and write the readout line.
   *
   * The readout comes as a thunk rather than a string: with the panel closed
   * nobody can see it, and building the line every frame for nobody is the one
   * cost the overlay would otherwise charge a normal summer.
   */
  update(camera: Camera, readout: () => string, hydration = 0): void {
    if (!this.grid.hidden) {
      this.grid.style.backgroundPosition =
        `${gridOffset(camera.leftPx)}px ${gridOffset(camera.topPx)}px`;
    }
    if (!this.open) return;
    const line = readout();
    if (this.readout.textContent !== line) this.readout.textContent = line;
    // The slider follows hydration as it drains, except while it is held.
    const value = String(Math.round(hydration));
    if (document.activeElement !== this.hydration && this.hydration.value !== value) this.hydration.value = value;
    if (this.hydrationValue.textContent !== value) this.hydrationValue.textContent = value;
  }

  /** Show the seed a world was actually built from, after a regenerate. */
  setSeed(seed: number): void {
    this.seedInput.value = String(seed);
  }

  dispose(): void {
    this.options.clickTarget.removeEventListener("click", this.onClick);
    this.keyTarget.removeEventListener("keydown", this.onKeyDown);
    clearTimeout(this.noteTimer);
  }

  /**
   * The panel's shortcuts.
   *
   * Only the toggle works while the panel is down -- a stray bracket in the
   * middle of a summer should not rebuild the world you are standing in. Keys
   * aimed at the seed box are left alone, so it can be typed into and stepped
   * with its own arrows.
   */
  private readonly onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    const typing = isTypingTarget(e.target);
    if (TOGGLE_KEYS.includes(e.key) && !typing) {
      e.preventDefault();
      this.setOpen(!this.open);
      return;
    }
    if (!this.open) return;
    // Escape belongs to the game -- it closes the transfer panel and the build
    // menu -- so it never closes this one. Only the toggle does. It still lets
    // go of the seed box, so the keys go back to the player.
    if (e.key === "Escape") {
      if (typing && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return;
    }
    if (typing) return;
    if (SEED_UP_KEYS.includes(e.key)) this.stepSeed(1);
    else if (SEED_DOWN_KEYS.includes(e.key)) this.stepSeed(-1);
  };

  /**
   * Walk to the neighbouring seed and build it.
   *
   * Stepping and regenerating in one keystroke is the point: flipping through
   * seeds is how you find out whether a worldgen change holds up on more than
   * the one map you have been staring at.
   */
  private stepSeed(delta: number): void {
    const current = Number(this.seedInput.value.trim());
    const from = Number.isFinite(current) ? Math.trunc(current) : C.DEFAULT_SEED;
    this.seedInput.value = String(from + delta);
    this.regenerate();
  }

  /**
   * Teleport to the click, measured against the canvas rather than the page, so
   * a canvas that is not at the window's origin still lands in the right place.
   * Ignored while the panel is closed.
   */
  private readonly onClick = (event: Event): void => {
    // Only while the panel is up: with it closed a click on the world is just a
    // click on the world.
    if (!this.open) return;
    const { clientX, clientY } = event as MouseEvent;
    const box = this.options.clickTarget.getBoundingClientRect();
    if (!this.options.teleport(clientX - box.left, clientY - box.top)) {
      this.note("nothing to stand on there");
    }
  };

  private regenerate(): void {
    const typed = this.seedInput.value.trim();
    const seed = Number(typed);
    // An empty or unusable box says so rather than generating a world from 0 or
    // from NaN, neither of which is the seed anybody meant.
    if (typed === "" || !Number.isFinite(seed)) {
      this.note("that is not a seed");
      return;
    }
    this.options.regenerate(Math.trunc(seed));
    // Hand the keyboard back to the game. Left focused, the button eats the
    // next space bar as another regenerate and the box eats every letter.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  /** Both what the slider is set to and what it costs: a summer at that speed. */
  private showSpeed(): void {
    this.speedValue.textContent =
      `x${this.timeScale.toFixed(1)} ${formatClock(C.SUMMER_LENGTH_SEC / this.timeScale)}`;
  }

  /** Say something in place of the hint, and put the hint back afterwards. */
  private note(text: string): void {
    this.hint.textContent = text;
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      this.hint.textContent = this.hintText;
    }, NOTE_MS);
  }
}
