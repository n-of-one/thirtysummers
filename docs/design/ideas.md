# Ideas for later

Ideas worth keeping that are not decided. Nothing here is designed. Picking
one up means refining it into a design document first. Rejected ideas are in
[../archive/decided-against.md](../archive/decided-against.md), not here.

## Open questions

- The word for the character. Not hero, not main character.
- The word for the one structure per domain that keys the next map.
  Landmark, keystone and capstone were offered and not taken.
- What the old camp is for once the heir moves. It may stay useful if
  resources sit near it.
- How town strength carries into the next map's outpost. Perhaps a stronger
  town makes an outpost with better benefits in the next map's winters.
- What family levels unlock beyond the shop, what upkeep is paid in, and
  the camp site: the heir's starting stats or tools, more from the grave.
- What else changes with age besides summer length. Walking speed and how
  long actions take are the candidates. Old characters drink less and tire
  more, young ones the reverse.
- How the grave is placed and how burial works, and what a visit gives.
  It was one max stamina; with stamina gone it could be seconds on the
  summer, or something the lineage design decides.

## Parked

- **Winter under snow.** The map shown in winter, for its look and for
  watching it regrow and react. Winter is a screen to start with. There may
  be little to plan in winter unless the game grows more complex.
- **Visible seasons.** Autumn and spring as a visual round.
- **Naming places.** One name a year, in autumn or winter, never in summer.
- **The year's job on the summary card**, one line, so the stage a structure
  has reached is visible. Cards naming the year at the start and end of a
  summer.
- **Weather.** Weather years, and harsh years that wear things faster.
- **Gravel on mud**, the third improvement, once repeat trips through the mud
  have taught what a road is worth.
- **The cache**, a box built in the field from sticks, to store there and
  fetch later. Built in M9 and taken out of the first five summers: the cart
  parked at the edge of a field does the same job, and two things that
  nearly do one job is one too many to learn. Camp stays the first cache.
- **The thick wall**, twelve tiles of thicket into a last pocket, as a
  two-summer project. Out of the first five summers, which fill up without
  it. It may come back into summers 1 to 3 if they need more to do.
- **Other ways to lay out thicket**, offered for M10.5 next to the bramble bay in a
  wood, which was tried first. Thicket from its own noise, like mud, in
  several clumps at the edges of woods. A hedgerow the player can walk round
  or cut through, so the knife gives a shortcut rather than the only way in.
  Several small clumps with a stick or two in each. A fallen tree overgrown
  with brambles, its trunk a wall and its crown the sticks. And the wildest
  one: sticks that drop from thicket as it is cut, so the barrier is the
  field of sticks and grows back with it.
- **Logs floating downstream.** A log dropped in a stream drifts with the
  current and washes up on a bank further down. A stream that passes camp
  would carry felled logs home without a cart: logistics made of the map
  itself, and a reason to fell upstream.
- **The stream as a conveyor.** The same idea for everything, not only logs:
  anything put in running water drifts down and collects in a net at camp, so
  the stream is a delivery line and a field that touches water is worth
  more than one that does not. Offered as an answer to the hauling in years 2
  and 3, and not taken: trails and a camp that moves were taken instead.
- **The cart, two summers earlier.** Bought with gold alone in winter 2, since
  hauling is what breaks in summer 2 and the cart is the designed answer to
  hauling. Kept in reserve: if trails and a moved camp do not
  fix years 2 and 3, this is the next thing to try, and summers 4 and 5 then
  need a new opening.
- **The cache as the rung below the cart.** Cheap, stationary, built from
  sticks in an early summer, replaced by the cart later. It was parked because
  two things that nearly do one job is one too many to learn, and that is only
  true while both exist at once.
- **Someone who carries.** A dog, or the child once there is one, following at
  a distance with a few slots of their own.
- **Eating fruit for speed.** Eating a fruit gives a short burst of speed,
  for a moment that matters, such as a full pack and a minute left. Fruit is
  winter food, so every fruit eaten is one fewer stored at camp, and each
  time the choice is: eat it now, or keep it for winter. Planned as M13 in
  [../current/m13-fruit.md](../current/m13-fruit.md).
- **Fruit that spoils in the pack.** Food becomes the first trip's job and
  money the last trip's, which shapes the order of a summer without adding
  work to it.
- **The town's buyer on the road.** A peddler who walks the valley once a
  summer, so where you meet them is where you sell. It breaks the rule that
  camp sells nothing and everything is sold in winter, which is why it is only
  an idea.
- **Banking you can see.** When a load is stored at camp, a square flies
  from the player to the list and turns green where it lands, so bringing it
  home is watched rather than read.
- **A tired icon**, a status-effect icon shown beside the tired sentence in
  winter and kept on screen through the tired summer, so the two read as
  one thing.
- **Icons on the winter panels** for what each stands for, such as a market
  stall where the haul is sold and a house for the family, so the screen
  reads as places rather than tables.
- **A wider footprint for wear.** Any tile within 2 art pixels of the player's
  centre counts as walked on, not only the tile under it. Wear already counts
  a tile when the centre leaves it, so the footprint would have to as well:
  counted on the way in, it treads the next tile before the player has walked
  onto it.
- **Props on and beside mud**, from the swamp pack: stumps, stones, small
  plants, as decoration with no effect. Nothing may read as reeds, which
  mark springs, or as a stick or a log, which are picked up.
- **Ground that gets worse when walked.** Wet grass that turns to mud where
  it is walked often: a trail that makes the route slower, the opposite of
  worn underbrush. For an outer ring, where the player has to choose between
  a route that is short now and one that stays good.
- **Rarity**, once respawning is designed.
- **Hazards** in the far regions. A still crocodile that bites when walked
  over is the cheapest first one. Monsters, and fighting or recruiting them,
  come after.
- **A third stat**, reacting to place, not to time or effort: health once
  hazards exist, or a spirit meter once spirits do. The animal domain is the
  first that needs moving entities and probably this stat.
- **Stat purchases in winter**, from the original meta loop.
- **Challenge maps** with a known time limit. Never the first map.
- **Z-levels.** Terrain in stacked layers viewed one at a time. The code is
  z-indexed already and worldgen makes layer 0 only.
- **A generator that varies the table itself**, rather than laying the same
  arrangement out per seed as `worldgen/layout.ts` now does: a different
  number of pockets, barriers in another order, the near ring somewhere
  other than round camp. What is built now lays out the same table on every
  seed. What is open is whether that table is the only layout worth
  building.
- **Outside testers**, once the concept is fleshed out further.
- **A high-fantasy setting**, to see what it offers over low fantasy.

## The lineage

- The grave as the first shrine, the parent as the first spirit.
- A calling from the church or a spirit as the reason to move on.
- The key structure of a map as the grave.
- The structure chosen by the map's spirit.
- Ghosts, ancestors as spirits, calling on their aid, winter acts that make
  a stronger ancestor.

## From the first design notes

**Resource families.** Food. Water. Wood: sticks, logs, planks. Stone: rock,
tile, gravel. Ore, made into metal. Fibre: reeds, twine, grass. Sand and
clay. Animal: bone fragments, small and large bones, antler, fat, hide.
Coal. Flowers, for medicine or to draw insects and bees. Tree saps: rubber,
resin.

**What can make a resource hard to get.** It is found only in specific
places, behind tools. It is rare and random, or rare with a hint to where it
is this year, such as birds flying to it. It perishes once picked, so it has
to get home fast, or perishes if left, gone next year or in minutes. It is
there only on certain days or hours. It is heavy and needs a tool to move,
or bulky in the pack, or useful only in quantities that need a device or a
terrain change. It stains, so it cannot share the pack. It needs a skill
level. Animals drop it, hunted or farmed. It sits somewhere dangerous, or
guarded. It takes long work to extract, like mining. It needs the terrain
changed first, like a flood plain.

**Crafting.** Some things can only be made in a specific spot.

**Terrain improvements.** Faster movement over each terrain: a path through
underbrush, felled trees, a made path, a paved road. Shortcuts: bridges,
ladders. Luring and repelling animals. Preventing or encouraging floods.
Gardens: weeding out competition so a plant grows, tilling and planting,
fences, flowers to harvest, poisonous plants that act on animals.
Contraptions that raise collection: a sand catcher, spiritual things that
raise the chance of ore.

**More barriers.** Hard: river, lake, mountain face, forest. Soft: swamp,
underbrush. Tied to a stat: uphill is slow, brambles cost health,
desert costs hydration. Answered by gear, stats, and caches.

**Logistics.** Wheelbarrows for ore, wagons for lumber, each with its own
terrain: a wheelbarrow cannot cross underbrush and a wagon can, and neither
crosses mud.

**Seeds, literal or not.** Something planted or placed one year that acts
the next. Seeds that lure animals, or a plant that firms up mud. An item a
spirit likes or hates, placed to find out what spirit lives nearby, as a
research project over years. A dam, or a new river.

## Spirits

The spiritual domain's first notes, not yet designed.

**What spirits bring.** They bring the world to life. There is mystery in
how they work and what they are. They are a reason for more varied
mechanics, and depth that shows itself gradually. They interact with the
other systems. Learning how one works is a benefit that lasts across
generations. Different runs can have different spirits.

**A layered challenge.**

1. Learn that they exist, and where.
2. Work out a spirit's general type and avoid its wrath.
3. Work for it and gain its favour.
4. Work against it: take what it protects, and deal with its curse.
5. Move spirits to new places, perhaps to each other, for some effect.

**Properties.** Hidden but detectable, through gentle visual effects: light
or colour shifting, sparkles, a soft flash. They grant favour: rare
resources, items that should not work but do. They curse, and how to make a
curse fun to play with is open. They come in types, with lore backed by real
logic. They affect terrain, critters and items, and those affect them.

**Behaviour.** Spirits have wishes. Going against them brings bad luck or a
curse, and meeting them brings boons such as extra resources. Finding out
what a spirit wants is hard and may take generations. Spirits show
themselves on schedules, and tools and skills help detect them or read their
mood. A world has several, graded: the easiest is known from the start, the
next is easy to find and understand, though not easy to please, and the rest
are harder.

A spirit changes size. Relaxed, it spreads over a large area with little
visible effect, sleeping or gathering energy, and it gathers more the better
the area fits its wishes. Focused, it is small and present, and at human
size it shows as a ghost. Changing the terrain while a spirit sleeps may
wake it.

**Wishes**, often in pairs.

- High energy: fast movement, running water, wind, animals moving. Against
  it, calm: plants growing, slow movement, rest.
- Change: plants sprouting and dying, new animals, a changed terrain.
  Against it, stagnation: things the same summer after summer, stone.
- Warmth: fire, midday sun, and a dislike of clouds, winter and night.
  Against it, cold: water, snow, windswept ground.
- Darkness: deep forest, secluded places. Against it, openness: grass
  fields.
- Water: water, fish, rain.
