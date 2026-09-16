# M9: the map

The barriers, resources and improvements the five-summer table needs, and
five new maps that hold it. Playable as five summers back to back, with no
winter yet. The axe and the well are given at the start of the summer whose
table row needs them, so the map can be tested before the shop exists.

**Depends on** M8: the `spring` terrain and drinking spots.

## Steps

1. **Terrain.** `sapling` (impassable, felled by the axe, glyph `t`),
   `spring` from M8, and the well as a placed spring.
2. **Resources.** `feather`, `log`, `shell` join `stick`, `vine`, `ore`,
   `fruit`. One table in `sim/resources.ts` gives each kind its glyph,
   ground, slots (log takes two), price, and whether it comes back every
   winter, slowly, or never. `RESOURCE_KINDS` and `NODE_GROUND` move into
   it. The inventory counts slots, not items.
3. **Tools.** `world.tools` is a set: the knife from the start, the axe and
   the cart granted by the map's year table for now. Felling is a hold of
   `FELL_TIME` on a sapling tile with the axe. It leaves grass and one log
   in the pack.
4. **Improvements.** The well is a hold on a grass tile far from water with
   `WELL_LOGS` and `WELL_STICKS` in the pack, and leaves a `spring` tile.
   The cache is a hold on grass with `CACHE_STICKS`, and leaves a `cache`
   prop the player can bank into and fetch from with the same key. Its
   contents are a second inventory with no limit. The bridge is unchanged.
5. **The maps.** Five maps cut from generated dumps as before and edited to
   the table in [five-summers.md](five-summers.md). `map:check` grows a
   check per row: what is reachable on foot, once cut, once bridged, once
   felled, and how far each pocket is from water.
6. **Art.** Placeholder art for the new terrain and kinds, and Minifantasy
   sprites picked for contrast, as the vine and stick were. Feathers are not
   in the crafting pack, so they need a sprite from another pack or one
   drawn in the style.

## Verification

- The resource table round-trips through the map file.
- Slots count, and a log takes two.
- Felling needs the axe and takes its hold.
- The well makes a drinking spot, and refuses near water.
- The cache holds and returns.
- `map:check` passes all five maps on every row.
- Five summers on one map over the protocol, with the year table granting
  tools, reading back that each summer's row opens.
