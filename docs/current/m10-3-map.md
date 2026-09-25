# M10.3: the map in the corner

The character keeps a map. It holds only ground that has been seen at some
point in some summer, and it fills over a life. It is the one record of where
the family has been, and it is what makes a summer feel like uncovering
something rather than walking the same valley again.

The design is in [../design/summer.md](../design/summer.md) under *The map you
have walked*. Dimming the play view instead is in
[../archive/decided-against.md](../archive/decided-against.md).

**Depends on** nothing, and M10.5 depends on it: a camp can only be pitched on
ground the family has seen, and the winter screen picks the site off this map.

## What is seen

The fog is never off. At full hydration its clear circle is 9 tiles and it is
black by 17, so the sides of the view are always dark, and marking the whole
view would fill the map with ground nobody saw. What is seen is a circle round
the player instead: 14 tiles at full hydration, 14/9 of the fog's clear
radius, shrinking with the fog to about 4 tiles when dry. A tile is seen when its
centre is inside that circle. Running dry therefore costs the survey as well as
the view, with nothing extra to build.

It is worked out in the simulation from the player's position, not from the
camera. The camera follows closely enough that the difference does not show,
and this way the mask is deterministic, testable and saved.

## The widget

A circle of radius 28, 57 tiles across, top right with the hydration bar
under it and the clock moved to the top left, with the player's tile
in the middle cell: twice the radius of the seen circle at full hydration,
which fills its middle, with a ring round it of ground seen before, or blank. The rest of the
valley is only behind M, below.

**It follows the art-pixel rule.** Every tile on it is one art pixel, 4 logical
pixels (`TILE / pack.tileSize`), and its corner sits on a multiple of 4. It
scrolls a whole tile at a time as the player crosses a tile boundary. The
circle's edge is tiles in or out, stepped, never a CSS radius cutting through
an art pixel. It is the one part of the HUD the rule covers, and
[../architecture.md](../architecture.md) says so.

## Steps

1. **Sight in tiles, in the simulation.** `sightRadiusTiles(hydration)` in
   `sim/stats.ts` replaces `fogRadiusPx` in `ui/hud.ts`, which then draws the
   fog from it times `TILE`. `FOG_MAX_RADIUS_SHARE` becomes
   `FOG_MAX_RADIUS_TILES = 9`, so the fog no longer scales with `?view=`.
   `SEEN_RADIUS_MUL = 14/9` in `config.ts` ties the seen circle to it.
2. **The seen mask.** `world.seen`, a `Uint8Array` beside the wear, and
   `world.seenCount`. Marked at construction and at `nextSummer`, so camp is
   seen before the first step, and in `step()` after the player moves --
   only when the player's tile changes or the radius grows at a drink, since
   a shrinking circle round the same tile reveals nothing. A teleport marks
   where it lands and nothing between.
3. **The picture.** `ui/mapPicture.ts`, a pure function from a world and a tile
   to a colour, or none for unseen. Coarse classes from the terrain table:
   easy ground, rough ground, dense underbrush, mud, water, trees and saplings,
   rock and thicket, and bridges. Only the terrain: a trail's stages of wear
   are not drawn, so worn underbrush is underbrush until it is walked into
   grass. Every drinking spot on top, a spring in the reeds as much as a
   well, in one light blue, since where to drink is what a thirsty player
   looks at the map for; camp on top too; room
   for M10.4's landmarks. A fruit tree is a landmark, drawn as a 2 by 2 block
   in the fruit colour from its trunk, always, picked or not. It is found as a
   tree tile with a fruit node on one of its eight neighbours, which is how the
   layout hangs fruit. No resource node is drawn: the field the player
   remembers is the reward for having gone there. Colours are `[GUESS]`es in `config.ts`.
   M10.5 draws the same picture larger on the winter screen, so there is one
   picture of the valley.
4. **The widget**, `ui/mapWidget.ts` and `ui/hud.css`: a 57 by 57 canvas at
   one canvas pixel a tile, scaled 4x with `image-rendering: pixelated`, 228
   logical pixels across. Its circle is cut by the same rule `markCircle`
   marks by, so the seen circle sits in its middle cell for tile; cells never
   seen show as a dark blank. Outside the circle it is transparent; the
   player is one art pixel in the middle cell. The whole window, about 2500
   tiles, is redrawn when the player's
   tile changes, when `seenCount` changes, or when a `cut`, `built`, `felled`,
   `dug` or `summerStarted` event arrives, or a `trodden` one that turned a
   tile into grass; otherwise nothing is drawn.
   Rebuilt on regenerate. A checkbox in the debug panel hides it.
5. **It persists.** `seen` goes into `sim/save.ts` as run lengths, starting
   with an unseen run, since most of it is blank early and most of it is set
   late. The format goes to version 4, and version 3 saves are refused, as a
   version change already does. `restore` fills the mask back in.
6. **M swaps the view for the whole map.** The same widget, laid out as the
   whole valley at the most art pixels a tile that fit the view, up to
   `MAP_WHOLE_MAX_ART_PX` (3), centred: 800 by 720 with the Minifantasy art,
   1200 by 1080 with the placeholder. The world, the fog, the dusk, the corner
   map and what hangs off the player hide; the list, the pack, the bar, the
   clock and the tools stay, painted over it. M again closes it. Nothing
   pauses for it: the clock runs and the player can walk with it open, the
   same as the build menu. M while paused only resumes.
7. **The corner map shrinks as the player runs dry.** Otherwise a dry player
   navigates by it while the fog has closed in, which undoes what the fog is
   for. `minimapRadius` in `ui/mapWidget.ts`: radius 28 down to the fog's
   threshold (50%), then closing a whole ring at a time to meet what the
   player sees -- the seen radius -- at `MAP_SHRINK_CATCH_UP_HYDRATION` (25%,
   radius 9), and following it below, down to 4 at 0%. A drink puts it back
   at once, as it does the fog. The debug panel's hydration slider, with the
   freeze on, holds it at any point to look at.

   Tried and dropped: shrinking from 75% to meet the seen radius at 50%, and
   the real fog's gradient laid over the map, which only showed where the
   player had come from while new ground at the map's edge stayed sharp.
8. **The whole map fades as the player runs dry, all but its landmarks.**
   Down to the fog's threshold it is whole; below it every tile fades towards
   the unseen blank, and at 0% only the landmarks are left: the river and its
   bridges, thicket, drinking spots, fruit trees and camp. So a dry player
   still finds the water and the way round, but not the ground between. The
   fall is even to the eye, not in the numbers: the eye judges brightness
   roughly as the cube root of the light, so the light falls as the cube of
   the brightness, mixed in linear light (`fade` and `dryBrightness` in
   `ui/mapPicture.ts`). It moves in `MAP_DRY_FADE_STEPS` (25) steps, a redraw
   every 2% of hydration.

## Tests

- The seen circle: which tiles, clipped at the map's edge, and its radius at
  full, at the threshold and at zero hydration.
- The mask survives `nextSummer`, and a teleport marks only where it lands.
- Run lengths round trip an empty mask, a full one and a ragged one.
- The picture, class by class, and nothing for an unseen tile.

## Verification

- A path driven over the protocol with the player's position read back each
  tick, then the seen count compared with the tiles those positions' circles
  covered. Equal, not approximately.
- A teleport with `?debug=1` to the far corner and back leaves the ground
  between them unseen, checked in the mask and in a screenshot of the widget
  halfway along.
- The mask survives `nextSummer` and a save and load.
- A summer run dry marks fewer tiles than the same walk kept watered, with the
  two numbers reported. Non-vacuous by fixing the seen radius at full and
  watching them meet.
- The corner map paints exactly the cells of its circle, and at full
  hydration every cell of the seen circle in its middle is a seen tile.
- The widget's tiles are 4 logical pixels and its corner on the grid, read
  back from the page.
- Frame time over a summer at 10x with the widget on and off, so the redraw
  cost is a number and not an opinion.
- The corner map's circle read back from the canvas at hydrations from 100 to
  0, set with the debug slider: 28 down to 50%, the seen radius rounded from
  25% down.
- M pressed as a real key: the whole map's size and place read back, the tile
  view hidden and the HUD shown, a walk with it open that moves the player and
  redraws the map, M again restoring the view, and M while paused only
  resuming.

## The playtest question

Does the map make a summer feel like uncovering ground? Is it looked at, and
when? Does not marking the nodes leave the player lost, or is remembering the
fields the good part? Is a corner of radius 28 enough, and how often is M
pressed, and when? Is the top right the right place, beside the list across
the top?
