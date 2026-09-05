# thirtysummers — build plan

How the game in [DESIGN.md](DESIGN.md) gets built. Why the choices below were
made is in [RATIONALE.md](RATIONALE.md); this document is only what to do.

**Status: M0–M3 complete. M4 is next.**

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
    terrain.ts         terrain table: passable, speedMul, staminaPerSec
    tilemap.ts         TileMap: get(x,y,z), isPassable, terrainAt; z-indexed from day one
    player.ts          position, facing, collision, per-axis moving flags
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
  input/keyboard.ts    keydown/keyup → InputState
  ui/hud.css           HUD styling (markup lives in index.html)
  main.ts              wires it together
tests/                 12 files, 135 tests
  stubPack.ts          an AssetPack that draws nothing and records everything
public/assets/minifantasy/   real art — GITIGNORED
```

**Still to be written:** `sim/stats.ts`, `sim/inventory.ts` (M4/M5),
`ui/hud.ts` (M4 — the markup exists, nothing binds it to world state yet),
`debug/overlay.ts` (M6).

## Rules to build to

- **Rendering only ever reads simulation state.** It never writes to it.
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
`BACKPACK_CAPACITY 10`, `FRUIT_STAMINA 20`, `WATER_HYDRATION 20`,
`FULL_STOMACH_SEC 60`, `ORE_GOLD 1`, `STAMINA_SPRINT -5.0`,
`STAMINA_DIFFICULT -1.0`, `STAMINA_WALK_EASY 0.2`, `STAMINA_STAND 0.3`,
`HYDRATION_LOW_THRESHOLD 50`.

Hand-tuned during play — current values are intentional, not suggestions:
`WALK_SPEED 7`, `DIFFICULT_SPEED_MUL 0.4`, `SPRINT_MULTIPLIER 1.8`,
`PLAYER_RADIUS 0.3`, `TILE 64`.

Still a guess, and the one most worth arguing about: `HYDRATION_DRAIN 0.11`
empties a full bar over exactly one day. Raise it if hydration should drive
routing.

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

**M4 — Stats + HUD.** ⬜ **Next.** `sim/stats.ts` implementing the design doc's
rules exactly, full-stomach cooldown, and `ui/hud.ts` binding stamina /
hydration / backpack / gold / day timer to the markup already in `index.html`.
→ *Verify:* Vitest asserts exact stamina values over simulated time; on screen
the bars track what you are doing.

**M5 — The actual loop.** ⬜ Harvest on proximity + keypress, backpack cap of 10,
eat fruit, drink water, deposit ore at camp, 15-minute day timer, end-of-day
summary with gold total.
→ *Verify:* play a full day start to finish and see a score.

**M6 — Debug overlay.** ⬜ Seed input + regenerate, time-scale slider (a
15-minute day in 90 seconds), tile-grid toggle, click-to-teleport, stat freeze.
Worth doing before hours go into tuning feel.

## Beyond the prototype

In the design doc, not yet in any milestone: **the night phase** (processing,
crafting, trading — the other half of the core loop), **the meta loop** (ageing,
spending resources on stats at night, influencing the next generation), and
**z-levels**, which is what `STAMINA_DIFFICULT`'s "or up a slope" is waiting for.

## Verification

- `npm run typecheck` — clean, no `any` in `sim/`.
- `npm run test` — worldgen determinism and shape invariants, terrain
  distribution, autotile table, collision, camera, depth sorting, pixel snapping,
  the fixed-timestep clock under a stall, the scroll window, and both layers
  driven headlessly against a stub pack.
- `npm run dev` — play a day: walk, sprint until stamina empties, eat fruit and
  hit the 60s cooldown, drink water, fill the backpack, deposit at camp, watch
  the timer run out and the summary appear.
- 60fps with headroom at 128×128.
