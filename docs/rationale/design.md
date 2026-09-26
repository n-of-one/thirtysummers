# Design rationale

Why the game's mechanics are what they are. The documents in
[../design/](../design/README.md) say what the game is. This one says why,
so the same ground is not argued twice. The evidence from play is in
[discovery-test-playtests.md](discovery-test-playtests.md).

## The discovery test, and what it decided

The fun, as imagined, is that the player changes the map, and that opens up
something they had not seen. That sentence has four requirements:

- There must be something the player cannot reach from camp.
- There must be a barrier that reads as "not yet".
- There must be a tool that removes it.
- What lies behind the barrier must differ from what lies in front, or
  nothing was discovered.

The generated map failed the first and the last. Noise makes a map that is
the same everywhere, so a bridge would only open up more of what was already
in reach. The discovery test was built to meet all four, and each choice
below answers one of them.

**Regions are resource fields, not biomes.** A place is made by a resource
you can see from across its barrier, dense enough to read as a field and
useful enough to want. Palette swaps would have looked like a theme park, and
if a swamp felt good, the test could not say whether that came from the
opening up or from the art.

**The regions form a chain.** Each barrier's reward is the key to the next:
vines behind the mud, sticks behind the thicket, and together they bridge
the stream to the gold. That is what makes a barrier read as "not yet"
instead of "no".

**Hard and soft barriers side by side.** The thicket and the stream are
walls, and the mud is a cost. Putting both in one test compares removing a
wall with removing a cost, which winter needs to know in order to price
them.

**Barriers thin enough to see across.** Top-down gives the tease for free:
the player sees over a thicket and across a stream, so every field is
visible before it is reachable.

**Tools work in place, like harvesting.** An action on the same key, with
no new input and no new UI beyond the prompt. One short cut path near camp
is there from the start, so the player sees what the knife does before using
it.

**Maps are generated dumps, edited by hand, played blind.** A map the
designer drew has no unknowns in it for the designer. Teaching the generator
to build the chain would have taken several evenings plus open-ended
tuning, against half an evening for a loader for the existing dump format.
Edited dumps keep the generator's feel.

**The verdict, 8 Sep 2026: the idea works.** Four sessions by the designer,
on maps a and b. Breaking through felt like something every time. The very
first session ranked the mud first, for the vines in it. The later ones put
the bridge first and the mud last.

The same log said what the game needed next. Summers 2 and 3 on the same map
turned into a routing exercise, since nothing changed but the resources, and
gold had nothing to buy. The fruit cooldown and the small refill were the
one real irritation. Sprint was fun and probably too strong. Most of what
follows answers those four points.

## The first three years, and what they changed

M10 built the first three years, and they were played on 23 Sep 2026. The
verdict was that they are not fun yet, and the log is specific about where.
Year 1 is close: the ring is explored rather than swept, and working out how
to build the bridge is the good part, with a little too much fruit. Year 2
is where it breaks. The walk from camp to the bridge is long, carrying fruit
back is a chore within a few trips, nothing on the map shows what has
already been seen, and the money does not add up. The axe and the family's
next level together need more than the field has, so the balance comes from
selling sticks and vines, which is not what the fields are for. Year 3 is the
same again, with more upkeep on top.

Six answers follow, in the order they are built. Each is one change, so each
can be played and judged on its own.

**Fruit on a tree.** Twelve fruit spread across a ring 58 tiles in radius is
an errand across the whole ring, every summer, before anything else
happens. The same fruit on a handful of trees is a handful of stops, each of
them a place instead of a scatter, and the ring's food stops being a sweep.
The tree is an ordinary tree; the fruit under it is what marks it. It also
makes the ring's food a place worth remembering, which is the same problem
as the map.

How much fruit hangs on one tree was settled in play. Four under every tree
made a tree something to count, so the ring has 15 fruit over 5 trees, two
to four each. Having trees worth the walk next to trees worth passing by is
what makes each stop a place. Where the fruit hangs was settled the same
way. The tiles around the trunk are shuffled instead of taken in order,
because fruit at the compass points looks like a rosette. A tree is drawn
upward from the foot of its trunk, so fruit is hung in front of it and
beside it first. Only a tree's fourth fruit ever goes behind the trunk, and
only sometimes: enough that walking round a tree can still turn something
up, never so much that a stop looks empty from the south.

**What a slot is worth.** See *Summer*, below. The shell field went from 30
shells at 2 gold to 10 at 6 for the same reason. 30 shells is 3 pack loads:
about 150 seconds of a 300-second summer spent walking a route already
known, for less than half the gold per slot that the near ring's feathers
make. Ten shells is one load, worth 60 gold, and the trip out is the
best-paid trip on the map.

**Trails worn by walking.** The slog is crossing the same ground again and
again. The design's answer to it, the cart and the trails it wears, arrives
in summers 4 and 5, two summers after the problem. Underbrush worn down by
feet puts the answer in the first summer, and there is nothing to learn: the
repetition is what makes the road. Wear only applies to underbrush, so the
knife keeps the thicket and planks keep the mud, and only to the tiles
actually walked, so a route is a decision and not a radius.

The first crossing already marks a tile and makes it a little faster. If
wear only showed after several crossings, the player would have to walk the
same tiles again by luck before learning that walking changes the ground,
and the lesson would come too late to plan with. Seen on the first trip, the
line is something to aim for on the way back. After that it wears in stages
to flat. Flat is still underbrush, and only the walk after flat makes grass.
The first build turned a tile to grass on the second walk. That felt good to
play, but it made open ground of every route, so the ring was on its way to
becoming a lawn, and a path could no longer be told apart from a field.
Stages keep the player's paths visible as paths, and give the walks after
the second something to show. Grass at the end is kept for the routes walked
most.

Building trails settled five other things:

- A cut through thicket leaves underbrush, not grass. The knife opens the
  wall and the feet make the path, so a cut is not a second, cheaper way to
  make a road.
- The grass the layout laid from camp to the feather field is gone, because
  it was a road nobody had walked. The check that the cart's route there
  needed a cut went with it, since carts are being rethought.
- Underbrush is thin where the noise has only just crossed into it, so a
  clearing turns gradually into brush instead of meeting a hard line. How
  thick the land between the woods is, is tuned in one table.
- Dense underbrush is the one kind walking never wears. Without it, every
  route through the ring would end as a road. A wood that stays slow however
  often it is crossed keeps some of the map a barrier.
- Keeping the action key pressed picks up a whole feather field, the way it
  works through a row of fruit. One press per feather made the field across
  the stream a chore of presses.

**Fruit trees stand in underbrush.** A tree on open grass in the middle of
brush looked planted. A fruit tree is a tree, so it stands where trees grow,
in dense underbrush first. All it needs is room, with no other tree within
two tiles, so its fruit can be walked to and seen. This also let grass
become scarce without the ring's food clumping together: a tree that needed
open grass all round had nowhere to go once most of the ring was
underbrush.

**The map in the corner.** Nothing recorded what the player had seen, so
nothing could feel uncovered, even when it was. The other option was dimming
unseen ground in the play view, and it was dropped: the game is played by
looking at the ground ahead, and darkening it to make a point about memory
takes more than it gives. A small map that fills in leaves the view alone.
It shows terrain and built things, not what there is to pick, because
remembering a field is the reward for having gone there.

**Camp that moves.** From summer 2 on, the walk from camp to the far bank is
made again on every trip, over ground that was picked the summer before.
Moving camp removes that walk. The move is earned through the family instead
of built from sticks, because the family's levels had nothing to open but
items in the shop. It costs material, which has no other use now. The near
ring is measured from camp, and that makes the move a trade: the far bank
starts coming back every summer, and the old ring drops to coming back by
half. That was a side effect of how the ring is computed, and it is kept
because it turns a shortcut into a decision.

**Upkeep that changes with the family's level.** 12 fruit and 10 gold out of
a five-minute summer was most of what the summer had to spend. Upkeep that
rises with a family level is in the archive, and it stays there. What
changes here is what upkeep is paid in. A poor family eats what it picks; a
family with standing buys food and owes rent. The total in slots falls as
the family rises, and at the higher levels the rent is more than the ring's
feathers make. So the winter itself pushes the family outward, the same
direction everything else points. A missed winter charges the level below
the next year, so the tired summer cannot start a downward spiral.

## Summer

**One bar.** Hydration answers where the character can work. Time answers
what to spend the summer on, and the clock is already on screen. Stamina was
tried twice and removed on 15 Sep 2026:

- As a rate that recovered by standing still, the question it asked was "how
  long do I wait", which is not a decision.
- As a budget spent per rough tile and per cut, it was meant to make a thick
  wall a price the player could count. It did not survive its first
  playtest, for two reasons. First, the cost of walking could not be
  planned: underbrush is the forest floor, a third to a half of the walkable
  tiles on every test map, and nobody adds up a texture by eye, so even the
  designer could not change a route to save stamina. Second, a bar that
  stops the legs at zero is a second hard stop next to the clock, and a
  worse one, because the player can spend the rest of the summer standing
  still in it. The wall part was never tested, because walking used up the
  bar first.

Time now does what stamina was for: rough ground is slow, a cut is an action
that takes time, and those seconds compete with gathering, which is the same
decision. A second stat, if one comes, has to react to place, not to time or
effort, or it only repeats the clock: health once hazards exist, a spirit
meter once spirits do.

**No sprint.** A key that makes you faster is a key kept pressed all the
time. Taking it away makes speed something the map gives, through paths,
bridges and a cart route, which is the thing being tested. Base walking
speed goes up a little to make up for it. A burst of speed from eating a
fruit is different: it is used up, not kept going, and it is an experiment
of its own.

**Thickness is priced in action time.** With no stamina, the only cost of a
cut is the seconds of keeping the key pressed, plus the walk to the wall.
How long a cut takes is the setting to tune, and a wall is a two-summer
project because its minutes compete with everything else the summer could
gather. A long action is spent watching a progress bar, so the same cost can
also be reached with thicker walls and quicker cuts.

**Hydration ties the character to a place.** Water is drunk at springs and
banks, never carried, so where the water is decides where the character can
work. Near camp it does not matter. Far out it is a barrier of its own, and
the well is the key to it. It drains at a steady rate because weather and
seasons are not in the game yet. Fog is the first effect of dehydration
because it is felt without stopping play. Slowness is kept in reserve in
case fog is not enough.

**Fruit is winter food, and could be a burst of speed.** With stamina gone
there is nothing for a meal to refill, so meals went with it. Eating a fruit
for a few seconds of speed keeps what the meal was for: every fruit eaten in
summer is one fewer stored at camp, so eating is a choice between now and
winter, and it gives the player something to do with the last minute of a
summer. It is uncapped on purpose, to find out whether the clock alone stops
fruit from becoming an exchange rate, where how far a summer reaches depends
on how much fruit was brought. If it does not, the fallback is a meal count,
or less effect from each extra fruit. There is no cooldown, because the
cooldown was the discovery test's one irritation. This is M13, and until it
is built it is an idea in [../design/ideas.md](../design/ideas.md).

**Summer length follows age.** It makes the three stages of a life visible
in the one number every summer is measured by.

**What is carried at the hard stop is stored.** So the last minute is never
wasted, and a final trip out is a good move, not a gamble. The extra gold
for ending away from camp keeps coming home worth something.

**Camp takes everything.** It used to take only what it sold, and it left
sticks, vines and logs in the pack so they were not lost before winter could
sell them. Because the pack keeps its contents through the winter, a pack
full of vines became a dead end for the whole run: there was no way to get
rid of them, that summer or any after. Camp taking everything fixes that.

**Three places, not a fruit rule.** The ground keeps nothing over a winter,
the cart keeps everything except fruit, and camp keeps everything. That says
"fruit does not survive a winter away from camp" without a special rule for
fruit, and it reads as physics: a heap in a field is scattered, a box is a
box, and fruit rots anywhere but camp.

**A drop is never refused because of what is dropped.** Refusing a drop does
not fit a game about carrying things. The safeguard against throwing six
winter meals on the grass is the count in the prompt, and it is enough,
because they can be picked back up. A drop is refused only when there is no
open ground near enough to put anything on.

**Picking up is not harvesting.** Gathering is prying a vine out of the mud,
and the time that action takes is the price of the vine. Picking up is
bending down to take back what was already paid for, so it is a press. For
the same reason, when a dropped item and something growing are both in
front of the action key, the growing thing goes first: standing on what you
just dropped must not stop you picking the fruit you dropped it for.

**A press and a long press on one key.** At camp and at the cart, a press
stores the whole pack and a long press opens the panel. So the usual arrival
is still one press, and the choice is there when it is wanted. The press
acts when the key is released, because that is the only moment the two can
be told apart.

**The grave gives something that lasts.** A visit is worth the walk over a
whole life, and it must not be a refill. What it gives is open again now
that max stamina is gone.

**Gold per slot rises outward, and prices are flat.** The first version of
the economy doubled a kind's price with every barrier further out, which
tied earning to the map before anything else did. Depletion does that job
now: a worked field is gone, the ordinary kinds come back by half, and the
near ring covers the upkeep and nothing beyond it. So every gold beyond
getting through the winter is already further out, and the prices do not
need to make that point again. What is left for the prices to do is answer
the question the player actually asks: what to carry when the pack is
nearly full. So the number that has to rise with distance is gold per slot,
not gold per item.

It is a working rule, not decoration. A slot of the near ring's feathers is
worth 5 gold. A shell takes a slot of its own, lies further out than the
first three summers reach, and is worth 6. So a slot from the far field
beats a slot from the near one, and the trip is worth making. The rule also
settles questions by itself: surplus fruit sells for 1 and takes a slot
each, so hauling food home for money earns 1 gold a slot, and nobody has to
be forbidden from doing it.

**Material does not sell.** Sticks, vines and logs used to be priced at 1,
which made a summer's sticks and vines worth about 12 gold, more than the
rent. The first three years could then be paid for by carrying home the
things a bridge is made of, which is not what the fields are for. With no
price on material, all income comes from a field, and the open question of
whether material should sell at all is closed. It also means material exists
only for building, and camp can keep a pile of it at no cost.

The things that only sell are ordinary: feathers and shells. They do not
need to be exotic to pull the player outward. Rarity is left out to keep
things simple until respawning is designed.

**Four currencies, and thickness as the main setting.** A barrier can be
short of time, a tool, materials or hydration. Because cuts last, thickness
turns a wall into a project across several summers, which is what makes a
later summer continue an earlier one.

**Each summer needs what the one before made possible.** The five-summer
table is built so each barrier needs exactly one currency that the previous
summer made affordable. Each summer then depends on the last, and none is a
repeat.

**Tools come from the town, and some need things carried home.** Then gold
is not the whole answer, and a purchase can be a small quest. One tier and
no wear keep tools simple. Gear that changes costs gives the shop variety
without new buttons.

**The cart is an experiment.** It is fast only on grass, bridges and planks,
crawls through underbrush and stops at mud, so using it well means making a
road. That is either the best of the game, the map turned into
infrastructure, or hauling as a chore, and the five summers are partly there
to find out which. It crawls through underbrush instead of refusing it, so
the first summer with it can already reach a field and feel what a road
would give, and trails are the road it makes by being used. Pushing it
drains hydration, which gives the well a second reason.

**The map shows what was seen, and "seen" is narrower than the screen.** The
fog is never off: clear to 9 tiles at full hydration and black by 17, so the
sides of the view are always dark. Marking the whole view would fill the map
with ground nobody saw. So a tile counts as seen when it has been within 14
tiles of the player, a little way into the fog's fade. Dehydration narrows
this along with the fog, so thirst costs the map as well as the view, with
nothing extra to build.

**Sharp edges, not a fading frontier.** Storing how well each tile was seen,
and drawing a dim edge around what was explored, was built, and it looked
worse than a map whose edge is simply where seeing stopped. A fog laid over
the corner map, with the same gradient as the real fog, was tried too. It
darkened only the ground behind the player, while new ground at the map's
edge came in sharp, and that looked lopsided.

**The map must not be a way round thirst.** Once the corner map was there, a
dehydrated player could find their way by it with the fog closed in, which
undoes what the fog is for. So the corner map shrinks. It stays whole down
to 50% hydration, then shrinks fast until at 25% it is no bigger than what
the player can see, and follows the fog down from there. Shrinking earlier,
from 75% to match at 50%, was tried: it took the map away while the player
could still see. Catching up later leaves a few seconds where the map is the
better guide, which is the price of not taking it away at the first sign of
thirst. The whole-valley map fades instead of shrinking. At 0% only the
landmarks are left (the river, the thickets, the places to drink, the fruit
trees and camp), so a thirsty player can still work out where water is and
which way round to go, but not the ground in between. The fade looks even to
the eye, which means it is not even in the colour values.

**A thirsty player is helped to water, not to everything.** The places to
drink stay on both maps however dehydrated the player is. A pointer on the
edge of the corner map always shows the nearest one seen, not only when the
player is thirsty: water is what a player needs to find again, and a guide
to it everywhere is kinder than one that only appears in trouble. It points
in a straight line, to where the water is remembered to be, and leaves the
route to the player and the fog. It stays on one spring until another is two
tiles nearer, so walking along a bank does not make it flicker. A margin of
three tiles kept it on the old spring too long.

**The map is terrain and landmarks, not a record of the player.** Trails
were drawn and then taken off: worn underbrush is still underbrush until it
is walked into grass, and a map of the player's own footprints said more
about the player than about the valley. Fruit trees are marked, as a block
in the fruit's colour, picked or not, because a tree worth coming back to is
a place. The fruit itself is not marked, and neither is anything else to
pick, because remembering a field is up to the player.

## Between summers

**The near ring always comes back.** There is always a safe way to pay the
upkeep, so missing it is a choice or a mistake, never a trap.

**The near ring pays the upkeep, and little more.** Its feathers make the
rent and its fruit makes the food, so a summer spent only there can be
survived, and that is all. Everything for the family and the shop is further
out.

**Valuable finds do not come back.** When shells came back by a share, they
were an endless answer to wealth: the same field, worked every summer, a
little less each time. A field that is gone once it has been worked is what
drives the family outward, and the next barrier is where the next field is.
Ordinary things further out, fruit and feathers, come back by half, which
keeps a worked field worth a visit without making it the answer.

**The shop opens with the family.** Stock tied to the winter number handed
out tools on a timetable. Tying it to the family's level makes bringing
money home the way the town opens up, and makes spending in the shop and
giving to the family pull against each other. The stock is fixed at the
level the winter began with, so a purchase cannot close the shop it was made
in, and what the new level unlocks is shown frosted, as a goal for next
summer.

**No shop in the first winter.** On the winter screen, a new player has
upkeep and the family to understand, and nothing else. Opening the shop is
the first summer's goal, which makes that summer a tutorial with a point.

**The list is the player's.** A new player needed a little steering. Tasks
written by the game, such as "bring this many feathers", would say where to
go and turn exploring into errands. The player ticks the list in winter,
from the shop, the upkeep and the family, and it names amounts, never
places. It is filled from the top because money is one pot. Building
material never ticks off a gold box, so the list never teaches that selling
sticks is how to earn.

**The cart replaces the cache.** A cart parked at a field is a box in the
field, and one that can also be pushed home. Two things that nearly do one
job is one too many to learn in five summers.

**Barriers grow back.** Thicket creeps back at the edges of cuts, and felled
copses return, so tools stay useful, and a path with open ground on both
sides is worth more than a thin cut.

**A bridge loses a tile every other winter.** Often enough that built things
need care, rarely enough that repair is not a yearly chore. Wells never
decay.

**Trails form from walking.** The player's usual route becomes the road
without a tool. It is gradual, so it rewards a habit and not a single trip.

**Winter is a screen to start with.** The map under snow is wanted, for its
look and for watching the map grow back, but how selling and buying would
fit into it is not clear yet.

**Gold does not carry over.** What is left after upkeep goes to the family,
which gives leftover gold a meaning and keeps each winter's purchase a real
choice.

**Upkeep rises only with structures.** Supplying the people who work them
forces better income, which forces new logistics, and that keeps a life's
play changing. Upkeep rising for any other reason would be a tax.

**Missing upkeep costs a tired summer, not the run.** For one summer,
actions that take time take one and a half times as long, and rough ground
is slower. Easy ground stays fast, so the penalty lands where the work is
and never on the walk to it, which was already the part of a summer with the
most routing. That is enough to make upkeep a priority, and never enough to
end a life.

**Nothing announces the damage.** The player finds what wore and what grew
back on the map, which is where it matters.

## The valley

**A valley, not a square.** A square map bordered by rock, with a stream
stamped on it, looked as artificial as the mud disc had. A winding valley
walled by rock has a shape of its own: its far end cannot be seen from camp,
so it unfolds as the player goes up it.

**A river down the middle makes three parts.** The river and one stream off
the wall split the valley into camp's part, a large open bank the first
bridge reaches, and a narrow far bank. Of the valleys sketched, the winding
one was chosen: one side valley in each large part, not the many of a
valley with fingers; an open bank that curves and invites; and a far bank
narrow enough to be hard to get about. A valley with more side valleys
gives a fourth part, a pocket cut off by a brook, which is kept for when
that stage of the game is known.

**The river is in a ravine because hydration needs distance.** With the
river on the valley floor, 97% of the valley was within 80 tiles' walk of
water, and not being allowed to drink from a river beside you would be
strange. With the river behind cliff, the drinking water is the stream and
the ponds, and hydration matters again in the side valleys and up the
valley.

**Cliff is a wall, not a height.** The ravine is drawn with the pack's
elevation tiles, but nothing stands at the river's level: the cliff is
ground no one walks, like rock. Z-levels stay parked.

**Ponds, not ways down.** Beaches with stairs down to the river were
sketched as the drinking places, and ponds on the valley floor were
preferred: they are water the family can see from the ground it walks,
and they need no second level.

**The stream falls into the lake from the north,** because the pack's
waterfall only falls towards the viewer. A stream reaching the river from
the east or west would need a waterfall falling sideways, and there is no
art for that. The lake at the fork gives the fork a centre, and lets the
river stay in its ravine the whole length of the valley.

## The map arc

**What makes summer 17 worth playing** is reaping what was built and working
toward something bigger, the way projects grow in Factorio. Structures are
that bigger thing.

**A structure is a set of different jobs:** surveying a site, building the
rails, cutting the road, supplying the camp. A build lasting years that was
one job repeated would be a chore. The people who work a finished structure
are never seen: the player builds the thing that does the work, and the hard
work of building it stays the player's.

**A structure pays out in new play, never a multiplier.** The mine's metal
makes tools that break new barriers. A multiplier would make the same play
faster, and the point is that play changes.

**Domains, not enforced phases.** The model is Oxygen Not Included, where a
project takes hours and opens a new domain of rules. A chain of dependent
structures on its own would make every generation feel the same. Natural,
animal and spiritual have a natural order, since the spiritual domain needs
things from the other two, but nothing enforces it. Structures are not tied
to generations either, so a player never has to understand the system
within one life.

**Two strengths, kept apart.** Town strength comes from structures, and
family strength from spare gold. Each rewards a different kind of play, and
neither can buy the other.

**The purpose of a generation** is replaying the same map with a level-one
character who knows it and has changed it. It is a puzzle: prepare the map
so the child does well while young, then be young again and adjust the plan.
The second youth has to be faster than the first and feel like a power trip,
reaching in three years what took eight, never a chore that delays the new
parts.

**The heir starts with almost nothing.** No gold, the minimum of tools,
perhaps one inherited thing. Otherwise there is no starting over, only a
continuation.

**The camp puzzle.** The child offers three sites and the parent picks one,
each with a list of what it lacks. The last summers go to fixing that list,
which gives the decline a job, and whatever is left unfixed becomes the
heir's first handicap. It replaced inheritance as a chest of objects.

**No limit on generations.** The game is relaxed, so a new player learns at
their own pace on the first map.

**Wear depends on the quality of the work.** A cut path lasts a winter, and
stone lasts for good. Better building is then a choice that pays off over
lives.

**A map ends with the road out.** Not because the map is used up, and not by
walking off the edge. The road needs every domain finished, so the ending is
the sum of the map's play.

## Words

**In-game words over game-design words.** Upkeep, not floor. Hydration, not
leash. Shop, not shelf. The design documents use the words the player will
see.

**Camp, not the store.** What is kept at camp is called camp. "Store" was
both the verb and the noun on one line, and too close to "shop" for a game
with a town that sells things. The verb stays: you store something at camp.

**Action, not hold.** "A hold" meant keeping the E key down, and "hold" also
meant contain, show and stay true, often in the same paragraph. The E key is
the action key, and what it does is an action. Some actions take time, and
that time is their price.

**Summer and winter, not day and night.** The game is called thirtysummers,
and a year is the unit the player counts.
