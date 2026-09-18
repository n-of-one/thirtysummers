# Build plan: the first five summers

What is being built is in [five-summers.md](five-summers.md). This page is
the status and the order. Each milestone has its own file, deleted once it is
done.

**Status, 18 Sep 2026.** The discovery test's verdict, on 8 Sep, was that
the idea works. M8 is done: it was built with stamina as a budget and
meals, its first playtest dropped both, and what stayed is hydration, the
fog and the end of a summer. The QoL milestone that followed is done too:
the game is drawn in a fixed full HD view, tools act on the tile ahead,
springs are reeds on the bank, fruit is banked into a store, and the end of
a summer is dusk. M9 is done: seven resources on one table, saplings felled
for logs, wells and caches, a build menu on `B` because building guessed
from the pack could not be told what you meant, and the five-summer table
laid out by the generator itself rather than stamped into maps by hand.
Five summers can be played back to back on any seed, with no winter yet.
M10, winter, is next.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | done |
| M8: the body | hydration and fog, springs, the end of a summer, no sprint, no stamina | done |
| QoL | a fixed view, the tile ahead for tools, the last minute with dusk, springs in the reeds, banking fruit, pause | done |
| M9: the map | saplings, wells, caches, seven resources, the build menu, the layout pass | done |
| [M10: winter](m10-winter.md) | the store, the winter screen, upkeep, the shop, the map between summers | not started |
| [M11: the cart](m11-cart.md) | the logistics experiment | not started |
| [M12: fruit](m12-fruit.md) | eating a fruit for a burst of speed, in place of meals | not started |

The order is what each needs from the one before. The body comes first,
because the map is played with it. The map is second, because winter sells
what the map yields. The cart is near the end, because it is the experiment
most likely to be cut. Fruit is last, because it needs a winter for eating
one to cost anything. Each milestone is playable on its own. Every number is
a `[GUESS]` in `config.ts` unless five-summers.md gives it.

## Chores

- `src/sim/trace.ts` and its test live only on `itch-publish-1`. M10's
  trails bring them back to main.

## At the end of each milestone

1. Everything in [../development.md](../development.md) under "What must
   keep passing" passes.
2. The milestone file's own verification, measured over the protocol.
3. A summer played by hand on `npm run dev`. Walk, wade through mud, stay
   out until the fog closes in and drink at a spring, fill the backpack,
   bank at camp, and watch the clock run out to the summary.
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
