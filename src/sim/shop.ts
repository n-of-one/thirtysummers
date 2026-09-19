import type { Amounts } from "./inventory.ts";

/** What the town sells, and the one thing it only teaches. */
export type ShopItemId = "axe" | "cart" | "boots" | "well";

/**
 * How a line in the shop is paid for.
 *
 * `buy` is bought outright: gold, and sometimes material carried home, which
 * is why the store has a keep column at all. `recipe` is knowledge -- the well
 * is never bought, it is shown so its cost is written down somewhere, and it
 * is what the player aims a summer at.
 */
export type ShopKind = "buy" | "recipe";

export interface ShopItem {
  id: ShopItemId;
  kind: ShopKind;
  name: string;
  /** One line under the name, saying what it is for. */
  note: string;
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
  gold: number,
  materials: Amounts = {},
): ShopItem => ({ id, kind, name, note, gold, materials });

/**
 * The shop's table, in the order it is listed: what a summer aims at first at
 * the top.
 *
 * [DOC] which things the town sells and in which winter each is meant to be
 * afforded, from docs/current/five-summers.md: the axe in winter 1 for gold
 * and something carried home, the cart in winter 2 paid in logs, the well a
 * recipe of logs and sticks rather than a purchase, boots a candidate with no
 * job yet. [GUESS] every price, until winter 1 has been played against a real
 * summer-1 haul.
 */
export const SHOP: readonly ShopItem[] = [
  item("axe", "buy", "Axe", "Fells saplings for logs", 8, { stick: 3 }),
  item("cart", "buy", "Cart", "Hauls a load home over grass and bridge", 15, { log: 4 }),
  item("well", "recipe", "Well", "Dug where there is no water", 0, { log: 2, stick: 2 }),
  item("boots", "buy", "Boots", "Nothing yet", 20),
];

export const SHOP_BY_ID: Record<ShopItemId, ShopItem> = Object.fromEntries(
  SHOP.map((it) => [it.id, it]),
) as Record<ShopItemId, ShopItem>;

/**
 * What the town has in stock, by winter. Everything is stocked while the
 * winter screen is being iterated on; which year opens which line is settled
 * once the screen itself is.
 */
export const SHOP_BY_YEAR: Readonly<Record<number, readonly ShopItemId[]>> = {
  1: ["axe", "cart", "well", "boots"],
  2: ["axe", "cart", "well", "boots"],
  3: ["axe", "cart", "well", "boots"],
  4: ["axe", "cart", "well", "boots"],
  5: ["axe", "cart", "well", "boots"],
};
