# Technical rationale

Why the code is built the way it is, and what was learned building it.
Nothing here is needed to execute [the plan](../current/PLAN.md). It is here
so the same ground is not argued twice. Why the mechanics are what they are
is in [design.md](design.md).

## Stack

**PixiJS rather than a game engine.** Pixi is a renderer and nothing else. It
draws sprites fast and has no opinion about game state, so `sim/` can be plain
TypeScript with zero renderer imports and stay unit-testable. What an engine
would hand us here is cheap to write anyway: collision is AABB against a tile
grid, input is `keydown`/`keyup` into an object, the camera is a container
offset.

Rejected: **Phaser** wants to own game state via scenes and physics bodies, which
pulls directly against the pure-sim split; its arcade physics buys little when
collision is tile-grid AABB. **Three.js** gives real height for free but is a
much heavier stack and slower to iterate on for a top-down feel test.
**Excalibur** is a genuinely nice TS-first engine with a smaller ecosystem and
less material to draw on when something breaks. **Raw Canvas2D** is fine at this
size but hits fill-rate limits as soon as stacked layers, lighting or bigger maps
arrive. **`@pixi/tilemap`** works, but the sprite-pool window is ~100 readable
lines, carries no version-lag risk against Pixi, and handles terrain edits and
z-layers identically. Keep it in mind if tile rendering ever becomes the
bottleneck.

**mulberry32 rather than `alea`.** `simplex-noise@4` takes a `random()` function
rather than bundling a PRNG. `alea` is a decade-old untyped package; fifteen
lines give the same seeded determinism with no dependency and code that can be
read.

## Art licence

The Minifantasy licence permits using the art **in** a game, commercially and
without limit, but forbids redistributing the assets "as games assets, images or
NFTs". Shipping a playable build is the licensed use; publishing a repo tree full
of the PNGs is the thing to avoid. Hence: the art is gitignored, nothing outside
`render/packs/` knows the pack exists, and a fresh clone still runs on the
code-drawn placeholder pack.

This is not currently intended to be published. If that changes, re-read the
licence. The obligations at the time of writing were to credit *Krishna
Palacio* in the credits and send them a link on completion. Note also that a
public `gh-pages` branch would be a directory listing of PNGs, which reads far
more like redistribution than a built bundle does.

*(A reading of the licence text, not legal advice.)*

## Tiling

**The 15-tile block cannot express narrow shapes.** A 3×5 Minifantasy block gives
a 3×3 of corners, edges and fill, plus six inner corners. That covers nine of the
sixteen side combinations. The other seven, nothing adjacent, a dead end
pointing one of four ways, and the two one-tile-wide strips, all need the
terrain to end on two opposite sides at once, which no corner or edge piece has.
They used to fall back to the solid fill, which is what made 14–27% of mud tiles
meet the grass at a hard square edge.

Dirt has drawn art for all seven, in a second block on the tileset. Terrains that
don't are **synthesised from halves and quadrants of their own edge pieces**: the
bank in an edge tile occupies only the outer two or three pixels, so a channel
one tile across is the left half of the west-banked piece beside the right half
of the east-banked one, and the seam falls in open interior where both halves
match. This works from any 15-tile block.

**Undergrowth is painted through a stencil.** The swamp pack's
`GrassLinkToForgottenPlains` block is a 3×5 whose light half is our two grass
colours exactly, so it butts against Forgotten Plains grass with no seam, but
its own greens are swampy and flat. It is therefore used only for its ragged
outline: each pixel is classified by which of its three tones it carries, and the
corresponding pixel of the *grass* tile is painted instead, darkened by the old
flat tint where the stencil says undergrowth. The interior keeps the colour and
speckle underbrush has always had; the boundary gets a shape a 3×5 grass block
cannot draw. One block per grass variant, so undergrowth keeps the same variety
as open grass.

**Trees and underbrush autotile as one surface.** A wood is a floor of
undergrowth with trunks standing on it. Comparing raw terrain rings every tree
with a transition back to open grass.

**Forest density is noise-driven and scattered.** How many trees stand on a
patch of undergrowth follows the noise height that made the patch, and which
tiles get one is decided by a spatial hash rather than a threshold. A single
cutoff gives solid canopy with a hard rim; scattering leaves woods with gaps in
them, which is what makes a forest look like a place rather than an obstacle.

**Beware the two tile counts.** A block is `TILE_COUNT` (22) long but only the
first `BLOCK_TILES` (15) are art the sheet draws. Anything walking a block as
source tiles must stop at 15. Reading past it silently produces black tiles, and
using the wrong count as a variant divisor quietly skews which variants appear.

## Water

**Streams are thickened until nowhere one tile across.** The stream is the zero
band of a noise field, so where the field is steep it pinches to a single tile or
to a staircase of tiles touching only at their corners. Both are wrong twice
over: they cannot be drawn, and they are not barriers: a corner touch has a hole
in it the player can slip through.

The condition enforced is that every stream tile *and every neighbouring pair of
them* sits inside a 2×2 square of water. The pairs are the part that matters: a
channel can satisfy the tile condition on both sides of a sideways step and still
funnel the whole flow through one tile's width at the step, which no real water
would do. Only pinches are widened, so a stretch already two or more across keeps
the shape the noise drew.

The stronger-looking rule, requiring *both* in-between tiles of every diagonal
pair, was tried and rejected: it forbids any 2×2 with three water tiles, i.e.
every concave corner, so bends fill out to rectangles and the river swells.

**Fords have to be repaired around.** Ford carving cuts a one-tile line through
the water, which thins the stream on both sides of the cut, often back to a
single tile. Thickening therefore runs again afterwards with the crossings held
out, or the repair fills in the very thing it is repairing around.

**The four-frame river art was tried and abandoned.** `RiverCurves.png` is a
7×7 lake-with-island that maps cleanly onto our 15 indices and scrolls two pixels
a frame. Two problems. Its shore foam *circulates* around the lake. The west
bank drifts upward and the east bank downward, so used as the two banks of one
channel the water flows both ways at once; mirroring the east-facing tiles from
the west-facing ones fixes that, but only left-to-right, because the art is a
top-down view where the north bank runs 4px into its tile and the south bank 1px,
so a vertical flip puts a far bank on the near side and swallows the water. And
in the end the animation reads as choppy waves rather than a calm stream. The
two-frame shimmer from the main tileset was kept.

`Minifantasy_ForgottenPlainsRiver.png` is a demo composition, not an autotile
set: its one-tile-wide channel tiles are 100% water edge to edge, with no bank
inside the tile, so they render exactly as the flat fill did.

## Rendering the player

**Four diagonal facings, not N/S/E/W.** The Minifantasy walk sheet is a
three-quarter view: rows 0 and 1 face the camera, rows 2 and 3 show the back of
the head. Left/right movement is deliberately overridden to the face-visible rows
so the character's eyes stay visible.

**Occlusion by silhouette.** Trees are tall enough to swallow the player whole,
so the player is drawn behind them and re-drawn on top as a flat black silhouette
masked to exactly the covered pixels. Partial cover needs no fading, because the
uncovered half stays in full colour on its own. Two Pixi traps: `AlphaMask`
samples the *red* channel, so the mask scene has to be flattened to white; and a
filter and a mask on the same sprite muddy the colour, so the filter goes on the
sprite and the mask on its parent.

**Depth sorting must be a property of the world, not the pool.** Sorting on world
y alone leaves every prop in a tile row tied, and Pixi then falls back to child
order, which is sprite-pool order and reshuffles as the scan window moves. That
is what makes a forest flicker. `depthOf(x, y) = y * 1024 + x` makes the order
stable.

**Snapping, and why it is render-only.** Props sit at fixed positions so snapping
them to the art grid is free. The player cannot be snapped while moving: the
camera pans smoothly behind it, and quantising only the player makes the two
fight: the sprite holds still for a frame or two while the camera drifts, so it
visibly slides backwards. At rest there is nothing to fight, so each axis eases
onto the grid, **always in the direction it was last travelling**, so a step
forward is never rounded back into a step that did not happen.

The simulation position is deliberately left alone. It could be snapped instead,
since the art grid is 1/8 tile in world units regardless of zoom, but then resting
positions become a property of which art is loaded, and on slow terrain a single
tick moves less than half an art pixel, so nearest-snapping would erase the input
entirely rather than merely round the drawing.

**A tap that appears to do nothing is usually not the snap.** One tick through
underbrush covers about 3 screen pixels against an 8-pixel art pixel, so a brief
tap often ends on the grid point it started from. What made it *look* wrong was
the unsnapped frames in between showing movement that then had to be given back.
Related: the walk cycle bobs the head one pixel on alternate frames while the
feet stay planted, and stopping returns to frame 0. At 8× with a black outline,
that alone reads as a snap.

## Stats

This section is the stat model the code runs until M8, which replaces it.
Delete it then, and write down what replaces it.

**One stamina rate per tick, not a sum.** The design doc gives four rates
(sprinting -5%/s, difficult ground -1%/s, easy ground +0.2%/s, standing +0.3%/s)
and never says what happens when two apply at once. They are resolved by
precedence, sprint first, so sprinting through mud costs 5%/s rather than 6%/s.
Adding them would invent a number the doc does not give, and the sum is the
harder one to reason about while playing.

**Effort is read off what happened, not off the keys.** Shoving into a tree with
shift held is standing still, and it recovers stamina at the standing rate. The
tick already writes a `moving` flag for the walk animation, and that flag is
what the stamina rule reads.

**A sprint floor, so exhaustion is not one tick long.** With sprinting gated on
`stamina > 0`, an empty bar recovers 0.0033 of a point in a tick, permits one
tick of sprint, and empties again. The bar flickers and the player stutters.
`SPRINT_MIN_STAMINA = 5` gives the recovery something to climb before the sprint
comes back. It is a guess, and the only stamina number in config.ts that the
design doc does not supply.

**Hydration is one dial, not a set of gates.** The first version implemented an
earlier draft of the doc: below 50% stamina stopped recovering entirely, and at
0% it drained. Both are gone. Hydration now does exactly one thing, which is
choose between the two standing-still rates, 1%/s watered and 0.5%/s parched.
Effort costs and the walking gain are not gated on it at all. Running dry has no
penalty of its own beyond staying on the slow rate, so at 1%/s drain the
question hydration asks is not "will I collapse" but "how often am I willing to
stop and find water".

**Hydration is read before it is drained.** Crossing 50% takes effect from the
next tick. At 1/60s that is worth eight thousandths of a stamina point, and one
consistent hydration value per tick is easier to reason about than chasing it
inside the step.

**The backpack says what is in it.** The count alone (`6/10`) does not tell you
whether you are carrying the water you need. The pill now reads
`Backpack 6/10  fruit 2, water 1, ore 3`, listing only kinds actually held and
`empty` otherwise, which is the smallest thing that answers "can I drink".

**The HUD reads a plain object.** `hudModel(world)` turns simulation state into
numbers, and `Hud.update` writes those numbers into the markup. Splitting it
that way is what makes the interesting half testable without a DOM, and it also
makes the one-way rule structural: the HUD has no reference it could write back
through.

## The summer loop

**An append-only event log, not a callback.** The simulation records what it did
(`harvested`, `ate`, `deposited`, `blocked`) and never removes anything. The
HUD, the end-of-summer count and the prop layer each walk the list with their own
cursor. That keeps the one-way rule intact, since reading with a cursor takes
nothing out of the world, and it means the summary counts the summer from the same
record the toasts came from rather than from a second set of totals that could
drift.

**One press, one action.** The first version banked the ore at camp and then,
with the pack now empty and the key still down, started picking the node beside
the camp. A press that resolves as a tap is spent until the key comes back up.
Harvesting deliberately does not spend it, so one continuous hold still clears a
patch of ore without tapping once per node. A test covers both halves, because
they pull in opposite directions.

**Banking wins at camp, but only while carrying ore.** Making the camp always
take the interact key would make a node growing next to it unharvestable. The
three-way choice (bank with ore, else harvest what is in reach, else say there
is nothing to bank) is one query, `availableAction`, which the HUD prompt and
the keypress both read. They cannot disagree about what E does, because they ask
the same question.

**Progress is thrown away, not banked.** Releasing the key or walking out of
reach resets the harvest to zero. Keeping partial progress would make
`HARVEST_TIME` a formality you could pay in instalments while doing something
else.

**A refusal is said once.** Holding E with a full backpack emits one
`backpackFull` on the press rather than one per tick, which is 60 toasts a
second. Everything one-shot (eating, drinking, banking) is edge-triggered
against the previous tick's input, which works with the fixed timestep because
every tick inside a frame sees the same input object.

**Ties in `nearestNodeWithin` break on the lower id.** Standing exactly between
two nodes would otherwise pick a different one each tick, reset the progress
every time, and make the hold impossible to finish.

**A new seed is built in place.** Until M6 it reloaded the page. Rebuilding means
new render layers, because each one holds the map it was built with, and that is
what the debug overlay needed anyway; the layers are cheap to build and
destroying them releases their sprite pools. What made the reload tempting was
the bookkeeping around it rather than the layers: the HUD and the renderer both
hold cursors into `world.events`, and a fresh log with a stale cursor swallows
the new world silently.

## The debug overlay

**Time scale multiplies the frame after the clamp, not before.** Scaling first
would let a tab that came back from the background ask for ten times the frame
it was already refusing, which is the spiral `MAX_FRAME_SEC` exists to prevent.
Scaling after leaves the clamp meaning exactly what it says: at most a quarter
of a real second is ever accounted for, however fast the world is being run.

The same scaled seconds go to the camera and the animations, not just to the
simulation. A 10x world drawn with 1x frame times reads as the player sliding
around inside a view that cannot keep up.

**Freeze is a flag on `Stats`, pushed every frame.** It could as easily have been
a rate the overlay zeroed, but then "the numbers stopped" would live in the
renderer, and `sim/` would no longer be the whole account of what the summer does.
Pushing it every frame rather than on change is what makes it survive a
regenerate: a new `World` gets the checkbox applied on its first tick, where a
one-shot callback would have left it thawed.

**The readout is padded to a fixed width.** Unpadded, the line was 131 to 133
characters depending on where the player was standing, and the columns walked
sideways every frame, measured at 1041, 1025 and 1033 painted pixels within one
second of walking. Each field is now padded to the longest value it can hold, so
the line is 143 characters whatever is happening. The padding is non-breaking
spaces and the fields are separated by ordinary ones: under `white-space:
pre-wrap` that makes the gaps between fields the only places the line can wrap,
so `full` can never end up on one line with its number on the next.

**The panel is always built, and starts hidden.** Building it only under
`?debug=1` would mean a reload to get at it, and a hidden div plus one keydown
listener is the whole cost of having it always there. Everything except the
toggle is inert while the panel is down, so a stray bracket cannot rebuild the
world you are standing in.

**Keys typed into the panel are not controls.** The seed box is a text input on
the same `window` the keyboard listens to, so typing a seed used to walk the
player north-east. The keyboard now ignores any event whose target is an input
or a button.

**Teleport refuses what collision would.** `moveWithCollision` only ever moves
from a legal position to a legal position, so a player set down inside a rock is
stuck there for good. Refusing the click and saying so costs one call to
`canStand` and removes the only way the overlay could break a summer.

## Where the HUD says things

**What is in reach is said under the player, not in a corner.** The prompt and
the toasts started in the bottom right and at the bottom middle, which meant
that reading either one took your eyes off the thing you were about to pick.
They now share one stack that follows the player, and everything transient goes
in it: the prompt, then the toasts under it, newest first.

It is positioned with a transform rather than `left`/`top`, and its size is
measured only when its contents change: a prompt that changed text, or a toast
arriving or fading out. Writing a style and reading a box back in the same frame
forces layout, and this runs every frame.

The corners keep what is true all summer and is read by glancing: the bars, the
clock, the pack, the gold. The bottom right, freed up by the move, now carries
the two lines the player needs exactly once, which key eats fruit and which key
drinks water, shown only while carrying some.

## The discovery test

**Three actions, one shape.** Harvesting, cutting a thicket and laying a bridge
tile are all a hold on the same key: progress builds while the key is down and
the target stays in reach, and is thrown away the moment either stops being
true. They are one code path with a table of durations, because the alternative,
three nearly identical loops, is three places to fix the next thing learned
about how a hold should feel. What differs between them is only what happens at
the end, which is where they are actually different.

The hold is keyed by a string, `node:7` or `tile:31,44`, rather than by a number.
A node id and a tile index are both small integers and would otherwise collide,
which would let walking from a node onto a thicket tile of the same number
inherit the node's progress.

**Tools aim at the nearest tile, not at the tile in front.** Every facing in this
art is diagonal, so "the tile in front of you" falls between two tiles and names
neither. Cutting and building therefore pick the nearest tile of the right kind
within the same radius harvesting uses, ties breaking on the lower tile index,
the same rule and for the same reason: a tie that resolves differently each tick
resets the hold every tick, and the cut can never finish.

**Picking beats cutting when both are in reach.** A vine growing against the
thicket that walls it in is still a vine, and a player holding E next to one
means to pick it. The order in `availableAction` is bank, harvest, cut, build,
and one query answers both what the prompt says and what the key does.

**A bridge tile is paid for at the end of the hold, and checked again there.**
The materials are verified when the action is offered and spent when it
completes, because a hold can start with a stick in the pack and finish without
one: lay a tile, keep the key down, and the next tile begins with an empty
pack. Paying is all-or-nothing for the same reason.

**A summer keeps its map and its log.** "Next summer" is not a new world: the
terrain, the gold and the backpack survive, every node regrows, the stats refill
and the clock restarts. The event log is not cleared either, so readers holding a
cursor into it carry on rather than replay, which is why `Hud.reset` takes the
cursor to resume from, and why the summary counts up from the last
`summerStarted` rather than from the beginning. A regenerate passes 0, because
that world's log really is new.

That leaves gold as the one number in the summary that is not a record of the
summer: it is the score, it carries, and counting only what was banked since
the summer began would be a different question.

**The target tile marks itself.** Cutting and building act on the nearest tile
of the right kind, and the prompt says what will happen but not where. The first
playtest laid a bridge tile on the wrong tile and paid for it, which is exactly
the failure that costs materials rather than time. There is now an outline on the
tile the key would act on, drawn above the props, since a marker a bush can hide is
no use on the one terrain made of bushes. It is red rather than pale when the
action is right here but cannot be paid for.

Progress is a bar along the bottom edge of that tile rather than a fill over the
whole of it. The fill was tried first: pale enough to see the ground through, it
lightens a thicket until the tile reads as ground already cut, which is the one
thing the marker must never say.

Harvesting is deliberately not marked. A node is a sprite standing where it is
and the prompt already names it, so an outline would be a second answer to a
question the screen has answered.

## Maps as text

**The dump became the format.** `npm run map` has printed one character per tile
since M1. Reading it back is about half an evening of work and it is what makes
the discovery test possible at all: the chain of barriers can be edited into a
generated map by hand, and the alternative, teaching the generator to build the
chain, is several evenings plus open-ended tuning against seeds that pass a
validator and are still dull. The edited maps become the fixtures for that
generator pass if the verdict ever calls for one.

`formatMap` and `parseMap` live in `sim/` rather than in the script, so the round
trip is testable and the script is just a caller. The stats the script used to
print after the map went to stderr, so `npm run map -- 42 > a.txt` writes a file
the loader can read.

**One character cannot say both what grows and what it grows on**, so a node
glyph implies its ground: mud under a vine, grass under everything else. That is
a deliberate limit rather than a gap. The format is meant to be small enough to
edit in a text editor and to be checked by eye; anything it cannot express is
something an editor should not be adjusting one character at a time.

**The parser is strict and says where.** These files are edited by hand, and a
typo that silently became grass is a barrier quietly missing from a playtest.
Every complaint names the line and column.

**The chain is checked by flood-filling three ways.** `npm run map:check` runs
the fill as the player is, then as if the thicket were not there, then as if the
stream were not there, and compares the three answers with what the chain
requires: vines on foot, sticks only once cut, gold only once bridged. It also
re-runs stream thickening on a copy, which must change nothing: an edited
stream pinched to one tile across is a wall with a hole in it.

"Gold is not reachable" is not enough on its own, and asking only that was the
first version's bug: a pocket sealed behind a forest is also not reachable, and
gold in one would simply never be found. The far bank is defined as what opens up
when the stream is crossed and not before.

**The maps are generated, cropped and then edited.** Each runs the generator's
own terrain steps, stops before ford carving, crops a 64x64 window around the
camp, since a 5-minute summer is not 128 tiles wide, and then has the chain edited
in: a mud pocket of vines, a stand walled in thicket, gold on the far bank, and
one short wall near camp already cut through. What a map feels like to walk
across is still the generator's.

Two things went wrong doing it and are worth not repeating. Placing a feature
"about nine tiles from camp" by taking the best-scoring tile puts it next to the
camp when nothing at nine tiles qualifies. The first run walled the camp in
completely, and the flood fill reported one reachable tile. And scoring on
distance alone makes the scan order the tiebreak, so every seed put its pocket in
the same corner; the layouts only became per-map once the score carried a
per-seed jitter.

## Drawing the new terrain

**A thicket is undergrowth painted darker through the same stencil.** It
autotiles as one surface with trees and undergrowth, because it is the same
growth; what makes it a wall is density, and density in this palette reads as
shade. Tinting the finished tile was tried first and is wrong: the tint lands on
the open ground inside the tile as well, so every ragged edge the stencil draws
comes out square. Painting a second set of blocks through the stencil with a
darker multiply puts the dark exactly where the growth is.

The other half is growth on every tile with no gaps. Walkable undergrowth leaves
45% of its tiles bare, and that gap is precisely what reads as "you can step
through this", so the wall is the version without it. Measured on screen: with
neither change, a thicket next to grass is one shade of green and a few more
ferns, which is not a difference you can see while playing.

**A bridge is planks over the dirt fill, and the timbers follow the run.** The
farm tileset draws boards in two orientations; alone they are rails with daylight
between them and show the stream straight through, which reads as a hole. Over
the dirt block's solid fill they read as timber on a deck. The orientation is
chosen from the autotile mask, so a crossing built north to south has its timbers
running north to south.

The first version used the dirt block on its own, as planned. On screen it read
as a muddy ford, exactly the thing the stream had its fords taken away to stop
being. A bridge that looks like a ford cannot be the payoff for two barriers.

**A cut tile has to be redrawn the moment it is cut.** Both layers only rebuild
when the camera crosses a tile boundary, and the player cutting a path is
standing still. `TileLayer.invalidate` is the ground's version of the prop
layer's, and `main.ts` calls both on a `cut` or a `built` event.

Measuring that it works needed the water animation held still: the ripple
advances every 0.45 seconds and refills the whole pool when it does, which
silently stood in for the invalidate and made the check pass with the call
removed. With the frame index pinned, removing the call leaves the cut tile drawn
as thicket in the frame after the cut, and restoring it puts grass there.

**The two new node sprites are picked for contrast, not for botany.** A node has
to be recognisable from across the barrier it is behind, which rules out anything
in the same green as the ground: the crafting pack's hemp and ramie are exactly
that, so the vine is its agave, whose teal reads at a distance against the mud it
grows in, and the stick is the pale birch pickup from the logging sheet.

**Ore stood in for feathers.** The discovery test's sellable was meant to be
feathers, and the crafting pack has good ore art and none. The five summers
bring feathers back as their own kind, so they need a sprite from another pack
or one drawn in the same style.

## Method

Claims about how the game looks or behaves are measured, not asserted: drive the
running game over the Chrome DevTools Protocol, read numbers back, and prove a
check is non-vacuous by reverting the fix and watching it fail. Several
conclusions in this document reversed under measurement: the water "not
scrolling" (the sample included static bank pixels), the tap artefact blamed on
snap direction, the assumption that the walk sheet had two facings. Sheet layouts
are decoded from pixels rather than from documentation.
