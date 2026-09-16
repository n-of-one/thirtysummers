import { Container, Graphics } from "pixi.js";
import * as C from "../config.ts";
import type { Action } from "../sim/world.ts";
import type { Camera } from "./camera.ts";

/**
 * Which tile the interact key would act on, if it would act on a tile at all.
 *
 * Cutting and building take the nearest tile of the right kind rather than the
 * one the player is facing -- every facing here is diagonal, so there is no
 * such tile -- which leaves the player with no way of telling which of two
 * equally close ones is about to be worked on. The first playtest laid a bridge
 * on the wrong tile and paid for it, so the tile says so itself now.
 *
 * Harvesting is deliberately not marked: a node is a sprite standing where it
 * is, and the prompt already names what it is.
 */
export interface TargetTile {
  x: number;
  y: number;
  /** The right action here, but not possible: no materials for a bridge. */
  blocked: boolean;
  /** How far through the hold, 0 to 1. */
  progress: number;
}

export function targetTile(action: Action | null, progress: number): TargetTile | null {
  if (!action || (action.type !== "cut" && action.type !== "build")) return null;
  return { x: action.x, y: action.y, blocked: action.blocked !== null, progress };
}

/**
 * Draws that outline, over everything else.
 *
 * Above the props rather than among them: what it says is "this tile", and a
 * marker a bush can hide is no use on the one terrain that is made of bushes.
 * It is one Graphics, redrawn only when what it would draw changes -- the
 * position is a container transform, so following the camera costs nothing.
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

    // Quantised to whole pixels of bar, which is all the redraw can express
    // anyway, so a hold costs a few redraws rather than one a frame.
    const barPx = Math.round(target.progress * C.TILE);
    const key = `${target.blocked}:${barPx}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.redraw(target.blocked, barPx);
  }

  /**
   * The outline, and a bar along the bottom of the tile that fills as the hold
   * runs -- the progress for the action, put where the action is rather than
   * under the player, which is the whole point of the marker.
   *
   * A bar and not a wash over the tile. A fill pale enough to see the ground
   * through still lightens a thicket until it reads as ground already cut,
   * which is precisely the thing the marker exists to be unambiguous about.
   */
  private redraw(blocked: boolean, barPx: number): void {
    const colour = blocked ? C.TARGET_BLOCKED_COLOR : C.TARGET_COLOR;
    const half = C.TARGET_OUTLINE_PX / 2;
    this.shape.clear();
    if (barPx > 0) {
      this.shape
        .rect(0, C.TILE - C.TARGET_PROGRESS_PX, barPx, C.TARGET_PROGRESS_PX)
        .fill({ color: colour, alpha: C.TARGET_OUTLINE_ALPHA });
    }
    this.shape
      .rect(half, half, C.TILE - C.TARGET_OUTLINE_PX, C.TILE - C.TARGET_OUTLINE_PX)
      .stroke({
        width: C.TARGET_OUTLINE_PX,
        color: colour,
        alpha: C.TARGET_OUTLINE_ALPHA,
        alignment: 0.5,
      });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
