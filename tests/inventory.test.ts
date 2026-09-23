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

  it("puts five feathers in a slot, and a part-filled stack still takes one", () => {
    expect(RESOURCES.feather.stack).toBe(5);
    const bag = new Inventory();
    bag.add("feather", 5);
    expect(bag.carried).toBe(1);
    bag.add("feather", 1);
    expect(bag.carried).toBe(2);
    expect(bag.items).toBe(6);
  });

  it("fills the started stack before it needs another slot", () => {
    const bag = new Inventory();
    bag.add("feather", 6);
    bag.add("fruit", 8);
    // Nine slots used: two of feathers, eight of fruit is ten. One slot free.
    expect(bag.carried).toBe(10);
    expect(bag.full).toBe(true);
    // Four more go in the part-filled stack, and the fifth has nowhere to go.
    expect(bag.fits("feather")).toBe(true);
    expect(bag.add("feather", 5)).toBe(4);
    expect(bag.count("feather")).toBe(10);
    expect(bag.fits("feather")).toBe(false);
  });

  it("takes a pack's worth of feathers and leaves the rest", () => {
    const bag = new Inventory();
    expect(bag.add("feather", 100)).toBe(50);
    expect(bag.carried).toBe(10);
  });

  it("keeps the kinds in the order they were picked up", () => {
    const bag = new Inventory();
    bag.add("feather", 2);
    bag.add("fruit", 1);
    bag.add("stick", 1);
    expect([...bag.kinds]).toEqual(["feather", "fruit", "stick"]);
    // More of a kind already held stays where it is.
    bag.add("feather", 1);
    expect([...bag.kinds]).toEqual(["feather", "fruit", "stick"]);
    // A kind that runs out leaves, and comes back at the end.
    bag.remove("feather", 3);
    expect([...bag.kinds]).toEqual(["fruit", "stick"]);
    bag.add("feather", 1);
    expect([...bag.kinds]).toEqual(["fruit", "stick", "feather"]);
    bag.clear();
    expect([...bag.kinds]).toEqual([]);
  });

  it("needs a free slot to start a stack", () => {
    const bag = new Inventory();
    bag.add("fruit", 10);
    expect(bag.fits("feather")).toBe(false);
    expect(bag.add("feather", 3)).toBe(0);
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
