# M10.5: camp that moves

The walk from camp to the far bank is paid twice, once over ground that was
swept the summer before. A family with standing can pick camp up and pitch it
somewhere it has walked, which cancels that walk and hands the old ring back to
the valley.

The design is in [../design/winter.md](../design/winter.md) under *Where camp
stands*, and the same move between lives is in
[../design/map-arc.md](../design/map-arc.md).

**Depends on** M10.3: the sites are chosen off the map of what has been seen.
It should come after M10.1's "never means never", because a ring drawn round
the shell field would otherwise bring shells back every year.

## Steps

1. **Camp is a position, not the map's camp.** `world.camp` already is one.
   What changes is that it can move, that `sim/save.ts` carries it, and that
   `world.ring` is recomputed from it, not only at construction.
2. **A move is granted by a family level.** Every level from 1 grants one,
   spent when it is used, so a first life gets about one move every two or
   three years and cannot hug the frontier with them. Pitching costs 6 sticks
   and 6 vines from camp, which is one of the things material is for now that
   it has no price.
3. **Which ground will hold a camp**, as a function beside
   `worldgen/reachability.ts` so the rule is one place: the tile is open
   ground, it has been seen, it is not within a few tiles of the camp it would
   replace, a spring is within reach of it, and `nearRing` from it holds at
   least the winter's fruit and the rent in feathers. A valley where nothing
   qualifies offers no move, and says so.
4. **The winter screen**, in `ui/winter.ts`: the drawn map at a size worth
   clicking, legal tiles marked, the pick made by clicking one, and an illegal
   tile refused with the reason it is illegal. It is the map from M10.3, drawn
   larger, so there is one picture of the valley and not two.
5. **What moves with it.** Everything camp kept. The old camp tile becomes
   ordinary ground and the new tile becomes camp.
6. **What follows camp.** The near ring, and with it what comes back every
   summer. The away charge at the end of a summer. The homeward arrow and the
   dusk notice. The list's tent. Each of those reads `world.camp`, so the work
   is checking that none of them remembers the old one.

## Verification

- A move to the far bank, then a winter: the feather field comes back in full
  and the old ring's feathers come back by half, counted over the protocol.
  Non-vacuous by making the same measurement without the move.
- Shells never come back, including when the new ring covers the shell field.
- Each rule in step 3 refused in turn: a tile never seen, a tile with no
  spring in reach, a tile whose ring holds no fruit, a tile beside the current
  camp.
- The away charge, the homeward arrow and the summary all measure from the new
  camp, read back at the end of a summer played over the protocol.
- A save written before the move and loaded after gives the camp it was saved
  with, and the fingerprint still refuses a save from another map.
- Three years played end to end on a seed with a move in winter 2 and another
  in winter 3, to see that nothing the list or the winter model does depends
  on camp being where the generator put it.

## The playtest question

Is the move an obvious yes, or a real choice against the cart and against
keeping the old ring? Is losing the old ring's yearly return felt? Is picking
the site off the map clear, or is a list of described places wanted instead?
