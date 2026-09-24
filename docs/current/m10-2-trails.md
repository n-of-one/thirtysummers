# M10.2: trails worn by walking

Underbrush walked over enough times is trodden down and then gone. The route
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
2. **Two thresholds.** At `TRAIL_WEAR_SHOW` the tile draws as trodden
   underbrush and is pushed through at `TRAIL_SPEED_MUL` instead of
   `UNDERBRUSH_SPEED_MUL`, so the first walk already leaves a line and already
   pays a little. At `TRAIL_WEAR_STEPS` the tile becomes grass, through the
   same path as any other terrain change, so it lands in the save's terrain
   diff and survives the winter. `[GUESS]` 1 and 2, and 0.7 against
   underbrush's 0.5. Trodden is not a terrain: the tile stays underbrush in the
   grid, and the speed lookup reads the wear count beside it.
3. **Underbrush only.** Mud is not trodden into anything, because mud is what
   planks are for, and thicket is a wall, so the knife keeps its job. Nothing
   grows back over a worn tile, which is what makes walking the same line worth
   doing; the thicket creep of `world.nextSummer` does not touch them.
4. **Art**, in both packs: a trodden underbrush tile, plainly between
   underbrush and grass, on the grid and at one art pixel to a size as
   [../architecture.md](../architecture.md) requires.
5. **The save**, `sim/save.ts`: the wear counts go in as `worn`, a list of tile
   index and count, so a game picked up at its winter does not lose the
   half-worn tiles. Version 3, together with M10.1's partial nodes if that has
   landed.
6. **The path trace.** `src/sim/trace.ts` and its test live only on
   `itch-publish-1`, and [PLAN.md](PLAN.md) has them coming back with the
   trails. If the trace is what this milestone wants to measure wear with,
   bring it back here.

## Verification

- Walking a straight line over underbrush `TRAIL_WEAR_STEPS` times flips
  exactly the tiles the centre crossed and no others, read back from the
  terrain diff over the protocol.
- The same route timed on the first, second and third crossing, on one seed,
  with the differences reported in seconds: the second is the trodden gain,
  the third the grass gain. Non-vacuous by setting both thresholds to
  something unreachable and watching both gains disappear.
- A worn tile is still grass after a winter and after a save and load, and
  thicket creep has not taken it.
- How much a summer wears, reported and not judged: after one summer played
  by hand on a seed, the count of tiles trodden and tiles flipped, and a
  screenshot of the worn tiles over the map. Whether that is a few lines or a
  lawn round camp is the playtest's call, below. A scripted walk is no use
  here, since it wears whatever it was scripted to walk.
- Mud crossed the same number of times is unchanged.

## The playtest question

Is the line noticed on the first walk, and is it read as "my feet did this"?
Does the player walk back along it on purpose the first time they return the
same way? Does the second summer's walk to the bridge feel like it is getting
shorter? Is two crossings to grass too generous, so that the ring turns to
lawn without anyone choosing a route?
