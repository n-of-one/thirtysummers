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
- **`src/config.ts` has every tunable number**, each marked `[DOC]` (from
  `docs/design/` or `docs/current/five-summers.md`) or `[GUESS]` (tune
  freely). Numbers do not belong in logic.
- **One art pixel is one size, everywhere in the world, and always on the art
  grid.** Every sprite the world is made of -- ground, props, the player,
  anything dropped or built -- is drawn at `TILE / pack.tileSize` screen pixels
  per art pixel, and snapped so its pixels land on that grid. So: never scale a
  sprite by a fraction, never scale one axis differently from the other, never
  rotate by anything but a quarter turn, and never place one on half a pixel.
  Something that needs to look smaller is **drawn** smaller -- fewer art pixels
  at the same size -- or resampled to a whole number of art pixels first; it is
  never shrunk on the way to the screen. Half-scale art, 0.75 scale, squashing
  to read as "flat": all of it is out, however tidy the arithmetic looks, and it
  does not become acceptable because one sprite is small or far from the eye.
  The HUD, the prompts and the menus are not world art and are exempt: they are
  the HTML overlay, and they scale with the view. The one exception is the
  map in the corner, which is a picture of the world and keeps the rule: a
  tile is one art pixel, and its corner is on the art grid.
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
| Map | 168×168 tiles generated, inside a rock border 20 thick so the camera can stay centred at the edge of play. A laid-out map is the valley plan turned and scaled, about 312×465 at `VALLEY.scale` 1.3, with 24 tiles of rock round the floor. `TILE = 32` logical px, 8px source art at 4× scale. |
| View | A fixed logical view of `VIEW_W × VIEW_H`, 1920×1080, scaled to fit the window in steps of 1/8 with black bars. |
| HUD | HTML/CSS overlay on top of the canvas. |
| Art | Minifantasy, behind a swappable pack layer. |
| Hosting | Localhost only. |

## Modules

- **`src/sim/`** is the whole game with no renderer. `world.ts` owns
  everything: `world.step(dt, input)`, the tools and recipes owned, the wells
  and what is stored at camp, the items dropped on the ground and the
  selected kind the drop key throws, the wear the player's feet leave on
  underbrush with `trodden()` for the renderer to read, `seen` and
  `seenCount`, every tile the family has seen in any summer, marked round
  the player's tile after each move, `transferTarget()` with `putAway` and
  `takeOut` for the transfer panel, and `availableAction`, the one query that
  decides what the action key does. Between summers it owns the family's
  total, the list and whether the next summer is tired: `winterInput()` is
  what the winter screen opens on, `endWinter()` applies what was chosen
  there, and `nextSummer()` lets the winter have its way with the map first
  (nodes back by the near ring and the resource table, saplings back,
  thicket creeping, a bridge tile lost), all from the seed and the year.
  Around it: `winter.ts` (winter as arithmetic: what is kept and sold, upkeep,
  the shop, the family and the frosted line, with no DOM), `shop.ts` (the
  shop's table, each item with the family level that unlocks it), `list.ts`
  (the list's lines and how they fill from the top), `economy.ts` (the
  perfect player, played over a map's counts through `winter.ts`),
  `stats.ts` (hydration, and `sightRadiusTiles`, the one radius the fog is
  drawn from and the seen circle is marked from), `seen.ts` (which tiles a
  circle marks, and the seen mask as run lengths for the save),
  `resources.ts` (the resource table: glyph, ground, slots,
  price, whether it comes back outside the near ring, what camp does with it,
  whether it is building material), `inventory.ts` (slots, and camp with no
  limit), `player.ts` (collision, per-axis moving flags, the heading),
  `interaction.ts` (what is in reach, the tile ahead, water nearby),
  `terrain.ts` and `tilemap.ts` (the terrain table and the grid),
  `mapfile.ts` (the text map format), `summary.ts` (a summer counted from
  the event log), `save.ts` (a game at the end of a summer as a URL string;
  `world.snapshot` and `world.restore` fill and read it).
- **`src/sim/worldgen/`** turns a seed into a map: noise into terrain and a
  camp (`terrain.ts` reads the forest noise through a set of ground settings,
  `GROUND` or the near ring's own `RING_GROUND`, into underbrush at a
  starting trail stage, dense underbrush, trees and mud), stream thickening
  and fords, a flood fill from camp, resources
  scattered by terrain, springs on the bank. `worldgen.ts` says what order the
  steps run in, and why. `valley.ts` lays the valley out for a seed as masks:
  the plan in `VALLEY` turned and scaled, the river and the lake, the first
  stream ending in its falls, the ponds, the cliff, camp's part and camp.
  `layout.ts` paints the landscape over those masks and lays the table on it,
  and is what `World.fromSeed` and `npm run map` build. In M10.6a it lays the
  near ring's food only; the fields come back in M10.6b. `brambleBay.ts`
  finds and lays down the near ring's bramble bay, the sticks behind
  brambles, and is not called until M10.6b. `rows.ts` measures
  whether a map matches that table, economy included, and is shared by the
  layout's tests and `npm run map:check`. `reachability.ts` has `nearRing`,
  the near ring worked out from the map, so a hand-edited file keeps the
  rule that everything inside it is back every year.
- **`src/render/`** is Pixi only. `tileLayer.ts` is the culled, autotiled
  ground; a cliff tile's mask is its own, `cliffMask`, which says where the
  water is rather than where more cliff is. `propLayer.ts` is the y-sorted props and player, with pixel
  snapping. `silhouette.ts` redraws the player where a canopy covers them.
  `targetMarker.ts` outlines the tile a tool would act on. `camera.ts`,
  `scrollWindow.ts` (no Pixi, so testable) and `placements.ts` (what stands
  where, as data) sit under both layers.
- **`src/render/packs/`** has the `AssetPack` interface, the autotile
  masks, the code-drawn placeholder pack, and the Minifantasy loader with
  its sheet table. Art the sheets do not have -- the feather, the sapling, a
  dropped item on its shadow -- is built there as pixels, never by scaling a
  sprite.
- **`src/ui/`** is the HUD and the view. `hudModel(world)` turns state into
  plain numbers and `Hud.update` writes them into the markup in
  `index.html`; `edgeArrow` and `anchorPosition` are its geometry, pure.
  `mapPicture.ts` is the valley as seen, a colour a tile, with drinking
  spots, fruit trees and camp marked and no resource nodes, and the fade the
  whole map takes as the player becomes dehydrated, until only its landmarks
  are left. `mapWidget.ts` draws it two ways: as a circle round the player in
  the top right, under the clock and the hydration bar, which are centred
  over it, the circle shrinking to what
  the player sees as they become dehydrated and a pointer on its rim to the
  nearest seen
  water; or as the whole valley that M puts in place of the tile view. It
  redraws only when the player's tile, the seen count, the fade's step or the
  ground it shows changes. M10.7's winter screen is meant to draw the same
  picture larger.
  `buildMenu.ts` is the menu B opens: it draws `world.buildOptions()` and
  reports the choice back, and never writes simulation state itself.
  `transferPanel.ts` is the panel a long press of the action key opens at
  camp; the world announces it in the log, and every move goes back through
  `world.putAway` and `world.takeOut`. `winter.ts` is the winter screen the
  end of a summer opens: it keeps only the player's choices and the list's
  unticked boxes, draws every number from `sim/winter.ts`, and hands the
  choices back for `world.endWinter`. It also shows the save link and the
  summer in numbers. The list and the start-of-summer notice
  are part of the HUD model.
  `view.ts` scales the one wrapper that contains everything on screen.
- **`src/input/`, `src/debug/`, `src/main.ts`, `src/frameClock.ts`** are the
  keyboard and pause, the debug overlay, the wiring, and the fixed-step
  clock.
- **`scripts/`** are `npm run map` and `npm run map:check`.
- **`tests/`** are Vitest. `stubPack.ts` is an `AssetPack` that draws
  nothing and records everything, so both layers run headless.
- **`public/maps/`** has dumps of particular seeds, editable by hand, and
  is empty but for its README: testing is on seeds, and a file is made only
  when a map is worth freezing.
  **`public/assets/minifantasy/`** is the art, gitignored.
