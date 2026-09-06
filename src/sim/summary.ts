import { RESOURCE_KINDS, type ResourceKind, type WorldEvent } from "./types.ts";
import type { World } from "./world.ts";

/**
 * What the summer came to.
 *
 * Still called a day summary in the code: the identifiers change when winter is
 * built and the whole vocabulary moves at once. Nothing the player reads says
 * "day".
 */
export interface DaySummary {
  /** Which summer this was, counting from 1. */
  year: number;
  /** The score: gold banked at camp, across every summer so far. */
  gold: number;
  /** Nodes picked, by kind. */
  harvested: Record<ResourceKind, number>;
  fruitEaten: number;
  waterDrunk: number;
  /** Ore still in the backpack when the light went, and so worth nothing. */
  oreUnbanked: number;
  /** Thicket tiles cut through, and bridge tiles laid. */
  tilesCut: number;
  bridgesBuilt: number;
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
 * Gold is the exception and is read from the inventory: it is the score, it
 * carries across summers, and the log would only ever say how much of it was
 * earned since the last sunrise.
 */
export function summarise(world: World): DaySummary {
  const harvested = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<
    ResourceKind,
    number
  >;
  let fruitEaten = 0;
  let waterDrunk = 0;
  let tilesCut = 0;
  let bridgesBuilt = 0;

  const events = world.events as readonly WorldEvent[];
  for (let i = summerStartsAt(events); i < events.length; i++) {
    const event = events[i]!;
    if (event.type === "harvested") harvested[event.kind]++;
    else if (event.type === "ate") fruitEaten++;
    else if (event.type === "drank") waterDrunk++;
    else if (event.type === "cut") tilesCut++;
    else if (event.type === "built") bridgesBuilt++;
  }

  return {
    year: world.year,
    gold: world.inventory.gold,
    harvested,
    fruitEaten,
    waterDrunk,
    oreUnbanked: world.inventory.count("ore"),
    tilesCut,
    bridgesBuilt,
    distanceWalked: world.player.distanceWalked,
  };
}
