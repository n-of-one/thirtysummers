# M12: planks and the well

Summer 5 of [five-summers.md](five-summers.md), the harvest. Planks go
across the mud flat, a well is dug in the dry pocket, and the pocket's ore
is taken home by cart.

**Depends on** M11, for the cart, its trail, and the mud flat and dry pocket
that M11 puts in view. Also M10, for the shop that opens by family level.

## Steps

1. **Level 3 in the shop.** At level 3 the family knows how to dig a well.
   The well is not bought: knowing it puts it in the build menu, and it is
   dug for 2 logs and 2 sticks as before. The shop also sells planks: the
   town saws 1 log into 2 planks, for 1 gold a plank.
2. **Planks on mud.** A new option in the build menu. Facing a mud tile and
   doing the action lays one plank on it, and the tile becomes a plank tile:
   easy ground the cart can cross. Plank is a new terrain type, added to the
   end of `TERRAIN_ORDER`.
3. **The dry pocket.** An area past the mud flat, too far from any stream to
   work in without a well. It has ore, which takes two slots, sells for 5
   gold, and does not grow back. The dry pocket was taken out of the
   generator earlier, and this step puts it back. `worldgen/rows.ts` gets
   checks that every map has one: out of reach of water, with room for a
   well, and reachable by cart once the mud is planked.

## Verification

- After level 3, the well is in the build menu the next summer.
- Planks are made from logs at the shop's rate, can be laid on mud and
  nowhere else, and the cart can cross them.
- Every map passes the dry pocket's checks in `worldgen/rows.ts`.
- Summer 5 played over the protocol: a well dug, the mud planked, and ore
  brought home by cart.
