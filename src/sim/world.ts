import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import { nearestNodeWithin, withinReach } from "./interaction.ts";
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
  | { type: "harvest"; node: ResourceNode; blocked: boolean };

/**
 * The whole simulation. Owns the map and everything on it, and advances by
 * fixed steps. Nothing here touches Pixi or the DOM, so a day can be played out
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

  /** Seconds of the day already spent. Stops at DAY_LENGTH_SEC. */
  elapsedSec = 0;

  /** Append-only log of what happened. Readers keep their own cursor. */
  readonly events: WorldEvent[] = [];

  /** How far through harvesting the current node, 0 to 1. */
  harvestProgress = 0;
  /** Which node that progress belongs to; 0 when nothing is being harvested. */
  private harvestingId = 0;

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

  /** Seconds left before the day ends. Never negative. */
  get remainingSec(): number {
    return C.DAY_LENGTH_SEC - this.elapsedSec;
  }

  get dayOver(): boolean {
    return this.remainingSec <= 0;
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
   * The distance is not walked, so it does not count towards the day's total,
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
   * other: hydration drains whether or not you are walking, and the day runs
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
    this.elapsedSec = Math.min(this.elapsedSec + dt, C.DAY_LENGTH_SEC);
    this.held = { interact: input.interact, eat: input.eat, drink: input.drink };
  }

  private record(event: WorldEventPayload): void {
    this.events.push({ ...event, at: this.elapsedSec });
  }

  private blocked(reason: BlockedReason): void {
    this.record({ type: "blocked", reason });
  }

  /**
   * Harvesting and dropping off, both on the interact key.
   *
   * Harvesting is a hold: progress builds while the key is down and the same
   * node stays in reach, and is thrown away the moment either stops being true.
   * Walking away mid-pick loses the pick, which is the whole point of a timer.
   * Dropping off is a tap, because there is nothing to feel your way through.
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
        this.blocked("backpackFull");
      }
      this.stopHarvesting();
      return;
    }

    const node = action.node;
    if (this.harvestingId !== node.id) {
      this.harvestingId = node.id;
      this.harvestProgress = 0;
    }
    this.harvestProgress += dt / C.HARVEST_TIME;
    if (this.harvestProgress < 1) return;

    node.harvested = true;
    this.inventory.add(node.kind);
    this.record({ type: "harvested", kind: node.kind });
    this.stopHarvesting();
  }

  private stopHarvesting(): void {
    this.harvestingId = 0;
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
