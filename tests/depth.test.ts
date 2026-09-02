import { describe, expect, it } from "vitest";
import { MAP_W } from "../src/config.ts";
import { depthOf } from "../src/render/propLayer.ts";

describe("depthOf", () => {
  it("lets y decide between anything close enough to overlap", () => {
    // Only sprites within a few tiles horizontally can overlap on screen. Over
    // that range even a hundredth of a tile row of y outweighs the x tiebreak.
    const WIDEST_PROP = 8;
    for (let dx = -WIDEST_PROP; dx <= WIDEST_PROP; dx++) {
      expect(depthOf(60 + dx, 10)).toBeLessThan(depthOf(60, 10.01));
      expect(depthOf(60 + dx, 10.01)).toBeGreaterThan(depthOf(60, 10));
    }
  });

  it("still sorts whole tile rows correctly at any x on the map", () => {
    expect(depthOf(MAP_W, 10)).toBeLessThan(depthOf(0, 11));
    expect(depthOf(0, 10)).toBeLessThan(depthOf(MAP_W, 10.5));
  });

  it("breaks ties within a row by x, so the order never depends on draw order", () => {
    expect(depthOf(3, 10)).toBeLessThan(depthOf(4, 10));
    expect(depthOf(0, 10)).toBeLessThan(depthOf(MAP_W - 1, 10));
  });

  it("gives every tile in a row a distinct value", () => {
    const seen = new Set<number>();
    for (let x = 0; x < MAP_W; x++) seen.add(depthOf(x + 0.5, 42));
    expect(seen.size).toBe(MAP_W);
  });

  it("keeps a continuous player position ordered against tile-aligned props", () => {
    // A prop standing on the bottom edge of row 10 is at y = 11.
    const prop = depthOf(20.5, 11);
    expect(depthOf(20.5, 10.9)).toBeLessThan(prop); // player north of it -> behind
    expect(depthOf(20.5, 11.1)).toBeGreaterThan(prop); // player south of it -> in front
  });

  it("has headroom for a map far wider than this one", () => {
    // The 1024 scale is the invariant that makes y dominant; fail loudly if the
    // map ever outgrows it.
    expect(MAP_W).toBeLessThan(1024);
  });
});
