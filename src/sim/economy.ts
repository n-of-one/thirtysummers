import * as C from "../config.ts";
import type { Amounts } from "./inventory.ts";
import { RESOURCES } from "./resources.ts";
import { shopStock, type ShopItemId } from "./shop.ts";
import { initialKeep, levelAt, winterModel, type WinterModel } from "./winter.ts";

/**
 * The perfect player of docs/current/five-summers.md, played over a map's
 * node counts rather than walked: what the map offers each summer, through the
 * same winter arithmetic the screen and the world use.
 *
 * It is how a change to a price, a level or a field shows up as a margin on
 * `npm run map:check` instead of in a playtest three winters in.
 */

/** What a map offers, counted by where it is. */
export interface MapCounts {
  /** Fruit and feathers in the near ring, back every year. */
  ringFruit: number;
  ringFeathers: number;
  /** Sticks and vines in the near ring, back every year. */
  sticks: number;
  vines: number;
  /** Feathers across the stream, once bridged. A share comes back each winter. */
  fieldFeathers: number;
  /** Shells behind the copse, once it is felled. They never come back. */
  shells: number;
  /** Saplings that can be felled for logs. */
  saplings: number;
}

export interface EconomyYear {
  year: number;
  /**
   * What the feathers and shells brought home sell for: what the list counts.
   * Selling material would add a little more, and the perfect player does not.
   */
  counted: number;
  /** What the perfect player bought this winter. */
  bought: ShopItemId[];
  /** The winter as it was settled. */
  model: WinterModel;
}

/**
 * Play `years` summers and winters. Every summer picks everything in reach:
 * the near ring, what has come back across the stream, and the shells once the
 * axe is owned. Exactly the winter's fruit comes home and all the material is
 * kept, so the gold is the counted gold alone. Every winter buys whatever it
 * can afford in the order the shop lists it, and gives the rest to the family.
 */
export function perfectPlayer(counts: MapCounts, years = 3): EconomyYear[] {
  const owned = new Set<string>(["knife"]);
  let family = 0;
  let field = counts.fieldFeathers;
  const out: EconomyYear[] = [];

  for (let year = 1; year <= years; year++) {
    const shells = owned.has("axe") ? counts.shells : 0;
    const counted =
      (counts.ringFeathers + field) * RESOURCES.feather.price + shells * RESOURCES.shell.price;
    const store: Amounts = {
      fruit: Math.min(counts.ringFruit, C.UPKEEP_FRUIT),
      feather: counts.ringFeathers + field,
      shell: shells,
      stick: counts.sticks,
      vine: counts.vines,
      log: owned.has("axe") ? counts.saplings : 0,
    };
    const input = {
      year,
      store,
      awayAtEnd: false,
      keep: initialKeep(store),
      stock: shopStock(levelAt(family), owned),
      bought: [] as ShopItemId[],
      familySurplus: family,
    };
    for (const id of input.stock) {
      const line = winterModel(input).shop.find((l) => l.item.id === id);
      if (line?.affordable) input.bought = [...input.bought, id];
    }
    const model = winterModel(input);
    for (const id of input.bought) owned.add(id);
    family += model.left;
    out.push({ year, counted, bought: input.bought, model });
    // Everything across the stream was picked, and a share of it comes back.
    field = Math.floor(field * C.REPLENISH_SHARE);
  }
  return out;
}
