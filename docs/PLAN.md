# thirtysummers — build plan

How the game in [DESIGN.md](DESIGN.md) gets built. Why the choices below were
made is in [RATIONALE.md](RATIONALE.md); this document is only what to do.

**Status: the discovery test is built and has been played four times, by the
designer. The next tester is a stranger on itch.io, and M7 below is the build
that makes that possible. The fruit and stamina tuning the log asks for is a
separate step after it.**

Scope so far: the summer phase only. One flat map, one 5-minute summer, walk
around collecting while stamina and hydration drain, cut a thicket, bridge a
stream, deposit ore at camp for gold, and start another summer on the same map
with every change kept. What that is testing and why is in
[BRAINSTORM.md](BRAINSTORM.md); read it before proposing anything new.

Vocabulary, decided 5 Sep 2026: the phases are summer and winter. "Day" and
"night" are on their way out. The discovery test renamed only what the player
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

Seven milestones, M0 to M6, delivered the summer phase, and the discovery test
added terrain the player can change. What they left behind, as it stands today.
The discovery test's own half is listed under its heading below.

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
water with R, bank ore at camp, cut a thicket and lay a bridge tile on the same
key, and an end-of-summer summary with the gold total and a button for the next
summer.
Everything the simulation does is recorded in `world.events`, an append-only log
the toasts, the summary and the prop layer each walk with their own cursor. The
prompt and the toasts hang off the player rather than off a corner; the keys for
fruit and water are spelled out in the bottom right, and only once there is
something to use them on.

Controls: WASD or arrows to move, Shift to sprint, E or Space to gather, cut,
build and bank ore, F to eat, R to drink.

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
    mapfile.ts         text map format: parseMap / formatMap, one char per tile
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
    targetMarker.ts    outlines the tile a cut or a bridge would land on
  input/keyboard.ts    keydown/keyup → InputState; NO_INPUT for tests
  ui/hud.ts            world state → the markup in index.html; toasts, summer summary
  ui/hud.css           HUD styling (markup lives in index.html)
  debug/overlay.ts     seed, time scale, grid, freeze, teleport; hidden until backtick
  main.ts              wires it together
scripts/
  dumpmap.ts           npm run map: map to stdout, stats to stderr
  checkmap.ts          npm run map:check <file>: does the chain hold?
tests/                 20 files, 281 tests
  stubPack.ts          an AssetPack that draws nothing and records everything
public/assets/minifantasy/   real art — GITIGNORED
public/maps/           edited map dumps, a..e; the person playing does not open them
docs/PLAYTEST.md       one entry per play session
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

From the design doc, added by the discovery test: `SUMMER_LENGTH_SEC 300`
(which replaced `DAY_LENGTH_SEC 900`), `BRIDGE_STICKS 1`, `BRIDGE_VINES 1`.

Untuned guesses, and the first things to change if the playtest says the pacing
is wrong: `CUT_TIME 1.5` and `BUILD_TIME 2` seconds, against `HARVEST_TIME 0.6`
-- a wall should cost more than a berry, and a bridge more than a wall.
`CUT_LEAVES` is `grass`, so a cut path is also a fast path and the second trip
through is visibly cheaper than the first; `underbrush` is the other candidate
and would leave the cut readable but still slow.

## The discovery test

Built, and unplayed. The smallest game that can answer "when I broke through,
did I feel anything?" One 5-minute summer on a map loaded from a text file, a
thicket the knife cuts, a stream a bridge crosses, vines and sticks as the
bridge's materials, gold only across the stream, and a button for another summer
on the same map with every change kept. No winter, no gravel, no cache, no
hazards. `DESIGN.md` has the rules under "Prototype, phase 2"; `BRAINSTORM.md`
has the reasoning.

What the milestone leaves behind:

1. **Terrain.** `thicket` (impassable, glyph `%`) and `bridge` (passable, easy,
   glyph `-`), appended to `TERRAIN_ORDER` so the indices already written into
   every map dump keep meaning what they meant. Thicket autotiles as one
   surface with trees and undergrowth; a bridge is its own. `TileLayer` gained
   an `invalidate()` on the pattern of `PropLayer`'s, so a cut redraws in the
   frame it happens rather than when the player next walks far enough to scroll.
2. **Resources.** `vine` and `stick`, harvested like ore. The vine grows in the
   mud pocket, the stick in the walled tree stand.
3. **Cutting and building.** `nearestTileWithin` in `interaction.ts`, and two
   more `Action` kinds. `availableAction` answers bank, harvest, cut, build, in
   that order, so picking a vine beats cutting the thicket it grows against. All
   three holds are one code path with a table of durations. A bridge tile costs
   `BRIDGE_STICKS` sticks and `BRIDGE_VINES` vines, and refuses with a
   `noMaterials` that names the price.
4. **Map files.** `sim/mapfile.ts`: `parseMap` and `formatMap`, one character per
   tile. `npm run map` writes the map to stdout and its statistics to stderr, so
   a dump redirected to a file is a map the game can load. `npm run map:check`
   flood-fills three ways and says whether the chain holds. `?map=<name>` plays
   `/maps/<name>.txt`.
5. **Next summer.** `world.nextSummer()` keeps the map, the terrain the player
   changed, the gold and the backpack; regrows every node, refills the stats,
   returns the player to camp and restarts the clock. The event log is kept too,
   so `Hud.reset` takes the cursor to resume from.
6. **Five maps** in `public/maps/`, `a` through `e`, each a generated map cropped
   to 64x64 and edited to hold the chain, each passing `map:check`. Their seeds
   are in `public/maps/README.md`; their layouts are not written down anywhere,
   which is the point. `docs/PLAYTEST.md` is the log, with the first entry's
   questions already written.

Decisions taken while building it, over and above the plan. The reasoning is in
[RATIONALE.md](RATIONALE.md) under "The discovery test", "Maps as text" and
"Drawing the new terrain".

- **A thicket is undergrowth painted darker through the same stencil**, with
  growth on every tile rather than the 45% that makes undergrowth read as
  passable. Tinting the finished tile was tried and squares off every ragged
  edge the stencil draws.
- **A bridge is planks over the dirt fill, not the dirt block**, with the timbers
  following the run of tiles. The dirt block alone read as a muddy ford, which is
  the thing the stream had its fords removed to stop being.
- **The summary counts one summer**, from the last `summerStarted` in the kept
  log. Gold is the exception and carries: it is the score.
- **The maps are 64x64, not 128x128.** A 5-minute summer does not need a map a
  player cannot cross in one.

### Changed after the first playtest

- **The target tile is outlined.** Cut and build act on the nearest tile of the
  right kind, and nothing said which one that was: the first session laid a
  bridge on the wrong tile and paid for it. `render/targetMarker.ts` draws an
  outline on the tile the key would act on, above the props, red when the action
  is right here but cannot be paid for, with the hold's progress as a bar along
  the tile's bottom edge. Harvesting is not marked -- a node is a sprite
  standing where it is.

### Verification

Everything below was run, and the numbers are what it reported.

- `npm run typecheck`, `npm run test` — clean; 281 tests over 20 files. New:
  the terrain order ends with the new kinds and their glyphs are distinct; map
  file round trip on two seeds, including the reachability mask; the loader
  infers the ground under each node glyph and refuses a ragged map, an unknown
  glyph, two camps or none, naming the line and column; `nearestTileWithin`
  including its tie-break; cut turns thicket to `CUT_LEAVES` after `CUT_TIME`
  and not before, and throws the progress away on release or out of reach;
  build refuses without materials with exactly one `noMaterials`, spends them on
  success, leaves a passable tile, and pays only once per hold; harvest beats
  cut when both are in reach; `nextSummer` regrows nodes, keeps terrain edits
  and gold, resets the clock and does not carry a held key across; the HUD
  prompt text for cut and build; `TileLayer.invalidate` re-textures with the
  camera stationary; the target marker sits on the tile the action names, hides
  when nothing is in reach, and follows a moving camera by transform alone.
- `npm run map:check public/maps/*.txt` — all five OK, 20 checks passed.
- Non-vacuous checks, both by reverting the fix and watching it fail: removing
  `tiles.invalidate()` leaves the cut tile drawn as thicket in the frame after
  the cut (with the water animation pinned, or its periodic refill stands in for
  it); removing the spent-press guard in `nextSummer` lets a key held across the
  turn of the summer start cutting immediately.
- One summer driven over the DevTools protocol on `?map=a`: cut a thicket and
  watched the ground texture change with the camera stationary, picked two vines
  and two sticks, laid a bridge tile for one vine and one stick and confirmed the
  tile passable, mined and banked gold, ran the clock out to the summary card
  ("Summer 1 over" / "Next summer"), pressed it, and confirmed year 2 with the
  bridge and the cut still there, every node back, stats full, the player at camp
  and 300 seconds on the clock. 60fps.
- The same on `?pack=placeholder`, so a fresh clone with no art still shows the
  new terrain, and with real keystrokes rather than teleports, so movement is
  measured rather than assumed.

**What is left is the part no code can do**: someone plays a map blind and writes
the first `PLAYTEST.md` entry. That entry is the milestone's output, and the
verdict on it decides what the next milestone is.

## M7: the shareable build

Not started. Planned 6 Sep 2026 from the third entry in
[PLAYTEST.md](PLAYTEST.md): the next tester is someone on itch.io who plays
alone, so the game has to be its own observer, and the licensed art has to
leave this machine as a game rather than as files.

What it delivers: `npm run build:itch` writes a zip that plays one map on
itch.io, draws from a single baked art file that holds only the pixels the game
uses, records where the tester went, and puts that record on the summary card
for them to paste into a comment. `npm run log:read` turns a pasted record back
into a path drawn on the map. The dev loop is untouched: on localhost the game
still cuts its textures from the raw Minifantasy folders exactly as it does now.

Why it is needed and not just `npm run build`: Vite copies `public/` into
`dist/` whole, and the `dist/` on disk today contains all 1852 raw art PNGs.

Decisions taken in planning. Overturn them in this section before starting,
not while building.

- **The public build plays map `d`.** `e` stays unshipped and unspoiled for a
  watched session later. Which map ships is one constant.
- **The baked art is one binary file, not a PNG.** Anything a browser can draw
  can be read back from a canvas, so this stops "save image as", not a
  determined person. The point is licence hygiene: the raw pack folders never
  leave the machine, and what ships is the built game, which is the licensed
  use.
- **The raw art moves out of `public/`.** A dev-only server route serves it
  from its new home, so nothing under `public/` is licensed and no build step
  can leak it by accident.
- **Logs are pasted, not uploaded.** No server, no account, no privacy
  question. A summer compresses to a few kilobytes of text.
- **The debug overlay does not exist on the public build.** Seed stepping and
  teleport would show a tester the map they are meant to discover.
- **Hostname decides.** `localhost`, `127.0.0.1` and `[::1]` are the dev
  machine; everything else is public. `?public=1` forces the public behaviour
  on localhost so `vite preview` can be checked.

Work, in order. Each item names its files and what proves it.

1. **One answer to "is this the dev machine".** `src/env.ts` exports
   `isDevHost(): boolean` from `location.hostname` and the `?public=1`
   override. It is the only file that reads the hostname. `main.ts` uses it
   three times: pack order, the default map when `?map=` is absent, and
   whether to construct the debug overlay at all. Test: the classification of
   a table of hostnames and the override.

2. **The raw art leaves `public/`.** `public/assets/minifantasy/` becomes
   `art/minifantasy/`, gitignored at the new path. A plugin in
   `vite.config.ts` uses `configureServer` to serve `/assets/minifantasy/*`
   from that folder during `npm run dev` only, so `minifantasy.sheets.ts` and
   `textures.html` keep working with the same URLs. `public/assets/README.md`
   says where to unzip now. Proof: `npm run dev` still logs pack
   "minifantasy"; `npm run build` produces a `dist/` with zero `.png` files.

3. **The texture table.** `MinifantasyPack` does two jobs: building every
   texture from the sheets, and answering `ground`, `prop`, `resource`,
   `walk`, `idle` from arrays. Split them. `src/render/packs/table.ts` holds a
   `TextureTable` interface with those arrays and the measured
   `playerAnchor`/`playerBounds`, and a `TablePack implements AssetPack` that
   answers from a table; the `ground` switch with its variant, autotile and
   bridge-orientation logic moves there unchanged. `minifantasy.ts` shrinks to
   `buildTable(sheets): TextureTable` plus the source. Behaviour must not
   change. Proof: the screenshot diff in verification below, taken before and
   after this item, is zero.

4. **Baking.** `src/render/packs/bake.ts`, in three pure parts.
   - `packRects(sizes)` is a shelf packer returning an atlas size and one rect
     per input, deterministic. Textures are 8, 16, 24 and 32 pixels on a side,
     so shelves by height are enough.
   - `bakeTable(table)` walks every texture reachable from the table, once per
     distinct texture (a block's narrow slots reuse its fill texture and must
     not be drawn seven times), draws each into one canvas and returns the
     pixels plus a manifest: format version, atlas size, `tileSize`,
     `playerAnchor`, `playerBounds`, and for every slot a rect, with anchor
     and bounds for props. Slot names are the table's own field names and
     indices, so the manifest reads as the table flattened.
   - `encodePack(pixels, manifest)` and `decodePack(bytes)`: the ASCII tag
     `TSPK`, a u32 manifest length, the manifest as UTF-8 JSON, then the RGBA
     bytes through `deflate-raw`. Both `CompressionStream` and
     `DecompressionStream` exist in the browser and in Node 22, so the script
     in item 7 decodes without a dependency.
   The bake runs in a browser, because the raw pack is built from canvases.
   `dev/bake.html` and `dev/bake.ts` load the raw pack on localhost, bake it,
   and POST the bytes to a second route on the same Vite plugin, which writes
   `public/assets/baked/minifantasy.tspk` and answers with the size. The
   folder is gitignored. The page prints the atlas dimensions, the file size
   and the slot count. Document it as `npm run dev`, then open
   `http://localhost:5173/bake.html`. Tests: the packer never overlaps and
   never exceeds the atlas; `encodePack` then `decodePack` on synthetic
   pixels and a manifest is the identity.

5. **The baked pack.** `src/render/packs/baked.ts`: `bakedPackSource` with
   `available()` as a HEAD on the `.tspk`, `load()` as fetch, decode,
   `ImageData` into a canvas, one `ImageSource` with nearest scaling, then a
   `TextureTable` built from the manifest and handed to `TablePack`. It
   imports nothing from `minifantasy.ts` or `minifantasy.sheets.ts`; the
   manifest is the only thing it knows. `atlas.ts` orders sources by
   `isDevHost()`: dev is minifantasy, baked, placeholder; public is baked,
   placeholder. `?pack=baked` still forces it on localhost for comparison,
   and `textures.html` shows it.

6. **The trace.** `src/sim/trace.ts`: a `Trace` the `World` owns and samples
   from `step` every `TRACE_SAMPLE_SEC` of simulated time (a `[GUESS]` in
   config, 1 second): summer, elapsed second, tile x and y, terrain kind
   under the player, stamina, hydration, sprinting. Three hundred samples a
   summer, append-only across summers like the event log. Pure, no DOM.
   `src/sim/playtestLog.ts` builds the `PlaytestLog` record: format version,
   build id, map name, pack id, wall-clock start, the events, the samples.
   `digest(log)` computes what an observer would have written down, per
   summer: gold, seconds to first cut, first bridge tile, first ore banked,
   whether "Next summer" was pressed, tiles walked, and idle spots (the same
   tile for longer than `TRACE_IDLE_SEC`, with its terrain). Tests: a
   synthetic trace with known answers; `nextSummer` keeps earlier samples.

7. **Getting the log out and reading it back.** `src/ui/logExport.ts` (DOM)
   encodes the record as `deflate-raw` then base64 with a `TS1.` prefix, so a
   summer is a few kilobytes of pasteable text. The summary card gains a
   textarea holding it, labelled "Copy this into your comment", selected on
   focus, with a Copy button that tries `navigator.clipboard` and falls back
   to the selection. No download link: an itch iframe may block both clipboard
   and downloads, and a selected textarea works everywhere. The record is also
   written to `localStorage` after every summer, so a closed tab loses
   nothing, and the textarea holds every summer played so far, not the last
   one. `scripts/readlog.ts` as `npm run log:read <file>` decodes a pasted
   record, prints the digest, then prints the map from `public/maps/` with
   the path density overlaid on the dump's own glyphs. It is the substitute
   for the observer's notes and is for use after a tester has played, so the
   blind-play rule is not in its way.

8. **What the tester sees.** A start card in `index.html`: title, four lines
   of controls, "art by Krishna Palacio", "5 minutes, then the summer ends".
   The first movement key dismisses it. The build id (git short hash and
   date, injected with Vite `define`) sits small on the summary card and in
   the log, so a pasted record can be matched to a build. On the public build
   the overlay is not constructed and backtick does nothing. Nothing about
   fruit, stamina or sprint changes here.

9. **The zip.** `scripts/itch.ts` as `npm run build:itch`: runs `vite build`
   with a relative `base` (itch serves from a subpath), prunes `dist/maps/`
   to the shipped map, refuses if `dist/` contains any `.png` or anything
   under `assets/minifantasy`, refuses if the `.tspk` is missing, and zips
   `dist/` with `index.html` at the root to `dist/thirtysummers-<build>.zip`
   using the `zip` already on the machine. Prints the zip size, the `.tspk`
   size and the file list.

10. **Docs.** `public/assets/README.md` for the new art location and the bake
    step; `public/maps/README.md` says which map ships; `docs/PLAYTEST.md`
    gains a remote-tester variant of the entry with "log pasted by", the
    build id, and the questions to put on the itch page; `CLAUDE.md` lists
    the new commands; `RATIONALE.md` records the format choice, paste over
    upload, and hostname switching. This section moves to "What is built"
    with the numbers verification produced.

### Verification

All of it measured, none of it asserted, on the pattern of the discovery
test's list above.

- `npm run typecheck`, `npm run test` clean. New tests are named in the items.
- **The baked pack draws the same picture.** Over the DevTools protocol on
  localhost: `?map=d&pack=minifantasy` and `?map=d&pack=baked`, the camera at
  the same place, the water frame pinned, one screenshot each, pixel diff
  zero. Non-vacuous: shift one rect in the manifest by a pixel and watch the
  diff go non-zero, then restore it.
- **The refactor in item 3 changed nothing.** The same diff, raw pack against
  itself, before and after the split.
- **The zip is clean.** Unzip it into a scratch folder: zero `.png`, no
  `assets/minifantasy` path, one map file, the `.tspk` present. Report the
  sizes.
- **The public build behaves as public.** `vite preview` with `?public=1`:
  the console logs pack "baked" and map "d" with no `?map=`, backtick opens
  nothing, the start card shows and the first key clears it.
- **A log round-trips.** Play one summer over the protocol on the preview
  build, cut a thicket at a known second, press "Next summer", take the
  textarea text, run `npm run log:read` on it: the path lands on the tiles
  walked, and the first-cut second matches the `cut` event.
- 60fps unchanged on the baked pack.

**What is left is the same as last time**: a stranger plays it and pastes a
log. That entry is the milestone's output.

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
  time, the backpack, the HUD model, the map file round trip and every way it
  refuses a bad one, the harvest / eat / drink / bank / cut / build loop
  including every way it can refuse, `nextSummer`, and the debug overlay's
  arithmetic: time scaling, grid alignment, teleport refusals, and a freeze that
  holds.
- `npm run map:check public/maps/*.txt` — the chain still holds on every
  shipped map. Run it after editing one by hand.
- `npm run dev` — play a summer on a seed: walk, sprint until stamina empties,
  eat fruit and hit the 60s cooldown, drink water, fill the backpack, bank ore
  at camp, watch the timer run out and the summary appear.
- `npm run dev` on `?map=a` — the discovery test itself: through the cut path,
  wade to the vines, cut into the stand, lay a bridge, bank gold across the
  water, and take the next summer to see it all still there.
- `npm run dev -- ?debug=1` — drag the speed slider to 10x and watch a summer
  out in 30 seconds, toggle the grid, click across the map, freeze the bars.
- `?pack=placeholder` — a fresh clone with no art still draws every terrain.
- 60fps with headroom at 128×128.
