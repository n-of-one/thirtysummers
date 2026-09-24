# M10.4: the shape of the near ring

The first summer is spent in a ring of one grass with underbrush scattered
over it, so it is walked by dodging rather than by routing, and there is
nothing in it to remember a place by. This milestone gives the ring features
that are nothing but themselves, puts one want in it that the first summer can
see and may not be able to reach, and makes the underbrush something a route
is planned around.

The design is in [../design/summer.md](../design/summer.md) under *The map you
have walked*, for landmarks. Biomes are not this: palette swaps are in
[../archive/decided-against.md](../archive/decided-against.md), and these are
shapes on the same grass.

**Depends on** M10.3, which is what the landmarks are read on, and it is
better after M10.1 and M10.2, so the ring being judged is the one with trees
and trails in it.

## Steps

1. **Features, placed by the layout pass** and not by noise, in
   `worldgen/layout.ts`: a pond, a rock outcrop, a stand of grown trees, a
   hollow of grass ringed by underbrush, and a waterfall where the stream
   bends. One of each a map, positions drawn from the seed, never over a field,
   a pocket, the cart route or camp. None of them is a barrier the table
   depends on, so `worldgen/rows.ts` keeps passing whatever the seed does with
   them.
2. **The island.** A patch in the stream, reachable with two bridge tiles
   instead of one, with 6 feathers on it. That is a summer 1 want worth 6
   gold against a 6 gold rent, and it is visible from the bank from the first
   minute. A player who cannot afford the second tile leaves it and sees it
   every summer after.
3. **Underbrush in fewer, larger patches.** `worldgen/terrain.ts` paints it
   from noise; the dial is the frequency and the threshold. The share of the
   ring that is underbrush stays about where it is, the number of separate
   patches falls and the mean patch is bigger, so the ground ahead is a shape
   to go round or through rather than a texture to dodge.
4. **Landmarks on the map**, from M10.3, and named in the debug overlay so a
   playtest can be talked about afterwards without opening the map file.

## Verification

- Over the seed spread: every map has each feature exactly once, no feature
  overlaps a field, a pocket, the route or camp, everything the table needs is
  still reachable, and `worldgen/rows.ts` passes.
- The island takes two bridge tiles and not one, checked by building both over
  the protocol.
- Over 20 seeds: the underbrush share of the ring, the number of connected
  patches and the mean patch size, before and after, as three numbers.
- Screenshots of the ring on three seeds, before and after, so "more
  interesting" is argued over pictures.

## The playtest question

Is the ring worth walking a second summer? Can the player say where they are
without looking at the map? Does the bigger underbrush make a route a decision,
or just a longer way round? Is the island wanted?

## Open

Whether the ring at 58 tiles of radius is still too large once its food is on
four trees and its underbrush is in patches. The radius is the cheapest dial
on the map and it is deliberately not touched here, so that the log can say
whether the shape or the size was the problem.
