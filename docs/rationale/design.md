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
summer is one not in the store, so eating is a choice between now and
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

**The grave gives something that lasts.** A visit is worth the walk over a
life, and it must not be a refill. What it gives is open again now that
max stamina is gone.

**A rung on the ladder is distance behind barriers.** Near camp sells for
nothing or one, each barrier out roughly doubles it. That ties the economy
to the map: the way to earn more is to open more. Kinds with a use compete
with their price, so selling a stick is a decision. Pure sellables are
ordinary things, feathers and shells, because they need not be exotic to
pull the player outward. Rarity is left out to keep it simple until
respawning is designed.

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

**The cart is an experiment.** It runs only on grass and bridge, so using it
means cutting a continuous road. That is either the best of the game, the
map changed into infrastructure, or hauling as a chore. The five summers are
there partly to find out which.

## Between summers

**The inner ring always comes back.** There is always a safe way to pay the
upkeep, so missing it is a choice or a mistake, never a trap.

**Sellables come back slowly.** A field worked hard gives less the next
year, which drives the family outward to the next barrier. It never falls
low enough to block play, because it is a nudge, not a wall.

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

**Summer and winter, not day and night.** The game is called thirtysummers,
and a year is the unit the player counts.
