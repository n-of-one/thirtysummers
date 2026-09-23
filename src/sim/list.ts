import * as C from "../config.ts";
import type { Amounts } from "./inventory.ts";
import { isMoney, RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import { SHOP_BY_ID, type ShopItemId } from "./shop.ts";
import type { ResourceKind } from "./types.ts";
import type { WinterModel } from "./winter.ts";

/**
 * The list: what the player means to bring home, made in winter and carried
 * through the summer in a corner of the HUD.
 *
 * Each line is one box on the winter screen. The ticked ones are the list, in
 * the order they are filled: food, rent, each item, the family's next level.
 * It names amounts, never places, which is the whole of the steering a new
 * player gets.
 */
export type ListLine =
  | { kind: "food" }
  | { kind: "rent" }
  | { kind: "item"; id: ShopItemId }
  /** The gold the family still needs for `level`, as it stood when winter ended. */
  | { kind: "level"; level: number; gold: number };

/** Summer 1's list: the same thing with no shop. */
export const FIRST_LIST: readonly ListLine[] = [
  { kind: "food" },
  { kind: "rent" },
  { kind: "level", level: 1, gold: C.FAMILY_LEVELS[0]! },
];

/** A name for a line that stays the same across redraws, for a checkbox. */
export function lineKey(line: ListLine): string {
  return line.kind === "item" ? `item:${line.id}` : line.kind;
}

/**
 * Every line a winter offers a box for: upkeep, every item in the shop not
 * bought yet, everything the family's new level opens for next winter, and
 * the family's next level. The list is these, less what the player unticked.
 *
 * What the new level opens is offered even when the shop is closed: reaching
 * level 1 in the first winter puts the axe on summer 2's list.
 */
export function offeredLines(model: WinterModel): ListLine[] {
  const lines: ListLine[] = [{ kind: "food" }, { kind: "rent" }];
  for (const line of model.shop) {
    if (!line.bought && line.item.kind === "buy") lines.push({ kind: "item", id: line.item.id });
  }
  for (const item of model.unlocked) {
    if (item.kind === "buy") lines.push({ kind: "item", id: item.id });
  }
  const fam = model.family;
  if (fam.nextAt !== null) lines.push({ kind: "level", level: fam.level + 1, gold: fam.toNext });
  return lines;
}

/**
 * One amount on a line of the list, measured twice: how much has been
 * collected, in the pack or at camp, and how much of that is back at camp.
 */
export interface ListPart {
  /** Gold, or a kind counted in kind. */
  unit: "gold" | ResourceKind;
  need: number;
  collected: number;
  atCamp: number;
}

export interface ListRow {
  line: ListLine;
  label: string;
  parts: ListPart[];
  /** Every amount on it is at camp. The HUD takes the line away. */
  done: boolean;
}

/** What a load is worth as the list counts it: money at its price, nothing else. */
export function goldOf(load: Amounts): number {
  return RESOURCE_KINDS.filter(isMoney).reduce((sum, k) => sum + (load[k] ?? 0) * RESOURCES[k].price, 0);
}

/**
 * The list, filled from the top.
 *
 * Food is counted in fruit. Gold is one pot, taken in order: rent first, then
 * each item's gold, then the family. The pot is what the money -- feathers and
 * shells -- will sell for in winter; selling building material ticks nothing,
 * since it is not meant to be the way to earn. An item's material is counted
 * in kind, the axe's sticks as sticks, and taken in order as well, so two
 * lines cannot count the same stick.
 *
 * Everything is worked out twice, from what is at camp and from what is at
 * camp and in the pack together, so a line can say "collected" before it says
 * "home".
 */
export function fillList(list: readonly ListLine[], pack: Amounts, camp: Amounts): ListRow[] {
  const both: Amounts = {};
  for (const k of RESOURCE_KINDS) both[k] = (pack[k] ?? 0) + (camp[k] ?? 0);
  const collected = allocate(list, both);
  const home = allocate(list, camp);
  return list.map((line, i) => {
    const parts = collected[i]!.parts.map((part, j) => ({
      unit: part.unit,
      need: part.need,
      collected: part.have,
      atCamp: home[i]!.parts[j]!.have,
    }));
    return {
      line,
      label: collected[i]!.label,
      parts,
      done: parts.every((p) => p.atCamp >= p.need),
    };
  });
}

/** The list filled from one load, top down. */
function allocate(
  list: readonly ListLine[],
  load: Amounts,
): { label: string; parts: { unit: "gold" | ResourceKind; need: number; have: number }[] }[] {
  let pot = goldOf(load);
  const materials: Amounts = { ...load };
  const take = (want: number, from: number) => Math.min(want, Math.max(0, from));
  const gold = (need: number) => {
    const have = take(need, pot);
    pot -= have;
    return { unit: "gold" as const, need, have };
  };

  return list.map((line) => {
    switch (line.kind) {
      case "food":
        return {
          label: "Food",
          parts: [{ unit: "fruit", need: C.UPKEEP_FRUIT, have: take(C.UPKEEP_FRUIT, load.fruit ?? 0) }],
        };
      case "rent":
        return { label: "Rent", parts: [gold(C.UPKEEP_GOLD)] };
      case "item": {
        const item = SHOP_BY_ID[line.id];
        const parts: { unit: "gold" | ResourceKind; need: number; have: number }[] =
          item.gold > 0 ? [gold(item.gold)] : [];
        for (const kind of RESOURCE_KINDS) {
          const need = item.materials[kind] ?? 0;
          if (need <= 0) continue;
          const have = take(need, materials[kind] ?? 0);
          materials[kind] = (materials[kind] ?? 0) - have;
          parts.push({ unit: kind, need, have });
        }
        return { label: item.name, parts };
      }
      case "level":
        // Named for what the gold does, not for what the level opens: that is
        // not in the shop until the winter after, and the box does not
        // promise it.
        return { label: "Increase family wealth", parts: [gold(line.gold)] };
    }
  });
}
