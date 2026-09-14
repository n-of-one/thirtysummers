import * as C from "../config.ts";
import type { SummerSummary } from "../sim/summary.ts";
import type { Inventory } from "../sim/inventory.ts";
import {
  RESOURCE_KINDS,
  type BlockedReason,
  type ResourceKind,
  type Vec2,
  type WorldEvent,
} from "../sim/types.ts";
import { BRIDGE_COST, type Action, type World } from "../sim/world.ts";

/**
 * Everything the HUD draws, as plain numbers.
 *
 * Pulling this out of the DOM writing has two uses: it is the only part worth
 * testing, and it keeps the one-way rule honest -- the HUD reads simulation
 * state through here and has no way to write back.
 */
export interface HudModel {
  /** Percentages, 0-100. */
  stamina: number;
  hydration: number;
  /** Colour the bar as a warning. */
  staminaWarn: boolean;
  /** Hydration is low enough that resting recovers stamina at half speed. */
  hydrationWarn: boolean;
  /** Seconds of full stomach left; 0 means the readout is hidden. */
  stomachCooldownSec: number;
  carried: number;
  /** What is in the pack, spelled out: "fruit 3, water 1, ore 5". */
  contents: string;
  capacity: number;
  gold: number;
  /** Carrying fruit, so the key that eats it is worth spelling out. */
  holdingFruit: boolean;
  /** Same for water and the key that drinks it. */
  holdingWater: boolean;
  secondsLeft: number;
  urgent: boolean;
  /** Which summer this is, counting from 1. */
  year: number;
  /** What the interact key would do here, or null for nothing in reach. */
  prompt: Prompt | null;
}

export interface Prompt {
  text: string;
  /** How far through the hold, 0 to 1. Zero for anything that is not a hold. */
  progress: number;
  /** The right action here, but not possible: a full pack, or nothing to build with. */
  blocked: boolean;
}

/** How each resource is referred to in a prompt or a toast. */
const RESOURCE_NAME: Record<ResourceKind, string> = {
  fruit: "fruit",
  water: "water",
  ore: "ore",
  vine: "vine",
  stick: "stick",
};

/** The pack's contents in words, listing only what is actually in it. */
export function backpackText(inventory: Inventory): string {
  const parts = RESOURCE_KINDS.filter((kind) => inventory.count(kind) > 0).map(
    (kind) => `${RESOURCE_NAME[kind]} ${inventory.count(kind)}`,
  );
  return parts.length > 0 ? parts.join(", ") : "empty";
}

const BLOCKED_TEXT: Record<BlockedReason, string> = {
  backpackFull: "Backpack full",
  stomachFull: "Too full to eat",
  noFruit: "No fruit in the backpack",
  noWater: "No water in the backpack",
  noOre: "No ore to bank",
  // Says the price, not just the refusal: the player has to learn what a
  // bridge tile costs somewhere, and standing at the water is where it matters.
  noMaterials: `A bridge tile needs ${bridgeCostText()}`,
};

/** What one bridge tile costs, in words: "1 stick and 1 vine". */
export function bridgeCostText(): string {
  const parts = RESOURCE_KINDS.filter((kind) => (BRIDGE_COST[kind] ?? 0) > 0).map(
    (kind) => `${BRIDGE_COST[kind]} ${RESOURCE_NAME[kind]}`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
    : (parts[0] ?? "nothing");
}

function promptFor(action: Action | null, progress: number): Prompt | null {
  if (!action) return null;
  switch (action.type) {
    case "deposit":
      return action.blocked
        ? { text: BLOCKED_TEXT.noOre, progress: 0, blocked: true }
        : { text: `Press E to bank ${action.ore} ore`, progress: 0, blocked: false };
    case "harvest":
      return action.blocked
        ? { text: BLOCKED_TEXT.backpackFull, progress: 0, blocked: true }
        : {
            text: `Hold E to gather ${RESOURCE_NAME[action.node.kind]}`,
            progress,
            blocked: false,
          };
    case "cut":
      return { text: "Hold E to cut through", progress, blocked: false };
    case "build":
      return action.blocked
        ? { text: BLOCKED_TEXT.noMaterials, progress: 0, blocked: true }
        : { text: "Hold E to lay a bridge tile", progress, blocked: false };
  }
}

/** One line of feedback for something that just happened. */
export function toastFor(event: WorldEvent): string {
  switch (event.type) {
    case "harvested":
      return `+1 ${RESOURCE_NAME[event.kind]}`;
    case "ate":
      return `Ate a fruit  +${C.FRUIT_STAMINA} stamina`;
    case "drank":
      return `Drank water  +${C.WATER_HYDRATION} hydration`;
    case "deposited":
      return `Banked ${event.gold} gold`;
    case "blocked":
      return BLOCKED_TEXT[event.reason];
    case "cut":
      return "Cut a path";
    case "built":
      return "Laid a bridge tile";
    case "summerStarted":
      return `Summer ${event.year}`;
  }
}

export function hudModel(world: World): HudModel {
  const { stats, inventory } = world;
  return {
    stamina: stats.stamina,
    hydration: stats.hydration,
    staminaWarn: stats.stamina < C.STAMINA_WARN_THRESHOLD,
    // The same threshold the simulation uses, so the bar turns at the moment
    // resting drops to half speed rather than at a number picked to look about
    // right.
    hydrationWarn: stats.parched,
    stomachCooldownSec: stats.stomachCooldownSec,
    carried: inventory.carried,
    contents: backpackText(inventory),
    capacity: inventory.capacity,
    gold: inventory.gold,
    holdingFruit: inventory.count("fruit") > 0,
    holdingWater: inventory.count("water") > 0,
    secondsLeft: world.remainingSec,
    urgent: world.remainingSec < C.CLOCK_URGENT_SEC,
    year: world.year,
    prompt: promptFor(world.availableAction(), world.harvestProgress),
  };
}

/**
 * Seconds to `m:ss`.
 *
 * Rounded up, so a full summer reads 5:00 on the first frame and only reaches
 * 0:00 when it is genuinely over -- a clock showing 0:00 with a second still to
 * play would be a lie in the direction that matters.
 */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** Keep `v` inside [lo, hi], and centred if there is not room for both. */
function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return (lo + hi) / 2;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Where to put the floating stack, given where the player is on screen.
 *
 * `x` is the centre of the stack and `y` its top edge, both already kept a
 * margin away from the window: at the edges of the map the camera stops and the
 * player walks on to the corner of the screen, which would otherwise hang half
 * the prompt off it.
 */
export function anchorPosition(
  player: Vec2,
  size: { width: number; height: number },
  view: { width: number; height: number },
): Vec2 {
  const margin = C.PROMPT_EDGE_MARGIN_PX;
  const half = size.width / 2;
  return {
    x: clamp(player.x, margin + half, view.width - margin - half),
    y: clamp(player.y + C.PROMPT_OFFSET_PX, margin, view.height - margin - size.height),
  };
}

/**
 * Find a bound element, or fail loudly. The markup lives in index.html, so a
 * missing one is a typo in a selector rather than a state to handle.
 */
export function need<E extends Element>(root: ParentNode, selector: string): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`missing element: ${selector}`);
  return el;
}

/** Write `text` only when it differs, so a static readout costs nothing. */
function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Binds the markup in index.html to the simulation.
 *
 * Called once per rendered frame, not once per tick: the HUD is a picture of
 * the current state, and drawing it twice between frames would be wasted work.
 */
export class Hud {
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly staminaValue: HTMLElement;
  private readonly hydrationBar: HTMLElement;
  private readonly hydrationFill: HTMLElement;
  private readonly hydrationValue: HTMLElement;
  private readonly stomach: HTMLElement;
  private readonly stomachValue: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly clockTime: HTMLElement;
  private readonly year: HTMLElement;
  private readonly backpack: HTMLElement;
  private readonly backpackContents: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly anchor: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly hintFruit: HTMLElement;
  private readonly hintWater: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly summaryTitle: HTMLElement;
  private readonly summaryStats: HTMLElement;
  private readonly restart: HTMLButtonElement;

  /** How far through `world.events` the toasts have got. */
  private seenEvents = 0;

  /**
   * Size of the floating stack, measured only when its contents change.
   *
   * Reading it back is a forced layout, and the position is written every
   * frame; nothing but a new prompt or a new toast can change the size, so the
   * measurement is taken then and reused in between.
   */
  private anchorSize = { width: 0, height: 0 };
  private anchorContent = "";

  constructor(root: ParentNode = document) {
    this.staminaBar = need(root, "#bar-stamina");
    this.staminaFill = need(this.staminaBar, ".bar-fill");
    this.staminaValue = need(this.staminaBar, ".bar-value");
    this.hydrationBar = need(root, "#bar-hydration");
    this.hydrationFill = need(this.hydrationBar, ".bar-fill");
    this.hydrationValue = need(this.hydrationBar, ".bar-value");
    this.stomach = need(root, "#cooldown-stomach");
    this.stomachValue = need(this.stomach, "b");
    this.clock = need(root, ".clock");
    this.clockTime = need(root, "#clock-time");
    this.year = need(root, "#year-count");
    this.backpack = need(root, "#backpack-count");
    this.backpackContents = need(root, "#backpack-contents");
    this.gold = need(root, "#gold-count");
    this.prompt = need(root, "#action-prompt");
    this.anchor = need(root, "#player-anchor");
    this.toasts = need(root, "#toasts");
    this.hintFruit = need(root, "#hint-fruit");
    this.hintWater = need(root, "#hint-water");
    this.summary = need(root, "#summary");
    this.summaryTitle = need(root, "#summary-title");
    this.summaryStats = need(root, "#summary-stats");
    this.restart = need(root, "#summary-restart");

    setText(need(root, "#backpack-cap"), String(C.BACKPACK_CAPACITY));
  }

  /**
   * Draw the current state, and raise a toast for anything that has happened
   * since the last call.
   *
   * The events are read through a cursor the HUD owns, so showing them takes
   * nothing out of the log and the simulation stays untouched.
   *
   * `playerScreen` is where the player is on the canvas this frame, which is
   * the one thing here the simulation cannot answer: the prompt and the toasts
   * hang off the player rather than off a corner.
   */
  update(model: HudModel, playerScreen: Vec2, events: readonly WorldEvent[] = []): void {
    this.bar(this.staminaBar, this.staminaFill, this.staminaValue, model.stamina, model.staminaWarn);
    this.bar(
      this.hydrationBar,
      this.hydrationFill,
      this.hydrationValue,
      model.hydration,
      model.hydrationWarn,
    );

    const cooling = model.stomachCooldownSec > 0;
    this.stomach.hidden = !cooling;
    if (cooling) setText(this.stomachValue, `${Math.ceil(model.stomachCooldownSec)}s`);

    setText(this.clockTime, formatClock(model.secondsLeft));
    this.clock.classList.toggle("is-urgent", model.urgent);
    setText(this.year, String(model.year));

    setText(this.backpack, String(model.carried));
    setText(this.backpackContents, model.contents);
    setText(this.gold, String(model.gold));

    // Only worth saying while there is something to use it on.
    this.hintFruit.hidden = !model.holdingFruit;
    this.hintWater.hidden = !model.holdingWater;

    this.prompt.hidden = model.prompt === null;
    if (model.prompt) {
      setText(this.prompt, model.prompt.text);
      this.prompt.classList.toggle("is-blocked", model.prompt.blocked);
      this.prompt.style.setProperty("--progress", `${(model.prompt.progress * 100).toFixed(0)}%`);
    }

    for (let i = this.seenEvents; i < events.length; i++) this.toast(toastFor(events[i]!));
    this.seenEvents = events.length;

    this.placeAnchor(model.prompt?.text ?? "", playerScreen);
  }

  /**
   * Follow the player with the prompt and the toasts.
   *
   * The stack is measured whenever its contents change and only then; a toast
   * that has faded out removes itself from the DOM, so the count is part of
   * what counts as a change.
   */
  private placeAnchor(promptText: string, playerScreen: Vec2): void {
    const content = `${promptText}|${this.toasts.childElementCount}`;
    if (content !== this.anchorContent) {
      this.anchorContent = content;
      this.anchorSize = { width: this.anchor.offsetWidth, height: this.anchor.offsetHeight };
    }
    const at = anchorPosition(playerScreen, this.anchorSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    // Centred on x, hung from y. A transform rather than left/top so moving it
    // every frame does not put the page through layout again.
    this.anchor.style.transform =
      `translate(calc(${at.x.toFixed(1)}px - 50%), ${at.y.toFixed(1)}px)`;
  }

  /** Float one line above the HUD, and take it back out of the DOM when it fades. */
  private toast(text: string): void {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    el.addEventListener("animationend", () => el.remove());
    this.toasts.appendChild(el);
  }

  /**
   * Put the summary away and start reading the log from `cursor`.
   *
   * Two callers with opposite needs, which is why the cursor is a parameter. A
   * regenerated world has a brand new, empty log, so it resumes at 0; the next
   * summer on the same map keeps the log it has, so it resumes at the end of
   * the summer that just finished. Get it the wrong way round and the HUD
   * either swallows a summer of toasts or replays one.
   */
  reset(cursor = 0): void {
    this.summary.hidden = true;
    this.toasts.replaceChildren();
    this.seenEvents = cursor;
    this.anchorContent = "";
  }

  /** Show the end-of-summer card. `onRestart` is wired to the button. */
  showSummary(summer: SummerSummary, onRestart: () => void): void {
    const rows: [string, string, boolean][] = [
      ["Gold", String(summer.gold), true],
      ["Fruit picked", String(summer.harvested.fruit), false],
      ["Water drawn", String(summer.harvested.water), false],
      ["Ore mined", String(summer.harvested.ore), false],
      ["Vines cut", String(summer.harvested.vine), false],
      ["Sticks gathered", String(summer.harvested.stick), false],
      ["Ore left unbanked", String(summer.oreUnbanked), false],
      ["Fruit eaten", String(summer.fruitEaten), false],
      ["Water drunk", String(summer.waterDrunk), false],
      ["Paths cut", String(summer.tilesCut), false],
      ["Bridge tiles laid", String(summer.bridgesBuilt), false],
      ["Distance walked", `${summer.distanceWalked.toFixed(0)} tiles`, false],
    ];

    setText(this.summaryTitle, `Summer ${summer.year} over`);

    this.summaryStats.replaceChildren();
    for (const [label, value, isGold] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      if (isGold) dd.className = "gold";
      this.summaryStats.append(dt, dd);
    }

    this.restart.onclick = onRestart;
    this.summary.hidden = false;
    this.restart.focus();
  }

  /**
   * The fill keeps a decimal so the bar slides rather than stepping, while the
   * number beside it is rounded -- nobody reads a stamina bar to two places.
   */
  private bar(bar: HTMLElement, fill: HTMLElement, value: HTMLElement, pct: number, warn: boolean): void {
    const width = `${pct.toFixed(1)}%`;
    if (fill.style.width !== width) fill.style.width = width;
    setText(value, `${Math.round(pct)}%`);
    bar.classList.toggle("is-low", warn);
  }
}
