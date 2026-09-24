import * as C from "../config.ts";
import type { Amounts } from "./inventory.ts";
import { RESOURCES } from "./resources.ts";
import { shopStock, type ShopItemId } from "./shop.ts";
import { initialKeep, levelAt, winterModel, type WinterModel } from "./winter.ts";

/**
 * The two players of docs/current/five-summers.md, played over a map's node
 * counts rather than walked: what the map offers each summer, through the same
 * winter arithmetic the screen and the world use.
 *
 * It is how a change to a price, a level or a field shows up as a margin on
 * `npm run map:check` instead of in a playtest three winters in.
 *
 * What is held to is the chain -- which winter opens the shop, buys the axe
 * and buys the cart -- and not the gold in that document's two tables. Those
 * were written against the per-level upkeep of M10.6, while upkeep is flat at
 * level 0's row until it lands, so the families run a few gold high. See
 * docs/current/m10-6-upkeep.md, whose step 5 owns the rebalance.
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
   * Selling material would add nothing now that material has no price.
   */
  counted: number;
  /** What this winter bought. */
  bought: ShopItemId[];
  /** The winter as it was settled. */
  model: WinterModel;
}

/**
 * How much of a field a player takes: what is standing there, and what they
 * come home with. It is the only thing that separates the two players of
 * docs/current/five-summers.md -- both bring exactly the winter's fruit home,
 * keep every scrap of material, and buy whatever they can afford.
 */
interface Take {
  feathers: (standing: number) => number;
  shells: (standing: number) => number;
}

const all = (n: number) => n;

/** Everything worth picking: every feather across the stream, every shell. */
export const PERFECT: Take = { feathers: all, shells: all };
/** About half of what is across the stream, and two thirds of the shells. */
export const REFERENCE: Take = {
  feathers: (n) => Math.round(n / 2),
  shells: (n) => Math.round((n * 2) / 3),
};

/**
 * Play `years` summers and winters over a map's counts. Each summer takes the
 * whole near ring, `take` of what is standing across the stream, and `take` of
 * the shells once the axe is owned. Exactly the winter's fruit comes home and
 * all the material is kept, so the gold is the counted gold alone. Every
 * winter buys whatever it can afford in the order the shop lists it, and gives
 * the rest to the family.
 */
export function play(counts: MapCounts, take: Take, years = 3): EconomyYear[] {
  const owned = new Set<string>(["knife"]);
  let family = 0;
  // What is standing in each of the two fields at the start of the summer.
  let field = counts.fieldFeathers;
  let shellField = counts.shells;
  const out: EconomyYear[] = [];

  for (let year = 1; year <= years; year++) {
    const feathers = take.feathers(field);
    const shells = owned.has("axe") ? take.shells(shellField) : 0;
    const counted =
      (counts.ringFeathers + feathers) * RESOURCES.feather.price + shells * RESOURCES.shell.price;
    const store: Amounts = {
      fruit: Math.min(counts.ringFruit, C.UPKEEP_FRUIT),
      feather: counts.ringFeathers + feathers,
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
    // What was left standing stays, and a share of what was picked comes back.
    // A player who swept the field is the case where the first term is nought.
    field = field - feathers + Math.floor(feathers * C.REPLENISH_SHARE);
    // Never means never: a shell picked is a shell gone.
    shellField -= shells;
  }
  return out;
}

export const perfectPlayer = (counts: MapCounts, years = 3): EconomyYear[] =>
  play(counts, PERFECT, years);
export const referencePlayer = (counts: MapCounts, years = 4): EconomyYear[] =>
  play(counts, REFERENCE, years);
