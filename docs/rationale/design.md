# Design rationale

Why the game's mechanics are what they are. The documents in
[../design/](../design/README.md) say what. This says why, so the same ground
is not argued twice. The evidence from play is in
[discovery-test-playtests.md](discovery-test-playtests.md).

## The discovery test, and what it decided

The fun, as imagined, is that the player changes the map and that opens
something they had not seen. That sentence has four requirements. There must
be something the player cannot reach from camp. There must be a barrier that
reads as "not yet". There must be a tool that removes it. And what lies
behind must differ from what lies in front, or nothing was discovered.

The generated map failed the first and the last. Noise makes a map that is
the same everywhere, so a bridge would only open more of what was already in
reach. The discovery test was built to meet all four, and each choice
answers one of them.

**Regions are resource fields, not biomes.** What makes a place is a
resource you can see from across its barrier, dense enough to read as a
field and useful enough to want. Palette swaps would have looked like a
theme park, and if a swamp felt good the test could not say whether it was
the opening or the art.

**The regions form a chain.** Each barrier's reward is the key to the next:
vines behind the mud, sticks behind the thicket, and together they bridge
the stream to the gold. That is what makes a barrier read as "not yet"
rather than "no".

**Hard and soft barriers side by side.** The thicket and the stream are
walls, and the mud is a cost. Putting them in one test compares removing a
wall with removing a cost, which winter needs to know to price them.

**Barriers thin enough to see across.** Top-down gives the tease for free:
the player sees over a thicket and across a stream, so every field is
visible before it is reachable.

**Tools work in place, like harvesting.** A hold on the same key, no new
input and no new UI beyond the prompt. One short cut path near camp is there
from the start, so the knife's effect is seen before it is used.

**Maps are generated dumps, edited by hand, played blind.** A map the
designer drew has no unknowns in it for the designer. Teaching the generator
to build the chain was several evenings plus open-ended tuning, against a
loader for the existing dump format at half an evening. Edited dumps keep
the generator's feel.

**The verdict, 8 Sep 2026: the idea works.** Four sessions by the designer,
on maps a and b. Breaking through felt like something every time. The very
first session ranked the mud first, for the vines in it. The later ones put
the bridge first and the mud last.

The same log said what the game needed next. Summers 2 and 3 on the same map
turned into a routing exercise, since nothing changed but the resources and
gold had nothing to buy. The fruit cooldown and the small refill were the one
real irritation. Sprint was fun and probably too strong. Most of what
follows answers those four lines.

## The first three years, and what they changed

M10 built the first three years and they were played, on 23 Sep 2026. The
verdict was that they are not fun yet, and the log is specific about where.
Year 1 is close: the ring is explored rather than swept, and working out how
to build the bridge is the good part, with a little too much fruit. Year 2 is
where it breaks. The walk from camp to the bridge is long, carrying fruit back
is a chore within a few trips, nothing about the map says what has already
been seen, and the money does not add up: the axe and the family's next level
together need more than the field holds, so the balance comes from selling
sticks and vines, which is not what the fields are for. Year 3 is the same
again with more upkeep on top.

Six answers, in the order they are built. Each is one thing, so each can be
played and judged on its own.

**Fruit on a tree.** Twelve fruit spread across a ring 58 tiles in radius is
an errand that crosses the whole ring, every summer, before anything else
happens. The same fruit on a handful of trees is a handful of stops, each of
them a place rather than a scatter, and the ring's food stops being a sweep.
The tree is an ordinary tree; what marks it is the fruit under it. It also
makes the ring's food a place worth remembering, which is the same problem as
the map.

How much hangs on one tree was settled in play: four under every tree made a
tree a counted thing, so the ring is 15 fruit over 5 trees, two to four each.
A tree worth the walk and a tree worth passing by is what makes the stop a
place. Where the fruit hangs was settled the same way: the tiles round the
trunk are shuffled rather than taken in order, because fruit at the compass
points is a rosette, and a tree is drawn upwards from the foot of its trunk,
so the fruit is hung in front of it and beside it first. Only a fourth is ever
behind the trunk, and then only sometimes -- enough that walking round a tree
can still turn something up, never so much that a stop looks empty from the
south.

**What a slot is worth.** Under *Summer*, below. The shell field went from
30 shells at 2 to 10 at 6 for the same reason: 30 shells is 3 pack loads,
about 150 seconds of a 300 second summer spent walking a route already known,
and the gold per slot was less than half what the near ring's feathers make.
Ten shells is one load, worth 60 gold, and the trip out is the best-paid trip
on the map.

**Trails worn by walking.** The slog is the same ground crossed repeatedly,
and the design's answer to it, the cart and the trails it wears, arrives in
summers 4 and 5, two summers after the problem. Underbrush worn down by feet
puts the answer in the first summer and costs nothing to learn: the repetition
is what makes the road. It is held to underbrush so the knife keeps the
thicket and planks keep the mud, and to the tiles actually walked, so a route
is a decision and not a radius. The first crossing already marks a tile and
makes it a little faster. With wear that only showed after several crossings,
the player would have to walk the same tiles again by luck before learning
that walking changes the ground, and the lesson would come too late to plan
with. Seen on the first trip, the line is something to aim for on the way
back. Then it wears in stages to flat, and flat is still undergrowth, not
grass. The first build turned a tile to grass on the second walk. That felt
good to play, but it made open ground of every route, so the ring was on its
way to a lawn and a path could no longer be told apart from a field. Stages
keep the paths the player made visible as paths, and give the walks after the
second something to show for themselves.

**The map in the corner.** Nothing recorded what the player had seen, so
nothing could feel uncovered even when it was. Dimming unseen ground in the
play view was the other option and was dropped: the game is played by looking
at the ground ahead, and darkening it to make a point about memory takes more
than it gives. A small map that fills in leaves the view alone. It shows
terrain and built things and not what there is to pick, because the field the
player remembers is the reward for having gone there.

**Camp that moves.** The walk from camp to the far bank is paid twice, once on
ground swept the summer before. Moving camp cancels it. It is earned from the
family rather than built from sticks, because the family's levels had nothing
to open but shop rows, and it costs material, which now has no other buyer.
The near ring is measured from camp, which makes the move a trade: the far
bank starts coming back every summer and the old ring drops to half returns.
That was a consequence of how the ring is computed, and it is kept because it
turns a shortcut into a decision.

**Upkeep that changes shape with the family.** 12 fruit and 10 gold out of a
five minute summer is most of what the summer had to spend. Upkeep that rises
with a family level is in the archive and stays there. What changes here is
what upkeep is asked in: a poor family eats what it picks, a family with
standing buys food and owes rent, the total falls in slots as it goes, and the
rent at the higher levels is more than the ring's feathers make. So the winter
itself pushes the family outward, which is where everything else already
points. A missed winter asks for the level below next year, so the tired
summer cannot start a spiral.

## Summer

**One bar.** Hydration answers where. Time answers what to spend on, and
the clock is already on screen. Stamina was tried twice and removed on 15
Sep 2026. As a rate that recovered by standing still, the question it asked
was "how long do I wait", which is not a decision. As a budget spent per
rough tile and per cut, it was meant to make a thick wall a price the
player could count, and it did not survive its first playtest, for two
reasons. The walking tax could not be planned: underbrush is the forest
floor, a third to a half of the walkable tiles on every test map, and
nobody sums a texture by eye, so even the designer could not change a
route to save it. And a bar that stops the legs at zero is a second hard
stop beside the clock, a worse one, because the rest of the summer can be
spent standing in it. The wall part was never tested, since the walk spent
the bar first. What stamina was for is carried by time: rough ground is
slow, a cut is a hold, and those seconds compete with gathering, which is
the same decision. A second stat, if it comes, reacts to place, not to time
or effort, or it only repeats the clock: health once hazards exist, a
spirit meter once spirits do.

**No sprint.** A held key that makes you faster is a key held all the time.
Taking it away makes speed something the map gives, through paths, bridges
and a cart route, which is the thing being tested. Base walk speed goes up a
little to compensate. A burst of speed bought with a fruit is different: it
is spent, not held, and it is an experiment of its own.

**Thickness is priced in the hold.** With no budget, the only cost of a cut
is the seconds of holding the key plus the walk to the wall. The length of
the hold is the dial, and a wall is a two-summer project because its
minutes compete with everything else the summer could gather. A long hold
is watching a bar, so the dial can also be turned by making walls thicker
and cuts quicker.

**Hydration is a leash to a place.** Water is drunk at springs and banks,
never carried, so where the water is decides where the character can work.
Near camp it does not matter. Far out it is a barrier of its own, and the
well is the key to it. It drains at a constant rate because weather and
seasons are not in yet. Fog is the first consequence because it is felt
without stopping play. Slowness is held back in case fog is not enough.

**Fruit is winter food, and a burst of speed.** With stamina gone there is
nothing for a meal to refill, and meals went with it. Eating a fruit for a
few seconds of speed keeps what the meal was for: every fruit eaten in
summer is one not stored at camp, so eating is a choice between now and
winter, and it gives the last minute of a summer a move. It is uncapped on
purpose, to find out whether the clock alone stops fruit from becoming an
exchange rate, where a summer's reach is how much fruit was brought. If it
does not, a meal count or diminishing returns is the fallback. No cooldown,
because the cooldown was the discovery test's one irritation.

**Summer length follows age.** It is the three stages of a life made visible
in the one number every summer is measured by.

**What is carried at the hard stop is banked.** So the last minute is never
wasted, and a final trip out is a good move, not a gamble. The extra gold
for ending away from camp keeps coming home worth something.

**Camp takes everything.** It used to take only what it sold, and leave
sticks, vines and logs in the pack so they were not lost before winter could
sell them. With the pack surviving the winter, that made a pack full of vines a dead end for the whole run: no way to be rid
of them, this summer or any after. Camp as a store that also sells closes
it.

**Three tiers, not a fruit rule.** The ground keeps nothing over a winter,
the cart keeps everything but fruit, camp keeps everything. That says "fruit
does not survive a winter away from camp" without naming fruit twice, and it
reads as physics: a heap in a field is
scattered, a box is a box, a fruit is a fruit anywhere.

**Dropping is never refused for what is dropped.** Refusing a drop is
unthematic in a game about carrying things. The safeguard against throwing
six winter meals on the grass is the count in the prompt, and it is enough,
because they can be picked back up. A drop is refused only when there is no
open ground near enough to put anything on.

**Picking up is not harvesting.** Gathering is prying a vine out of the mud,
and its hold is the price of the vine. Picking up is bending down to take
back what was already paid for, so it is a press. For the same reason a
dropped item gives way to a node on the same key: standing on what you just
dropped must not stop you picking the fruit you dropped it for.

**A press and a hold on one key.** At camp and the cart a press stores the
whole load and a hold opens the panel, so the common arrival is still one
press and the choice is there when it is wanted. The press acts on the
release, because that is the only moment the two can be told apart.

**The grave gives something that lasts.** A visit is worth the walk over a
life, and it must not be a refill. What it gives is open again now that
max stamina is gone.

**What a slot is worth is the number that rises outward, and prices are
flat.** The first version of the economy doubled a kind's price with every
barrier out, which tied earning to the map before anything else did. Depletion
does that job now: a worked field is gone, the ordinary kinds come back by
half, and the near ring covers the upkeep and nothing beyond it, so every gold
above surviving is already further out and the prices need not repeat the
point. What is left for the prices to do is answer the question the player
actually asks, which is what to carry when the pack is nearly full. So the
number that has to rise with distance is gold per slot, not gold per item.

It is a working rule and not a decoration. A slot of the near ring's feathers
is 5 gold; a shell, a slot each and further out than the first three summers
reach, is 6, so a slot of the far field beats a slot of the near one and the
trip is worth making. It also settles arguments by itself: surplus fruit sells
for 1 and takes a slot each, so hauling food home as a living is 1 gold a
slot, and nobody has to be forbidden from doing it.

**Material does not sell.** Sticks, vines and logs were priced at 1, which
made a summer's sticks and vines about 12 gold, more than the rent. The first
three years could then be funded by carrying home the things a bridge is made
of, which is not what the fields are for. With no price on material, all
income is a field and the open question of whether material should sell at all
is closed. It also gives the build recipes the whole of what material is for,
and camp a pile of it that costs nothing to keep.

Pure sellables are ordinary things, feathers and shells, because they need not
be exotic to pull the player outward. Rarity is left out to keep it simple
until respawning is designed.

**Four currencies, and thickness as the dial.** A barrier can be short in
time, a tool, materials or hydration. Because cuts persist, thickness
turns a wall into a project that spans summers, which is what makes a later
summer continue an earlier one.

**Each summer is short in what the one before supplied.** The five-summer
table is built so each barrier needs exactly one currency the previous
summer made affordable. Each summer then depends on the last, and none is a
repeat.

**Tools come from the town, and some need things carried home.** Then gold
is not the whole answer, and a purchase can be a small quest. One tier and
no wear keep tools simple. Gear that changes costs gives the shop variety
without new buttons.

**The cart is an experiment.** It is fast only on grass, bridge and planks,
crawls through underbrush and stops at mud, so using it well means making a
road. That is either the best of the game, the map changed into
infrastructure, or hauling as a chore. The five summers are there partly to
find out which. It crawls rather than refusing underbrush so that the first
summer with it can already reach a field and feel what a road would give,
and trails are the road it makes by being used. Pushing it drains
hydration, which gives the well a second reason.

## Between summers

**The inner ring always comes back.** There is always a safe way to pay the
upkeep, so missing it is a choice or a mistake, never a trap.

**The inner ring pays the upkeep, and little more.** Its feathers make the
rent and its fruit the food, so a summer spent only there is survived and
nothing else. Everything toward the family and the shop is further out.

**Valuable finds do not come back.** Shells returning by a share made them
an endless answer to wealth: the same field, worked every summer, a little
less each time. A field that is gone once worked is what drives the family
outward, and the next barrier is where the next field is. Ordinary things
further out, fruit and feathers, come back by half, which keeps a worked
field worth a visit without making it the answer.

**The shop opens with the family.** Stock tied to the winter number handed
out tools on a timetable. Tied to the family's level, it makes bringing
money home the way the town opens, and spending in the shop and giving to
the family pull against each other. The stock is fixed at the level the
winter began with, so a purchase cannot close the shop it was made in, and
what the new level unlocks is shown frosted, a goal for next summer.

**No shop in the first winter.** On the winter screen a new player has
upkeep and the family to understand, and nothing else. Opening the shop is
the first summer's goal, which makes that summer a tutorial with a point.

**The list is the player's.** A fresh player needed a little steering.
Tasks written by the game, bring this many feathers, would say where to go
and turn exploring into errands. The list is ticked by the player in winter
from the shop, the upkeep and the family, and names amounts, never places.
It is filled from the top because money is one pot. Selling building
material does not tick it, so the list never teaches that selling sticks is
how to earn.

**The cart replaces the cache.** A cart parked at a field is a box in the
field, and a box that can also be pushed home. Two things that nearly do
one job is one too many to learn in five summers.

**Barriers grow back.** Thicket creeps at the edges of cuts and felled
copses return, so tools keep their use and a path with open ground on both
sides is worth more than a thin cut.

**A bridge loses a tile every other winter.** Often enough that built things
need care, rarely enough that repair is not a yearly chore. Wells never
decay.

**Trails form from walking.** The player's preferred route becomes the road
without a tool. It is gradual and random, so it rewards a habit and not a
single trip.

**Winter is a screen to start with.** The map under snow is wanted, for its
look and for watching the map regrow, but how selling and buying fit it is
not clear yet.

**Gold does not carry.** What is left after upkeep goes to the family, which
gives surplus a meaning and keeps each winter's purchase a real choice.

**Upkeep rises only with structures.** Supplying the works forces more
efficient income, which forces new logistics, which keeps a life's play
changing. Rising for any other reason would be a tax.

**Missing upkeep costs a tired summer, not the run.** Holds take half as
long again and rough ground is slower, for one summer. Easy ground stays
fast, so the penalty lands where the work is and never on the walk to it,
which is the part of a summer that was already the most routing. Enough to
make upkeep a priority, never enough to end a life.

**Nothing announces the damage.** The player meets what wore and grew back
on the map, which is where it matters.

## The map arc

**What makes summer 17 worth playing** is reaping what was built and working
toward something bigger, the way projects grow in Factorio. Structures are
that bigger thing.

**A structure is a set of different jobs.** Surveying a site, building the
rails, cutting the road, supplying the camp. A years-long build made of one
job repeated would be a chore. The people who work a finished structure are
never seen: the player builds the thing that does the work, and the grinding
stays theirs.

**A structure pays out in new play, never a multiplier.** The mine's metal
makes tools that break new barriers. A multiplier would make the same play
faster, and the point is that play changes.

**Domains, not enforced phases.** The model is Oxygen Not Included, where a
project takes hours and opens a new domain of rules. A chain of dependent
structures alone makes every generation feel the same. Natural, animal and
spiritual have a natural order, since the spiritual domain needs things from
the other two, but nothing enforces it. Structures are not tied to
generations either, so a player is never required to understand the system
within one life.

**Two strengths, kept apart.** Town strength comes from structures and
family strength from spare gold. Each rewards a different kind of play, and
neither can buy the other.

**The purpose of a generation** is the same map replayed by a level-one
character who knows it and has shaped it. It is a puzzle: prepare the map
so the child thrives young, then be young again and adjust the plan. The
second youth has to be faster than the first and feel like a power trip,
stage X in three years instead of eight, never a chore that delays the new
parts.

**The heir starts with almost nothing.** No gold, the minimum of tools,
perhaps one inherited thing. Otherwise there is no starting over, only a
continuation.

**The camp puzzle.** The child offers three sites and the parent picks one,
each with a list of what it lacks. The last summers go to fixing the list,
which gives the decline a job and makes what is left unfixed the heir's
first handicap. It replaced inheritance as a chest of objects.

**No cap on generations.** The game is relaxed, so a new player learns at
their own pace on the first map.

**Wear depends on the quality of the work.** A cut path lasts a winter,
stone lasts for good. Better building is then a choice with a payoff over
lives.

**A map ends with the road out.** Not because it is spent, and not by
walking off the edge. The road needs every domain finished, so the ending
is the sum of the map's play.

## Words

**In-game words over game-design words.** Upkeep, not floor. Hydration,
not leash. Shop, not shelf. The design documents use the words the player
will see.

**Camp, not the store.** What is kept at camp is called camp. "Store" was
both the verb and the noun on one line, and too near "shop" for a game with a
town that sells things. The verb stays: you store something at camp.

**Summer and winter, not day and night.** The game is called thirtysummers,
and a year is the unit the player counts.
