# Build plan: the first five summers

What is being built is in [five-summers.md](five-summers.md). This page is
the status and the order. Each milestone has its own file, deleted once it is
done.

**Status, 13 Sep 2026.** The discovery test's verdict, on 8 Sep, was that
the idea works. None of the milestones below has started. The chores come
first.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | to do |
| [M8: the body](m8-body.md) | stamina as a budget, meals, hydration and fog, no sprint | not started |
| [M9: the map](m9-map.md) | saplings, springs, wells, caches, seven resources, five new maps | not started |
| [M10: winter](m10-winter.md) | the store, the winter screen, upkeep, the shop, the map between summers | not started |
| [M11: the cart](m11-cart.md) | the logistics experiment | not started |

The order is what each needs from the one before. The body comes first,
because every barrier is priced in it. The map is second, because winter
sells what the map yields. The cart is last, because it is the experiment
most likely to be cut. Each milestone is playable on its own. Every number
is a `[GUESS]` in `config.ts` unless five-summers.md gives it.

## Chores before M8

Done in one commit, so the tree is clean before anything is built on it.

- The seventeen untracked M7 files (`src/env.ts`, `src/sim/trace.ts`,
  `src/sim/playtestLog.ts`, the bake, the baked pack, `table.ts`, the log
  export, `scripts/itch.ts`, `scripts/readlog.ts`, their tests, `bake.html`,
  `dev/bake.ts`, `src/build.d.ts`) belong on `itch-publish-1`, which was
  committed without them. Commit them there, then remove them from main.
  Exception: `trace.ts` and its test stay on main if M8's verification
  wants a per-second sample, and M10's trails need it anyway.
- The art moved to `art/minifantasy/` for M7 and main's loader reads
  `public/assets/minifantasy/`. Make sure it is back there and that
  `npm run dev` logs pack "minifantasy".
- Commit the docs restructure.
- The "day" vocabulary goes, alongside M8: `dayOver`, `DaySummary`,
  `summarise`'s comments, the `[DOC]` notes that cite the day.

## At the end of each milestone

1. Everything in [../development.md](../development.md) under "What must
   keep passing" passes.
2. The milestone file's own verification, measured over the protocol.
3. A summer played by hand on `npm run dev`. Walk, wade until stamina
   empties and see rough ground refused, eat both meals and see the third
   refused, drink at a bank, fill the backpack, bank at camp, and watch the
   clock run out to the summary.
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
