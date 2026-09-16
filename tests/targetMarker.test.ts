import { describe, expect, it } from "vitest";
import { TILE } from "../src/config.ts";
import { Camera } from "../src/render/camera.ts";
import { TargetMarker, targetTile } from "../src/render/targetMarker.ts";
import type { Action } from "../src/sim/world.ts";
import type { ResourceNode } from "../src/sim/types.ts";

const node: ResourceNode = { id: 1, kind: "ore", x: 4.5, y: 4.5, z: 0, harvested: false };

describe("targetTile", () => {
  it("marks the tile a cut would land on", () => {
    const action: Action = { type: "cut", x: 12, y: 30, blocked: null };
    expect(targetTile(action, 0.4)).toEqual({ x: 12, y: 30, blocked: false, progress: 0.4 });
  });

  it("marks a bridge that cannot be paid for, so the refusal has a place", () => {
    const action: Action = { type: "build", x: 3, y: 9, blocked: "noMaterials" };
    expect(targetTile(action, 0)).toEqual({ x: 3, y: 9, blocked: true, progress: 0 });
  });

  it("marks nothing for harvesting or banking, which stand somewhere visible", () => {
    expect(targetTile({ type: "harvest", node, blocked: null }, 0.5)).toBeNull();
    expect(targetTile({ type: "deposit", ore: 3, blocked: null }, 0)).toBeNull();
    expect(targetTile({ type: "drink", x: 2, y: 2, blocked: null }, 0.5)).toBeNull();
    expect(targetTile(null, 0)).toBeNull();
  });
});

describe("TargetMarker", () => {
  function cameraAt(x: number, y: number): Camera {
    const camera = new Camera();
    camera.resize(10 * TILE, 10 * TILE);
    camera.centreOn({ x, y });
    return camera;
  }

  it("sits on the target tile, in whole pixels", () => {
    const marker = new TargetMarker();
    const camera = cameraAt(20.5, 20.5);
    marker.update(camera, { x: 22, y: 19, blocked: false, progress: 0 });

    expect(marker.container.visible).toBe(true);
    // The camera centre is 20.5, so tile 22's left edge is 1.5 tiles right of
    // it, and the view is 5 tiles wide either way.
    expect(marker.container.x).toBe(Math.round((22 - 20.5 + 5) * TILE));
    expect(marker.container.y).toBe(Math.round((19 - 20.5 + 5) * TILE));
  });

  it("hides itself when nothing is in reach", () => {
    const marker = new TargetMarker();
    marker.update(cameraAt(20.5, 20.5), { x: 22, y: 19, blocked: false, progress: 0 });
    marker.update(cameraAt(20.5, 20.5), null);
    expect(marker.container.visible).toBe(false);
  });

  it("follows a moving camera without moving the tile it marks", () => {
    // The position is a transform, so tracking the camera costs no redraw.
    const marker = new TargetMarker();
    const target = { x: 22, y: 19, blocked: false, progress: 0 };
    marker.update(cameraAt(20.5, 20.5), target);
    const before = marker.container.x;
    marker.update(cameraAt(21.5, 20.5), target);
    expect(marker.container.x).toBe(before - TILE);
  });
});
