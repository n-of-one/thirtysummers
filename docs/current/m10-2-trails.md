# M10.2: trails worn by walking

Underbrush walked over is trodden down a stage at a time until it is flat. The route
the player already takes becomes the route that is fast, so the trip that felt
like repetition is the trip that paid for the road, from the first summer
rather than from the fourth.

The design is in [../design/summer.md](../design/summer.md) under
*Improvements*, the reason in
[../rationale/design.md](../rationale/design.md).

**Depends on** nothing. M11's cart uses the same wear, so this is where the
mechanism is built and M11 only adds the pusher.

## Steps

1. **A wear count per tile.** A `Uint8Array` beside the tile grid in
   `sim/world.ts`. The player's centre leaving a tile adds one to that tile's
   count, once each time it leaves, and only if the tile is underbrush. Nothing
   else adds to it. It is counted on leaving, not on entering: with a tile
   trodden at one crossing, counting the entry would tread it the moment the
   centre stepped onto it, and fresh underbrush would never be crossed at its
   own speed. A centre walked along the seam between two rows moves through
   tiles on both sides, so one pass can wear both rows. That is allowed: it
   changes nothing that matters, and a player who finds it has earned it.
2. **Stages.** Each walk over a tile wears it one stage, and each stage has
   its own speed, `TRAIL_SPEED_MULS`: trodden at 0.7, trodden again at 0.85,
   then flat at 1.0, against underbrush's 0.5. `[GUESS]` all three. The first
   walk already leaves a line and already pays a little. The count stops at
   flat. Being played as an experiment: an earlier version turned the tile to
   grass at the second walk, and it worked, but the ring was on its way to a
   lawn and a path could no longer be told from open ground.
3. **Still underbrush.** A trail is not a terrain. The tile stays underbrush
   in the grid at every stage, and the speed lookup and the renderer read the
   wear beside it. So a flat tile still looks like undergrowth pressed down,
   and the paths the player made stay visible as paths. A flat tile is not
   rough ground: a tired summer does not slow it.
4. **Underbrush only.** Mud is not trodden into anything, because mud is what
   planks are for, and thicket is a wall, so the knife keeps its job. Nothing
   grows back over a worn tile yet; regrowth is for after this has been played.
   The thicket creep of `world.nextSummer` does not touch trails, except
   through a cut, below.
5. **A cut leaves undergrowth.** Cutting a thicket tile leaves underbrush, not
   grass (`CUT_LEAVES`), so the knife opens the wall and the feet make the
   path, and a cut path gets faster by being walked like any other. Thicket
   creep still takes back a cut tile next to thicket, walked or not, as it
   did before, and a trail through it goes with it: grown over, its wear is
   gone.
6. **Art**, in both packs: one tile per stage, each plainly further from
   underbrush than the last, with flat still reading as undergrowth and not as
   grass, on the grid and at one art pixel to a size as
   [../architecture.md](../architecture.md) requires. Minifantasy paints the
   brush stencil with a lighter, warmer tint per stage, so the ragged outline
   stays; the placeholder draws fewer clumps and more bare earth.
7. **The save**, `sim/save.ts`: the wear counts go in as `worn`, a list of tile
   index and count. That is all a trail is, so without it a game picked up at
   its winter would lose every path. Version 3. M10.1's partial nodes are not
   in it.
8. **No path laid north.** The layout no longer lays grass from camp to the
   feather field; that walk is worn by the player's feet like any other. The
   row that held a cart route to needing a cut went with it, since carts are
   being rethought.
9. **The path trace.** `src/sim/trace.ts` and its test live only on
   `itch-publish-1`. Not brought back: the wear itself is read over the
   protocol, and that was enough to measure with.

## Verification

- Walking a straight line over underbrush wears exactly the tiles the centre
  crossed and left, a stage a walk, and no others, read back over the
  protocol. The terrain grid does not change.
- The same route timed on each crossing until flat, on one seed, reported in
  seconds: one gain per stage. Non-vacuous by breaking the stage lookup and
  watching the gains disappear.
- Every stage survives a winter and a save and load, and thicket creep has
  not taken any of it.
- How much a summer wears, reported and not judged: after one summer played
  by hand on a seed, the count of tiles at each stage, and a screenshot of the
  worn tiles over the map. A scripted walk is no use here, since it wears
  whatever it was scripted to walk.
- Mud crossed the same number of times is unchanged.

## The playtest question

Is the line noticed on the first walk, and is it read as "my feet did this"?
Does the player walk back along it on purpose the first time they return the
same way? Does the second summer's walk to the bridge feel like it is getting
shorter? Do the stages read as a path getting better, and does flat still
read as a path the player made rather than as open ground? Are three walks to
flat the right number?
