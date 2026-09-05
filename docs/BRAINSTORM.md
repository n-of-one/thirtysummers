# Phase 2 brainstorm

M0 to M6 are done. One summer plays, and it is not fun yet. This document is
the thinking about what to do about that. Decisions are marked as such, with a
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
first bridge feel earned?

Still open, to settle while building
- Cut time for a thicket tile and lay time for a bridge tile.
- How many sticks and how much rope a bridge tile costs, and how a single
  vine or tree turns into them. For the test, one vine is one rope and one
  tree is one stick, harvested like ore.
- Sprites for thicket, vine and stick nodes. Placeholder art is fine for the
  test; the sprite must read across a barrier.
- Map size for a 5-minute summer. Rock can fill the rest of 128 by 128.

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
