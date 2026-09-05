import { describe, expect, it } from "vitest";
import { TILE } from "../src/config.ts";
import { ScrollWindow } from "../src/render/scrollWindow.ts";

/** The margins the two layers actually use. */
const GROUND = { left: 1, top: 1, right: 1, bottom: 1 };
const PROPS = { left: 2, top: 2, right: 2, bottom: 4 };

describe("ScrollWindow", () => {
  it("covers the viewport plus its margins", () => {
    const ground = new ScrollWindow(GROUND);
    ground.resize(20 * TILE, 10 * TILE);
    expect(ground.cols).toBe(22);
    expect(ground.rows).toBe(12);

    const props = new ScrollWindow(PROPS);
    props.resize(20 * TILE, 10 * TILE);
    expect(props.cols).toBe(24);
    expect(props.rows).toBe(16);
  });

  it("rounds a part-tile viewport up, so the last row is never half drawn", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE + 1, 10 * TILE - 1);
    expect(w.cols).toBe(23);
    expect(w.rows).toBe(12);
  });

  it("only reports a resize when the grid actually changes shape", () => {
    const w = new ScrollWindow(GROUND);
    expect(w.resize(20 * TILE, 10 * TILE)).toBe(true);
    expect(w.resize(20 * TILE, 10 * TILE)).toBe(false);
    // Same tile count, a few pixels wider: the pool still fits.
    expect(w.resize(20 * TILE - 3, 10 * TILE)).toBe(false);
    expect(w.resize(21 * TILE, 10 * TILE)).toBe(true);
  });

  it("forces a refill after a resize, even if the camera has not moved", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE, 10 * TILE);
    w.moveTo(500, 500);
    expect(w.moveTo(500, 500)).toBe(false);
    w.resize(30 * TILE, 10 * TILE);
    expect(w.moveTo(500, 500)).toBe(true);
  });

  it("reports a move only when the camera crosses a tile boundary", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE, 10 * TILE);
    expect(w.moveTo(10 * TILE, 10 * TILE)).toBe(true); // first call always moves
    expect(w.moveTo(10 * TILE + 1, 10 * TILE)).toBe(false);
    expect(w.moveTo(11 * TILE - 1, 10 * TILE)).toBe(false);
    expect(w.moveTo(11 * TILE, 10 * TILE)).toBe(true);
  });

  it("puts the origin a whole margin outside the view, so tiles scroll in drawn", () => {
    const w = new ScrollWindow(PROPS);
    w.resize(20 * TILE, 10 * TILE);
    w.moveTo(30 * TILE, 12 * TILE);
    expect(w.originX).toBe(28); // 30 - left margin of 2
    expect(w.originY).toBe(10);
  });

  it("offsets the container so a tile lands where the camera says it should", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE, 10 * TILE);
    // A camera part way through a tile, the case the offset exists for.
    const leftPx = 30 * TILE + 19;
    const topPx = 12 * TILE + 7;
    w.moveTo(leftPx, topPx);

    for (const [tileX, tileY] of [
      [29, 11],
      [30, 12],
      [44, 20],
    ]) {
      const slotX = (tileX! - w.originX) * TILE + w.offsetX;
      const slotY = (tileY! - w.originY) * TILE + w.offsetY;
      // Where that tile belongs on screen, straight from the camera.
      expect(slotX).toBeCloseTo(tileX! * TILE - leftPx, 6);
      expect(slotY).toBeCloseTo(tileY! * TILE - topPx, 6);
    }
  });

  it("keeps the offset within one tile, so the grid never drifts off screen", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE, 10 * TILE);
    for (let px = 0; px < 8 * TILE; px += 7) {
      w.moveTo(px, px * 1.5);
      // Slot (0,0) sits a whole margin above and left of the view, no further.
      expect(w.offsetX).toBeLessThanOrEqual(-GROUND.left * TILE);
      expect(w.offsetX).toBeGreaterThan(-(GROUND.left + 1) * TILE);
      expect(w.offsetY).toBeLessThanOrEqual(-GROUND.top * TILE);
      expect(w.offsetY).toBeGreaterThan(-(GROUND.top + 1) * TILE);
    }
  });

  it("covers every tile it holds a sprite for, and nothing far outside", () => {
    const w = new ScrollWindow(PROPS);
    w.resize(20 * TILE, 10 * TILE);
    w.moveTo(30 * TILE, 12 * TILE);

    expect(w.covers(w.originX, w.originY)).toBe(true);
    expect(w.covers(w.originX + w.cols, w.originY + w.rows)).toBe(true);
    expect(w.covers(w.originX - 0.5, w.originY)).toBe(false);
    expect(w.covers(w.originX, w.originY - 0.5)).toBe(false);
    expect(w.covers(w.originX + w.cols + 1, w.originY)).toBe(false);
    expect(w.covers(w.originX, w.originY + w.rows + 1)).toBe(false);
  });

  it("covers the whole visible area, margins included", () => {
    const w = new ScrollWindow(GROUND);
    w.resize(20 * TILE, 10 * TILE);
    const leftPx = 30 * TILE + 19;
    const topPx = 12 * TILE + 7;
    w.moveTo(leftPx, topPx);

    // Every tile touching the viewport must have a sprite standing for it.
    for (let y = Math.floor(topPx / TILE); y <= Math.floor((topPx + 10 * TILE) / TILE); y++) {
      for (let x = Math.floor(leftPx / TILE); x <= Math.floor((leftPx + 20 * TILE) / TILE); x++) {
        expect(w.covers(x, y)).toBe(true);
        const col = x - w.originX;
        const row = y - w.originY;
        expect(col).toBeGreaterThanOrEqual(0);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(w.cols);
        expect(row).toBeLessThan(w.rows);
      }
    }
  });
});
