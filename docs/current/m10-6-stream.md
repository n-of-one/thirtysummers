# M10.6: the stream

**Not designed yet.** This file holds the problem and what M10.5 and the old
ring milestone left for it. It gets its steps once the brainstorm settles them.

The first stream is a half circle round camp, 58 tiles out, run down to the
bottom border. It closes the near ring, and it is the first barrier: the
feather field is across it, and the bridge is the first summer's goal. It
does both jobs, but its shape is a perfect arc, and that looks as artificial
as the mud disc and the sapling stand did.

## What any new stream has to keep

- The near ring stays closed: everything camp can reach without crossing
  water, with the fruit and feathers the table in
  [five-summers.md](five-summers.md) needs.
- Springs on both banks, often enough that inside the ring hydration is no
  concern.
- The rules in `worldgen/water.ts`: no stretch one tile across, and no two
  water tiles that touch only at a corner.
- The feather field across it, reached with a bridge the first summer can
  pay for. The narrowest crossing is now 3 tiles on every test seed, and the
  bramble bay's 4 sticks are counted on it: 3 for the bridge and 1 left, so
  the axe's 3 need a second trip into the bramble bay in summer 2. A narrowest crossing of 4
  leaves no stick, and one of 5 cannot be paid for in summer 1 at all.

## Left here by M10.5

- **The ring's own ground follows the half circle.** The layout chooses the
  near ring's ground settings, `RING_GROUND`, before the stream is laid, by
  geometry: `groundFor` in `worldgen/layout.ts` takes the half circle of
  radius `NEAR_RING_RADIUS` and the strip below camp. The band of bank along
  the stream hides where the two settings meet. A stream of another shape
  needs the same line, or the settings taken from the stream's own course, or
  the border shows as a change of ground away from the water.
- **The bramble bay keeps off the banks by distance from camp.**
  `findBrambleBay` only takes spots at most
  `NEAR_RING_RADIUS - BRAMBLE_BAY_FROM_STREAM` from camp, and
  `carveBrambleBay` puts no bramble within 5 tiles of the half circle. With another
  shape both have to measure the distance to the stream itself.
- **The mud near water** is measured from the stream tiles themselves
  (`waterBoost`), so it follows any shape as it is.

## Left here by the old ring milestone

- **The island.** Land in the stream reached by two bridge tiles instead of
  one, with 6 feathers on it: visible from the bank in the first minute, and
  worth the rent in summer 1. It was written when the sticks' place had 6.
  With 4, the first bridge and two tiles to the island cost 5, one more than
  the bramble bay has, so summer 1 can have one of the two unless the
  island's tiles count towards the crossing or the bramble bay's sticks
  change.
- **A waterfall where the stream bends**, as a landmark, drawn on the map.

## Open

- What makes the stream look natural: bends, width that changes, a
  tributary, where it comes from and where it goes.
- Whether the ring's radius changes with the shape. It was left alone so the
  playtest log could say whether the problem was the layout or the size.
