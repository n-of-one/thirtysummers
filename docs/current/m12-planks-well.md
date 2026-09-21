# M12: planks and the well

Summer 5 of [five-summers.md](five-summers.md), the harvest: planks across
the mud flat, a well in the dry pocket, and its ore hauled home by cart.

**Depends on** M11: the cart and its trail, and the mud flat and dry pocket
it leaves in view. M10: the shop by family level.

## Steps

1. **Level 3 in the shop.** The well, known rather than bought, which puts
   it in the build menu, dug for 2 logs and 2 sticks as before. Planks: the
   town saws 1 log into 2, for 1 gold a plank.
2. **Planks on mud.** A build on the menu that lays one plank on a mud
   tile, as a hold, turning it into a plank tile: easy ground the cart can
   cross. A new terrain, appended to `TERRAIN_ORDER`.
3. **The dry pocket.** Past the mud flat and too far from water, with ore:
   two slots, 5 gold, never back. The layout puts it back and the rows hold
   it: dry, room for a well, and reachable by cart once the mud is planked.

## Verification

- A well bought at level 3 is in the build menu the next summer.
- Planks from logs at the shop's rate, laid on mud and nowhere else, and the
  cart across them.
- The dry pocket's rows on every map.
- Summer 5 over the protocol: a well dug, the mud planked, ore brought home
  by cart.
