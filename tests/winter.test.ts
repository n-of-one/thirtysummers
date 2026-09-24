import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";
import { fillList, FIRST_LIST, lineKey, offeredLines, type ListLine } from "../src/sim/list.ts";
import { isMaterial, RESOURCE_KINDS, RESOURCES } from "../src/sim/resources.ts";
import { shopStock } from "../src/sim/shop.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import type { ResourceKind, ResourceNode, TerrainKind } from "../src/sim/types.ts";
import { initialKeep, winterModel, type WinterInput } from "../src/sim/winter.ts";
import { World } from "../src/sim/world.ts";

const INTERACT: InputState = { ...NO_INPUT, interact: true };

/**
 * Hold `input` for `seconds` of simulated time at the real tick rate, then let
 * go. Released first, since a new summer starts with the key spent until it is.
 */
function hold(world: World, input: InputState, seconds: number): void {
  world.step(C.TICK_SEC, NO_INPUT);
  const ticks = Math.round(seconds / C.TICK_SEC);
  for (let i = 0; i < ticks; i++) world.step(C.TICK_SEC, input);
  world.step(C.TICK_SEC, NO_INPUT);
}

let nextId = 1;
const node = (kind: ResourceKind, x: number, y: number): ResourceNode => ({
  id: nextId++,
  kind,
  x: x + 0.5,
  y: y + 0.5,
  z: 0,
  harvested: false,
});

/** A grass field of `w` by `h`, painted by `paint`, with camp at (2, 2). */
function field(
  w: number,
  h: number,
  paint: (x: number, y: number) => TerrainKind | null = () => null,
  nodes: ResourceNode[] = [],
  seed = 7,
): World {
  const map = new TileMap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) map.set(x, y, paint(x, y) ?? "grass");
  return new World({
    seed,
    map,
    camp: { x: 2.5, y: 2.5 },
    nodes,
    springs: [],
    reachable: new Uint8Array(w * h),
  });
}

/**
 * A winter's input with nothing chosen yet, with `feathers` at camp besides
 * `store`: a feather sells for one gold, so it is the gold the winter has.
 */
function winter(store: WinterInput["store"], feathers: number, family = 0, year = 1): WinterInput {
  const camp = { ...store, feather: feathers };
  return {
    year,
    store: camp,
    awayAtEnd: false,
    keep: initialKeep(camp),
    stock: shopStock(levelOf(family), new Set(["knife"])),
    bought: [],
    familySurplus: family,
  };
}

function levelOf(total: number): number {
  return C.FAMILY_LEVELS.filter((at) => total >= at).length;
}

describe("what a slot is worth", () => {
  const perSlot = (kind: ResourceKind) =>
    (RESOURCES[kind].price * RESOURCES[kind].stack) / RESOURCES[kind].slots;

  it("pays more for a slot the further out it was picked", () => {
    // The one rule the prices follow: what rises with distance is what a slot
    // brings home, never the price of a kind. The shell field is the longest
    // trip on the map, so a pack of shells has to beat a pack of the ring's
    // feathers, or the trip is only long.
    expect(perSlot("shell")).toBeGreaterThan(perSlot("feather"));
    expect(perSlot("feather")).toBeGreaterThan(perSlot("fruit"));
  });

  it("pays nothing at all for what a bridge is made of", () => {
    // Material has no buyer, so the gold on the list can only come from a
    // field. The keep-or-sell column is still there, and simply has nothing
    // left to weigh.
    for (const kind of RESOURCE_KINDS.filter(isMaterial)) expect(RESOURCES[kind].price).toBe(0);
  });
});

describe("the winter model", () => {
  it("feeds the winter, sells the feathers and the spare fruit, pays the rent and gives the rest", () => {
    const spare = 15 - C.UPKEEP_FRUIT;
    const m = winterModel(winter({ fruit: 15, stick: 5, vine: 2 }, 30));
    expect(m.food).toMatchObject({ fromStore: C.UPKEEP_FRUIT, bought: 0, surplus: spare, cost: 0 });
    // The feathers and the spare fruit sell. Material is kept until the player
    // says so, and is worth nothing either way.
    expect(m.lines.find((l) => l.kind === "feather")).toMatchObject({ have: 30, sold: 30, gold: 30 });
    expect(m.lines.find((l) => l.kind === "stick")).toMatchObject({ have: 5, sold: 0, gold: 0 });
    expect(m.sales).toBe(30 + spare);
    expect(m.upkeep).toMatchObject({ gold: C.UPKEEP_GOLD, total: C.UPKEEP_GOLD, met: true });
    expect(m.left).toBe(30 + spare - C.UPKEEP_GOLD);
    expect(m.family).toMatchObject({ before: 0, total: 31, level: 1, shopOpen: false });
  });

  it("buys the fruit a short camp lacks, at the town's price", () => {
    const m = winterModel(winter({ fruit: C.UPKEEP_FRUIT - 3 }, 20));
    expect(m.food).toMatchObject({
      fromStore: C.UPKEEP_FRUIT - 3,
      bought: 3,
      cost: 3 * C.FRUIT_BUY_PRICE,
    });
    expect(m.left).toBe(20 - C.UPKEEP_GOLD - 3 * C.FRUIT_BUY_PRICE);
  });

  it("is applied by the world: kept material stays at camp into the next summer", () => {
    const spare = 15 - C.UPKEEP_FRUIT;
    const world = field(10, 10);
    world.store.add("fruit", 15);
    world.store.add("stick", 5);
    world.store.add("vine", 2);
    world.store.add("feather", 30);
    world.endSummer();

    const input = world.winterInput();
    // Two sticks sold, three kept. They fetch nothing, which is the point of
    // the price: what is left over at camp is the only reason to keep them.
    input.keep = { ...input.keep, stick: 3 };
    world.endWinter(input, new Set());
    world.nextSummer();

    expect(world.store.count("fruit")).toBe(0);
    expect(world.store.count("stick")).toBe(3);
    expect(world.store.count("vine")).toBe(2);
    expect(world.store.count("feather")).toBe(0);
    expect(world.family).toBe(30 + spare - C.UPKEEP_GOLD);
    expect(world.tired).toBe(false);
  });
});

describe("the shop by family level", () => {
  it("has no shop lines at all in the first winter, frosted or not", () => {
    const m = winterModel(winter({ fruit: 12 }, 60));
    expect(m.family.level).toBeGreaterThanOrEqual(2);
    expect(m.shop).toEqual([]);
    expect(m.frosted).toEqual([]);
    expect(m.family.shopOpen).toBe(false);
    expect(m.family.gained[0]!.unlocks).toContain("the town will trade with you next winter");
  });

  it("puts the axe on summer 2's list when winter 1 reaches level 1, shop or no shop", () => {
    // Thirty feathers and four spare fruit, less the rent: the family at 28,
    // level 1.
    const m = winterModel(winter({ fruit: 12, stick: 6 }, 30));
    expect(m.family).toMatchObject({ levelBefore: 0, level: 1, total: 28, shopOpen: false });
    expect(m.frosted).toEqual([]);
    expect(m.unlocked.map((it) => it.id)).toEqual(["axe"]);
    expect(offeredLines(m).map(lineKey)).toEqual(["food", "rent", "item:axe", "level"]);

    // Short of level 1, nothing is opened, and the list has no axe.
    const short = winterModel(winter({ fruit: 12 }, 10));
    expect(short.family.level).toBe(0);
    expect(offeredLines(short).map(lineKey)).toEqual(["food", "rent", "level"]);

    // Through the world, into summer 2.
    const world = field(10, 10);
    world.store.add("fruit", 12);
    world.store.add("feather", 30);
    world.endSummer();
    world.endWinter(world.winterInput(), new Set(["food", "rent", "item:axe", "level"]));
    world.nextSummer();
    expect(world.list).toEqual([
      { kind: "food" },
      { kind: "rent" },
      { kind: "item", id: "axe" },
      { kind: "level", level: 2, gold: C.FAMILY_LEVELS[1]! - 28 },
    ]);
  });

  it("stocks what the level the winter began with unlocks, less what is owned", () => {
    expect(shopStock(0, new Set())).toEqual([]);
    expect(shopStock(1, new Set())).toEqual(["axe"]);
    expect(shopStock(2, new Set())).toEqual(["axe", "cart"]);
    expect(shopStock(2, new Set(["axe"]))).toEqual(["cart"]);
  });

  it("frosts the cart at level 2, and buying the axe can take it away again", () => {
    // Level 1 at 30. Ten gold and four spare fruit, less the rent, puts the
    // family at 38 and level 2; the axe's six puts it at 32 and leaves it at
    // level 1.
    const input = winter({ fruit: 12, stick: 3 }, 10, 30, 2);
    expect(input.stock).toEqual(["axe"]);
    const without = winterModel(input);
    expect(without.family.level).toBe(2);
    expect(without.frosted.map((it) => it.id)).toEqual(["cart"]);

    const withAxe = winterModel({ ...input, bought: ["axe"] });
    expect(withAxe.family.given).toBe(without.family.given - 6);
    expect(withAxe.family.level).toBe(1);
    expect(withAxe.frosted).toEqual([]);

    // And back: undoing the axe frosts the cart again.
    expect(winterModel({ ...input, bought: [] }).frosted.map((it) => it.id)).toEqual(["cart"]);
  });

  it("hands over what was bought, and takes the axe's sticks out of camp", () => {
    const world = field(10, 10);
    world.family = 30;
    world.store.add("fruit", 12);
    world.store.add("stick", 4);
    world.store.add("feather", 25);
    world.endSummer();
    const input = world.winterInput();
    expect(input.stock).toEqual(["axe"]);
    world.endWinter({ ...input, bought: ["axe"] }, new Set());
    expect(world.tools.has("axe")).toBe(true);
    expect(world.store.count("stick")).toBe(1);
    expect(world.family).toBe(30 + 25 + (12 - C.UPKEEP_FRUIT) - C.UPKEEP_GOLD - 6);
    // Owned, so it is not stocked again.
    world.nextSummer();
    world.endSummer();
    expect(world.winterInput().stock).not.toContain("axe");
  });
});

describe("the list", () => {
  const axe: ListLine = { kind: "item", id: "axe" };
  const level2: ListLine = { kind: "level", level: 2, gold: 5 };
  const list: ListLine[] = [{ kind: "food" }, { kind: "rent" }, axe, level2];

  const atCamp = (rows: ReturnType<typeof fillList>) =>
    rows.map((r) => [r.label, r.parts.map((p) => `${p.atCamp}/${p.need} ${p.unit}`), r.done]);

  it("fills from the top: food in fruit, then one pot of gold, material in kind", () => {
    // Three feathers and a shell: nine gold, and the shell is six of them.
    const rows = fillList(list, {}, { fruit: 12, stick: 3, feather: 3, shell: 1 });
    expect(atCamp(rows)).toEqual([
      ["Food", ["8/8 fruit"], true],
      ["Rent", ["6/6 gold"], true],
      ["Axe", ["3/6 gold", "3/3 stick"], false],
      ["Increase family wealth", ["0/5 gold"], false],
    ]);
  });

  it("counts the pack as collected and only camp as home, and a line is done when it is home", () => {
    const rows = fillList(list, { feather: 20, fruit: 1 }, { fruit: 7, stick: 3, feather: 10 });
    expect(rows.map((r) => r.parts.map((p) => [p.collected, p.atCamp]))).toEqual([
      [[8, 7]],
      [[6, 6]],
      [[6, 4], [3, 3]],
      [[5, 0]],
    ]);
    // The food is one short, and does not hold the rent back from being done.
    expect(rows.map((r) => r.done)).toEqual([false, true, false, false]);
  });

  it("ticks nothing with building material: sticks at camp are not gold", () => {
    const rows = fillList(FIRST_LIST, {}, { fruit: 12, stick: 40, vine: 40, log: 10 });
    expect(rows.map((r) => r.done)).toEqual([true, false, false]);
    expect(rows[1]!.parts[0]).toMatchObject({ atCamp: 0, need: C.UPKEEP_GOLD });
  });

  it("offers upkeep, the shop, the frosted line and the next level, and keeps only what is ticked", () => {
    const input = winter({ fruit: 12, stick: 3 }, 20, 30, 2);
    const m = winterModel(input);
    expect(offeredLines(m).map(lineKey)).toEqual(["food", "rent", "item:axe", "item:cart", "level"]);
    expect(offeredLines(m).at(-1)).toEqual({ kind: "level", level: 3, gold: C.FAMILY_LEVELS[2]! - 48 });

    const world = field(10, 10);
    world.family = 30;
    world.store.add("fruit", 12);
    world.store.add("stick", 3);
    world.store.add("feather", 20);
    world.endSummer();
    world.endWinter(world.winterInput(), new Set(["food", "item:cart", "level"]));
    expect(world.list.map(lineKey)).toEqual(["food", "item:cart", "level"]);
  });
});

describe("a tired summer", () => {
  function tiredWorld(): World {
    const world = field(12, 12, (x, y) => (x === 6 && y === 5 ? "thicket" : y === 9 ? "mud" : null));
    world.store.add("fruit", 12);
    world.endSummer();
    // Nothing in hand for the rent: the winter cannot be paid.
    world.endWinter(world.winterInput(), new Set());
    return world;
  }

  it("follows a winter that could not be paid, and lasts one summer", () => {
    const world = tiredWorld();
    expect(world.tired).toBe(true);
    world.nextSummer();
    expect(world.events.at(-1)).toMatchObject({ type: "summerStarted", tired: true });

    // A cut takes half as long again.
    expect(world.holdTime("cut")).toBeCloseTo(C.CUT_TIME * C.TIRED_HOLD_MUL);
    world.teleport(5.5, 5.5);
    world.player.heading = { x: 1, y: 0 };
    hold(world, INTERACT, C.CUT_TIME + 0.1);
    expect(world.map.get(6, 5)).toBe("thicket");
    world.player.heading = { x: 1, y: 0 };
    hold(world, INTERACT, C.CUT_TIME * C.TIRED_HOLD_MUL + 0.1);
    expect(world.map.get(6, 5)).toBe(C.CUT_LEAVES);
    // Opening the panel at camp is not work, and takes no longer.
    expect(world.holdTime("deposit")).toBe(C.TRANSFER_HOLD_TIME);

    // Mud slower still on a tired summer, grass as fast as ever.
    world.teleport(5.5, 9.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.MUD_SPEED_MUL * C.TIRED_ROUGH_MUL);
    world.teleport(5.5, 7.5);
    expect(world.speed()).toBe(C.WALK_SPEED);

    // A winter paid in full, and the next summer is an ordinary one.
    world.teleport(2.5, 2.5);
    world.endSummer();
    world.store.add("feather", C.UPKEEP_GOLD);
    world.store.add("fruit", 12);
    world.endWinter(world.winterInput(), new Set());
    world.nextSummer();
    expect(world.tired).toBe(false);
    expect(world.holdTime("cut")).toBe(C.CUT_TIME);
    world.teleport(5.5, 9.5);
    expect(world.speed()).toBeCloseTo(C.WALK_SPEED * C.MUD_SPEED_MUL);
  });
});

describe("what the map does between summers", () => {
  /**
   * Camp's side of a two-tile stream is the near ring. Across it: ten feathers
   * and four shells. In the ring: three fruit, one shell, a sapling, a row of
   * thicket with gaps to cut, and a lone thicket tile to cut clear of any
   * other.
   *
   * The shell in the ring is the rule that never means never wherever a node
   * stands. It is here rather than in a test of its own because what makes it
   * worth stating is that everything beside it does come back.
   */
  const W = 40;
  const H = 24;
  const STREAM = [20, 21];
  const WALL_Y = 16;
  const GAPS = [3, 5, 7, 9, 11, 13, 15];

  function map3(): {
    world: World;
    ring: ResourceNode[];
    ringShell: ResourceNode;
    feathers: ResourceNode[];
    shells: ResourceNode[];
  } {
    const ring = [node("fruit", 4, 8), node("fruit", 6, 8), node("fruit", 8, 8)];
    const ringShell = node("shell", 12, 8);
    const feathers = Array.from({ length: 10 }, (_, i) => node("feather", 24 + i, 6));
    const shells = Array.from({ length: 4 }, (_, i) => node("shell", 24 + i, 12));
    const world = field(
      W,
      H,
      (x, y) => {
        if (STREAM.includes(x)) return "stream";
        if (x === 10 && y === 4) return "sapling";
        if (y === WALL_Y && x >= 2 && x <= 16) return "thicket";
        if (x === 4 && y === 20) return "thicket";
        return null;
      },
      [...ring, ringShell, ...feathers, ...shells],
    );
    world.tools.add("axe");
    return { world, ring, ringShell, feathers, shells };
  }

  function pick(world: World, n: ResourceNode): void {
    world.teleport(n.x, n.y);
    hold(world, INTERACT, C.HARVEST_TIME + 0.1);
    expect(n.harvested).toBe(true);
    world.inventory.clear();
  }

  function aim(world: World, x: number, y: number, dx: number, dy: number, seconds: number): void {
    world.teleport(x + 0.5 - dx, y + 0.5 - dy);
    world.player.heading = { x: dx, y: dy };
    hold(world, INTERACT, seconds);
    world.inventory.clear();
  }

  const winterPasses = (world: World) => {
    world.endSummer();
    world.nextSummer();
  };
  const back = (nodes: ResourceNode[]) => nodes.filter((n) => !n.harvested).length;
  const cut = (world: World, x: number) => world.map.get(x, WALL_Y);

  it("plays out over three winters, the same for the same seed and year", () => {
    const { world, ring, ringShell, feathers, shells } = map3();
    const inRing = (n: ResourceNode) => world.inNearRing(n.x, n.y);
    expect([...ring, ringShell].every(inRing)).toBe(true);
    expect([...feathers, ...shells].some(inRing)).toBe(false);

    // Summer 1: everything picked, the sapling felled, the gaps and the lone
    // tile cut, and the stream bridged.
    for (const n of [...ring, ringShell, ...feathers, ...shells]) pick(world, n);
    aim(world, 10, 4, 1, 0, C.FELL_TIME + 0.1);
    expect(world.map.get(10, 4)).toBe("grass");
    for (const x of GAPS) aim(world, x, WALL_Y, 0, 1, C.CUT_TIME + 0.1);
    aim(world, 4, 20, 0, 1, C.CUT_TIME + 0.1);
    expect(GAPS.map((x) => cut(world, x))).toEqual(GAPS.map(() => C.CUT_LEAVES));
    world.buildMode = "bridge";
    for (const x of STREAM) {
      world.inventory.add("stick", 1);
      world.inventory.add("vine", 1);
      aim(world, x, 10, 1, 0, C.BUILD_TIME + 0.1);
    }
    expect(STREAM.map((x) => world.map.get(x, 10))).toEqual(["bridge", "bridge"]);

    // Winter 1.
    winterPasses(world);
    expect(back(ring)).toBe(3);
    expect(back(feathers)).toBe(5);
    expect(back(shells)).toBe(0);
    // Everything else in the ring is back; the shell in it is not.
    expect(back([ringShell])).toBe(0);
    expect(world.map.get(10, 4)).toBe("grass");
    expect(STREAM.map((x) => world.map.get(x, 10))).toEqual(["bridge", "bridge"]);

    // Summer 2: the feathers that came back are picked again.
    for (const n of [...ring, ...feathers]) if (!n.harvested) pick(world, n);
    winterPasses(world);
    expect(back(ring)).toBe(3);
    expect(back(feathers)).toBe(2);
    expect(back(shells)).toBe(0);
    expect(world.map.get(10, 4)).toBe("grass");
    // One bridge tile gone in the second winter.
    expect(STREAM.map((x) => world.map.get(x, 10)).sort()).toEqual(["bridge", "stream"]);

    // Summer 3, nothing picked: nothing comes back that was not already back.
    winterPasses(world);
    expect(back(feathers)).toBe(2);
    expect(back(shells)).toBe(0);
    // The sapling stands again after its third winter.
    expect(world.map.get(10, 4)).toBe("sapling");
    // No bridge tile lost in an odd winter.
    expect(STREAM.map((x) => world.map.get(x, 10)).sort()).toEqual(["bridge", "stream"]);

    // Thicket crept back onto some of the gaps in the wall, and never onto
    // the lone tile with no thicket beside it.
    const crept = GAPS.filter((x) => cut(world, x) === "thicket");
    expect(crept.length).toBeGreaterThan(0);
    expect(crept.length).toBeLessThan(GAPS.length);
    expect(world.map.get(4, 20)).toBe(C.CUT_LEAVES);
  });

  it("comes out the same for the same map and years", () => {
    const run = () => {
      const { world, feathers } = map3();
      for (const n of feathers) pick(world, n);
      for (const x of GAPS) aim(world, x, WALL_Y, 0, 1, C.CUT_TIME + 0.1);
      for (let i = 0; i < 3; i++) winterPasses(world);
      return {
        wall: GAPS.map((x) => cut(world, x)),
        feathers: feathers.map((n) => n.harvested),
      };
    };
    expect(run()).toEqual(run());
  });
});
