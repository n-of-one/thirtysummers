# 2d collect/explore — design doc

> The source of truth for what the game is. [PLAN.md](PLAN.md) is downstream of
> it, and where the two disagree, this one wins.
>
> Since 9 Sep 2026 the design is being rewritten one aspect at a time into
> [design/](design/README.md). A document there is newer than this file and
> wins over it; what has no document there yet is still described here.

A top down 2d game where you collect resources from the map. It's a browser game,
for pc. It will have multiple levels of terrain (z-levels) but we will start with
just a flat map. This is a prototype to get a feel for the result.

## Concept

Alternate cycles of collecting resources (summer) and processing them (winter).
Improve the map to collect more and better resources.

## Core game loop

- Collect resources from a map during the summer while avoiding obstacles and
  monsters
- Process/trade resources in winter to craft tools and items
- Improve map with items to make travel quicker and unlock new regions

## Extended game loop

- new areas have new resources and new challenges
- new resources allow items that unlock new interactions with existing areas
  - for instance allowing to fight/recruit monsters
- create items that allow harvesting new items (while having to solve new
  challenges)

## Meta game loop

- your character ages, you have only a limited number of summers.
- You start young with beginner stats. In winter you can use resources to improve
  your stats. But over time it will be harder to maintain your physical stats
- You have influence over the starter stats of your next generation

## Ideas

- play in generations. Each generation is a fresh slate, starting roughly from
  scratch but with some improvements left over from previous generations.

## Numbers (Stardew Valley equivalent)

- summer = 15 minutes
- winter = no clock, no time pressure; ends when the player starts the next summer
- each generation is 30 summers.
  - 10 summers to get to physical peak
  - 10 summers of physical peak — get the work done
  - 10 summers  decline — prepare for next generation

## Mechanics

### Stats

**Stamina**

- Starts at 100%
- drops (1%/s) when you walk over difficult terrain or up a slope
- drops (5%/s) when you sprint
- restores slowly (0.2%/s) when walking over easy terrain
- restores quickly (1%/s) when standing still and have hydration > 50%
- restores slowly (0.5%/s) when standing still and have hydration < 50%

**Hydration**

- start at 100%
- replenishes by drinking water
- drops by 1%/s

**Backpack**

- determines how many items you can hold: 10

### Cool downs

**Full stomach**

- Cannot eat any food until cool down is finished
- Starts when eating food, timer determined by food

## Prototype

- 1 level
- just 1 summers
- resources:
  - fruit -> restores stamina (20%) cooldown full stomach: 60 seconds.
  - water -> restores hydration (50%)
  - ore -> gives gold (1 gold/ore) = victory points in the prototype
- terrain:
  - grass (passable, easy terrain)
  - tree (impassible)
  - underbrush (passable, difficult terrain)
  - stream (impassible)
  - mud (passable, difficult terrain)
  - rock (impassible, edge of playable area)
- camp
  - you start here.
  - You can drop off ore here

## Map

Generated using perlin noise to place grass, trees and underbrush. Values higher
than a certain value are underbrush, and even higher values are forests where
trees are surrounded by underbrush.

## Prototype, phase 2: the discovery test

Decided 5 Sep 2026. See [BRAINSTORM.md](BRAINSTORM.md) for the reasoning.

The hypothesis under test: the player changes the map, and that opens
something they could see but not reach. One summer of 5 minutes on a map
loaded from a text file, a generated map edited by hand to hold the chain
below, then a button for another summer on the same map with every change
kept. No winter yet.

- new terrain:
  - thicket (impassable, cut with the knife)
- new resources:
  - vine -> rope material, grows in a field inside mud
  - stick -> from a stand of trees walled in by thicket
- tools and improvements, done in place by holding E:
  - knife (owned from the start) clears a thicket tile
  - bridge tile laid on the stream from sticks and rope, one tile at a time
- map structure:
  - the stream cuts the map in two and has no fords; gold only on the far side
  - the mud pocket with the vines, the tree stand behind thicket, and the
    stream form a chain: each barrier's reward is the key to the next
  - every field is visible from across its barrier
  - one cut path through thicket near camp is there from the start
  - no gold near camp
- summer = 5 minutes for year 1; summer length follows an age curve later,
  peaking at 15 minutes from year 10 to 20

