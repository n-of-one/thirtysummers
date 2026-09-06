/**
 * Headless map inspection: renders a generated world as ASCII so terrain can be
 * eyeballed, and so an edited copy can be played.
 *
 *   npm run map                      -- default seed, full map
 *   npm run map -- 42                -- seed 42
 *   npm run map -- 42 60             -- seed 42, cropped to 60x60 around camp
 *   npm run map -- 42 > public/maps/a.txt
 *
 * The map goes to stdout and everything about it to stderr, so that last form
 * writes a file the loader can read back rather than a file with a paragraph of
 * statistics stuck on the end. A crop is for looking at, not for playing: it
 * moves the camp and cuts the border.
 */
import { formatMap, mapLegend } from "../src/sim/mapfile.ts";
import { generateWorld } from "../src/sim/worldgen.ts";
import { TERRAIN } from "../src/sim/terrain.ts";
import * as C from "../src/config.ts";

const seed = Number(process.argv[2] ?? C.DEFAULT_SEED);
const crop = process.argv[3] ? Number(process.argv[3]) : 0;

const t0 = performance.now();
const world = generateWorld(seed);
const elapsed = performance.now() - t0;

const text = formatMap(world);
if (crop > 0) {
  const half = Math.floor(crop / 2);
  const x0 = Math.max(0, Math.floor(world.camp.x) - half);
  const y0 = Math.max(0, Math.floor(world.camp.y) - half);
  const lines = text.split("\n").slice(y0, y0 + crop);
  console.log(lines.map((line) => line.slice(x0, x0 + crop)).join("\n"));
} else {
  process.stdout.write(text);
}

const hist = world.map.histogram();
const total = world.map.width * world.map.height;
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
const reachableCount = world.reachable.reduce((a, b) => a + b, 0);
const passableCount = Object.entries(hist)
  .filter(([k]) => TERRAIN[k as keyof typeof TERRAIN].passable)
  .reduce((a, [, n]) => a + n, 0);

const counts: Record<string, number> = {};
for (const n of world.nodes) counts[n.kind] = (counts[n.kind] ?? 0) + 1;

console.error(`
seed ${seed}   ${world.map.width}x${world.map.height}   generated in ${elapsed.toFixed(1)}ms

terrain    ${Object.entries(hist)
  .filter(([, n]) => n > 0)
  .map(([k, n]) => `${k} ${pct(n)}`)
  .join("   ")}
passable   ${pct(passableCount)}   reachable from camp ${pct(reachableCount)}  (${((reachableCount / passableCount) * 100).toFixed(1)}% of passable)
camp       (${Math.floor(world.camp.x)}, ${Math.floor(world.camp.y)})
resources  ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join("   ")}

legend     ${mapLegend()}`);
