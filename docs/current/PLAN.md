# Build plan: the first five summers

What is being built is in [five-summers.md](five-summers.md). This page is
the status and the order. Each milestone has its own file, deleted once it is
done.

**Status, 21 Sep 2026.** The discovery test's verdict, on 8 Sep, was that
the idea works. M8 is done: it was built with stamina as a budget and
meals, its first playtest dropped both, and what stayed is hydration, the
fog and the end of a summer. The QoL milestone that followed is done too:
the game is drawn in a fixed full HD view, tools act on the tile ahead,
springs are reeds on the bank, fruit is banked at camp, and the end of
a summer is dusk. M9 is done: seven resources on one table, saplings felled
for logs, wells and caches, a build menu on `B` because building guessed
from the pack could not be told what you meant, and the five-summer table
laid out by the generator itself rather than stamped into maps by hand.
The pack is done: camp takes every kind and is the first cache, a held key
at camp or a cache opens a panel with the pack on one side, and a kind can
be dropped on the ground and picked back up, so a full pack is never a dead
end. What camp keeps is called camp, not the store. Building it also set a
rule for all world art, in [../architecture.md](../architecture.md): one art
pixel is one size, always on the grid. Five summers can be played back to
back on any seed, with no winter yet.

The progression was then redrawn, on 21 Sep, from playing the winter
prototype: winter 1 has no shop, and the family's level is what opens it;
ore is out and shells behind the copse never come back; the cache is parked
and the cart does its job; and a list the player ticks in winter steers the
summer. [five-summers.md](five-summers.md) tells it as a story. M10 is now
the first three years, so they are fun before anything is built on them.
M10 is built and waiting for review.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | done |
| M8: the body | hydration and fog, springs, the end of a summer, no sprint, no stamina | done |
| QoL | a fixed view, the tile ahead for tools, the last minute with dusk, springs in the reeds, banking fruit, pause | done |
| M9: the map | saplings, wells, caches, seven resources, the build menu, the layout pass | done |
| The pack | camp as the first cache, the transfer panel, dropping a kind on the ground | done |
| [M10: the first three years](m10-three-years.md) | the map for summers 1 to 3, the winter screen, the shop by family level, the list, the map between summers | in review |
| [M11: the cart](m11-cart.md) | summer 4: the logistics experiment, and trails | not started |
| [M12: planks and the well](m12-planks-well.md) | summer 5: planks on mud, the well, the dry pocket | not started |
| [M13: fruit](m13-fruit.md) | eating a fruit for a burst of speed, in place of meals | not started |

The order is what each needs from the one before. The pack jumped the queue
because it was a dead end rather than a missing feature, and because the map
could not be played with properly until it was gone. The body comes first,
because the map is played with it. The map is second, because winter sells
what the map yields. The first three years come before the cart, so they
are fun on their own before anything more complex goes on top. The cart and
then planks and the well follow the summers that use them. Fruit is last,
because it needs a winter for eating one to cost anything. Each milestone is playable on its own. Every number is
a `[GUESS]` in `config.ts` unless five-summers.md gives it.

## Chores

- `src/sim/trace.ts` and its test live only on `itch-publish-1`. M11's
  trails bring them back to main.

## At the end of each milestone

1. Everything in [../development.md](../development.md) under "What must
   keep passing" passes.
2. The milestone file's own verification, measured over the protocol.
3. A summer played by hand on `npm run dev`. Walk, wade through mud, stay
   out until the fog closes in and drink at a spring, fill the backpack,
   drop a kind and pick it back up, store the load at camp, hold the key
   there to take something back out, and watch the clock run out to the
   summary, and on through the winter screen into the next summer.
4. With `?debug=1`, a summer run out at 10x in 30 seconds, the grid
   toggled, a teleport across the map, the bars frozen.
5. Stop for review. Once accepted, delete the milestone file and mark it
   done in the table. What was learned building it goes into
   [../rationale/technical.md](../rationale/technical.md).

## After the log

Parked until the five-summer log in [PLAYTEST.md](PLAYTEST.md) has been
written: the map under snow, the grave and its +1, the age curve past summer
5, gear, structures and the mine, the lineage, hazards, z-levels.

The generator pass that builds the five-summer table per seed was parked here
too, and was brought forward during M9: hand-stamping a map is no way to
change its shape, and the shape needed changing. It is
`sim/worldgen/layout.ts`, and `sim/worldgen/rows.ts` is what holds it to the
table.

What the log decides moves into [../design/](../design/README.md) or
[../archive/](../archive/decided-against.md), and this folder is rewritten
for the next step.
