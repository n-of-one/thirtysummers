# QoL: before the map

What the M8 playtest tripped on, built before M9 so the map is played on a
view that is the same on every screen. One mechanic moves: the springs go
to the bank. Nothing else about the game changes.

**Depends on** M8, done.

## Steps

1. **A fixed view.** The game is drawn in a logical view of
   `VIEW_W × VIEW_H` CSS pixels at `TILE 64`, centred in the window and
   scaled to fit it, with black bars where the window's shape differs. The
   scale is floored to a multiple of 1/8, so an art pixel is always a whole
   number of screen pixels: 1.5 on a full HD screen for 1280×720, 2 on
   1440p, 3 on 4K. One wrapper holds the canvas, the grid, the fog, the HUD,
   the summary card and the debug panel, and one transform scales them
   together. Pixi is given the view size once, and its resolution follows
   the scale, so the backing store is one device pixel per screen pixel.
   Everything that read the window reads the view instead: the camera and
   the sprite pools, the fog layer, the prompt clamp, the teleport click.
   The fog's widest radius becomes `FOG_MAX_RADIUS_SHARE` of the view's half
   width, so the ring keeps its shape at any size. `?view=1280x720`
   overrides the size for the experiment. Chosen in play: full HD,
   1920×1080, over 1280×720. A Full screen button in the top right corner
   gives the view the whole screen.
2. **Tools act on the tile ahead.** `player.heading` is the last direction
   the input asked for, eight ways, kept while standing still and empty
   until the first step. Cutting and building act only on the neighbour of
   the player's own tile in that direction, never a tile beside it in
   another direction, and nothing before the first step. The marker on that
   tile is an outline only; how far a hold has got shows in the prompt.
   Harvesting and drinking stay nearest-to-the-player: nodes are sparse, and
   a node is picked by standing at it.
3. **The last minute.** `HOMEWARD_SEC` replaces `CLOCK_URGENT_SEC`. Below
   it the clock turns as now, and away from camp a standing notice joins the
   thirst one under the player: "Summer ends in 0:41. Get back to camp." At
   camp the End summer button is in the stack under the player, never over
   them, and Q does the same, so nothing is said. An arrow
   at the edge of the view points at camp whenever camp is off screen in the
   last minute, placed where the line from the player to the camp leaves the
   view, `EDGE_ARROW_MARGIN_PX` in, and turned to point along it. Its
   geometry is a pure function beside `anchorPosition`, tested the same way.
   And the last minute is drawn as dusk, the parked idea from ideas.md: a
   full-view layer between the canvas and the fog, `DUSK_COLOR` under a
   multiply blend, whose opacity rises from nothing at `HOMEWARD_SEC` to
   `DUSK_MAX_ALPHA` at the end. It is an even warm tint over everything, so
   it stays tellable from the fog, which is a black ring; the HUD sits above
   both. It is written in steps, like the fog's radius, so most frames write
   nothing. The dusk shows at camp too, since it is the evening, not a
   warning. Only the end of a summer has it; a dawn was tried and dropped.
   The fog's edge is being tried darker, over the same clear radius.
4. **Springs in the reeds.** The `spring` terrain goes. A spring is a
   drinking spot on a walkable bank tile, drawn as the reed sprite the
   discovery test used for water, `farmCrops` 16,7, and the droplet in the
   placeholder pack. `world.springs` is a list of tile positions the prop
   layer draws like the camp. Placement: every walkable tile touching the
   stream on any of its eight sides is a candidate, outside the camp's
   clearance; the candidates are shuffled by the map's seed and taken with
   `SPRING_SPACING_TILES` between them, so the springs sit along the water
   the way the water nodes did. The same pass runs on a parsed map with a
   fixed seed, so a hand-edited map gets the same springs every load and
   carries none in its file. The `o` tiles in the five maps become grass by
   a script in `tmp/`, without reading the maps. Drinking is a hold beside a
   spring while the bar is below `DRINK_OFFER_BELOW`, as now, and the stream
   being in reach no longer suppresses it: on a spring's tile the key drinks
   when thirsty and lays a bridge otherwise. That is the archived "drinking
   at a stream bank", reopened on purpose; the reason is in the archive. The
   well in M9 becomes a placed spring with its own sprite. To watch in play:
   a thirsty player mid-bridge beside reeds is offered the drink first.
5. **Banking fruit.** The store from summer.md, as `world.store`, an
   inventory with no capacity. Banking at camp moves fruit into it and ore
   into gold in one press. Sticks and vines stay in the pack, because until
   winter can sell them banking them is losing them, and a bridge gets rid
   of them. The prompt says what a press banks, "Press E to bank 3 ore and
   2 fruit", the refusal is "Nothing to bank", the summer's end banks
   carried fruit too, the gold pill gains the store's fruit, and the summary
   card gets "Fruit stored".
6. **Pause.** `P` pauses: nothing steps, the camera and the water hold, and
   a "Paused" card covers the view. The window losing focus pauses too,
   since a five-minute clock and a doorbell do not mix. Any key resumes, and
   that key does nothing else; focus alone does not, so coming back to the
   window is not the same as being ready. The page title becomes "thirtysummers".
7. **Docs.** [../rationale/technical.md](../rationale/technical.md): the fog
   paragraph loses "full HD", the two spring paragraphs under "Stats" are
   rewritten for the bank, and a paragraph each on the fixed view and its
   scale steps, on aiming, on the dusk beside the fog, and on the store.
   [../architecture.md](../architecture.md): the fixed decisions gain the
   view, and the tile-rendering rule reads "view size".
   [../development.md](../development.md): `?view=`, the pause key, and a
   note that the rig's window size no longer changes what is measured.

## Verification

- With the window at 1920×1080 and at 1366×768, the canvas is
  `VIEW_W × VIEW_H` logical pixels, the wrapper's scale is a multiple of
  1/8, and a screenshot shows the bars. The fog's dark begins the same
  number of tiles from the player at both.
- On a bridge tile with the heading along the bridge, the marker is on the
  tile ahead at every position across the tile, walked, not teleported, and
  has no progress bar.
- At `HOMEWARD_SEC` left and away from camp, the notice shows the clock's
  seconds and the arrow points at camp within a degree. At camp neither
  shows; the End summer button is under the player without overlapping the
  drawn sprite, and Q ends the summer there and nowhere else.
- The dusk layer is at zero until `HOMEWARD_SEC` are left and at
  `DUSK_MAX_ALPHA` at the end. A screenshot at the end is darker and warmer
  in its mean pixel than one at midday, with the fog held at full hydration
  so the fog is not what is measured.
- The Full screen button enters full screen and leaves it, and its label
  follows.
- Every spring touches the stream, none is within `SPRING_SPACING_TILES` of
  another, and a parsed map gets the same springs twice. On a spring's tile
  the key drinks when thirsty and bridges when not. No `spring` terrain in
  `src/`, no `o` in `public/maps/`.
- Fruit and ore leave the pack at camp, sticks and vines stay, a summer
  ended away banks fruit, and the store shows in the HUD and on the card.
- Ten seconds paused leave the clock where it was, and a blur pauses. A key
  other than P resumes, a modifier alone does not, and Q pressed to resume
  at camp does not end the summer.
- One summer played on `?map=b` over the protocol, walked not teleported,
  drinking at the bank and bridging beside it.
- Everything under "What must keep passing" in
  [../development.md](../development.md).
