# The first five summers

What the step being built now is: the first five summers of the first life,
on one map, with a winter between each. Milestones M10 to M12 in
[PLAN.md](PLAN.md) build it: M10 the first three years, M11 the cart for
summer 4, M12 planks and the well for summer 5. The generator lays the map
out itself, per seed, and the maps in `public/maps/` are dumps of particular
seeds that can still be edited by hand. The general rules are in
[../design/](../design/README.md). This document holds only what is
particular to these five summers.

## What it tests

Each summer opens one thing, and the winter between spends the gold. The
question for the log is whether summers 2 to 5 stay interesting. On the
discovery test's maps they did not. Summers 2 and 3 turned into a routing
exercise, because nothing changed but the resources and gold had nothing to
buy.

The second question is the cart. Does cutting a road so a cart can run from
a field to camp feel like play, or like hauling?

The third is steering. A fresh player in the only playtest so far needed a
little. The list, which the player fills in each winter, is the answer being
tried, and it must not cost the feeling of exploring.

The unit of play is five summers of five minutes on one map, about half an
hour with the winters. Summer length is a per-year table in config, so the
age curve can come later without touching logic.

## The story

**Summer 1, the tutorial year.** The character wakes at camp inside the half
circle of stream, with a short list in the corner: store 12 fruit at camp,
10 gold for rent, 10 gold for the family. The near ring has the fruit and
exactly the rent in feathers, and nothing more that the list counts. The
family's 10 is across the stream, in a field of feathers, and the first
bridge, paid in sticks from behind the stand's thin thicket and vines from
the mud, is what reaches it.

**Winter 1.** No shop. The screen is what came home, what winter costs, and
the family. Whatever is left goes to the family, and level 1 says the town
will trade with them next winter. A family that falls short opens the shop a
winter later, which slips the table by a year and ends nothing.

**Summer 2, further across.** No new tool and no new kind. The feather field
has come back by half, so the player goes further out for the axe's money.
Out there is the copse, a wall of saplings, with shells showing through it:
close enough to see, and not to reach.

**Winter 2, the first shop.** The axe. Whatever the family is given decides
what the town offers next: reaching level 2 shows the cart, frosted, at its
price in gold and logs. A quick player sees that the cart wants logs and
that the axe is what fells them.

**Summer 3, the axe.** Felling the copse gives logs, two slots each, and
opens the shell field inside. Shells are the first real money, and they do
not come back. Ten to a pack over a long walk shows how little one pack
moves.

**Winter 3, the cart.** Bought for gold and logs, if the family reached
level 2 a winter ago. Only near-perfect play gets it this early; most
players buy it in winter 4.

**Summer 4, the cart (M11).** A cache on wheels, parked at the edge of a
field and pushed home. It runs on grass and bridge, crawls through
underbrush, refuses mud, and pushing it makes the character sweat. The field
it opens is further out, past the copse, and the route through the
underbrush wears into a trail over the winter. Past a mud flat the cart
cannot cross, and too far from water, lies the dry pocket.

**Winter 4, the well and planks (M12).** Level 3 opens both. The well is
known, dug from logs and sticks. The town saws logs into planks, and a plank
laid on mud is a tile the cart can cross.

**Summer 5, the harvest (M12).** The trail is fast, planks cross the mud
flat, a well keeps the character in the dry pocket, and its ore comes home
by the cartload. Every summer before it is paid back.

## The body

Every summer is the year-1 length until the age curve comes in. Hydration
is the one bar, and fog is the only consequence of running dry. Time is
what a summer spends: rough ground is slow, and a cut, a felling and a
bridge tile are each a hold whose length is the price.

A summer after missed upkeep is a tired one. Every hold takes half as long
again, and rough ground is walked at 25% of walking speed instead of 40%.
Easy ground is walked as fast as ever.

## The map, summers 1 to 3

- **The first stream** is a half circle around camp, with springs along
  both sides. Inside it is the near ring.
- **The near ring** is large, a minute to cross, so the first summer is
  explored rather than swept. Its fruit and feathers are spread thinly
  across it, its mud pocket is open and the vines in it are only waded to,
  and a thin thicket, about three tiles, walls in the sapling stand where
  the sticks are.
- **Across the stream** is the feather field.
- **The copse**, a ring of saplings the axe fells, hides the shell field.
- **The cart route** runs from camp through the feather field to the copse.
  It is laid now, for M11, and held to needing a cut.

The dry pocket and the last pocket behind twelve tiles of thicket are out
of the layout until they are needed: the dry pocket comes back with M12,
and the thick wall is parked in [../design/ideas.md](../design/ideas.md).
The cache is parked there too. The cart does its job.

## What is gathered

The list counts gold from feathers and shells only. Sticks, vines and logs
still sell, for one, and that gold still reaches the family, but selling
material is not meant to be the way to earn. Whether they should sell at all
is for the log.

| Where | What | Comes back | Price | Slots |
|---|---|---|---|---|
| near ring | 14 fruit | every year | 1 | 1 |
| near ring | 10 feathers | every year | 1 | 1 |
| sapling stand, behind thin thicket | 6 sticks | every year | 1, not on the list | 1 |
| mud pocket | 6 vines | every year | 1, not on the list | 1 |
| across the stream | 30 feathers, 4 fruit | half of what was picked, each winter | 1 | 1 |
| the copse | saplings, felled for logs | after 3 winters | 1, not on the list | 2 |
| behind the copse | 30 shells | never | 2 | 1 |

The near ring's 10 feathers pay the rent exactly, so anything for the
family comes from across the stream, and the bridge, about 3 sticks and 3
vines, is what makes the first list possible. Ore is out of the first three
summers. It comes back in summer 5 as the dry pocket's heavy good, two
slots, worth hauling only by cart.

## Upkeep

The same every winter, since none of the improvements is a structure:

- 12 fruit, and a shortfall bought from the town at 2 gold each;
- 10 gold rent, which is what the near ring's feathers make;
- 3 gold more for ending the summer away from camp.

## Family levels and the shop

The shop stocks what the family's level allows when the winter begins.
What the level reached this winter unlocks is shown frosted, at its price,
with its box on the list ticked. Winter 1 has no shop at all, frosted or
not.

| Level | Family total | Unlocks, bought from the next winter on |
|---|---|---|
| 1 | 10 | the shop, and the axe: 8 gold and 3 sticks |
| 2 | 35 | the cart: 20 gold and 6 logs |
| 3 | 80 | the well, known rather than bought, and planks: 1 log makes 2, 1 gold each (M12) |
| 4 | 140 | nothing yet |
| 5 | 220 | nothing yet |

## Two players

"Counted" is gold from feathers and shells: what the list sees. Selling
sticks, vines and spare logs adds about 6 gold a winter on top, which
reaches the family and is not in these tables.

**The perfect player** picks everything in reach.

| Year | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|
| 1 | ring 10, across 30: 40 | closed | 40 - 10 rent = 30 | 30, level 1 |
| 2 | ring 10, across 15: 25 | axe, 8 | 25 - 10 - 8 = 7 | 37, level 2 |
| 3 | ring 10, across 7, shells 30 × 2: 77 | cart, 20 and 6 logs | 77 - 10 - 20 = 47 | 84, level 3 |

**A reference player** gets about half of what is across the stream, and
two thirds of the shells.

| Year | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|
| 1 | ring 10, across 15: 25 | closed | 15 | 15, level 1 |
| 2 | ring 10, across 18: 28 | axe, 8 | 10 | 25, level 1 |
| 3 | ring 10, across 8, shells 20 × 2: 58 | cart frosted | 48 | 73, level 2 |

The cart in winter 3 takes near-perfect play. The reference player sees it
frosted in winter 3 and buys it in winter 4.

## The list

Made in winter, carried through the summer. Every line of upkeep, every item
in the shop, frosted ones included, and the family's next level has a box,
ticked by default; the player unticks what they will not go for. The ticked
lines are the list the summer shows, filled top to bottom by what is at
camp:

1. food, counted in fruit at camp;
2. rent;
3. each ticked item, its gold from what is left and its material in kind at
   camp;
4. the gold the family still needs for its next level.

Summer 1's list is the same thing with no shop: food, rent, level 1.

What a perfect player's lists say:

- **Summer 1:** 12 fruit, 10 gold rent, 10 gold toward level 1.
- **Summer 2:** 12 fruit, 10 gold rent, the axe for 8 gold and 3 sticks, and
  5 gold toward level 2.
- **Summer 3:** 12 fruit, 10 gold rent, the cart for 20 gold and 6 logs, and
  the gold toward level 3.

A player who skipped the axe to reach level 2 gets the cart on the list with
no way to fell its logs. That is left to stand: the frosted cart already
says it wants logs, and working out that the axe comes first is the point.

## Between the summers

- Inside the near ring everything is back every year. Outside it, feathers
  and fruit come back by half, and shells never.
- Saplings are back 3 winters after they are felled.
- Thicket creeps back onto cut tiles that touch it.
- A bridge loses one tile every other winter.
- Trails come with the cart, in M11.

## Open, to settle in play

Every number not given above is a `[GUESS]` in `config.ts`, tuned from the
log.

- Whether sticks, vines and logs should sell at all.
- Whether level 1 at 10 is easy enough to be a tutorial and hard enough
  that the bridge is needed.
- The across-the-stream field and its half return, the one number that sets
  how much slack summers 1 and 2 have.
- Whether fog alone is enough when dry. If not, slowness comes after it.
- Whether a full pack should slow the walk. A cheap experiment.
- How long a cut takes.
- The chance for thicket to creep.
