import { PLAYER_RADIUS } from "../config.ts";
import type { TileMap } from "./tilemap.ts";
import type { Facing, Vec2 } from "./types.ts";

export interface Player {
  x: number;
  y: number;
  z: number;
  facing: Facing;
  /**
   * The last direction the input asked for, one of eight, as a unit vector.
   * Kept while standing still, and null until the first step. Tools aim along
   * it; the sprite's facing cannot, since every pose in the art is diagonal.
   */
  heading: Vec2 | null;
  /** True while actually moving, not merely while a key is held. */
  moving: boolean;
  /**
   * Total distance walked, in tiles. The walk cycle is driven by this rather
   * than by elapsed time so footfalls stay in step with actual speed -- a
   * player wading through mud takes slower strides for free.
   */
  distanceWalked: number;
}

export function createPlayer(spawn: Vec2, z = 0): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    z,
    facing: "southEast",
    heading: null,
    moving: false,
    distanceWalked: 0,
  };
}

/**
 * Can a player centred here stand without overlapping an impassable tile?
 *
 * The player is treated as a square of side 2*PLAYER_RADIUS. Out-of-bounds
 * tiles read as rock, so the world edge needs no special case.
 */
export function canStand(map: TileMap, x: number, y: number, z = 0): boolean {
  const r = PLAYER_RADIUS;
  const minX = Math.floor(x - r);
  const maxX = Math.floor(x + r);
  const minY = Math.floor(y - r);
  const maxY = Math.floor(y + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!map.isPassable(tx, ty, z)) return false;
    }
  }
  return true;
}

/**
 * Move by (dx, dy), resolving each axis separately.
 *
 * Testing the axes independently means running into a wall diagonally slides
 * along it instead of stopping dead, which is what makes walking past trees
 * feel right. Returns the distance actually travelled.
 */
export function moveWithCollision(map: TileMap, player: Player, dx: number, dy: number): number {
  const startX = player.x;
  const startY = player.y;
  if (dx !== 0 && canStand(map, player.x + dx, player.y, player.z)) player.x += dx;
  if (dy !== 0 && canStand(map, player.x, player.y + dy, player.z)) player.y += dy;
  return Math.hypot(player.x - startX, player.y - startY);
}

/**
 * The eight-way heading a movement input asks for, or null for no input.
 *
 * Built from the signs alone, so an analogue stick that is nearly straight
 * still aims straight, and normalised, so a diagonal aims as far ahead as a
 * straight line does.
 */
export function headingFor(dx: number, dy: number): Vec2 | null {
  const x = Math.sign(dx);
  const y = Math.sign(dy);
  if (x === 0 && y === 0) return null;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

/**
 * Pick a facing from a movement vector.
 *
 * Walking straight left or right deliberately uses a downward pose rather than
 * keeping whatever vertical component was last set: those are the only sprites
 * that show the character's face, and losing eye contact while running along a
 * row reads as the character turning its back for no reason.
 *
 * Walking straight up or down has no such problem, so it keeps the horizontal
 * component it already had instead of snapping to one side.
 */
export function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  const east = dx > 0 ? true : dx < 0 ? false : current.endsWith("East");
  const south = dy > 0 ? true : dy < 0 ? false : true;
  if (south) return east ? "southEast" : "southWest";
  return east ? "northEast" : "northWest";
}
