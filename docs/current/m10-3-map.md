# M10.3: the map in the corner

The character keeps a map. It holds only ground that has been on screen at
some point in some summer, and it fills over a life. It is the one record of
where the family has been, and it is what makes a summer feel like uncovering
something rather than walking the same valley again.

The design is in [../design/summer.md](../design/summer.md) under *The map you
have walked*. Dimming the play view instead is in
[../archive/decided-against.md](../archive/decided-against.md).

**Depends on** nothing, and M10.5 depends on it: a camp can only be pitched on
ground the family has seen, and the winter screen picks the site off this map.

## Steps

1. **A seen mask.** A `Uint8Array` beside the tile grid in `sim/world.ts`,
   one byte a tile, set for every tile inside the view each frame. It is
   cheap: the view is about 60 by 34 tiles.
2. **Fog narrows what is seen.** When hydration is below
   `HYDRATION_FOG_THRESHOLD` the view is a shrinking circle, so what counts as
   seen is that circle and not the whole rectangle. Running dry then costs the
   survey as well as the view, which gives the fog a second thing to do and
   costs nothing to build.
3. **The widget**, in `ui/hud.ts` and `ui/hud.css`: a canvas in the top right,
   under the list, the map's 200 by 180 tiles at one logical pixel a tile.
   Only newly seen tiles are redrawn; the player's dot is redrawn each frame.
4. **What it draws.** Easy ground, rough ground, water and walls as four
   coarse colours; camp; bridges; wells; worn trails as their own colour, so
   the road the player made is visible as a road; the landmarks once M10.4
   places them; and the player. It does not draw resource nodes: the field the
   player remembers is the reward for having gone there, and a map that marked
   every node would answer the question the exploring is made of.
5. **It persists.** The mask is world state across the summers of a run and
   goes into `sim/save.ts` as `seen`, packed as a run length rather than a tile
   list, since most of it is blank early and most of it is set late.
6. **Nothing else changes.** No key opens it, nothing pauses for it, and the
   clock does not care that it is there.

## Verification

- A path driven over the protocol, then the seen count compared with the tiles
  that path's views covered. Equal, not approximately.
- A teleport with `?debug=1` to the far corner and back leaves the ground
  between them unseen, checked in the mask and in a screenshot of the corner.
- The mask survives `nextSummer` and a save and load.
- A summer run dry marks fewer tiles than the same walk kept watered, with the
  two numbers reported. Non-vacuous by removing step 2 and watching them meet.
- Frame time over a summer at 10x with the widget on and off, so the redraw
  cost is a number and not an opinion.

## The playtest question

Does the map make a summer feel like uncovering ground? Is it looked at, and
when? Does not marking the nodes leave the player lost, or is remembering the
fields the good part? Is the corner the right place, against a list across the
top and a pack across the bottom?
