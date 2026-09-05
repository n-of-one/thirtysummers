import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import {
  createPlayer,
  facingFor,
  moveWithCollision,
  type Player,
} from "./player.ts";
import type { TileMap } from "./tilemap.ts";
import type { TerrainDef } from "./terrain.ts";
import type { ResourceNode, Vec2 } from "./types.ts";
import { generateWorld, type GeneratedWorld } from "./worldgen.ts";

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

  /** Terrain the player is currently standing on. */
  groundUnderPlayer(): TerrainDef {
    return this.map.defAt(this.player.x, this.player.y, this.player.z);
  }

  /** Tiles per second, given terrain and whether the player is sprinting. */
  speed(): number {
    const ground = this.groundUnderPlayer();
    const sprint = this.player.sprinting ? C.SPRINT_MULTIPLIER : 1;
    return C.WALK_SPEED * ground.speedMul * sprint;
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
  }

  /** Walk the player for one tick, or stand them still if nothing is held. */
  private movePlayer(dt: number, input: InputState): void {
    const player = this.player;
    const wants = input.moveX !== 0 || input.moveY !== 0;
    player.sprinting = input.sprint && wants;

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
