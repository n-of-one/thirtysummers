import { describe, expect, it } from "vitest";
import {
  CAMP_GLYPH,
  MapFileError,
  WELL_GLYPH,
  formatMap,
  parseMap,
} from "../src/sim/mapfile.ts";
import { RESOURCE_KINDS, RESOURCES } from "../src/sim/resources.ts";
import { TERRAIN, TERRAIN_ORDER } from "../src/sim/terrain.ts";
import { generateWorld } from "../src/sim/worldgen.ts";

const SEEDS = [1337, 42];

describe("the terrain table", () => {
  it("ends with the kinds added since the generator, in the order they came", () => {
    // The grid stores indices into this order, so anything inserted rather
    // than appended silently rewrites every map file ever dumped.
    // The spring was the last, and removing the last entry moves no index.
    expect(TERRAIN_ORDER.slice(-5)).toEqual(["thicket", "bridge", "sapling", "denseUnderbrush", "cliff"]);
  });

  it("gives every terrain, resource, the camp and the well a distinct glyph", () => {
    const glyphs = [
      ...TERRAIN_ORDER.map((kind) => TERRAIN[kind].glyph),
      ...RESOURCE_KINDS.map((kind) => RESOURCES[kind].glyph),
      CAMP_GLYPH,
      WELL_GLYPH,
    ];
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("makes a sapling a wall", () => {
    expect(TERRAIN.sapling.passable).toBe(false);
    expect(TERRAIN.sapling.glyph).toBe("t");
  });

  it("makes a thicket a wall and a bridge a fast crossing", () => {
    expect(TERRAIN.thicket.passable).toBe(false);
    expect(TERRAIN.bridge.passable).toBe(true);
    expect(TERRAIN.bridge.difficult).toBe(false);
    expect(TERRAIN.bridge.speedMul).toBe(1);
  });
});

describe("parseMap / formatMap", () => {
  it.each(SEEDS)("round trips a generated world (seed %i)", (seed) => {
    const generated = generateWorld(seed);
    const parsed = parseMap(formatMap(generated));

    expect(parsed.map.width).toBe(generated.map.width);
    expect(parsed.map.height).toBe(generated.map.height);
    expect(parsed.camp).toEqual(generated.camp);
    expect(formatMap(parsed)).toBe(formatMap(generated));

    // Nodes come back in reading order rather than generation order, so
    // compare them as a set of positions and kinds.
    const key = (n: { kind: string; x: number; y: number }) => `${n.kind}@${n.x},${n.y}`;
    expect(new Set(parsed.nodes.map(key))).toEqual(new Set(generated.nodes.map(key)));
  });

  it.each(SEEDS)("agrees with the generator about what is reachable (seed %i)", (seed) => {
    const generated = generateWorld(seed);
    const parsed = parseMap(formatMap(generated));
    expect(Array.from(parsed.reachable)).toEqual(Array.from(generated.reachable));
  });

  it("infers the ground under each node glyph", () => {
    const world = parseMap(["#####", "#fyC#", "#v.s#", "#####"].join("\n"));
    // Every resource but the vine stands on grass; a vine means the mud pocket
    // it grows in, which is the barrier it sits behind.
    expect(world.map.get(1, 1)).toBe("grass");
    expect(world.map.get(2, 1)).toBe("mud");
    expect(world.map.get(3, 1)).toBe("grass");
    expect(world.map.get(1, 2)).toBe("grass");
    expect(world.map.get(3, 2)).toBe("grass");
    expect(world.nodes.map((n) => n.kind)).toEqual(["fruit", "vine", "ore", "stick"]);
    expect(world.camp).toEqual({ x: 3.5, y: 1.5 });
  });

  it("round trips the resource table: every kind's glyph and ground, and a sapling", () => {
    const row = RESOURCE_KINDS.map((kind) => RESOURCES[kind].glyph).join("");
    const text = `${row}Ct\n`;
    const world = parseMap(text);
    expect(world.nodes.map((n) => n.kind)).toEqual(RESOURCE_KINDS);
    RESOURCE_KINDS.forEach((kind, x) => expect(world.map.get(x, 0)).toBe(RESOURCES[kind].ground));
    expect(world.map.get(RESOURCE_KINDS.length + 1, 0)).toBe("sapling");
    expect(formatMap(world)).toBe(text);
  });

  it("keeps a well from the file as a spring, and writes it back", () => {
    const text = ["#####", "#C.W#", "#####"].join("\n");
    const world = parseMap(text);
    expect(world.springs).toEqual([{ x: 3, y: 1, well: true }]);
    expect(world.map.get(3, 1)).toBe("grass");
    expect(formatMap(world)).toBe(`${text}\n`);
  });

  it("no longer knows the spring glyph or the old water glyph", () => {
    expect(() => parseMap(["#####", "#Co.#", "#####"].join("\n"))).toThrow(/unknown glyph "o"/);
    expect(() => parseMap(["###", "#Cw", "###"].join("\n"))).toThrow(/unknown glyph "w"/);
  });

  it("places springs on the bank itself, the same ones every load, and writes none", () => {
    const text = [
      "############",
      "#C.........#",
      "#..........#",
      "#..........#",
      "#.....====.#",
      "#.....====.#",
      "#..........#",
      "############",
    ].join("\n");
    const a = parseMap(text);
    const b = parseMap(text);
    expect(a.springs.length).toBeGreaterThan(0);
    expect(a.springs).toEqual(b.springs);
    for (const s of a.springs) {
      expect(s.y === 3 || s.y === 6 || s.x === 5 || s.x === 10).toBe(true);
    }
    expect(formatMap(a)).toBe(`${text}\n`);
  });

  it("reads the new terrain back", () => {
    const world = parseMap(["%%%", "%C-", "%%%"].join("\n"));
    expect(world.map.get(0, 0)).toBe("thicket");
    expect(world.map.get(2, 1)).toBe("bridge");
    expect(world.map.isPassable(0, 0)).toBe(false);
    expect(world.map.isPassable(2, 1)).toBe(true);
  });

  it("tolerates a trailing newline, because every editor writes one", () => {
    expect(parseMap("..C..\n.....\n").map.height).toBe(2);
  });

  it("refuses a map with no camp", () => {
    expect(() => parseMap(".....")).toThrow(MapFileError);
  });

  it("refuses a second camp, and says where it is", () => {
    expect(() => parseMap(".C.\n.C.")).toThrow(/line 2, column 2/);
  });

  it("refuses a ragged map, and says which line", () => {
    expect(() => parseMap("..C..\n...")).toThrow(/line 2 is 3 tiles wide/);
  });

  it("refuses an unknown glyph, and says where", () => {
    expect(() => parseMap("..C\n.X.")).toThrow(/line 2, column 2: unknown glyph "X"/);
  });
});
