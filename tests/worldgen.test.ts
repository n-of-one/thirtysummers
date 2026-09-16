import { describe, expect, it } from "vitest";
import { generateWorld, reachableFrom } from "../src/sim/worldgen.ts";
import { TERRAIN } from "../src/sim/terrain.ts";
import * as C from "../src/config.ts";

const SEEDS = [1, 42, 1337, 20260902];

describe("generateWorld", () => {
  it("is deterministic for a given seed", () => {
    const a = generateWorld(1337);
    const b = generateWorld(1337);
    expect(Array.from(a.map.layerData())).toEqual(Array.from(b.map.layerData()));
    expect(a.camp).toEqual(b.camp);
    expect(a.nodes).toEqual(b.nodes);
  });

  it("produces different worlds for different seeds", () => {
    const a = generateWorld(1);
    const b = generateWorld(2);
    expect(Array.from(a.map.layerData())).not.toEqual(Array.from(b.map.layerData()));
  });

  it("has the requested dimensions", () => {
    const w = generateWorld(1337);
    expect(w.map.width).toBe(C.MAP_W);
    expect(w.map.height).toBe(C.MAP_H);
    expect(w.map.layers).toBe(C.MAP_LAYERS);
  });

  it.each(SEEDS)("seals the playable area with a rock border (seed %i)", (seed) => {
    const { map } = generateWorld(seed);
    for (let x = 0; x < map.width; x++) {
      for (let t = 0; t < C.BORDER_THICKNESS; t++) {
        expect(map.get(x, t)).toBe("rock");
        expect(map.get(x, map.height - 1 - t)).toBe("rock");
      }
    }
    for (let y = 0; y < map.height; y++) {
      for (let t = 0; t < C.BORDER_THICKNESS; t++) {
        expect(map.get(t, y)).toBe("rock");
        expect(map.get(map.width - 1 - t, y)).toBe("rock");
      }
    }
  });

  it.each(SEEDS)("keeps terrain proportions playable (seed %i)", (seed) => {
    const { map } = generateWorld(seed);
    const total = map.width * map.height;
    const hist = map.histogram();
    const share = (n: number) => n / total;

    // Enough open ground to travel, enough obstruction to make routing matter.
    expect(share(hist.grass)).toBeGreaterThan(0.3);
    expect(share(hist.grass)).toBeLessThan(0.75);
    expect(share(hist.tree)).toBeGreaterThan(0.02);
    expect(share(hist.underbrush)).toBeGreaterThan(0.05);
    expect(share(hist.stream)).toBeGreaterThan(0.005);

    const passable = Object.entries(hist)
      .filter(([k]) => TERRAIN[k as keyof typeof TERRAIN].passable)
      .reduce((sum, [, n]) => sum + n, 0);
    expect(share(passable)).toBeGreaterThan(0.6);
  });

  it.each(SEEDS)("leaves almost all passable ground reachable from camp (seed %i)", (seed) => {
    const { map, camp } = generateWorld(seed);
    const reachable = reachableFrom(map, camp);
    let passable = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) if (map.isPassable(x, y)) passable++;
    }
    const reached = reachable.reduce((a: number, b: number) => a + b, 0);
    // Ford carving should connect everything but a few tiny pockets.
    expect(reached / passable).toBeGreaterThan(0.95);
  });

  it.each(SEEDS)("puts camp on open, passable ground (seed %i)", (seed) => {
    const { map, camp } = generateWorld(seed);
    const cx = Math.floor(camp.x);
    const cy = Math.floor(camp.y);
    expect(map.isPassable(cx, cy)).toBe(true);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(map.isPassable(cx + dx, cy + dy)).toBe(true);
      }
    }
  });

  it.each(SEEDS)("places every requested resource somewhere usable (seed %i)", (seed) => {
    const { map, nodes, reachable, camp } = generateWorld(seed);
    // The generator scatters the three original kinds; vines and sticks are
    // placed by hand in the edited maps, so nothing here should produce them.
    const counts: Record<string, number> = { fruit: 0, water: 0, ore: 0 };
    const occupied = new Set<number>();

    for (const node of nodes) {
      counts[node.kind] = (counts[node.kind] ?? 0) + 1;
      const x = Math.floor(node.x);
      const y = Math.floor(node.y);
      const idx = y * map.width + x;

      expect(map.isPassable(x, y)).toBe(true);
      expect(reachable[idx]).toBe(1);
      expect(occupied.has(idx)).toBe(false); // one node per tile
      occupied.add(idx);
      expect(idx).not.toBe(Math.floor(camp.y) * map.width + Math.floor(camp.x));
    }

    expect(counts.fruit).toBe(C.FRUIT_NODES);
    expect(counts.ore).toBe(C.ORE_NODES);
  });

  it("grows fruit at the forest edge", () => {
    const { map, nodes } = generateWorld(1337);
    const touches = (x: number, y: number, kind: string) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (map.get(x + dx, y + dy) === kind) return true;
        }
      }
      return false;
    };
    for (const node of nodes) {
      const x = Math.floor(node.x);
      const y = Math.floor(node.y);
      if (node.kind === "fruit") expect(touches(x, y, "tree")).toBe(true);
    }
  });

  it("puts springs on walkable bank tiles, spaced apart, clear of camp and nodes", () => {
    for (const seed of SEEDS) {
      const { map, camp, nodes, springs } = generateWorld(seed);
      expect(springs.length).toBeGreaterThan(5);
      const nodeTiles = new Set(nodes.map((n) => `${Math.floor(n.x)},${Math.floor(n.y)}`));
      for (const s of springs) {
        expect(map.isPassable(s.x, s.y)).toBe(true);
        expect(map.get(s.x, s.y)).not.toBe("bridge");
        let touches = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (map.get(s.x + dx, s.y + dy) === "stream") touches = true;
          }
        }
        expect(touches).toBe(true);
        expect(nodeTiles.has(`${s.x},${s.y}`)).toBe(false);
        const fromCamp = Math.max(Math.abs(s.x + 0.5 - camp.x), Math.abs(s.y + 0.5 - camp.y));
        expect(fromCamp).toBeGreaterThanOrEqual(C.SPRING_CAMP_CLEARANCE);
        for (const t of springs) {
          if (t === s) continue;
          expect(Math.max(Math.abs(t.x - s.x), Math.abs(t.y - s.y))).toBeGreaterThanOrEqual(
            C.SPRING_SPACING_TILES,
          );
        }
      }
    }
  });

  it("places the same springs for the same seed, and others for another", () => {
    expect(generateWorld(42).springs).toEqual(generateWorld(42).springs);
    expect(generateWorld(42).springs).not.toEqual(generateWorld(43).springs);
  });

  it("leaves no spring terrain in the table", () => {
    expect(Object.keys(TERRAIN)).not.toContain("spring");
  });

  it("generates a full map quickly enough to regenerate interactively", () => {
    const t0 = performance.now();
    generateWorld(4321);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("forest shape", () => {
  it.each(SEEDS)("scatters trees instead of filling solid blocks (seed %i)", (seed) => {
    const { map } = generateWorld(seed);
    let solid3x3 = 0;
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        let all = true;
        for (let dy = -1; dy <= 1 && all; dy++) {
          for (let dx = -1; dx <= 1 && all; dx++) {
            if (map.get(x + dx, y + dy) !== "tree") all = false;
          }
        }
        if (all) solid3x3++;
      }
    }
    // A wood you can never step into is the thing this replaced.
    expect(solid3x3).toBe(0);
  });

  it.each(SEEDS)("leaves gaps around most trees (seed %i)", (seed) => {
    const { map } = generateWorld(seed);
    let trees = 0;
    let treeNeighbours = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) !== "tree") continue;
        trees++;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (map.get(x + dx, y + dy) === "tree") treeNeighbours++;
          }
        }
      }
    }
    expect(trees).toBeGreaterThan(100);
    // Solid canopy would average close to 8; scattered trees sit well below.
    expect(treeNeighbours / trees).toBeLessThan(3);
  });

  it.each(SEEDS)("stands trees on an underbrush floor (seed %i)", (seed) => {
    const { map } = generateWorld(seed);
    const around: Record<string, number> = {};
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) !== "tree") continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const kind = map.get(x + dx, y + dy);
          if (kind !== "tree") around[kind] = (around[kind] ?? 0) + 1;
        }
      }
    }
    const total = Object.values(around).reduce((a, b) => a + b, 0);
    // The doc calls for trees surrounded by underbrush; most neighbours are.
    expect((around.underbrush ?? 0) / total).toBeGreaterThan(0.7);
  });
});

const SQUARE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [-1, 0],
  [0, 0],
] as const;

describe("stream shape", () => {
  /**
   * A stream that only touches itself at a corner is both undrawable -- no edge
   * piece fits a tile with no orthogonal neighbour of its own kind -- and not a
   * barrier, since the player can slip through the gap.
   */
  it("never steps diagonally without filling the corner", () => {
    for (const seed of SEEDS) {
      const { map } = generateWorld(seed);
      const isStream = (x: number, y: number) => map.get(x, y) === "stream";
      let corners = 0;
      for (let y = 0; y < map.height - 1; y++) {
        for (let x = 0; x < map.width - 1; x++) {
          for (const [ax, ay, bx, by] of [
            [x, y, x + 1, y + 1],
            [x + 1, y, x, y + 1],
          ] as const) {
            if (!isStream(ax, ay) || !isStream(bx, by)) continue;
            if (isStream(ax, by) || isStream(bx, ay)) continue;
            corners++;
          }
        }
      }
      expect(corners, `seed ${seed}`).toBe(0);
    }
  });

  it("is never one tile across", () => {
    // Two tiles across, on a grid, means every tile AND every neighbouring pair
    // of tiles sits inside some 2x2 square of water. The pairs are the part that
    // matters: a channel can pass the tile test on both sides of a sideways step
    // and still funnel the whole flow through one tile's width at the step.
    for (const seed of SEEDS) {
      const { map } = generateWorld(seed);
      const isStream = (x: number, y: number) => map.get(x, y) === "stream";
      const inSquare = (parts: readonly (readonly [number, number])[]) => {
        const [ax, ay] = parts[0]!;
        return SQUARE_OFFSETS.some(([dx, dy]) => {
          const square = [
            [ax + dx, ay + dy],
            [ax + dx + 1, ay + dy],
            [ax + dx, ay + dy + 1],
            [ax + dx + 1, ay + dy + 1],
          ] as const;
          if (!parts.every(([px, py]) => square.some(([cx, cy]) => cx === px && cy === py))) {
            return false;
          }
          return square.every(([cx, cy]) => isStream(cx, cy));
        });
      };

      let pinched = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (!isStream(x, y)) continue;
          if (!inSquare([[x, y]])) pinched++;
          if (isStream(x + 1, y) && !inSquare([[x, y], [x + 1, y]])) pinched++;
          if (isStream(x, y + 1) && !inSquare([[x, y], [x, y + 1]])) pinched++;
        }
      }
      expect(pinched, `seed ${seed}`).toBe(0);
    }
  });

  it("never funnels the flow through a single tile", () => {
    // Stated the other way round, as a reader would picture it: wherever water
    // passes from one tile to the next, the same step happens alongside it.
    for (const seed of SEEDS) {
      const { map } = generateWorld(seed);
      const isStream = (x: number, y: number) => map.get(x, y) === "stream";
      let slits = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (isStream(x, y) && isStream(x, y + 1)) {
            const beside =
              (isStream(x - 1, y) && isStream(x - 1, y + 1)) ||
              (isStream(x + 1, y) && isStream(x + 1, y + 1));
            if (!beside) slits++;
          }
          if (isStream(x, y) && isStream(x + 1, y)) {
            const beside =
              (isStream(x, y - 1) && isStream(x + 1, y - 1)) ||
              (isStream(x, y + 1) && isStream(x + 1, y + 1));
            if (!beside) slits++;
          }
        }
      }
      expect(slits, `seed ${seed}`).toBe(0);
    }
  });

  it("leaves no stream tile without an orthogonal neighbour", () => {
    for (const seed of SEEDS) {
      const { map } = generateWorld(seed);
      let stranded = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.get(x, y) !== "stream") continue;
          const joined =
            map.get(x, y - 1) === "stream" ||
            map.get(x, y + 1) === "stream" ||
            map.get(x - 1, y) === "stream" ||
            map.get(x + 1, y) === "stream";
          if (!joined) stranded++;
        }
      }
      expect(stranded, `seed ${seed}`).toBe(0);
    }
  });

  it("still leaves the map border sealed with rock", () => {
    for (const seed of SEEDS) {
      const { map } = generateWorld(seed);
      for (let x = 0; x < map.width; x++) {
        expect(map.get(x, 0)).toBe("rock");
        expect(map.get(x, map.height - 1)).toBe("rock");
      }
      for (let y = 0; y < map.height; y++) {
        expect(map.get(0, y)).toBe("rock");
        expect(map.get(map.width - 1, y)).toBe("rock");
      }
    }
  });
});
