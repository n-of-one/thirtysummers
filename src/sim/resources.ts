import type { ResourceKind, TerrainKind } from "./types.ts";

/**
 * Whether a kind is back after a winter outside the near ring: every winter,
 * `REPLENISH_SHARE` of what was picked, or never. Inside the near ring
 * everything is back every year, whatever this says.
 */
export type Returns = "yearly" | "slowly" | "never";

export interface ResourceDef {
  kind: ResourceKind;
  /** Character in a map file. */
  glyph: string;
  /**
   * What a node glyph is standing on, since one character cannot say both. An
   * editor who wants a node on other ground moves it; the format is too small
   * to say more.
   */
  ground: TerrainKind;
  /** Backpack slots one takes. Bulky kinds take two. */
  slots: number;
  /**
   * How many go in one slot. One for everything that does not stack.
   *
   * The feather takes five, because it is light: carrying the first summer's
   * feathers home a pack at a time was a slog, not a choice. It is a limit and
   * not "as many as you like", so a feather field is still a number of trips.
   * [GUESS] the five.
   */
  stack: number;
  /** Gold one sells for in winter. */
  price: number;
  returns: Returns;
  /**
   * What it is for: `food` is eaten by the winter, `money` is only ever sold,
   * and `material` is what a build is paid in. Winter asks whether to keep or
   * sell material and nothing else; the list counts money as gold.
   *
   * Camp takes every kind and sells none: everything is sold in winter.
   */
  use: Use;
}

export type Use = "food" | "money" | "material";

const def = (
  kind: ResourceKind,
  glyph: string,
  ground: TerrainKind,
  slots: number,
  price: number,
  returns: Returns,
  use: Use,
  stack = 1,
): ResourceDef => ({ kind, glyph, ground, slots, stack, price, returns, use });

/** Is it only ever sold? Then the list counts it as its price in gold. */
export const isMoney = (kind: ResourceKind): boolean => RESOURCES[kind].use === "money";
/** Is it something a build is paid in, which winter asks whether to keep? */
export const isMaterial = (kind: ResourceKind): boolean => RESOURCES[kind].use === "material";

/**
 * Every kind that is gathered, in the order the HUD lists them: the near ring
 * first, then out along the ladder. [DOC] the kinds, where they grow, which
 * come back, the prices, the log's two slots and the feather's stack, from
 * docs/current/five-summers.md and docs/design/. [GUESS] ore's price: it is
 * placed nowhere until M12.
 *
 * The vine grows in the mud pocket that is its barrier, so a `y` means mud
 * under it; everything else stands on grass.
 */
export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  fruit: def("fruit", "f", "grass", 1, 1, "slowly", "food"),
  feather: def("feather", "p", "grass", 1, 1, "slowly", "money", 5),
  stick: def("stick", "s", "grass", 1, 1, "yearly", "material"),
  vine: def("vine", "y", "mud", 1, 1, "yearly", "material"),
  ore: def("ore", "v", "grass", 1, 2, "never", "money"),
  log: def("log", "l", "grass", 2, 1, "never", "material"),
  shell: def("shell", "h", "grass", 1, 2, "never", "money"),
};

export const RESOURCE_KINDS: readonly ResourceKind[] = Object.keys(RESOURCES) as ResourceKind[];
