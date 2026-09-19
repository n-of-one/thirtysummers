import * as C from "../config.ts";
import type { Amounts } from "./inventory.ts";
import { RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import { SHOP_BY_ID, type ShopItem, type ShopItemId } from "./shop.ts";
import type { ResourceKind } from "./types.ts";

/**
 * Winter, as arithmetic. No DOM, no clock, no state of its own: what the
 * player chose goes in, every number the screen shows comes out, and
 * `ui/winter.ts` only draws it. Changing a choice means calling this again
 * with the new choice, so there is one place where winter is worked out and
 * it can be tested without a browser.
 *
 * The order is the one in docs/design/winter.md: keep or sell, upkeep, the
 * shop, the family.
 */

export interface WinterInput {
  /** The summer that just ended, counting from 1. */
  year: number;
  /** The store: everything banked, and everything carried when the clock stopped. */
  store: Amounts;
  /** Gold already in hand. */
  gold: number;
  /** The summer ended out of reach of camp, which costs gold. */
  awayAtEnd: boolean;
  /** How many of each kind the player holds back from the sale. */
  keep: Amounts;
  /** What the town has this winter... */
  stock: readonly ShopItemId[];
  /** ...and what has been bought from it so far. */
  bought: readonly ShopItemId[];
  /** What earlier winters have already given the family. */
  familySurplus: number;
}

/**
 * One kind in the store: what there is of it, how much of it is sold, and
 * what that makes.
 *
 * `material` is the difference the screen is built around. A feather, ore and
 * a shell are only ever money, so there is nothing to decide about them and
 * no control on their line. A stick, a vine and a log are what bridges, wells
 * and carts are made of, so how many of them to sell is the one choice on
 * this half of the screen. Which is which comes from `atCamp` in the resource
 * table, not from a second list here.
 */
export interface StoreLine {
  kind: ResourceKind;
  have: number;
  kept: number;
  sold: number;
  /** Gold each. */
  price: number;
  /** Gold the sold ones make. */
  gold: number;
  /** Building material, so it can be kept back; otherwise it is only money. */
  material: boolean;
  /** Kept because something bought needs it, so the player cannot sell it by accident. */
  committed: number;
  /** What those are for, by name: "Axe". Empty when nothing is reserved. */
  committedTo: readonly string[];
}

/**
 * Food. Fruit is not a keep-or-sell choice: winter eats it first, and the
 * shortfall is bought at the town's price. What is left over is not food at
 * all any more -- it goes into the haul with the feathers and the ore, and
 * sells with them.
 */
export interface Food {
  have: number;
  needed: number;
  fromStore: number;
  /** Bought from the town, and what that costs. */
  bought: number;
  buyPrice: number;
  cost: number;
  /** Left over after winter is fed, and what that makes. */
  surplus: number;
  surplusGold: number;
  short: boolean;
}

/** What winter costs in gold, before anything is bought in the shop. */
export interface Upkeep {
  /** The flat gold the winter wants. */
  gold: number;
  /** Extra, for ending the summer away from camp. */
  away: number;
  /** Food, in gold: what the shortfall cost. */
  food: number;
  total: number;
  /** Paid in full. When it is not, the next summer is a tired one. */
  met: boolean;
  /** Gold still owed when it is not. */
  shortfall: number;
}

export interface ShopLine {
  item: ShopItem;
  bought: boolean;
  /** Gold is there for it, and so is the material, with what is already bought paid for. */
  affordable: boolean;
  /** Short of gold, short of material, or both -- what the line says when it is greyed. */
  shortGold: number;
  shortMaterials: Amounts;
}

/** A level the family reached this winter, and what reaching it opens. */
export interface Gained {
  level: number;
  unlocks: string;
}

/**
 * The family, before and after this winter.
 *
 * Both states are here because the screen shows the winter as a move: where
 * the family stood when the summer ended, what is being put in, and where
 * that leaves them. Nothing else on the screen spans two years.
 */
export interface Family {
  /** What this winter hands over. */
  given: number;
  /** What the family had before it, and what it has after. */
  before: number;
  total: number;
  /** Levels reached, from 0: before this winter, and after it. */
  levelBefore: number;
  level: number;
  /** How far through the level in question, from 0 to 1, before and after. */
  progressBefore: number;
  progress: number;
  /** What the next level wants in all, and how far off it is. */
  nextAt: number | null;
  toNext: number;
  /** The last level there is, so a level can be shown as "2 of 5". */
  finalLevel: number;
  /** Levels crossed this winter, in order, with what each one opens. */
  gained: readonly Gained[];
  /**
   * The town will deal with a family of some standing, and not before. Read
   * off the level the winter began with, not the one it ends with: what is
   * bought comes out of what the family is given, so a shop that opened on
   * the closing level could close itself the moment something was bought.
   */
  shopOpen: boolean;
}

export interface WinterModel {
  year: number;
  lines: StoreLine[];
  /**
   * Gold the sale makes. Gathered goods only: fruit is food, and food is
   * counted against the upkeep it is there to pay.
   */
  sales: number;
  food: Food;
  upkeep: Upkeep;
  /** Gold in hand plus the sale. */
  income: number;
  /** ...less the upkeep. */
  afterUpkeep: number;
  shop: ShopLine[];
  /** Gold spent in the shop. */
  spent: number;
  /**
   * What is left when everything is paid for. Negative when the winter could
   * not be paid at all, which is what makes the next summer a tired one; the
   * family gets `left`, which never goes below nothing.
   */
  balance: number;
  /** What is left when everything is paid for: what the family gets. */
  left: number;
  family: Family;
}

const amount = (a: Amounts, kind: ResourceKind): number => a[kind] ?? 0;

/**
 * What is held back when the screen opens: all of the building material, and
 * none of what is only ever money.
 *
 * Nothing is sold until the player says so. A stick sold is a stick that is
 * not a bridge, and that is the one decision this half of the screen asks
 * for, so it is asked rather than assumed.
 */
export function initialKeep(store: Amounts): Amounts {
  const keep: Amounts = {};
  for (const kind of RESOURCE_KINDS) {
    if (RESOURCES[kind].atCamp === "keep") keep[kind] = amount(store, kind);
  }
  return keep;
}

/**
 * Hold back less material until the winter can be paid for, and no further.
 *
 * The cheapest kinds go first, so a log worth three is not sold to raise one.
 * What a purchase has spoken for is never touched, and a winter that cannot
 * be covered at all sells everything it can and stops. Returns the new keep,
 * for the caller to put back into its input.
 */
export function sellToCover(input: WinterInput): Amounts {
  const byPrice = RESOURCE_KINDS.filter((kind) => RESOURCES[kind].atCamp === "keep").sort(
    (a, b) => RESOURCES[a].price - RESOURCES[b].price,
  );
  let keep = { ...input.keep };
  // One unit at a time, re-reckoned each time: selling changes the shop's
  // material as well as the purse, and this way the rule is simply "stop as
  // soon as it is paid for".
  for (;;) {
    const model = winterModel({ ...input, keep });
    if (model.balance >= 0) return keep;
    // Cheapest first, which is the order of `byPrice`, not the order the
    // lines are drawn in.
    const line = byPrice
      .map((kind) => model.lines.find((l) => l.kind === kind))
      .find((l) => l !== undefined && l.kept > l.committed);
    if (!line) return keep;
    keep = { ...keep, [line.kind]: line.kept - 1 };
  }
}

/** Every number the winter screen shows, from what the player has chosen so far. */
export function winterModel(input: WinterInput): WinterModel {
  const bought = input.bought.map((id) => SHOP_BY_ID[id]);

  // What is bought is paid in material before anything else: those items are
  // spoken for, and are neither sellable nor free to spend twice. The names
  // go with the counts, so a line can say what is holding its sticks back.
  const committed: Amounts = {};
  const committedTo: Partial<Record<ResourceKind, string[]>> = {};
  for (const item of bought) {
    for (const kind of RESOURCE_KINDS) {
      const n = amount(item.materials, kind);
      if (n <= 0) continue;
      committed[kind] = amount(committed, kind) + n;
      (committedTo[kind] ??= []).push(item.name);
    }
  }

  const food = foodFrom(input);

  const lines: StoreLine[] = [];
  let sales = 0;
  for (const kind of RESOURCE_KINDS) {
    // Fruit is food first: what the winter eats never reaches the sale, and
    // what is spare sells like anything else.
    const have = kind === "fruit" ? food.surplus : amount(input.store, kind);
    const kept = Math.min(have, Math.max(amount(input.keep, kind), amount(committed, kind)));
    const sold = have - kept;
    const price = RESOURCES[kind].price;
    lines.push({
      kind,
      have,
      kept,
      sold,
      price,
      gold: sold * price,
      material: RESOURCES[kind].atCamp === "keep",
      committed: Math.min(have, amount(committed, kind)),
      committedTo: committedTo[kind] ?? [],
    });
    sales += sold * price;
  }

  const away = input.awayAtEnd ? C.AWAY_GOLD_CHARGE : 0;
  const total = C.UPKEEP_GOLD + away + food.cost;
  const income = input.gold + sales;
  const upkeep: Upkeep = {
    gold: C.UPKEEP_GOLD,
    away,
    food: food.cost,
    total,
    met: income >= total,
    shortfall: Math.max(0, total - income),
  };
  // Nothing goes negative: what cannot be paid is missed, and the price of
  // missing it is next summer being a tired one, not a debt.
  const afterUpkeep = Math.max(0, income - total);

  const spent = bought.reduce((sum, item) => sum + item.gold, 0);
  const shop = input.stock.map((id) =>
    shopLine(SHOP_BY_ID[id], input, afterUpkeep - spent, committed),
  );
  const left = Math.max(0, afterUpkeep - spent);

  return {
    year: input.year,
    lines,
    sales,
    balance: income - total - spent,
    food,
    upkeep,
    income,
    afterUpkeep,
    shop,
    spent,
    left,
    family: familyFrom(input.familySurplus, left),
  };
}

/** Winter's food: what the store brought back, what the town has to make up. */
function foodFrom(input: WinterInput): Food {
  const have = amount(input.store, "fruit");
  const needed = C.UPKEEP_FRUIT;
  const fromStore = Math.min(have, needed);
  const bought = needed - fromStore;
  const surplus = have - fromStore;
  return {
    have,
    needed,
    fromStore,
    bought,
    buyPrice: C.FRUIT_BUY_PRICE,
    cost: bought * C.FRUIT_BUY_PRICE,
    surplus,
    surplusGold: surplus * RESOURCES.fruit.price,
    short: bought > 0,
  };
}

/**
 * One line of the shop. Greyed when it cannot be had, and it says why: the
 * gold missing, the material missing, or both. Material is counted against
 * what is in the store rather than against what the player has chosen to keep,
 * because buying is what makes them keep it -- the keep column follows the
 * purchase, not the other way round.
 *
 * Material that is kept is material that is not sold, so what a line really
 * costs is its gold plus what its material would have made. Without that, a
 * line can read affordable and then leave the purse short the moment the
 * keeping takes the sale down.
 */
function shopLine(
  item: ShopItem,
  input: WinterInput,
  goldLeft: number,
  committed: Amounts,
): ShopLine {
  const bought = input.bought.includes(item.id);
  const shortMaterials: Amounts = {};
  let forgone = 0;
  for (const kind of RESOURCE_KINDS) {
    const want = amount(item.materials, kind);
    if (want === 0) continue;
    // What this line would need on top of what other purchases already took.
    const spare = amount(input.store, kind) - (bought ? 0 : amount(committed, kind));
    if (want > spare) shortMaterials[kind] = want - spare;
    // Only what is still up for sale: what is kept by hand is already out of
    // the sale the gold left was counted from.
    forgone += Math.max(0, Math.min(want, spare) - amount(input.keep, kind)) * RESOURCES[kind].price;
  }
  // A recipe is not bought, so it is never short of gold: what it wants is
  // material, carried home next summer.
  const shortGold =
    bought || item.kind === "recipe" ? 0 : Math.max(0, item.gold + forgone - goldLeft);
  return {
    item,
    bought,
    affordable:
      item.kind === "buy" && !bought && shortGold === 0 && Object.keys(shortMaterials).length === 0,
    shortGold,
    shortMaterials,
  };
}

/**
 * The family. Gold does not carry across winters: whatever is left is given,
 * and the levels are what the surplus adds up to over a life. A level does
 * nothing yet; it is there so the surplus means something.
 */
function familyFrom(before: number, given: number): Family {
  const total = before + given;
  const levelBefore = levelAt(before);
  const level = levelAt(total);
  const nextAt = level < C.FAMILY_LEVELS.length ? C.FAMILY_LEVELS[level]! : null;
  const gained: Gained[] = [];
  for (let l = levelBefore + 1; l <= level; l++) {
    gained.push({ level: l, unlocks: FAMILY_UNLOCKS[l] ?? "" });
  }
  return {
    given,
    before,
    total,
    levelBefore,
    level,
    progressBefore: progressAt(before),
    progress: progressAt(total),
    nextAt,
    toNext: nextAt === null ? 0 : nextAt - total,
    finalLevel: C.FAMILY_LEVELS.length,
    gained,
    shopOpen: levelBefore >= SHOP_FROM_LEVEL,
  };
}

/** Levels a given total has paid for. */
function levelAt(total: number): number {
  let level = 0;
  while (level < C.FAMILY_LEVELS.length && total >= C.FAMILY_LEVELS[level]!) level++;
  return level;
}

/** How far a total stands through the level it is working on, from 0 to 1. */
function progressAt(total: number): number {
  const level = levelAt(total);
  if (level >= C.FAMILY_LEVELS.length) return 1;
  const from = level === 0 ? 0 : C.FAMILY_LEVELS[level - 1]!;
  const to = C.FAMILY_LEVELS[level]!;
  return to > from ? (total - from) / (to - from) : 1;
}

/** [GUESS] The family level the town starts dealing with. */
export const SHOP_FROM_LEVEL = 1;

/**
 * What each level opens.
 *
 * [GUESS] all of it, and the whole idea: docs/design/winter.md says a level
 * does nothing yet and may later unlock tools. These are here so the line
 * that announces a level has something to announce -- what a level is worth
 * is not settled.
 */
export const FAMILY_UNLOCKS: Readonly<Record<number, string>> = {
  1: "the shop opens next winter",
  2: "the cart, in the shop",
  3: "boots, in the shop",
  4: "a bigger pack",
  5: "a second pair of hands",
};
