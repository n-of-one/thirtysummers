# M10.6a: the valley

The map stops being a square with a half circle of stream in it. It becomes
a winding valley walled by rock, with a river down its length in a ravine,
a lake at the fork, and a stream off the west wall. This milestone builds
the valley and its water, puts camp in it, and scatters only the near
ring's food. The fields of the table come in
[M10.6b](m10-6b-fields.md), once the valley has been walked. What was
decided and why is in [../rationale/design.md](../rationale/design.md) under
"The valley".

## What the valley is

Three parts, split by water:

- **Camp's part**, the near ring: between the west wall, the stream, the
  lake and the river, at the bottom of the valley, with the gorge and the
  town past its southern tip. It is at least as large as the half circle's
  ring was, about 6,700 tiles.
- **The open bank**: across the stream, the big part of the valley, with a
  side valley off its west wall. The first bridge reaches it.
- **The far bank**: across the river, narrow and winding, with a side valley
  that hooks back south. Nothing reaches it in the first five summers.

**The river** comes out of the rock at the head of the valley, runs down
the east side in its ravine into the lake, leaves the lake to the south,
and runs past camp to the gorge. It flows roughly north to south, a few
degrees off true. The ravine is a band of cliff on both banks. Cliff is a
wall like rock, so the river is never reached: it cannot be drunk from,
bridged or crossed.

**The lake** lies at the fork, at the river's level, walled by cliff like
the river.

**The stream** is the one crossable water. It starts at a waterfall on the
west wall, crosses the valley floor with ordinary banks, turns south, and
falls into the lake over the lake's north cliff. The pack's waterfall only
falls towards the viewer, so the stream has to reach the lake from the
north. It is 3 tiles across, the width of the waterfall art, and its
narrowest crossing is 3 tiles, which is what the first bridge is priced at.
The tiles the stream falls over are cliff, so a bridge can never be laid
down the falls into the lake.

**Ponds** are the drinking water away from the stream: small still water
on the valley floor, with springs round the edge like the stream's. Camp's
part has at least one pond, far enough from the stream that no part of
camp's part is more than 80 tiles' walk from a spring. The open bank has a
few, sparser up the valley. The far bank has none for now. Springs are
placed exactly as now: on walkable tiles touching water. The river and the
lake have none, since only cliff touches them.

**Camp** stands three quarters of the way down camp's part, in the middle
of its width at that row. That is a starting point; M10.7 decides where
camp can be.

**The size** is the sketch's at a scale of 1.3: about 312 by 465 tiles,
with about 50,000 walkable tiles against the whole of today's 28,000. The
scale is one number in config, so the valley can grow or shrink later
without being redrawn.

## How it is generated

The valley is a **plan**: written once, in its own coordinates, and then
turned and scaled onto the map. Everything that varies from seed to seed
is noise on top of the plan: the outline of the walls, the meanders of the
river and the stream, the shape of the lake and the ponds. The plan may be
mirrored east to west by the seed, since the waterfall's direction survives
a mirror. It must not be turned by more than a few degrees, since the
waterfall's does not.

The sketch the plan comes from, in its own coordinates (256 across, mouth
at the bottom left), turned -24 degrees and scaled by 1.3. Each point is
x, y and a half width:

- the valley's spine: (56, 262, 10), (66, 226, 40), (70, 190, 58),
  (62, 150, 50), (84, 112, 46), (130, 96, 48), (178, 82, 46),
  (206, 50, 36), (216, 20, 16), (220, 4, 8);
- the open bank's side valley: (70, 120, 18), (40, 90, 15), (28, 60, 8);
- the far bank's side valley: (120, 110, 18), (150, 150, 16),
  (160, 180, 8).

The floor is every tile within the half width of the spine or a side valley,
with the wall's distance pushed by noise (9 tiles at a scale of 28, and 2.5
at a scale of 7). The rest is rock.

The water, in map coordinates after the turn:

- the river: (229, -6), (251, 40), (267, 80), (271, 110), (251, 140),
  (224, 173), (204, 197), (186, 225), (174, 255), (166, 286) into the lake,
  and out from (158, 312) through (164, 332), (174, 357), (160, 400),
  (166, 443) to (174, 480);
- the lake: centred on (155, 302), 20 by 12, turned -10 degrees;
- the stream: (30, 306), (60, 300), (92, 290), (118, 280), (134, 284) to
  (142, 292) on the lake's north shore;
- a pond in camp's part near (88, 372), about 7 by 5.

These come from sketches, not from play, and M10.6b may move any of them.

In order:

1. Lay out the plan: floor, rock, the river's line, the lake, the stream's
   line and the ponds, as masks, before any terrain is painted.
2. Find camp's part from the masks, and put camp in it.
3. Paint the terrain as now. The ground settings come from the masks:
   `RING_GROUND` in camp's part, `GROUND` elsewhere. This replaces the
   circle `groundFor` measured.
4. Stamp the water and the cliff. The ravine, river and cliff together, is
   laid on a 2-tile lattice, because the cliff art is drawn on one (below).
   The river's cliff is at least one lattice cell wide on each bank.
5. Mud where the water is (`waterBoost` already measures from stream tiles),
   then the near ring's fruit trees and feathers, scattered over camp's
   part and not over a circle, then the springs.

Out of `layout.ts` go the half circle and `clearBanks`, the feather field,
the shell field, the copse and its route, the bramble bay and the vines'
pocket. Those last four come back in M10.6b. The map is no longer
`LAYOUT_W` by `LAYOUT_H`: the plan decides its size.

## What the art gives

Read off the Forgotten Plains sheets while mocking this up. The mockups
were made from these, and the numbers are what a renderer needs.

- **The cliff** is the one-level earth plateau, the plus-shaped piece at
  (268, 64) on `Minifantasy_ForgottenPlainsTiles.png`. It is drawn on a
  16-pixel lattice starting at that corner, so a cell is 2 by 2 tiles. Where
  the high ground ends to the south, the lowest 12 pixels of the last cell
  are the cliff face. Everywhere else the edge is a rim, 3 to 6 pixels wide.
  The plus has every piece a lattice outline needs: outer corners, inner
  corners, and the straight edges cut from the middle of its arms.
- **A deeper cliff** is needed where the stream falls: the waterfall drops
  20 pixels. Repeating the face's middle rows made a 20-pixel face that
  looked right in the mockup. The two-level plateau at about (360, 56) has a
  face of about that height of its own, and is the other way to get it.
- **The waterfall** is three layers in `Tileset/River/Waterfall/`, each with
  four frames 32 pixels apart: the ground, the falling water and the splash.
  In frame 0 the stream is columns 8 to 31 (18 pixels of water between
  3-pixel banks), the drop is rows 20 to 39, and the splash is rows 37 to 45.
  The ground layer's last 8 rows are a pool with grass banks, which is left
  out, since what the falls land in is the lake.
- **Only a cliff facing south shows a face.** A cliff facing north is a thin
  rim, and one facing east or west is a strip 4 to 6 pixels wide. So the
  river looks deepest where it runs east to west.
- **The cliff is drawn over its own tiles.** In the mockups the face sat on
  the high ground's cells, and in the game that would put a face on tiles
  the player can walk. Whatever the renderer does, a tile that shows cliff
  is a cliff tile, and a tile the player walks shows ground.

The mockups were `tmp/mockups/ravine-falls.png` and `ravine-lake.png`, from
`tmp/ravine.html`, which may be gone by the time this is built.

## What changes elsewhere

- **A new terrain kind, `cliff`,** appended to `TERRAIN_ORDER`: a wall, like
  rock, with its own glyph for the map file and its own colour on the map in
  the corner. The river and the lake stay `stream`: the cliff is what keeps
  the player off them.
- **The map in the corner and the whole map on M** draw a map that is
  neither square nor 168 across. The whole map scales to fit, as now.
- **Tests that check the table's fields are switched off** until M10.6b:
  the rows for the bramble bay, the vines, the feather field, the shells
  and the copse, and the economy rows that count them, with the layout tests
  that measure the same things. They are skipped with a note pointing to
  M10.6b, not deleted. What stays on: determinism, the map-file round trip,
  the stream's shape rules, springs never behind mud, and the near ring's
  food.
- **A save from before this milestone** is for a map that no longer
  exists. It is not carried over.

## Verification

Measured over the protocol and with `npm run map:check`, on the usual
spread of seeds:

1. Camp's part is at least 6,700 walkable tiles, and camp stands in it, three
   quarters of the way down.
2. The near ring, as `nearRing` works it out, is camp's part: nothing across
   the stream, the lake or the river is in it.
3. No path from camp reaches the river or the lake, or the far bank, even
   with bridges laid on every stream tile. That also proves the falls
   cannot be bridged.
4. The stream's narrowest crossing is 3 tiles, and it is nowhere one tile
   across.
5. No walkable tile of camp's part is more than 80 tiles' walk from a spring,
   and part of the open bank is.
6. A summer is walked from camp across the first bridge site and up the
   open bank. The cliff is seen in a screenshot facing south, facing north
   and running north to south, with the falls where the stream meets the
   lake.
7. Generating a map is timed. The valley has five times as many tiles as
   the old map, and a seed that takes too long to regenerate is a problem
   to know about now.

## Questions for the playtest

- Does the valley read as a valley: a place with a shape, not a map with a
  border?
- Is the river's cliff seen as a wall, from every side?
- Does the waterfall draw the eye to the lake, and does the lake read as the
  centre of the lower valley?
- Is camp's part the right size, and camp in the right place in it?
- Is the pond found, and used, and is thirst ever felt on the open bank?
