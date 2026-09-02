/**
 * Headless map inspection: renders a generated world as ASCII so terrain can be
 * eyeballed before any rendering code exists.
 *
 *   npm run map            -- default seed, full map
 *   npm run map -- 42      -- seed 42
 *   npm run map -- 42 60   -- seed 42, cropped to a 60x60 window around camp
 */
import { generateWorld } from "../src/sim/worldgen.ts";
import { TERRAIN } from "../src/sim/terrain.ts";
import type { ResourceKind } from "../src/sim/types.ts";
import * as C from "../src/config.ts";

const seed = Number(process.argv[2] ?? C.DEFAULT_SEED);
const crop = process.argv[3] ? Number(process.argv[3]) : 0;

const t0 = performance.now();
const world = generateWorld(seed);
const elapsed = performance.now() - t0;

const RESOURCE_GLYPH: Record<ResourceKind, string> = {
  fruit: "f",
  water: "w",
  ore: "v",
};

const overlay = new Map<number, string>();
for (const node of world.nodes) {
  overlay.set(
    Math.floor(node.y) * world.map.width + Math.floor(node.x),
    RESOURCE_GLYPH[node.kind],
  );
}
overlay.set(
  Math.floor(world.camp.y) * world.map.width + Math.floor(world.camp.x),
  "C",
);

const half = crop > 0 ? Math.floor(crop / 2) : 0;
const x0 = crop > 0 ? Math.max(0, Math.floor(world.camp.x) - half) : 0;
const y0 = crop > 0 ? Math.max(0, Math.floor(world.camp.y) - half) : 0;
const x1 = crop > 0 ? Math.min(world.map.width, x0 + crop) : world.map.width;
const y1 = crop > 0 ? Math.min(world.map.height, y0 + crop) : world.map.height;

const lines: string[] = [];
for (let y = y0; y < y1; y++) {
  let row = "";
  for (let x = x0; x < x1; x++) {
    const idx = y * world.map.width + x;
    row += overlay.get(idx) ?? TERRAIN[world.map.get(x, y)].glyph;
  }
  lines.push(row);
}
console.log(lines.join("\n"));

const hist = world.map.histogram();
const total = world.map.width * world.map.height;
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
const reachableCount = world.reachable.reduce((a, b) => a + b, 0);
const passableCount = Object.entries(hist)
  .filter(([k]) => TERRAIN[k as keyof typeof TERRAIN].passable)
  .reduce((a, [, n]) => a + n, 0);

const counts: Record<string, number> = {};
for (const n of world.nodes) counts[n.kind] = (counts[n.kind] ?? 0) + 1;

console.log(`
seed ${seed}   ${world.map.width}x${world.map.height}   generated in ${elapsed.toFixed(1)}ms

terrain    ${Object.entries(hist).map(([k, n]) => `${k} ${pct(n)}`).join("   ")}
passable   ${pct(passableCount)}   reachable from camp ${pct(reachableCount)}  (${((reachableCount / passableCount) * 100).toFixed(1)}% of passable)
camp       (${Math.floor(world.camp.x)}, ${Math.floor(world.camp.y)})
resources  ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join("   ")}

legend     . grass   , underbrush   ~ mud   T tree   = stream   # rock
           C camp    f fruit   w water   v ore`);
