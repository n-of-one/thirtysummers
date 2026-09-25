# Build plan: the first five summers

[five-summers.md](five-summers.md) describes what is being built. This page
has the status and the order of the milestones. Each milestone has its own
file, which is deleted once the milestone is done.

**Status, 21 Sep 2026.** On 8 Sep the discovery test showed that the idea
works. Since then:

- **M8 is done.** It was built with stamina as a budget, and with meals. Its
  first playtest dropped both. What stayed is hydration, the fog and the end
  of a summer.
- **The QoL milestone is done.** The game is drawn in a fixed full HD view,
  tools act on the tile in front of the character, springs are reeds on the
  bank, fruit is stored at camp, and the last minute of a summer is dusk.
- **M9 is done.** It added seven resources in one table, saplings felled for
  logs, wells, caches, and a build menu on `B`. The menu replaced guessing
  the build from what was in the pack, which could not tell what the player
  meant. The generator now lays out the five-summer table itself, instead of
  the table being stamped into maps by hand.
- **The pack is done.** Camp takes every kind and was the first cache. A
  long press at camp or at a cache opens a panel with the pack on one side.
  A kind can be dropped on the ground and picked back up, so a full pack is
  never a dead end. What camp keeps is called camp, not "the store". Building
  it also set a rule for all world art, in
  [../architecture.md](../architecture.md): one art pixel is always the same
  size, and always on the grid.

On 21 Sep, after playing the winter prototype, the progression was redrawn:

- winter 1 has no shop, and the family's level opens it;
- ore is out, and the shells behind the copse never come back;
- the cache is parked, and the cart does its job;
- a list the player ticks in winter steers the summer.

[five-summers.md](five-summers.md) tells it as a story.

**M10 is built and played, and the first three years are not fun yet.** The
log is in [PLAYTEST.md](PLAYTEST.md), and what it decided is in
[../rationale/design.md](../rationale/design.md) under "The first three
years, and what they changed". Year 1 is close. Year 2 is a long walk to the
bridge followed by hauling, and the money does not add up unless the player
sells the material a bridge is made of. Year 3 is the same walk, made longer.
Nothing new goes on top of that. Instead, M10.1 to M10.6 answer the log one
change at a time, and each is played and judged on its own before the next
one starts. The cart, the well and eating fruit wait until after them.

**M10.1 is done** (24 Sep). The ring's food is 15 fruit under 5 trees, two
to four fruit each, hung where they can be seen. A shell sells for 6, and
material sells for nothing. Upkeep and the axe use the level 0 numbers until
M10.6. Collecting a winter's fruit is now a round trip of 113 tiles with
three or four stops, instead of 150 tiles of sweeping the ring.

**M10.2 is done** (24 Sep). Walking over underbrush wears it down one stage
per walk: trodden, trodden again, flat, and one walk after flat turns it
into grass. The change shows from the first walk. A cut leaves underbrush.
The forest noise sets how thick underbrush starts, in `FOREST_THRESHOLDS`,
together with dense underbrush and trees, so brush thins out toward the
clearings. Dense underbrush is the floor of a wood and never wears. Fruit
trees stand in underbrush, in dense underbrush first. Keeping the action key
pressed picks up feathers. The grass the layout laid north from camp is
gone, and so is the check that required a cut on the cart route. Questions
for the next playtest: is the line noticed on the first walk, and walked
again on purpose? Does the walk to the bridge get shorter over the summers?
Are three walks to flat, and one more to grass, the right numbers?

**M10.3 is done** (25 Sep). The character keeps a map of the ground seen in
any summer. A tile counts as seen when it is within 14 tiles of the player,
and less as the fog closes in. A circle of the map, 28 tiles in radius, sits
top right with the hydration bar under it, and the clock has moved to the
top left. M swaps the view for the whole valley, with the list and the pack
over it and the clock still running. The map shows terrain, bridges, camp,
every place to drink and the fruit trees. It does not show trails or what
there is to pick. It is drawn at one art pixel per tile, and it is saved. A
pointer on the edge of the corner map always shows the nearest place to
drink the family has seen. As the character becomes dehydrated, the corner
map shrinks until, at 25% hydration, it shows only what the player can see,
and the whole map fades until, at 0%, only its landmarks are left. Questions
for the next playtest: does the map make a summer feel like uncovering
ground? Is it looked at, and when? Does leaving the fields off the map leave
the player lost? Is a radius of 28 enough? Is the pointer to water a help or
a crutch? M10.4 is next, and its landmarks go on the map.

| Milestone | What it adds | Status |
|---|---|---|
| Chores | a clean tree to build on | done |
| M8: the body | hydration and fog, springs, the end of a summer, no sprint, no stamina | done |
| QoL | a fixed view, the tile in front for tools, the last minute as dusk, springs in the reeds, storing fruit, pause | done |
| M9: the map | saplings, wells, caches, seven resources, the build menu, the layout pass | done |
| The pack | camp as the first cache, the transfer panel, dropping a kind on the ground | done |
| M10: the first three years | the map for summers 1 to 3, the winter screen, the shop by family level, the list, the map between summers | done, and played: not fun yet |
| M10.1: fruit on trees | the ring's food on five trees, shells at 6, material with no price, the upkeep and axe numbers | done |
| M10.2: trails | underbrush worn away by walking over it, underbrush in degrees from the noise, dense underbrush | done |
| M10.3: the map | the map in the corner and the whole map on M, showing only ground that has been seen; what thirst does to both; the pointer to water | done |
| [M10.4: features in the ring](m10-4-terrain.md) | landmarks, the island, underbrush in patches | not started |
| [M10.5: camp that moves](m10-5-camp.md) | a camp pitched on ground the family has walked, granted by a family level | not started |
| [M10.6: upkeep by level](m10-6-upkeep.md) | a winter asked in fruit when poor and in rent when not | not started |
| [M11: the cart](m11-cart.md) | summer 4: the logistics experiment, and its road | being rethought |
| [M12: planks and the well](m12-planks-well.md) | summer 5: planks on mud, the well, the dry pocket | not started |
| [M13: fruit](m13-fruit.md) | eating a fruit for a burst of speed, in place of meals | not started |

**The order of M10.1 to M10.6** is cheapest first, and after that what each
one needs from the one before.

- The trees and the prices came first, because every later playtest is read
  against them, and until they were in, every session still hit the wall in
  year 2.
- Trails came next, because they answer the loudest complaint and cost one
  array and two thresholds.
- The map comes before the features in the ring, because the map is what
  the ring is then judged with, and it is much the cheaper of the two.
- Camp that moves comes after the map, where its sites are picked, and after
  the features in the ring, which is where it would be pitched.
- Upkeep by level is last, because its numbers are chosen against a summer
  that already has the other five in it.

**In reserve:** the cart in summer 2 instead of summer 4. The cart is the
designed answer to hauling, but it arrives two summers after hauling becomes
a problem. If trails and a camp that moves do not fix years 2 and 3, this is
the next thing to try, and summers 4 and 5 then need a new opening. It is in
[../design/ideas.md](../design/ideas.md) with the other answers that were
not taken.

**The order of the rest** is what each milestone needs from the one before.

- The pack jumped the queue, because it was a dead end rather than a missing
  feature, and because the map could not be played properly until it was
  fixed.
- The body (M8) came first, because the map is played with it.
- The map (M9) came second, because winter sells what the map yields.
- The first three years come before the cart, so they are fun on their own
  before anything more complex goes on top.
- The cart, and then planks and the well, follow the summers that use them.
- Eating fruit is last, because eating one only costs something once there
  is a winter that needs the fruit.

Each milestone can be played on its own. Every number is a `[GUESS]` in
`config.ts` unless five-summers.md gives it.

## Chores

- None. `src/sim/trace.ts` stays on the `itch-publish-1` branch: M10.2
  measured wear without it.

## At the end of each milestone

1. Everything in [../development.md](../development.md) under "What must
   keep passing" passes.
2. The milestone file's own verification, measured over the protocol.
3. Stop for review. Once the milestone is accepted, delete its file and mark
   it done in the table. What was learned building it goes into
   [../rationale/technical.md](../rationale/technical.md).

## After the log

Parked until the five-summer log in [PLAYTEST.md](PLAYTEST.md) is written:
the map under snow, the grave and its +1, the age curve past summer 5, gear,
structures and the mine, the lineage, hazards, z-levels.

The generator pass that lays out the five-summer table for each seed was
parked here too, but it was brought forward during M9: stamping a map by
hand is no way to change its layout, and the layout needed changing. It is
`sim/worldgen/layout.ts`, and `sim/worldgen/rows.ts` checks every generated
map against the table.

What the log decides moves into [../design/](../design/README.md) or
[../archive/](../archive/decided-against.md), and this folder is rewritten
for the next step.
