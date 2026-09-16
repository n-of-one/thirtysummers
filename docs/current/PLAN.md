# Build plan: the first five summers

What is being built is in [five-summers.md](five-summers.md). This page is
the status and the order. Each milestone has its own file, deleted once it is
done.

**Status, 15 Sep 2026.** The discovery test's verdict, on 8 Sep, was that
the idea works. The chores are done. M8 was built with stamina as a budget
and meals, and its first playtest dropped both. It has been stripped back
to hydration and the end of a summer, and is waiting for review.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | done |
| [M8: the body](m8-body.md) | hydration and fog, springs, the end of a summer, no sprint, no stamina | in review |
| [M9: the map](m9-map.md) | saplings, springs, wells, caches, seven resources, five new maps | not started |
| [M10: winter](m10-winter.md) | the store, the winter screen, upkeep, the shop, the map between summers | not started |
| [M11: the cart](m11-cart.md) | the logistics experiment | not started |
| [M12: fruit](m12-fruit.md) | eating a fruit for a burst of speed, in place of meals | not started |

The order is what each needs from the one before. The body comes first,
because the map is played with it. The map is second, because winter sells
what the map yields. The cart is near the end, because it is the experiment
most likely to be cut. Fruit is last, because it needs a winter for eating
one to cost anything. Each milestone is playable on its own. Every number is
a `[GUESS]` in `config.ts` unless five-summers.md gives it.

## Chores before M8

- The "day" vocabulary is gone from the working tree: `dayOver` is
  `summerOver`, `DaySummary` is `SummerSummary`, and the comments, test
  names and [../rationale/technical.md](../rationale/technical.md) follow.
  It needs reviewing and committing.
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
5, gear, structures and the mine, the lineage, hazards, z-levels, and a
generator pass that builds the five-summer table per seed with the edited
maps as its fixtures.

What the log decides moves into [../design/](../design/README.md) or
[../archive/](../archive/decided-against.md), and this folder is rewritten
for the next step.
