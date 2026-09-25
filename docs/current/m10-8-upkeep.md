# M10.8: upkeep that changes with the family's level

A poor family eats what it picks: a lot of fruit and little rent. A family
with standing buys its food: less fruit and more gold. The total never grows,
and measured in backpack slots it shrinks, so reaching a level never makes a
winter heavier. What changes is where the upkeep comes from: less from the
ground next to camp, and more from money that can only be earned further
out.

The design is in [../design/winter.md](../design/winter.md) under *Upkeep*,
and the reason in [../rationale/design.md](../rationale/design.md). The
rejected alternative, upkeep whose total rises with each level, is in
[../archive/decided-against.md](../archive/decided-against.md).

**Depends on** the seven milestones before it, because its numbers are
chosen against a summer that has trees, trails, a map, the ring's new ground
and a camp that can move.
That is why it is last, not because it is hard.

## Steps

1. **The table**, in `config.ts`. `UPKEEP_BY_LEVEL` replaces `UPKEEP_FRUIT`
   and `UPKEEP_GOLD`. It is indexed by family level, and its last row applies
   to every level above it:

   | Level | Fruit | Rent | In slots |
   |---|---|---|---|
   | 0 | 8 | 6 | 10 |
   | 1 | 6 | 8 | 8 |
   | 2 | 4 | 10 | 6 |
   | 3 | 3 | 12 | 6 |
   | 4 and up | 2 | 14 | 5 |

2. **Which level is charged.** The level the family had when the winter
   began, as with the shop's stock, so what a winter costs cannot change
   while it is being played.
3. **A missed winter charges the level below.** `sim/winter.ts` records that
   the last winter went unpaid, and the next winter charges the row below
   the family's level. So a bad year lowers the bar instead of raising it,
   and the tired summer cannot start a downward spiral. Once a winter is
   paid, the next one goes back to the family's own row.
4. **The screen and the list.** The upkeep lines read from the table, and
   the rent box still shows the rent in feathers. Nothing new appears on
   screen: the player sees a winter that asks for different things, not a
   winter with more mechanics.
5. **The rebalance.** `npm run map:check` plays the two players' tables in
   [five-summers.md](five-summers.md), and this milestone makes those tables
   true.

## Verification

- The winter model, run on a made-up camp, charges the right fruit and rent
  at every level, the level below after a missed winter, and the family's
  own level again after a paid one.
- `npm run map:check` over the seed spread reproduces both players' tables.
  The perfect player reaches levels 1, 2 and 3 in winters 1 to 3, with the
  axe in winter 2 and the cart in winter 3. The reference player gets the
  cart one winter later and is short of level 3 in winter 3.
- The ring alone pays for the food at every level, and from level 3 the
  ring's feathers alone do not pay the rent. Both are checked against the
  map's counts of fruit and feathers, so the push outward is a fact about
  the table and not a hope.
- Five years played over the protocol with one winter missed on purpose,
  reading back the upkeep charged each winter.

## The playtest question

Once the family has standing, does upkeep stop being the summer's main work?
Does the rising rent feel like the valley pushing you outward, or like the
game taking more? Does charging the level below after a missed winter feel
like mercy, or like nothing at all?
