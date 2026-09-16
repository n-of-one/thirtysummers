# The first five summers

What the step being built now is: the first five summers of the first life,
on one hand-edited map, with a winter between each. Milestones M8 to M11 in
[PLAN.md](PLAN.md) build it, and the test maps are edited to the table at
the end. The general rules are in [../design/](../design/README.md). This
document holds only what is particular to these five summers.

## What it tests

Each summer opens one thing and gains one key, and the winter between them
spends the gold. The question for the log is whether summers 2 to 5 stay
interesting. On the discovery test's maps they did not. Summers 2 and 3
turned into a routing exercise, because nothing changed but the resources
and gold had nothing to buy.

The second question is the cart. Does cutting a road so a cart can run from
a cache to camp feel like play, or like hauling?

The unit of play is five summers of four minutes on one map, about
twenty-five minutes with the winters. Summer length is a per-year table in
config, so the age curve can come later without touching logic.

## The body

Every summer is the year-1 length until the age curve comes in. Hydration
is the one bar, and fog is the only consequence of running dry. Time is
what a summer spends: rough ground is slow, and a cut, a felling, a bridge
tile and a well are each a hold whose length is the price.

A summer after missed upkeep is a tired one. Every hold takes half as long
again, and rough ground is walked at 25% of walking speed instead of 40%.
Easy ground is walked as fast as ever.

## The map

All five barrier kinds in [../design/summer.md](../design/summer.md) are
used, arranged like this:

- **The first stream** is a half circle around camp, with springs along
  both sides. Inside it is the near ring.
- **The near ring** holds a thin thicket, about three tiles, walling in the
  sapling stand where the sticks are, and the mud pocket where the vines
  are.
- **Across the stream** is the ore field, and a sapling copse the axe fells,
  hiding a second field.
- **The dry pocket** lies past any water. The shells are there, and a well
  is what reaches it.
- **A thick wall**, twelve tiles of thicket, leads into the last pocket.

No boulders and no pick. The well and the cart fill those summers.

## What is gathered

Seven kinds.

| Kind | Where | Use |
|---|---|---|
| fruit | near camp and in fields | winter food, and a burst of speed once M12 is in |
| feather | near camp | sells, nothing else |
| stick | the sapling stand behind thicket | bridge and well material, or sells for one |
| vine | the mud pocket | bridge material, or sells for one |
| ore | across the stream | sells |
| log | felled saplings, two slots | cart and well material, or sells |
| shell | the dry pocket | sells, the top of the ladder |

## Tools, improvements, the shop

- The knife is owned from the start.
- The axe is bought in winter 1, for gold and something carried home.
- The cart is bought in winter 2, paid in logs.
- The well is knowledge, not a purchase: its recipe of logs and sticks is
  shown in the shop.
- Boots are a candidate for the shop. No other gear yet.
- The improvements are cut, bridge, well and cache. No gravel.

## Between the summers

- Upkeep is flat for all five winters, since none of the improvements is a
  structure.
- A plank bridge loses one tile every other winter.

## The table

Each summer opens one thing and gains one key, and each barrier is short in
exactly one currency the previous summer supplied.

| Summer | Opens | Key gained in the winter before | Short in |
|---|---|---|---|
| 1 | the near ring: thin thicket to the vine and stick pockets, mud; bridge the half-circle stream | none; this summer teaches the rules | nothing |
| 2 | across the stream: the ore field, and a sapling copse hiding a second field | the axe, paid in gold and something carried home | a tool |
| 3 | the far field worked in bulk: a cache there, a cut route wide enough for the cart | the cart, paid in logs | logistics |
| 4 | the dry pocket, far from water, where the shells are | the well, from logs and sticks | hydration |
| 5 | the thick wall begun in summer 4, twelve tiles into the last pocket | none; the summer is the harvest of everything built | time |

## Open, to settle in play

Every number not given above is a `[GUESS]` in `config.ts`, tuned from the
log.

- How much extra gold ending a summer away from camp costs.
- Whether fog alone is enough when dry. If not, slowness comes after it.
- Whether a full pack should slow the walk. A cheap experiment.
- How long a cut takes. It is the thickness dial now: at 1.5 seconds the
  twelve-tile wall is nothing, and somewhere around 4 it is a minute of a
  five-minute summer plus the trips, which is what makes it a two-summer
  project. A long hold is watching a bar, so thicker walls with quicker cuts
  is the other way to turn the same dial.
- The shop's prices, the upkeep in fruit and gold, and the town's price for
  fruit. Winter 1 has to afford the axe from a first-summer haul.
- The share of ore and shells that returns each winter, the chance for
  thicket to creep and for a trail to form, and how many winters a felled
  copse takes to return.
