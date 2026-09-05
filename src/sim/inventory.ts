import * as C from "../config.ts";
import { RESOURCE_KINDS, type ResourceKind } from "./types.ts";

/**
 * The backpack, and the gold already banked at camp.
 *
 * The capacity is a total across every resource kind, not a limit per kind:
 * the doc gives one number, ten items. Gold is not carried, so it does not
 * count against it -- ore turns into gold only when it is dropped off.
 */
export class Inventory {
  private readonly counts: Record<ResourceKind, number> = { fruit: 0, water: 0, ore: 0 };
  gold = 0;

  constructor(readonly capacity: number = C.BACKPACK_CAPACITY) {}

  count(kind: ResourceKind): number {
    return this.counts[kind];
  }

  /** Items carried, all kinds together. */
  get carried(): number {
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

  /**
   * Put items in. Takes as many as fit and returns how many that was, so a
   * caller harvesting into a nearly full pack can leave the rest in the ground
   * rather than silently destroying it.
   */
  add(kind: ResourceKind, n = 1): number {
    const taken = Math.min(n, this.free);
    if (taken <= 0) return 0;
    this.counts[kind] += taken;
    return taken;
  }

  /** Take items out. All or nothing: false leaves the backpack untouched. */
  remove(kind: ResourceKind, n = 1): boolean {
    if (this.counts[kind] < n) return false;
    this.counts[kind] -= n;
    return true;
  }

  /** Hand over every ore at camp. Returns the gold it was worth. */
  depositOre(): number {
    const earned = this.counts.ore * C.ORE_GOLD;
    this.counts.ore = 0;
    this.gold += earned;
    return earned;
  }
}
