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
  | "rock";

export type ResourceKind = "fruit" | "water" | "ore";

export const RESOURCE_KINDS: readonly ResourceKind[] = ["fruit", "water", "ore"];

/**
 * The character art is drawn in a three-quarter view, so there are no straight
 * N/S/E/W poses -- every sprite is angled. Facings are therefore diagonal.
 * Only the two southward poses show the face, which is why walking straight
 * left or right resolves to one of those; see `facingFor`.
 */
export type Facing = "southEast" | "southWest" | "northEast" | "northWest";

export interface ResourceNode {
  id: number;
  kind: ResourceKind;
  /** Tile centre, in tile units. */
  x: number;
  y: number;
  z: number;
  harvested: boolean;
}
