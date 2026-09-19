import type { IconName, Icons } from "../render/packs/icons.ts";
import type { ShopItem, ShopItemId } from "../sim/shop.ts";
import type { ResourceKind } from "../sim/types.ts";
import { winterModel, type ShopLine, type StoreLine, type WinterInput } from "../sim/winter.ts";
import { need } from "./hud.ts";

/**
 * The winter screen: the one place between two summers.
 *
 * It owns nothing but the player's choices -- what to keep, what to buy --
 * and hands them to `sim/winter.ts`, which works out every number on it. The
 * screen redraws from the model after each click, so what a choice costs is
 * read off the same arithmetic that will be applied when the summer starts.
 *
 * There is no clock here. Nothing on this screen is timed, and nothing about
 * winter was announced during the summer except the two numbers the HUD
 * carried all along: what winter needs, and what the store holds.
 */
export class WinterScreen {
  private readonly root: HTMLElement;
  private readonly year: HTMLElement;
  private readonly soldList: HTMLElement;
  private readonly materialList: HTMLElement;
  private readonly sales: HTMLElement;
  private readonly upkeep: HTMLElement;
  private readonly shopList: HTMLElement;
  private readonly town: HTMLElement;
  private readonly townRule: HTMLElement;
  private readonly family: HTMLElement;
  private readonly familyGold: HTMLElement;
  private readonly familyFinal: HTMLElement;
  private readonly familyTotal: HTMLElement;
  private readonly totals: HTMLElement;
  private readonly balance: HTMLElement;
  private readonly next: HTMLButtonElement;

  private input: WinterInput;
  private onNext: () => void = () => {};

  /**
   * @param icons The map's own art, cut out for the HUD. Null draws the rows
   *              with words alone, which is what a run without the licensed
   *              art gets.
   */
  constructor(
    private readonly icons: Icons | null = null,
    root: ParentNode = document,
  ) {
    this.root = need(root, "#winter");
    this.year = need(root, "#winter-year");
    this.soldList = need(root, "#winter-sold");
    this.materialList = need(root, "#winter-materials");
    this.sales = need(root, "#winter-sales");
    this.upkeep = need(root, "#winter-upkeep");
    this.shopList = need(root, "#winter-shop");
    this.town = need(root, "#winter-town");
    this.townRule = need(root, "#winter-rule");
    this.family = need(root, "#winter-family");
    this.familyGold = need(root, "#winter-family-gold");
    this.familyFinal = need(root, "#winter-family-final");
    this.familyTotal = need(root, "#winter-family-total");
    this.totals = need(root, "#winter-totals");
    this.balance = need(root, "#winter-balance");
    this.next = need(root, "#winter-next");
    this.next.onclick = () => this.onNext();
    this.input = EMPTY;
  }

  /** Put the screen up on what the summer left behind. */
  show(input: WinterInput, onNext: () => void): void {
    this.input = input;
    this.onNext = onNext;
    this.root.hidden = false;
    this.draw();
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** What the player has chosen so far, for measuring from a driver. */
  get choices(): WinterInput {
    return this.input;
  }

  private change(patch: Partial<WinterInput>): void {
    this.input = { ...this.input, ...patch };
    this.draw();
  }

  /**
   * Sell `n` more of a kind, or fewer. The model holds what is kept back,
   * since that is what the town's material prices are paid out of; the screen
   * says sell, because selling is what winter is for and keeping is the
   * exception.
   */
  private sell(kind: ResourceKind, n: number): void {
    const have = this.input.store[kind] ?? 0;
    const sold = Math.max(0, Math.min(have, have - (this.input.keep[kind] ?? 0) + n));
    this.change({ keep: { ...this.input.keep, [kind]: have - sold } });
  }

  private buy(id: ShopItemId): void {
    const bought = this.input.bought.includes(id)
      ? this.input.bought.filter((b) => b !== id)
      : [...this.input.bought, id];
    this.change({ bought });
  }

  /**
   * Redraw the whole screen from the model. Every list is rebuilt: this runs
   * on a click, not on a frame, so there is nothing to spare by being clever
   * about which line changed.
   */
  private draw(): void {
    const m = winterModel(this.input);

    text(this.year, `Winter year ${m.year}`);

    // Two lists, because they are two different things: what is only ever
    // money, and what a bridge or a cart is made of. The second one has the
    // controls; the first one has nothing to decide.
    // Only what the summer actually brought back: a row for a kind with none
    // of it says nothing, and the list is shorter for leaving it out.
    const brought = m.lines.filter((line) => line.have > 0);
    this.soldList.replaceChildren(
      ...brought.filter((line) => !line.material).map((line) => this.storeRow(line)),
    );
    this.materialList.replaceChildren(
      ...brought.filter((line) => line.material).map((line) => this.storeRow(line)),
    );
    this.sales.replaceChildren(total("Total income", this.gold(m.sales)));

    // What winter costs, line by line: the food that came home, the food the
    // town had to make up, and the rent.
    const f = m.food;
    const u = m.upkeep;
    // A balance sheet: everything winter takes is written negative, and the
    // one line that is not a cost -- fruit the summer already paid for -- is
    // the zero that says so.
    // Both food lines are always drawn, a zero included: what the store
    // covered and what the town had to make up are the same question every
    // winter, and the answer moves between them.
    this.upkeep.replaceChildren(
      this.foodRow("Food stored", `${f.fromStore} of ${f.needed}`, 0),
      this.foodRow("Food bought", `${f.bought} ×`, -f.cost, f.buyPrice),
      row("Household", this.gold(-u.gold)),
      ...(u.away ? [row("Home late", this.gold(-u.away))] : []),
    );

    // Two kinds of spending, kept apart: what winter took whether or not the
    // player did anything, and what they chose to buy in town.
    this.totals.replaceChildren(
      row("Income", this.gold(m.income)),
      row("Upkeep", this.gold(-u.total)),
      ...(m.family.shopOpen ? [row("Shop", this.gold(-m.spent))] : []),
    );

    // What it all came to, on its own, because it is the one number the
    // player leaves the screen with. The line under it is always there, so
    // the panel does not grow a row the moment the balance goes negative.
    this.balance.replaceChildren(
      total("Balance, invested in family", this.gold(m.balance), m.balance < 0),
      m.balance < 0
        ? consequence("Next summer: tired", "is-short")
        : consequence("Next summer: normal"),
    );

    // No shop at all until the family is known in the town: the panel and
    // the rule it hangs from both go.
    this.town.hidden = !m.family.shopOpen;
    this.townRule.hidden = !m.family.shopOpen;
    this.shopList.replaceChildren(...m.shop.map((line) => this.shopRow(line)));

    // The family, as a move: where they stood when the summer ended, what
    // this winter puts in, and where that leaves them. The two bars are the
    // same bar a year apart, which is what makes the middle section read as
    // the thing that moved it.
    const fam = m.family;
    this.family.replaceChildren(
      meterRow(`Current level: ${fam.levelBefore}`, "", fam.progressBefore),
    );
    // What they had and what goes in, then -- under a rule -- what that
    // leaves them with and what the next level still wants.
    this.familyGold.replaceChildren(
      familyRow("Current wealth", this.gold(fam.before)),
      familyRow("Invested", this.gold(fam.given)),
    );
    // What the winter leaves the family with, against what the next level
    // wants: one line, because it is one question -- how far along are we.
    let of: HTMLElement | null = null;
    if (fam.nextAt !== null) {
      // The brackets are drawn by the stylesheet, so the coin inside them
      // keeps its own spacing instead of being glued to the words.
      of = span("w-of", "");
      of.append(this.gold(fam.nextAt));
    }
    this.familyFinal.replaceChildren(familyRow("Final wealth", this.gold(fam.total), of));
    // Only what this winter bought: a level announces itself the year it is
    // reached and then stops being news.
    this.familyTotal.replaceChildren(
      meterRow(`Family: level ${fam.level}`, "", fam.progress, true),
      ...fam.gained.map((g) => note(`level ${g.level}: ${g.unlocks}`, "is-gained")),
    );
  }

  /**
   * A line of food: what it was, how much of it, and what it came to. The
   * fruit that came home costs nothing and says so, because a zero there is
   * the point -- it is the winter the summer already paid for.
   */
  private foodRow(label: string, count: string, cost: number, price?: number): HTMLElement {
    const li = row(label, this.gold(cost));
    const detail = span("w-detail", count);
    if (price !== undefined) detail.append(this.gold(price));
    li.replaceChild(detail, li.children[1]!);
    li.replaceChild(this.what("fruit", label), li.firstChild!);
    return li;
  }

  /**
   * The name of a thing, with the sprite the map draws it as beside it. The
   * icon is what ties this screen to the field it came from: the same fruit,
   * at the same four-times scale, as the one that was picked.
   */
  private what(icon: IconName | null, label: string): HTMLElement {
    const el = span("w-what", "");
    const img = icon && this.icon(icon);
    if (img) el.append(img);
    el.append(span("w-what-text", label));
    return el;
  }

  /**
   * An amount of money: the number against the coin, or the word "gold" when
   * there are no icons to draw it with.
   */
  private gold(n: number): HTMLElement {
    const el = span("w-coin", "");
    const coin = this.icon("gold", 24);
    // The number in a cell of its own so that every column of money lines up
    // on its last digit, with the coin sitting at the same place beside it.
    el.append(span("w-coin-n", coin ? `${n}` : `${n} gold`));
    if (coin) el.append(coin);
    return el;
  }

  /** One icon, or null when there is no art loaded to draw it from. */
  private icon(name: IconName, size = 32): HTMLImageElement | null {
    if (!this.icons) return null;
    const img = document.createElement("img");
    img.className = "w-icon";
    img.src = this.icons.url(name);
    img.alt = "";
    // Height only: the well is twice as tall as it is wide, and letting the
    // width follow keeps every sprite at the scale it is drawn at.
    img.style.height = `${size}px`;
    return img;
  }

  /**
   * One kind out of the summer: what it is, how many there are, how many are
   * sold, and what that makes. A material's row carries the stepper; anything
   * that is only money has nothing to press.
   */
  private storeRow(line: StoreLine): HTMLElement {
    const li = document.createElement("li");
    li.className = "w-row";
    li.classList.toggle("is-empty", line.have === 0);
    li.dataset.kind = line.kind;

    // What a purchase is holding back goes in with the count, not beside the
    // stepper: the control column stays the same width on every row that way.
    const detail = span("w-detail", "");
    if (line.have > 0) {
      // "9x" against the coin: the price is money, so it is drawn as money
      // rather than said as a number the eye has to place.
      detail.append(span("", `${line.have}×`), this.gold(line.price));
    }
    if (line.committed > 0) {
      detail.append(
        span("w-note", `${line.committed} for the ${line.committedTo.join(", ")}`),
      );
    }
    li.append(this.what(line.kind, name(line.kind, line.have)), detail);

    if (line.material) {
      const sell = document.createElement("span");
      sell.className = "w-sell";
      sell.append(
        button("−", () => this.sell(line.kind, -1), line.sold <= 0),
        span("w-sell-count", `sell ${line.sold}`),
        button("+", () => this.sell(line.kind, +1), line.kept <= line.committed),
      );
      li.append(sell);
    } else {
      li.append(span("w-sell", ""));
    }

    li.append(line.have > 0 ? this.gold(line.gold) : span("w-gold", "—"));
    return li;
  }

  /**
   * What a line in the shop costs: the gold in words, and the material as a
   * count against its own sprite. With no icons loaded the words come back,
   * so the line still says what it wants.
   */
  private costLine(item: ShopItem): HTMLElement {
    const el = span("w-shop-cost", "");
    if (item.gold > 0) el.append(this.gold(item.gold));
    for (const [kind, n] of Object.entries(item.materials)) {
      if (!n) continue;
      const img = this.icon(kind as ResourceKind, 24);
      const part = span("w-cost-part", img ? `${n}` : `${n} ${name(kind as ResourceKind, n)}`);
      if (img) part.append(img);
      el.append(part);
    }
    if (!el.hasChildNodes()) el.append(span("", "free"));
    return el;
  }

  private shopRow(line: ShopLine): HTMLElement {
    const li = document.createElement("li");
    li.className = "w-shop-row";
    li.classList.toggle("is-bought", line.bought);
    li.classList.toggle("is-short", !line.affordable && !line.bought);
    li.dataset.item = line.item.id;

    const what = document.createElement("div");
    what.className = "w-shop-what";
    what.append(span("w-shop-name", line.item.name));
    const price = document.createElement("div");
    price.className = "w-shop-price";
    price.append(this.costLine(line.item));
    li.append(what, price);

    if (line.item.kind === "recipe") {
      li.append(span("w-shop-known", "known"));
    } else {
      // Buying is a choice on this screen, not a commitment: the same button
      // puts it back, and nothing is spent until the summer starts.
      const buy = button(
        line.bought ? "Undo" : "Buy",
        () => this.buy(line.item.id),
        !line.affordable && !line.bought,
      );
      // What is missing is on the button that will not press, rather than in
      // a line of its own: the shop is a list of prices, not of excuses.
      const missing = shortText(line);
      if (missing) buy.title = missing;
      li.append(buy);
    }
    return li;
  }
}

/** What is missing when it cannot be had, on its own line under the price. */
function shortText(line: ShopLine): string {
  if (line.bought) return "";
  const short: string[] = [];
  if (line.shortGold > 0) short.push(`${line.shortGold} gold`);
  for (const [kind, n] of Object.entries(line.shortMaterials)) {
    if (n) short.push(`${n} ${name(kind as ResourceKind, n)}`);
  }
  return short.length > 0 ? `${short.join(", ")} short` : "";
}

/** A label on the left and an amount on the right: the shape of a ledger row. */
function row(what: string, value: string | Node, cls = ""): HTMLElement {
  const li = document.createElement("li");
  li.className = `w-row ${cls}`.trim();
  const amount = span("w-gold", "");
  amount.append(value);
  li.append(span("w-what", what), span("w-detail", ""), span("w-sell", ""), amount);
  return li;
}

/**
 * A row in the family's ledger, which has a fifth cell: the level the wealth
 * is measured against. Empty on the rows that have no mark to reach, so all
 * three amounts stand in the same column whatever is beside them.
 */
function familyRow(what: string, value: Node, extra: HTMLElement | null = null): HTMLElement {
  const li = row(what, value);
  li.append(extra ?? span("w-of-empty", ""));
  return li;
}

/** The same, ruled off: what the column above it comes to. */
function total(what: string, value: Node, short = false): HTMLElement {
  const li = row(what, value, short ? "is-short" : "");
  li.classList.add("is-total");
  return li;
}

/**
 * A level, with how far the surplus has got through it drawn behind the row.
 * The bar is the one thing on this screen that is not a number, because a
 * level is the one thing that is not settled this winter.
 */
function meterRow(what: string, detail: string, through: number, strong = false): HTMLElement {
  const li = row(what, span("w-detail", detail), strong ? "is-total" : "");
  li.classList.add("is-level");
  li.style.setProperty("--through", `${Math.round(Math.max(0, Math.min(1, through)) * 100)}%`);
  return li;
}

/** A line of words under a row: what a level opened, and nothing else. */
function note(text: string, cls = ""): HTMLElement {
  const li = document.createElement("li");
  li.className = `w-level-note ${cls}`.trim();
  li.textContent = text;
  return li;
}

/**
 * What a number above it costs, in words and with no money on the line: the
 * price of a winter that could not be paid is next summer, not gold.
 */
function consequence(text: string, cls = ""): HTMLElement {
  const li = document.createElement("li");
  li.className = `w-consequence ${cls}`.trim();
  li.textContent = text;
  return li;
}

function span(cls: string, text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}

function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = onClick;
  return b;
}

/**
 * What a kind is called, in the singular and in the plural. Fruit and ore are
 * the same either way; the rest take an s.
 */
const NAMES: Record<ResourceKind, readonly [string, string]> = {
  fruit: ["fruit", "fruit"],
  feather: ["feather", "feathers"],
  stick: ["stick", "sticks"],
  vine: ["vine", "vines"],
  ore: ["ore", "ore"],
  log: ["log", "logs"],
  shell: ["shell", "shells"],
};

const name = (kind: ResourceKind, n: number): string => NAMES[kind][n === 1 ? 0 : 1]!;

function text(el: HTMLElement, s: string): void {
  if (el.textContent !== s) el.textContent = s;
}

/** Nothing at all, so the screen can be built before a summer has ended. */
const EMPTY: WinterInput = {
  year: 1,
  store: {},
  gold: 0,
  awayAtEnd: false,
  keep: {},
  stock: [],
  bought: [],
  familySurplus: 0,
};
