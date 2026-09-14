import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import { nearestNodeWithin, nearestTileWithin, withinReach } from "./interaction.ts";
import { Inventory } from "./inventory.ts";
import {
  canStand,
  createPlayer,
  facingFor,
  moveWithCollision,
  type Player,
} from "./player.ts";
import { Stats, type Effort } from "./stats.ts";
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
 * press actually does -- so the two can never disagree. `blocked` means the
 * action is the right one here but cannot be carried out: a full backpack, or
 * standing at camp with no ore to hand over.
 */
export type Action =
  | { type: "deposit"; ore: number; blocked: boolean }
  | { type: "harvest"; node: ResourceNode; blocked: boolean }
  | { type: "cut"; x: number; y: number; blocked: boolean }
  | { type: "build"; x: number; y: number; blocked: boolean };

/** What one bridge tile costs. The only recipe in the prototype. */
export const BRIDGE_COST: Partial<Record<ResourceKind, number>> = {
  stick: C.BRIDGE_STICKS,
  vine: C.BRIDGE_VINES,
};

/** Why each action refuses, when it does. */
const BLOCKED_BY: Record<Action["type"], BlockedReason> = {
  deposit: "noOre",
  harvest: "backpackFull",
  cut: "backpackFull", // unreachable: cutting puts nothing in the pack
  build: "noMaterials",
};

/** Seconds of holding the interact key each action takes; 0 for a tap. */
const HOLD_TIME: Record<Action["type"], number> = {
  deposit: 0,
  harvest: C.HARVEST_TIME,
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
  readonly player: Player;
  readonly stats = new Stats();
  readonly inventory = new Inventory();

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
   * Last tick's input, for edge detection. Eating, drinking and dropping off
   * are one-shot: they fire on the press, not for every tick the key is down.
   */
  private held = { interact: false, eat: false, drink: false };
  /**
   * Set when a press has already done its one thing, and cleared on release.
   *
   * Without it, holding the key at camp banks the load and then, now that the
   * pack has no ore, starts picking whatever node happens to stand beside the
   * camp. One press, one action.
   */
  private interactSpent = false;

  constructor(generated: GeneratedWorld) {
    this.seed = generated.seed;
    this.map = generated.map;
    this.camp = generated.camp;
    this.nodes = generated.nodes;
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
    return this.remainingSec <= 0;
  }

  /**
   * Start the next summer on the same map.
   *
   * The point of the discovery test is that what you changed stays changed, so
   * the terrain, the gold and the backpack are left exactly as they are. What
   * comes back is the year: every node regrows, the stats refill, the player
   * wakes at camp and the clock restarts.
   *
   * The event log is kept too, so readers walking it with a cursor carry on
   * from where they were rather than replaying the summer that just ended.
   */
  nextSummer(): void {
    this.year++;
    this.elapsedSec = 0;
    for (const node of this.nodes) node.harvested = false;
    this.stats.stamina = C.STAT_MAX;
    this.stats.hydration = C.STAT_MAX;
    this.stats.stomachCooldownSec = 0;
    this.player.x = this.camp.x;
    this.player.y = this.camp.y;
    this.player.moving = false;
    this.player.sprinting = false;
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
    const { x, y } = this.player;
    const atCamp = withinReach(x, y, this.camp);
    const ore = this.inventory.count("ore");
    // Dropping off wins at camp, but only when there is something to drop off,
    // so a node next to the camp is still harvestable with an empty pack.
    if (atCamp && ore > 0) return { type: "deposit", ore, blocked: false };

    const node = nearestNodeWithin(this.nodes, x, y);
    if (node) return { type: "harvest", node, blocked: this.inventory.full };

    // Tools come after picking, so a vine growing against the thicket that
    // walls it in can still be picked up.
    const thicket = nearestTileWithin(this.map, x, y, "thicket", C.INTERACT_RADIUS, this.player.z);
    if (thicket) return { type: "cut", x: thicket.x, y: thicket.y, blocked: false };

    const stream = nearestTileWithin(this.map, x, y, "stream", C.INTERACT_RADIUS, this.player.z);
    if (stream) {
      return {
        type: "build",
        x: stream.x,
        y: stream.y,
        blocked: !this.inventory.has(BRIDGE_COST),
      };
    }

    if (atCamp) return { type: "deposit", ore: 0, blocked: true };
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

  /** Tiles per second, given terrain, sprinting, and how tired the player is. */
  speed(): number {
    const ground = this.groundUnderPlayer();
    const sprint = this.player.sprinting ? C.SPRINT_MULTIPLIER : 1;
    const tired = this.stats.exhausted ? C.EXHAUSTED_SPEED_MUL : 1;
    return C.WALK_SPEED * ground.speedMul * sprint * tired;
  }

  /**
   * Which stamina rule applies this tick.
   *
   * Read off what the player actually did, not what was asked for: shoving
   * against a tree is standing still, and it recovers stamina like standing
   * still, sprint key or no sprint key.
   */
  private effort(): Effort {
    const player = this.player;
    if (!player.moving) return "standing";
    if (player.sprinting) return "sprinting";
    return this.groundUnderPlayer().difficult ? "difficult" : "walking";
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
   */
  step(dt: number, input: InputState): void {
    this.movePlayer(dt, input);
    this.interact(dt, input);
    this.consume(input);
    this.stats.step(dt, this.effort());
    this.elapsedSec = Math.min(this.elapsedSec + dt, C.SUMMER_LENGTH_SEC);
    this.held = { interact: input.interact, eat: input.eat, drink: input.drink };
  }

  private record(event: WorldEventPayload): void {
    this.events.push({ ...event, at: this.elapsedSec });
  }

  private blocked(reason: BlockedReason): void {
    this.record({ type: "blocked", reason });
  }

  /**
   * Everything on the interact key: picking, cutting, bridging, dropping off.
   *
   * Three of the four are holds, and they are all the same shape. Progress
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
      if (action.blocked) this.blocked("noOre");
      else this.record({ type: "deposited", gold: this.inventory.depositOre() });
      return;
    }

    if (action.blocked) {
      // Say why once, on the press, rather than every tick the key is held.
      if (pressed) {
        this.interactSpent = true;
        this.blocked(BLOCKED_BY[action.type]);
      }
      this.stopHarvesting();
      return;
    }

    // A key identifying what is being held, so that switching target -- to
    // another node, or to the next thicket tile along -- starts the hold over
    // instead of inheriting the last one's progress.
    const key =
      action.type === "harvest" ? `node:${action.node.id}` : `tile:${action.x},${action.y}`;
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
        return;
    }
  }

  private stopHarvesting(): void {
    this.holdKey = "";
    this.harvestProgress = 0;
  }

  /** Eating and drinking, one item per press. */
  private consume(input: InputState): void {
    if (input.eat && !this.held.eat) {
      if (this.inventory.count("fruit") === 0) this.blocked("noFruit");
      else if (!this.stats.canEat) this.blocked("stomachFull");
      else {
        this.inventory.remove("fruit");
        this.stats.eat();
        this.record({ type: "ate" });
      }
    }

    if (input.drink && !this.held.drink) {
      if (this.inventory.count("water") === 0) this.blocked("noWater");
      else {
        this.inventory.remove("water");
        this.stats.drink();
        this.record({ type: "drank" });
      }
    }
  }

  /** Walk the player for one tick, or stand them still if nothing is held. */
  private movePlayer(dt: number, input: InputState): void {
    const player = this.player;
    const wants = input.moveX !== 0 || input.moveY !== 0;
    player.sprinting = input.sprint && wants && this.stats.canSprint;

    if (!wants) {
      player.moving = false;
      return;
    }

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
