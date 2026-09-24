export interface Vec2 {
  x: number;
  y: number;
}

export type TerrainKind =
  | "grass"
  | "underbrush"
  | "mud"
  | "tree"
  | "stream"
  | "rock"
  | "thicket"
  | "bridge"
  | "sapling";

/** Every kind that is gathered. What each one is, is in `resources.ts`. */
export type ResourceKind = "fruit" | "feather" | "stick" | "vine" | "ore" | "log" | "shell";

/**
 * What the player owns beyond the pack. The knife is owned from the start;
 * the axe and the cart are bought in winter.
 */
export type Tool = "knife" | "axe" | "cart";

/**
 * What the player knows how to build beyond a bridge, which needs no recipe.
 * The well is known from family level 3, which comes with M12.
 */
export type Recipe = "well";

/**
 * What the build menu can put you into build mode for. Building is always
 * chosen, never guessed from what is in the pack.
 */
export type Build = "bridge" | "well";

export const BUILDS: readonly Build[] = ["bridge", "well"];

/**
 * A drinking spot, in integer tile coordinates. Reeds on a stream's bank, or
 * a well dug where there is no stream, which drinks the same and is drawn
 * differently.
 */
export interface Spring extends Vec2 {
  well?: boolean;
}

/**
 * One item lying on the ground, in integer tile coordinates. One to a tile,
 * so a heap of six is six tiles, and the scatter is honest about how much was
 * carried. Nothing on the ground survives a winter.
 */
export interface Dropped extends Vec2 {
  kind: ResourceKind;
}

/**
 * The character art is drawn in a three-quarter view, so there are no straight
 * N/S/E/W poses -- every sprite is angled. Facings are therefore diagonal.
 * Only the two southward poses show the face, which is why walking straight
 * left or right resolves to one of those; see `facingFor`.
 */
export type Facing = "southEast" | "southWest" | "northEast" | "northWest";

export const FACINGS: readonly Facing[] = ["southEast", "southWest", "northEast", "northWest"];

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  /** Tile centre, in tile units. */
  x: number;
  y: number;
  z: number;
  harvested: boolean;
}

/** Why an attempted action did nothing. The HUD turns these into words. */
export type BlockedReason =
  | "backpackFull"
  | "nothingToBank"
  | "noMaterials"
  /** A sapling ahead and no axe to fell it with. */
  | "noAxe"
  /** A well on a spot too close to water to need one. */
  | "nearWater"
  /** A bridge on dry land, or a well on anything but open grass. */
  | "wrongGround"
  /** The tile ahead already has something standing on it. */
  | "occupied"
  /** A drop with no free ground anywhere near to spill onto. */
  | "noRoomToDrop";

/**
 * Something the simulation did this tick, worth telling the player about.
 *
 * The world appends and never removes. A reader keeps its own cursor into the
 * list, which is what lets the HUD show toasts and the end-of-summer summary
 * count the summer up without either of them writing back into simulation
 * state. A whole summer produces a few thousand of these, most of them tiles trodden, so keeping them all costs nothing.
 */
export type WorldEventPayload =
  | { type: "harvested"; kind: ResourceKind }
  | { type: "drank" }
  /** The whole pack banked at camp, `stored` items of it. Camp takes everything and sells nothing. */
  | { type: "deposited"; stored: number }
  | { type: "blocked"; reason: BlockedReason }
  /** A thicket tile cut through, and a stream tile bridged. Both change the map. */
  | { type: "cut"; x: number; y: number }
  | { type: "built"; x: number; y: number }
  /** A sapling felled with the axe, leaving grass and a log in the pack. */
  | { type: "felled"; x: number; y: number }
  /**
   * The player's centre walked over underbrush at (x, y) and left it, which
   * wore it to `stage`: 1 for trodden, up to `TRAIL_STAGES` for flat.
   */
  | { type: "trodden"; x: number; y: number; stage: number }
  /** A well dug on (x, y), which is a spring from now on. */
  | { type: "dug"; x: number; y: number }
  /** The transfer panel was opened at camp, on (x, y). */
  | { type: "transferOpened"; x: number; y: number }
  /** `n` of a kind moved out of the pack, through the panel, and back in. */
  | { type: "putAway"; kind: ResourceKind; n: number }
  | { type: "tookOut"; kind: ResourceKind; n: number }
  /** `n` of a kind dropped on the ground round the player, one to a tile. */
  | { type: "dropped"; kind: ResourceKind; n: number }
  /** One dropped item picked back up. */
  | { type: "pickedUp"; kind: ResourceKind }
  /**
   * The summer ended, by the clock or from camp. `stored` is what was still in
   * the pack and was banked there and then; `away` is whether it ended out of
   * reach of camp.
   */
  | { type: "summerEnded"; away: boolean; stored: number }
  /**
   * The winter was settled: `given` gold went to the family, and `tired` says
   * whether it could not be paid.
   */
  | { type: "winterEnded"; given: number; tired: boolean }
  /** A new summer began on the same map, a tired one after a winter not paid. */
  | { type: "summerStarted"; year: number; tired: boolean };

/** A payload, stamped with the second of the summer it happened at. */
export type WorldEvent = WorldEventPayload & { at: number };
