import * as C from "../config.ts";
import type { SummerSummary } from "../sim/summary.ts";
import type { Amounts, Inventory } from "../sim/inventory.ts";
import { fillList, type ListPart, type ListRow } from "../sim/list.ts";
import { RESOURCE_KINDS, RESOURCES } from "../sim/resources.ts";
import type { Icons } from "../render/packs/icons.ts";
import type { BlockedReason, Build, ResourceKind, Vec2, WorldEvent } from "../sim/types.ts";
import { BRIDGE_COST, BUILD_COST, type Action, type World } from "../sim/world.ts";

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
  capacity: number;
  /**
   * The pack as the strip draws it: a cell per item, in table order, and a
   * stack in one cell. The cells left over are empty ones, so how full the pack
   * is shows without a number.
   */
  pack: PackCell[];
  /** The list ticked in winter: its unfinished lines, one box each. */
  list: ListBox[];
  /**
   * The notice at the start of a summer: how long it is, and whether it is a
   * tired one. Null once the player has moved.
   */
  startNotice: string | null;
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

/** One cell of the pack strip, or one cell wide per slot it takes. */
export interface PackCell {
  kind: ResourceKind;
  /** Slots, so a log is a cell two wide. */
  span: number;
  /** How many a stack holds; null for a single item, which needs no number. */
  count: number | null;
  /** Of the kind the drop key throws, so every cell it would empty is marked. */
  selected: boolean;
}

/**
 * The pack's cells, in table order: one per item, or one per stack, the last
 * of them part filled. Empty cells are not listed; they are the capacity less
 * the spans.
 */
export function packCells(inventory: Inventory, selected: ResourceKind | null): PackCell[] {
  const cells: PackCell[] = [];
  for (const kind of inventory.kinds) {
    let left = inventory.count(kind);
    const { slots, stack } = RESOURCES[kind];
    while (left > 0) {
      const inCell = Math.min(left, stack);
      cells.push({ kind, span: slots, count: stack > 1 ? inCell : null, selected: kind === selected });
      left -= inCell;
    }
  }
  return cells;
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
  well: "a well",
};
const BUILD_VERB: Record<Build, string> = {
  bridge: "lay",
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
 * Banking says both halves of the key: a press does the obvious thing, and
 * holding opens the panel. The progress is the hold's, so the prompt fills as
 * the panel comes.
 */
function actionPrompt(action: Action, progress: number, full: string): Prompt {
  switch (action.type) {
    case "deposit":
      return action.blocked
        ? { text: `${BLOCKED_TEXT.nothingToBank}. ${OPEN_CAMP}`, progress, blocked: true }
        : {
            text: `Press E to store ${action.stored} at camp, ${HOLD_FOR_CAMP}`,
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
 * The second half of the banking prompt: the press, then the hold.
 *
 * What camp keeps is called "camp", not "the store": `store` is already the
 * verb for putting something there, and winter has a shop, so a noun that is
 * neither is worth the small awkwardness.
 */
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
    case "deposited":
      return `Stored ${event.stored} at camp`;
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
    case "blocked":
      return BLOCKED_TEXT[event.reason];
    case "cut":
      return "Cut a path";
    case "built":
      return "Laid a bridge tile";
    case "summerEnded":
      return "Summer over";
    // The winter screen is its own announcement, and the notice at the start
    // of a summer says which one it is.
    case "winterEnded":
    case "summerStarted":
      return null;
  }
}

/**
 * One line of the list as the HUD draws it: a box with what the line wants,
 * and two bars under it, one for what has been collected and one for what is
 * back at camp. A line that is all at camp stays, drawn as done, until the
 * player closes it.
 */
export interface ListBox {
  /** Stable across frames, for redrawing only what changed. */
  key: string;
  title: string;
  /** Everything on it is at camp. */
  done: boolean;
  /**
   * What it asks for beside the title, when that is not plain from its rows:
   * "10 gold", "8 gold, 3 sticks". Null for food, whose row says it.
   */
  wants: string | null;
  /** The next steps in words, on food in the first summer only; otherwise null. */
  hint: FoodHint | null;
  /** One per amount: fruit, the feathers for the gold, the sticks. */
  rows: ListBoxRow[];
}

/**
 * One amount in a box, drawn as a square per item: at camp, carried, or still
 * to find. Past {@link MAX_SQUARES} it is a bar with the same three parts.
 */
export interface ListBoxRow {
  /** What is counted, in the plural: "fruit", "feathers", "sticks". */
  unit: string;
  need: number;
  collected: number;
  atCamp: number;
}

/**
 * [GUESS] Most squares a row draws before it becomes a bar: the first
 * summers ask for 3 to 12 of a thing, and the family's later levels for tens.
 */
export const MAX_SQUARES = 15;

/**
 * The list's lines, as boxes, finished ones included. Gold is counted in
 * feathers, the one thing a first summer can earn it with, so its row says
 * feathers; a shell fills two of them.
 */
export function listBoxes(rows: readonly ListRow[], year: number): ListBox[] {
  return rows.map((row) => {
    const unit = (p: ListPart) => (p.unit === "gold" ? "feathers" : plural(p.unit, 2));
    const isFood = row.line.kind === "food";
    return {
      key: row.line.kind === "item" ? `item:${row.line.id}` : row.line.kind,
      title: row.label,
      done: row.done,
      wants: isFood
        ? null
        : row.parts.map((p) => `${p.need} ${p.unit === "gold" ? "gold" : plural(p.unit, p.need)}`).join(", "),
      hint: isFood && year === 1 && !row.done ? foodHint(row.parts[0]!) : null,
      rows: row.parts.map((p) => ({ unit: unit(p), need: p.need, collected: p.collected, atCamp: p.atCamp })),
    };
  });
}

/**
 * What food says to do, in the first summer: what is still out there, and
 * what is carried and not yet home. It is where the player learns that a
 * thing counts once it is at camp; from the second summer the squares say it.
 */
export function foodHint(part: ListPart): FoodHint | null {
  const find = part.need - part.collected;
  const bring = part.collected - part.atCamp;
  if (find <= 0 && bring <= 0) return null;
  return { find: find > 0 ? `find ${find}` : null, bring: bring > 0 ? `bring ${bring} to camp` : null };
}

/**
 * Food's two steps, kept apart so each can be drawn in its own colour: what
 * to find in plain ink, what to bring home in the carried squares' amber.
 */
export interface FoodHint {
  find: string | null;
  bring: string | null;
}

/** A kind's name for `n` of it. Fruit and ore are the same either way. */
function plural(kind: ResourceKind, n: number): string {
  const name = RESOURCE_NAME[kind];
  return n === 1 || kind === "fruit" || kind === "ore" ? name : `${name}s`;
}

/**
 * The notice at the start of a summer, until the player moves: which summer,
 * how long it is, and whether it is a tired one. What winter will need is on
 * the list, and what grew back and what wore is met on the map.
 */
export function startNoticeText(world: World): string | null {
  if (world.movedThisSummer || world.summerOver) return null;
  const head = `Summer ${world.year}, ${formatClock(C.SUMMER_LENGTH_SEC)} long`;
  return world.tired
    ? `${head}. A tired summer: every job takes longer, and rough ground is slower.`
    : head;
}

/** `viewWidth` is the logical view's width, which the fog is sized against. */
export function hudModel(world: World, viewWidth: number = C.VIEW_W): HudModel {
  const { stats, inventory } = world;
  const homeward = world.remainingSec < C.HOMEWARD_SEC;
  const atCamp = world.atCamp;
  const dropKind = world.dropKind;
  return {
    hydration: stats.hydration,
    // The fog's own threshold, so the bar turns at the moment the view starts
    // to close rather than at a number picked to look about right.
    hydrationWarn: stats.hydration < C.HYDRATION_FOG_THRESHOLD,
    carried: inventory.carried,
    capacity: inventory.capacity,
    pack: packCells(inventory, dropKind),
    list: listBoxes(fillList(world.list, amountsOf(inventory), amountsOf(world.store)), world.year),
    startNotice: startNoticeText(world),
    tools: [...world.tools, ...world.recipes].join(", "),
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

/** What an inventory holds, kind by kind, for filling the list. */
function amountsOf(inventory: Inventory): Amounts {
  const amounts: Amounts = {};
  for (const kind of RESOURCE_KINDS) amounts[kind] = inventory.count(kind);
  return amounts;
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
  private readonly pack: HTMLElement;
  private readonly packCells: HTMLElement;
  /** What the strip was last drawn from, so an unchanged frame writes nothing. */
  private packDrawn = "";
  private readonly list: HTMLElement;
  private readonly startNotice: HTMLElement;
  /** What the list was last drawn from, so an unchanged frame writes nothing. */
  private listDrawn = "";
  /** Finished lines the player has closed this summer, by key. */
  private listClosed = new Set<string>();
  /** Lines drawn as finished last time, so only a newly finished one pops. */
  private listDone = new Set<string>();
  /** A first draw pops nothing: what was finished before it is not news. */
  private listSeeded = false;
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

  /**
   * `view` is the logical view the HUD is laid out in. `icons` is the map's
   * own art for the pack strip; without it each cell names its kind instead.
   */
  constructor(
    root: ParentNode = document,
    private readonly view: { width: number; height: number } = {
      width: C.VIEW_W,
      height: C.VIEW_H,
    },
    private readonly icons: Icons | null = null,
  ) {
    this.hydrationBar = need(root, "#bar-hydration");
    this.hydrationFill = need(this.hydrationBar, ".bar-fill");
    this.hydrationValue = need(this.hydrationBar, ".bar-value");
    this.clock = need(root, ".clock");
    this.clockTime = need(root, "#clock-time");
    this.year = need(root, "#year-count");
    this.pack = need(root, "#pack");
    this.packCells = need(root, "#pack-cells");
    setText(need(root, "#pack-drop-key"), C.DROP_KEY.toUpperCase());
    setText(need(root, "#pack-switch-key"), C.DROP_SWITCH_KEY.toUpperCase());
    this.list = need(root, "#hud-list");
    this.startNotice = need(root, "#start-notice");
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

    this.drawPack(model.pack, model.capacity - model.carried);
    this.drawList(model.list);
    this.startNotice.hidden = model.startNotice === null;
    if (model.startNotice) setText(this.startNotice, model.startNotice);
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

  /**
   * The list, one box per line: what it wants, and a bar each for collected
   * and at camp. A finished line turns green, with a pop the moment it is
   * finished, and stays until its × is clicked. Rebuilt only when a number on
   * it changes, which is a few times a summer.
   */
  /**
   * The pack strip: a cell per item at the size it is on the map, a count only
   * on a stack, and the free slots as empty cells. The keys show only when
   * there is something for them to act on.
   */
  private drawPack(cells: readonly PackCell[], free: number): void {
    const drawn = `${cells.map((c) => `${c.kind}:${c.count}:${c.selected}`).join(",")}|${free}`;
    if (drawn === this.packDrawn) return;
    this.packDrawn = drawn;
    this.pack.classList.toggle("is-empty", cells.length === 0);
    const empty = Array.from({ length: Math.max(0, free) }, () => {
      const div = document.createElement("div");
      div.className = "pack-cell is-free";
      return div;
    });
    this.packCells.replaceChildren(
      ...cells.map((cell) => {
        const div = document.createElement("div");
        div.className = "pack-cell";
        div.classList.toggle("is-selected", cell.selected);
        div.style.setProperty("--span", String(cell.span));
        div.dataset.kind = cell.kind;
        if (this.icons) {
          const img = document.createElement("img");
          img.src = this.icons.url(cell.kind);
          img.alt = RESOURCE_NAME[cell.kind];
          div.append(img);
        } else {
          div.append(RESOURCE_NAME[cell.kind]);
        }
        if (cell.count !== null) {
          const count = document.createElement("span");
          count.className = "pack-count";
          count.textContent = String(cell.count);
          div.append(count);
        }
        return div;
      }),
      ...empty,
    );
  }

  private drawList(all: readonly ListBox[]): void {
    // A closed box stays closed only while it is done: a line undone again,
    // by taking fruit back out of camp, is back on the list.
    const boxes = all.filter((b) => !(b.done && this.listClosed.has(b.key)));
    const drawn = boxes
      .map((b) =>
        `${b.key}:${b.wants}:${b.rows.map((r) => `${r.collected}/${r.atCamp}/${r.need}`).join(",")}:${b.done}`,
      )
      .join("|");
    if (drawn === this.listDrawn) return;
    this.listDrawn = drawn;
    const wasDone = this.listDone;
    this.listDone = new Set(boxes.filter((b) => b.done).map((b) => b.key));
    this.list.hidden = boxes.length === 0;
    this.list.replaceChildren(
      ...boxes.map((box) => {
        const li = document.createElement("li");
        li.className = "list-box";
        li.classList.toggle("is-done", box.done);
        // Only on the frame it was finished, not on every redraw after.
        li.classList.toggle("is-just-done", box.done && !wasDone.has(box.key) && this.listSeeded);
        li.dataset.line = box.key;
        const title = document.createElement("div");
        title.className = "list-title";
        const name = document.createElement("span");
        name.textContent = box.done ? `✓ ${box.title}` : box.title;
        if (box.wants) {
          const wants = document.createElement("small");
          wants.className = "list-wants";
          wants.textContent = box.wants;
          name.append(" ", wants);
        }
        title.append(name);
        if (box.hint) {
          const hint = document.createElement("span");
          hint.className = "list-hint";
          const parts: (string | Node)[] = [];
          if (box.hint.find) {
            const find = document.createElement("span");
            find.className = "list-hint-find";
            find.textContent = box.hint.find;
            parts.push(find);
          }
          if (box.hint.bring) parts.push(parts.length ? `, ${box.hint.bring}` : box.hint.bring);
          hint.append(...parts);
          title.append(hint);
        }
        if (box.done) {
          const close = document.createElement("button");
          close.className = "list-close";
          close.textContent = "×";
          close.title = "Put this away";
          close.onclick = () => {
            close.blur();
            this.listClosed.add(box.key);
            this.drawList(all);
          };
          title.append(close);
        }
        li.append(title, ...box.rows.map(listRow));
        return li;
      }),
    );
    this.listSeeded = true;
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
   * Start reading the log from `cursor`.
   *
   * Two callers with opposite needs, which is why the cursor is a parameter. A
   * regenerated world has a brand new, empty log, so it resumes at 0; the next
   * summer on the same map keeps the log it has, so it resumes at the end of
   * the summer that just finished. Get it the wrong way round and the HUD
   * either swallows a summer of toasts or replays one.
   */
  reset(cursor = 0): void {
    this.toasts.replaceChildren();
    this.seenEvents = cursor;
    this.anchorContent = "";
    // A new summer has a new list: nothing on it is closed, or news yet.
    this.listClosed.clear();
    this.listDone.clear();
    this.listSeeded = false;
    this.listDrawn = "";
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

/** One of a list box's two bars: a label, how far, and the numbers. */
/**
 * One amount in a list box: what it counts, the tent that says green is camp,
 * and a square per item -- green at camp, amber carried, empty still to find.
 * Past {@link MAX_SQUARES} the squares become one bar in the same colours,
 * with the count at camp written on it.
 */
function listRow(r: ListBoxRow): HTMLElement {
  const row = document.createElement("div");
  row.className = "list-row";
  row.classList.toggle("is-home", r.atCamp >= r.need);
  const unit = document.createElement("span");
  unit.className = "list-unit";
  unit.textContent = r.unit;
  row.append(unit, tentMark());
  if (r.need <= MAX_SQUARES) {
    const squares = document.createElement("span");
    squares.className = "list-squares";
    for (let i = 0; i < r.need; i++) {
      const sq = document.createElement("i");
      sq.className = i < r.atCamp ? "sq is-home" : i < r.collected ? "sq is-carried" : "sq";
      squares.append(sq);
    }
    row.append(squares);
  } else {
    const bar = document.createElement("span");
    bar.className = "list-bar";
    bar.style.setProperty("--carried", `${Math.round((Math.min(r.collected, r.need) / r.need) * 100)}%`);
    bar.style.setProperty("--home", `${Math.round((Math.min(r.atCamp, r.need) / r.need) * 100)}%`);
    bar.textContent = `${r.atCamp}/${r.need}`;
    row.append(bar);
  }
  return row;
}

/**
 * The camp, as a mark at the start of every row: a small tent in art pixels.
 * Drawn here rather than cut from a sheet, since the art has no tent yet;
 * the HUD is not world art, so it is free to be its own drawing.
 */
const TENT = [
  ".....#.....",
  "....###....",
  "...##o##...",
  "..###o###..",
  ".####o####.",
  "#####o#####",
  "####...####",
  "###.....###",
  "===========",
];
const TENT_SVG = (() => {
  const fill: Record<string, string> = { "#": "currentColor", o: "#2a3a18", "=": "#5a4a2a" };
  const rects = TENT.flatMap((line, y) =>
    [...line].flatMap((ch, x) =>
      ch === "." ? [] : [`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill[ch]}"/>`],
    ),
  ).join("");
  return `<svg viewBox="0 0 11 9" width="22" height="18" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
})();

function tentMark(): HTMLElement {
  const el = document.createElement("span");
  el.className = "list-tent";
  el.innerHTML = TENT_SVG;
  return el;
}

/** The summer in numbers, as label, value and whether the value is gold. */
export function summaryRows(summer: SummerSummary): [string, string, boolean][] {
  return [
    ["Fruit at camp", String(summer.fruitStored), false],
    ["Fruit picked", String(summer.harvested.fruit), false],
    ["Feathers found", String(summer.harvested.feather), false],
    ["Sticks gathered", String(summer.harvested.stick), false],
    ["Vines cut", String(summer.harvested.vine), false],
    ["Ore mined", String(summer.harvested.ore), false],
    ["Shells found", String(summer.harvested.shell), false],
    ["Stored at the end", String(summer.storedAtEnd), false],
    ["Dropped on the ground", String(summer.dropped), false],
    ["Drinks", String(summer.drinks), false],
    ["Paths cut", String(summer.tilesCut), false],
    ["Bridge tiles laid", String(summer.bridgesBuilt), false],
    ["Saplings felled", String(summer.saplingsFelled), false],
    ["Wells dug", String(summer.wellsDug), false],
    ["Distance walked", `${summer.distanceWalked.toFixed(0)} tiles`, false],
    ["Ended away from camp", summer.endedAway ? "yes" : "no", false],
  ];
}
