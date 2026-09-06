import type { TerrainKind } from "./types.ts";
import { TERRAIN, TERRAIN_ID, TERRAIN_ORDER, type TerrainDef } from "./terrain.ts";

/**
 * A stack of terrain layers.
 *
 * The prototype only ever generates layer 0, but every accessor takes a `z`
 * so that adding real z-levels later is additive rather than a rewrite.
 * Out-of-bounds reads return `rock`, which makes the world implicitly sealed
 * and means collision code never needs its own bounds checks.
 */
export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  private readonly data: Uint8Array;

  constructor(width: number, height: number, layers = 1) {
    this.width = width;
    this.height = height;
    this.layers = layers;
    this.data = new Uint8Array(width * height * layers);
  }

  private index(x: number, y: number, z: number): number {
    return (z * this.height + y) * this.width + x;
  }

  inBounds(x: number, y: number, z = 0): boolean {
    return (
      x >= 0 && y >= 0 && z >= 0 &&
      x < this.width && y < this.height && z < this.layers
    );
  }

  get(x: number, y: number, z = 0): TerrainKind {
    if (!this.inBounds(x, y, z)) return "rock";
    return TERRAIN_ORDER[this.data[this.index(x, y, z)]!]!;
  }

  set(x: number, y: number, kind: TerrainKind, z = 0): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = TERRAIN_ID[kind];
  }

  def(x: number, y: number, z = 0): TerrainDef {
    return TERRAIN[this.get(x, y, z)];
  }

  isPassable(x: number, y: number, z = 0): boolean {
    return this.def(x, y, z).passable;
  }

  /** Terrain at a floating-point world position (tile units). */
  defAt(wx: number, wy: number, z = 0): TerrainDef {
    return this.def(Math.floor(wx), Math.floor(wy), z);
  }

  /**
   * An independent copy. Used where a rule has to be run as a question rather
   * than as a change: "how many tiles would thickening move" is asked of a copy
   * so that asking it does not move any.
   */
  clone(): TileMap {
    const copy = new TileMap(this.width, this.height, this.layers);
    copy.data.set(this.data);
    return copy;
  }

  /** Raw ids for one layer -- used by tests and the renderer's fast paths. */
  layerData(z = 0): Uint8Array {
    const size = this.width * this.height;
    return this.data.subarray(z * size, (z + 1) * size);
  }

  /** Count of each terrain kind on a layer. Used by tests and the map dump. */
  histogram(z = 0): Record<TerrainKind, number> {
    const out = Object.fromEntries(
      TERRAIN_ORDER.map((k) => [k, 0]),
    ) as Record<TerrainKind, number>;
    for (const id of this.layerData(z)) out[TERRAIN_ORDER[id]!]++;
    return out;
  }
}
