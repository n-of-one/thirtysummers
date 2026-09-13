# thirtysummers — build plan

How the game in [DESIGN.md](DESIGN.md) gets built. Why the choices below were
made is in [RATIONALE.md](RATIONALE.md); this document is only what to do.

**Status: the discovery test has its verdict, decided 8 Sep 2026: the idea
works. The shareable build (M7) is abandoned; its half-finished work is on
branch `itch-publish-1`. The design is being rewritten one aspect at a time
into [design/](design/README.md), and M8 to M11 below build the first five
summers of a life from it.**

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

## The first five summers

Planned 9 Sep 2026 from three design documents: [design/summer.md](design/summer.md),
[design/winter.md](design/winter.md) and [design/map-arc.md](design/map-arc.md).
What is being tested: five summers on one map, each opening one thing and
gaining one key, with a winter between them where gold is spent. The
question for the log is whether summers 2 to 5 stay interesting, which is
what the discovery test's summers 2 and 3 did not.

The unit of play is five summers of four minutes on one hand-edited map,
about twenty-five minutes with the winters. `SUMMER_LENGTH_SEC` becomes a
per-year table so the age curve can arrive later without touching logic.

Four milestones, each playable on its own, each stopped at for review. The
order is what each one needs from the one before: the body first, because
every barrier is priced in it; the map second, because winter sells what
the map yields; winter third; the cart last, because it is the experiment
most likely to be cut.

Every number below is a `[GUESS]` in `config.ts` unless the design document
gives it. The design documents give: max stamina 60 to 80 over summers 1
to 5, two meals of 10, ten off max stamina for missed upkeep, a bridge tile
lost every other winter. Everything else is set to play sensibly and tuned
in the log.

### Chores before M8

Done in one commit, so the tree is clean before anything is built on it.

- The seventeen untracked M7 files (`src/env.ts`, `src/sim/trace.ts`,
  `src/sim/playtestLog.ts`, the bake, the baked pack, `table.ts`, the log
  export, `scripts/itch.ts`, `scripts/readlog.ts`, their tests, `bake.html`,
  `dev/bake.ts`, `src/build.d.ts`) belong on `itch-publish-1`, which was
  committed without them. Commit them there, then remove them from main.
  Exception: `trace.ts` and its test stay on main if M8's verification
  wants a per-second sample; decide when M8 is planned in detail.
- The art moved to `art/minifantasy/` for M7 and main's loader still reads
  `public/assets/minifantasy/`, so main runs on placeholders. Move it back
  and confirm `npm run dev` logs pack "minifantasy".
- Commit `docs/PLAYTEST.md`, `docs/DESIGN-RAW.md`, the design folder, and
  the brainstorm and plan edits.
- The "day" vocabulary goes now, alongside M8, as BRAINSTORM.md said it
  would when winter was built: `dayOver`, `DaySummary`, `summarise`'s
  comments, the `[DOC]` notes that cite the day.

### M8: the body

Summer as the design document describes it, on the existing maps. No new
terrain, no winter. Playable as one summer, then next summer, as now.

1. **No sprint.** Remove the sprint input, `SPRINT_MULTIPLIER`,
   `STAMINA_SPRINT`, `SPRINT_MIN_STAMINA` and the `sprinting` flag; raise
   `WALK_SPEED` a little, tuned in play. The walk animation loses nothing.
2. **Stamina as a budget.** `Stats` stops recovering. `STAMINA_ROUGH_TILE`
   is charged when the player's tile changes to a difficult one, read off
   the tick's move rather than off the keys, and `STAMINA_CUT`,
   `STAMINA_BUILD` when a hold completes. Max stamina comes from a per-year
   table `MAX_STAMINA_BY_YEAR` (60, 65, 70, 75, 80). At zero the interact
   query refuses cut and build with a new `BlockedReason` `exhausted`, and
   the move code refuses to enter a difficult tile, which is a new refusal
   the prompt has to say. Eating still works.
3. **Meals.** `MEALS_BY_YEAR` (2 for years 1 to 5), `MEAL_STAMINA` 10, no
   cooldown. `FULL_STOMACH_SEC` goes. The HUD shows meals left.
4. **Hydration as a leash.** Water is no longer a resource: the `water`
   kind and its glyph go, and a drinking spot is a tile property instead:
   any tile adjacent to stream, plus spring tiles (new terrain `spring`,
   glyph `o`, passable, easy). Drinking is a short hold on the interact
   key when in reach of one, to full. Below `HYDRATION_FOG_THRESHOLD` the
   renderer draws a fog vignette whose radius shrinks with hydration; at
   zero the view is a few tiles. Fog is the only consequence.
5. **The end of a summer.** What is carried when the clock stops is
   banked. `world.awayAtEnd` records whether the player was out of reach of
   camp, for winter. A button at camp ends the summer early.
6. **The stamina bar under the player.** Drawn by the prop layer or the
   marker as a thin bar at the feet, and the cost of the tile ahead or the
   hold in reach shown on the prompt ("wade, 2 stamina").
7. **Config and docs.** Every new number marked, `DESIGN.md`'s stat rules
   struck through with a pointer to `design/summer.md`.

Verification: stamina over a simulated summer matches the per-tile and
per-action sums exactly; a full bar is refused nothing and an empty one is
refused rough ground and tools with the right reason; two meals then a
refusal; hydration reaches zero at the drain rate and the fog radius
follows it; drinking at a bank and at a spring fills the bar; a summer
ended away from camp banks the pack and flags the world; and one summer
played on `?map=b` over the protocol, walked not teleported, with the
numbers read back.

### M9: the map

The barriers, resources and improvements the five-summer table needs, and
five new maps that hold it. Playable as five summers back to back, with no
winter yet: the axe and the well are given at the start of the summer whose
table row needs them, so the map can be tested before the shop exists.

1. **Terrain.** `sapling` (impassable, felled by the axe, glyph `t`),
   `spring` from M8, and the well as a placed spring. `TERRAIN_ORDER` is
   appended, never reordered.
2. **Resources.** `feather`, `log`, `shell` join `stick`, `vine`, `ore`,
   `fruit`. One table in `sim/resources.ts` gives each kind its glyph,
   ground, slots (log takes two), price, and whether it comes back every
   winter, slowly, or never. `RESOURCE_KINDS` and `NODE_GROUND` move into
   it. The inventory counts slots, not items.
3. **Tools.** `world.tools` is a set: knife from the start, axe and cart
   granted by the map's year table for now. Felling is a hold on a sapling
   tile with the axe, leaves grass and one log in the pack, and costs
   `STAMINA_FELL`.
4. **Improvements.** The well: a hold on a grass tile far from water with
   `WELL_LOGS` and `WELL_STICKS` in the pack, leaves a `spring` tile. The
   cache: a hold on grass with `CACHE_STICKS`, leaves a `cache` prop the
   player can bank into and fetch from with the same key; contents are a
   second inventory with no limit. Bridge unchanged.
5. **Thickness.** The five maps are cut from generated dumps as before and
   edited to the five-summer table: the half-circle stream around camp with
   drinking banks; the thin thicket and the mud pocket inside it; the ore
   field and a sapling copse across the stream; a dry pocket with shells
   past any water; and a thicket twelve deep into the last pocket.
   `map:check` grows a check per row: what is reachable on foot, once cut,
   once bridged, once felled, and how far each pocket is from water.
6. **Placeholder art** for the new terrain and kinds; Minifantasy sprites
   picked for contrast, as the vine and stick were.

Verification: the resource table round-trips through the map file; slots
count; felling needs the axe and pays stamina; the well makes a drinking
spot and refuses near water; the cache holds and returns; `map:check` passes
all five maps on every row; five summers on one map over the protocol with
the year table granting tools, reading back that each summer's row opens.

### M10: winter

The screen between summers, upkeep, the shop, the family. After this the
five-summer unit is complete and the log can say whether summers 2 to 5
held.

1. **The store.** Banking moves everything into `world.store`, a second
   inventory with no limit, valued at the ladder's prices. The HUD's gold
   readout becomes the store's worth plus gold in hand. "Winter needs N
   fruit, store has M" sits beside it all summer.
2. **The winter screen**, in `index.html` and `ui/winter.ts`, with a model
   in `sim/winter.ts` that is pure: keep-or-sell per kind with the default
   as sell, the sum and breakdown; upkeep in fruit and gold with the
   auto-buy and auto-sell of fruit and the away-from-camp charge; the shop
   as a list from `SHOP_BY_YEAR` (axe in winter 1, cart in winter 2, the
   well's recipe as knowledge not a purchase, boots as a candidate) with
   prices and greying; and the family, a surplus total against
   `FAMILY_LEVELS`. Next summer starts from the screen.
3. **Between summers**, in `world.nextSummer`: replenishment by the table
   (inner ring always, ore and shells by `REPLENISH_SLOW` share, seeded);
   thicket creep with `THICKET_CREEP_CHANCE` on cut tiles touching thicket;
   saplings back after `SAPLING_RETURN_YEARS`; one bridge tile lost every
   other winter, the tile chosen deterministically; trails with
   `TRAIL_CHANCE` on underbrush tiles the trace crossed more than
   `TRAIL_CROSSINGS` times (this is where `trace.ts` earns its keep on
   main); max stamina ten lower after missed upkeep.
4. **The start of a summer**: a small notice with the length and the
   upkeep, dismissed by the first movement key.
5. **The year table's tool grants** from M9 go, since the shop now sells
   them; the maps are checked again with the shop's prices against the
   ladder, so winter 1 can afford the axe from a summer-1 haul.

Verification: the winter model over a synthetic store gives the right gold,
the right fruit bought and sold, the right surplus and level; upkeep missed
lowers next year's max stamina and only for one year; replenishment,
creep, sapling return, bridge loss and trails each over five simulated
winters on a small map with a seed, with the counts read back; five summers
and four winters on `?map=f` over the protocol.

### M11: the cart

The logistics experiment, last because it is the one most likely to be cut
by the log.

1. A `cart` entity in `sim/`: a position, pushed by walking into it, moves
   only onto grass and bridge, holds any amount. Banking into it and out of
   it with the interact key when in reach. Bought in winter 2 for logs.
2. Rendering as a prop that moves, depth-sorted with the player.
3. A map whose summer-3 row needs it: a cache across the stream and a route
   that has to be cut wide enough.

Verification: the cart refuses mud and underbrush and thicket, follows a
push, keeps its contents across the summer, and one summer over the
protocol hauling a cache home.

### After the log

Parked until the five-summer log has been written: the map under snow, the
grave and its +1, the age curve past summer 5, gear (boots, clothes, the
bigger backpack), structures and the mine, the lineage, hazards, z-levels,
and a generator pass that builds the five-summer table per seed with the
edited maps as its fixtures.

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
- `npm run dev` — play a summer on a seed: walk, wade until stamina empties
  and see rough ground refused, eat both meals and see the third refused,
  drink at a bank, fill the backpack, bank ore at camp, watch the timer run
  out and the summary appear. (Sprint and the stomach cooldown are gone
  from M8 on.)
- `npm run dev` on `?map=a` — the discovery test itself: through the cut path,
  wade to the vines, cut into the stand, lay a bridge, bank gold across the
  water, and take the next summer to see it all still there.
- `npm run dev -- ?debug=1` — drag the speed slider to 10x and watch a summer
  out in 30 seconds, toggle the grid, click across the map, freeze the bars.
- `?pack=placeholder` — a fresh clone with no art still draws every terrain.
- 60fps with headroom at 128×128.
