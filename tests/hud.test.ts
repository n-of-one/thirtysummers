import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { Inventory } from "../src/sim/inventory.ts";
import { TileMap } from "../src/sim/tilemap.ts";
import { World } from "../src/sim/world.ts";
import { anchorPosition, backpackText, formatClock, hudModel, toastFor } from "../src/ui/hud.ts";

function world(): World {
  const map = new TileMap(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) map.set(x, y, "grass");
  const w = new World({
    seed: 1,
    map,
    camp: { x: 1.5, y: 1.5 },
    nodes: [],
    reachable: new Uint8Array(64),
  });
  // Out of reach of the camp, so nothing prompts unless a test asks for it.
  w.player.x = 5.5;
  w.player.y = 5.5;
  return w;
}

describe("formatClock", () => {
  it("reads m:ss", () => {
    expect(formatClock(900)).toBe("15:00");
    expect(formatClock(599)).toBe("9:59");
    expect(formatClock(61)).toBe("1:01");
    expect(formatClock(9)).toBe("0:09");
  });

  it("rounds up, so it only shows 0:00 when the day is actually over", () => {
    expect(formatClock(899.99)).toBe("15:00");
    expect(formatClock(0.01)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });

  it("does not go negative", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("hudModel", () => {
  it("reports a fresh day at full", () => {
    const model = hudModel(world());
    expect(model).toEqual({
      stamina: 100,
      hydration: 100,
      staminaWarn: false,
      hydrationWarn: false,
      stomachCooldownSec: 0,
      carried: 0,
      contents: "empty",
      capacity: C.BACKPACK_CAPACITY,
      gold: 0,
      holdingFruit: false,
      holdingWater: false,
      secondsLeft: C.SUMMER_LENGTH_SEC,
      year: 1,
      urgent: false,
      prompt: null,
    });
  });

  it("warns on stamina below the display threshold", () => {
    const w = world();
    w.stats.stamina = C.STAMINA_WARN_THRESHOLD;
    expect(hudModel(w).staminaWarn).toBe(false);
    w.stats.stamina = C.STAMINA_WARN_THRESHOLD - 0.1;
    expect(hudModel(w).staminaWarn).toBe(true);
  });

  it("warns on hydration exactly where resting drops to half speed", () => {
    const w = world();
    w.stats.hydration = C.HYDRATION_LOW_THRESHOLD + 0.1;
    expect(hudModel(w).hydrationWarn).toBe(false);
    w.stats.hydration = C.HYDRATION_LOW_THRESHOLD;
    expect(hudModel(w).hydrationWarn).toBe(true);
  });

  it("follows the backpack, the gold and the clock", () => {
    const w = world();
    w.inventory.add("ore", 3);
    w.inventory.add("fruit", 1);
    w.inventory.gold = 12;
    w.elapsedSec = C.SUMMER_LENGTH_SEC - 30;
    const model = hudModel(w);
    expect(model.carried).toBe(4);
    expect(model.contents).toBe("fruit 1, ore 3");
    expect(model.gold).toBe(12);
    expect(model.secondsLeft).toBe(30);
    expect(model.urgent).toBe(true);
    expect(formatClock(model.secondsLeft)).toBe("0:30");
  });

  it("shows the full-stomach cooldown after a meal", () => {
    const w = world();
    w.stats.eat();
    expect(hudModel(w).stomachCooldownSec).toBe(C.FULL_STOMACH_SEC);
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

  it("says the pack is full instead of offering a pick it cannot make", () => {
    const w = world();
    w.nodes.push({ id: 1, kind: "ore", x: 6.5, y: 5.5, z: 0, harvested: false });
    w.inventory.add("fruit", C.BACKPACK_CAPACITY);
    expect(hudModel(w).prompt).toEqual({ text: "Backpack full", progress: 0, blocked: true });
  });

  it("names the load waiting to be banked at camp", () => {
    const w = world();
    w.player.x = 1.5;
    w.player.y = 1.5;
    w.inventory.add("ore", 6);
    expect(hudModel(w).prompt).toEqual({
      text: "Press E to bank 6 ore",
      progress: 0,
      blocked: false,
    });

    w.inventory.depositOre();
    expect(hudModel(w).prompt).toEqual({ text: "No ore to bank", progress: 0, blocked: true });
  });
});

describe("the use hints", () => {
  it("stay quiet until there is something to use", () => {
    const w = world();
    expect(hudModel(w).holdingFruit).toBe(false);
    expect(hudModel(w).holdingWater).toBe(false);
  });

  it("appear with the item and leave with the last of it", () => {
    const w = world();
    w.inventory.add("fruit", 2);
    expect(hudModel(w).holdingFruit).toBe(true);
    expect(hudModel(w).holdingWater).toBe(false);

    w.inventory.add("water", 1);
    w.inventory.remove("fruit");
    w.inventory.remove("fruit");
    const model = hudModel(w);
    expect(model.holdingFruit).toBe(false);
    expect(model.holdingWater).toBe(true);
  });

  it("ignores ore, which is banked rather than used", () => {
    const w = world();
    w.inventory.add("ore", 5);
    expect(hudModel(w).holdingFruit).toBe(false);
    expect(hudModel(w).holdingWater).toBe(false);
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

describe("backpackText", () => {
  it("says empty rather than nothing at all", () => {
    expect(backpackText(new Inventory())).toBe("empty");
  });

  it("lists only what is in the pack, in a fixed order", () => {
    const bag = new Inventory();
    bag.add("ore", 5);
    bag.add("fruit", 2);
    expect(backpackText(bag)).toBe("fruit 2, ore 5");
    bag.add("water", 1);
    expect(backpackText(bag)).toBe("fruit 2, water 1, ore 5");
  });

  it("drops a kind again once the last of it is used", () => {
    const bag = new Inventory();
    bag.add("water", 1);
    bag.add("ore", 1);
    bag.remove("water");
    expect(backpackText(bag)).toBe("ore 1");
  });
});

describe("toastFor", () => {
  it("puts every kind of event into words", () => {
    expect(toastFor({ type: "harvested", kind: "ore", at: 0 })).toBe("+1 ore");
    expect(toastFor({ type: "deposited", gold: 5, at: 0 })).toBe("Banked 5 gold");
    expect(toastFor({ type: "ate", at: 0 })).toContain("Ate a fruit");
    expect(toastFor({ type: "drank", at: 0 })).toContain("Drank water");
    expect(toastFor({ type: "blocked", reason: "stomachFull", at: 0 })).toBe("Too full to eat");
    expect(toastFor({ type: "blocked", reason: "noWater", at: 0 })).toBe(
      "No water in the backpack",
    );
  });
});
