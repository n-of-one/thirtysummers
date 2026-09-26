# The first five summers

This document describes the step being built now: the first five summers of
the first life, on one map, with a winter between each. The generator lays
out the map itself for each seed, and every seed gives a map that matches
the table under *What is gathered*, so testing is done on seeds. A map is
saved as a file in `public/maps/` only when it is worth freezing: for a
playtest with someone else, or to keep it across a change to the generator.
The general rules are in [../design/](../design/README.md). This document
has only what is particular to these five summers.

M10 built the first three years, and they were played. They are not fun yet.
[PLAN.md](PLAN.md) lists the milestones that answer the playtest log,
M10.1 to M10.8, which come before the cart and the well. This document
describes the first five summers as they are meant to be once those are
done, so it is ahead of the code while they are being built. Each
milestone's own file says what it changes.

## What it tests

Each summer opens one new thing, and the winter between spends the gold. The
question for the log is whether summers 2 to 5 stay interesting. On the
discovery test's maps they did not, and on M10's they did not either: summer
2 became hauling, and summer 3 became hauling further. These milestones
change why a trip is made, how long it takes, and whether the valley is
remembered. The questions now are:

1. Does a summer's walking get shorter as the player works out where to
   walk? Trails, a moved camp and a denser far field all answer one
   complaint, and the log has to say which of them the player noticed.
2. Does the valley become a place the player knows? The map in the corner
   and the landmarks are the test.
3. Once the family has standing, does upkeep stop being the summer's main
   work?
4. The cart, from M11: does cutting a road for it feel like play or like
   hauling, now that the player has already worn one with their feet?
5. Steering. The list is still the answer being tried, and it must not take
   away the feeling of exploring.

The unit of play is five summers of five minutes each on one map, about half
an hour including the winters. Summer length is a table in config with one
entry per year, so the age curve can be added later without touching the
logic.

## The story

**Summer 1, the tutorial year.** The character wakes at camp, at the bottom
of the valley between the stream and the river, with a short list in the
corner: 8 fruit at camp,
6 gold rent, 10 gold for the family. The ring's food grows under five trees,
so collecting it is a handful of stops and not a sweep, and the ring's 10
feathers are worth more than the rent. Everything the family's level needs
is across the stream, in a field of feathers. The first bridge reaches it.
It is paid for with sticks from the bramble bay, a clearing in a wood behind
the brambles that fill the wood's floor, and vines from the mud. The map in the corner starts blank, and by
the time the clock runs out it shows most of the ring.

**Winter 1.** No shop. The screen shows what came home, what winter costs,
and the family. Whatever gold is left goes to the family. Reaching level 1
means the town will trade with them next winter, and that the family could
pitch camp somewhere else if it wanted to. A family that falls short gets
the shop one winter later. That pushes the whole table back a year, but it
ends nothing.

**Summer 2, further across.** No new tool and no new kind. The feather field
has come back by half, so the player goes further out for the axe money. The
walk to the bridge is the one they made a dozen times last summer. It is
faster this time where they wore it down, and it keeps getting faster as
they use it. Out there is the copse, a wall of saplings, with shells showing
through it: close enough to see, but not to reach.

**Winter 2, the first shop.** The axe, for 6 gold and 3 sticks. How much the
family is given decides what the town offers next: reaching level 2 shows
the cart, frosted, with its price in gold and logs. A quick player sees that
the cart needs logs and that the axe is what fells them. Level 1 also offers
the move: camp can be pitched on any ground the family has walked that is
suitable for a camp, for 6 sticks and 6 vines. After one summer the only
such ground is inside the ring, so the offer is small, and the player learns
it exists before it matters.

**Summer 3, the axe.** Felling the copse gives logs, two slots each, and
opens the shell field inside it. Shells are the first real money, 6 gold
each, and they do not come back. Ten of them fill one pack: the best-paid
trip on the map, and the longest.

**Winter 3, the cart or the move.** The cart is bought for gold and logs, if
the family reached level 2 the winter before. Only near-perfect play gets it
this early; most players buy it in winter 4. A player who saved a move can
instead pitch camp across the stream. That shortens every summer after it,
and the old ring then only comes back by half.

**Summer 4, the cart (M11).** Storage on wheels, parked at the edge of a
field and pushed home. It runs on grass and bridges, crawls through
underbrush, refuses mud, and pushing it makes the character sweat. Where a
trail has been worn, it already has a road. The field it opens is further
out, past the copse. Beyond that, past a mud flat the cart cannot cross and
too far from water, lies the dry pocket.

**Winter 4, the well and planks (M12).** Level 3 opens both. The family
knows how to dig a well, from logs and sticks. The town saws logs into
planks, and a plank laid on mud makes a tile the cart can cross.

**Summer 5, the harvest (M12).** The trail is fast, planks cross the mud
flat, a well lets the character work in the dry pocket, and the pocket's ore
comes home by the cartload. Every summer before this one pays off.

## Summer duration and player status

Every summer is 300 seconds long, the year-1 length, until the age curve is
added. Hydration is the one bar, and fog is the only effect of being
dehydrated. Time is what a summer spends: rough ground is slow, and
cutting, felling and laying a bridge tile are each an action whose duration
is its price. Walking at 8 tiles a second, a summer is 2400 tiles of easy
ground, or half that through underbrush. Every distance below is measured
against that budget.

A summer after a missed upkeep is a tired one. Every action that takes time
takes one and a half times as long, and rough ground is walked at 25% of
walking speed instead of 40%. Easy ground is walked as fast as ever.

## The map, summers 1 to 3

- **The valley** winds from a gorge at the bottom, where the town is, to the
  head of the valley at the top, walled by rock. The river runs its whole
  length in a ravine, and cliff keeps everyone off it. It runs through a
  lake at the fork. The far bank, across the river, is closed in these five
  summers. The plan it is laid out from is `VALLEY` in `src/config.ts`.
- **The stream** comes off a waterfall on the west wall, crosses the valley
  floor and falls into the lake. It is the first barrier, with springs along
  both banks. Camp's side of it is the near ring. Across it is the open bank.
- **Ponds** on the valley floor are the drinking water away from the stream,
  with springs round their edge. The near ring has at least one.
- **The near ring** is large, at least 6,700 tiles, so the first summer is
  explored rather than swept. Its food is five fruit trees with two to four fruit each, and its
  feathers are spread across it. It is more open than the valley round it,
  with less mud and less dense underbrush. Mud lies mostly where the water is, along
  parts of the bank and in the low ground behind them, and in damp hollows
  elsewhere. The largest patch inside the
  ring is the mud pocket, and its vines can only be reached by wading: each
  one is at least two tiles into the mud, so none can be picked from the
  grass. The sticks lie in the bramble bay: a small
  clearing at the edge of a wood, wherever in the ring a wood wraps round
  one best. Brambles fill the wood's floor round it, about 3 tiles deep
  from every side, so the knife can cut in from whichever side the player
  comes. The ring has no saplings.
- **The ring has features that are only themselves**: a pond, a rock
  outcrop, a stand of grown trees.
- **Across the stream** is the feather field, dense enough that its 30
  feathers are gathered rather than swept.
- **The copse**, a ring of saplings the axe fells, hides the shell field.
- **The way in to the shell field** is a strip of grass from the feather
  field round to the copse, the one gap in the underbrush around it. Nothing
  is laid from camp to the feather field: the player's feet wear that path.
  The layout used to lay grass there as the cart route, with a check that
  the route needed a cut. Both were removed in M10.2, because carts are
  being rethought.

The dry pocket, and the last pocket behind twelve tiles of thicket, are left
out of the layout until they are needed. The dry pocket comes back with M12,
and the thick wall is parked in [../design/ideas.md](../design/ideas.md).
The cache is parked there too, because the cart does its job.

## What is gathered

Camp sells nothing; everything is sold in winter. Money comes from feathers
and shells. Material does not sell at all, so the gold on the list can only
come from a field.

This is the table the generator lays out on every seed, and that
`worldgen/rows.ts` checks each map against.

| Where | What | Comes back | Price | Slots | Gold a slot |
|---|---|---|---|---|---|
| near ring | 5 trees, 15 fruit between them | every year | 1 | 1 | 1 |
| near ring | 10 feathers | every year | 1 | 5 to a slot | 5 |
| the bramble bay, behind thin thicket | 4 sticks | every year | no sale | 1 | 0 |
| mud pocket | 6 vines | every year | no sale | 1 | 0 |
| across the stream | 30 feathers, 1 tree with 4 fruit | half of what was picked, each winter | 1 | 5 feathers to a slot | 5 |
| the copse | saplings, felled for logs | after 3 winters | no sale | 2 | 0 |
| behind the copse | 10 shells | never | 6 | 1 | 6 |

The near ring's 10 feathers make 10 gold, more than the rent at the levels a
first life starts at, and its five trees have about twice the food a winter
eats. So a summer spent only in the ring can be survived, and everything for
the family and the shop is across the stream. The bridge, about 3 sticks and
3 vines, is what makes the first list possible.

A slot of shells is worth more than a slot of anything nearer. That is the
one rule the prices follow: what rises with distance is what a slot brings
home, never the price of a kind. Ten shells are 60 gold in one pack, against
30 gold for 6 slots of feathers, and the walk is about 100 tiles each way.
Ore is out of the first three summers. It comes back in summer 5 as the dry
pocket's heavy good, taking two slots, and its price still has to be checked
per slot before M12 places it.

"Never" means never, wherever the field is. A shell inside a near ring does
not come back either, which matters once camp can move next to one.

## Upkeep

What winter asks for depends on the family's level at the start of the
winter. The total falls as the family rises, and it moves from fruit to
gold.

| Family level | Fruit | Rent | In slots |
|---|---|---|---|
| 0 | 8 | 6 | 10 |
| 1 | 6 | 8 | 8 |
| 2 | 4 | 10 | 6 |
| 3 | 3 | 12 | 6 |
| 4 and up | 2 | 14 | 5 |

Level 0 is one full pack of upkeep, and level 4 is half of one. The ring's
feathers make 10 gold, so from level 3 the rent alone is more than the ring
can pay, and the winter has to be paid from further out. The ring always
has enough fruit.

Also:

- a fruit shortfall is bought from the town at 2 gold each, and surplus
  fruit sells for 1;
- ending the summer away from camp costs 3 gold more;
- a winter that could not be paid charges the level below the next winter,
  and the summer after it is a tired one.

## Family levels, the shop and the move

The shop stocks what the family's level allows at the start of the winter.
Items unlocked by the level reached this winter are shown frosted, with
their price, and their box on the list is ticked. Winter 1 has no shop at
all, frosted or not.

| Level | Family total | Unlocks, bought from the next winter on |
|---|---|---|
| 1 | 10 | the shop, and the axe: 6 gold and 3 sticks |
| 2 | 35 | the cart: 20 gold and 6 logs |
| 3 | 80 | the well (the family knows how to dig it; nothing is bought), and planks: 1 log makes 2, 1 gold each (M12) |
| 4 | 140 | nothing yet |
| 5 | 220 | nothing yet |

Every level from 1 also grants one move of camp, used up when it is spent,
so a first life gets about one move every two or three years. Pitching camp
costs 6 sticks and 6 vines. The site must be ground the family has walked,
open, within reach of water, and with fruit growing in what will become its
ring.

## Two players

"Counted" gold is gold from feathers and shells, which is what the list
counts. Nothing else earns, since material has no price and surplus fruit is
only 1 gold a slot.

**The perfect player** picks everything worth picking: the food the winter
eats, and every feather and shell.

| Year | Upkeep | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|---|
| 1 | 8 fruit, 6 | ring 10, across 30: 40 | closed | 40 - 6 = 34 | 34, level 1 |
| 2 | 6 fruit, 8 | ring 10, across 15: 25 | axe, 6 | 25 - 8 - 6 = 11 | 45, level 2 |
| 3 | 4 fruit, 10 | ring 10, across 7, shells 60: 77 | cart, 20 and 6 logs | 77 - 10 - 20 = 47 | 92, level 3 |

In winter 1 the perfect player misses level 2 by one gold, which is the
tease the winter screen is for.

**A reference player** gets about half of what is across the stream, and
two thirds of the shells.

| Year | Upkeep | Counted haul | Shop | To the family | Family total |
|---|---|---|---|---|---|
| 1 | 8 fruit, 6 | ring 10, across 15: 25 | closed | 19 | 19, level 1 |
| 2 | 6 fruit, 8 | ring 10, across 11: 21 | axe, 6 | 7 | 26, level 1 |
| 3 | 6 fruit, 8 | ring 10, across 8, shells 42: 60 | cart frosted | 52 | 78, level 2 |

Getting the cart in winter 3 takes near-perfect play. The reference player
sees it frosted in winter 3, is also two gold short of level 3, and buys the
cart in winter 4.

## The list

The list is made in winter and carried through the summer. Every line of
upkeep, every item in the shop (frosted ones included) and the family's next
level has a box, ticked by default; the player unticks what they will not go
for. The ticked lines become the list the summer shows across the top of the
screen, one box per line, filled from the top:

1. food, counted in fruit;
2. rent, which the box shows in feathers;
3. each ticked item, its gold from what is left and its material in kind;
4. the gold the family still needs for its next level.

Each amount in a box is a row of squares, green at camp and amber when
carried. In summer 1 the food line also says in words what to do. A box
turns green once everything on it is at camp. The family's line reads
"Increase family wealth".

Summer 1's list works the same way, with no shop: food, rent, level 1.

What a perfect player's lists say:

- **Summer 1:** 8 fruit, 6 gold rent, 10 gold toward level 1.
- **Summer 2:** 6 fruit, 8 gold rent, the axe for 6 gold and 3 sticks, and
  1 gold toward level 2.
- **Summer 3:** 4 fruit, 10 gold rent, the cart for 20 gold and 6 logs, and
  the gold toward level 3.

A player who skipped the axe to reach level 2 gets the cart on the list with
no way to fell the logs for it. That is left as it is: the frosted cart
already says it needs logs, and working out that the axe comes first is the
point.

## Between the summers

- Inside the near ring, which is everything camp can reach without crossing
  water, everything that comes back at all is back every year. Outside it,
  feathers and fruit come back by half. Shells never come back, inside the
  ring or not.
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
- Whether the near ring, at about 6,700 tiles or more, is still too large
  once the food is on trees and the trails are worn.
- Whether the map in the corner is enough to make the valley memorable, or
  whether the landmarks need to be more than scenery.
- Whether one move of camp per family level is too many or too few, and
  whether moving across the stream is obviously right or a real choice.
- Whether the upkeep table pushes the family outward, or just makes things
  easier.
- Whether level 1 at 10 gold is easy enough for a tutorial and hard enough
  that the bridge is needed.
- How much of the field across the stream comes back. It is the one number
  that sets how much slack summers 1 and 2 have.
- Whether fog alone is enough when the character is dehydrated. If not,
  slowness comes after it.
- Whether a full pack should slow the walk. A cheap experiment.
- How long a cut takes.
- The chance for thicket to creep back.
