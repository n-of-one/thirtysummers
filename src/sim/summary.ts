import { RESOURCE_KINDS } from "./resources.ts";
import type { ResourceKind, WorldEvent } from "./types.ts";
import type { World } from "./world.ts";

/** What the summer came to. */
export interface SummerSummary {
  /** Which summer this was, counting from 1. */
  year: number;
  /** The score: gold banked at camp, across every summer so far. */
  gold: number;
  /** Nodes picked, by kind. */
  harvested: Record<ResourceKind, number>;
  /** Drinks at a spring. */
  drinks: number;
  /** Fruit in the store at camp, across every summer so far. */
  fruitStored: number;
  /** Items still in the backpack when the summer ended, sold there and then. */
  soldAtEnd: number;
  /** ...and the rest of that pack, which went into the store. */
  storedAtEnd: number;
  /** Items thrown on the ground, wherever they were left. */
  dropped: number;
  /** The summer ended out of reach of camp. Winter will charge for the fetching. */
  endedAway: boolean;
  /** Thicket tiles cut through, bridge tiles laid, saplings felled. */
  tilesCut: number;
  bridgesBuilt: number;
  saplingsFelled: number;
  /** Wells dug and caches built. */
  wellsDug: number;
  cachesBuilt: number;
  /** Tiles covered on foot. */
  distanceWalked: number;
}

/**
 * Where in the log the current summer starts.
 *
 * The log is never cleared -- a new summer appends to the same one, so that
 * readers walking it with a cursor carry on rather than replay -- which means
 * counting a summer up has to begin at its own opening event. Summer 1 has none
 * of those before it, so it starts at zero.
 */
export function summerStartsAt(events: readonly WorldEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === "summerStarted") return i;
  }
  return 0;
}

/**
 * Count the summer up from the event log.
 *
 * Reading the log rather than keeping running totals means there is one place
 * a harvest is recorded, and no second set of counters to drift out of step
 * with it.
 *
 * Gold and the stored fruit are the exceptions, read from the inventory and the
 * store: they carry across summers, and the log would only ever say how much
 * was banked since the summer began.
 */
export function summarise(world: World): SummerSummary {
  const harvested = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<
    ResourceKind,
    number
  >;
  let drinks = 0;
  let tilesCut = 0;
  let bridgesBuilt = 0;
  let saplingsFelled = 0;
  let wellsDug = 0;
  let cachesBuilt = 0;
  let soldAtEnd = 0;
  let storedAtEnd = 0;
  let dropped = 0;
  let endedAway = false;

  const events = world.events as readonly WorldEvent[];
  for (let i = summerStartsAt(events); i < events.length; i++) {
    const event = events[i]!;
    if (event.type === "harvested") harvested[event.kind]++;
    else if (event.type === "drank") drinks++;
    else if (event.type === "cut") tilesCut++;
    else if (event.type === "built") bridgesBuilt++;
    else if (event.type === "felled") saplingsFelled++;
    else if (event.type === "dug") wellsDug++;
    else if (event.type === "cached") cachesBuilt++;
    else if (event.type === "dropped") dropped += event.n;
    else if (event.type === "pickedUp") dropped--;
    else if (event.type === "summerEnded") {
      soldAtEnd = event.sold;
      storedAtEnd = event.stored;
      endedAway = event.away;
    }
  }

  return {
    year: world.year,
    gold: world.inventory.gold,
    fruitStored: world.store.count("fruit"),
    harvested,
    drinks,
    soldAtEnd,
    storedAtEnd,
    // What is still lying out there when the summer closes: dropped, less
    // whatever was picked back up.
    dropped,
    endedAway,
    tilesCut,
    bridgesBuilt,
    saplingsFelled,
    wellsDug,
    cachesBuilt,
    distanceWalked: world.player.distanceWalked,
  };
}
