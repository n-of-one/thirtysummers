import * as C from "../config.ts";
import { RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import type { ResourceKind } from "./types.ts";

/** An amount of each kind, for a recipe or a load. Missing kinds are none. */
export type Amounts = Partial<Record<ResourceKind, number>>;

/**
 * A container of resources, and the gold already banked at camp.
 *
 * The capacity is in slots, across every kind: the doc gives one number, ten,
 * and a bulky kind such as a log takes two of them. The store and a cache are
 * the same class with no capacity. Gold is not carried, so it does not count
 * against it.
 */
export class Inventory {
  private readonly counts = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<
    ResourceKind,
    number
  >;
  gold = 0;

  constructor(readonly capacity: number = C.BACKPACK_CAPACITY) {}

  count(kind: ResourceKind): number {
    return this.counts[kind];
  }

  /** Slots in use, all kinds together. */
  get carried(): number {
    let total = 0;
    for (const kind of RESOURCE_KINDS) total += this.counts[kind] * RESOURCES[kind].slots;
    return total;
  }

  /** Items held, all kinds together, whatever slots they take. */
  get items(): number {
    let total = 0;
    for (const kind of RESOURCE_KINDS) total += this.counts[kind];
    return total;
  }

  get free(): number {
    return this.capacity - this.carried;
  }

  get full(): boolean {
    return this.free <= 0;
  }

  /** Is there room for one more of `kind`? */
  fits(kind: ResourceKind): boolean {
    return this.free >= RESOURCES[kind].slots;
  }

  /**
   * Put items in. Takes as many as fit and returns how many that was, so a
   * caller harvesting into a nearly full pack can leave the rest in the ground
   * rather than silently destroying it.
   */
  add(kind: ResourceKind, n = 1): number {
    const taken = Math.min(n, Math.floor(this.free / RESOURCES[kind].slots));
    if (taken <= 0) return 0;
    this.counts[kind] += taken;
    return taken;
  }

  /** Take items out. All or nothing: false leaves the inventory untouched. */
  remove(kind: ResourceKind, n = 1): boolean {
    if (this.counts[kind] < n) return false;
    this.counts[kind] -= n;
    return true;
  }

  /** Enough of everything in `cost` to pay it? */
  has(cost: Amounts): boolean {
    for (const kind of RESOURCE_KINDS) {
      if (this.counts[kind] < (cost[kind] ?? 0)) return false;
    }
    return true;
  }

  /**
   * Pay `cost`. All or nothing, so a bridge tile never eats the sticks and then
   * discovers there was no vine: {@link has} and this cannot disagree, because
   * this asks it first.
   */
  pay(cost: Amounts): boolean {
    if (!this.has(cost)) return false;
    for (const kind of RESOURCE_KINDS) this.counts[kind] -= cost[kind] ?? 0;
    return true;
  }

  /** Empty it, or, given a kind, empty just that one. */
  clear(kind?: ResourceKind): void {
    if (kind) {
      this.counts[kind] = 0;
      return;
    }
    for (const k of RESOURCE_KINDS) this.counts[k] = 0;
  }

  /**
   * Move as much of everything as fits into `into`, in table order, and return
   * how many items that was. What does not fit stays here.
   */
  moveAllTo(into: Inventory): number {
    let moved = 0;
    for (const kind of RESOURCE_KINDS) {
      const taken = into.add(kind, this.counts[kind]);
      this.counts[kind] -= taken;
      moved += taken;
    }
    return moved;
  }

  /**
   * Sell every item whose table entry says it sells at camp. Returns how many
   * were sold and the gold it came to.
   */
  sell(): { sold: number; gold: number } {
    let sold = 0;
    let gold = 0;
    for (const kind of RESOURCE_KINDS) {
      if (RESOURCES[kind].atCamp !== "gold") continue;
      sold += this.counts[kind];
      gold += this.counts[kind] * RESOURCES[kind].price;
      this.counts[kind] = 0;
    }
    this.gold += gold;
    return { sold, gold };
  }
}
