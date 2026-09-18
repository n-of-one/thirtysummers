/**
 * Does an edited map still hold the five-summer table?
 *
 *   npm run map:check public/maps/*.txt
 *
 * The rows themselves are `src/sim/worldgen/rows.ts`, so what a map file is
 * held to is exactly what the layout pass builds and what the tests check.
 * This is the way to read them over a file, and what to run after editing one
 * by hand.
 */
import { readFileSync } from "node:fs";
import { parseMap, MapFileError } from "../src/sim/mapfile.ts";
import { checkRows } from "../src/sim/worldgen/rows.ts";
import type { GeneratedWorld } from "../src/sim/worldgen.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: npm run map:check <file>...");
  process.exit(2);
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

  const rows = checkRows(world);
  const ok = rows.every((row) => row.ok);
  if (!ok) failed++;
  console.log(`${file}  ${world.map.width}x${world.map.height}  ${ok ? "OK" : "FAIL"}`);
  for (const row of rows) {
    const label = row.summer > 0 ? `${row.summer}: ${row.label}` : row.label;
    console.log(`  ${row.ok ? "ok  " : "FAIL"}  ${label.padEnd(50)} ${row.detail}`);
  }
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
