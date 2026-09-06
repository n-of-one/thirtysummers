import type { TileMap } from "../sim/tilemap.ts";
import type { ResourceNode, Vec2 } from "../sim/types.ts";
import type { AssetPack, PropSprite } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { ScrollWindow } from "./scrollWindow.ts";

/** One thing to draw standing on the ground, and where it stands. */
export interface Placement {
  /** Where its feet are, in tile units. */
  readonly worldX: number;
  readonly worldY: number;
  readonly art: PropSprite;
  /** Whole art pixels this may be nudged off its tile centre by. */
  readonly jitter: number;
  /** Tall enough to hide the player behind it, i.e. a tree. */
  readonly occludes: boolean;
}

/**
 * How far a prop may be nudged off its tile centre, in ASSET pixels.
 *
 * The nudge has to be a whole number of source pixels. Offsetting by screen
 * pixels instead shifts a sprite by a fraction of an art pixel, so two trees
 * end up on grids a pixel or two apart and the pixel-art illusion collapses.
 */
export const PROP_JITTER_PX = 1;

/**
 * Everything standing on the ground inside the window: trees, underbrush, the
 * camp, and resource nodes still waiting to be harvested.
 *
 * This is the decision -- what to draw and where it stands in the world -- with
 * no sprites in it. Turning a placement into a positioned, snapped, depth-sorted
 * sprite is {@link PropLayer}'s job, and is mechanical once this has answered.
 * Separating the two is what makes the choice testable without a GPU.
 */
export function* placementsIn(
  map: TileMap,
  pack: AssetPack,
  window: ScrollWindow,
  camp: Vec2,
  nodes: readonly ResourceNode[],
  z = 0,
): Generator<Placement> {
  const { originX, originY, cols, rows } = window;

  for (let row = 0; row < rows; row++) {
    const tileY = originY + row;
    for (let col = 0; col < cols; col++) {
      const tileX = originX + col;
      const kind = map.get(tileX, tileY, z);
      // Thicket stands here too: its ground is the same undergrowth, and what
      // separates the wall from the walkable version of it is that the wall
      // has growth on every tile with no gaps to step through.
      if (kind !== "tree" && kind !== "underbrush" && kind !== "thicket") continue;
      const art = pack.prop(kind, tileHash(tileX, tileY));
      if (!art) continue;
      yield {
        // A prop stands on the bottom edge of its tile, so it sorts in front of
        // anything whose feet are further north.
        worldX: tileX + 0.5,
        worldY: tileY + 1,
        art,
        jitter: PROP_JITTER_PX,
        occludes: kind === "tree",
      };
    }
  }

  if (window.covers(camp.x, camp.y)) {
    yield { worldX: camp.x, worldY: camp.y, art: pack.camp, jitter: 0, occludes: false };
  }

  for (const node of nodes) {
    if (node.harvested || !window.covers(node.x, node.y)) continue;
    yield {
      worldX: node.x,
      worldY: node.y,
      art: pack.resource(node.kind),
      jitter: 0,
      occludes: false,
    };
  }
}
