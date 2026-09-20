# M10: winter

The screen between summers, upkeep, the shop, the family, and what the map
does between summers, as [../design/winter.md](../design/winter.md)
describes. After this the five-summer unit is complete and the log can say
whether summers 2 to 5 held.

**Depends on** what M8 and M9 left: `world.awayAtEnd`, the resource table in
`sim/resources.ts` with its prices and its `returns`, the cache, the layout
pass that lays every seed out to the table, and `YEAR_GRANTS` in `config.ts`,
which this milestone removes in favour of the shop. `src/sim/trace.ts`, kept
on main by the chores, for trails.

## Steps

1. **The store.** Banking moves everything into `world.store`, a second
   inventory with no limit, valued at the ladder's prices. The HUD's gold
   readout becomes the store's worth plus gold in hand. "Winter needs N
   fruit, store has M" sits beside it all summer.
2. **The winter screen**, in `index.html` and `ui/winter.ts`, with a model
   in `sim/winter.ts` that is pure:
   - keep or sell per kind, sell by default, with the sum and breakdown;
   - upkeep in fruit and gold, with fruit bought or sold automatically and
     the away-from-camp charge;
   - the shop as a list from `SHOP_BY_YEAR`, stocked as
     [five-summers.md](five-summers.md) says, with prices and greying;
   - the family, a surplus total against `FAMILY_LEVELS`.

   Next summer starts from the screen.
3. **Between summers**, in `world.nextSummer`:
   - replenishment by the resource table: the inner ring always, ore and
     shells by the `REPLENISH_SLOW` share, seeded;
   - thicket creep with `THICKET_CREEP_CHANCE` on cut tiles touching
     thicket;
   - saplings back after `SAPLING_RETURN_YEARS`;
   - one bridge tile lost every other winter, the tile chosen
     deterministically;
   - trails with `TRAIL_CHANCE` on underbrush tiles the trace crossed more
     than `TRAIL_CROSSINGS` times;
   - a tired summer after missed upkeep: every hold `TIRED_HOLD_MUL` times
     as long and rough ground at `TIRED_DIFFICULT_SPEED_MUL`, for that
     summer only.
4. **The start of a summer.** A small notice with the length and the
   upkeep, dismissed by the first movement key.
5. **The shop sells the tools.** `YEAR_GRANTS` goes, and the axe, the cart
   and the well are bought instead. The maps are checked again with the
   shop's prices against the ladder, so winter 2 can afford the axe from a
   summer-2 haul.

## Verification

- The winter model over a synthetic store gives the right gold, the right
  fruit bought and sold, the right surplus and level.
- Missed upkeep makes next summer tired, with the hold and the mud speed
  read back, and only for one summer.
- Replenishment, creep, sapling return, bridge loss and trails, each over
  five simulated winters on a small seeded map, with the counts read back.
- Five summers and four winters on `?map=f` over the protocol.
