import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { NO_INPUT } from "../src/input/keyboard.ts";
import { Inventory } from "../src/sim/inventory.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import { World } from "../src/sim/world.ts";
import {
  anchorPosition,
  edgeArrow,
  fogRadiusPx,
  formatClock,
  hudModel,
  duskAlpha,
  packCells,
  fogGradient,
  toastFor,
} from "../src/ui/hud.ts";

/** The fog's widest ring in the configured view, in logical pixels. */
const WIDEST = (C.VIEW_W / 2) * C.FOG_MAX_RADIUS_SHARE;

function world(): World {
  const map = new TileMap(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) map.set(x, y, "grass");
  const w = new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes: [],
    springs: [],
    reachable: new Uint8Array(64),
  });
  // Out of reach of the camp, so nothing prompts unless a test asks for it.
  w.player.x = 5.5;
  w.player.y = 5.5;
  w.player.heading = { x: 1, y: 0 };
  return w;
}

describe("formatClock", () => {
  it("reads m:ss", () => {
    expect(formatClock(900)).toBe("15:00");
    expect(formatClock(599)).toBe("9:59");
    expect(formatClock(61)).toBe("1:01");
    expect(formatClock(9)).toBe("0:09");
  });

  it("rounds up, so it only shows 0:00 when the summer is actually over", () => {
    expect(formatClock(899.99)).toBe("15:00");
    expect(formatClock(0.01)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });

  it("does not go negative", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("hudModel", () => {
  it("reports a fresh summer at full", () => {
    const model = hudModel(world());
    expect({ ...model, list: model.list.map((r) => r.title) }).toEqual({
      hydration: 100,
      hydrationWarn: false,
      carried: 0,
      capacity: C.BACKPACK_CAPACITY,
      pack: [],
      list: ["Food", "Rent", "Increase family wealth"],
      startNotice: "Summer 1, 5:00 long",
      tools: "knife",
      building: null,
      secondsLeft: C.SUMMER_LENGTH_SEC,
      year: 1,
      homeward: false,
      homewardNotice: null,
      duskAlpha: 0,
      atCamp: false,
      fogRadiusPx: WIDEST,
      prompt: null,
    });
  });

  it("closes the fog in, and warns, once hydration drops below the threshold", () => {
    const w = world();
    w.stats.hydration = C.HYDRATION_FOG_THRESHOLD;
    expect(hudModel(w).hydrationWarn).toBe(false);
    expect(hudModel(w).fogRadiusPx).toBe(WIDEST);
    w.stats.hydration = 10;
    expect(hudModel(w).hydrationWarn).toBe(true);
    expect(hudModel(w).fogRadiusPx).toBe(fogRadiusPx(10));
    expect(fogRadiusPx(10)).toBeLessThan(WIDEST);
  });

  it("shows the first summer's list: a row per amount, collected and at camp, gold in feathers", () => {
    const w = world();
    w.store.add("fruit", 7);
    w.store.add("feather", 11);
    w.inventory.add("feather", 4);
    w.inventory.add("fruit", 2);
    const boxes = hudModel(w).list;
    // Rent takes the first ten feathers at camp, so it is done and stays on
    // the list as done; the family gets the one left at camp and the four in
    // the pack.
    expect(boxes.map((b) => [b.title, b.wants, b.done, b.rows])).toEqual([
      ["Food", null, false, [{ unit: "fruit", need: 12, collected: 9, atCamp: 7 }]],
      ["Rent", "10 gold", true, [{ unit: "feathers", need: 10, collected: 10, atCamp: 10 }]],
      ["Increase family wealth", "10 gold", false, [{ unit: "feathers", need: 10, collected: 5, atCamp: 1 }]],
    ]);
  });

  it("says what food wants done in words, in the first summer only", () => {
    const w = world();
    w.store.add("fruit", 5);
    w.inventory.add("fruit", 4);
    expect(hudModel(w).list.map((b) => b.hint)).toEqual([
      { find: "find 3", bring: "bring 4 to camp" },
      null,
      null,
    ]);
    w.inventory.clear();
    expect(hudModel(w).list[0]!.hint).toEqual({ find: "find 7", bring: null });
    w.store.add("fruit", 7);
    // Done, so nothing left to say.
    expect(hudModel(w).list[0]!.hint).toBeNull();
    w.store.clear();
    w.year = 2;
    expect(hudModel(w).list[0]!.hint).toBeNull();
  });

  it("says which summer it is until the player moves", () => {
    const w = world();
    expect(hudModel(w).startNotice).toBe("Summer 1, 5:00 long");
    w.tired = true;
    expect(hudModel(w).startNotice).toContain("A tired summer");
    w.step(C.TICK_SEC, { ...NO_INPUT, moveX: 1 });
    expect(hudModel(w).startNotice).toBeNull();
  });

  it("follows the backpack and the clock", () => {
    const w = world();
    w.inventory.add("ore", 3);
    w.inventory.add("fruit", 1);
    w.elapsedSec = C.SUMMER_LENGTH_SEC - 30;
    const model = hudModel(w);
    expect(model.carried).toBe(4);
    expect(model.pack.map((c) => c.kind)).toEqual(["ore", "ore", "ore", "fruit"]);
    expect(model.secondsLeft).toBe(30);
    expect(model.homeward).toBe(true);
    expect(formatClock(model.secondsLeft)).toBe("0:30");
  });
});

describe("the last minute", () => {
  it("says to head back, with the clock's seconds, only away from camp", () => {
    const w = world();
    w.elapsedSec = C.SUMMER_LENGTH_SEC - C.HOMEWARD_SEC - 1;
    expect(hudModel(w).homewardNotice).toBeNull();

    w.elapsedSec = C.SUMMER_LENGTH_SEC - (C.HOMEWARD_SEC - 3.8);
    expect(hudModel(w).homewardNotice).toBe(
      `Summer ends in ${formatClock(C.HOMEWARD_SEC - 3.8)}. Get back to camp.`,
    );

    w.player.x = 1.5;
    w.player.y = 1.5;
    expect(hudModel(w).homeward).toBe(true);
    expect(hudModel(w).homewardNotice).toBeNull();
  });

  it("draws the dusk in from nothing at HOMEWARD_SEC to its full alpha at the end", () => {
    expect(duskAlpha(C.SUMMER_LENGTH_SEC)).toBe(0);
    expect(duskAlpha(C.HOMEWARD_SEC + 1)).toBe(0);
    expect(duskAlpha(C.HOMEWARD_SEC)).toBe(0);
    expect(duskAlpha(C.HOMEWARD_SEC / 2)).toBeCloseTo(C.DUSK_MAX_ALPHA / 2, 2);
    expect(duskAlpha(0)).toBeCloseTo(C.DUSK_MAX_ALPHA, 10);
  });

  it("moves in steps, so most frames write nothing", () => {
    const values = new Set<number>();
    for (let t = C.HOMEWARD_SEC; t >= 0; t -= C.TICK_SEC) values.add(duskAlpha(t));
    expect(values.size).toBeLessThanOrEqual(Math.round(C.DUSK_MAX_ALPHA / C.DUSK_ALPHA_STEP) + 1);
    const ticks = Math.round(C.HOMEWARD_SEC / C.TICK_SEC);
    expect(values.size).toBeLessThan(ticks / 10);
  });
});

describe("edgeArrow", () => {
  const view = { width: 1280, height: 720 };
  const m = 20;

  it("stays away while the camp is in view", () => {
    expect(edgeArrow({ x: 640, y: 360 }, { x: 100, y: 700 }, view, m)).toBeNull();
  });

  it("sits where the line to camp leaves the view, and points along it", () => {
    const right = edgeArrow({ x: 640, y: 360 }, { x: 2000, y: 360 }, view, m)!;
    expect(right).toEqual({ x: 1280 - m, y: 360, angle: 0 });

    const up = edgeArrow({ x: 640, y: 360 }, { x: 640, y: -500 }, view, m)!;
    expect(up.x).toBe(640);
    expect(up.y).toBe(m);
    expect(up.angle).toBeCloseTo(-Math.PI / 2, 10);
  });

  it("leaves by whichever edge the line reaches first", () => {
    // Down and to the left, steeper than the view's own diagonal: the bottom.
    const player = { x: 640, y: 360 };
    const camp = { x: 240, y: 1360 };
    const at = edgeArrow(player, camp, view, m)!;
    expect(at.y).toBeCloseTo(720 - m, 10);
    // On the line from the player to the camp.
    const along = (at.y - player.y) / (camp.y - player.y);
    expect(at.x).toBeCloseTo(player.x + (camp.x - player.x) * along, 10);
    expect(at.angle).toBeCloseTo(Math.atan2(1000, -400), 10);
  });
});

describe("the action prompt", () => {
  it("offers the hold, and tracks how far through it is", () => {
    const w = world();
    w.nodes.push({ id: 1, kind: "fruit", x: 6.5, y: 5.5, z: 0, harvested: false });
    expect(hudModel(w).prompt).toEqual({
      text: "Hold E to gather fruit",
      progress: 0,
      blocked: false,
    });

    w.harvestProgress = 0.5;
    expect(hudModel(w).prompt?.progress).toBe(0.5);
  });

  it("says the pack is full, and with it the keys that empty it, and the count", () => {
    const w = world();
    w.nodes.push({ id: 1, kind: "ore", x: 6.5, y: 5.5, z: 0, harvested: false });
    w.inventory.add("fruit", C.BACKPACK_CAPACITY);
    expect(hudModel(w).prompt).toEqual({
      text: `Backpack full - X: drop ${C.BACKPACK_CAPACITY} fruit. C: switch`,
      progress: 0,
      blocked: true,
    });
  });

  it("names the load waiting at camp, and the hold that opens what camp stores", () => {
    const w = world();
    w.player.x = 1.5;
    w.player.y = 1.5;
    w.inventory.add("ore", 6);
    w.inventory.add("fruit", 2);
    expect(hudModel(w).prompt).toEqual({
      text: "Press E to store 8 at camp, hold to access the camp items",
      progress: 0,
      blocked: false,
    });

    // Nothing to store is still somewhere to take things out of.
    w.inventory.clear();
    expect(hudModel(w).prompt).toEqual({
      text: "Nothing to store. Hold E to access the camp items",
      progress: 0,
      blocked: true,
    });
  });

  it("marks every cell of the kind the drop key would throw", () => {
    const w = world();
    w.inventory.add("vine", 3);
    // A log takes two slots, so two logs outweigh three vines.
    w.inventory.add("log", 2);
    const selected = hudModel(w).pack.filter((c) => c.selected).map((c) => c.kind);
    expect(selected).toEqual(["log", "log"]);
  });
});

describe("packCells", () => {
  it("is a cell per item in the order it was picked up, a log two wide", () => {
    const bag = new Inventory();
    bag.add("log", 1);
    bag.add("fruit", 2);
    expect(packCells(bag, null)).toEqual([
      { kind: "log", span: 2, count: null, selected: false },
      { kind: "fruit", span: 1, count: null, selected: false },
      { kind: "fruit", span: 1, count: null, selected: false },
    ]);
  });

  it("gives feathers a cell per stack of five, the last part filled", () => {
    const bag = new Inventory();
    bag.add("fruit", 1);
    bag.add("feather", 7);
    expect(packCells(bag, "feather")).toEqual([
      { kind: "fruit", span: 1, count: null, selected: false },
      { kind: "feather", span: 1, count: 5, selected: true },
      { kind: "feather", span: 1, count: 2, selected: true },
    ]);
  });
});

describe("the action prompt at a thicket, on rough ground and by a spring", () => {
  it("offers the cut with nothing but the hold to it", () => {
    const w = world();
    w.map.set(6, 5, "thicket");
    expect(hudModel(w).prompt).toEqual({
      text: "Hold E to cut through",
      progress: 0,
      blocked: false,
    });
  });

  it("says nothing about rough ground, which is only slow", () => {
    const w = world();
    w.map.set(6, 5, "mud");
    w.player.x = 5.9;
    expect(hudModel(w).prompt).toBeNull();
  });

  it("offers a drink beside a spring once thirsty", () => {
    const w = world();
    w.springs.push({ x: 6, y: 5 });
    w.stats.hydration = 50;
    expect(hudModel(w).prompt).toEqual({ text: "Hold E to drink", progress: 0, blocked: false });
  });
});

describe("the end-summer button", () => {
  it("is offered only at camp", () => {
    const w = world();
    expect(hudModel(w).atCamp).toBe(false);
    w.player.x = 1.5;
    w.player.y = 1.5;
    expect(hudModel(w).atCamp).toBe(true);
  });
});

describe("fogRadiusPx", () => {
  it("rings the view at its widest from full hydration down to the threshold", () => {
    expect(fogRadiusPx(100)).toBe(WIDEST);
    expect(fogRadiusPx(C.HYDRATION_FOG_THRESHOLD)).toBe(WIDEST);
  });

  it("sizes the widest ring by the view, so it keeps its shape at any size", () => {
    expect(fogRadiusPx(100, 1920) / 960).toBeCloseTo(fogRadiusPx(100, 1280) / 640, 10);
    expect(fogRadiusPx(100, 1920)).toBe(960 * C.FOG_MAX_RADIUS_SHARE);
  });

  it("closes from the widest circle to a few tiles at zero", () => {
    expect(fogRadiusPx(C.HYDRATION_FOG_THRESHOLD - 1e-9)).toBeCloseTo(WIDEST, 3);
    expect(fogRadiusPx(0)).toBe(C.FOG_MIN_RADIUS_TILES * C.TILE);
  });

  it("shrinks steadily as hydration falls", () => {
    const radii = [35, 25, 15, 5, 0].map((h) => fogRadiusPx(h));
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeLessThan(radii[i - 1]!);
  });
});

describe("fogGradient", () => {
  it("is clear to the radius, then follows the stops in the fog's colour", () => {
    expect(fogGradient(0x080a07, [[1.1, 0.5], [1.3, 1]])).toBe(
      "radial-gradient(circle at center, rgba(8, 10, 7, 0) var(--fog-r), " +
        "rgba(8, 10, 7, 0.5) calc(var(--fog-r) * 1.1), " +
        "rgba(8, 10, 7, 1) calc(var(--fog-r) * 1.3))",
    );
  });

  it("makes the last stop opaque whatever it says, so nothing shows past it", () => {
    expect(fogGradient(0x000000, [[1.2, 0.4]])).toContain("rgba(0, 0, 0, 1) calc(var(--fog-r) * 1.2)");
  });
});

describe("anchorPosition", () => {
  const view = { width: 1000, height: 600 };
  const size = { width: 200, height: 40 };

  it("hangs the stack below the player, centred on them", () => {
    const at = anchorPosition({ x: 500, y: 300 }, size, view);
    expect(at.x).toBe(500);
    expect(at.y).toBe(300 + C.PROMPT_OFFSET_PX);
  });

  it("keeps it on screen when the player walks into a corner", () => {
    const margin = C.PROMPT_EDGE_MARGIN_PX;
    const topLeft = anchorPosition({ x: 0, y: 0 }, size, view);
    expect(topLeft.x).toBe(margin + size.width / 2);
    expect(topLeft.y).toBe(C.PROMPT_OFFSET_PX); // still a clear drop below the player

    const bottomRight = anchorPosition({ x: 1000, y: 600 }, size, view);
    expect(bottomRight.x).toBe(view.width - margin - size.width / 2);
    expect(bottomRight.y).toBe(view.height - margin - size.height);
  });

  it("centres a stack too wide to fit rather than pinning it to one side", () => {
    const at = anchorPosition({ x: 20, y: 300 }, { width: 1200, height: 40 }, view);
    expect(at.x).toBe(view.width / 2);
  });
});

describe("toastFor", () => {
  it("puts every kind of event into words", () => {
    expect(toastFor({ type: "harvested", kind: "ore", at: 0 })).toBe("+1 ore");
    expect(toastFor({ type: "pickedUp", kind: "vine", at: 0 })).toBe("+1 vine");
    expect(toastFor({ type: "deposited", stored: 7, at: 0 })).toBe("Stored 7 at camp");
    expect(toastFor({ type: "putAway", kind: "vine", n: 3, at: 0 })).toBe("Stored 3 vine");
    expect(toastFor({ type: "tookOut", kind: "fruit", n: 2, at: 0 })).toBe("Took 2 fruit");
    expect(toastFor({ type: "dropped", kind: "vine", n: 6, at: 0 })).toBe("Dropped 6 vine");
    // The panel opening in front of the player is its own announcement.
    expect(toastFor({ type: "transferOpened", x: 1, y: 1, at: 0 })).toBeNull();
    expect(toastFor({ type: "drank", at: 0 })).toBe("Drank your fill");
    expect(toastFor({ type: "blocked", reason: "backpackFull", at: 0 })).toBe("Backpack full");
    expect(toastFor({ type: "blocked", reason: "noAxe", at: 0 })).toBe(
      "Felling a sapling needs an axe",
    );
    expect(toastFor({ type: "felled", x: 0, y: 0, at: 0 })).toBe("Felled a sapling, +1 log");
    expect(toastFor({ type: "dug", x: 0, y: 0, at: 0 })).toBe("Dug a well");
    // The start-of-summer notice says which summer it is, not a toast.
    expect(toastFor({ type: "summerStarted", year: 2, tired: false, at: 0 })).toBeNull();
    expect(toastFor({ type: "winterEnded", given: 5, tired: false, at: 0 })).toBeNull();
    expect(toastFor({ type: "summerEnded", away: false, stored: 0, at: 0 })).toBe(
      "Summer over",
    );
  });
});
