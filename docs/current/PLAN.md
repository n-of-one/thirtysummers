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
summer. [five-summers.md](five-summers.md) tells it as a story.

**M10 is built and played, and the first three years are not fun yet.** The
log is in [PLAYTEST.md](PLAYTEST.md) and what it decided is in
[../rationale/design.md](../rationale/design.md) under "The first three years,
and what they changed". Year 1 is close. Year 2 is a long walk to the bridge
and then hauling, with money that does not add up without selling the material
a bridge is made of, and year 3 is the same walk made longer. Nothing goes on
top of that, so M10.1 to M10.6 answer the log one change at a time, each played
and judged on its own before the next one starts. The cart, the well and fruit
wait behind them.

**M10.1 is done**, on 24 Sep. The ring's food is 15 fruit under 5 trees, two to
four each and hung where they can be seen; a shell is 6 and material sells for
nothing; upkeep and the axe are at level 0's numbers until M10.6. A winter's
fruit is a 113-tile round trip of three or four stops, against 150 tiles of
sweeping the ring. M10.2 is next.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | done |
| M8: the body | hydration and fog, springs, the end of a summer, no sprint, no stamina | done |
| QoL | a fixed view, the tile ahead for tools, the last minute with dusk, springs in the reeds, banking fruit, pause | done |
| M9: the map | saplings, wells, caches, seven resources, the build menu, the layout pass | done |
| The pack | camp as the first cache, the transfer panel, dropping a kind on the ground | done |
| M10: the first three years | the map for summers 1 to 3, the winter screen, the shop by family level, the list, the map between summers | done, and played: not fun yet |
| M10.1: fruit on trees | the ring's food on five trees, shells at 6, material with no price, the upkeep and axe numbers | done |
| [M10.2: trails](m10-2-trails.md) | underbrush worn away by walking over it | not started |
| [M10.3: the map](m10-3-map.md) | the map in the corner, holding only ground that has been seen | not started |
| [M10.4: the shape of the ring](m10-4-terrain.md) | landmarks, the island, underbrush in patches | not started |
| [M10.5: camp that moves](m10-5-camp.md) | a camp pitched on ground the family has walked, granted by a family level | not started |
| [M10.6: upkeep by level](m10-6-upkeep.md) | a winter asked in fruit when poor and in rent when not | not started |
| [M11: the cart](m11-cart.md) | summer 4: the logistics experiment, and its road | being rethought |
| [M12: planks and the well](m12-planks-well.md) | summer 5: planks on mud, the well, the dry pocket | not started |
| [M13: fruit](m13-fruit.md) | eating a fruit for a burst of speed, in place of meals | not started |

**The order of M10.1 to M10.6** is cheapest first, and what each needs from
the one before. The trees and the prices came first because every playtest
after them is read against them, and until they landed every session still hit
the year 2 wall. Trails next, because they are the answer to the complaint that
was loudest and they cost one array and two thresholds. The map before the
shape of the ring, because the map is the instrument the ring is then judged
with, and it is much the cheaper of the two. Camp comes after the map, which is
where its sites are picked, and after the ring, which is what it would be
pitched in. Upkeep by level is last because its numbers are chosen against a
summer that already has the other five in it.

Held in reserve: the cart in summer 2 instead of summer 4, which is the
designed answer to hauling arriving two summers after hauling breaks. If
trails and a camp that moves do not fix years 2 and 3, that is the next lever,
and summers 4 and 5 then need a new opening. It is in
[../design/ideas.md](../design/ideas.md) with the other answers that were not
taken.

The order of the rest is what each needs from the one before. The pack jumped the queue
because it was a dead end rather than a missing feature, and because the map
could not be played with properly until it was gone. The body comes first,
because the map is played with it. The map is second, because winter sells
what the map yields. The first three years come before the cart, so they
are fun on their own before anything more complex goes on top. The cart and
then planks and the well follow the summers that use them. Fruit is last,
because it needs a winter for eating one to cost anything. Each milestone is playable on its own. Every number is
a `[GUESS]` in `config.ts` unless five-summers.md gives it.

## Chores

- `src/sim/trace.ts` and its test live only on `itch-publish-1`. M10.2's
  trails bring them back to main, if the wear is easier to measure with them.

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
