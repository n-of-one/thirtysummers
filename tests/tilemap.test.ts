import { describe, expect, it } from "vitest";
import { TileMap } from "../src/sim/tilemap.ts";

describe("TileMap", () => {
  it("defaults every tile to grass", () => {
    const map = new TileMap(4, 4);
    expect(map.get(0, 0)).toBe("grass");
    expect(map.histogram().grass).toBe(16);
  });

  it("round-trips terrain through set/get", () => {
    const map = new TileMap(4, 4);
    map.set(2, 3, "stream");
    expect(map.get(2, 3)).toBe("stream");
    expect(map.get(3, 2)).toBe("grass");
  });

  it("treats everything outside the map as impassable rock", () => {
    const map = new TileMap(4, 4);
    expect(map.get(-1, 0)).toBe("rock");
    expect(map.get(0, 99)).toBe("rock");
    expect(map.isPassable(-1, -1)).toBe(false);
    expect(map.inBounds(4, 0)).toBe(false);
  });

  it("keeps z-layers independent", () => {
    const map = new TileMap(4, 4, 3);
    map.set(1, 1, "tree", 0);
    map.set(1, 1, "mud", 2);
    expect(map.get(1, 1, 0)).toBe("tree");
    expect(map.get(1, 1, 1)).toBe("grass");
    expect(map.get(1, 1, 2)).toBe("mud");
  });

  it("reports passability from the terrain table", () => {
    const map = new TileMap(3, 1);
    map.set(0, 0, "grass");
    map.set(1, 0, "underbrush");
    map.set(2, 0, "tree");
    expect(map.isPassable(0, 0)).toBe(true);
    expect(map.isPassable(1, 0)).toBe(true);
    expect(map.isPassable(2, 0)).toBe(false);
    expect(map.def(1, 0).difficult).toBe(true);
    expect(map.def(0, 0).difficult).toBe(false);
  });

  it("resolves float world positions to the containing tile", () => {
    const map = new TileMap(4, 4);
    map.set(2, 2, "mud");
    expect(map.defAt(2.9, 2.1).kind).toBe("mud");
    expect(map.defAt(3.0, 2.1).kind).toBe("grass");
  });
});
