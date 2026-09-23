import { describe, expect, it } from "vitest";
import { turnPixels } from "../src/render/packs/minifantasy.sheets.ts";

/** A 2x2 cell with each pixel's red channel set to its label, 1 to 4. */
const cell = (labels: readonly number[]) =>
  new Uint8ClampedArray(labels.flatMap((r) => [r, 0, 0, 255]));
const reds = (pixels: Uint8ClampedArray) => [...pixels].filter((_, i) => i % 4 === 0);

describe("turnPixels", () => {
  // 1 2
  // 3 4
  const art = cell([1, 2, 3, 4]);

  it("turns a quarter clockwise", () => {
    // 3 1
    // 4 2
    expect(reds(turnPixels(art, 2, 1))).toEqual([3, 1, 4, 2]);
  });

  it("turns three quarters the other way round", () => {
    // 2 4
    // 1 3
    expect(reds(turnPixels(art, 2, 3))).toEqual([2, 4, 1, 3]);
  });

  it("keeps every pixel, and four turns come back", () => {
    let turned = art;
    for (let i = 0; i < 4; i++) turned = turnPixels(turned, 2, 1);
    expect([...turned]).toEqual([...art]);
  });
});
