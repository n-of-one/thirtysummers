import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import {
  nearestNodeWithin,
  nearestSpringWithin,
  tileAhead,
  waterWithin,
  withinReach,
  type TileRef,
} from "./interaction.ts";
import { Inventory, type Amounts } from "./inventory.ts";
import { RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import {
  canStand,
  createPlayer,
  facingFor,
  headingFor,
  moveWithCollision,
  type Player,
} from "./player.ts";
import { Stats } from "./stats.ts";
import { BUILDS } from "./types.ts";
import type { TileMap } from "./tilemap.ts";
import type { TerrainDef } from "./terrain.ts";
import type {
  BlockedReason,
  Build,
  Recipe,
  ResourceNode,
  Spring,
  Tool,
  Vec2,
  WorldEvent,
  WorldEventPayload,
} from "./types.ts";
import { layoutSummerWorld, type GeneratedWorld } from "./worldgen.ts";

/**
 * A box in the field, built with sticks. Anything can be put in and taken back
 * out, and it holds any amount.
 */
export interface Cache {
  /** The tile it stands on, in integer tile coordinates. */
  x: number;
  y: number;
  contents: Inventory;
}

/**
 * What the interact key would do where the player is standing right now.
 *
 * One query answers two questions -- what the HUD should prompt, and what a
 * press actually does -- so the two can never disagree. `blocked` says why the
 * action is the right one here but cannot be carried out: a full backpack,
 * nothing to bank at camp, nothing to build with, no axe, or water too near
 * for a well. Null means it can.
 */
export type Action =
  | { type: "deposit"; sold: number; fruit: number; blocked: BlockedReason | null }
  | { type: "harvest"; node: ResourceNode; blocked: BlockedReason | null }
  | { type: "drink"; x: number; y: number; blocked: null }
  | { type: "stash"; x: number; y: number; items: number; blocked: null }
  | { type: "fetch"; x: number; y: number; items: number; blocked: BlockedReason | null }
  | { type: "cut"; x: number; y: number; blocked: null }
  | { type: "fell"; x: number; y: number; blocked: BlockedReason | null }
  | { type: "build"; x: number; y: number; blocked: BlockedReason | null }
  | { type: "dig"; x: number; y: number; blocked: BlockedReason | null }
  | { type: "cache"; x: number; y: number; blocked: BlockedReason | null };

/** What each thing on the build menu costs. */
export const BUILD_COST: Record<Build, Amounts> = {
  bridge: { stick: C.BRIDGE_STICKS, vine: C.BRIDGE_VINES },
  cache: { stick: C.CACHE_STICKS },
  well: { log: C.WELL_LOGS, stick: C.WELL_STICKS },
};

export const BRIDGE_COST = BUILD_COST.bridge;
export const WELL_COST = BUILD_COST.well;
export const CACHE_COST = BUILD_COST.cache;

/** The action each build carries out, which is also its hold. */
const BUILD_ACTION: Record<Build, "build" | "dig" | "cache"> = {
  bridge: "build",
  cache: "cache",
  well: "dig",
};

/** One line of the build menu. */
export interface BuildOption {
  build: Build;
  cost: Amounts;
  /** Everything it costs is in the pack. */
  affordable: boolean;
}

/** Seconds of holding the interact key each action takes; 0 for a tap. */
const HOLD_TIME: Record<Action["type"], number> = {
  deposit: 0,
  harvest: C.HARVEST_TIME,
  drink: C.DRINK_TIME,
  stash: 0,
  fetch: 0,
  cut: C.CUT_TIME,
  fell: C.FELL_TIME,
  build: C.BUILD_TIME,
  dig: C.WELL_TIME,
  cache: C.CACHE_TIME,
};

/**
 * The whole simulation. Owns the map and everything on it, and advances by
 * fixed steps. Nothing here touches Pixi or the DOM, so a summer can be played out
 * headlessly in a test.
 */
export class World {
  readonly seed: number;
  readonly map: TileMap;
  readonly camp: Vec2;
  readonly nodes: ResourceNode[];
  /**
   * Tiles with a spring on them, in integer tile coordinates. A well dug in
   * the summer is appended, flagged, and drinks the same.
   */
  readonly springs: Spring[];
  /** Caches built so far, in the order they were built. */
  readonly caches: Cache[] = [];
  readonly player: Player;
  readonly stats = new Stats();
  /** The backpack, and the gold banked at camp. */
  readonly inventory = new Inventory();
  /**
   * The store at camp, with no capacity. Fruit goes here when it is banked,
   * and is winter's food once there is a winter.
   */
  readonly store = new Inventory(Infinity);
  /** What the player owns. The knife from the start, the rest from the year table. */
  readonly tools = new Set<Tool>(["knife"]);
  /** What the player knows how to build. The cache from the start, the well from the year table. */
  readonly recipes = new Set<Recipe>(["cache"]);
  /**
   * What the build menu is set to, or null for not building.
   *
   * Building is chosen rather than guessed from what is in the pack: carrying
   * three sticks used to mean a cache and nothing else, with no way to say
   * "a well, once I have the logs". It lasts until it is changed or dropped,
   * so a crossing is one choice and a hold per tile, and it does not survive
   * the end of a summer.
   */
  buildMode: Build | null = null;

  /** Seconds of the summer already spent. Stops at SUMMER_LENGTH_SEC. */
  elapsedSec = 0;

  /**
   * Which summer this is, counting from 1. A year is one summer and one
   * winter; there is no winter yet, so the year advances with the summer.
   */
  year = 1;

  /** Append-only log of what happened. Readers keep their own cursor. */
  readonly events: WorldEvent[] = [];

  /** How far through the current hold -- a harvest, a cut, a bridge -- 0 to 1. */
  harvestProgress = 0;
  /**
   * What that progress belongs to: a node id or a tile, as a string so the two
   * cannot be confused for one another. Empty when nothing is being held.
   */
  private holdKey = "";

  /**
   * Last tick's input, for edge detection. Dropping off is one-shot: it fires
   * on the press, not for every tick the key is down.
   */
  private held = { interact: false };
  /**
   * Set when a press has already done its one thing, and cleared on release.
   *
   * Without it, holding the key at camp banks the load and then, now that the
   * pack has no ore, starts picking whatever node happens to stand beside the
   * camp. One press, one action.
   */
  private interactSpent = false;

  /** The summer is over, by the clock or from camp. Nothing steps after it. */
  ended = false;
  /**
   * Whether the last summer ended out of reach of camp. Winter charges for the
   * fetching, so this outlives the summer it describes.
   */
  awayAtEnd = false;
  /**
   * While set, neither hydration nor the clock moves on its own. Only the debug
   * overlay sets it, and it is here rather than in the overlay so that "the
   * numbers stopped moving" is one flag the simulation owns, not a rate the
   * renderer reaches in and rewrites.
   *
   * The player still walks, works and drinks, so the freeze holds a state still
   * to poke at rather than switching the summer off.
   */
  frozen = false;

  constructor(generated: GeneratedWorld) {
    this.seed = generated.seed;
    this.map = generated.map;
    this.camp = generated.camp;
    this.nodes = generated.nodes;
    this.springs = generated.springs;
    this.player = createPlayer(generated.camp);
    this.grant();
  }

  /**
   * Hand over what the year table gives for this year, once. Recorded as an
   * event only after summer 1, so a new world does not open on toasts.
   */
  private grant(): void {
    for (const what of C.YEAR_GRANTS[this.year] ?? []) {
      if (what === "well") this.recipes.add(what);
      else this.tools.add(what);
      if (this.year > 1) this.record({ type: "granted", what });
    }
  }

  /**
   * A world from a seed: the five-summer layout, which is what the game is
   * about now. The plain noise generator it is built on is still there, and
   * is what `npm run map -- --noise` prints.
   */
  static fromSeed(seed: number): World {
    return new World(layoutSummerWorld(seed));
  }

  /** Seconds left before the summer ends. Never negative. */
  get remainingSec(): number {
    return C.SUMMER_LENGTH_SEC - this.elapsedSec;
  }

  get summerOver(): boolean {
    return this.ended;
  }

  /** Close enough to camp to bank, or to end the summer early. */
  get atCamp(): boolean {
    return withinReach(this.player.x, this.player.y, this.camp);
  }

  /**
   * End the summer where the player stands, by the clock or from camp.
   *
   * What is carried is banked as if brought home, so what sells becomes gold,
   * fruit goes into the store, and a last trip out is never wasted. Building
   * material stays in the pack, as it does at camp. Ending out of reach
   * of camp is remembered, because winter will charge for the fetching. Does
   * nothing the second time.
   */
  endSummer(): void {
    if (this.ended) return;
    this.ended = true;
    this.awayAtEnd = !this.atCamp;
    this.stopHarvesting();
    const banked = this.bank();
    this.record({ type: "summerEnded", away: this.awayAtEnd, ...banked });
  }

  /**
   * Bank what the pack holds that camp can take, as the resource table says:
   * feathers, ore and shells sold for gold, fruit into the store. Sticks, vines
   * and logs stay, because until winter can sell them banking them is losing
   * them, and a bridge, a well or a cache gets rid of them.
   */
  private bank(): { sold: number; fruit: number; gold: number } {
    const fruit = this.inventory.count("fruit");
    const { sold, gold } = this.inventory.sell();
    this.inventory.remove("fruit", fruit);
    this.store.add("fruit", fruit);
    return { sold, fruit, gold };
  }

  /** How many items in the pack banking at camp would take. */
  private bankable(): { sold: number; fruit: number } {
    let sold = 0;
    for (const kind of RESOURCE_KINDS) {
      if (RESOURCES[kind].atCamp === "gold") sold += this.inventory.count(kind);
    }
    return { sold, fruit: this.inventory.count("fruit") };
  }

  /**
   * Start the next summer on the same map.
   *
   * The point of the discovery test is that what you changed stays changed, so
   * the terrain, the wells, the caches, the gold and the backpack are left
   * exactly as they are. What comes back is the year: every node regrows,
   * hydration refills, the player wakes at camp, the clock restarts, and the
   * year table hands over whatever this summer's row needs.
   *
   * The event log is kept too, so readers walking it with a cursor carry on
   * from where they were rather than replaying the summer that just ended.
   */
  nextSummer(): void {
    this.year++;
    this.elapsedSec = 0;
    this.ended = false;
    for (const node of this.nodes) node.harvested = false;
    this.stats.startSummer();
    this.player.x = this.camp.x;
    this.player.y = this.camp.y;
    this.player.moving = false;
    // Distance is a per-summer figure in the summary. It also drives the walk
    // animation, but only through a modulo, and the player is standing still at
    // camp when this happens, so there is no frame to jump.
    this.player.distanceWalked = 0;
    this.stopHarvesting();
    // What was being built is not carried into the new summer: a year is long
    // enough that the pack, the map and the plan have all moved on.
    this.buildMode = null;
    // A press held across the end of a summer is spent; the new one starts on
    // a fresh press, not mid-cut.
    this.interactSpent = true;
    this.record({ type: "summerStarted", year: this.year });
    this.grant();
  }

  /** What the interact key would do from here, or null for nothing in reach. */
  availableAction(): Action | null {
    const { x, y, z } = this.player;
    const atCamp = withinReach(x, y, this.camp);
    const { sold, fruit } = this.bankable();
    // Banking wins at camp, but only when there is something to bank, so a
    // node next to the camp is still harvestable with an empty pack.
    if (atCamp && sold + fruit > 0) return { type: "deposit", sold, fruit, blocked: null };

    // The same at a cache, which takes everything, so it wins while there is
    // anything in the pack at all.
    const cache = nearestSpringWithin(this.caches, x, y);
    if (cache && this.inventory.items > 0) {
      return { type: "stash", x: cache.x, y: cache.y, items: this.inventory.items, blocked: null };
    }

    const node = nearestNodeWithin(this.nodes, x, y);
    if (node) {
      const blocked = this.inventory.fits(node.kind) ? null : "backpackFull";
      return { type: "harvest", node, blocked };
    }

    // Drinking comes before the tools, but only while there is thirst to
    // quench, so a spring beside a thicket does not hide the cut, and the key
    // on a spring's bank lays a bridge when the bar is nearly full.
    if (this.stats.hydration < C.DRINK_OFFER_BELOW) {
      const spring = nearestSpringWithin(this.springs, x, y);
      if (spring) return { type: "drink", x: spring.x, y: spring.y, blocked: null };
    }

    // Fetching comes after picking, so a node beside a full cache can still be
    // picked into an empty pack.
    if (cache && cache.contents.items > 0) {
      const blocked = RESOURCE_KINDS.some(
        (kind) => cache.contents.count(kind) > 0 && this.inventory.fits(kind),
      )
        ? null
        : "backpackFull";
      return { type: "fetch", x: cache.x, y: cache.y, items: cache.contents.items, blocked };
    }

    // Tools come after picking, so a vine growing against the thicket that
    // walls it in can still be picked up. They act only on the tile ahead.
    const ahead = tileAhead(this.map, x, y, this.player.heading, z);
    return (ahead && this.toolAction(ahead)) ??
      (atCamp ? { type: "deposit", sold: 0, fruit: 0, blocked: "nothingToBank" } : null);
  }

  /**
   * What the key does to the tile ahead, or null for nothing.
   *
   * The tools are what is there: a thicket is cut, a sapling is felled.
   * Building is never guessed from the ground, only from the build menu, so
   * plain grass says nothing at all unless something is being built.
   */
  private toolAction(ahead: TileRef): Action | null {
    const { x, y } = ahead;
    const z = this.player.z;
    switch (this.map.get(x, y, z)) {
      case "thicket":
        return this.tools.has("knife") ? { type: "cut", x, y, blocked: null } : null;
      case "sapling": {
        const blocked = !this.tools.has("axe")
          ? "noAxe"
          : this.inventory.fits("log")
            ? null
            : "backpackFull";
        return { type: "fell", x, y, blocked };
      }
      default:
        return this.buildAction(ahead);
    }
  }

  /**
   * What is being built, on the tile ahead, with why it cannot go there.
   *
   * Always the build the menu is set to: it is refused on the wrong ground
   * rather than quietly becoming the build that would fit, so the tile ahead
   * only ever does the one thing the player asked for.
   */
  private buildAction(ahead: TileRef): Action | null {
    const build = this.buildMode;
    if (!build) return null;
    const { x, y } = ahead;
    return { type: BUILD_ACTION[build], x, y, blocked: this.refusal(build, ahead) };
  }

  /** Why `build` cannot go on the tile ahead, or null if it can. */
  private refusal(build: Build, ahead: TileRef): BlockedReason | null {
    const { x, y } = ahead;
    const kind = this.map.get(x, y, this.player.z);
    if (build === "bridge") {
      if (kind !== "stream") return "wrongGround";
    } else {
      if (kind !== "grass") return "wrongGround";
      if (!this.freeToBuild(ahead)) return "occupied";
      if (
        build === "well" &&
        waterWithin(this.map, this.springs, x, y, C.WELL_WATER_CLEARANCE, this.player.z)
      ) {
        return "nearWater";
      }
    }
    return this.inventory.has(BUILD_COST[build]) ? null : "noMaterials";
  }

  /**
   * The build menu: everything the player knows how to build, and whether the
   * pack can pay for it. What cannot be paid for is still listed, and can
   * still be chosen, because the menu is where the recipes are read.
   */
  buildOptions(): BuildOption[] {
    return BUILDS.filter((build) => build === "bridge" || this.recipes.has(build)).map((build) => ({
      build,
      cost: BUILD_COST[build],
      affordable: this.inventory.has(BUILD_COST[build]),
    }));
  }

  /**
   * What a player standing here would be told about building, with nothing
   * chosen: the one place the game volunteers a recipe.
   *
   * Water ahead is the teaching moment, because a stream is the first barrier
   * that cannot be walked, cut or felled through.
   */
  buildHint(): Build | null {
    if (this.buildMode) return null;
    const ahead = tileAhead(this.map, this.player.x, this.player.y, this.player.heading, this.player.z);
    if (!ahead) return null;
    return this.map.get(ahead.x, ahead.y, this.player.z) === "stream" ? "bridge" : null;
  }

  /** Nothing already stands on the tile: no camp, node, spring, well or cache. */
  private freeToBuild({ x, y }: TileRef): boolean {
    const on = (p: Vec2) => Math.floor(p.x) === x && Math.floor(p.y) === y;
    return (
      !on(this.camp) &&
      // Picked nodes too, since they grow back next summer.
      !this.nodes.some(on) &&
      !this.springs.some(on) &&
      !this.caches.some(on)
    );
  }

  /**
   * Put the player down somewhere else, if they can stand there.
   *
   * Refuses an impassable spot and reports false, because a player dropped
   * inside a rock cannot walk out of one: collision only lets a move happen
   * from a legal position to a legal position.
   *
   * The distance is not walked, so it does not count towards the summer's total,
   * and any harvest in progress is dropped. Only the debug overlay calls this.
   */
  teleport(x: number, y: number): boolean {
    if (!canStand(this.map, x, y, this.player.z)) return false;
    this.player.x = x;
    this.player.y = y;
    this.player.moving = false;
    this.stopHarvesting();
    return true;
  }

  /** Terrain the player is currently standing on. */
  groundUnderPlayer(): TerrainDef {
    return this.map.defAt(this.player.x, this.player.y, this.player.z);
  }

  /** Tiles per second on the ground under the player. */
  speed(): number {
    return C.WALK_SPEED * this.groundUnderPlayer().speedMul;
  }

  /**
   * Advance by exactly `dt` seconds. Call at a fixed rate.
   *
   * Every part of a tick goes here, in order. Standing still is a tick like any
   * other: hydration drains whether or not you are walking, and the summer runs
   * down whether or not you are doing anything with it. Nothing in this method
   * may return early on "no input", which is why movement -- the one part that
   * genuinely has nothing to do then -- keeps its own early return one level
   * down.
   *
   * The tick that runs the clock out ends the summer, and once it has ended
   * nothing steps at all: a summer you can keep playing past the end is not one.
   * While {@link frozen}, the player still acts but the clock and hydration
   * hold.
   */
  step(dt: number, input: InputState): void {
    if (this.ended) return;
    this.movePlayer(dt, input);
    this.interact(dt, input);
    this.held = { interact: input.interact };
    if (!this.frozen) {
      this.stats.step(dt);
      this.elapsedSec = Math.min(this.elapsedSec + dt, C.SUMMER_LENGTH_SEC);
    }
    if (this.elapsedSec >= C.SUMMER_LENGTH_SEC) this.endSummer();
  }

  private record(event: WorldEventPayload): void {
    this.events.push({ ...event, at: this.elapsedSec });
  }

  private blocked(reason: BlockedReason): void {
    this.record({ type: "blocked", reason });
  }

  /**
   * Everything on the interact key: picking, drinking, cutting, bridging,
   * dropping off.
   *
   * Four of the five are holds, and they are all the same shape. Progress
   * builds while the key is down and the same thing stays in reach, and is
   * thrown away the moment either stops being true -- walking away mid-cut
   * loses the cut, which is what makes the timer a cost rather than a
   * formality. Dropping off is the exception and is a tap, because there is
   * nothing to feel your way through.
   */
  private interact(dt: number, input: InputState): void {
    if (!input.interact) {
      this.interactSpent = false;
      this.stopHarvesting();
      return;
    }
    if (this.interactSpent) {
      this.stopHarvesting();
      return;
    }

    const pressed = !this.held.interact;
    const action = this.availableAction();

    if (!action) {
      this.stopHarvesting();
      return;
    }

    if (action.type === "deposit" || action.type === "stash" || action.type === "fetch") {
      if (!pressed) return;
      this.interactSpent = true;
      if (action.blocked) this.blocked(action.blocked);
      else this.tap(action);
      return;
    }

    if (action.blocked) {
      // Say why once, on the press, rather than every tick the key is held.
      if (pressed) {
        this.interactSpent = true;
        this.blocked(action.blocked);
      }
      this.stopHarvesting();
      return;
    }

    // A key identifying what is being held, so that switching target -- to
    // another node, or to the next thicket tile along -- starts the hold over
    // instead of inheriting the last one's progress.
    // The type is part of it, so two kinds of hold aimed at one tile could never
    // finish on each other's progress.
    const key =
      action.type === "harvest"
        ? `node:${action.node.id}`
        : `${action.type}:${action.x},${action.y}`;
    if (this.holdKey !== key) {
      this.holdKey = key;
      this.harvestProgress = 0;
    }
    this.harvestProgress += dt / HOLD_TIME[action.type];
    if (this.harvestProgress < 1) return;

    this.complete(action);
    this.stopHarvesting();
  }

  /** Carry out a tap: banking at camp, or putting into or taking out of a cache. */
  private tap(action: Action & { type: "deposit" | "stash" | "fetch" }): void {
    if (action.type === "deposit") {
      this.record({ type: "deposited", ...this.bank() });
      return;
    }
    const cache = this.caches.find((c) => c.x === action.x && c.y === action.y)!;
    const { x, y } = cache;
    if (action.type === "stash") {
      const items = this.inventory.moveAllTo(cache.contents);
      this.record({ type: "stashed", x, y, items });
    } else {
      const items = cache.contents.moveAllTo(this.inventory);
      this.record({ type: "fetched", x, y, items });
    }
  }

  /** Carry out a hold that has run its full time. */
  private complete(action: Action): void {
    switch (action.type) {
      case "harvest":
        action.node.harvested = true;
        this.inventory.add(action.node.kind);
        this.record({ type: "harvested", kind: action.node.kind });
        return;
      case "fell":
        this.map.set(action.x, action.y, "grass", this.player.z);
        this.inventory.add("log");
        this.record({ type: "felled", x: action.x, y: action.y });
        return;
      case "dig":
        if (!this.inventory.pay(WELL_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.springs.push({ x: action.x, y: action.y, well: true });
        this.record({ type: "dug", x: action.x, y: action.y });
        return;
      case "cache":
        if (!this.inventory.pay(CACHE_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.caches.push({ x: action.x, y: action.y, contents: new Inventory(Infinity) });
        this.record({ type: "cached", x: action.x, y: action.y });
        return;
      case "drink":
        this.stats.drink();
        this.record({ type: "drank" });
        return;
      case "cut":
        this.map.set(action.x, action.y, C.CUT_LEAVES, this.player.z);
        this.record({ type: "cut", x: action.x, y: action.y });
        return;
      case "build":
        // Checked again rather than trusted: the pack can empty mid-hold, if
        // a bridge tile is laid and the next one started without letting go.
        if (!this.inventory.pay(BRIDGE_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.map.set(action.x, action.y, "bridge", this.player.z);
        this.record({ type: "built", x: action.x, y: action.y });
        return;
      case "deposit":
      case "stash":
      case "fetch":
        return;
    }
  }

  private stopHarvesting(): void {
    this.holdKey = "";
    this.harvestProgress = 0;
  }

  /**
   * Walk the player for one tick, or stand them still if nothing is held.
   * Rough ground is slower, read off the tile the tick starts on, and that is
   * all it does.
   */
  private movePlayer(dt: number, input: InputState): void {
    const player = this.player;
    if (input.moveX === 0 && input.moveY === 0) {
      player.moving = false;
      return;
    }
    // What the input asked for, whether or not a wall let it happen: pressing
    // into the stream is how a player says which tile they mean.
    player.heading = headingFor(input.moveX, input.moveY);

    const distance = this.speed() * dt;
    const travelled = moveWithCollision(
      this.map,
      player,
      input.moveX * distance,
      input.moveY * distance,
    );

    player.facing = facingFor(input.moveX, input.moveY, player.facing);
    // Pressed into a wall counts as standing still, which keeps the walk
    // animation from cycling on the spot.
    player.moving = travelled > 1e-6;
    player.distanceWalked += travelled;
  }
}
