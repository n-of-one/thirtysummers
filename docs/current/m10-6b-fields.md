# M10.6b: the fields in the valley

**Not designed yet.** This file has what M10.6a left for it. It gets its
steps once the brainstorm settles the open questions below.

M10.6a built the valley with only the near ring's food in it: the plan is
`VALLEY` in `src/config.ts`, laid out by `src/sim/worldgen/valley.ts`, and
why is in [../rationale/design.md](../rationale/design.md) and
[../rationale/technical.md](../rationale/technical.md) under "The valley".
This milestone puts the rest of the table from
[five-summers.md](five-summers.md) back into it, and switches the field
tests back on.

## What goes back

- **The bramble bay and its 4 sticks,** in camp's part. `findBrambleBay`
  still takes spots by distance from camp, between `BRAMBLE_BAY_FROM_CAMP`
  and `NEAR_RING_RADIUS - BRAMBLE_BAY_FROM_STREAM`, and `carveBrambleBay`
  keeps brambles 5 tiles inside `NEAR_RING_RADIUS`. Both have to measure
  from the near ring's own edge and the water instead, and then
  `NEAR_RING_RADIUS` goes.
- **The vines' pocket,** in camp's part. `Wet.pocket` in `layout.ts` still
  looks for it by angle and distance from camp, on the side away from the
  copse, with the half circle's radius. It has to follow camp's part.
- **The feather field,** on the open bank, across the first stream from
  camp, with its fruit tree.
- **The copse and the shells behind it,** further up the open bank, since
  the far bank is closed. The strip of grass that is the one way in to the
  shell field comes back with them, and with it `Stamp.line` and
  `Stamp.moat`, which M10.6a removed from `layout.ts`; git has them.

## What M10.6a switched off, to switch back on

- `FIELDS` in `tests/layout.test.ts`, which skips the field tests: set it
  to true.
- The rows marked `field` in `src/sim/worldgen/rows.ts`, and the "off until
  M10.6b" in `scripts/checkmap.ts`. Once every row holds, the mark goes.
- `tests/save.test.ts` plants a thicket tile and a sapling beside camp,
  because the valley had none. With the brambles and the copse back, it can
  cut and fell the real ones again.
- The config for the old fields is still there, unread: `FEATHER_FIELD_*`,
  `SHELL_FIELD_*`, `ROUTE_BEND_FROM_FIELD`, `COPSE_*`, `HEDGE_*`, and the
  `MUD_POCKET_*` angles. Keep what the new layout uses and delete the rest.

## What the valley gives to place them in

- Camp's part, the near ring, is 8,800 to 9,300 walkable tiles on the test
  seeds, with camp three quarters of the way down it and two ponds.
- The first stream crosses the valley north of camp, 3 tiles across at its
  narrowest, and falls into the lake from the north.
- The open bank is the large part across the stream, with a side valley off
  its west wall. It has no ponds yet, so its only water is the first
  stream, and thirst is felt away from it.
- The far bank is closed in these five summers: nothing reaches it.

## Open

- How far up the open bank the feather field and the copse sit. In the old
  layout they were 20 and about 45 tiles past the stream, and the walk is
  what summers 2 and 3 are made of.
- Whether the side valley off the open bank's west wall is where the copse
  goes, so that it is a place and not a disc on open ground.
- Whether the far bank gets anything visible from the open bank, as a tease
  for later, the way the shells showed through the copse.
- How many ponds the open bank has, and where: the feather field and the
  shell field each need water within reach, and thirst is meant to be felt
  further out.
- Where in camp's part the bramble bay and the vines' mud go, now that the
  part is not a half circle round camp.
