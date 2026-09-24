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
   `sim/world.ts`. The player's centre entering a tile it was not on last tick
   adds one to that tile's count, once per entry, and only if the tile is
   underbrush. Nothing else adds to it.
2. **Two thresholds.** At `TRAIL_WEAR_SHOW` the tile draws as trodden
   underbrush: same speed, different art, so a line forming is watched. At
   `TRAIL_WEAR_STEPS` the tile becomes grass, through the same path as any
   other terrain change, so it lands in the save's terrain diff and survives
   the winter. `[GUESS]` 3 and 6.
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
- The same route timed on the first crossing and after the line is worn, on
  one seed, with the difference reported in seconds. Non-vacuous by setting
  `TRAIL_WEAR_STEPS` to something unreachable and watching the gain disappear.
- A worn tile is still grass after a winter and after a save and load, and
  thicket creep has not taken it.
- A summer of ordinary play does not turn the ring into a lawn: the count of
  tiles flipped after one summer on a seed, which should be a line of tens and
  not a field of hundreds.
- Mud crossed the same number of times is unchanged.

## The playtest question

Is the wear noticed, and is it noticed before a tile flips? Does the second
summer's walk to the bridge feel like it is getting shorter, and does the
player start following their own line on purpose? Is 6 crossings too generous
or too mean?

## Open

Whether a trodden tile should also be a little faster, rather than only
looking different. It would be felt earlier and it would blur the moment the
tile gives way, which is the reward. Left as art alone until the log says
otherwise.
