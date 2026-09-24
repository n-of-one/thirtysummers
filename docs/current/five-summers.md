# The first five summers

What the step being built now is: the first five summers of the first life,
on one map, with a winter between each. The generator lays the map out itself,
per seed, and every seed holds the table, so testing is on seeds. A dump of one
into `public/maps/` freezes a map when that is worth doing, for a playtest with
someone else or across a change to the generator. The general rules are in
[../design/](../design/README.md). This document holds only what is
particular to these five summers.

M10 built the first three years and they were played. They are not fun yet, and
[PLAN.md](PLAN.md) holds the six milestones that answer the log, M10.1 to
M10.6, before the cart and the well go on top. This document describes the
first five summers as they are meant to be when those six are done, so it is
ahead of the code while they are being built. Each milestone's own file says
what it changes.

## What it tests

Each summer opens one thing, and the winter between spends the gold. The
question for the log is whether summers 2 to 5 stay interesting. On the
discovery test's maps they did not, and on M10's they did not either: summer 2
became hauling and summer 3 became hauling further. What the six milestones
change is why a trip is made, how long it takes, and whether the valley is
remembered. The questions now are:

1. Does a summer's walking shrink as the player works out where to walk?
   Trails, a moved camp and a denser far field are all answers to one
   complaint, and the log has to say which of them was felt.
2. Does the valley become a place the player knows? The map in the corner and
   the landmarks are the test.
3. Does upkeep stop being the summer's work once the family has standing?
4. The cart, from M11: does cutting a road for it feel like play or hauling,
   now that the player has already worn one with their feet?
5. Steering. The list is still the answer being tried, and it must not cost
   the feeling of exploring.

The unit of play is five summers of five minutes on one map, about half an
hour with the winters. Summer length is a per-year table in config, so the
age curve can come later without touching logic.

## The story

**Summer 1, the tutorial year.** The character wakes at camp inside the half
circle of stream, with a short list in the corner: 8 fruit at camp, 6 gold
rent, 10 gold for the family. The ring's food grows under five trees, so food
is a handful of stops and not a sweep, and the ring's 10 feathers make more than the
rent. Everything the family's level needs is across the stream, in a field of
feathers, and the first bridge, paid in sticks from behind the stand's thin
thicket and vines from the mud, is what reaches it. The map in the corner
starts blank and is most of the ring by the time the clock runs out.

**Winter 1.** No shop. The screen is what came home, what winter costs, and
the family. Whatever is left goes to the family, and level 1 says the town will
trade with them next winter, and that the family could pitch camp somewhere
else if it wanted to. A family that falls short opens the shop a winter later,
which slips the table by a year and ends nothing.

**Summer 2, further across.** No new tool and no new kind. The feather field
has come back by half, so the player goes further out for the axe's money, and
the walk to the bridge is the walk they made a dozen times last summer. It is
faster this time where they wore it down, and it gets faster while they use it.
Out there is the copse, a wall of saplings, with shells showing through it:
close enough to see, and not to reach.

**Winter 2, the first shop.** The axe, 6 gold and 3 sticks. Whatever the
family is given decides what the town offers next: reaching level 2 shows the
cart, frosted, at its price in gold and logs. A quick player sees that the cart
wants logs and that the axe is what fells them. Level 1 also offers the move:
camp can be pitched on any ground the family has walked that will hold one,
for 6 sticks and 6 vines. After one summer the only such ground is inside the
ring, so the offer is small and the player learns it exists before it matters.

**Summer 3, the axe.** Felling the copse gives logs, two slots each, and opens
the shell field inside. Shells are the first real money, 6 gold each, and they
do not come back. Ten of them are one pack: the best-paid trip on the map, and
the longest.

**Winter 3, the cart or the move.** The cart is bought for gold and logs, if
the family reached level 2 a winter ago. Only near-perfect play gets it this
early; most players buy it in winter 4. A player who kept a move in hand can
instead pitch camp across the stream, which shortens every summer after it and
hands the old ring back to the half returns.

**Summer 4, the cart (M11).** A cache on wheels, parked at the edge of a field
and pushed home. It runs on grass and bridge, crawls through underbrush,
refuses mud, and pushing it makes the character sweat. Where a trail was worn,
it already has a road. The field it opens is further out, past the copse, and
past a mud flat the cart cannot cross, too far from water, lies the dry pocket.

**Winter 4, the well and planks (M12).** Level 3 opens both. The well is
known, dug from logs and sticks. The town saws logs into planks, and a plank
laid on mud is a tile the cart can cross.

**Summer 5, the harvest (M12).** The trail is fast, planks cross the mud flat,
a well keeps the character in the dry pocket, and its ore comes home by the
cartload. Every summer before it is paid back.

## The body

Every summer is the year-1 length, 300 seconds, until the age curve comes in.
Hydration is the one bar, and fog is the only consequence of running dry. Time
is what a summer spends: rough ground is slow, and a cut, a felling and a
bridge tile are each a hold whose length is the price. Walking at 8 tiles a
second, a summer is 2400 tiles of easy ground and half that through
underbrush, which is the budget every distance below is measured against.

A summer after missed upkeep is a tired one. Every hold takes half as long
again, and rough ground is walked at 25% of walking speed instead of 40%.
Easy ground is walked as fast as ever.

## The map, summers 1 to 3

- **The first stream** is a half circle around camp, 58 tiles out, with
  springs along both sides. Inside it is the near ring.
- **The near ring** is large, so the first summer is explored rather than
  swept. Its food is five fruit trees holding two to four fruit each, its
  feathers are spread across it, its
  mud pocket is open and the vines in it are only waded to, each of them at
  least two tiles inside the mud so none can be taken from the grass, and a
  thin thicket, about three tiles, walls in the sapling stand where the sticks
  are.
- **The ring has features that are nothing but themselves**: a pond, a rock
  outcrop, a stand of grown trees, a bend with a waterfall. One of them holds
  the year-1 want: an island in the stream with something on it that a second
  bridge tile reaches, so the first summer ends with a question as well as a
  list.
- **Across the stream** is the feather field, dense enough that its 30
  feathers are gathered rather than swept.
- **The copse**, a ring of saplings the axe fells, hides the shell field.
- **The way in to the shell field** is grass from the feather field round to
  the copse, the one gap in the underbrush that rings it. Nothing is laid
  from camp to the feather field: that walk is worn by the player's feet. It
  was laid as the cart route and held to needing a cut, and that row is gone
  with M10.2, because carts are being rethought.

The dry pocket and the last pocket behind twelve tiles of thicket are out
of the layout until they are needed: the dry pocket comes back with M12,
and the thick wall is parked in [../design/ideas.md](../design/ideas.md).
The cache is parked there too. The cart does its job.

## What is gathered

Camp sells nothing; everything is sold in winter. Money is feathers and
shells. Material does not sell at all, so the gold on the list can only come
from a field.

| Where | What | Comes back | Price | Slots | Gold a slot |
|---|---|---|---|---|---|
| near ring | 5 trees, 15 fruit between them | every year | 1 | 1 | 1 |
| near ring | 10 feathers | every year | 1 | 5 to a slot | 5 |
| sapling stand, behind thin thicket | 6 sticks | every year | no sale | 1 | 0 |
| mud pocket | 6 vines | every year | no sale | 1 | 0 |
| across the stream | 30 feathers, 1 tree with 4 fruit | half of what was picked, each winter | 1 | 5 feathers to a slot | 5 |
| the copse | saplings, felled for logs | after 3 winters | no sale | 2 | 0 |
| behind the copse | 10 shells | never | 6 | 1 | 6 |

The near ring's 10 feathers make 10 gold, more than the rent at the levels a
first life starts on, and its five trees hold about twice the food a winter eats. So
a summer spent only in the ring is survived, and everything for the family and
the shop is across the stream. The bridge, about 3 sticks and 3 vines, is what
makes the first list possible.

A slot of shells is worth more than a slot of anything nearer, which is the one
rule the prices follow: what rises with distance is what a slot brings home,
never the price of a kind. Ten shells is 60 gold in one pack, against 6 slots of
feathers for 30, and it is a walk of about 100 tiles each way. Ore is out of the
first three summers. It comes back in summer 5 as the dry pocket's heavy good,
two slots, and its price is due the same per-slot look before M12 places it.

Never means never, wherever a node stands. A shell inside a near ring does not
come back, which matters once camp can move onto one.

## Upkeep

What winter needs depends on the family's level at the start of it. The total
falls as the family rises, and what it is asked in moves from fruit to gold.

| Family level | Fruit | Rent | In slots |
|---|---|---|---|
| 0 | 8 | 6 | 10 |
| 1 | 6 | 8 | 8 |
| 2 | 4 | 10 | 6 |
| 3 | 3 | 12 | 6 |
| 4 and up | 2 | 14 | 5 |

Level 0 is one full pack of upkeep, level 4 is half of one. The ring's
feathers make 10 gold, so from level 3 the rent alone is more than the ring
covers and the winter has to be paid from further out. The ring always covers
the food.

Besides that:

- a fruit shortfall is bought from the town at 2 gold each, and surplus fruit
  sells for 1;
- 3 gold more for ending the summer away from camp;
- a winter that could not be paid asks for the level below next winter, and
  the summer after it is a tired one.

## Family levels, the shop and the move

The shop stocks what the family's level allows when the winter begins.
What the level reached this winter unlocks is shown frosted, at its price,
with its box on the list ticked. Winter 1 has no shop at all, frosted or
not.

| Level | Family total | Unlocks, bought from the next winter on |
|---|---|---|
| 1 | 10 | the shop, and the axe: 6 gold and 3 sticks |
| 2 | 35 | the cart: 20 gold and 6 logs |
| 3 | 80 | the well, known rather than bought, and planks: 1 log makes 2, 1 gold each (M12) |
| 4 | 140 | nothing yet |
| 5 | 220 | nothing yet |

Every level from 1 also grants one move of camp, spent when it is used, so a
first life has about one move every two or three years. Pitching camp costs 6
sticks and 6 vines, and the site must be ground the family has walked, open,
within reach of water, with fruit growing in the ground it will call its ring.

## Two players

"Counted" is gold from feathers and shells: what the list sees. Nothing else
earns, since material has no price and surplus fruit is 1 gold a slot.

**The perfect player** picks everything worth picking, which is the food the
winter eats and every feather and shell.

| Year | Upkeep | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|---|
| 1 | 8 fruit, 6 | ring 10, across 30: 40 | closed | 40 - 6 = 34 | 34, level 1 |
| 2 | 6 fruit, 8 | ring 10, across 15: 25 | axe, 6 | 25 - 8 - 6 = 11 | 45, level 2 |
| 3 | 4 fruit, 10 | ring 10, across 7, shells 60: 77 | cart, 20 and 6 logs | 77 - 10 - 20 = 47 | 92, level 3 |

Level 2 is missed by one gold in winter 1, which is the tease the winter screen
is for.

**A reference player** gets about half of what is across the stream, and
two thirds of the shells.

| Year | Upkeep | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|---|
| 1 | 8 fruit, 6 | ring 10, across 15: 25 | closed | 19 | 19, level 1 |
| 2 | 6 fruit, 8 | ring 10, across 11: 21 | axe, 6 | 7 | 26, level 1 |
| 3 | 6 fruit, 8 | ring 10, across 8, shells 42: 60 | cart frosted | 52 | 78, level 2 |

The cart in winter 3 takes near-perfect play. The reference player sees it
frosted in winter 3, two gold short of level 3 as well, and buys it in winter
4.

## The list

Made in winter, carried through the summer. Every line of upkeep, every item
in the shop, frosted ones included, and the family's next level has a box,
ticked by default; the player unticks what they will not go for. The ticked
lines are the list the summer shows across the top of the screen, a box per
line, filled top to bottom:

1. food, counted in fruit;
2. rent, which the box says in feathers;
3. each ticked item, its gold from what is left and its material in kind;
4. the gold the family still needs for its next level.

Each amount in a box is a row of squares, green at camp and amber carried.
In summer 1, food also says what to do in words. A box turns green once
everything on it is at camp. The family's line reads "Increase family
wealth".

Summer 1's list is the same thing with no shop: food, rent, level 1.

What a perfect player's lists say:

- **Summer 1:** 8 fruit, 6 gold rent, 10 gold toward level 1.
- **Summer 2:** 6 fruit, 8 gold rent, the axe for 6 gold and 3 sticks, and
  1 gold toward level 2.
- **Summer 3:** 4 fruit, 10 gold rent, the cart for 20 gold and 6 logs, and
  the gold toward level 3.

A player who skipped the axe to reach level 2 gets the cart on the list with
no way to fell its logs. That is left to stand: the frosted cart already
says it wants logs, and working out that the axe comes first is the point.

## Between the summers

- Inside the near ring, which is what camp reaches without crossing water,
  everything that comes back at all is back every year. Outside it, feathers
  and fruit come back by half. Shells never come back, ring or no ring.
- The fruit under a ring tree is back, like anything else in the ring.
- Saplings are back 3 winters after they are felled.
- Thicket creeps back onto cut tiles that touch it.
- A bridge loses one tile every other winter.
- Worn trails stay worn. Nothing grows back over them.

## Open, to settle in play

Every number not given above is a `[GUESS]` in `config.ts`, tuned from the
log.

- How many crossings wear an underbrush tile away, and whether the wear is
  felt before the tile gives way.
- Whether the near ring at 58 tiles is still too large once the food is on
  trees and the trails are worn.
- Whether the map in the corner is enough to make the valley memorable, or
  whether it needs the landmarks to be more than scenery.
- Whether one move of camp per family level is too many or too few, and
  whether moving across the stream is obviously right or a real choice.
- Whether the level table for upkeep pushes outward or just gets easier.
- Whether level 1 at 10 is easy enough to be a tutorial and hard enough
  that the bridge is needed.
- The across-the-stream field and its half return, the one number that sets
  how much slack summers 1 and 2 have.
- Whether fog alone is enough when dry. If not, slowness comes after it.
- Whether a full pack should slow the walk. A cheap experiment.
- How long a cut takes.
- The chance for thicket to creep.
