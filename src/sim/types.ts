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
  | "bridge";

export type ResourceKind = "fruit" | "water" | "ore" | "vine" | "stick";

export const RESOURCE_KINDS: readonly ResourceKind[] = [
  "fruit",
  "water",
  "ore",
  "vine",
  "stick",
];

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
  | "stomachFull"
  | "noFruit"
  | "noWater"
  | "noOre"
  | "noMaterials";

/**
 * Something the simulation did this tick, worth telling the player about.
 *
 * The world appends and never removes. A reader keeps its own cursor into the
 * list, which is what lets the HUD show toasts and the end-of-summer summary
 * count the summer up without either of them writing back into simulation
 * state. A whole summer produces a few hundred of these, so keeping them all costs nothing.
 */
export type WorldEventPayload =
  | { type: "harvested"; kind: ResourceKind }
  | { type: "ate" }
  | { type: "drank" }
  | { type: "deposited"; gold: number }
  | { type: "blocked"; reason: BlockedReason }
  /** A thicket tile cut through, and a stream tile bridged. Both change the map. */
  | { type: "cut"; x: number; y: number }
  | { type: "built"; x: number; y: number }
  /** A new summer began on the same map. Everything the player changed is kept. */
  | { type: "summerStarted"; year: number };

/** A payload, stamped with the second of the summer it happened at. */
export type WorldEvent = WorldEventPayload & { at: number };
