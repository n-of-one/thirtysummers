import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import {
  nearestNodeWithin,
  nearestSpringWithin,
  tileAhead,
  withinReach,
} from "./interaction.ts";
import { Inventory } from "./inventory.ts";
import {
  canStand,
  createPlayer,
  facingFor,
  headingFor,
  moveWithCollision,
  type Player,
} from "./player.ts";
import { Stats } from "./stats.ts";
import type { TileMap } from "./tilemap.ts";
import type { TerrainDef } from "./terrain.ts";
import type {
  BlockedReason,
  ResourceKind,
  ResourceNode,
  Vec2,
  WorldEvent,
  WorldEventPayload,
} from "./types.ts";
import { generateWorld, type GeneratedWorld } from "./worldgen.ts";

/**
 * What the interact key would do where the player is standing right now.
 *
 * One query answers two questions -- what the HUD should prompt, and what a
 * press actually does -- so the two can never disagree. `blocked` says why the
 * action is the right one here but cannot be carried out: a full backpack,
 * nothing to bank at camp, or nothing to build with. Null means it can.
 */
export type Action =
  | { type: "deposit"; ore: number; fruit: number; blocked: BlockedReason | null }
  | { type: "harvest"; node: ResourceNode; blocked: BlockedReason | null }
  | { type: "drink"; x: number; y: number; blocked: null }
  | { type: "cut"; x: number; y: number; blocked: null }
  | { type: "build"; x: number; y: number; blocked: BlockedReason | null };

/** What one bridge tile costs. The only recipe in the prototype. */
export const BRIDGE_COST: Partial<Record<ResourceKind, number>> = {
  stick: C.BRIDGE_STICKS,
  vine: C.BRIDGE_VINES,
};

/** Seconds of holding the interact key each action takes; 0 for a tap. */
const HOLD_TIME: Record<Action["type"], number> = {
  deposit: 0,
  harvest: C.HARVEST_TIME,
  drink: C.DRINK_TIME,
  cut: C.CUT_TIME,
  build: C.BUILD_TIME,
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
  /** Tiles with a spring on them, in integer tile coordinates. */
  readonly springs: Vec2[];
  readonly player: Player;
  readonly stats = new Stats();
  /** The backpack, and the gold banked at camp. */
  readonly inventory = new Inventory();
  /**
   * The store at camp, with no capacity. Fruit goes here when it is banked,
   * and is winter's food once there is a winter.
   */
  readonly store = new Inventory(Infinity);

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
  }

  static fromSeed(seed: number): World {
    return new World(generateWorld(seed));
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
   * What is carried is banked as if brought home, so ore in the pack becomes
   * gold, fruit goes into the store, and a last trip out is never wasted.
   * Sticks and vines stay in the pack, as they do at camp. Ending out of reach
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
   * Bank what the pack holds that camp can take: ore into gold, fruit into the
   * store. Sticks and vines stay, because until winter can sell them banking
   * them is losing them, and a bridge gets rid of them.
   */
  private bank(): { ore: number; fruit: number; gold: number } {
    const ore = this.inventory.count("ore");
    const fruit = this.inventory.count("fruit");
    const gold = this.inventory.depositOre();
    this.inventory.remove("fruit", fruit);
    this.store.add("fruit", fruit);
    return { ore, fruit, gold };
  }

  /**
   * Start the next summer on the same map.
   *
   * The point of the discovery test is that what you changed stays changed, so
   * the terrain, the gold and the backpack are left exactly as they are. What
   * comes back is the year: every node regrows, hydration refills, the player
   * wakes at camp and the clock restarts.
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
    // A press held across the end of a summer is spent; the new one starts on
    // a fresh press, not mid-cut.
    this.interactSpent = true;
    this.record({ type: "summerStarted", year: this.year });
  }

  /** What the interact key would do from here, or null for nothing in reach. */
  availableAction(): Action | null {
    const { x, y, z } = this.player;
    const atCamp = withinReach(x, y, this.camp);
    const ore = this.inventory.count("ore");
    const fruit = this.inventory.count("fruit");
    // Banking wins at camp, but only when there is something to bank, so a
    // node next to the camp is still harvestable with an empty pack.
    if (atCamp && ore + fruit > 0) return { type: "deposit", ore, fruit, blocked: null };

    const node = nearestNodeWithin(this.nodes, x, y);
    if (node) {
      return { type: "harvest", node, blocked: this.inventory.full ? "backpackFull" : null };
    }

    // Drinking comes before the tools, but only while there is thirst to
    // quench, so a spring beside a thicket does not hide the cut, and the key
    // on a spring's bank lays a bridge when the bar is nearly full.
    if (this.stats.hydration < C.DRINK_OFFER_BELOW) {
      const spring = nearestSpringWithin(this.springs, x, y);
      if (spring) return { type: "drink", x: spring.x, y: spring.y, blocked: null };
    }

    // Tools come after picking, so a vine growing against the thicket that
    // walls it in can still be picked up. They act only on the tile ahead.
    const ahead = tileAhead(this.map, x, y, this.player.heading, z);
    const kind = ahead ? this.map.get(ahead.x, ahead.y, z) : null;
    if (ahead && kind === "thicket") return { type: "cut", x: ahead.x, y: ahead.y, blocked: null };
    if (ahead && kind === "stream") {
      const blocked = this.inventory.has(BRIDGE_COST) ? null : "noMaterials";
      return { type: "build", x: ahead.x, y: ahead.y, blocked };
    }

    if (atCamp) return { type: "deposit", ore: 0, fruit: 0, blocked: "nothingToBank" };
    return null;
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

    if (action.type === "deposit") {
      if (!pressed) return;
      this.interactSpent = true;
      if (action.blocked) this.blocked(action.blocked);
      else this.record({ type: "deposited", ...this.bank() });
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

  /** Carry out a hold that has run its full time. */
  private complete(action: Action): void {
    switch (action.type) {
      case "harvest":
        action.node.harvested = true;
        this.inventory.add(action.node.kind);
        this.record({ type: "harvested", kind: action.node.kind });
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
        if (!this.inventory.has(BRIDGE_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.inventory.pay(BRIDGE_COST);
        this.map.set(action.x, action.y, "bridge", this.player.z);
        this.record({ type: "built", x: action.x, y: action.y });
        return;
      case "deposit":
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
