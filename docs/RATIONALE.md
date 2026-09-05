# Rationale

Why the choices in [PLAN.md](PLAN.md) were made, and what was learned making
them. Nothing here is needed to execute the plan — it is here so the same ground
is not argued twice.

## Provenance

[DESIGN.md](DESIGN.md) is the design doc as first written, on 2 Sep 2026.

One change has been folded into it since. **Ore replaced feathers** as the
gold-yielding collectible: the Minifantasy Crafting and Professions pack has good
ore art and no feathers. The rule is unchanged — 1 gold each, deposited at camp.

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
z-layers identically — keep it in mind if tile rendering ever becomes the
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
licence — the obligations at the time of writing were to credit *Krishna
Palacio* in the credits and send them a link on completion — and note that a
public `gh-pages` branch would be a directory listing of PNGs, which reads far
more like redistribution than a built bundle does.

*(A reading of the licence text, not legal advice.)*

## Tiling

**The 15-tile block cannot express narrow shapes.** A 3×5 Minifantasy block gives
a 3×3 of corners, edges and fill, plus six inner corners. That covers nine of the
sixteen side combinations. The other seven — nothing adjacent, a dead end
pointing one of four ways, and the two one-tile-wide strips — all need the
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
colours exactly, so it butts against Forgotten Plains grass with no seam — but
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
source tiles must stop at 15 — reading past it silently produces black tiles, and
using the wrong count as a variant divisor quietly skews which variants appear.

## Water

**Streams are thickened until nowhere one tile across.** The stream is the zero
band of a noise field, so where the field is steep it pinches to a single tile or
to a staircase of tiles touching only at their corners. Both are wrong twice
over: they cannot be drawn, and they are not barriers — a corner touch has a hole
in it the player can slip through.

The condition enforced is that every stream tile *and every neighbouring pair of
them* sits inside a 2×2 square of water. The pairs are the part that matters: a
channel can satisfy the tile condition on both sides of a sideways step and still
funnel the whole flow through one tile's width at the step, which no real water
would do. Only pinches are widened, so a stretch already two or more across keeps
the shape the noise drew.

The stronger-looking rule — requiring *both* in-between tiles of every diagonal
pair — was tried and rejected: it forbids any 2×2 with three water tiles, i.e.
every concave corner, so bends fill out to rectangles and the river swells.

**Fords have to be repaired around.** Ford carving cuts a one-tile line through
the water, which thins the stream on both sides of the cut, often back to a
single tile. Thickening therefore runs again afterwards with the crossings held
out, or the repair fills in the very thing it is repairing around.

**The four-frame river art was tried and abandoned.** `RiverCurves.png` is a
7×7 lake-with-island that maps cleanly onto our 15 indices and scrolls two pixels
a frame. Two problems. Its shore foam *circulates* around the lake — the west
bank drifts upward and the east bank downward — so used as the two banks of one
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
masked to exactly the covered pixels — partial cover needs no fading, because the
uncovered half stays in full colour on its own. Two Pixi traps: `AlphaMask`
samples the *red* channel, so the mask scene has to be flattened to white; and a
filter and a mask on the same sprite muddy the colour, so the filter goes on the
sprite and the mask on its parent.

**Depth sorting must be a property of the world, not the pool.** Sorting on world
y alone leaves every prop in a tile row tied, and Pixi then falls back to child
order — which is sprite-pool order, and reshuffles as the scan window moves. That
is what makes a forest flicker. `depthOf(x, y) = y * 1024 + x` makes the order
stable.

**Snapping, and why it is render-only.** Props sit at fixed positions so snapping
them to the art grid is free. The player cannot be snapped while moving: the
camera pans smoothly behind it, and quantising only the player makes the two
fight — the sprite holds still for a frame or two while the camera drifts, so it
visibly slides backwards. At rest there is nothing to fight, so each axis eases
onto the grid, **always in the direction it was last travelling**, so a step
forward is never rounded back into a step that did not happen.

The simulation position is deliberately left alone. It could be snapped instead —
the art grid is 1/8 tile in world units regardless of zoom — but then resting
positions become a property of which art is loaded, and on slow terrain a single
tick moves less than half an art pixel, so nearest-snapping would erase the input
entirely rather than merely round the drawing.

**A tap that appears to do nothing is usually not the snap.** One tick through
underbrush covers about 3 screen pixels against an 8-pixel art pixel, so a brief
tap often ends on the grid point it started from. What made it *look* wrong was
the unsnapped frames in between showing movement that then had to be given back.
Related: the walk cycle bobs the head one pixel on alternate frames while the
feet stay planted, and stopping returns to frame 0 — at 8× with a black outline,
that alone reads as a snap.

## Stats

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

## The day loop

**An append-only event log, not a callback.** The simulation records what it did
(`harvested`, `ate`, `deposited`, `blocked`) and never removes anything. The
HUD, the end-of-day count and the prop layer each walk the list with their own
cursor. That keeps the one-way rule intact, since reading with a cursor takes
nothing out of the world, and it means the summary counts the day from the same
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

**"New day" reseeds in place.** It reloaded the page until M6. Rebuilding means
new render layers, because each one holds the map it was built with, and that is
what the debug overlay needed anyway; the layers are cheap to build and
destroying them releases their sprite pools. What made the reload tempting was
the bookkeeping around it rather than the layers: the HUD and the renderer both
hold cursors into `world.events`, and a fresh log with a stale cursor swallows
the new day silently.

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
renderer, and `sim/` would no longer be the whole account of what the day does.
Pushing it every frame rather than on change is what makes it survive a
regenerate: a new `World` gets the checkbox applied on its first tick, where a
one-shot callback would have left it thawed.

**The readout is padded to a fixed width.** Unpadded, the line was 131 to 133
characters depending on where the player was standing, and the columns walked
sideways every frame — measured at 1041, 1025 and 1033 painted pixels within one
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
`canStand` and removes the only way the overlay could break a day.

## Where the HUD says things

**What is in reach is said under the player, not in a corner.** The prompt and
the toasts started in the bottom right and at the bottom middle, which meant
that reading either one took your eyes off the thing you were about to pick.
They now share one stack that follows the player, and everything transient goes
in it: the prompt, then the toasts under it, newest first.

It is positioned with a transform rather than `left`/`top`, and its size is
measured only when its contents change — a prompt that changed text, or a toast
arriving or fading out. Writing a style and reading a box back in the same frame
forces layout, and this runs every frame.

The corners keep what is true all day and is read by glancing: the bars, the
clock, the pack, the gold. The bottom right, freed up by the move, now carries
the two lines the player needs exactly once — which key eats fruit, which key
drinks water — shown only while carrying some.

## Method

Claims about how the game looks or behaves are measured, not asserted: drive the
running game over the Chrome DevTools Protocol, read numbers back, and prove a
check is non-vacuous by reverting the fix and watching it fail. Several
conclusions in this document reversed under measurement — the water "not
scrolling" (the sample included static bank pixels), the tap artefact blamed on
snap direction, the assumption that the walk sheet had two facings. Sheet layouts
are decoded from pixels rather than from documentation.
