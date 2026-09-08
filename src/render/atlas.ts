import type { Renderer } from "pixi.js";
import { isDevHost } from "../env.ts";
import type { AssetPack, AssetPackSource } from "./packs/pack.ts";
import { bakedPackSource } from "./packs/baked.ts";
import { placeholderPackSource } from "./packs/placeholder.ts";

/**
 * Which packs to try, in order, and the first available one wins.
 *
 * The dev machine prefers the raw art, so changing where a tile is cut from
 * shows up on a reload with no bake in between. Nowhere else can reach it: the
 * public build starts at the baked file, and the placeholder is last in both
 * and always available, so a fresh clone with neither the art nor a bake runs.
 *
 * Two separate questions decide this, and both have to say yes. `isDevHost()`
 * asks it at run time. `import.meta.env.DEV` asks it at build time, and is a
 * constant Rollup folds away: in a built game the branch below is dead code and
 * the whole raw loader goes with it, so a shipped bundle carries none of the
 * sheet paths or tile coordinates that would let it be pointed at the art.
 * Licence hygiene is the point, and one runtime check is a thinner guarantee
 * than a module that is not there.
 */
export async function packSources(dev = isDevHost()): Promise<readonly AssetPackSource[]> {
  if (import.meta.env.DEV && dev) {
    const { minifantasyPackSource } = await import("./packs/minifantasy.ts");
    return [minifantasyPackSource, bakedPackSource, placeholderPackSource];
  }
  return [bakedPackSource, placeholderPackSource];
}

/**
 * @param prefer  pack id to force, e.g. from `?pack=placeholder`. Used to
 *                compare packs side by side and to isolate rendering cost.
 */
export async function loadAssetPack(renderer: Renderer, prefer?: string): Promise<AssetPack> {
  const available = await packSources();
  const sources = prefer ? available.filter((s) => s.id === prefer).concat(available) : available;
  for (const source of sources) {
    if (await source.available()) return source.load(renderer);
  }
  throw new Error("No asset pack available (the placeholder pack should never be unavailable)");
}
