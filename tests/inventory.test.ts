import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { Inventory } from "../src/sim/inventory.ts";

describe("Inventory", () => {
  it("starts empty, with the capacity from the design doc", () => {
    const bag = new Inventory();
    expect(bag.capacity).toBe(10);
    expect(bag.carried).toBe(0);
    expect(bag.free).toBe(10);
    expect(bag.full).toBe(false);
    expect(bag.gold).toBe(0);
  });

  it("counts every kind against the same ten slots", () => {
    const bag = new Inventory();
    bag.add("fruit", 4);
    bag.add("vine", 3);
    bag.add("ore", 3);
    expect(bag.carried).toBe(10);
    expect(bag.full).toBe(true);
    expect(bag.count("fruit")).toBe(4);
  });

  it("takes only what fits and says how much that was", () => {
    const bag = new Inventory();
    bag.add("ore", 8);
    expect(bag.add("fruit", 5)).toBe(2);
    expect(bag.carried).toBe(10);
    expect(bag.count("fruit")).toBe(2);
    expect(bag.add("fruit")).toBe(0); // nothing more goes in
  });

  it("removes all or nothing", () => {
    const bag = new Inventory();
    bag.add("fruit", 2);
    expect(bag.remove("fruit", 3)).toBe(false);
    expect(bag.count("fruit")).toBe(2);
    expect(bag.remove("fruit", 2)).toBe(true);
    expect(bag.count("fruit")).toBe(0);
    expect(bag.remove("stick")).toBe(false);
  });

  it("turns ore into gold at the drop-off and frees the slots", () => {
    const bag = new Inventory();
    bag.add("ore", 6);
    bag.add("fruit", 2);
    expect(bag.depositOre()).toBe(6 * C.ORE_GOLD);
    expect(bag.gold).toBe(6);
    expect(bag.count("ore")).toBe(0);
    expect(bag.carried).toBe(2); // the fruit stays in the pack
  });

  it("keeps gold across drop-offs, and banking nothing earns nothing", () => {
    const bag = new Inventory();
    bag.add("ore", 3);
    bag.depositOre();
    expect(bag.depositOre()).toBe(0);
    bag.add("ore", 2);
    bag.depositOre();
    expect(bag.gold).toBe(5);
  });

  it("does not count banked gold against the backpack", () => {
    const bag = new Inventory();
    bag.add("ore", 10);
    bag.depositOre();
    expect(bag.gold).toBe(10);
    expect(bag.free).toBe(10);
  });
});
