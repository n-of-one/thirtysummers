# 2d collect/explore

## Concept

Alternate cycles of collecting resources (day) and processing them (night). Improve the map to collect more and better resources.

## Core game loop

- Collect resources from a map during the day while avoiding obstacles and monsters
- Process/trade resources during the night to craft tools and items
- Improve map with items to make travel quicker and unlock new regions

## Extended game loop

- new areas have new resources and new challenges
- new resources allow items that unlock new interactions with existing areas
    - for instance allowing to fight/recruit monsters
    - create items that allow harvesting new items (while having to solve new challenges)

## Meta game loop

- your character ages, you have only a limited number of days.
- You start young with beginner stats. At night you can use resources to improve your stats. But over time it will be harder to maintain your physical stats
- You have influence over the starter stats of your next generation


## Ideas:

- play in generations. Each generation is a fresh slate, starting roughly from scratch but with some improvements left over from previous generations. Each generation


Numbers (Stardew Valley equivalent)

- day = 15 minutes
- night = pause / no time limit (but let's say 5 minutes)
- each generation is 30 days.
    - 10 days to get to physical peak
    - 10 days of physical peak - get the work done
    - 10 days decline - prepare for next generation


***

# Mechanics

Stats:

- Stamina
    - Starts at 100%
    - drops (1%/s) when you walk over difficult terrain or up a slope
    - drops (5%/s) when you sprint
    - restores slowly (0.2%/s) when walking over easy terrain
    - restores slowly (0.3%/s) when standing  still
    - restored by eating food
- Hydration
    - start at 100%
    - if below 50% your stamina does not recharge passively
    - if 0% your stamina passively decreases
- Backpack
    - determines how many items you can hold: 10

Cool downs

- Full stomach
    - Cannot eat any food until cool down is finished
    - Starts when eating food, timer determined by food

# Prototype

- 1 level
- just one day
- resources:
    - fruit -> restores stamina (20%) cooldown full stomach: 60 seconds.
    - water -> restores hydration (20%)
    - feathers -> gives gold (1 gold/feather) = victory points in the prototype
- terrain:
    - grass (passable, easy terrain)
    - tree (impassible)
    - underbrush (passable, difficult terrain)
    - stream (impassible)
    - mud (passable, difficult terrain)
    - rock (impassible, edge of playable area)
- camp
    - you start here.
    - You can drop off feathers here

# Map

- Generated using perlin noise to place grass, trees and underbrush. Values higher than a certain value are underbrush, and even higher values are forests where trees are surrounded by underbrush.


# Resources

- Food : restore stamina (other effects/benefits)
- Water : restore hydration
- Wood
    - Sticks
    - Logs
    - Planks
- Stone
    - Rock
    - Tile
    - Gravel
- Ores -> Metals
- Fiber
    - Reeds
    - Twine
    - Grass
- Sand
    - Sand
    - Clay
- Animal
    - Bone fragments
    - Small bone
    - Large bone
    - Antler
    - Fat
    - Hide
      - 
- Coal
- Flowers
    - Various species for their medicinal properties or attraction by animals (insects, bees)
-
- Tree saps
    - Rubber
    - Resin
    -

# Resources attributes (harvesting)

- found in specific places (requires tools/items to unlock)
- rare and random
- rare and there is a hint to where it can be found this year (birds fly to it, other signs pointing to it)
- perishes if you pick it up (need to transport home quickly)
- perishes if you don't pick it up (not available next year, or in next minutes)
- timetable: is only available on specific days
- timetable: only available during specific hours
- heavy: requires tools/items to move
- requires specific tools to harvest
- bulky: takes up a lot of space in inventory
- needs massive quantities: needs device/terrain improvements to be able to harvest useful quantities
- incompatible with other resources in inventory (stains easily, needs to be pristine)
- requires minimum skill level to harvest
- dropped by animals/monsters that need to be hunted
- dropped by animals/monsters that need to be farmed/fed/...
- resides in a place that is inherently dangerous (radiation, noxious gasses, underwater)
- resides in a place that is guarded by monsters
- requires a lot of time/effort to harvest (mining)
- requires terrain improvement (make a flood-plane)

# Resource attributes (crafting)

- requires crafting in a specific spot
-

# Terrain improvements

- Movement speed increase over specific parts (clear a path through underbrush, cut down trees, make a path, pave a road)
    - Different for each terrain type
- Movement shortcuts/unlocks (bridges, ladders)
    - Different for specific terrain types
- Lure animals
- Repel animals
- prevent flooding or encourage flooding
- garden
    - allow specific plants to grow by weeding out competition
    - till soil and plant seeds to grow
        - fences
        - specific flowers/plants to harvest
        - poisonous plants that interact with animals
- contraptions that increase resource collection (sand catcher, spiritual/magical things that increase chance of ore)


# Spirit world

What do the spirits bring in terms of gameplay

- theme and atmosphere: bring the world to live (literally)
- mystery: something to discover (mechanically, how do they work, lore wise: what are they)
- reason / excuse for more variety in mechanics
- staged depth: more complexity hiding in the world that reveals itself gradually
- complexity: interacting systems
- achievement: uncovering how a spirit works is a real benefit that persists over generations
- variety: different spirits over various runs

Spirits represent a layered challenge:

- layer 1: learn of their existence: where they are
- layer 2: figure out the general type of spirits, avoid their wrath
- layer 3: work for them, gain their favor
- layer 4: work against them, gain the resources they protect, deal with their curse
- layer 5: move spirits to new places, possibly move spirits to each other to ? ( achieve some effect)

What properties do spirits need to have, in order to achieve the above:

- hidden, but detectable
    - gentle visual effect: things are lighter/darker, or color shifts, sparkes, screen flash (gentle)
- grant favor
    - rare resources, items that should not work, but they do
- bestow curse
    - (how to make it fun to play with this)
- various types
  - 
- rich lore (backed to some degree by actual logic)
- be influenced by and influence terrain/critters/items

This games gets better if the world is inhabited by spirits. There are spirits in the world, and these have wishes. Going against the wishes of the spirits can lead to bad luck/curses. Fulfilling the wishes of the spirit will gain their favor and also grant boons like additional resources. Finding out what a spirit wants is very non-trivial and might take generations. Spirits have specific schedules when they reveal themselves. There are tools and skills that can help in detecting spirits or their mood.

There are  multiple spirits in a world, each with a different difficulty level. The easiest spirit is easy is already known at the start of the game. The next spirit is easy to find and also relatively easy to understand (which does not mean easy to please). There are more spirits that are harder to find/understand

Sprits can change how much space they occupy. In a relaxed state, they occupy a large area, but are not very visible/do not influence it much. In this state they sleep, or collect energy from the area. The amount of energy they collect depends on how well the area conforms to their wishes

Spirits can also reduce their size and this makes them more present. If they would focus their presence on the size of a human, they could project themselves as a ghost.

If something changes to the terrain when a spirit is sleeping/feeding, they can wake up.

## Spirit aspects

### Wishes

- Likes high energy (fast movement, water streaming, wind blowing, animals moving)
    - Dislikes slow movement, rest, things that are boring
- Likes calm (plants growing, slow movement. resting and meditation)
    - Dislikes fast movement/high energy
- Likes change: plants sprouting and dying, different animals, modifications to the terrain
    - Dislikes: stagnation
- Likes stagnation: things that are the same summer after summer, stone,
- Likes warmth: fire, midday sun
    - Dislikes: clouds, winter, night
- Likes cold: water, snow, windswept terrain
- Darkness: middle of forest, secluded areas
- Openness: grass fields
- Water: water, fish, rain



# Barriers to resource collection

## Terrain

Hard:

- River
- thicket
- mud field
- trees/forest
- lake
- mountains face

Soft (slows you down)

- Mud
- Underbrush
- Swamp

Stat related:

- uphill (requires extra stamina)
- brambles (costs health)
- desert (requires extra hydration)

These can be solved by a combination of:

- improving gear
- improving stats
- adding caches to improve logistics

## Logistics

Harvesting meaningful quantities of some resources requires terrain improvements and items.

- wheelbarrows for ore
- wagons for lumber

Each of these have different requirements for terrain.

- Wheelbarrows can't travel over underbrush, but wagons can. Both can't travel through mud.

## Metaphorical or literal seeds

Some things cannot be solved in one year. But you can plant/place something that will have effect over time, or the next year.

For example you can plant seeds to grow crops/trees/... It should not be a farming sim with a wide variety of crops you can harvest. But maybe you can plant some seeds to lure animals or achieve something else like grow in mud to make it sturdier to walk on.

Another idea is to place items that a spirit will hate or like, and you can see the result of that. In that way you can figure out what type of spirit lives somewhere (or if a spirit lives close-by). This could be a longer-term research project.

You could also build dams for rivers or create new rivers that will have effect next year.