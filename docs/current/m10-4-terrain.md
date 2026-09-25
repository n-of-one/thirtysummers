# M10.4: features in the near ring

The first summer is spent in a ring of plain grass with underbrush scattered
over it. The player walks it by dodging instead of planning a route, and
there is nothing in it to remember a place by. This milestone gives the ring
features that are only themselves, puts one thing in it worth wanting that
the first summer can see but may not reach, and makes the underbrush
something to plan a route around.

The design of landmarks is in [../design/summer.md](../design/summer.md)
under *The map you have walked*. This is not biomes: palette swaps are
rejected in [../archive/decided-against.md](../archive/decided-against.md),
and these features stand on the same grass.

**Depends on** M10.3, because landmarks are read on the map. It is better
built after M10.1 and M10.2, so the ring being judged already has its trees
and trails.

## Steps

1. **Features, placed by the layout pass** in `worldgen/layout.ts`, not by
   noise: a pond, a rock outcrop, a stand of grown trees, a hollow of grass
   ringed by underbrush, and a waterfall where the stream bends. One of each
   per map, placed from the seed, and never over a field, a pocket, the way
   in to the shell field, or camp. None of them is a barrier the table
   depends on, so the checks in `worldgen/rows.ts` keep passing whatever the
   seed does with them.
2. **The island.** A patch of land in the stream that takes two bridge tiles
   to reach instead of one, with 6 feathers on it. That makes it worth 6 gold
   in summer 1, against a rent of 6 gold, and it can be seen from the bank
   from the first minute. A player who cannot afford the second tile leaves
   it, and sees it again every summer after.
3. **Underbrush in fewer, larger patches.** `worldgen/terrain.ts` paints
   underbrush from noise, and the settings are the frequency and the
   threshold. The share of the ring that is underbrush stays about the same,
   but there are fewer separate patches and the average patch is bigger. The
   ground ahead then becomes something to go round or through, instead of a
   texture to dodge. M10.2 already set how thick underbrush starts, in
   `FOREST_THRESHOLDS`, so read this step again before building it.
4. **Landmarks on the map**, from M10.3, and named in the debug overlay, so
   a playtest can be talked about afterwards without opening the map file.
   On the map they are marks in `mapMarks` (`ui/mapPicture.ts`), like fruit
   trees and camp, so `isLandmark` keeps them when the whole map fades as
   the character becomes dehydrated.

## Verification

- Over the spread of test seeds: every map has each feature exactly once, no
  feature overlaps a field, a pocket, the route or camp, everything the
  table needs is still reachable, and `worldgen/rows.ts` passes.
- The island takes two bridge tiles, not one, checked by building both over
  the protocol.
- Over 20 seeds, three numbers before and after: the share of the ring that
  is underbrush, the number of connected patches, and the average patch
  size.
- Screenshots of the ring on three seeds, before and after, so "more
  interesting" can be argued over pictures.

## The playtest question

Is the ring worth walking a second summer? Can the player say where they are
without looking at the map? Do the bigger patches of underbrush make a route
a decision, or just a longer way round? Does the player want to reach the
island?

## Open

Whether the ring, 58 tiles in radius, is still too large once its food is
on five trees and its underbrush is in patches. The radius is the cheapest
setting on the map to change, and it is left alone here on purpose, so the
log can say whether the problem was the layout or the size.
