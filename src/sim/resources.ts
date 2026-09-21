import type { ResourceKind, TerrainKind } from "./types.ts";

/**
 * Whether a kind is back after a winter: every winter, a share each winter,
 * or never. Nothing reads it until winter exists; it is here so the table is
 * the one place a kind is described.
 */
export type Returns = "yearly" | "slowly" | "never";

/**
 * What banking at camp does with a kind. `gold` sells it there and then;
 * `store` puts it in the store, where winter's keep-or-sell question finds it.
 *
 * There used to be a third answer, `keep`, which left building material in the
 * pack. It made a pack full of vines a dead end for the whole run, so camp now
 * takes everything.
 */
export type AtCamp = "gold" | "store";

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
  /** Gold one is worth. */
  price: number;
  returns: Returns;
  atCamp: AtCamp;
  /**
   * Something a build is paid in, rather than only ever money. Winter asks
   * whether to keep it or sell it; nothing else does.
   */
  material: boolean;
}

const def = (
  kind: ResourceKind,
  glyph: string,
  ground: TerrainKind,
  slots: number,
  price: number,
  returns: Returns,
  atCamp: AtCamp,
  material = false,
): ResourceDef => ({ kind, glyph, ground, slots, price, returns, atCamp, material });

/**
 * Every kind that is gathered, in the order the HUD lists them: the near ring
 * first, then out along the ladder. [DOC] the kinds, where they grow, which
 * come back, and the log's two slots, from docs/current/five-summers.md and
 * docs/design/. [GUESS] the prices, on the ladder's rule that near camp sells
 * for one and each barrier out roughly doubles it.
 *
 * The vine grows in the mud pocket that is its barrier, so a `y` means mud
 * under it; everything else stands on grass.
 */
export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  fruit: def("fruit", "f", "grass", 1, 1, "yearly", "store"),
  feather: def("feather", "p", "grass", 1, 1, "yearly", "gold"),
  stick: def("stick", "s", "grass", 1, 1, "yearly", "store", true),
  vine: def("vine", "y", "mud", 1, 1, "yearly", "store", true),
  ore: def("ore", "v", "grass", 1, 2, "slowly", "gold"),
  log: def("log", "l", "grass", 2, 3, "never", "store", true),
  shell: def("shell", "h", "grass", 1, 4, "slowly", "gold"),
};

export const RESOURCE_KINDS: readonly ResourceKind[] = Object.keys(RESOURCES) as ResourceKind[];
