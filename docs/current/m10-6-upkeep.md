# M10.6: upkeep that changes shape with the family

A poor family eats what it picks: much fruit, little rent. A family with
standing buys its food: less fruit, more gold. The total never grows and in
backpack slots it shrinks, so a level is never a heavier winter. What it does
is move the winter off the ground beside camp and onto money that only comes
from further out.

The design is in [../design/winter.md](../design/winter.md) under *Upkeep*,
the reason in [../rationale/design.md](../rationale/design.md), and the line
that stays rejected, upkeep whose total a level raises, is in
[../archive/decided-against.md](../archive/decided-against.md).

**Depends on** the five before it, because its numbers are chosen against a
summer that has trees, trails, a map and a camp that can move. It is last for
that reason and not because it is hard.

## Steps

1. **The table**, in `config.ts`, replacing `UPKEEP_FRUIT` and `UPKEEP_GOLD`
   with `UPKEEP_BY_LEVEL`, indexed by family level and holding the last row
   for anything above it:

   | Level | Fruit | Rent | In slots |
   |---|---|---|---|
   | 0 | 8 | 6 | 10 |
   | 1 | 6 | 8 | 8 |
   | 2 | 4 | 10 | 6 |
   | 3 | 3 | 12 | 6 |
   | 4 and up | 2 | 14 | 5 |

2. **Which level is charged.** The one the family held when the winter began,
   like the shop's stock, so a winter cannot change what it costs while it is
   being played.
3. **A missed winter asks for the level below.** `sim/winter.ts` records that
   the last winter went unpaid, and the next one charges the row beneath the
   family's level, so a bad year lowers the bar rather than raising it and the
   tired summer cannot start a spiral. Paying returns it to the family's own
   row the winter after.
4. **The screen and the list.** The upkeep lines read from the table, and the
   rent box still says what it is in feathers. Nothing new appears: the player
   sees a winter that asks for different things, not a winter with more
   mechanics in it.
5. **The rebalance.** The two players' tables in
   [five-summers.md](five-summers.md) are what `npm run map:check` plays, and
   this is the milestone that makes them true.

## Verification

- The winter model over a synthetic camp gives the right fruit and rent at
  every level, the level below after a missed winter, and the family's own
  level the winter after that is paid.
- `npm run map:check` over the seed spread reproduces both players' tables:
  the perfect player at level 1, 2 and 3 in winters 1 to 3 with the axe in
  winter 2 and the cart in winter 3, the reference player one winter behind
  on the cart and short of level 3 in winter 3.
- The ring alone pays the food at every level, and from level 3 the ring's
  feathers alone do not pay the rent. Both asserted against the map's node
  counts, so the push outward is a fact about the table and not a hope.
- Five years played over the protocol with one winter deliberately missed,
  with the upkeep charged each winter read back.

## The playtest question

Does a winter stop being the summer's work once the family has standing? Does
the rising rent read as the valley pushing you outward, or as the game taking
more? Does the level below after a missed winter feel like mercy or like
nothing at all?
