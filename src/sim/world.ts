import * as C from "../config.ts";
import type { InputState } from "../input/keyboard.ts";
import {
  nearestNodeWithin,
  nearestSpringWithin,
  tileAhead,
  waterWithin,
  withinReach,
  type TileRef,
} from "./interaction.ts";
import { Inventory, type Amounts } from "./inventory.ts";
import { FIRST_LIST, lineKey, offeredLines, type ListLine } from "./list.ts";
import { fingerprint, SaveError, type SaveState } from "./save.ts";
import type { SummerSummary } from "./summary.ts";
import { TERRAIN_ORDER } from "./terrain.ts";
import { RESOURCE_KINDS, RESOURCES } from "./resources.ts";
import { mulberry32, shuffle } from "./rng.ts";
import { shopStock } from "./shop.ts";
import { initialKeep, levelAt, winterModel, type WinterInput } from "./winter.ts";
import { nearRing } from "./worldgen/reachability.ts";
import {
  canStand,
  createPlayer,
  facingFor,
  headingFor,
  moveWithCollision,
  type Player,
} from "./player.ts";
import { Stats } from "./stats.ts";
import { BUILDS } from "./types.ts";
import type { TileMap } from "./tilemap.ts";
import type { TerrainDef } from "./terrain.ts";
import type {
  BlockedReason,
  Build,
  Dropped,
  Recipe,
  ResourceKind,
  ResourceNode,
  Spring,
  Tool,
  Vec2,
  WorldEvent,
  WorldEventPayload,
} from "./types.ts";
import { layoutSummerWorld, type GeneratedWorld } from "./worldgen.ts";

/**
 * One side of an open transfer: camp, and what it keeps. The other side is
 * always the pack.
 */
export interface Transfer {
  /** The tile it stands on, for the log. */
  readonly x: number;
  readonly y: number;
  readonly store: Inventory;
}

/**
 * What the interact key would do where the player is standing right now.
 *
 * One query answers two questions -- what the HUD should prompt, and what a
 * press actually does -- so the two can never disagree. `blocked` says why the
 * action is the right one here but cannot be carried out: a full backpack,
 * nothing to bank at camp, nothing to build with, no axe, or water too near
 * for a well. Null means it can.
 */
export type Action =
  | { type: "deposit"; stored: number; blocked: BlockedReason | null }
  | { type: "harvest"; node: ResourceNode; blocked: BlockedReason | null }
  | { type: "pickUp"; item: Dropped; blocked: BlockedReason | null }
  | { type: "drink"; x: number; y: number; blocked: null }
  | { type: "cut"; x: number; y: number; blocked: null }
  | { type: "fell"; x: number; y: number; blocked: BlockedReason | null }
  | { type: "build"; x: number; y: number; blocked: BlockedReason | null }
  | { type: "dig"; x: number; y: number; blocked: BlockedReason | null };

/** What each thing on the build menu costs. */
export const BUILD_COST: Record<Build, Amounts> = {
  bridge: { stick: C.BRIDGE_STICKS, vine: C.BRIDGE_VINES },
  well: { log: C.WELL_LOGS, stick: C.WELL_STICKS },
};

export const BRIDGE_COST = BUILD_COST.bridge;
export const WELL_COST = BUILD_COST.well;

/** The action each build carries out, which is also its hold. */
const BUILD_ACTION: Record<Build, "build" | "dig"> = {
  bridge: "build",
  well: "dig",
};

/** One line of the build menu. */
export interface BuildOption {
  build: Build;
  cost: Amounts;
  /** Everything it costs is in the pack. */
  affordable: boolean;
}

/** Seconds of holding the interact key each action takes; 0 for a tap. */
const HOLD_TIME: Record<Action["type"], number> = {
  // Banking is a tap on the release and a hold to the panel, so its time is
  // how long the panel takes to open, not how long the tap does.
  deposit: C.TRANSFER_HOLD_TIME,
  harvest: C.HARVEST_TIME,
  pickUp: 0,
  drink: C.DRINK_TIME,
  cut: C.CUT_TIME,
  fell: C.FELL_TIME,
  build: C.BUILD_TIME,
  dig: C.WELL_TIME,
};

/**
 * What a hold in progress belongs to, as a string so that two kinds of hold
 * aimed at one tile could never finish on each other's progress.
 *
 * Camp has no tile of its own here: there is one of it, and the player is
 * either at it or not.
 */
function holdKeyFor(action: Action): string {
  switch (action.type) {
    case "harvest":
      return `harvest:${action.node.id}`;
    case "pickUp":
      return `pickUp:${action.item.x},${action.item.y}`;
    case "deposit":
      return "deposit:camp";
    default:
      return `${action.type}:${action.x},${action.y}`;
  }
}

/**
 * The whole simulation. Owns the map and everything on it, and advances by
 * fixed steps. Nothing here touches Pixi or the DOM, so a summer can be played out
 * headlessly in a test.
 */
export class World {
  readonly seed: number;
  readonly map: TileMap;
  readonly camp: Vec2;
  readonly nodes: ResourceNode[];
  /**
   * Tiles with a spring on them, in integer tile coordinates. A well dug in
   * the summer is appended, flagged, and drinks the same.
   */
  readonly springs: Spring[];
  /**
   * Items lying on the ground, one to a tile. Cleared by the winter: nothing
   * left in a field survives a year of rain and animals.
   */
  readonly dropped: Dropped[] = [];
  readonly player: Player;
  readonly stats = new Stats();
  /** The backpack, and the gold banked at camp. */
  readonly inventory = new Inventory();
  /**
   * What camp keeps, with no capacity. Everything banked ends up here except
   * what sells on arrival, and the fruit in it is winter's food.
   *
   * Called "camp" in everything the player reads, and `store` here only
   * because {@link camp} is already the tile it stands on. `store` is the verb
   * in the HUD -- you store something at camp -- and winter has a shop, so it
   * is not a noun worth showing.
   */
  readonly store = new Inventory(Infinity);
  /**
   * What the family has been given, over every winter so far. Its level is
   * what opens the shop.
   */
  family = 0;
  /**
   * The last winter could not be paid, so this summer every hold takes longer
   * and rough ground is slower. Set by each winter, for the summer after it.
   */
  tired = false;
  /** What the player means to bring home this summer, ticked in winter. */
  list: ListLine[] = [...FIRST_LIST];
  /** The player has moved this summer, which puts the start-of-summer notice away. */
  movedThisSummer = false;
  /**
   * The near ring, 1 per tile inside it: what camp reaches without crossing
   * water. Measured once, on the map as it came, because inside it everything
   * is back every year and a bridge laid later does not move the ring.
   */
  private readonly ring: Uint8Array;
  /** Nodes picked this summer, by id: a share of these comes back outside the ring. */
  private readonly pickedThisSummer = new Set<number>();
  /** Tiles felled, by tile index, and the summer each was felled in. */
  private readonly felledIn = new Map<number, number>();
  /** Thicket tiles cut, by tile index, which the thicket can creep back onto. */
  private readonly cutTiles = new Set<number>();
  /**
   * The kind the drop key throws away, or null with an empty pack.
   *
   * Read through {@link dropKind}, which is what keeps it honest: the moment
   * the selected kind runs out the selection falls to whatever now takes the
   * most slots, so it is never undefined and never hidden.
   */
  private selected: ResourceKind | null = null;
  /** What the player owns. The knife from the start, the rest bought in winter. */
  readonly tools = new Set<Tool>(["knife"]);
  /** What the player knows how to build beyond a bridge. Nothing, until the well in M12. */
  readonly recipes = new Set<Recipe>();
  /**
   * What the build menu is set to, or null for not building.
   *
   * Building is chosen rather than guessed from what is in the pack: carrying
   * three sticks used to mean one build and nothing else, with no way to say
   * "a well, once I have the logs". It lasts until it is changed or dropped,
   * so a crossing is one choice and a hold per tile, and it does not survive
   * the end of a summer.
   */
  buildMode: Build | null = null;

  /** Seconds of the summer already spent. Stops at SUMMER_LENGTH_SEC. */
  elapsedSec = 0;

  /** Which summer this is, counting from 1. A year is one summer and the winter after it. */
  year = 1;

  /** Append-only log of what happened. Readers keep their own cursor. */
  readonly events: WorldEvent[] = [];

  /** How far through the current hold -- a harvest, a cut, a bridge -- 0 to 1. */
  harvestProgress = 0;
  /**
   * What that progress belongs to: a node id or a tile, as a string so the two
   * cannot be confused for one another. Empty when nothing is being held.
   */
  private holdKey = "";

  /**
   * Last tick's input, for edge detection. Dropping off is one-shot: it fires
   * on the press, not for every tick the key is down.
   */
  private held = { interact: false, drop: false, dropSwitch: false };
  /**
   * The banking at camp waiting on the key coming up.
   *
   * It acts on the release rather than on the press, because the same key
   * held opens the transfer panel instead. A quick arrival is still one press
   * and reads as one; letting go is what tells the two apart.
   */
  private pendingTap: Action | null = null;
  /**
   * Set when a press has already done its one thing, and cleared on release.
   *
   * Without it, holding the key at camp banks the load and then, now that the
   * pack has no ore, starts picking whatever node happens to stand beside the
   * camp. One press, one action.
   */
  private interactSpent = false;

  /** The summer is over, by the clock or from camp. Nothing steps after it. */
  ended = false;
  /**
   * Whether the last summer ended out of reach of camp. Winter charges for the
   * fetching, so this outlives the summer it describes.
   */
  awayAtEnd = false;
  /**
   * While set, neither hydration nor the clock moves on its own. Only the debug
   * overlay sets it, and it is here rather than in the overlay so that "the
   * numbers stopped moving" is one flag the simulation owns, not a rate the
   * renderer reaches in and rewrites.
   *
   * The player still walks, works and drinks, so the freeze holds a state still
   * to poke at rather than switching the summer off.
   */
  frozen = false;

  constructor(generated: GeneratedWorld) {
    this.seed = generated.seed;
    this.map = generated.map;
    this.camp = generated.camp;
    this.nodes = generated.nodes;
    this.springs = generated.springs;
    this.player = createPlayer(generated.camp);
    this.ring = nearRing(this.map, this.camp);
    this.original = this.map.clone();
    this.fingerprint = fingerprint(this.map, this.nodes, this.camp);
  }

  /** The map as it came, which a save is written against. */
  private readonly original: TileMap;
  /** A hash of that map, so a save is only ever read onto the map it was made on. */
  readonly fingerprint: string;

  /**
   * The game as it stands at the end of a summer, for saving. Only what the
   * summers changed: the map itself comes from the same file or seed.
   */
  snapshot(summary: SummerSummary): SaveState {
    const amounts = (inv: Inventory): Amounts =>
      Object.fromEntries(RESOURCE_KINDS.filter((k) => inv.count(k) > 0).map((k) => [k, inv.count(k)]));
    const now = this.map.layerData(0);
    const was = this.original.layerData(0);
    const terrain: [number, number][] = [];
    for (let i = 0; i < now.length; i++) if (now[i] !== was[i]) terrain.push([i, now[i]!]);
    return {
      v: 2,
      fingerprint: this.fingerprint,
      year: this.year,
      elapsedSec: this.elapsedSec,
      awayAtEnd: this.awayAtEnd,
      family: this.family,
      tired: this.tired,
      list: this.list.map((line) => ({ ...line })),
      tools: [...this.tools],
      recipes: [...this.recipes],
      pack: amounts(this.inventory),
      camp: amounts(this.store),
      terrain,
      harvested: this.nodes.filter((n) => n.harvested).map((n) => n.id),
      picked: [...this.pickedThisSummer],
      felled: [...this.felledIn],
      cut: [...this.cutTiles],
      wells: this.springs.filter((s) => s.well).map((s) => [s.x, s.y]),
      dropped: this.dropped.map((d) => [d.kind, d.x, d.y]),
      summary,
    };
  }

  /**
   * Put a saved game back onto this world, fresh from the same file or seed,
   * and leave it at the end of the summer it was saved at. Refuses a save made
   * on another map.
   */
  restore(state: SaveState): void {
    if (state.fingerprint !== this.fingerprint) {
      throw new SaveError("the save was made on another map; open it with the same ?map= or ?seed=");
    }
    const w = this.map.width;
    for (const [i, id] of state.terrain) this.map.set(i % w, Math.floor(i / w), TERRAIN_ORDER[id]!);
    const harvested = new Set(state.harvested);
    for (const node of this.nodes) node.harvested = harvested.has(node.id);
    for (const [x, y] of state.wells) this.springs.push({ x, y, well: true });
    this.dropped.push(...state.dropped.map(([kind, x, y]) => ({ kind, x, y })));
    this.inventory.clear();
    this.store.clear();
    for (const kind of RESOURCE_KINDS) {
      this.inventory.add(kind, state.pack[kind] ?? 0);
      this.store.add(kind, state.camp[kind] ?? 0);
    }
    this.tools.clear();
    for (const t of state.tools) this.tools.add(t);
    this.recipes.clear();
    for (const r of state.recipes) this.recipes.add(r);
    this.pickedThisSummer.clear();
    for (const id of state.picked) this.pickedThisSummer.add(id);
    this.felledIn.clear();
    for (const [i, year] of state.felled) this.felledIn.set(i, year);
    this.cutTiles.clear();
    for (const i of state.cut) this.cutTiles.add(i);
    this.year = state.year;
    this.elapsedSec = state.elapsedSec;
    this.awayAtEnd = state.awayAtEnd;
    this.family = state.family;
    this.tired = state.tired;
    this.list = state.list.map((line) => ({ ...line }));
    this.ended = true;
    this.movedThisSummer = true;
    this.stopHarvesting();
    this.pendingTap = null;
  }

  /** Is the tile under (x, y) inside the near ring? */
  inNearRing(x: number, y: number): boolean {
    return this.ring[Math.floor(y) * this.map.width + Math.floor(x)] === 1;
  }

  /**
   * A world from a seed: the five-summer layout, which is what the game is
   * about now. The plain noise generator it is built on is still there, and
   * is what `npm run map -- --noise` prints.
   */
  static fromSeed(seed: number): World {
    return new World(layoutSummerWorld(seed));
  }

  /** Seconds left before the summer ends. Never negative. */
  get remainingSec(): number {
    return C.SUMMER_LENGTH_SEC - this.elapsedSec;
  }

  get summerOver(): boolean {
    return this.ended;
  }

  /** Close enough to camp to bank, or to end the summer early. */
  get atCamp(): boolean {
    return withinReach(this.player.x, this.player.y, this.camp);
  }

  /**
   * End the summer where the player stands, by the clock or from camp.
   *
   * What is carried is banked as if brought home, so a last trip out is never
   * wasted. What was dropped on the ground is not: it stays where it was
   * thrown, and the winter takes it. Ending out of reach of camp is
   * remembered, because winter will charge for the fetching. Does nothing the
   * second time.
   */
  endSummer(): void {
    if (this.ended) return;
    this.ended = true;
    this.awayAtEnd = !this.atCamp;
    this.stopHarvesting();
    // A transfer waiting on a release is dropped with the summer, so letting
    // go next summer cannot bank a load that was already banked by the end.
    this.pendingTap = null;
    this.record({ type: "summerEnded", away: this.awayAtEnd, stored: this.bank() });
  }

  /**
   * Bank the whole pack at camp, and say how many items that was.
   *
   * Camp takes every kind and sells none: feathers and shells wait at camp
   * with the fruit and the sticks, and everything is sold in winter. It used
   * to sell them on arrival, which hid the haul from the winter screen and
   * left the summer with a gold count that meant nothing yet.
   */
  private bank(): number {
    return this.inventory.moveAllTo(this.store);
  }

  /** Camp, when the player is standing at it, or null anywhere else. */
  transferTarget(): Transfer | null {
    return this.atCamp ? { x: this.camp.x, y: this.camp.y, store: this.store } : null;
  }

  /** Open the transfer panel at camp, and say so in the log. */
  private openTransfer(): void {
    const target = this.transferTarget();
    if (!target) return;
    this.record({ type: "transferOpened", x: target.x, y: target.y });
  }

  /**
   * Move up to `n` of `kind` out of the pack and into `target`. Returns how
   * many moved, which is all of it or all there was.
   */
  putAway(target: Transfer, kind: ResourceKind, n: number): number {
    const moved = Math.min(n, this.inventory.count(kind));
    if (moved <= 0) return 0;
    this.inventory.remove(kind, moved);
    target.store.add(kind, moved);
    this.record({ type: "putAway", kind, n: moved });
    return moved;
  }

  /**
   * Move up to `n` of `kind` out of `target` and into the pack. Returns how
   * many moved, which is zero when a bulky log will not fit -- the panel says
   * so rather than taking half a log.
   */
  takeOut(target: Transfer, kind: ResourceKind, n: number): number {
    const want = Math.min(n, target.store.count(kind));
    const moved = this.inventory.add(kind, want);
    if (moved <= 0) return 0;
    target.store.remove(kind, moved);
    this.record({ type: "tookOut", kind, n: moved });
    return moved;
  }

  /**
   * The kind the drop key would throw away, or null with an empty pack.
   *
   * Reading it settles it: when the selected kind runs out the selection falls
   * to whichever kind now takes the most slots, so the readout always names
   * something that is actually in the pack.
   */
  get dropKind(): ResourceKind | null {
    if (this.selected && this.inventory.count(this.selected) > 0) return this.selected;
    let best: ResourceKind | null = null;
    let bestSlots = 0;
    for (const kind of RESOURCE_KINDS) {
      const slots = this.inventory.count(kind) * RESOURCES[kind].slots;
      if (slots > bestSlots) {
        best = kind;
        bestSlots = slots;
      }
    }
    this.selected = best;
    return best;
  }

  /** Move the selection on to the next kind the pack holds, wrapping round. */
  cycleDropKind(): void {
    const kinds = RESOURCE_KINDS.filter((kind) => this.inventory.count(kind) > 0);
    if (kinds.length === 0) return;
    const at = kinds.indexOf(this.dropKind!);
    this.selected = kinds[(at + 1) % kinds.length]!;
  }

  /**
   * Throw every item of the selected kind on the ground around the player.
   *
   * One item to a tile, spilling outward by ring, which keeps the scatter
   * honest about how much was carried. Refusing a drop would be unthematic in
   * a game about carrying things, so this only ever fails for want of ground:
   * with none at all within {@link C.DROP_SPILL_RINGS}, it says so and nothing
   * leaves the pack.
   */
  dropSelected(): void {
    const kind = this.dropKind;
    if (!kind) return;
    const wanted = this.inventory.count(kind);
    const tiles = this.spillTiles(wanted);
    if (tiles.length === 0) {
      this.blocked("noRoomToDrop");
      return;
    }
    for (const tile of tiles) {
      this.inventory.remove(kind, 1);
      this.dropped.push({ kind, x: tile.x, y: tile.y });
    }
    this.record({ type: "dropped", kind, n: tiles.length });
  }

  /**
   * Up to `n` tiles a dropped item may land on, nearest first: the player's
   * own tile, then the rings around it out to `DROP_SPILL_RINGS`.
   *
   * Reading order within a ring, so a drop of the same load from the same spot
   * always scatters the same way.
   */
  private spillTiles(n: number): TileRef[] {
    const found: TileRef[] = [];
    const cx = Math.floor(this.player.x);
    const cy = Math.floor(this.player.y);
    for (let r = 0; r <= C.DROP_SPILL_RINGS && found.length < n; r++) {
      for (let y = cy - r; y <= cy + r && found.length < n; y++) {
        for (let x = cx - r; x <= cx + r && found.length < n; x++) {
          // Only the ring itself: the inside of it was walked on the last pass.
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
          if (this.freeToDrop(x, y)) found.push({ x, y });
        }
      }
    }
    return found;
  }

  /**
   * What the winter screen opens on: camp as the summer left it, the family,
   * and what the town will sell a family of its level. Nothing is bought
   * until the player says so.
   */
  winterInput(): WinterInput {
    const store: Amounts = {};
    for (const kind of RESOURCE_KINDS) store[kind] = this.store.count(kind);
    return {
      year: this.year,
      store,
      awayAtEnd: this.awayAtEnd,
      keep: initialKeep(store),
      stock: shopStock(levelAt(this.family), this.tools),
      bought: [],
      familySurplus: this.family,
    };
  }

  /**
   * Settle the winter the player chose on the winter screen, before the next
   * summer starts.
   *
   * The arithmetic is `winterModel`'s, the same the screen was drawn from, so
   * what is applied is what was shown: what is kept stays at camp, what was
   * sold, eaten and paid in material leaves it, the gold left over goes to the
   * family, and what was bought is owned. A winter that could not be paid
   * makes the next summer a tired one. `ticked` names the lines of the list,
   * by {@link lineKey}, that the next summer carries.
   */
  endWinter(input: WinterInput, ticked: ReadonlySet<string>): void {
    const model = winterModel(input);
    for (const line of model.lines) {
      this.store.clear(line.kind);
      this.store.add(line.kind, line.kept - line.committed);
    }
    this.family += model.left;
    for (const id of input.bought) this.tools.add(id);
    this.tired = !model.upkeep.met;
    this.list = offeredLines(model).filter((line) => ticked.has(lineKey(line)));
    this.record({ type: "winterEnded", given: model.left, tired: this.tired });
  }

  /** Open ground with nothing already on it, and nothing already dropped. */
  private freeToDrop(x: number, y: number): boolean {
    if (!this.map.isPassable(x, y, this.player.z)) return false;
    if (this.dropped.some((d) => d.x === x && d.y === y)) return false;
    return this.freeToBuild({ x, y });
  }

  /**
   * Start the next summer on the same map.
   *
   * What you changed stays changed, so the wells, the gold and the backpack
   * are left as they are. The winter has had its way with the map first: see
   * {@link winterOnMap}. Hydration refills, the player wakes at camp, and the
   * clock restarts.
   *
   * The event log is kept too, so readers walking it with a cursor carry on
   * from where they were rather than replaying the summer that just ended.
   */
  nextSummer(): void {
    // Nothing left on the ground survives a winter; camp keeps the lot, and is
    // the only place a fruit becomes winter food.
    this.dropped.length = 0;
    this.winterOnMap();
    this.year++;
    this.elapsedSec = 0;
    this.ended = false;
    this.movedThisSummer = false;
    this.stats.startSummer();
    this.player.x = this.camp.x;
    this.player.y = this.camp.y;
    this.player.moving = false;
    // Distance is a per-summer figure in the summary. It also drives the walk
    // animation, but only through a modulo, and the player is standing still at
    // camp when this happens, so there is no frame to jump.
    this.player.distanceWalked = 0;
    this.stopHarvesting();
    // What was being built is not carried into the new summer: a year is long
    // enough that the pack, the map and the plan have all moved on.
    this.buildMode = null;
    // A press held across the end of a summer is spent; the new one starts on
    // a fresh press, not mid-cut.
    this.interactSpent = true;
    this.pendingTap = null;
    this.record({ type: "summerStarted", year: this.year, tired: this.tired });
  }

  /**
   * What the map does over the winter after summer {@link year}, all of it
   * drawn from the seed and the year, so a map and a year always come out the
   * same.
   *
   * - Inside the near ring every node is back. Outside it the resource table
   *   says: every year, a share of what was picked this summer, or never.
   *   What was picked in an earlier summer and did not come back then is gone.
   * - A sapling stands again {@link C.SAPLING_RETURN_YEARS} winters after it
   *   was felled, if nothing stands on its tile.
   * - Thicket creeps back onto a cut tile that touches it, by chance.
   * - A bridge loses one tile every {@link C.BRIDGE_WEAR_EVERY} winters.
   */
  private winterOnMap(): void {
    const rng = mulberry32((this.seed ^ Math.imul(this.year, 0x9e3779b1)) >>> 0);
    const z = this.player.z;
    const w = this.map.width;

    const share = new Map<ResourceKind, ResourceNode[]>();
    for (const node of this.nodes) {
      if (!node.harvested) continue;
      const returns = RESOURCES[node.kind].returns;
      if (this.inNearRing(node.x, node.y) || returns === "yearly") {
        node.harvested = false;
      } else if (returns === "slowly" && this.pickedThisSummer.has(node.id)) {
        const picked = share.get(node.kind) ?? [];
        picked.push(node);
        share.set(node.kind, picked);
      }
    }
    for (const picked of share.values()) {
      const back = Math.floor(picked.length * C.REPLENISH_SHARE);
      for (const node of shuffle(rng, picked).slice(0, back)) node.harvested = false;
    }
    this.pickedThisSummer.clear();

    for (const [idx, year] of this.felledIn) {
      const x = idx % w;
      const y = (idx - x) / w;
      if (this.map.get(x, y, z) !== "grass") {
        this.felledIn.delete(idx);
      } else if (this.year - year + 1 >= C.SAPLING_RETURN_YEARS && this.freeToBuild({ x, y })) {
        this.map.set(x, y, "sapling", z);
        this.felledIn.delete(idx);
      }
    }

    // Every candidate is taken before any tile changes, so thicket that crept
    // back this winter does not carry the creep further along the same path.
    const creep: number[] = [];
    for (const idx of this.cutTiles) {
      const x = idx % w;
      const y = (idx - x) / w;
      if (this.map.get(x, y, z) !== C.CUT_LEAVES) {
        this.cutTiles.delete(idx);
        continue;
      }
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => this.map.get(x + dx!, y + dy!, z) === "thicket");
      if (touches && this.freeToBuild({ x, y })) creep.push(idx);
    }
    for (const idx of creep) {
      if (rng() >= C.THICKET_CREEP_CHANCE) continue;
      const x = idx % w;
      this.map.set(x, (idx - x) / w, "thicket", z);
      this.cutTiles.delete(idx);
    }

    if (this.year % C.BRIDGE_WEAR_EVERY === 0) {
      const bridges: TileRef[] = [];
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < w; x++) {
          if (this.map.get(x, y, z) === "bridge") bridges.push({ x, y });
        }
      }
      if (bridges.length > 0) {
        const lost = bridges[Math.floor(rng() * bridges.length)]!;
        this.map.set(lost.x, lost.y, "stream", z);
      }
    }
  }

  /** What the interact key would do from here, or null for nothing in reach. */
  availableAction(): Action | null {
    const { x, y, z } = this.player;
    const atCamp = withinReach(x, y, this.camp);
    const stored = this.inventory.items;
    // Banking wins at camp, but only when there is something to bank, so a
    // node next to the camp is still harvestable with an empty pack.
    if (atCamp && stored > 0) return { type: "deposit", stored, blocked: null };

    const node = nearestNodeWithin(this.nodes, x, y);
    if (node) {
      const blocked = this.inventory.fits(node.kind) ? null : "backpackFull";
      return { type: "harvest", node, blocked };
    }

    // Drinking comes before the tools, but only while there is thirst to
    // quench, so a spring beside a thicket does not hide the cut, and the key
    // on a spring's bank lays a bridge when the bar is nearly full.
    if (this.stats.hydration < C.DRINK_OFFER_BELOW) {
      const spring = nearestSpringWithin(this.springs, x, y);
      if (spring) return { type: "drink", x: spring.x, y: spring.y, blocked: null };
    }

    // Picking one up comes after picking a node and after a drink, so standing
    // on what you just dropped stops neither: the fruit you dropped it for is
    // still harvested with the same key. It is a tap, not a hold -- gathering
    // is prying a vine out of the mud, picking up is bending down.
    const item = nearestSpringWithin(this.dropped, x, y);
    if (item) {
      const blocked = this.inventory.fits(item.kind) ? null : "backpackFull";
      return { type: "pickUp", item, blocked };
    }

    // Tools come after picking, so a vine growing against the thicket that
    // walls it in can still be picked up. They act only on the tile ahead.
    const ahead = tileAhead(this.map, x, y, this.player.heading, z);
    return (ahead && this.toolAction(ahead)) ??
      (atCamp ? { type: "deposit", stored: 0, blocked: "nothingToBank" } : null);
  }

  /**
   * What the key does to the tile ahead, or null for nothing.
   *
   * The tools are what is there: a thicket is cut, a sapling is felled.
   * Building is never guessed from the ground, only from the build menu, so
   * plain grass says nothing at all unless something is being built.
   */
  private toolAction(ahead: TileRef): Action | null {
    const { x, y } = ahead;
    const z = this.player.z;
    switch (this.map.get(x, y, z)) {
      case "thicket":
        return this.tools.has("knife") ? { type: "cut", x, y, blocked: null } : null;
      case "sapling": {
        const blocked = !this.tools.has("axe")
          ? "noAxe"
          : this.inventory.fits("log")
            ? null
            : "backpackFull";
        return { type: "fell", x, y, blocked };
      }
      default:
        return this.buildAction(ahead);
    }
  }

  /**
   * What is being built, on the tile ahead, with why it cannot go there.
   *
   * Always the build the menu is set to: it is refused on the wrong ground
   * rather than quietly becoming the build that would fit, so the tile ahead
   * only ever does the one thing the player asked for.
   */
  private buildAction(ahead: TileRef): Action | null {
    const build = this.buildMode;
    if (!build) return null;
    const spot = { x: ahead.x, y: ahead.y, blocked: this.refusal(build, ahead) };
    // Written out one arm at a time rather than as one literal with
    // `BUILD_ACTION[build]` for its type: two union-typed fields in one object
    // literal make a cross product that tsc stops normalising past 25 cases,
    // and `blocked` has enough reasons in it now to cross that line.
    switch (BUILD_ACTION[build]) {
      case "build":
        return { type: "build", ...spot };
      case "dig":
        return { type: "dig", ...spot };
    }
  }

  /** Why `build` cannot go on the tile ahead, or null if it can. */
  private refusal(build: Build, ahead: TileRef): BlockedReason | null {
    const { x, y } = ahead;
    const kind = this.map.get(x, y, this.player.z);
    if (build === "bridge") {
      if (kind !== "stream") return "wrongGround";
    } else {
      if (kind !== "grass") return "wrongGround";
      if (!this.freeToBuild(ahead)) return "occupied";
      if (
        build === "well" &&
        waterWithin(this.map, this.springs, x, y, C.WELL_WATER_CLEARANCE, this.player.z)
      ) {
        return "nearWater";
      }
    }
    return this.inventory.has(BUILD_COST[build]) ? null : "noMaterials";
  }

  /**
   * The build menu: everything the player knows how to build, and whether the
   * pack can pay for it. What cannot be paid for is still listed, and can
   * still be chosen, because the menu is where the recipes are read.
   */
  buildOptions(): BuildOption[] {
    return BUILDS.filter((build) => build === "bridge" || this.recipes.has(build)).map((build) => ({
      build,
      cost: BUILD_COST[build],
      affordable: this.inventory.has(BUILD_COST[build]),
    }));
  }

  /**
   * What a player standing here would be told about building, with nothing
   * chosen: the one place the game volunteers a recipe.
   *
   * Water ahead is the teaching moment, because a stream is the first barrier
   * that cannot be walked, cut or felled through.
   */
  buildHint(): Build | null {
    if (this.buildMode) return null;
    const ahead = tileAhead(this.map, this.player.x, this.player.y, this.player.heading, this.player.z);
    if (!ahead) return null;
    return this.map.get(ahead.x, ahead.y, this.player.z) === "stream" ? "bridge" : null;
  }

  /** Nothing already stands on the tile: no camp, node, spring or well. */
  private freeToBuild({ x, y }: TileRef): boolean {
    const on = (p: Vec2) => Math.floor(p.x) === x && Math.floor(p.y) === y;
    return (
      !on(this.camp) &&
      // Picked nodes too, since they grow back next summer.
      !this.nodes.some(on) &&
      !this.springs.some(on)
    );
  }

  /**
   * Put the player down somewhere else, if they can stand there.
   *
   * Refuses an impassable spot and reports false, because a player dropped
   * inside a rock cannot walk out of one: collision only lets a move happen
   * from a legal position to a legal position.
   *
   * The distance is not walked, so it does not count towards the summer's total,
   * and any harvest in progress is dropped. Only the debug overlay calls this.
   */
  teleport(x: number, y: number): boolean {
    if (!canStand(this.map, x, y, this.player.z)) return false;
    this.player.x = x;
    this.player.y = y;
    this.player.moving = false;
    this.stopHarvesting();
    this.pendingTap = null;
    return true;
  }

  /** Terrain the player is currently standing on. */
  groundUnderPlayer(): TerrainDef {
    return this.map.defAt(this.player.x, this.player.y, this.player.z);
  }

  /**
   * Tiles per second on the ground under the player. A tired summer is slower
   * on rough ground only; easy ground is walked as fast as ever.
   */
  speed(): number {
    const ground = this.groundUnderPlayer();
    if (this.tired && ground.difficult) return C.WALK_SPEED * C.TIRED_DIFFICULT_SPEED_MUL;
    return C.WALK_SPEED * ground.speedMul;
  }

  /**
   * Advance by exactly `dt` seconds. Call at a fixed rate.
   *
   * Every part of a tick goes here, in order. Standing still is a tick like any
   * other: hydration drains whether or not you are walking, and the summer runs
   * down whether or not you are doing anything with it. Nothing in this method
   * may return early on "no input", which is why movement -- the one part that
   * genuinely has nothing to do then -- keeps its own early return one level
   * down.
   *
   * The tick that runs the clock out ends the summer, and once it has ended
   * nothing steps at all: a summer you can keep playing past the end is not one.
   * While {@link frozen}, the player still acts but the clock and hydration
   * hold.
   */
  step(dt: number, input: InputState): void {
    if (this.ended) return;
    this.movePlayer(dt, input);
    this.interact(dt, input);
    this.drops(input);
    this.held = { interact: input.interact, drop: input.drop, dropSwitch: input.dropSwitch };
    if (!this.frozen) {
      this.stats.step(dt);
      this.elapsedSec = Math.min(this.elapsedSec + dt, C.SUMMER_LENGTH_SEC);
    }
    if (this.elapsedSec >= C.SUMMER_LENGTH_SEC) this.endSummer();
  }

  private record(event: WorldEventPayload): void {
    this.events.push({ ...event, at: this.elapsedSec });
  }

  private blocked(reason: BlockedReason): void {
    this.record({ type: "blocked", reason });
  }

  /**
   * The two drop keys, both one-shot: one throws the selected kind on the
   * ground, the other moves the selection on. They work wherever the player
   * stands, so being full in a field with nothing to spend on is one key
   * rather than a mode with keys of its own.
   */
  private drops(input: InputState): void {
    if (input.dropSwitch && !this.held.dropSwitch) this.cycleDropKind();
    if (input.drop && !this.held.drop) this.dropSelected();
  }

  /**
   * Everything on the interact key: picking, picking up, drinking, cutting,
   * bridging, banking.
   *
   * The holds are all the same shape. Progress builds while the key is down
   * and the same thing stays in reach, and is thrown away the moment either
   * stops being true -- walking away mid-cut loses the cut, which is what
   * makes the timer a cost rather than a formality.
   *
   * Banking is the odd one: the tap banks and the hold opens the panel, which
   * are different things on the one key, so the tap waits for the release. A
   * quick arrival still reads as one press.
   */
  private interact(dt: number, input: InputState): void {
    if (!input.interact) {
      // Let go before the panel opened: the transfer that was waiting happens
      // now.
      const tap = this.pendingTap;
      this.pendingTap = null;
      this.interactSpent = false;
      this.stopHarvesting();
      if (tap) {
        if (tap.blocked) this.blocked(tap.blocked);
        else this.record({ type: "deposited", stored: this.bank() });
      }
      return;
    }
    if (this.interactSpent) {
      this.stopHarvesting();
      return;
    }

    const pressed = !this.held.interact;
    const action = this.availableAction();

    if (!action) {
      // Walked away mid-hold: the transfer goes with the progress.
      this.pendingTap = null;
      this.stopHarvesting();
      return;
    }

    if (action.type === "deposit") {
      // Held on to, rather than done now. A blocked one is held on to as well,
      // because an empty pack at camp is still a store worth opening.
      this.pendingTap = action;
      if (this.hold(dt, action) < 1) return;
      this.pendingTap = null;
      this.interactSpent = true;
      this.openTransfer();
      this.stopHarvesting();
      return;
    }

    this.pendingTap = null;

    if (action.type === "pickUp") {
      if (!pressed) return;
      this.interactSpent = true;
      if (action.blocked) this.blocked(action.blocked);
      else this.pickUp(action.item);
      return;
    }

    if (action.blocked) {
      // Say why once, on the press, rather than every tick the key is held.
      if (pressed) {
        this.interactSpent = true;
        this.blocked(action.blocked);
      }
      this.stopHarvesting();
      return;
    }

    if (this.hold(dt, action) < 1) return;

    this.complete(action);
    this.stopHarvesting();
  }

  /**
   * Carry one tick of a hold on `key`, and report how far through it is.
   *
   * Switching target -- to another node, or to the next thicket tile along --
   * starts the hold over instead of inheriting the last one's progress.
   */
  private hold(dt: number, action: Action): number {
    const key = holdKeyFor(action);
    if (this.holdKey !== key) {
      this.holdKey = key;
      this.harvestProgress = 0;
    }
    this.harvestProgress += dt / this.holdTime(action.type);
    return this.harvestProgress;
  }

  /**
   * Seconds a hold takes this summer. A tired summer makes every hold longer
   * except the one that opens the transfer panel, which is not work.
   */
  holdTime(type: Action["type"]): number {
    const tired = this.tired && type !== "deposit";
    return HOLD_TIME[type] * (tired ? C.TIRED_HOLD_MUL : 1);
  }

  /** Take one dropped item off the ground and into the pack. */
  private pickUp(item: Dropped): void {
    const at = this.dropped.indexOf(item);
    if (at < 0 || this.inventory.add(item.kind) === 0) return;
    this.dropped.splice(at, 1);
    this.record({ type: "pickedUp", kind: item.kind });
  }

  /** Carry out a hold that has run its full time. */
  private complete(action: Action): void {
    switch (action.type) {
      case "harvest":
        action.node.harvested = true;
        this.pickedThisSummer.add(action.node.id);
        this.inventory.add(action.node.kind);
        this.record({ type: "harvested", kind: action.node.kind });
        return;
      case "fell":
        this.map.set(action.x, action.y, "grass", this.player.z);
        this.felledIn.set(action.y * this.map.width + action.x, this.year);
        this.inventory.add("log");
        this.record({ type: "felled", x: action.x, y: action.y });
        return;
      case "dig":
        if (!this.inventory.pay(WELL_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.springs.push({ x: action.x, y: action.y, well: true });
        this.record({ type: "dug", x: action.x, y: action.y });
        return;
      case "drink":
        this.stats.drink();
        this.record({ type: "drank" });
        return;
      case "cut":
        this.map.set(action.x, action.y, C.CUT_LEAVES, this.player.z);
        this.cutTiles.add(action.y * this.map.width + action.x);
        this.record({ type: "cut", x: action.x, y: action.y });
        return;
      case "build":
        // Checked again rather than trusted: the pack can empty mid-hold, if
        // a bridge tile is laid and the next one started without letting go.
        if (!this.inventory.pay(BRIDGE_COST)) {
          this.blocked("noMaterials");
          return;
        }
        this.map.set(action.x, action.y, "bridge", this.player.z);
        this.record({ type: "built", x: action.x, y: action.y });
        return;
      case "deposit":
      case "pickUp":
        return;
    }
  }

  private stopHarvesting(): void {
    this.holdKey = "";
    this.harvestProgress = 0;
  }

  /**
   * Walk the player for one tick, or stand them still if nothing is held.
   * Rough ground is slower, read off the tile the tick starts on, and that is
   * all it does.
   */
  private movePlayer(dt: number, input: InputState): void {
    const player = this.player;
    if (input.moveX === 0 && input.moveY === 0) {
      player.moving = false;
      return;
    }
    this.movedThisSummer = true;
    // What the input asked for, whether or not a wall let it happen: pressing
    // into the stream is how a player says which tile they mean.
    player.heading = headingFor(input.moveX, input.moveY);

    const distance = this.speed() * dt;
    const travelled = moveWithCollision(
      this.map,
      player,
      input.moveX * distance,
      input.moveY * distance,
    );

    player.facing = facingFor(input.moveX, input.moveY, player.facing);
    // Pressed into a wall counts as standing still, which keeps the walk
    // animation from cycling on the spot.
    player.moving = travelled > 1e-6;
    player.distanceWalked += travelled;
  }
}
