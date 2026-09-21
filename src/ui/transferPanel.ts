import * as C from "../config.ts";
import { isTypingTarget } from "../input/keyboard.ts";
import { RESOURCE_KINDS, RESOURCES } from "../sim/resources.ts";
import type { ResourceKind } from "../sim/types.ts";
import type { Transfer, World } from "../sim/world.ts";
import { need } from "./hud.ts";

/**
 * The transfer panel: the pack on one side, camp on the other, and a cursor
 * over the kinds. A tap at camp still banks the whole load; this is what opens
 * when the key is held instead.
 *
 * It writes no simulation state of its own: every move goes through
 * {@link World.putAway} and {@link World.takeOut}, which keeps the one-way
 * rule. The clock runs while it is open, as it does for the build menu --
 * sorting the pack out is part of what a summer is spent on.
 */
export class TransferPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly free: HTMLElement;
  /**
   * The stack under the player: the prompt, the End summer button and the
   * toasts. It is put away while the panel is up, because the panel is drawn
   * where it hangs and because the prompt would be offering the very key that
   * opened it.
   */
  private readonly anchor: HTMLElement;

  private world: World | null = null;
  private target: Transfer | null = null;
  private cursor: ResourceKind | null = null;
  /**
   * Why the last move did nothing, shown until the next one. The only refusal
   * there is: a bulky log with one slot left.
   */
  private refused = "";

  constructor(
    root: ParentNode = document,
    private readonly keyTarget: EventTarget = window,
  ) {
    this.root = need(root, "#transfer");
    this.list = need(root, "#transfer-list");
    this.free = need(root, "#transfer-free");
    this.anchor = need(root, "#player-anchor");
    this.keyTarget.addEventListener("keydown", this.onKeyDown);
  }

  get isOpen(): boolean {
    return this.target !== null;
  }

  /** Open it against wherever the player is standing. Does nothing nowhere. */
  open(world: World): void {
    const target = world.transferTarget();
    if (!target) return;
    this.world = world;
    this.target = target;
    this.refused = "";
    this.cursor = null;
    this.root.hidden = false;
    // Out of sight rather than out of the layout, so the HUD can still measure
    // the stack while it is away.
    this.anchor.classList.add("is-covered");
    this.draw();
  }

  close(): void {
    this.target = null;
    this.world = null;
    this.root.hidden = true;
    this.anchor.classList.remove("is-covered");
  }

  /**
   * Redraw for what the pack and the store hold now.
   *
   * Called every frame while it is open, so a summer that ends under it, or a
   * regenerated world, takes it away rather than leaving a panel onto a store
   * that no longer exists.
   */
  update(world: World): void {
    if (!this.isOpen) return;
    if (world !== this.world || world.summerOver) {
      this.close();
      return;
    }
    this.draw();
  }

  /** Every kind either side holds, in table order. An empty panel is possible. */
  private lines(): ResourceKind[] {
    const target = this.target;
    if (!target || !this.world) return [];
    const pack = this.world.inventory;
    return RESOURCE_KINDS.filter((kind) => pack.count(kind) > 0 || target.store.count(kind) > 0);
  }

  /** The kind the cursor is on, pulled back onto the list when it falls off. */
  private at(): ResourceKind | null {
    const lines = this.lines();
    if (lines.length === 0) return null;
    if (this.cursor && lines.includes(this.cursor)) return this.cursor;
    this.cursor = lines[0]!;
    return this.cursor;
  }

  private draw(): void {
    const world = this.world;
    const target = this.target;
    if (!world || !target) return;

    const lines = this.lines();
    const cursor = this.at();
    const wanted = lines
      .map((kind) => `${kind}:${world.inventory.count(kind)}:${target.store.count(kind)}`)
      .join("/");
    const drawn = `${wanted}|${cursor}`;
    if (this.list.dataset.drawn !== drawn) {
      this.list.dataset.drawn = drawn;
      this.list.replaceChildren();
      for (const kind of lines) {
        this.list.appendChild(this.row(kind, kind === cursor));
      }
      if (lines.length === 0) {
        const li = document.createElement("li");
        // Not a row of the three-column grid the kinds are laid out in: a
        // sentence dropped into that grid becomes one word per line.
        li.classList.add("is-empty");
        li.textContent = "Camp is empty, and so is the pack";
        this.list.appendChild(li);
      }
    }

    const free = world.inventory.free;
    this.free.textContent = this.refused || `${free} of ${world.inventory.capacity} slots free`;
    this.free.classList.toggle("is-refused", this.refused !== "");
  }

  private row(kind: ResourceKind, isCursor: boolean): HTMLElement {
    const li = document.createElement("li");
    li.classList.toggle("is-cursor", isCursor);
    const pack = document.createElement("span");
    pack.className = "transfer-pack";
    pack.textContent = String(this.world!.inventory.count(kind));
    const name = document.createElement("span");
    name.textContent = kind;
    const store = document.createElement("span");
    store.textContent = String(this.target!.store.count(kind));
    li.append(pack, name, store);
    li.onclick = () => {
      this.cursor = kind;
      this.draw();
    };
    return li;
  }

  /** Move the cursor by `step` through the kinds either side holds. */
  private move(step: number): void {
    const lines = this.lines();
    const here = this.at();
    if (!here) return;
    const at = lines.indexOf(here);
    this.cursor = lines[(at + step + lines.length) % lines.length]!;
    this.refused = "";
  }

  /** Put the cursor's kind away, or take it back out. `all` moves the lot. */
  private transfer(out: boolean, all: boolean): void {
    const world = this.world;
    const target = this.target;
    const kind = this.at();
    if (!world || !target || !kind) return;
    const have = out ? target.store.count(kind) : world.inventory.count(kind);
    const n = all ? have : Math.min(1, have);
    if (n <= 0) {
      this.refused = "";
      return;
    }
    const moved = out ? world.takeOut(target, kind, n) : world.putAway(target, kind, n);
    // The one refusal: a bulky kind and not enough slots for even one.
    this.refused =
      moved === 0 ? `No room in the pack for a ${kind} (${RESOURCES[kind].slots} slots)` : "";
  }

  /**
   * The panel's keys, which the game does not also get: the player is standing
   * at a box with the lid open, not walking. Everything else falls through.
   *
   * Auto-repeats are ignored outright. The panel is opened by holding an
   * interact key and one of those is also what closes it, so every repeat of
   * the hold that opened the panel would arrive here and shut it again; only a
   * fresh press means anything. It costs nothing elsewhere: a cursor that
   * scrolled on a held key would be too fast to aim with anyway.
   */
  private readonly onKeyDown = (event: Event): void => {
    if (!this.isOpen) return;
    const e = event as KeyboardEvent;
    if (e.repeat || isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();

    if ((C.TRANSFER_CLOSE_KEYS as readonly string[]).includes(key)) {
      e.preventDefault();
      this.close();
      return;
    }
    const all = e.shiftKey;
    if (key === "w" || key === "arrowup") this.move(-1);
    else if (key === "s" || key === "arrowdown") this.move(1);
    else if (key === "d" || key === "arrowright") this.transfer(false, all);
    else if (key === "a" || key === "arrowleft") this.transfer(true, all);
    else return;
    e.preventDefault();
    this.draw();
  };

  dispose(): void {
    this.keyTarget.removeEventListener("keydown", this.onKeyDown);
  }
}
