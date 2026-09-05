import { Graphics, Rectangle, type Renderer, type Texture } from "pixi.js";
import { mulberry32, type Rng } from "../../sim/rng.ts";
import { TERRAIN_ORDER } from "../../sim/terrain.ts";
import { FACINGS, RESOURCE_KINDS } from "../../sim/types.ts";
import type { Facing, ResourceKind, TerrainKind } from "../../sim/types.ts";
import type { AssetPack, AssetPackSource, Bounds, PropSprite } from "./pack.ts";

/**
 * An art pack drawn from code at startup -- no image files, no licence, nothing
 * to commit. It is the fallback whenever a real pack is missing, which keeps the
 * repository runnable for anyone who clones it without buying art.
 */

const S = 16; // source tile size, scaled up by the renderer
const VARIANTS = 4;

/** Placeholder art fills its cell, so its content is simply the whole tile. */
const WHOLE_TILE: Bounds = { left: -0.5, top: -0.5, right: 0.5, bottom: 0.5 };
const WALK_FRAMES = 4;

export const placeholderPackSource: AssetPackSource = {
  id: "placeholder",
  available: async () => true,
  load: async (renderer: Renderer) => new PlaceholderPack(renderer),
};

class PlaceholderPack implements AssetPack {
  readonly id = "placeholder";
  readonly tileSize = S;

  private readonly made: Texture[] = [];
  private readonly terrains = new Map<TerrainKind, Texture[]>();
  private readonly resources = new Map<ResourceKind, Texture>();
  private readonly walks = new Map<Facing, Texture[]>();
  readonly camp: PropSprite;

  /** The drawn legs end at y=15 of a 16px tile. */
  readonly playerAnchor = { x: 0.5, y: 15 / 16 };
  /** The drawn figure is about 9px wide and 14px tall, standing on its feet. */
  readonly playerBounds: Bounds = {
    left: -0.6 / 2,
    right: 0.6 / 2,
    top: -14 / S,
    bottom: 0,
  };

  constructor(private readonly renderer: Renderer) {
    for (const kind of TERRAIN_ORDER) {
      const rng = mulberry32(hashString(kind));
      this.terrains.set(
        kind,
        Array.from({ length: VARIANTS }, () => this.bake((g) => drawTerrain(g, kind, rng))),
      );
    }
    for (const kind of RESOURCE_KINDS) {
      this.resources.set(kind, this.bake((g) => drawResource(g, kind)));
    }
    this.camp = { texture: this.bake(drawCamp), anchorX: 0.5, anchorY: 0.5, bounds: WHOLE_TILE };
    for (const facing of FACINGS) {
      this.walks.set(
        facing,
        Array.from({ length: WALK_FRAMES }, (_, frame) =>
          this.bake((g) => drawPlayer(g, facing, frame)),
        ),
      );
    }
  }

  /** Render a Graphics into a texture of exactly one tile, crisply. */
  private bake(paint: (g: Graphics) => void): Texture {
    const g = new Graphics();
    paint(g);
    const texture = this.renderer.generateTexture({
      target: g,
      frame: new Rectangle(0, 0, S, S),
      resolution: 1,
      antialias: false,
      textureSourceOptions: { scaleMode: "nearest" },
    });
    g.destroy();
    this.made.push(texture);
    return texture;
  }

  /** The placeholder draws each terrain whole, so it ignores the autotile mask. */
  ground(kind: TerrainKind, _mask: number, variant: number, _frame: number): Texture {
    const variants = this.terrains.get(kind)!;
    return variants[variant % variants.length]!;
  }
  /** Each terrain is already drawn in its own colour. */
  groundTint(_kind: TerrainKind): number {
    return 0xffffff;
  }
  /** Trees and underbrush are baked into the placeholder's ground tiles. */
  prop(_kind: TerrainKind, _variant: number): PropSprite | null {
    return null;
  }
  resource(kind: ResourceKind): PropSprite {
    return { texture: this.resources.get(kind)!, anchorX: 0.5, anchorY: 0.5, bounds: WHOLE_TILE };
  }
  walk(facing: Facing): readonly Texture[] {
    return this.walks.get(facing)!;
  }
  idle(facing: Facing): Texture {
    return this.walks.get(facing)![0]!;
  }
  destroy(): void {
    for (const texture of this.made) texture.destroy(true);
    this.made.length = 0;
  }
}

// --------------------------------------------------------------- painting ---

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Scatter small rectangles of the given colours across the tile. */
function speckle(g: Graphics, rng: Rng, count: number, colors: number[], maxSize = 1): void {
  for (let i = 0; i < count; i++) {
    const w = 1 + Math.floor(rng() * maxSize);
    const h = 1 + Math.floor(rng() * maxSize);
    const color = colors[Math.floor(rng() * colors.length)]!;
    g.rect(Math.floor(rng() * (S - w)), Math.floor(rng() * (S - h)), w, h).fill(color);
  }
}

function drawTerrain(g: Graphics, kind: TerrainKind, rng: Rng): void {
  switch (kind) {
    case "grass":
      g.rect(0, 0, S, S).fill(0x4d7c3a);
      speckle(g, rng, 14, [0x5c8f45, 0x40682f]);
      // a couple of upright blades so the ground reads as grass, not a colour swatch
      for (let i = 0; i < 3; i++) {
        g.rect(Math.floor(rng() * S), Math.floor(rng() * (S - 3)), 1, 2).fill(0x64994b);
      }
      break;

    case "underbrush":
      g.rect(0, 0, S, S).fill(0x39682c);
      speckle(g, rng, 10, [0x2b5322], 2);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(rng() * (S - 3));
        const y = Math.floor(rng() * (S - 3));
        g.rect(x, y, 3, 2).fill(0x2b5322);
        g.rect(x + 1, y - 1, 1, 1).fill(0x67a04a);
      }
      break;

    case "mud":
      g.rect(0, 0, S, S).fill(0x6a5336);
      for (let i = 0; i < 5; i++) {
        g.ellipse(rng() * S, rng() * S, 1.5 + rng() * 2.5, 1 + rng() * 1.5).fill(0x54412a);
      }
      speckle(g, rng, 8, [0x7d6544, 0x4a3925]);
      break;

    case "stream":
      g.rect(0, 0, S, S).fill(0x2e6b96);
      for (let i = 0; i < 4; i++) {
        g.rect(0, Math.floor(rng() * S), S, 1).fill(0x275c82);
      }
      // ripple highlights
      for (let i = 0; i < 4; i++) {
        const w = 2 + Math.floor(rng() * 4);
        g.rect(Math.floor(rng() * (S - w)), Math.floor(rng() * S), w, 1).fill(0x4b8cb8);
      }
      break;

    case "rock":
      g.rect(0, 0, S, S).fill(0x4a4a48);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(rng() * (S - 5));
        const y = Math.floor(rng() * (S - 5));
        g.poly([x, y + 4, x + 2, y, x + 5, y + 1, x + 4, y + 5]).fill(
          rng() < 0.5 ? 0x5c5c58 : 0x393937,
        );
      }
      speckle(g, rng, 6, [0x606060, 0x333331]);
      break;

    case "tree": {
      // forest floor, then a trunk and canopy so trees read as solid obstacles
      g.rect(0, 0, S, S).fill(0x2f5624);
      speckle(g, rng, 8, [0x264a1d]);
      g.rect(7, 9, 2, 6).fill(0x4a3524);
      g.circle(8, 7, 5.6).fill(0x2b5320);
      g.circle(6.5, 5.5, 3.4).fill(0x3d6f2b);
      g.circle(9.5, 6.5, 2.4).fill(0x356b26);
      break;
    }
  }
}

function drawResource(g: Graphics, kind: ResourceKind): void {
  switch (kind) {
    case "fruit":
      // three berries with a leaf
      g.circle(6, 9, 2.4).fill(0xc0392b);
      g.circle(10, 9.5, 2.2).fill(0xa93226);
      g.circle(8, 6.5, 2.3).fill(0xd6564a);
      g.circle(7.2, 5.8, 0.7).fill(0xf0a79f);
      g.ellipse(10.5, 5, 2.2, 1.2).fill(0x4f8a3a);
      break;

    case "water":
      // a droplet: triangle over a circle
      g.poly([8, 3, 11.5, 9, 4.5, 9]).fill(0x4aa3d8);
      g.circle(8, 9.5, 3.5).fill(0x4aa3d8);
      g.circle(6.6, 9.2, 1.1).fill(0xbfe4f7);
      break;

    case "ore":
      g.poly([8, 3, 11, 8, 8.6, 13, 6.6, 12.5, 5.4, 7.5]).fill(0xe8e0c8);
      g.poly([8, 4, 9.6, 8, 8.3, 12]).fill(0xc9bfa1);
      g.rect(7.8, 4, 0.9, 9).fill(0x9c9077);
      break;
  }
}

function drawCamp(g: Graphics): void {
  // clearing
  g.rect(0, 0, S, S).fill(0x6a5336);
  g.circle(8, 8, 7).fill(0x7a6144);
  // tent
  g.poly([8, 2, 14, 12, 2, 12]).fill(0x8a5a30);
  g.poly([8, 2, 11, 12, 8, 12]).fill(0x6f4726);
  g.poly([8, 6, 10, 12, 6, 12]).fill(0x3a2617);
  // firepit
  g.circle(4, 13.5, 2).fill(0x3a3128);
  g.circle(4, 13.5, 1).fill(0xe07b39);
}

function drawPlayer(g: Graphics, facing: Facing, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const east = facing.endsWith("East");
  const south = facing.startsWith("south");
  // Lean into the direction of travel so the diagonal reads at a glance.
  const lean = east ? 0.6 : -0.6;

  // legs
  g.rect(5 - swing + lean, 12, 2, 3).fill(0x33414f);
  g.rect(9 + swing + lean, 12, 2, 3).fill(0x33414f);
  // body
  g.rect(4.5 + lean, 7 + bob, 7, 5.5).fill(0x5a7d9a);
  g.rect(4.5 + lean, 7 + bob, 7, 1.5).fill(0x6b91b0);
  // trailing arm reads as the far side of the body
  g.rect((east ? 3.3 : 11.2) + lean, 8 + bob, 1.5, 3.5).fill(0x4a6a85);
  // head
  g.circle(8 + lean, 4.5 + bob, 3.2).fill(0xf0c48c);

  if (south) {
    // hair sits on the trailing side; the face is turned toward the camera
    g.rect(5 + lean, 1.6 + bob, 6, 2.2).fill(0x5a3a22);
    g.rect((east ? 4.9 : 10.1) + lean, 2.4 + bob, 2, 2.6).fill(0x5a3a22);
    const eyeX = east ? 8.4 : 6.6;
    g.rect(eyeX + lean, 4.6 + bob, 1, 1).fill(0x2a2018);
    g.rect(eyeX + (east ? 1.8 : -1.8) + lean, 4.6 + bob, 1, 1).fill(0x2a2018);
  } else {
    // walking away: the back of the head hides the face entirely
    g.circle(8 + lean, 4.2 + bob, 3.2).fill(0x5a3a22);
    g.rect((east ? 9.8 : 5.2) + lean, 3.4 + bob, 1.6, 2).fill(0x4a2e1a);
  }
}
