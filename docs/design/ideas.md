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
- What family levels unlock: the heir's starting stats or tools, more from
  the grave, perhaps tools.
- What else changes with age besides summer length and max stamina. Old
  characters drink less and tire more, young ones the reverse.
- How the grave is placed and how burial works.

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
- **Dusk with a dropped pack.** And the summer as a bag of stamina rather
  than a clock.
- **Gravel on mud**, the third improvement, once repeat trips through the mud
  have taught what a road is worth.
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
- **A generator pass** that builds the barrier chain, and later the
  five-summer table, per seed, with the hand-edited maps as its fixtures:
  no ford carving, sellables only across the stream, a forest patch walled
  in thicket, a mud pocket picked for the vines, the flood fill run three
  ways, and a retry when a seed fails.
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
underbrush. Tied to a stat: uphill costs stamina, brambles cost health,
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
