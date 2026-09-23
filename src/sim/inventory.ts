import * as C from "../config.ts";
import { RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import type { ResourceKind } from "./types.ts";

/** An amount of each kind, for a recipe or a load. Missing kinds are none. */
export type Amounts = Partial<Record<ResourceKind, number>>;

/**
 * A container of resources.
 *
 * The capacity is in slots, across every kind: the doc gives one number, ten,
 * and a bulky kind such as a log takes two of them. A kind that stacks puts
 * several in one slot. Camp is the same class with no capacity.
 * There is no gold in a summer: everything is sold in winter.
 */
export class Inventory {
  private readonly counts = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<
    ResourceKind,
    number
  >;

  /**
   * The kinds held, in the order they were picked up: what went in first is
   * first, and a kind that runs out and is picked up again goes to the back.
   *
   * The pack strip is drawn from this, because a slot that shuffles while the
   * player is looking at it is the one thing a row of slots must not do.
   */
  private readonly order: ResourceKind[] = [];

  constructor(readonly capacity: number = C.BACKPACK_CAPACITY) {}

  count(kind: ResourceKind): number {
    return this.counts[kind];
  }

  /** The kinds held, in the order they arrived. */
  get kinds(): readonly ResourceKind[] {
    return this.order;
  }

  /**
   * Bring {@link order} back in step with the counts, after any change to
   * them: a kind that is gone leaves, and a new one joins at the back.
   */
  private track(): void {
    for (let i = this.order.length - 1; i >= 0; i--) {
      if (this.counts[this.order[i]!] === 0) this.order.splice(i, 1);
    }
    for (const kind of RESOURCE_KINDS) {
      if (this.counts[kind] > 0 && !this.order.includes(kind)) this.order.push(kind);
    }
  }

  /** Slots one kind takes up here: a part-filled stack still takes a whole one. */
  slotsOf(kind: ResourceKind): number {
    const { slots, stack } = RESOURCES[kind];
    return Math.ceil(this.counts[kind] / stack) * slots;
  }

  /** Slots in use, all kinds together. */
  get carried(): number {
    let total = 0;
    for (const kind of RESOURCE_KINDS) total += this.slotsOf(kind);
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

  /** Is there room for one more of `kind`? A part-filled stack always has. */
  fits(kind: ResourceKind): boolean {
    return this.room(kind) > 0;
  }

  /**
   * How many more of `kind` fit: the room left in a part-filled stack, plus a
   * stack for every slot still free.
   */
  private room(kind: ResourceKind): number {
    const { slots, stack } = RESOURCES[kind];
    const inPart = this.counts[kind] % stack;
    const started = inPart > 0 ? stack - inPart : 0;
    return started + Math.floor(this.free / slots) * stack;
  }

  /**
   * Put items in. Takes as many as fit and returns how many that was, so a
   * caller harvesting into a nearly full pack can leave the rest in the ground
   * rather than silently destroying it.
   */
  add(kind: ResourceKind, n = 1): number {
    const taken = Math.min(n, this.room(kind));
    if (taken <= 0) return 0;
    this.counts[kind] += taken;
    this.track();
    return taken;
  }

  /** Take items out. All or nothing: false leaves the inventory untouched. */
  remove(kind: ResourceKind, n = 1): boolean {
    if (this.counts[kind] < n) return false;
    this.counts[kind] -= n;
    this.track();
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
    this.track();
    return true;
  }

  /** Empty it, or, given a kind, empty just that one. */
  clear(kind?: ResourceKind): void {
    if (kind) this.counts[kind] = 0;
    else for (const k of RESOURCE_KINDS) this.counts[k] = 0;
    this.track();
  }

  /**
   * Move as much of everything as fits into `into`, in the order it was picked
   * up, and return how many items that was. What does not fit stays here.
   */
  moveAllTo(into: Inventory): number {
    let moved = 0;
    for (const kind of [...this.order]) {
      const taken = into.add(kind, this.counts[kind]);
      this.counts[kind] -= taken;
      moved += taken;
    }
    this.track();
    return moved;
  }
}
