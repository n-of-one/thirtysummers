import { lies } from "../sim/resources.ts";
import type { TileMap } from "../sim/tilemap.ts";
import type { Dropped, ResourceNode, Spring, Vec2 } from "../sim/types.ts";
import type { AssetPack, PropSprite } from "./packs/pack.ts";
import { tileHash } from "./packs/pack.ts";
import type { ScrollWindow } from "./scrollWindow.ts";
import type { TroddenAt } from "./tileLayer.ts";

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
 * Everything standing on the ground inside the window: trees, saplings,
 * underbrush, the camp, the springs and wells, whatever has been
 * dropped, and resource nodes still waiting to be harvested.
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
  springs: readonly Spring[] = [],
  dropped: readonly Dropped[] = [],
  z = 0,
  trodden: TroddenAt = () => false,
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
      if (kind !== "tree" && kind !== "underbrush" && kind !== "thicket" && kind !== "sapling") {
        continue;
      }
      // A bush standing on a trail would say the trail is not there.
      if (kind === "underbrush" && trodden(tileX, tileY, z)) continue;
      const art = pack.prop(kind, tileHash(tileX, tileY));
      if (!art) continue;
      yield {
        // A prop stands on the bottom edge of its tile, so it sorts in front of
        // anything whose feet are further north.
        worldX: tileX + 0.5,
        worldY: tileY + 1,
        art,
        jitter: PROP_JITTER_PX,
        // A sapling can be drawn as tall as a tree, so it may hide the player too.
        occludes: kind === "tree" || kind === "sapling",
      };
    }
  }

  if (window.covers(camp.x, camp.y)) {
    yield { worldX: camp.x, worldY: camp.y, art: pack.camp, jitter: 0, occludes: false };
  }

  // Springs and wells are tile positions, drawn standing at the tile's centre
  // like a node.
  for (const spring of springs) {
    if (!window.covers(spring.x, spring.y)) continue;
    yield {
      worldX: spring.x + 0.5,
      worldY: spring.y + 0.5,
      art: spring.well ? pack.well : pack.spring,
      jitter: 0,
      occludes: false,
    };
  }

  // Items lying on the ground, each its own small drawing at the same pixel
  // scale as everything else, and sorted in with the rest so a dropped log
  // behind a bush is behind it.
  for (const item of dropped) {
    if (!window.covers(item.x, item.y)) continue;
    yield {
      worldX: item.x + 0.5,
      worldY: item.y + 0.5,
      art: pack.dropped(item.kind),
      jitter: 0,
      occludes: false,
    };
  }

  for (const node of nodes) {
    if (node.harvested || !window.covers(node.x, node.y)) continue;
    yield {
      worldX: node.x,
      worldY: node.y,
      // A kind that lies there rather than growing is drawn the way a dropped
      // one is, so it reads as something to bend down for.
      art: lies(node.kind) ? pack.dropped(node.kind) : pack.resource(node.kind),
      jitter: 0,
      occludes: false,
    };
  }
}
