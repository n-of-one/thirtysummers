# M10.1: fruit on trees, and what a slot is worth

Two changes to what is picked and what it is worth, together because every
playtest after this one is read against them. The food in the near ring stops
being a sweep of the whole ring, and the prices stop letting the first three
years be funded by anything but a field.

Why, in
[../rationale/design.md](../rationale/design.md), under "The first three years,
and what they changed". The target numbers are in
[five-summers.md](five-summers.md).

**Depends on** nothing but M10.

## Steps

1. **A fruit tree is a tree tile with four fruit round it.** Nothing in the
   simulation changes: the four are ordinary fruit nodes on the grass under the
   canopy, each a hold, each harvested from the tile ahead as today, each back
   next summer if it is in the ring. The tree is the landmark and the reason
   they are in one place.

   It is an ordinary tree tile, drawn like every other tree in the ring, and
   nothing is cleared round it to single it out. What says "fruit tree" is the
   four fruit under it, and that is enough: the player is looking for the
   fruit, not for a kind of tree.

   A tree that held its fruit as one node with a count was the other way to do
   it, and it wanted a count on `ResourceNode`, a yield on `ResourceDef`, a
   save version and a check that a node on an impassable tile is still
   targeted. It buys standing still while the holds repeat, and nothing else,
   so it is not bought. Four nodes also behave better with two free slots: you
   take what fits and the rest is still on the ground.
2. **Where the trees go**, in `worldgen/layout.ts`: 4 in the near ring, the
   clusters held apart by `NEAR_RING_SPACING` and outside the walled stand, and
   1 across the stream in the feather field. A tree needs four open grass tiles
   round it for its fruit, or it is a tree with nothing under it, and the fruit
   must be reachable on foot.
3. **Prices**, in `sim/resources.ts`: a shell is 6, and a stick, a vine and a
   log are 0. The keep-or-sell column stays where it is in `sim/winter.ts` and
   `ui/winter.ts`: material worth nothing is material nobody sells, so the
   choice makes itself and the screen is left alone, while putting a price back
   on material stays a one-number change.
4. **Counts**, in `config.ts` `LAYOUT_NODES`: 4 fruit trees in the ring, 1
   across the stream, `FRUIT_PER_TREE` 4, 10 shells in the shell field, the
   feathers, sticks and vines as they are.
5. **Upkeep and the axe**, in `config.ts`: `UPKEEP_FRUIT` 8, `UPKEEP_GOLD` 6,
   the axe 6 gold and 3 sticks in `sim/shop.ts`. These are level 0's numbers;
   M10.6 turns them into a table and this milestone does not.
6. **Never means never.** `world.ts` brings a node back if it is in the near
   ring *or* its `returns` is yearly, so a shell in a near ring would come back.
   A kind whose `returns` is `never` never comes back, ring or no ring. It
   matters once M10.5 can put a ring round the shell field.
7. **The economy check.** `worldgen/rows.ts` and `npm run map:check` play the
   two players of [five-summers.md](five-summers.md) over each map's nodes and
   through the winter model, and their rows say by how much each target is met
   or missed.

   What is held to here is the chain, not the gold: level 1 in winter 1, the
   axe and level 2 in winter 2, the cart in winter 3 for the perfect player and
   winter 4 for the reference one. The tables themselves wait for
   [m10-6-upkeep.md](m10-6-upkeep.md), whose step 5 owns the rebalance, because
   they were written against its per-level upkeep while upkeep here is flat at
   level 0's numbers. So the families come out high -- 34, 47, 98 against the
   doc's 34, 45, 92, and 19, 28, 82 against 19, 26, 78 -- and at 82 the
   reference player crosses level 3 a winter early. That row is printed and not
   asserted until M10.6. How much of the shell field the reference player takes
   is left alone here for the same reason.

## Verification

- `npm run map:check` over the seed spread gives both players the chain of
  five-summers.md: level 1 in winter 1, the axe and level 2 in winter 2 for the
  perfect player, the cart in winter 3 for them and winter 4 for the reference
  player. The gold in those tables is M10.6's, per step 7.
- Measured over the protocol on one seed: the tiles walked to bring the
  winter's fruit home, with the trees and with the fruit scattered as it is
  now. Non-vacuous by reverting step 2 and watching the distance grow.
- Over the seed spread: every fruit tree has its four fruit on open ground
  beside it, every one of them reachable on foot, and no cluster inside the
  stand's wall.
- A slot of shells is worth more than a slot of feathers, asserted over
  `RESOURCES` so the rule cannot drift.
- Winter pays no gold for sticks, vines or logs, and a pack of vines still
  empties into camp and stays there over the winter.
- Three simulated winters: the ring's trees hang full again, the feather field
  is back by half, and a shell does not come back even when it is inside a
  near ring.

## The playtest question

Is the ring's food still a chore? Does summer 2 fund the axe and the family's
next level from feathers alone? Does the shell field read as the best trip on
the map rather than the longest?
