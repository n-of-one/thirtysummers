# Phase 2 brainstorm

M0 to M6 are done, and so is the discovery test they led to; it has not been
played yet. One summer plays, and it was not fun yet. This document is the
thinking about what to do about that. Decisions are marked as such, with a
date; everything else is open. Anything that changes the game goes to
[DESIGN.md](DESIGN.md) once decided.

## What the project is for

Decided 5 Sep 2026.

The project exists to find out whether this game idea works. If the core loop
is not fun after a fair test, that is a valid result and the project can stop.

The fun, as imagined: the player changes the map, and that opens something
they had not seen. Discovery, enabled by terrain improvement.

That sentence is a hypothesis with four requirements. There must be something
the player cannot reach from camp. There must be a barrier that reads as "not
yet". There must be a tool that removes it. And what lies behind must differ
from what lies in front, or nothing was discovered.

The current map fails the first and last requirement. Noise makes a map that
is the same everywhere, so a bridge today would open more of what is already
in reach.

## How this phase runs

Only one person has played the game so far. "Not fun" from the designer is
unreliable in both directions, so from here on:

- A playtest log, one entry per session: what was attempted, what happened,
  one sentence on how it felt. Feel gets the same treatment the renderer
  gets: written down, not asserted.
- Before winter gets built, one other person plays the discovery test while
  the designer watches and says nothing.
- This phase ends at a verdict point, after the discovery test has been
  played. Only then does the economy get planned.

Order of work: the discovery test first, with the economy cheated. Test the
payoff of changing the map before pricing it. Everything below the line under
"Parked" waits for the verdict.

---

## Decided: the discovery test

Decided 5 Sep 2026. The one milestone this phase needs. One summer of 5
minutes, and the answer to one question: when I broke through, did I feel
anything?

**Regions are resource fields, not biomes.** Same grass everywhere. What makes
a place is a resource you can see from across its barrier, dense enough to
read as a field, and useful enough to want. Palette swaps were considered and
dropped: three biomes forty tiles apart look like a theme park, and if the
swamp felt good the test could not say whether it was the opening or the art.
Ground variation can come later cheaply, since the swamp-to-grass transition
tile is already in the pack.

**The regions form a chain.** Each barrier's reward is the key to the next.

1. The centre, around camp: fruit, water, no gold.
2. Across the mud, the soft barrier: a field of vines. Wade in at a stamina
   cost, come back with rope material.
3. Past the thicket, the first hard barrier: a stand of straight trees.
   Sticks. The knife is in hand from the start.
4. Rope plus sticks make a bridge. Across the stream, the second hard barrier:
   the gold.

Gravel comes after the test, once repeat trips through the mud have taught
the player what a road is worth. The cache too.

**Two hard barriers, one soft.** Thicket is a new terrain kind: impassable,
cut with the knife. Underbrush stays what it is, slow. The stream stays a wall
and loses its fords. Mud stays crossable at a stamina price. The playtest
compares removing a wall with removing a cost, which winter will need to know
when it prices them.

**Tools work in place, like harvesting.** Hold E on a thicket tile with the
knife and it clears after a short hold. Stand at the bank and hold E to lay a
bridge tile, step onto it, lay the next. No new input, no new UI beyond the
prompt that already hangs under the player. The one pre-built improvement is a
short cut path through thicket near camp, so the knife's effect is seen before
it is used.

**Top-down gives the tease for free.** The player sees over a thicket and
across a stream, so every field is visible before it is reachable. Barriers
are three to five tiles thick, thin enough to see across.

**Maps are generated dumps, edited by hand, played blind.** The designer is
the only tester, and a map they drew themselves has no unknowns in it. Teaching
the generator to build the chain is two to four evenings plus open-ended
tuning against seeds that pass a validator and are still dull. So for the
test: a loader for the text format `npm run map` already writes, about half an
evening. Then the assistant edits generated dumps to insert the chain, a
thicket ring here, a mud pocket there, the ford deleted, and the designer plays
them without opening the file. The maps stay the generator's, so the
exploration feel survives, and three to five of them should be enough for a
verdict. Cost per map is an hour of editing.

The edited maps become the fixtures and the spec for a generator structure
pass, built only if the verdict says the idea works. That pass would remove
ford carving, put gold only across the stream, wall a forest patch in thicket,
pick a mud pocket for the vines, and run the flood fill three ways, as the
player is, with thicket passable, with stream passable, to confirm the chain
and retry the seed when it fails.

Rejected for now: a map authored from scratch, which gives one blind play per
map and none of the generator's feel.

**For the test, everything persists.** The summer ends, a button starts
another on the same map, every cut and every bridge kept. No winter. Whether
paths regrow is a pricing question.

**No hazards.** The chain is the challenge. A crocodile can wait.

**The log's first entry asks:** when I broke through, did I feel anything?
Which barrier felt best? Did I see the field before I reached it? Did the
first bridge feel earned? Those four questions are pre-written into
[PLAYTEST.md](PLAYTEST.md), and answering them is what the milestone is for.

Settled while building, 5 Sep 2026. All of these are guesses the playtest is
allowed to overturn; the reasoning is in [RATIONALE.md](RATIONALE.md).

- **Cut 1.5s, bridge 2s**, against a 0.6s harvest. A wall costs more than a
  berry and a bridge costs more than a wall, and that is the whole of the
  argument for the numbers so far.
- **One vine and one stick per bridge tile**, both harvested like ore. The
  narrowest crossing on every shipped map is two tiles, so a bridge is four
  things gathered rather than a shopping trip.
- **Sprites are the real art, not placeholders.** The vine is the crafting
  pack's agave and the stick its birch pickup, both picked because they read
  across a barrier: anything in the same green as the ground does not. A
  thicket is undergrowth painted darker with growth on every tile, and a bridge
  is planks over dirt -- on the dirt block alone it read as a ford.
- **64 by 64, not 128.** A 5-minute summer does not need a map a player cannot
  cross in one. Cropping a generated map to a window around the camp keeps the
  generator's terrain and throws away the part nobody would reach.

---

## Decided: vocabulary

Decided 5 Sep 2026.

- The two phases are summer and winter. Summer is collecting, winter is
  processing, trading and buying.
- "Day" and "night" go away everywhere: code, HUD, docs. `DAY_LENGTH_SEC`
  becomes `SUMMER_LENGTH_SEC`, "New day" becomes "New summer", and so on.
- A year is one summer then one winter. Year is the counter the player sees.
  A generation is 30 years.
- Winter has no clock and no time pressure. It ends when the player starts
  the next summer.

Considered and dropped: "rest of the year" (accurate, no code or HUD form),
gather/trade (drops summer from the vocabulary, and the title is thirtysummers),
camp (clashes with the camp tile).

The rename in code is a chore to do alongside the first winter milestone, not
on its own.

## Decided: summer length follows age

Decided 5 Sep 2026.

Summer length follows an age curve that rises and then falls: about 5 minutes
at year 1, 15 at the physical peak from year 10 to 20, back down in the
decline. It is the design doc's three phases made visible in the one number
every summer is measured by. A table or formula in config.

For the discovery test, the summer is 5 minutes and nothing else ages.

Still open under this heading, parked until the verdict: what else changes
with age, and whether the first summer has a goal such as a visible price tag
for the first winter purchase.

---

## Parked until the verdict

These price and pace a loop whose payoff has not been felt yet. They are kept
so nothing is lost, and picked up in whatever order the verdict suggests.

### Winter: selling, buying, UI

This is where gold gets spent, which is what makes collecting it matter.

- Sell collected goods for gold. Spend gold on upgrades. No UI proposal yet;
  proposals wanted. Candidates to sketch: a single shop page; a camp scene
  with stalls; a ledger with tabs for sell, buy, train, next year.
- What is for sale in year one, and what it costs. Short enough that a
  first-time player reads it all.
- Whether gold carries over unspent, and whether goods can be kept for a
  better price next year.
- Whether the map changes between summers without the player: paths regrow,
  water shifts.

### Collectibles as an economy

- Gold ore alone is boring and a strange pick. Feathers were the original
  pick; the art pack had none. New art is possible from other packs or drawn
  in that style. Art is deferred; design first.
- How many kinds, what separates them in play (where they grow, weight,
  gather time, spoilage), whether a kind also has a summer use, whether price
  varies so the choice of what to gather matters.
- What is there to find belongs to the discovery test above. What it sells for
  belongs here.

### Water and hydration

- Carrying water nodes in a backpack is strange. Alternatives: drink straight
  from the stream; a flask filled at water and drunk from later.
- Flask capacity, whether it takes a backpack slot, whether a bigger flask is
  a winter upgrade, and whether the stream itself becomes the water source.

### Tools and their cost

The cost half of terrain improvement, split off from the test above.

- Where tools come from: the knife at the start, the axe bought in the first
  winter?
- Gravel on mud, the third improvement, and the cache.
- How many improvements the player can afford in the second summer, so the
  map opens up but not all at once.
- Whether paths through thicket regrow between summers.
- Whether building is done in place during summer or planned in winter and
  appears next summer.
- Hazards in the far regions, once regions have identity: a still crocodile
  that bites when walked over is the cheapest first one.

### Summer-mode improvements, to refine later

- Visual indicator of how fast stamina is dropping or rising, so the player
  can learn the terrain rules by watching it.
- More fruit near the starting area, so a new player finds it, eats it and
  sees what it does.

---

## 8 Sep 2026: the verdict, and reopening the design

**The verdict.** Four sessions by the designer, on maps a and b. Breaking
through felt like something every time; the bridge was the best barrier and
the mud the weakest. Decided: the idea works. No outside testers until the
concept is fleshed out further. The itch.io build (M7) is abandoned; its
half-finished work is on branch `itch-publish-1`.

**What the log says the game needs next.** Summers 2 and 3 on the same map
turned into a routing exercise: nothing changed but the resources, and gold
had nothing to buy. The fruit cooldown and the small refill were the only
real irritation. Sprint was fun and probably too strong.

**Leanings from this session.** Provisional until the brainstorm closes;
each one overturns something above, and that is deliberate.

- *Winter is the next phase.* Selling, buying, a price ladder paced over 30
  summers so that each winter affords one meaningful thing and shows the
  next. A gold floor per winter as upkeep, about a third of a summer's
  income; missing it costs years, not the game. No stat purchases yet.
- *No sprint.* A held key that makes you faster is a key held all the time.
  Speed comes from changing the map: paths, bridges, gravel. Base walk speed
  goes up a little to compensate.
- *Hydration is a leash to a place.* Water is not carried. It is drunk at
  springs, few per map, none on the far bank at first. It drains regardless
  of what you do, and when low it slows you, never stops you. A well or
  cistern is a later purchase that extends the leash.
- *Stamina is the summer's budget.* Spent per tile of rough ground and per
  tool action, not per second. Refilled only by fruit, no cooldown. At zero
  you can still walk easy ground but not rough ground or tools. The budget
  follows the age curve: small at 1, peak at 10 to 20, falling after.
- *Resources form a price ladder tied to barriers.* Near camp sells for
  nothing or one, each barrier out roughly doubles it. Gold is currency, not
  a thing in the ground. Some kinds have a use that competes with their
  price (sticks, logs); some are pure sellables behind hard barriers. One
  table in `sim/` describes every kind: price, slots, ground, glyph. Bulky
  kinds take two slots.
- *Stats: two is right, a third waits.* The third should react to place,
  not time or effort: health once hazards exist, or a spirit meter once
  spirits do.
- *Test unit: 5 summers of 4 minutes*, on hand-edited maps.

### Topic 1: the arc of a map (round one, 8 and 9 Sep 2026)

What makes summer 17 worth playing: reaping what was built and working
toward a bigger goal, the way Factorio's projects grow. Summers 1 to 10
build the basics, 10 to 25 build the monument (choosing it, then preparing
the map and the economy for it), 20 to 30 prepare the heir. A map holds a
few generations, then the lineage moves on, so no map goes stale.

The purpose of a generation: the same map replayed by a level-one character
who knows it and has shaped it. A puzzle: prepare the map so the child
thrives young, then "I am young again, low stamina, adjust the plan". The
second youth must be faster than the first and feel like a power trip
("stage X in 3 years, not 8"), never a chore that delays the new parts.

**Decided, rounds one and two (9 Sep 2026).**

- A *structure* is built by performing tasks. Implicit ones (survey the
  map to choose where the mine goes, perhaps from a few sites) and explicit
  ones (build a sub-structure, such as the rails for the mine carts). Each
  task is a different job, which is what keeps a years-long build from
  being a chore. One such task is testable in years 10 to 15, later in
  prototyping. Finishing a structure unlocks new resources or play, never
  a multiplier. Examples: a *mine* worked by people you never see, whose
  ore unlocks the tools that break the next barriers; a *shrine* or a made
  clearing that pleases a found spirit, whose blessed goods a church buys
  and pays for in skills and tools. Low fantasy: blessed pineapples, not
  fireballs.
- Changes to the land (drain the mud, dam the stream, cut the rock) are
  tasks inside a structure or parts of the road, not structures.
- *The camp is the entry to the town.* Camp sits at a map edge with the
  town behind it. The town does the farming and makes the tools you buy in
  winter. Building up the town with what it needs is part of the game.
- *A map's goal* is a road to the next map, and a town strong enough to
  found an outpost there that supports you in the next map's winters.
  Perhaps a better town makes a stronger outpost with better benefits;
  decided later. The quest line across all domains must be finished before
  moving on. There is no walking out on foot, and an heir cannot refuse:
  they are on the map until it is done.
- *No cap on generations.* The game is relaxed overall so new players
  learn at their own pace. Challenge maps with a known time limit may come
  later, never on the first map.
- *The map reacts softly.* Taking too much fruit lowers next year's fruit,
  never to a level that blocks play. To flesh out in the topic on what
  happens between summers.
- *Wear* is per winter and depends on build quality, perhaps on how harsh
  the year was. No list of what broke: the player meets the damage in
  play. Autumn and spring as visible seasons are for a later visual round.
- *The camp puzzle.* Around year 25 the child offers three places they
  walked, deeper into the map. The parent picks one; the site names what it
  lacks (no spring in reach, no fruit, the stream in the way, thicket on
  three sides), and the last summers are spent fixing that list. What is
  not fixed is the heir's first handicap. Whether the old camp stays useful
  is decided later; it may if resources sit near it.
- *The grave.* For the years 1 to 5 prototype, pre-place a grave on the
  map and experiment with the benefit of visiting it. Burial and where the
  grave goes are not designed yet.
- The heir starts with almost nothing: no gold, minimal tools, perhaps one
  inherited thing. Otherwise there is no starting over.
- Ages: start at 15, die at 45, the child born at 30. A short sequence in
  the spring of year 30 brings the child to their camp.

- *Two strengths, kept apart.* Town strength grows only through
  structures. Family strength grows from gold to spare after the floor:
  the heir's starting stats or tools, or more from visiting the grave.
  Missing the floor adds no family strength and carries a disadvantage
  into the next summer, enough to make the floor a priority, never enough
  to end a run.

**Leaning, to explore in the winter topic.**

- Gold and resources cannot be stockpiled across winters. The floor rises
  as structures are built (supplying the works), which forces more
  efficient income and new logistics puzzles, so play changes over a life.

The standalone read of all this is [design/map-arc.md](design/map-arc.md).

**Open.**

- The word for the character. Not hero, not main character.
- The one structure per domain that keys the next map still has no word of
  its own. Offered and not taken: landmark, keystone, capstone.
- The old camp's use after the heir moves.
- How town strength carries into the next map's outpost.

**Parked.**

- The second youth: what it re-experiences and what it skips.
- The grave as the first shrine, the parent as the first spirit.
- A calling from the church or a spirit as a reason to move on.
- The chest (inheritance as a set of objects): the camp puzzle replaces it.
- Generations overlapping with two characters on the map: too distracting
  during a summer. The spring walk keeps the good part.
- The monument is the grave: park as its own idea.
- The exit as a final exam behind every barrier: the road is enough.
- Stacked maps as z-levels: clashes with biomes.
- The structure chosen by the map's spirit: keep open, not decided.
- A high-fantasy setting, to see what it offers over the current one.
- Naming places: one name a year, in autumn or winter, never in summer.
- The lineage: ghosts, ancestors as spirits, calling their aid, winter acts
  that make a stronger ancestor. Topic 4.

**Rejected.** Wealth as a structure. A map that ends because it is spent.
Reaching the far edge on foot as an exit. An heir who refuses the map. A
generation cap.

**Tangent: phases (9 Sep 2026).** The designer wants phases the way Oxygen
Not Included has them: a project that takes hours and opens a new domain of
rules to master. A phase is a domain, not a step; a chain of dependent
monuments (mine, mill, road) is steps, and steps alone make every generation
feel the same. Options written up: one domain per generation with one chain
per map (plant and mineral, then animal, then spirit, the road needing all
three); chain only with variety from biome; one domain per monument with
generation count falling out of play; domains sequenced by what the next
town asks for. The animal domain is the first that needs moving entities
and probably a third stat, so it is a generation-2 concern by construction.
Phases must be visible: one line on the summary card naming the year's job.

Decided 9 Sep 2026, from the tangent:

- *Structures are not tied to generations.* A structure's benefit flows the
  moment it is complete. The player is not required to understand the
  system within one life or fail; new players learn and experiment at
  their own pace.
- *Domains, not enforced phases.* Natural, animal and spiritual are the
  domains and that order is the natural one, but nothing enforces it. The
  spiritual domain needs specific resources from the natural and animal
  domains, and how the player sequences the work is theirs to decide.
- *Words.* A **domain** is the area of play (natural, animal, spiritual). A
  **phase** is one project that yields a new resource. A **structure** is
  what a phase produces, named for the result and not the process: a mine
  is a structure, and so is a made clearing with the right plants that
  pleases a spirit. "Monument" is retired. "Works", "landmark" and "trade"
  from the naming pass are not adopted.

Winter under snow is wanted for its look and for watching the map regrow
and react. How selling and spending fit it is not yet clear, and there may
be little real planning to do in winter unless the game grows more complex.

### Topic 2: summer (round one, 9 Sep 2026)

Most of this is decided as a first guess to playtest, not as a verdict.

**Decided.**

- *Where you drink:* springs and streams, marked as drinking spots, many on
  both banks of a stream, one drink speed. So the map must have few
  streams further out: the first barrier is a stream in a half circle
  around camp, where hydration is no problem; beyond it, distance from
  water matters; a stream in a far area is a relief.
- *What being dry does:* fog, the view narrowing. Try it alone first; add
  slowness only if fog is not punishing enough.
- *How it drains:* constant. No weather or seasons for now.
- *Stamina spending:* per rough tile and per tool action. No bulk cost.
  Try the bar drawn under the player as a constant reminder of what the
  summer can still do, and experiment with showing costs.
- *Zero stamina:* no stamina-costing action is allowed. Walking easy
  ground and refilling still work.
- *The clock:* hard stop, as now. What is carried at the stop is banked
  as if brought home, so the last minute is not wasted; ending away from
  camp costs extra gold in winter. A summer can be ended early from camp
  with a button.
- *Length:* by age.
- *Start and end:* clean slate at camp, no cards naming the year for now.
- *Refilling stamina:* fruit only, no cooldown. Fruit is also winter
  food: the floor is partly paid in fruit, food not gathered is bought
  with gold, and every fruit eaten in summer is one not in the store. The
  HUD says what winter needs and what is in the store from the first
  summer. Camp does not refill stamina. The grave gives max stamina +1 on
  a visit (your resolve strengthens), no stamina itself. Fruit may be
  stored in a cache but does not survive winter there. To playtest.
- *Eating is capped.* Uncapped eating is an exchange rate: fruit buys
  stamina, stamina buys cuts, cuts buy sellables, sellables buy food, and
  a thick wall becomes "how much fruit did I bring", which also erases the
  age curve. Options weighed: prices alone, a meal count per summer,
  diminishing returns per fruit, eating costing clock time, a separate
  rarer refill. Decided: a meal count per summer that follows the age
  curve, on top of the winter cost. In summers 1 to 5, two meals, each
  restoring 10. Diminishing returns is the fallback if a count feels like
  a rule that must be told.

**Decided, round two (resources, tools, logistics).**

- *A rung is distance behind barriers.* No rarity for now, to keep it
  simple; it may be mixed in later depending on how resources respawn.
- *Pure sellables exist* and need not be exotic: feathers, shells, common
  natural things with no use in play. Perhaps one per barrier run.
- *How many kinds* follows from how many barriers five summers need.
- *Tools are bought in winter* from the town. Some may need specific
  resources brought back so the town can make them: a small quest where
  gold is not the whole answer.
- *One tool tier, no wear.* Instead, gear that changes costs: clothes or
  boots that lower the stamina cost of a terrain; a bigger backpack that
  lowers max stamina but adds slots.
- *Improvements for the first prototype:* cut thicket, plank bridge, well,
  cache. No gravel yet.
- *Repair:* no health on built things. Wear removes one tile of a bridge,
  so repair is half the work of building.
- *Logistics:* the backpack is the limit; the store at camp is unlimited.
  The cart is the important experiment: does making a road so a cart can
  run from a cache to camp feel like play, or does hauling become a
  chore? Cart and caches hold unlimited amounts for now. Fruit cannot go
  in a cache: it rots over winter, so bank it or eat it. A full backpack
  slowing the walk is a cheap experiment worth running.

- *Barriers for five summers:* a barrier is short in one of four
  currencies (budget, tool, materials, leash) and thickness is the main
  dial, since cuts persist across summers. Four types beyond mud: thicket,
  stream, saplings (young trees the axe fells; full-grown trees stay a
  wall), and distance from water (the well). No boulders or pick; the
  well and the cart fill those summers. The five-summer table in
  [design/summer.md](design/summer.md) is the spec for the test maps.
- Six kinds of thing: fruit, feather, stick, vine, ore, log, shell.

**Open.**

- Whether a rarer second refill (honey, nuts) deep in the map is needed
  so a far field still has a body reason. Only if fruit alone leaves it
  with none.

Names decided: trees are the wall, saplings the fellable kind. The
standalone read is [design/summer.md](design/summer.md).

**Parked.**

- Old characters drink less and tire more, young ones the reverse. For the
  arc, once stats are settled.
- Weather years, dusk with a dropped pack, the summer as a bag of stamina
  rather than a clock, the card naming the year's job.

### Topic 3: between summers (9 Sep 2026)

**Decided.**

- *Resources:* kinds differ. The inner ring inside the first stream
  always comes back, so there is always a safe way to pay upkeep. Things
  that only sell for gold come back slower, driving the player outward.
- *Barriers:* thicket creeps back at the edges of cuts; felled saplings
  return after some winters.
- *Built things:* bridges lose a tile every other winter, so repair is
  not a chore. Wells never decay.
- *Trails:* desire lines, but gradual and with some randomness, not every
  underbrush tile walked on.
- *Winter is a screen*, not the map under snow, to start with.
- *Winter mechanics:* choose what to keep for tools and improvements, the
  rest auto-sells. Food short of upkeep is auto-bought; food over it
  auto-sells. Surplus gold goes to the family. The family has levels;
  each next level needs more accumulated surplus. A level does nothing
  yet (may unlock tools later), and never raises upkeep.
- *Upkeep* rises only with structures. Wells and bridges are not
  structures, so it is flat in the first five summers.
- *Missing upkeep:* next summer starts with max stamina ten lower.
- *Spring* is not named. A small pop-up at the start of summer says how
  long it is and what the upkeep is.

**Terms.** In-game words over game-goal words: *upkeep*, not floor;
*stamina*, not budget; *hydration*, not leash; *shop*, not shelf. The
design documents were rewritten to match.

The standalone read is [design/winter.md](design/winter.md).

**Chores for the build step, not for now.** `itch-publish-1` was committed
without its new files (`src/env.ts`, `src/sim/trace.ts`, the bake, the log
export); they sit untracked on main and belong on the branch. The art moved
to `art/` and main's loader expects `public/assets/minifantasy/`, so main
runs on placeholders until it is moved back. `docs/PLAYTEST.md` and
`docs/DESIGN-RAW.md` have never been committed.
