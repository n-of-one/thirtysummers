import * as C from "../config.ts";
import type { SummerSummary } from "../sim/summary.ts";
import type { Amounts, Inventory } from "../sim/inventory.ts";
import { RESOURCE_KINDS } from "../sim/resources.ts";
import type {
  BlockedReason,
  Build,
  Recipe,
  ResourceKind,
  Tool,
  Vec2,
  WorldEvent,
} from "../sim/types.ts";
import { BRIDGE_COST, BUILD_COST, WELL_COST, type Action, type World } from "../sim/world.ts";

/**
 * Everything the HUD draws, as plain numbers.
 *
 * Pulling this out of the DOM writing has two uses: it is the only part worth
 * testing, and it keeps the one-way rule honest -- the HUD reads simulation
 * state through here and has no way to write back.
 */
export interface HudModel {
  /** Hydration, a percentage. */
  hydration: number;
  /** Dry enough for the fog to be closing in, and for the thirst notice to stay up. */
  hydrationWarn: boolean;
  carried: number;
  /** What is in the pack, spelled out: "fruit 3, ore 5". */
  contents: string;
  /**
   * The selected kind and the keys that act on it: "X: drop 6 vine · C:
   * switch". Empty with an empty pack. Always shown, not only when the pack is
   * full, so the full-pack prompt is a reminder of keys that already exist.
   */
  dropSelection: string;
  capacity: number;
  gold: number;
  /** Fruit in the store at camp. */
  storedFruit: number;
  /** The tools owned and the recipes known, in words: "knife, axe, well". */
  tools: string;
  /** What is being built, in words, or null for nothing. */
  building: string | null;
  secondsLeft: number;
  /** In the last `HOMEWARD_SEC` of the summer: the clock turns, and dusk falls. */
  homeward: boolean;
  /** Homeward and away from camp: the standing notice saying to head back. */
  homewardNotice: string | null;
  /** Opacity of the dusk layer, in `DUSK_ALPHA_STEP` steps. */
  duskAlpha: number;
  /** Which summer this is, counting from 1. */
  year: number;
  /** Close enough to camp to end the summer early. */
  atCamp: boolean;
  /** Radius of the clear circle in the fog, in logical pixels. */
  fogRadiusPx: number;
  /** What the interact key would do here; null for nothing. */
  prompt: Prompt | null;
}

export interface Prompt {
  text: string;
  /** How far through the hold, 0 to 1. Zero for anything that is not a hold. */
  progress: number;
  /** Right here, but not possible: a full pack, no ore to bank, nothing to build with. */
  blocked: boolean;
}

/** How each resource is referred to in a prompt or a toast. */
const RESOURCE_NAME: Record<ResourceKind, string> = {
  fruit: "fruit",
  feather: "feather",
  stick: "stick",
  vine: "vine",
  ore: "ore",
  log: "log",
  shell: "shell",
};

/** The toast for each thing the year table can hand over. */
const GRANTED_TEXT: Record<Tool | Recipe, string> = {
  knife: "You have a knife",
  axe: "You have an axe",
  cart: "You have a cart",
  cache: "You know how to build a cache",
  well: `You know how to dig a well: ${costText(WELL_COST)}`,
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
  noRoomToDrop: "No room to put anything down here",
  nothingToBank: "Nothing to store",
  // A fallback: what is missing is said with the name of what is being built,
  // by `refusedText`, wherever the build is known.
  noMaterials: "Not enough in the pack",
  noAxe: "Felling a sapling needs an axe",
  nearWater: `Too near water for a well, ${C.WELL_WATER_CLEARANCE} tiles away at least`,
  wrongGround: "Not this ground",
  occupied: "Something already stands here",
};

/** What each build is called in a prompt, and the verb it takes. */
const BUILD_NAME: Record<Build, string> = {
  bridge: "a bridge tile",
  cache: "a cache",
  well: "a well",
};
const BUILD_VERB: Record<Build, string> = {
  bridge: "lay",
  cache: "build",
  well: "dig",
};

/** Why a build cannot go on the tile ahead, naming what is being built. */
function refusedText(build: Build, reason: BlockedReason): string {
  if (reason === "noMaterials") {
    // Says the price, not just the refusal: the recipes are learned at the
    // barrier they are needed at, as well as in the menu.
    return `${capitalise(BUILD_NAME[build])} needs ${costText(BUILD_COST[build])}`;
  }
  if (reason === "wrongGround") {
    return build === "bridge" ? "A bridge goes on water" : `${capitalise(BUILD_NAME[build])} goes on open grass`;
  }
  return BLOCKED_TEXT[reason];
}

const capitalise = (text: string) => text.slice(0, 1).toUpperCase() + text.slice(1);

/**
 * The one line the game volunteers about building, at the water's edge with
 * nothing chosen: what a crossing costs, and which key starts one.
 */
export function buildHintText(build: Build, affordable: boolean): string {
  const key = C.BUILD_MENU_KEY.toUpperCase();
  return affordable
    ? `Press ${key} to build ${BUILD_NAME[build]}`
    : `${capitalise(BUILD_NAME[build])} needs ${costText(BUILD_COST[build])}. Press ${key} to build`;
}

/** What one bridge tile costs, in words: "1 stick and 1 vine". */
export function bridgeCostText(): string {
  return costText(BRIDGE_COST);
}

/** A recipe in words: "2 log and 2 stick". */
export function costText(cost: Amounts): string {
  const parts = RESOURCE_KINDS.filter((kind) => (cost[kind] ?? 0) > 0).map(
    (kind) => `${cost[kind]} ${RESOURCE_NAME[kind]}`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
    : (parts[0] ?? "nothing");
}

/**
 * What the interact key would do, in words.
 *
 * `full` is what a full pack is told: the drop keys and what they would throw
 * away, which is the one thing that gets a player out of it. Every refusal for
 * want of room says the same thing, so the reminder is never somewhere else.
 *
 * The three transfers say both halves of the key: a press does the obvious
 * thing, and holding opens the panel. The progress is the hold's, so the
 * prompt fills as the panel comes.
 */
function actionPrompt(action: Action, progress: number, full: string): Prompt {
  switch (action.type) {
    case "deposit":
      return action.blocked
        ? { text: `${BLOCKED_TEXT.nothingToBank}. ${OPEN_CAMP}`, progress, blocked: true }
        : {
            text: `Press E to ${[
              action.sold > 0 ? `sell ${action.sold}` : "",
              action.stored > 0 ? `store ${action.stored}` : "",
            ]
              .filter(Boolean)
              .join(" and ")} at camp, ${HOLD_FOR_CAMP}`,
            progress,
            blocked: false,
          };
    case "stash":
      return {
        text: `Press E to put ${action.items} in the cache, ${HOLD_TO_OPEN}`,
        progress,
        blocked: false,
      };
    case "fetch":
      return action.blocked
        ? { text: full, progress, blocked: true }
        : {
            text: `Press E to take from the cache (${action.items}), ${HOLD_TO_OPEN}`,
            progress,
            blocked: false,
          };
    case "pickUp":
      return action.blocked
        ? { text: full, progress: 0, blocked: true }
        : {
            text: `Press E to pick up ${RESOURCE_NAME[action.item.kind]}`,
            progress: 0,
            blocked: false,
          };
    case "fell":
      return action.blocked
        ? { text: action.blocked === "backpackFull" ? full : BLOCKED_TEXT[action.blocked], progress: 0, blocked: true }
        : { text: "Hold E to fell the sapling", progress, blocked: false };
    case "dig":
      return action.blocked
        ? { text: refusedText("well", action.blocked), progress: 0, blocked: true }
        : { text: buildPrompt("well"), progress, blocked: false };
    case "cache":
      return action.blocked
        ? { text: refusedText("cache", action.blocked), progress: 0, blocked: true }
        : { text: buildPrompt("cache"), progress, blocked: false };
    case "harvest":
      return action.blocked
        ? { text: full, progress: 0, blocked: true }
        : {
            text: `Hold E to gather ${RESOURCE_NAME[action.node.kind]}`,
            progress,
            blocked: false,
          };
    case "drink":
      return { text: "Hold E to drink", progress, blocked: false };
    case "cut":
      return { text: "Hold E to cut through", progress, blocked: false };
    case "build":
      return action.blocked
        ? { text: refusedText("bridge", action.blocked), progress: 0, blocked: true }
        : { text: buildPrompt("bridge"), progress, blocked: false };
  }
}

/** "Hold E to dig a well (2 log and 2 stick)". */
function buildPrompt(build: Build): string {
  return `Hold E to ${BUILD_VERB[build]} ${BUILD_NAME[build]} (${costText(BUILD_COST[build])})`;
}

/**
 * The second half of every transfer prompt: the press, then the hold.
 *
 * What camp keeps is called "camp", not "the store": `store` is already the
 * verb for putting something there, and a shop is coming in winter, so a noun
 * that is neither is worth the small awkwardness.
 */
const HOLD_TO_OPEN = "hold to open it";
const HOLD_FOR_CAMP = "hold to access the camp items";
const OPEN_CAMP = "Hold E to access the camp items";

/**
 * What a full pack is told, naming the kind the drop key would throw away and
 * how much of it.
 *
 * The count is the whole safeguard against throwing six winter meals on the
 * grass, and it is enough, because they can be picked back up. Refusing the
 * drop instead would be unthematic in a game about carrying things.
 */
export function fullPackText(kind: ResourceKind | null, n: number): string {
  if (!kind) return BLOCKED_TEXT.backpackFull;
  const drop = C.DROP_KEY.toUpperCase();
  const switchTo = C.DROP_SWITCH_KEY.toUpperCase();
  return `${BLOCKED_TEXT.backpackFull} - ${drop}: drop ${n} ${RESOURCE_NAME[kind]}. ${switchTo}: switch`;
}

/** The same line as a standing readout, for the pack pill. */
export function dropSelectionText(kind: ResourceKind | null, n: number): string {
  if (!kind) return "";
  const drop = C.DROP_KEY.toUpperCase();
  const switchTo = C.DROP_SWITCH_KEY.toUpperCase();
  return `${drop}: drop ${n} ${RESOURCE_NAME[kind]} · ${switchTo}: switch`;
}

/**
 * The line under the player: what the interact key would do here, or, with
 * nothing in reach and nothing chosen to build, the one hint about building.
 */
function promptFor(world: World): Prompt | null {
  const action = world.availableAction();
  const kind = world.dropKind;
  if (action) {
    return actionPrompt(
      action,
      world.harvestProgress,
      fullPackText(kind, kind ? world.inventory.count(kind) : 0),
    );
  }
  const hint = world.buildHint();
  if (!hint) return null;
  const option = world.buildOptions().find((o) => o.build === hint);
  return { text: buildHintText(hint, option?.affordable ?? false), progress: 0, blocked: false };
}

/**
 * One line of feedback for something that just happened, or null for something
 * the player can already see -- the transfer panel opening in front of them is
 * its own announcement.
 */
export function toastFor(event: WorldEvent): string | null {
  switch (event.type) {
    case "harvested":
      return `+1 ${RESOURCE_NAME[event.kind]}`;
    case "pickedUp":
      return `+1 ${RESOURCE_NAME[event.kind]}`;
    case "drank":
      return "Drank your fill";
    case "deposited": {
      const parts = [
        event.sold > 0 ? `sold ${event.sold} for ${event.gold} gold` : "",
        event.stored > 0 ? `stored ${event.stored} at camp` : "",
      ].filter(Boolean);
      return capitalise(parts.join(", "));
    }
    case "putAway":
      return `Stored ${event.n} ${RESOURCE_NAME[event.kind]}`;
    case "tookOut":
      return `Took ${event.n} ${RESOURCE_NAME[event.kind]}`;
    case "dropped":
      return `Dropped ${event.n} ${RESOURCE_NAME[event.kind]}`;
    case "transferOpened":
      return null;
    case "felled":
      return `Felled a sapling, +1 ${RESOURCE_NAME.log}`;
    case "dug":
      return "Dug a well";
    case "cached":
      return "Built a cache";
    case "stashed":
      return `Put ${event.items} in the cache`;
    case "fetched":
      return `Took ${event.items} from the cache`;
    case "granted":
      return GRANTED_TEXT[event.what];
    case "blocked":
      return BLOCKED_TEXT[event.reason];
    case "cut":
      return "Cut a path";
    case "built":
      return "Laid a bridge tile";
    case "summerEnded":
      return "Summer over";
    case "summerStarted":
      return `Summer ${event.year}`;
  }
}

/** `viewWidth` is the logical view's width, which the fog is sized against. */
export function hudModel(world: World, viewWidth: number = C.VIEW_W): HudModel {
  const { stats, inventory } = world;
  const homeward = world.remainingSec < C.HOMEWARD_SEC;
  const atCamp = world.atCamp;
  const dropKind = world.dropKind;
  return {
    dropSelection: dropSelectionText(dropKind, dropKind ? inventory.count(dropKind) : 0),
    hydration: stats.hydration,
    // The fog's own threshold, so the bar turns at the moment the view starts
    // to close rather than at a number picked to look about right.
    hydrationWarn: stats.hydration < C.HYDRATION_FOG_THRESHOLD,
    carried: inventory.carried,
    contents: backpackText(inventory),
    capacity: inventory.capacity,
    gold: inventory.gold,
    storedFruit: world.store.count("fruit"),
    tools: [...world.tools, ...[...world.recipes].filter((r) => r !== "cache")].join(", "),
    building: world.buildMode ? BUILD_NAME[world.buildMode] : null,
    secondsLeft: world.remainingSec,
    homeward,
    // At camp the End summer button is already there, so nothing is said.
    homewardNotice:
      homeward && !atCamp
        ? `Summer ends in ${formatClock(world.remainingSec)}. Get back to camp.`
        : null,
    duskAlpha: duskAlpha(world.remainingSec),
    year: world.year,
    atCamp,
    fogRadiusPx: fogRadiusPx(stats.hydration, viewWidth),
    prompt: promptFor(world),
  };
}

/**
 * How far the player can see before the dark begins, in logical pixels.
 *
 * The view is always ringed. Fog is the only cost of running dry, so it has to
 * be felt: the widest circle down to the threshold, then one that shrinks
 * linearly to a few tiles at zero. The widest is a share of the view's half
 * width, so the ring keeps its shape whatever size the view is.
 */
export function fogRadiusPx(hydration: number, viewWidth: number = C.VIEW_W): number {
  const share = Math.min(Math.max(hydration, 0) / C.HYDRATION_FOG_THRESHOLD, 1);
  const widest = (viewWidth / 2) * C.FOG_MAX_RADIUS_SHARE;
  const narrowest = C.FOG_MIN_RADIUS_TILES * C.TILE;
  return narrowest + (widest - narrowest) * share;
}

/**
 * Opacity of the dusk with `secondsLeft` in the summer.
 *
 * Nothing before `HOMEWARD_SEC`, then rising evenly to `DUSK_MAX_ALPHA` as the
 * clock runs out. Rounded to `DUSK_ALPHA_STEP`, so the layer's style changes a
 * few dozen times over the stretch rather than every frame.
 */
export function duskAlpha(secondsLeft: number): number {
  const into = Math.min(Math.max((C.HOMEWARD_SEC - secondsLeft) / C.HOMEWARD_SEC, 0), 1);
  const steps = Math.round((into * C.DUSK_MAX_ALPHA) / C.DUSK_ALPHA_STEP);
  return Number((steps * C.DUSK_ALPHA_STEP).toFixed(4));
}

/**
 * The fog's CSS gradient, from a colour and [radius multiple, opacity] stops.
 *
 * Distances are written against `--fog-r`, so the radius can change without
 * the gradient being rebuilt. Clear up to the radius; the last stop is always
 * drawn fully opaque, so whatever the stops, the far edge of the layer is
 * solid and nothing shows past it.
 */
export function fogGradient(
  color: number = C.FOG_COLOR,
  stops: readonly (readonly [number, number])[] = C.FOG_STOPS,
): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const parts = [`rgba(${r}, ${g}, ${b}, 0) var(--fog-r)`];
  stops.forEach(([at, alpha], i) => {
    const a = i === stops.length - 1 ? 1 : Math.min(Math.max(alpha, 0), 1);
    parts.push(`rgba(${r}, ${g}, ${b}, ${a}) calc(var(--fog-r) * ${at})`);
  });
  return `radial-gradient(circle at center, ${parts.join(", ")})`;
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
 * Where to put the floating stack, given where the player is in the view.
 *
 * `x` is the centre of the stack and `y` its top edge, both already kept a
 * margin away from the view's edge: at the edges of the map the camera stops
 * and the player walks on to the corner of the view, which would otherwise
 * hang half the prompt off it.
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

/** Where the camp arrow goes, and which way it points. */
export interface EdgeArrow {
  x: number;
  y: number;
  /** Radians, clockwise from pointing right, as a CSS rotate reads it. */
  angle: number;
}

/**
 * The arrow at the edge of the view that points at camp, or null while the
 * camp is in view.
 *
 * It sits where the line from the player to the camp leaves the view, `margin`
 * in from the edge, and points along that line. The player is kept inside the
 * inset box first, so a player walked into a corner of the map still gets an
 * arrow on the edge rather than one past it.
 */
export function edgeArrow(
  player: Vec2,
  camp: Vec2,
  view: { width: number; height: number },
  margin: number = C.EDGE_ARROW_MARGIN_PX,
): EdgeArrow | null {
  const inView = camp.x >= 0 && camp.x <= view.width && camp.y >= 0 && camp.y <= view.height;
  if (inView) return null;

  const x0 = margin;
  const y0 = margin;
  const x1 = view.width - margin;
  const y1 = view.height - margin;
  const from = { x: clamp(player.x, x0, x1), y: clamp(player.y, y0, y1) };
  const dx = camp.x - from.x;
  const dy = camp.y - from.y;

  // How far along the line each pair of edges is reached; the nearer one is
  // where it leaves.
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (x1 - from.x) / dx);
  if (dx < 0) t = Math.min(t, (x0 - from.x) / dx);
  if (dy > 0) t = Math.min(t, (y1 - from.y) / dy);
  if (dy < 0) t = Math.min(t, (y0 - from.y) / dy);
  if (!Number.isFinite(t)) return null;

  return { x: from.x + dx * t, y: from.y + dy * t, angle: Math.atan2(dy, dx) };
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

/**
 * Steps the fog's radius moves in, in screen pixels. Each step repaints the
 * gradient, so a smaller one buys a smoother shrink for more painting.
 */
const FOG_STEP_PX = 4;

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
  private readonly hydrationBar: HTMLElement;
  private readonly hydrationFill: HTMLElement;
  private readonly hydrationValue: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly clockTime: HTMLElement;
  private readonly year: HTMLElement;
  private readonly backpack: HTMLElement;
  private readonly backpackContents: HTMLElement;
  private readonly dropSelection: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly storedFruit: HTMLElement;
  private readonly tools: HTMLElement;
  private readonly buildPill: HTMLElement;
  private readonly buildName: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly anchor: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly thirstyNotice: HTMLElement;
  private readonly homewardNotice: HTMLElement;
  private readonly campArrow: HTMLElement;
  private readonly fog: HTMLElement;
  private readonly dusk: HTMLElement;
  private readonly endSummer: HTMLButtonElement;
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

  /** What the fog layer was last given, so an unchanged frame writes nothing. */
  private fogRadius = "";
  private fogTransform = "";
  /** The same, for the dusk's opacity and the arrow's placement. */
  private duskOpacity = "";
  private arrowTransform = "";

  /** `view` is the logical view the HUD is laid out in. */
  constructor(
    root: ParentNode = document,
    private readonly view: { width: number; height: number } = {
      width: C.VIEW_W,
      height: C.VIEW_H,
    },
  ) {
    this.hydrationBar = need(root, "#bar-hydration");
    this.hydrationFill = need(this.hydrationBar, ".bar-fill");
    this.hydrationValue = need(this.hydrationBar, ".bar-value");
    this.clock = need(root, ".clock");
    this.clockTime = need(root, "#clock-time");
    this.year = need(root, "#year-count");
    this.backpack = need(root, "#backpack-count");
    this.backpackContents = need(root, "#backpack-contents");
    this.dropSelection = need(root, "#drop-selection");
    this.gold = need(root, "#gold-count");
    this.storedFruit = need(root, "#store-fruit");
    this.tools = need(root, "#tools");
    this.buildPill = need(root, "#build-pill");
    this.buildName = need(root, "#build-name");
    this.prompt = need(root, "#action-prompt");
    this.anchor = need(root, "#player-anchor");
    this.toasts = need(root, "#toasts");
    this.thirstyNotice = need(root, "#thirsty-notice");
    this.homewardNotice = need(root, "#homeward-notice");
    this.campArrow = need(root, "#camp-arrow");
    this.fog = need(root, "#fog");
    this.fog.style.background = fogGradient();
    this.dusk = need(root, "#dusk");
    this.dusk.style.backgroundColor = `#${C.DUSK_COLOR.toString(16).padStart(6, "0")}`;
    this.endSummer = need(root, "#end-summer");
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
   * `playerScreen` and `campScreen` are where the player and the camp are in
   * the view this frame, which is the one thing here the simulation cannot
   * answer: the prompt and the toasts hang off the player, and the arrow
   * points from the player to the camp.
   */
  update(
    model: HudModel,
    playerScreen: Vec2,
    events: readonly WorldEvent[] = [],
    campScreen: Vec2 | null = null,
  ): void {
    this.bar(
      this.hydrationBar,
      this.hydrationFill,
      this.hydrationValue,
      model.hydration,
      `${Math.round(model.hydration)}%`,
      model.hydrationWarn,
    );

    setText(this.clockTime, formatClock(model.secondsLeft));
    this.clock.classList.toggle("is-urgent", model.homeward);
    setText(this.year, String(model.year));

    setText(this.backpack, String(model.carried));
    setText(this.backpackContents, model.contents);
    this.dropSelection.hidden = model.dropSelection === "";
    setText(this.dropSelection, model.dropSelection);
    setText(this.gold, String(model.gold));
    setText(this.storedFruit, String(model.storedFruit));
    setText(this.tools, model.tools);
    this.buildPill.hidden = model.building === null;
    if (model.building) setText(this.buildName, model.building);

    // In the stack under the player, so it is never drawn over them.
    this.endSummer.hidden = !model.atCamp;
    // Up for as long as the fog is closing in, not a toast that fades: running
    // dry is a state the player is in until they drink.
    this.thirstyNotice.hidden = !model.hydrationWarn;
    this.homewardNotice.hidden = model.homewardNotice === null;
    if (model.homewardNotice) setText(this.homewardNotice, model.homewardNotice);
    this.placeFog(model.fogRadiusPx, playerScreen);
    this.placeDusk(model.duskAlpha);
    this.placeArrow(model.homeward && campScreen ? edgeArrow(playerScreen, campScreen, this.view) : null);

    this.prompt.hidden = model.prompt === null;
    if (model.prompt) {
      setText(this.prompt, model.prompt.text);
      this.prompt.classList.toggle("is-blocked", model.prompt.blocked);
      this.prompt.style.setProperty("--progress", `${(model.prompt.progress * 100).toFixed(0)}%`);
    }

    for (let i = this.seenEvents; i < events.length; i++) {
      const text = toastFor(events[i]!);
      if (text !== null) this.toast(text);
    }
    this.seenEvents = events.length;

    // The notices and the button change the size of the stack as much as the
    // prompt does.
    this.placeAnchor(
      `${model.prompt?.text ?? ""}|${model.hydrationWarn}|${model.homewardNotice ?? ""}|${model.atCamp}`,
      playerScreen,
    );
  }

  /**
   * Follow the player with the prompt and the toasts.
   *
   * The stack is measured whenever its contents change and only then; a toast
   * that has faded out removes itself from the DOM, so the count is part of
   * what counts as a change.
   */
  private placeAnchor(stackText: string, playerScreen: Vec2): void {
    const content = `${stackText}|${this.toasts.childElementCount}`;
    if (content !== this.anchorContent) {
      this.anchorContent = content;
      this.anchorSize = { width: this.anchor.offsetWidth, height: this.anchor.offsetHeight };
    }
    const at = anchorPosition(playerScreen, this.anchorSize, this.view);
    // Centred on x, hung from y. A transform rather than left/top so moving it
    // every frame does not put the page through layout again.
    this.anchor.style.transform =
      `translate(calc(${at.x.toFixed(1)}px - 50%), ${at.y.toFixed(1)}px)`;
  }

  /**
   * Ring the view in dark, and close it in round the player as hydration runs
   * out.
   *
   * The layer is twice the view each way with the gradient at its centre, so
   * following the player is a transform, which the compositor moves without
   * painting anything. The gradient itself is repainted only when the radius
   * crosses a step, a few times a second at most, and only while it shrinks.
   */
  private placeFog(radiusPx: number, playerScreen: Vec2): void {
    const radius = `${Math.round(radiusPx / FOG_STEP_PX) * FOG_STEP_PX}px`;
    if (radius !== this.fogRadius) {
      this.fogRadius = radius;
      this.fog.style.setProperty("--fog-r", radius);
    }
    const x = (playerScreen.x - this.view.width).toFixed(0);
    const y = (playerScreen.y - this.view.height).toFixed(0);
    const transform = `translate(${x}px, ${y}px)`;
    if (transform !== this.fogTransform) {
      this.fogTransform = transform;
      this.fog.style.transform = transform;
    }
  }

  /** Draw the evening in. The alpha arrives in steps, so most frames write nothing. */
  private placeDusk(alpha: number): void {
    const opacity = String(alpha);
    if (opacity === this.duskOpacity) return;
    this.duskOpacity = opacity;
    this.dusk.style.opacity = opacity;
  }

  /** Point at camp from the edge of the view, or put the arrow away. */
  private placeArrow(arrow: EdgeArrow | null): void {
    this.campArrow.hidden = arrow === null;
    if (!arrow) return;
    const transform =
      `translate(${arrow.x.toFixed(0)}px, ${arrow.y.toFixed(0)}px) ` +
      `rotate(${arrow.angle.toFixed(3)}rad)`;
    if (transform === this.arrowTransform) return;
    this.arrowTransform = transform;
    this.campArrow.style.transform = transform;
  }

  /**
   * Wire the camp's "End summer" button. Focus goes back to the game after the
   * click, since a focused button would swallow the next key pressed.
   */
  onEndSummer(handler: () => void): void {
    this.endSummer.onclick = () => {
      this.endSummer.blur();
      handler();
    };
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
      ["Fruit stored", String(summer.fruitStored), false],
      ["Fruit picked", String(summer.harvested.fruit), false],
      ["Feathers found", String(summer.harvested.feather), false],
      ["Sticks gathered", String(summer.harvested.stick), false],
      ["Vines cut", String(summer.harvested.vine), false],
      ["Ore mined", String(summer.harvested.ore), false],
      ["Shells found", String(summer.harvested.shell), false],
      ["Sold at the end", String(summer.soldAtEnd), false],
      ["Stored at the end", String(summer.storedAtEnd), false],
      ["Dropped on the ground", String(summer.dropped), false],
      ["Drinks", String(summer.drinks), false],
      ["Paths cut", String(summer.tilesCut), false],
      ["Bridge tiles laid", String(summer.bridgesBuilt), false],
      ["Saplings felled", String(summer.saplingsFelled), false],
      ["Wells dug", String(summer.wellsDug), false],
      ["Caches built", String(summer.cachesBuilt), false],
      ["Distance walked", `${summer.distanceWalked.toFixed(0)} tiles`, false],
      ["Ended away from camp", summer.endedAway ? "yes" : "no", false],
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
   * number beside it is rounded -- nobody reads a bar to two places.
   */
  private bar(
    bar: HTMLElement,
    fill: HTMLElement,
    value: HTMLElement,
    pct: number,
    text: string,
    warn: boolean,
  ): void {
    const width = `${Math.min(Math.max(pct, 0), 100).toFixed(1)}%`;
    if (fill.style.width !== width) fill.style.width = width;
    setText(value, text);
    bar.classList.toggle("is-low", warn);
  }
}
