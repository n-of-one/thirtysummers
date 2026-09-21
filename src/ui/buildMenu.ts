import * as C from "../config.ts";
import { isTypingTarget } from "../input/keyboard.ts";
import type { Build } from "../sim/types.ts";
import type { BuildOption } from "../sim/world.ts";
import { costText, need } from "./hud.ts";

/**
 * The build menu: where a build is chosen, and the only place the recipes are
 * all written down.
 *
 * Building is never guessed from what is in the pack. Three sticks used to
 * mean one build and could mean nothing else, and there was no way to say "a
 * well, once I have the logs" -- so what to build is said here, once, and the
 * tile ahead then does that and only that until it is changed.
 *
 * What is not affordable is still listed and can still be chosen: the menu is
 * read to find out what to go and gather.
 *
 * The clock runs while it is open, so this pauses nothing. It writes no
 * simulation state itself either -- it reports the choice and the world owns
 * it, which keeps the one-way rule.
 */
export class BuildMenu {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private open = false;
  private options: BuildOption[] = [];
  private chosen: Build | null = null;

  /** Called with the choice, or null when what was being built is dropped. */
  onChoose: (build: Build | null) => void = () => {};

  constructor(
    root: ParentNode = document,
    private readonly keyTarget: EventTarget = window,
  ) {
    this.root = need(root, "#build-menu");
    this.list = need(root, "#build-list");
    this.keyTarget.addEventListener("keydown", this.onKeyDown);
  }

  /**
   * Draw the menu for what the player knows and carries now.
   *
   * Called every frame while it is up, so that picking a stick up with the
   * menu open turns a line from short to affordable as it happens.
   */
  update(options: BuildOption[], chosen: Build | null): void {
    this.options = options;
    this.chosen = chosen;
    if (!this.open) return;
    const key = (i: number) => String(i + 1);
    const wanted = options
      .map((o, i) => `${key(i)}|${o.build}|${o.affordable}|${o.build === chosen}`)
      .join("/");
    if (this.list.dataset.drawn === wanted) return;
    this.list.dataset.drawn = wanted;

    this.list.replaceChildren();
    options.forEach((option, i) => {
      const li = document.createElement("li");
      li.classList.toggle("is-short", !option.affordable);
      li.classList.toggle("is-chosen", option.build === chosen);
      const k = document.createElement("span");
      k.className = "build-key";
      k.textContent = key(i);
      const what = document.createElement("span");
      what.className = "build-what";
      what.textContent = NAME[option.build];
      const cost = document.createElement("span");
      cost.className = "build-cost";
      cost.textContent = costText(option.cost);
      li.append(k, what, cost);
      li.onclick = () => this.choose(option.build);
      this.list.appendChild(li);
    });
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.hidden = !open;
    if (open) {
      // The list is redrawn from scratch on the next update, so an open with
      // a stale list cannot flash the pack as it was when it last closed.
      this.list.dataset.drawn = "";
      this.update(this.options, this.chosen);
    }
  }

  get isOpen(): boolean {
    return this.open;
  }

  private choose(build: Build): void {
    // Choosing what is already being built puts it down again, so the menu key
    // and the same number are a way out as well as a way in.
    this.onChoose(this.chosen === build ? null : build);
    this.setOpen(false);
  }

  /**
   * B opens and closes, a number chooses, Escape puts down what is being
   * built. Everything else falls through to the game, so the player can keep
   * walking with the menu up.
   */
  private readonly onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();

    if (key === C.BUILD_MENU_KEY) {
      e.preventDefault();
      this.setOpen(!this.open);
      return;
    }
    if (key === C.BUILD_CANCEL_KEY) {
      if (this.open) this.setOpen(false);
      else if (this.chosen) this.onChoose(null);
      return;
    }
    if (!this.open) return;
    const index = Number(key) - 1;
    const option = Number.isInteger(index) ? this.options[index] : undefined;
    if (option) {
      e.preventDefault();
      this.choose(option.build);
    }
  };

  dispose(): void {
    this.keyTarget.removeEventListener("keydown", this.onKeyDown);
  }
}

/** What each build is called in the menu. */
const NAME: Record<Build, string> = {
  bridge: "Bridge tile",
  well: "Well",
};
