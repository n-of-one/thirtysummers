import { describe, expect, it } from "vitest";
import { Camera } from "../src/render/camera.ts";
import { TILE } from "../src/config.ts";

/** A camera showing 20x10 tiles. */
function view(): Camera {
  const camera = new Camera();
  camera.resize(20 * TILE, 10 * TILE);
  return camera;
}

describe("Camera", () => {
  it("puts the centred target in the middle of the view", () => {
    const camera = view();
    camera.centreOn({ x: 40, y: 40 });
    expect(camera.toScreen({ x: 40, y: 40 })).toEqual({
      x: camera.viewWidthPx / 2,
      y: camera.viewHeightPx / 2,
    });
  });

  it("clamps to the map edges so the border never scrolls off", () => {
    const camera = view();

    camera.centreOn({ x: 0, y: 0 });
    camera.clampTo(128, 128);
    expect(camera.x).toBe(10); // half of 20 tiles
    expect(camera.y).toBe(5);
    expect(camera.leftPx).toBe(0);
    expect(camera.topPx).toBe(0);

    camera.centreOn({ x: 999, y: 999 });
    camera.clampTo(128, 128);
    expect(camera.x).toBe(118);
    expect(camera.y).toBe(123);
    expect(camera.leftPx).toBe(128 * TILE - camera.viewWidthPx);
    expect(camera.topPx).toBe(128 * TILE - camera.viewHeightPx);
  });

  it("leaves an interior position untouched", () => {
    const camera = view();
    camera.centreOn({ x: 64, y: 64 });
    camera.clampTo(128, 128);
    expect(camera.x).toBe(64);
    expect(camera.y).toBe(64);
  });

  it("centres a map smaller than the view instead of clamping", () => {
    const camera = view();
    camera.centreOn({ x: 0, y: 0 });
    camera.clampTo(8, 4); // narrower and shorter than 20x10
    expect(camera.x).toBe(4);
    expect(camera.y).toBe(2);
  });

  it("eases towards a followed target without overshooting", () => {
    const camera = view();
    camera.centreOn({ x: 0, y: 0 });
    const target = { x: 10, y: 0 };
    for (let i = 0; i < 200; i++) camera.follow(target, 1 / 60);
    expect(camera.x).toBeCloseTo(10, 5);

    const half = view();
    half.centreOn({ x: 0, y: 0 });
    half.follow(target, 1 / 60);
    expect(half.x).toBeGreaterThan(0);
    expect(half.x).toBeLessThan(10);
  });

  it("keeps toScreen consistent with the view origin", () => {
    const camera = view();
    camera.centreOn({ x: 30.25, y: 12.5 });
    const screen = camera.toScreen({ x: 31.25, y: 13.5 });
    expect(screen.x).toBeCloseTo(camera.viewWidthPx / 2 + TILE, 6);
    expect(screen.y).toBeCloseTo(camera.viewHeightPx / 2 + TILE, 6);
  });
});
