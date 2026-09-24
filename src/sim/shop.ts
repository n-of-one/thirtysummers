import type { Amounts } from "./inventory.ts";

/** What the town sells. */
export type ShopItemId = "axe" | "cart";

/**
 * How a line in the shop is paid for.
 *
 * `buy` is bought outright: gold, and sometimes material carried home, which
 * is why camp has a keep column at all. `recipe` is knowledge: shown so its
 * cost is written down somewhere, and never bought. The well is one, and comes
 * back with M12.
 */
export type ShopKind = "buy" | "recipe";

export interface ShopItem {
  id: ShopItemId;
  kind: ShopKind;
  name: string;
  /** One line under the name, saying what it is for. */
  note: string;
  /**
   * The family level that unlocks it. The town stocks it from the winter after
   * the family reaches that level, and shows it frosted in the winter it does.
   */
  level: number;
  /** Gold the town wants for it. Nothing, for a recipe. */
  gold: number;
  /** What has to be carried home with the gold, kept back from the sale. */
  materials: Amounts;
}

const item = (
  id: ShopItemId,
  kind: ShopKind,
  name: string,
  note: string,
  level: number,
  gold: number,
  materials: Amounts = {},
): ShopItem => ({ id, kind, name, note, level, gold, materials });

/**
 * The shop's table, in the order it is listed: what a summer aims at first at
 * the top.
 *
 * [DOC] every line, its level and its price, from docs/current/five-summers.md.
 * Level 3 opens the well and planks, which come with M12.
 */
export const SHOP: readonly ShopItem[] = [
  item("axe", "buy", "Axe", "Fells saplings for logs", 1, 6, { stick: 3 }),
  item("cart", "buy", "Cart", "Hauls a load home over grass and bridge", 2, 20, { log: 6 }),
];

export const SHOP_BY_ID: Record<ShopItemId, ShopItem> = Object.fromEntries(
  SHOP.map((it) => [it.id, it]),
) as Record<ShopItemId, ShopItem>;

/**
 * What the town has this winter: everything the family's level at the start
 * of the winter unlocks, less what is already owned. Read off the level the
 * winter began with, so a purchase can never close the shop it was made in.
 */
export function shopStock(level: number, owned: ReadonlySet<string>): ShopItemId[] {
  return SHOP.filter((it) => it.level <= level && !owned.has(it.id)).map((it) => it.id);
}
