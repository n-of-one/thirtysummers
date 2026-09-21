import { Texture, TextureSource } from "pixi.js";
import type { AssetPack, Bounds, PropSprite } from "../src/render/packs/pack.ts";
import { TERRAIN_ORDER } from "../src/sim/terrain.ts";
import { RESOURCE_KINDS } from "../src/sim/resources.ts";
import { FACINGS } from "../src/sim/types.ts";
import type { Facing, ResourceKind, TerrainKind } from "../src/sim/types.ts";

/**
 * An AssetPack that draws nothing but records everything.
 *
 * Pixi's scene graph works without a GPU -- Container, Sprite and Texture all
 * construct headlessly -- so a layer can be driven in a test as long as nothing
 * asks for a renderer. This pack hands out one distinct texture per terrain, so
 * a test can say which tile a sprite ended up showing, and logs every call, so
 * a test can say how often the layer bothered to ask.
 */

let nextId = 0;

/** A texture backed by a bare source: real dimensions, no pixels, no GPU. */
export function stubTexture(width = 8, height = 8): Texture {
  return new Texture({ source: new TextureSource({ width, height, label: `stub${nextId++}` }) });
}

const WHOLE_TILE: Bounds = { left: -0.5, top: -0.5, right: 0.5, bottom: 0.5 };

function stubProp(width = 8, height = 8, bounds: Bounds = WHOLE_TILE): PropSprite {
  return { texture: stubTexture(width, height), anchorX: 0.5, anchorY: 1, bounds };
}

export interface GroundCall {
  kind: TerrainKind;
  mask: number;
  variant: number;
  frame: number;
}

export class StubPack implements AssetPack {
  readonly id = "stub";
  readonly tileSize = 8;

  /** Every ground() call in order, so a test can count refills. */
  readonly groundCalls: GroundCall[] = [];

  readonly groundTextures = new Map<TerrainKind, Texture>();
  private readonly props = new Map<TerrainKind, PropSprite>();
  private readonly resources = new Map<ResourceKind, PropSprite>();
  private readonly droppedArt = new Map<ResourceKind, PropSprite>();
  private readonly walks = new Map<Facing, Texture[]>();
  readonly camp = stubProp();
  readonly spring = stubProp();
  readonly well = stubProp();

  readonly playerAnchor = { x: 0.5, y: 1 };
  readonly playerBounds: Bounds = { left: -0.4, top: -2, right: 0.4, bottom: 0 };

  /**
   * @param propless  terrains that report no prop, the way the real pack leaves
   *                  most underbrush tiles bare.
   */
  constructor(private readonly propless: readonly TerrainKind[] = []) {
    for (const kind of TERRAIN_ORDER) this.groundTextures.set(kind, stubTexture());
    // A tree is three tiles tall so it overlaps what is behind it; a bush is one.
    this.props.set("tree", stubProp(24, 32, { left: -1.5, top: -4, right: 1.5, bottom: 0 }));
    this.props.set("underbrush", stubProp(8, 16, { left: -0.5, top: -2, right: 0.5, bottom: 0 }));
    // A thicket is undergrowth with no gaps in it, so it has growth on it too.
    this.props.set("thicket", stubProp(8, 16, { left: -0.5, top: -2, right: 0.5, bottom: 0 }));
    for (const kind of RESOURCE_KINDS) {
      this.resources.set(kind, stubProp());
      // Half the cell and a third of the height, as the real packs' small
      // drawing is: a placement test can tell one from the other.
      this.droppedArt.set(kind, stubProp(4, 3));
    }
    for (const facing of FACINGS) this.walks.set(facing, [stubTexture(32, 32), stubTexture(32, 32)]);
  }

  ground(kind: TerrainKind, mask: number, variant: number, frame: number): Texture {
    this.groundCalls.push({ kind, mask, variant, frame });
    return this.groundTextures.get(kind)!;
  }

  groundTint(): number {
    return 0xffffff;
  }

  prop(kind: TerrainKind): PropSprite | null {
    if (this.propless.includes(kind)) return null;
    return this.props.get(kind) ?? null;
  }

  resource(kind: ResourceKind): PropSprite {
    return this.resources.get(kind)!;
  }

  dropped(kind: ResourceKind): PropSprite {
    return this.droppedArt.get(kind)!;
  }

  walk(facing: Facing): readonly Texture[] {
    return this.walks.get(facing)!;
  }

  idle(facing: Facing): Texture {
    return this.walks.get(facing)![0]!;
  }

  destroy(): void {}
}
