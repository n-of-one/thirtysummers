import "./ui/hud.css";
import "./ui/winter.css";
import { loadIcons } from "./render/packs/icons.ts";
import { SHOP_BY_YEAR } from "./sim/shop.ts";
import { initialKeep, type WinterInput } from "./sim/winter.ts";
import { WinterScreen } from "./ui/winter.ts";
import { FixedView, parseViewParam } from "./ui/view.ts";

/**
 * The winter screen on its own, at `/winter.html`.
 *
 * Winter is the one screen that can be looked at without playing for it, so
 * it is iterated on here rather than at the end of a summer: the numbers below
 * are a fixture, not a world. When the screen is settled, the markup in
 * `winter.html` moves into `index.html` and `World` supplies the same input.
 *
 * `?year=<n>` picks which winter's stock is shown. Everything else is the
 * fixture.
 */

const params = new URLSearchParams(location.search);
const year = Number(params.get("year")) || 1;

/**
 * The first winter, after a summer that went the way most first summers will:
 * the near ring swept for what is easy to reach, and not enough fruit in it.
 *
 * Every number here can be overridden from the URL, because what the screen
 * has to survive is not one haul but all of them: an empty one, a huge one,
 * a family already at its last level. The parameters are `wealth`, `fruit`,
 * `sticks`, `vines`, `logs`, `feathers`, `ore` and `shells`, plus `away=1`
 * for a summer that ended out of reach of camp.
 */
const num = (name: string, fallback: number): number => {
  const raw = params.get(name);
  const n = Number(raw);
  return raw !== null && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
};

const store = {
  fruit: num("fruit", 6),
  feather: num("feathers", 9),
  stick: num("sticks", 8),
  vine: num("vines", 5),
  ore: num("ore", 3),
  log: num("logs", 0),
  shell: num("shells", 0),
};

const firstWinter: WinterInput = {
  year,
  store,
  gold: 0,
  awayAtEnd: params.get("away") === "1",
  // Nothing is sold until it is said: the material starts held back.
  keep: initialKeep(store),
  // Everything the town will ever sell is in stock while the screen is being
  // iterated on, so every kind of line can be seen at once.
  stock: SHOP_BY_YEAR[year] ?? SHOP_BY_YEAR[1]!,
  bought: [],
  familySurplus: num("wealth", 0),
};

new FixedView(parseViewParam(params.get("view")), document.querySelector<HTMLElement>("#view")!);

// The map's own sprites, cut out of the sheets for the HUD. `?icons=none`
// drops them, which is the screen in words alone; a run without the licensed
// art keeps them and draws each kind as a flat chip instead.
const icons = params.get("icons") === "none" ? null : await loadIcons();

const screen = new WinterScreen(icons);
screen.show(firstWinter, () => {
  // Nothing to go to yet: the prototype is the screen, not the game.
  console.log("next summer", screen.choices);
});

/** Handle for measuring from a driver, as `window.__game` is in the game. */
(window as unknown as { __winter?: unknown }).__winter = { screen };
