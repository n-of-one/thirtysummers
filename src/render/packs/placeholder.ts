import { Container, Graphics, Rectangle, type Renderer, type Texture } from "pixi.js";
import { TRAIL_STAGES } from "../../config.ts";
import { mulberry32, type Rng } from "../../sim/rng.ts";
import { RESOURCE_KINDS } from "../../sim/resources.ts";
import { TERRAIN_ORDER } from "../../sim/terrain.ts";
import { FACINGS } from "../../sim/types.ts";
import type { Facing, ResourceKind, TerrainKind } from "../../sim/types.ts";
import { DROPPED_ART_SHARE, DROPPED_SHADOW_ALPHA } from "./pack.ts";
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
  /** Per trail stage, from trodden to flat, its variants. */
  private readonly troddenTiles: Texture[][];
  private readonly resources = new Map<ResourceKind, Texture>();
  private readonly droppedArt = new Map<ResourceKind, PropSprite>();
  private readonly walks = new Map<Facing, Texture[]>();
  readonly camp: PropSprite;
  readonly spring: PropSprite;
  readonly well: PropSprite;

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
    this.troddenTiles = Array.from({ length: TRAIL_STAGES }, (_, i) => {
      const rng = mulberry32(hashString(`trodden${i + 1}`));
      return Array.from({ length: VARIANTS }, () => this.bake((g) => drawTrodden(g, rng, i + 1)));
    });
    for (const kind of RESOURCE_KINDS) {
      this.resources.set(kind, this.bake((g) => drawResource(g, kind)));
      this.droppedArt.set(kind, this.bakeDropped(kind));
    }
    this.camp = { texture: this.bake(drawCamp), anchorX: 0.5, anchorY: 0.5, bounds: WHOLE_TILE };
    this.spring = { texture: this.bake(drawSpring), anchorX: 0.5, anchorY: 0.5, bounds: WHOLE_TILE };
    this.well = { texture: this.bake(drawWell), anchorX: 0.5, anchorY: 0.5, bounds: WHOLE_TILE };
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

  /**
   * A dropped one: the same drawing with {@link DROPPED_ART_SHARE} of the cell.
   *
   * The placeholder's art is vector rather than pixels, so it is redrawn three
   * quarters the size into three quarters of the cell instead of being
   * resampled the way a real pack's is. Either way the cell is a whole number
   * of art pixels and the sprite is never scaled on its way to the screen.
   */
  private bakeDropped(kind: ResourceKind): PropSprite {
    const cell = Math.round(S * DROPPED_ART_SHARE);
    const g = new Graphics();
    g.scale.set(DROPPED_ART_SHARE);
    g.position.set((S - cell) / 2, 0);
    drawResource(g, kind);

    // Fitted to what the art actually draws, not to its cell: these cells are
    // mostly empty, and a shadow sized to one is a puddle the item floats on.
    const drawn = g.getLocalBounds();
    const left = g.position.x + drawn.x * DROPPED_ART_SHARE;
    const right = left + drawn.width * DROPPED_ART_SHARE;
    const foot = g.position.y + (drawn.y + drawn.height) * DROPPED_ART_SHARE;
    const shadow = new Graphics();
    shadow
      .ellipse((left + right) / 2, foot, (right - left) / 2 + 1, 2)
      .fill({ color: 0x000000, alpha: DROPPED_SHADOW_ALPHA });

    // The shadow first, so the item is drawn over it.
    const group = new Container();
    group.addChild(shadow, g);
    const texture = this.renderer.generateTexture({
      target: group,
      frame: new Rectangle(0, 0, S, Math.ceil(foot) + 2),
      resolution: 1,
      antialias: false,
      textureSourceOptions: { scaleMode: "nearest" },
    });
    group.destroy({ children: true });
    this.made.push(texture);
    return { texture, anchorX: 0.5, anchorY: 1, bounds: WHOLE_TILE };
  }

  /** The placeholder draws each terrain whole, so it ignores the autotile mask. */
  ground(kind: TerrainKind, _mask: number, variant: number, _frame: number): Texture {
    const variants = this.terrains.get(kind)!;
    return variants[variant % variants.length]!;
  }
  trodden(stage: number, _mask: number, variant: number): Texture {
    const variants = this.troddenTiles[Math.min(stage, TRAIL_STAGES) - 1]!;
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
  dropped(kind: ResourceKind): PropSprite {
    return this.droppedArt.get(kind)!;
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

    case "thicket": {
      // Denser and darker than underbrush, and drawn to the tile edges: what
      // makes underbrush read as passable is the ground showing through it.
      g.rect(0, 0, S, S).fill(0x1f3b18);
      speckle(g, rng, 14, [0x162c11, 0x2a5020], 3);
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(rng() * S);
        const y = Math.floor(rng() * S);
        // brambles: a short diagonal with a thorn on it
        g.rect(x, y, 1, 3).fill(0x14290f);
        g.rect(x + 1, y + 1, 2, 1).fill(0x14290f);
        g.rect(x + 2, y, 1, 1).fill(0x4d7a35);
      }
      break;
    }

    case "bridge": {
      // planks across the tile, gaps between them showing dark water
      g.rect(0, 0, S, S).fill(0x2a4d68);
      for (let i = 0; i < 4; i++) {
        g.rect(0, i * 4, S, 3).fill(i % 2 === 0 ? 0x7a5433 : 0x8a6039);
      }
      speckle(g, rng, 10, [0x694627, 0x9a6f45]);
      // rails along the two long edges, so a bridge reads as built, not painted
      g.rect(0, 0, S, 1).fill(0x5c3d22);
      g.rect(0, S - 1, S, 1).fill(0x5c3d22);
      break;
    }

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

    case "sapling": {
      // open grass with a young tree on it: thinner and paler than a grown
      // one, so a copse of them reads as something an axe could clear
      g.rect(0, 0, S, S).fill(0x4d7c3a);
      speckle(g, rng, 10, [0x5c8f45, 0x40682f]);
      g.rect(7.5, 8, 1, 7).fill(0x7a5a3a);
      g.circle(8, 6, 3.6).fill(0x7fae4a);
      g.circle(6.8, 5, 1.6).fill(0x9cc862);
      break;
    }
  }
}

/**
 * Underbrush worn by walking, one look per stage: the colour further from the
 * brush each time, fewer clumps standing and more bare earth showing where the
 * feet went. Flat keeps flecks of the brush's own dark green, so it still
 * reads as underbrush pressed down rather than as grass.
 */
const TRODDEN_LOOK = [
  { fill: 0x437234, clumps: 2, earth: 6 },
  { fill: 0x4a7636, clumps: 1, earth: 9 },
  { fill: 0x547838, clumps: 0, earth: 12 },
] as const;

function drawTrodden(g: Graphics, rng: Rng, stage: number): void {
  const look = TRODDEN_LOOK[Math.min(stage, TRODDEN_LOOK.length) - 1]!;
  g.rect(0, 0, S, S).fill(look.fill);
  speckle(g, rng, 8, [0x5c8f45, 0x2b5322]);
  speckle(g, rng, look.earth, [0x6a5a3a], 2);
  for (let i = 0; i < look.clumps; i++) {
    const x = Math.floor(rng() * (S - 3));
    const y = 1 + Math.floor(rng() * (S - 4));
    g.rect(x, y, 3, 2).fill(0x2b5322);
    g.rect(x + 1, y - 1, 1, 1).fill(0x67a04a);
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

    case "ore":
      g.poly([8, 3, 11, 8, 8.6, 13, 6.6, 12.5, 5.4, 7.5]).fill(0xe8e0c8);
      g.poly([8, 4, 9.6, 8, 8.3, 12]).fill(0xc9bfa1);
      g.rect(7.8, 4, 0.9, 9).fill(0x9c9077);
      break;

    case "vine":
      // a coil of creeper, bright against the mud it grows in
      g.ellipse(8, 9, 5, 4).fill(0x6f9c3a);
      g.ellipse(8, 9, 2.6, 2).fill(0x3f5f22);
      g.rect(7.5, 3, 1, 5).fill(0x6f9c3a);
      g.ellipse(5.6, 5.4, 2, 1.2).fill(0x8bbf4c);
      g.ellipse(10.4, 4.6, 2, 1.2).fill(0x8bbf4c);
      break;

    case "stick":
      // three cut lengths of branch, stacked
      g.rect(3, 6, 10, 2).fill(0x8a6039);
      g.rect(3.5, 9, 9, 2).fill(0x9c6e42);
      g.rect(4.5, 12, 7, 1.5).fill(0x74502e);
      g.rect(3, 6, 1.5, 2).fill(0xc0a071);
      g.rect(11, 9, 1.5, 2).fill(0xc0a071);
      break;

    case "feather":
      // a white quill, slanted, with a dark shaft
      g.poly([4, 13, 10, 3, 12, 4, 7, 12]).fill(0xf2f0e6);
      g.rect(5, 11, 1, 3).fill(0x6b5a45);
      g.poly([5, 12, 11, 3.5, 11.5, 4]).fill(0xb9b4a4);
      break;

    case "log":
      // one thick length of trunk, its cut end showing rings
      g.rect(3, 6, 10, 6).fill(0x6e4a2b);
      g.rect(3, 6, 10, 1.5).fill(0x86603a);
      g.ellipse(12.5, 9, 2.2, 3).fill(0xd1a86e);
      g.ellipse(12.5, 9, 1, 1.5).fill(0x9c7447);
      break;

    case "shell":
      // a pale fan with ribs
      g.poly([8, 12, 3, 7, 5, 4, 8, 3, 11, 4, 13, 7]).fill(0xf0d6c2);
      for (const x of [5.5, 8, 10.5]) g.poly([8, 12, x - 0.5, 4, x + 0.5, 4]).fill(0xc99a86);
      g.rect(7, 12, 2, 1.5).fill(0xc99a86);
      break;
  }
}

/** A well: a ring of stone round dark water. */
function drawWell(g: Graphics): void {
  g.circle(8, 9, 5.5).fill(0x8a8a84);
  g.circle(8, 9, 3.6).fill(0x2a4d68);
  g.circle(7, 8, 1).fill(0x4aa3d8);
  g.rect(2.5, 2, 1.5, 7).fill(0x6e4a2b);
  g.rect(12, 2, 1.5, 7).fill(0x6e4a2b);
  g.rect(2.5, 2, 11, 1.5).fill(0x86603a);
}

/** A spring on the bank: a droplet. */
function drawSpring(g: Graphics): void {
  g.poly([8, 3, 11.5, 9, 4.5, 9]).fill(0x4aa3d8);
  g.circle(8, 9.5, 3.5).fill(0x4aa3d8);
  g.circle(6.6, 9.2, 1.1).fill(0xbfe4f7);
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
