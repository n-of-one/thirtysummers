import { RESOURCE_KINDS, type ResourceKind, type WorldEvent } from "./types.ts";
import type { World } from "./world.ts";

/** What the day came to. */
export interface DaySummary {
  /** The score: gold banked at camp. */
  gold: number;
  /** Nodes picked, by kind. */
  harvested: Record<ResourceKind, number>;
  fruitEaten: number;
  waterDrunk: number;
  /** Ore still in the backpack when the light went, and so worth nothing. */
  oreUnbanked: number;
  /** Tiles covered on foot. */
  distanceWalked: number;
}

/**
 * Count the day up from the event log.
 *
 * Reading the log rather than keeping running totals means there is one place
 * a harvest is recorded, and no second set of counters to drift out of step
 * with it.
 */
export function summarise(world: World): DaySummary {
  const harvested = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, 0])) as Record<
    ResourceKind,
    number
  >;
  let fruitEaten = 0;
  let waterDrunk = 0;

  for (const event of world.events as readonly WorldEvent[]) {
    if (event.type === "harvested") harvested[event.kind]++;
    else if (event.type === "ate") fruitEaten++;
    else if (event.type === "drank") waterDrunk++;
  }

  return {
    gold: world.inventory.gold,
    harvested,
    fruitEaten,
    waterDrunk,
    oreUnbanked: world.inventory.count("ore"),
    distanceWalked: world.player.distanceWalked,
  };
}
