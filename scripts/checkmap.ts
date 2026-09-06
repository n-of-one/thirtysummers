/**
 * Does an edited map hold the chain?
 *
 *   npm run map:check public/maps/*.txt
 *
 * The discovery test rests on one structure: each barrier's reward is the key
 * to the next. Vines are reachable on foot, sticks only once the thicket has
 * been cut, gold only once the stream has been bridged. Editing that by hand
 * into a generated dump is easy to get subtly wrong -- one stray ford, one gap
 * in a thicket ring -- and the failure is invisible until someone plays it and
 * simply walks to the gold.
 *
 * So the fill is run three times, as the player is, then as if the thicket were
 * not there, then as if the stream were not there, and the three answers are
 * compared with what the chain requires. It also re-runs stream thickening on a
 * copy: a stream edited down to one tile across is a stream with a hole in it,
 * and the generator's own rule is the measure of that.
 */
import { readFileSync } from "node:fs";
import { parseMap, MapFileError } from "../src/sim/mapfile.ts";
import { thickenStream } from "../src/sim/worldgen/water.ts";
import { reachableFrom } from "../src/sim/worldgen/reachability.ts";
import type { TileMap } from "../src/sim/tilemap.ts";
import type { GeneratedWorld } from "../src/sim/worldgen.ts";
import type { ResourceKind, TerrainKind, Vec2 } from "../src/sim/types.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: npm run map:check <file>...");
  process.exit(2);
}

/** Reachability with `open` treated as walkable on top of the usual rules. */
function reach(map: TileMap, camp: Vec2, open?: TerrainKind): Uint8Array {
  return reachableFrom(map, camp, 0, (x, y) =>
    map.isPassable(x, y) || (open !== undefined && map.get(x, y) === open),
  );
}

/** How many nodes of `kind` stand on tiles the mask says can be got to. */
function countReachable(world: GeneratedWorld, mask: Uint8Array, kind: ResourceKind): number {
  let n = 0;
  for (const node of world.nodes) {
    if (node.kind !== kind) continue;
    if (mask[Math.floor(node.y) * world.map.width + Math.floor(node.x)]) n++;
  }
  return n;
}

function count(world: GeneratedWorld, kind: ResourceKind): number {
  return world.nodes.filter((node) => node.kind === kind).length;
}

/** How many tiles the generator's own thickening rule would still change. */
function pinches(world: GeneratedWorld): number {
  return thickenStream(world.map.clone());
}

let failed = 0;

for (const file of files) {
  let world: GeneratedWorld;
  try {
    world = parseMap(readFileSync(file, "utf8"));
  } catch (error) {
    console.log(`${file}\n  FAIL  ${error instanceof MapFileError ? error.message : error}\n`);
    failed++;
    continue;
  }

  const onFoot = reach(world.map, world.camp);
  const cutThrough = reach(world.map, world.camp, "thicket");
  const acrossWater = reach(world.map, world.camp, "stream");

  const checks: [label: string, ok: boolean, detail: string][] = [
    [
      "vines reachable on foot",
      countReachable(world, onFoot, "vine") > 0,
      `${countReachable(world, onFoot, "vine")} of ${count(world, "vine")}`,
    ],
    [
      "sticks need the thicket cut",
      countReachable(world, onFoot, "stick") === 0 &&
        countReachable(world, cutThrough, "stick") > 0,
      `${countReachable(world, onFoot, "stick")} on foot, ` +
        `${countReachable(world, cutThrough, "stick")} once cut, of ${count(world, "stick")}`,
    ],
    [
      "gold needs the stream bridged",
      countReachable(world, cutThrough, "ore") === 0 &&
        countReachable(world, acrossWater, "ore") > 0,
      `${countReachable(world, cutThrough, "ore")} without a bridge, ` +
        `${countReachable(world, acrossWater, "ore")} with one, of ${count(world, "ore")}`,
    ],
    ["stream is nowhere one tile across", pinches(world) === 0, `${pinches(world)} pinched tiles`],
  ];

  const ok = checks.every(([, pass]) => pass);
  if (!ok) failed++;
  console.log(`${file}  ${world.map.width}x${world.map.height}  ${ok ? "OK" : "FAIL"}`);
  for (const [label, pass, detail] of checks) {
    console.log(`  ${pass ? "ok  " : "FAIL"}  ${label.padEnd(34)} ${detail}`);
  }
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
