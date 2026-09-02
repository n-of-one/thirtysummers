import type { Renderer } from "pixi.js";
import type { AssetPack, AssetPackSource } from "./packs/pack.ts";
import { minifantasyPackSource } from "./packs/minifantasy.ts";
import { placeholderPackSource } from "./packs/placeholder.ts";

/**
 * Packs are tried in order and the first available one wins, so real art is
 * used when it is on disk and the code-drawn placeholder covers every other case.
 * The placeholder must stay last -- it is always available.
 */
const PACK_SOURCES: readonly AssetPackSource[] = [minifantasyPackSource, placeholderPackSource];

/**
 * @param prefer  pack id to force, e.g. from `?pack=placeholder`. Used to
 *                compare packs side by side and to isolate rendering cost.
 */
export async function loadAssetPack(renderer: Renderer, prefer?: string): Promise<AssetPack> {
  const sources = prefer
    ? PACK_SOURCES.filter((s) => s.id === prefer).concat(PACK_SOURCES)
    : PACK_SOURCES;
  for (const source of sources) {
    if (await source.available()) return source.load(renderer);
  }
  throw new Error("No asset pack available (the placeholder pack should never be unavailable)");
}
