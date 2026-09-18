import { describe, expect, it } from "vitest";
import { Inventory } from "../src/sim/inventory.ts";
import { RESOURCES } from "../src/sim/resources.ts";

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

  it("sells what sells at the drop-off, at the table's prices, and frees the slots", () => {
    const bag = new Inventory();
    bag.add("ore", 6);
    bag.add("fruit", 2);
    bag.add("stick", 1);
    expect(bag.sell()).toEqual({ sold: 6, gold: 6 * RESOURCES.ore.price });
    expect(bag.gold).toBe(6 * RESOURCES.ore.price);
    expect(bag.count("ore")).toBe(0);
    expect(bag.carried).toBe(3); // the fruit and the stick stay in the pack
  });

  it("keeps gold across drop-offs, and selling nothing earns nothing", () => {
    const bag = new Inventory();
    bag.add("ore", 3);
    bag.sell();
    expect(bag.sell()).toEqual({ sold: 0, gold: 0 });
    bag.add("ore", 2);
    bag.sell();
    expect(bag.gold).toBe(5 * RESOURCES.ore.price);
  });

  it("does not count banked gold against the backpack", () => {
    const bag = new Inventory();
    bag.add("ore", 10);
    bag.sell();
    expect(bag.gold).toBe(10 * RESOURCES.ore.price);
    expect(bag.free).toBe(10);
  });
});

describe("slots", () => {
  it("counts a log as two", () => {
    expect(RESOURCES.log.slots).toBe(2);
    const bag = new Inventory();
    bag.add("log", 3);
    expect(bag.carried).toBe(6);
    expect(bag.items).toBe(3);
    expect(bag.free).toBe(4);
  });

  it("takes only as many logs as there are whole pairs of slots for", () => {
    const bag = new Inventory();
    bag.add("ore", 7);
    expect(bag.fits("log")).toBe(true);
    expect(bag.add("log", 3)).toBe(1);
    expect(bag.carried).toBe(9);
    expect(bag.fits("log")).toBe(false);
    expect(bag.fits("ore")).toBe(true);
    expect(bag.add("log")).toBe(0);
    expect(bag.full).toBe(false);
  });

  it("moves what fits into a smaller container and leaves the rest", () => {
    const cache = new Inventory(Infinity);
    cache.add("log", 4);
    cache.add("shell", 5);
    const bag = new Inventory();
    // In table order, so the logs go first and the shells fill what is left.
    expect(cache.moveAllTo(bag)).toBe(6);
    expect(bag.count("log")).toBe(4);
    expect(bag.count("shell")).toBe(2);
    expect(cache.count("log")).toBe(0);
    expect(cache.count("shell")).toBe(3);
    expect(bag.carried).toBe(10);
  });

  it("puts everything into a container with no limit", () => {
    const bag = new Inventory();
    bag.add("log", 2);
    bag.add("vine", 6);
    const cache = new Inventory(Infinity);
    expect(bag.moveAllTo(cache)).toBe(8);
    expect(bag.carried).toBe(0);
    expect(cache.items).toBe(8);
  });
});
