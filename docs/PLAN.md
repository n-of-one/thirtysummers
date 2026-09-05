# thirtysummers — build plan

How the game in [DESIGN.md](DESIGN.md) gets built. Why the choices below were
made is in [RATIONALE.md](RATIONALE.md); this document is only what to do.

**Status: M0–M6 complete. The prototype's day phase is done.**

Scope of the prototype: the day phase only. One flat map, one 15-minute day,
walk around collecting fruit / water / ore while stamina and hydration drain,
deposit ore at camp for gold.

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
    interaction.ts     what is in reach: nearest node, distance to camp
    summary.ts         the day counted up from the event log
    world.ts           owns everything; world.step(dt, input)
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
  debug/overlay.ts     seed, time scale, grid, freeze, teleport; only with ?debug=1
  main.ts              wires it together
tests/                 17 files, 225 tests
  stubPack.ts          an AssetPack that draws nothing and records everything
public/assets/minifantasy/   real art — GITIGNORED
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

## Milestones

Each ends in something runnable. **Stop at the end of each one for verification
before starting the next.**

**M0 — Skeleton.** ✅ Node 22, Vite + Pixi, scripts, gitignored asset folder.

**M1 — Worldgen, headless.** ✅ `rng`, `terrain`, `tilemap`, `worldgen`. Simplex
noise thresholded into grass / underbrush / tree, a second octave for mud, a
noise-band stream, a rock border, camp on grass near centre, resource nodes
scattered by terrain. `npm run map` dumps ASCII to the terminal.

**M2 — Tiles on screen.** ✅ `AssetPack` + `placeholderPack`, `tileLayer`,
`camera`.

**M2b — Real art.** ✅ Minifantasy loaded from the gitignored folder, frame sizes
read off the PNGs, auto-selected when present, placeholder fallback when absent.

**M3 — Movement.** ✅ Fixed-timestep loop, WASD/arrows, AABB collision against
impassable tiles, terrain speed multipliers, sprint, camera follow, walk
animation on four diagonal facings.

Also delivered under M3, after playtesting:

- Full 15-tile autotiling for mud, rock, water and undergrowth, extended with
  seven narrow shapes the 3×5 blocks cannot express. Trees and underbrush
  autotile as one surface.
- Forest density driven by the noise height and scattered by spatial hash, so
  woods have gaps rather than solid canopy.
- Ford carving, so camp can reach everything; stream thickening, so water is
  nowhere one tile across and never steps through a bare corner.
- Tree occlusion: the player is drawn behind trees and re-drawn on top as a
  black silhouette masked to exactly the covered pixels.
- Props snapped to the art-pixel grid; the player sprite eased onto it at rest,
  always in the direction of travel.

**M4 — Stats + HUD.** ✅ `sim/stats.ts` implementing the design doc's rules
exactly, full-stomach cooldown, and `ui/hud.ts` binding stamina / hydration /
backpack / gold / day timer to the markup already in `index.html`.

Also delivered under M4:

- `sim/inventory.ts`, the ten-slot backpack and the gold count, so the HUD has
  something real to read. Nothing fills it yet; harvesting is M5.
- The day clock on `World`, counting `DAY_LENGTH_SEC` down and stopping at zero.
  The end-of-day summary is M5.
- Exhaustion stops a sprint, above a floor of `SPRINT_MIN_STAMINA` so the state
  lasts longer than a tick. `EXHAUSTED_SPEED_MUL` is now wired, still at 1.0.

**M5 — The actual loop.** ✅ Harvest on proximity by holding E, eat fruit with F,
drink water with R, bank ore at camp, end-of-day summary with the gold total.

Controls: WASD or arrows to move, Shift to sprint, E or Space to gather and to
bank ore, F to eat, R to drink.

Also decided while building it:

- **One press does one thing.** Holding E at camp banked the load and then
  started picking the node beside the camp. A press that banks is spent until
  the key comes up. Harvesting does not spend it, so one hold still clears a
  whole patch.
- **Banking wins at camp only while carrying ore**, so an empty-handed player
  can still pick a node growing next to the camp.
- **Harvest progress is thrown away** on release or on walking out of reach,
  which is what makes `HARVEST_TIME` a cost rather than a formality.
- `world.events`, an append-only log, carries what happened to the toasts, to
  the end-of-day count, and to the prop layer, which uses it to know a node has
  to stop being drawn.

Moved after playtesting:

- **The prompt and the toasts hang off the player**, not off a corner. Both live
  in one absolutely positioned stack the HUD repositions each frame from
  `camera.toScreen(player)`: the prompt `PROMPT_OFFSET_PX` below the feet, the
  toasts under it, newest nearest. It is clamped to the window, so a player in
  the corner of the map still gets the whole line.
- **The keys for fruit and water are spelled out in the bottom right**, and only
  once there is something to use them on. Picking your first fruit is where the
  question comes up.

**M6 — Debug overlay.** ✅ A backtick brings up a panel across the top: seed box
and a regenerate button, `[` and `]` to step to the neighbouring seed, a
time-scale slider from 1x to 10x (a 15-minute day in 90 seconds), a tile-grid
toggle, a stat freeze, click-anywhere-to-teleport, and a readout of the numbers
the frame was drawn with. `?debug=1` starts it open; Escape closes it.

Also decided while building it:

- **Regenerating is a real reseed now**, not a page reload, so "New day" replays
  the same seed and the seed box builds a different one without losing the
  session. New map, new layers: they are cheap to build and destroying them
  releases the sprite pool.
- **The time scale multiplies the frame after the clamp**, so `MAX_FRAME_SEC`
  keeps meaning what it says and a backgrounded tab cannot spiral at 10x either.
  The scaled seconds drive the camera and the animations too, so the whole
  picture speeds up together rather than the world running ahead of the view.
- **Freeze lives on `Stats`**, and the frame loop pushes the checkbox into it
  every frame rather than once on change. A state read fresh survives a
  regenerate; a callback would quietly thaw the new world.
- **Teleport refuses an impassable tile.** Collision only moves a player from a
  legal position to a legal position, so a player dropped inside a rock could
  never walk out of one. The camera cuts rather than glides, since easing across
  half the map hides what the teleport was for.
- Keys typed into the panel are not controls: the keyboard ignores events aimed
  at an input or a button, which otherwise reach `window` and walk the player
  north-east while you type a seed.
- **The panel is always built and starts hidden**, rather than existing only
  under `?debug=1`. A key is quicker than a reload, and a hidden div and one
  keydown listener is the whole cost. Everything except the toggle is inert
  while it is down, so a stray bracket cannot rebuild the world you are in.
- **The readout is fixed-width**: every field is padded to the longest value it
  can take, so a coordinate going from 80.0 to 80.01 cannot resize the panel or
  shift the column next to it. The padding is non-breaking spaces, so a wrapped
  line only ever breaks between fields.

## Beyond the prototype

In the design doc, not yet in any milestone: **the night phase** (processing,
crafting, trading — the other half of the core loop), **the meta loop** (ageing,
spending resources on stats at night, influencing the next generation), and
**z-levels**, which is what `STAMINA_DIFFICULT`'s "or up a slope" is waiting for.

## Verification

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
