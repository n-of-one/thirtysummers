# M10.7: camp that moves

From summer 2 on, every trip out starts with the walk from camp to the far
bank, over ground that was already picked the summer before. A family with
standing can pack up camp and pitch it somewhere it has walked. That removes
the walk, and the old ring then comes back by half, like any other ground
outside the ring.

The design is in [../design/winter.md](../design/winter.md) under *Where camp
stands*, and the same move between lives is in
[../design/map-arc.md](../design/map-arc.md).

**Depends on** M10.3, because the site is chosen on the map of what has been
seen. It should come after M10.1, which made shells never come back
anywhere; otherwise a ring drawn round the shell field would bring shells
back every year.

## Steps

1. **Camp is a position, not a fixed place on the map.** `world.camp` is
   already a position. What changes: it can move, `sim/save.ts` saves it,
   and `world.ring` is recomputed from it whenever it moves, not only when
   the world is built.
2. **Each family level grants one move.** Every level from 1 grants one,
   used up when it is spent, so a first life gets about one move every two or
   three years and cannot keep camp at the edge of what has been reached.
   Pitching camp costs 6 sticks and 6 vines from camp, which gives material a
   use now that it does not sell. Since M10.5 the bramble bay gives 4 sticks a year,
   and the bridge and the axe take 6 of the first two years' 8, so 6 sticks
   saved is summer 3 at the earliest. That may suit the story, where winter 3
   is the cart or the move; decide it here.
3. **Which ground can take a camp**, as a function next to
   `worldgen/reachability.ts`, so the rule lives in one place. The tile must
   be open ground, it must have been seen, it must not be within a few tiles
   of the current camp, a spring must be within reach of it, and the near
   ring around it (`nearRing`) must have at least the winter's fruit and the
   rent in feathers. If nowhere in the valley qualifies, no move is offered,
   and the screen says why.
4. **The winter screen**, in `ui/winter.ts`: the drawn map at a size big
   enough to click on, with the allowed tiles marked. The player picks a tile
   by clicking it, and a tile that is not allowed is refused with the reason.
   It is the map from M10.3 drawn larger, so there is one picture of the
   valley, not two.
5. **What moves with camp.** Everything stored at camp. The old camp tile
   becomes ordinary ground and the new tile becomes camp.
6. **What depends on where camp is.** The near ring, and with it what comes
   back every summer; the extra charge for ending a summer away from camp;
   the arrow home and the dusk notice; the tent on the list. Each of these
   reads `world.camp`, so the work is checking that none of them keeps the
   old position.

## Verification

- Move camp to the far bank, then play a winter: the feather field comes
  back in full and the old ring's feathers come back by half, counted over
  the protocol. To show the check is not vacuous, make the same measurement
  without the move.
- Shells never come back, even when the new ring covers the shell field.
- Each rule in step 3 is refused in turn: a tile never seen, a tile with no
  spring in reach, a tile whose ring has no fruit, a tile next to the current
  camp.
- The away charge, the arrow home and the summary all measure from the new
  camp, read back at the end of a summer played over the protocol.
- A save written before the move and loaded after has the camp position it
  was saved with, and the save's fingerprint still refuses a save from
  another map.
- Three years played end to end on one seed, with a move in winter 2 and
  another in winter 3, to check that nothing in the list or the winter model
  depends on camp being where the generator put it.

## The playtest question

Is moving camp an obvious yes, or a real choice against buying the cart and
against keeping the old ring? Does the player notice losing the old ring's
yearly return? Is picking the site on the map clear, or would a list of
described places be better?
