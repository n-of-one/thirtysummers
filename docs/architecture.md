# Architecture

How the code is shaped: the rules every change keeps, the stack, and a map
of the source by module. Why it is this way is in
[rationale/technical.md](rationale/technical.md). How to run and test it is
in [development.md](development.md).

## Rules

- **Nothing under `src/sim/` imports Pixi or touches the DOM.** That keeps
  the simulation unit-testable and lets the renderer change underneath it.
- **Rendering only ever reads simulation state.** It never writes to it.
  What the simulation did reaches the HUD and the renderer through
  `world.events`, an append-only log each reader walks with its own cursor.
- **The simulation advances in fixed 1/60s steps** (`TICK_SEC`), so
  per-second rates do not drift with frame rate. `frameClock.ts` renders on
  `requestAnimationFrame`, steps once for each whole tick accrued, and clamps
  the frame so a backgrounded tab cannot spiral. Anything asking "is this
  moving" reads a flag the tick wrote, never a diff between draws.
- **Relative imports carry an explicit `.ts` extension**, so the same source
  runs under Vite, Vitest and bare `node --experimental-strip-types`.
- **`src/config.ts` holds every tunable number**, each marked `[DOC]` (from
  `docs/design/` or `docs/current/five-summers.md`) or `[GUESS]` (tune
  freely). Numbers do not belong in logic.
- **Tile rendering is bound to view size, not map size.** A sprite pool
  covers the view plus a margin, repositioned and re-textured as the camera
  moves.
- **Nothing reads the window but `ui/view.ts`.** The camera, the pools, the
  fog, the prompt and the arrow work in the view's logical pixels; the
  window only decides how far the view is scaled.
- **Z-level ready without building it.** `TileMap` is z-indexed and the
  layers take a layer index. Worldgen only ever produces layer 0.
- **Nothing outside `render/packs/` knows Minifantasy exists.** The art is
  never committed, and the placeholder pack keeps a fresh clone runnable
  without it.
- **`TERRAIN_ORDER` is appended, never reordered**, so the indices in every
  map dump keep meaning what they meant.
- **Two runtime dependencies**, `pixi.js` and `simplex-noise`. Keep it that
  way.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript | 7.0.2 |
| Build / dev server | Vite | 8.2.2 |
| Renderer | PixiJS | 8.20.1 |
| Noise | simplex-noise | 4.0.3 |
| PRNG | hand-written mulberry32 (`sim/rng.ts`) | none |
| Tests | Vitest | 4.1.11 |
| Runtime | Node 22 LTS | 22.23.2 |

## Fixed decisions

| | |
|---|---|
| Projection | Top-down orthogonal. Z-levels, when they come, are discrete stacked layers viewed one at a time. |
| Movement | Free and continuous, with a tile grid underneath for collision and terrain cost. |
| Map | 168×168 tiles generated, inside a rock border 20 thick so the camera can stay centred at the edge of play; 64×64 for hand-edited maps. `TILE = 32` logical px, 8px source art at 4× scale. |
| View | A fixed logical view of `VIEW_W × VIEW_H`, 1920×1080, scaled to fit the window in steps of 1/8 with black bars. |
| HUD | HTML/CSS overlay on top of the canvas. |
| Art | Minifantasy, behind a swappable pack layer. |
| Hosting | Localhost only. |

## Modules

- **`src/sim/`** is the whole game with no renderer. `world.ts` owns
  everything: `world.step(dt, input)` and `nextSummer()`. Around it:
  `stats.ts`, `inventory.ts`, `player.ts` (collision, per-axis moving
  flags, the heading), `interaction.ts` (what is in reach, the tile ahead,
  and `availableAction`, the one query that decides what the interact key
  does), `terrain.ts` and
  `tilemap.ts` (the terrain table and the grid), `mapfile.ts` (the text map
  format), `summary.ts` (a summer counted from the event log).
- **`src/sim/worldgen/`** turns a seed into a map: noise into terrain and a
  camp, stream thickening and fords, a flood fill from camp, resources
  scattered by terrain, springs on the bank. `worldgen.ts` says what order the steps run in, and
  why.
- **`src/render/`** is Pixi only. `tileLayer.ts` is the culled, autotiled
  ground. `propLayer.ts` is the y-sorted props and player, with pixel
  snapping. `silhouette.ts` redraws the player where a canopy covers them.
  `targetMarker.ts` outlines the tile a tool would act on. `camera.ts`,
  `scrollWindow.ts` (no Pixi, so testable) and `placements.ts` (what stands
  where, as data) sit under both layers.
- **`src/render/packs/`** holds the `AssetPack` interface, the autotile
  masks, the code-drawn placeholder pack, and the Minifantasy loader with
  its sheet table.
- **`src/ui/`** is the HUD and the view. `hudModel(world)` turns state into
  plain numbers and `Hud.update` writes them into the markup in
  `index.html`; `edgeArrow` and `anchorPosition` are its geometry, pure.
  `view.ts` scales the one wrapper that holds everything on screen.
- **`src/input/`, `src/debug/`, `src/main.ts`, `src/frameClock.ts`** are the
  keyboard and pause, the debug overlay, the wiring, and the fixed-step
  clock.
- **`scripts/`** are `npm run map` and `npm run map:check`.
- **`tests/`** are Vitest. `stubPack.ts` is an `AssetPack` that draws
  nothing and records everything, so both layers run headless.
- **`public/maps/`** are the hand-edited maps.
  **`public/assets/minifantasy/`** is the art, gitignored.
