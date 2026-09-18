import { Container, Graphics } from "pixi.js";
import * as C from "../config.ts";
import type { Action } from "../sim/world.ts";
import type { Camera } from "./camera.ts";

/**
 * Which tile the interact key would act on, if it would act on a tile at all.
 *
 * Cutting and building act on the tile ahead in the direction last walked, and
 * the first playtest laid a bridge on the wrong tile and paid for it, so the
 * tile says so itself.
 *
 * Harvesting is deliberately not marked: a node is a sprite standing where it
 * is, and the prompt already names what it is.
 */
export interface TargetTile {
  x: number;
  y: number;
  /** The right action here, but not possible: no materials, no axe, water too near. */
  blocked: boolean;
}

/** The actions that work on the tile ahead: the tools, and what is built on grass. */
const TILE_ACTIONS: ReadonlySet<Action["type"]> = new Set(["cut", "fell", "build", "dig", "cache"]);

export function targetTile(action: Action | null): TargetTile | null {
  if (!action || !TILE_ACTIONS.has(action.type)) return null;
  // Every tile action carries its tile; the set above is what says so.
  if (!("x" in action)) return null;
  return { x: action.x, y: action.y, blocked: action.blocked !== null };
}

/**
 * Draws that outline, over everything else.
 *
 * Above the props rather than among them: what it says is "this tile", and a
 * marker a bush can hide is no use on the one terrain that is made of bushes.
 * It is one Graphics, redrawn only when its colour changes -- the position is
 * a container transform, so following the camera costs nothing. How far a hold
 * has got is shown in the prompt under the player, not here.
 */
export class TargetMarker {
  readonly container = new Container();
  private readonly shape = new Graphics();
  /** What the shape currently holds, so an unchanged frame redraws nothing. */
  private drawn = "";

  constructor() {
    this.container.addChild(this.shape);
    this.container.visible = false;
  }

  update(camera: Camera, target: TargetTile | null): void {
    if (!target) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    // Whole pixels, like every other sprite: a half-pixel outline on pixel art
    // reads as a blurred one.
    const at = camera.toScreen({ x: target.x, y: target.y });
    this.container.x = Math.round(at.x);
    this.container.y = Math.round(at.y);

    const key = String(target.blocked);
    if (key === this.drawn) return;
    this.drawn = key;
    this.redraw(target.blocked);
  }

  private redraw(blocked: boolean): void {
    const half = C.TARGET_OUTLINE_PX / 2;
    this.shape.clear();
    this.shape
      .rect(half, half, C.TILE - C.TARGET_OUTLINE_PX, C.TILE - C.TARGET_OUTLINE_PX)
      .stroke({
        width: C.TARGET_OUTLINE_PX,
        color: blocked ? C.TARGET_BLOCKED_COLOR : C.TARGET_COLOR,
        alpha: C.TARGET_OUTLINE_ALPHA,
        alignment: 0.5,
      });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
