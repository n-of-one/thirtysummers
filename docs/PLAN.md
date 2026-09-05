# thirtysummers — build plan

How the game in [DESIGN.md](DESIGN.md) gets built. Why the choices below were
made is in [RATIONALE.md](RATIONALE.md); this document is only what to do.

**Status: the summer phase plays end to end. The discovery test, the one
milestone this phase needs, is planned and not started.**

Scope so far: the summer phase only. One flat map, one 15-minute summer,
walk around collecting fruit / water / ore while stamina and hydration drain,
deposit ore at camp for gold. The discovery test adds the first terrain
changes and a second summer on the same map. What it is testing and why is in
[BRAINSTORM.md](BRAINSTORM.md); read that before touching it.

Vocabulary, decided 5 Sep 2026: the phases are summer and winter. "Day" and
"night" are on their way out. The discovery test renames only what the player
sees; the identifiers go when winter is built.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript | 7.0.2 |
| Build / dev server | Vite | 8.2.2 |
| Renderer | PixiJS | 8.20.1 |
| Noise | simplex-noise | 4.0.3 |
| PRNG | hand-written mulberry32 (`sim/rng.ts`) | — |
| Tests | Vitest | 4.1.11 |
| Runtime | Node 22 LTS | 22.23.2 |

Four dependencies total. Keep it that way.

## Fixed decisions

| | |
|---|---|
| Projection | Top-down orthogonal; z-levels later are discrete stacked layers viewed one at a time |
| Movement | Free and continuous, tile grid underneath for collision and terrain cost |
| Map | 128×128 tiles, `TILE = 64` screen px, 8px source art (8× scale) |
| HUD | HTML/CSS overlay on top of the canvas |
| Art | Minifantasy, behind a swappable pack layer |
| Hosting | Localhost only |

## What is built

Seven milestones, M0 to M6, delivered the summer phase. What they left behind,
as it stands today:

**Worldgen, seeded and headless.** Simplex noise thresholded into grass /
underbrush / tree, a second octave for mud, a noise-band stream, a rock border,
camp on grass near the centre, and resource nodes scattered by terrain. The
stream is thickened so it is nowhere one tile across, and fords are carved so
camp can reach everything. `npm run map` dumps the result as ASCII.

**Two rendered layers over that map.** A culled sprite-pool ground renderer and
a y-sorted prop layer, both driven through an `AssetPack` interface: the real
Minifantasy art when the gitignored folder is present, a code-drawn placeholder
pack when it is not. Full 15-tile autotiling for mud, rock, water and
undergrowth, extended with seven narrow shapes the 3×5 blocks cannot express.
Trees and underbrush autotile as one surface; the player is drawn behind trees
and re-drawn on top as a black silhouette masked to the covered pixels.

**Movement on a fixed timestep.** WASD or arrows, AABB collision against
impassable tiles, terrain speed multipliers, sprint, a camera that follows with
lag and clamps to the map, a walk animation on four diagonal facings, and props
snapped to the art-pixel grid.

**Stats, inventory and HUD.** `sim/stats.ts` implements the design doc's stamina
and hydration rules exactly, with the full-stomach cooldown; `sim/inventory.ts`
holds the ten-slot backpack and the banked gold; `ui/hud.ts` binds all of it,
plus the clock, to the markup in `index.html`. `EXHAUSTED_SPEED_MUL` is wired
and sits at 1.0, so exhaustion currently costs only the sprint.

**The loop itself.** Harvest on proximity by holding E, eat fruit with F, drink
water with R, bank ore at camp, and an end-of-day summary with the gold total.
Everything the simulation does is recorded in `world.events`, an append-only log
the toasts, the summary and the prop layer each walk with their own cursor. The
prompt and the toasts hang off the player rather than off a corner; the keys for
fruit and water are spelled out in the bottom right, and only once there is
something to use them on.

Controls: WASD or arrows to move, Shift to sprint, E or Space to gather and to
bank ore, F to eat, R to drink.

**A debug overlay**, on backtick or `?debug=1`: seed box and regenerate, `[` and
`]` to step seeds, a 1x–10x time scale, a tile grid, a stat freeze,
click-to-teleport, and a fixed-width readout of the numbers the frame was drawn
with. Regenerating reseeds in place rather than reloading the page.

## Layout

The hard rule: **nothing under `src/sim/` imports Pixi or touches the DOM.**

```
src/
  config.ts          ALL tunable numbers, one file
  frameClock.ts      real elapsed time → whole fixed steps; clamps a stalled tab
  sim/                        ← pure TypeScript, no renderer, no DOM
    types.ts           TerrainKind, ResourceKind, Facing, Vec2
    rng.ts             mulberry32, hash2d, shuffle
    terrain.ts         terrain table: passable, difficult, speedMul
    tilemap.ts         TileMap: get(x,y,z), isPassable, terrainAt; z-indexed from day one
    player.ts          position, facing, collision, per-axis moving flags
    stats.ts           stamina, hydration, full-stomach cooldown
    inventory.ts       the ten-slot backpack, and gold banked at camp
    interaction.ts     what is in reach: nearest node, nearest tile of a kind, distance to camp
    summary.ts         the summer counted up from the event log
    mapfile.ts         [new] text map format: parseMap / formatMap, one char per tile
    world.ts           owns everything; world.step(dt, input); nextSummer()
    worldgen.ts        seed → GeneratedWorld; what order the steps run in, and why
    worldgen/
      grid.ts            y*width+x arithmetic, 4-neighbour offsets
      terrain.ts         noise → tiles; camp placement
      water.ts           stream thickening, ford carving
      reachability.ts    flood fill from camp
      resources.ts       scattering fruit / water / ore by terrain
  render/                     ← Pixi only
    app.ts             Pixi Application bootstrap, nearest-neighbour scaling
    camera.ts          follows player with lag, clamps to map bounds
    scrollWindow.ts    the tile window both layers scroll; no Pixi, so testable
    placements.ts      what stands where in the world, as data, before any sprite
    packs/pack.ts      AssetPack interface
    packs/autotile.ts  8-neighbour mask → tile index, narrow shapes included
    packs/placeholder.ts  code-drawn textures, used when the art is absent
    packs/minifantasy.ts  loads the real art
    packs/minifantasy.sheets.ts  where that art sits on disk, and nothing else
    tileLayer.ts       culled sprite-pool ground renderer, autotiled
    propLayer.ts       y-sorted props + player, pixel snapping
    silhouette.ts      the player redrawn flat where a canopy covers them
  input/keyboard.ts    keydown/keyup → InputState; NO_INPUT for tests
  ui/hud.ts            world state → the markup in index.html; toasts, day summary
  ui/hud.css           HUD styling (markup lives in index.html)
  debug/overlay.ts     seed, time scale, grid, freeze, teleport; hidden until ```
  main.ts              wires it together
scripts/
  dumpmap.ts           npm run map: map to stdout, stats to stderr
  checkmap.ts          [new] npm run map:check <file>: does the chain hold?
tests/                 17 files, 225 tests
  stubPack.ts          an AssetPack that draws nothing and records everything
public/assets/minifantasy/   real art — GITIGNORED
public/maps/           [new] edited map dumps for the discovery test; the designer does not open them
docs/PLAYTEST.md       [new] one entry per play session
```

## Rules to build to

- **Rendering only ever reads simulation state.** It never writes to it. What
  the simulation did this tick reaches the HUD through `world.events`, an
  append-only log each reader walks with its own cursor.
- **The simulation advances in fixed `TICK_SEC` steps.** Accumulator in
  `frameClock.ts`: render on `requestAnimationFrame`, step for each whole tick
  accrued, clamp the frame so a backgrounded tab cannot spiral. Anything asking
  "is this moving" reads a flag the tick wrote, never a diff between draws.
- **Relative imports carry an explicit `.ts` extension**, so the same source runs
  under Vite, Vitest and bare `node --experimental-strip-types`.
- **`src/config.ts` holds every tunable**, marked `[DOC]` or `[GUESS]`.
- **Tile rendering is bound to screen size, not map size** — a sprite pool
  covering the viewport plus a margin, repositioned and re-textured as the camera
  moves.
- **Z-level readiness without building it.** `TileMap` is z-indexed and the
  layers take a layer index; worldgen only ever produces layer 0.
- **Nothing outside `render/packs/` knows Minifantasy exists.** The art is never
  committed; `placeholderPack` keeps a fresh clone runnable without it.

## Tunables

From the design doc, do not change without changing the doc: `DAY_LENGTH_SEC 900`,
`BACKPACK_CAPACITY 10`, `FRUIT_STAMINA 20`, `WATER_HYDRATION 50`,
`FULL_STOMACH_SEC 60`, `ORE_GOLD 1`, `STAMINA_SPRINT -5.0`,
`STAMINA_DIFFICULT -1.0`, `STAMINA_WALK_EASY 0.2`,
`STAMINA_STAND_HYDRATED 1.0`, `STAMINA_STAND_PARCHED 0.5`,
`HYDRATION_DRAIN 1.0`, `HYDRATION_LOW_THRESHOLD 50`.

Filled in where the design doc is silent: `SPRINT_MIN_STAMINA 5`, because an
empty bar gated on `> 0` flickers in and out of a sprint one tick at a time. So
is the rule that one stamina rate applies per tick rather than the sum, which is
why sprinting through mud costs 5%/s and not 6%/s. And hydration of exactly 50%
counts as parched, since the doc rules on either side of 50 and not on 50.

Hand-tuned during play — current values are intentional, not suggestions:
`WALK_SPEED 7`, `DIFFICULT_SPEED_MUL 0.4`, `SPRINT_MULTIPLIER 1.8`,
`PLAYER_RADIUS 0.3`, `TILE 64`.

What `HYDRATION_DRAIN 1.0` costs, now that it is a doc value: a full bar lasts
100 seconds, so a 900-second day takes nine bars. Water restores half a bar, so
staying watered all day means drinking 18 of the 45 water nodes on the map, and
finding them. Hydration now drives routing, which is what it was raised for.

The discovery test adds, from the design doc: `SUMMER_LENGTH_SEC 300` (replaces
`DAY_LENGTH_SEC`), `BRIDGE_STICKS 1`, `BRIDGE_VINES 1`. Guesses to tune in
play: `CUT_TIME` and `BUILD_TIME` in seconds (start around 1.5 and 2),
`CUT_LEAVES`, the terrain a cut thicket tile becomes (start with `grass`, so a
cut path is a fast path; `underbrush` is the other candidate).

## The discovery test

The one milestone this phase needs, and it is not started. The smallest game
that can answer "when I broke through, did I feel anything?" One 5-minute
summer on a map loaded from a text file, a thicket the knife cuts, a stream a
bridge crosses, vines and sticks as the bridge's materials, gold only across
the stream, and a button for another summer on the same map with every change
kept. No winter, no gravel, no cache, no hazards. `DESIGN.md` has the rules
under "Prototype, phase 2"; `BRAINSTORM.md` has the reasoning.

It ends in something runnable, and it stops there for verification before
anything beyond it starts.

### Decisions made in planning

Overrule them in the doc before building, not in the code.

- A cut thicket tile becomes `CUT_LEAVES` (grass), so a cut path is a fast
  path.
- Cut and build target the nearest thicket or stream tile within
  `INTERACT_RADIUS`, the way harvesting targets the nearest node. Facings are
  diagonal, so "the tile in front" has no clean meaning.
- A bridge tile costs `BRIDGE_STICKS` sticks and `BRIDGE_VINES` vines. A vine
  node yields one vine, a tree-stand node one stick, harvested like ore.
- "Next summer" keeps the map, every cut and bridge, gold and the backpack.
  Every resource node regrows. Stats refill, the player returns to camp, the
  clock restarts, the year counts up.
- The knife is implicit. Nothing represents it; the prompt offers to cut.
- Only user-visible strings and the length constant change from day to
  summer. Identifiers such as `dayOver` wait for the winter milestone.

### The work, in the order to do it

1. **Terrain.** Add `thicket` (impassable, glyph `%`) and `bridge` (passable,
   easy, glyph `-`) to `TerrainKind`, `TERRAIN` and the *end* of
   `TERRAIN_ORDER`; the grid stores the index. In `tileLayer.ts`, `surfaceOf`
   folds thicket into the underbrush surface with trees, so a thicket wall
   autotiles into the wood around it; bridge is its own surface and the dirt
   block's narrow shapes already draw a one-tile strip. Minifantasy: thicket
   ground is the brush block with a bush prop on *every* tile (the 45% gap is
   what makes underbrush read as passable); bridge ground is the dirt block.
   Placeholder: a dense dark thicket, brown planks. Add
   `TileLayer.invalidate()` on the pattern of `PropLayer.invalidate`: the pool
   only re-textures when the camera crosses a tile boundary, so a cut tile
   would otherwise stay drawn until the player walked.
2. **Resources.** Add `vine` and `stick` to `ResourceKind` and
   `RESOURCE_KINDS`; the inventory record, `RESOURCE_NAME` and the summary rows
   in `hud.ts`, both packs' `resource()`, and the dump glyphs (`y` vine, `s`
   stick) follow. Minifantasy sprites: vine from the crafting pack's
   `FibresPlants` sheet, stick from its `Logging` sheet, registered in
   `minifantasy.sheets.ts` with cell positions decoded from pixels, as the
   existing sprites were. They must read across a barrier; check on screen.
3. **Cutting and building.** `nearestTileWithin(map, x, y, kind, radius)` in
   `interaction.ts`, ties on the lower index. `Action` gains
   `{ type: "cut"; x; y }` and `{ type: "build"; x; y; blocked }`;
   `availableAction` order is bank ore at camp, harvest a node, cut a thicket,
   build on stream, blocked bank at camp. Build is blocked without the
   materials, with a new `BlockedReason` `noMaterials` whose HUD text names the
   cost. Both are holds shaped like harvest: progress in `harvestProgress`,
   keyed on the tile index, thrown away on release or out of reach; on
   completion `map.set` to `CUT_LEAVES` or `bridge`, remove materials, record
   `{ type: "cut" }` or `{ type: "built" }`. `main.ts` calls
   `tiles.invalidate()` and `props.invalidate()` on those events beside the
   existing `harvested` check. Prompts: "Hold E to cut through", "Hold E to lay
   a bridge tile". Toasts: "Cut a path", "Laid a bridge tile".
4. **Map files.** New `sim/mapfile.ts`, pure: `parseMap(text): GeneratedWorld`
   and `formatMap(world): string`. One character per tile, rows are lines;
   terrain glyphs from `TERRAIN`, node glyphs `f w v y s`, camp `C`. A node
   glyph implies the ground under it, mud for vine and grass for the rest;
   camp stands on grass. `reachable` comes from the existing `reachableFrom`,
   which gains an optional passability predicate. `formatMap` is the dump
   script's body moved into `sim/`, so the round trip is testable and the
   script is a caller; the stats footer moves to stderr so
   `npm run map -- 42 > public/maps/a.txt` writes a clean file. New
   `scripts/checkmap.ts` (`npm run map:check <file>`): parse, flood-fill three
   ways (as is, thicket passable, stream passable) and print whether the chain
   holds: vines reachable as is, sticks only with thicket passable, gold only
   with stream passable, and how many tiles `thickenStream` would change on a
   copy, which must be zero. `main.ts`: `?map=<name>` fetches
   `/maps/<name>.txt` and builds the `World` from `parseMap`; without it,
   seeds work as before.
5. **Next summer.** `world.year` from 1; `world.nextSummer()` resets
   `elapsedSec`, the stats and every node's `harvested`, puts the player at
   camp, drops harvest progress, and records `{ type: "summerStarted"; year }`.
   The summary button reads "Next summer" and calls it; debug Regenerate still
   builds a fresh `World`. `Hud.reset` takes the cursor to resume from, since
   the log is kept; `props.invalidate()` after, so regrown nodes draw. HUD:
   "left in summer", a "Year N" pill, summary title "Summer over".
   `SUMMER_LENGTH_SEC 300` replaces `DAY_LENGTH_SEC`.
6. **Maps and the log.** Three to five maps in `public/maps/`, each a dump
   edited to hold the chain and one pre-cut path near camp, each passing
   `map:check`. Names carry no hints. `docs/PLAYTEST.md` with the first entry's
   questions pre-written: when I broke through, did I feel anything; which
   barrier felt best; did I see the field before I reached it; did the first
   bridge feel earned.

### Verification

- `npm run typecheck`, `npm run test`. New tests: the terrain order ends with
  the new kinds; map file round trip on two seeds; the loader infers ground
  under nodes; cut turns thicket to `CUT_LEAVES` after `CUT_TIME` held and not
  before; build refuses without materials with one `noMaterials` event,
  consumes them on success, and the tile is passable after; harvest wins over
  cut when both are in reach; `nextSummer` regrows nodes, keeps terrain edits
  and gold, resets the clock; HUD prompt text for cut and build.
- `npm run map:check public/maps/*.txt` passes on every shipped map.
- Non-vacuous check: revert the `tiles.invalidate()` call and confirm a cut
  tile stays drawn as thicket until the camera scrolls; restore.
- Drive one summer with `?map=<name>` over DevTools: cut, wade to the vines,
  cut into the tree stand, lay a bridge, bank gold, hit the 5-minute end,
  press Next summer, confirm the bridge is still there and the nodes are back,
  reading positions and inventory from `window.__game`.
- Then the designer plays blind and writes the first `PLAYTEST.md` entry.
  That entry is the milestone's output, and the verdict on it decides what the
  next milestone is.

## Beyond the discovery test

Parked in `BRAINSTORM.md` until the discovery test has a verdict: **winter**
(selling, buying, the UI), collectibles as an economy, the flask, gravel and
the cache, tool costs, hazards, the age curve for summer length, and a
generator structure pass that builds the chain per seed (the edited maps are
its fixtures). Further out and unchanged: **the meta loop** (ageing, spending
on stats in winter, the next generation) and **z-levels**, which is what
`STAMINA_DIFFICULT`'s "or up a slope" is waiting for.

## Standing verification

What must keep passing, whatever is being built.

- `npm run typecheck` — clean, no `any` in `sim/`.
- `npm run test` — worldgen determinism and shape invariants, terrain
  distribution, autotile table, collision, camera, depth sorting, pixel snapping,
  the fixed-timestep clock under a stall, the scroll window, both layers driven
  headlessly against a stub pack, every stamina and hydration rate over simulated
  time, the backpack, the HUD model, the harvest / eat / drink / bank loop
  including every way it can refuse, and the debug overlay's arithmetic: time
  scaling, grid alignment, teleport refusals, and a freeze that holds.
- `npm run dev` — play a day: walk, sprint until stamina empties, eat fruit and
  hit the 60s cooldown, drink water, fill the backpack, bank ore at camp, watch
  the timer run out and the summary appear.
- `npm run dev -- ?debug=1` — drag the speed slider to 10x and watch a day out
  in 90 seconds, toggle the grid, click across the map, freeze the bars.
- 60fps with headroom at 128×128.
