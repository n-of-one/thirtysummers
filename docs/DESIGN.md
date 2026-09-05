# 2d collect/explore — design doc

> The source of truth for what the game is. [PLAN.md](PLAN.md) is downstream of
> it, and where the two disagree, this one wins.

A top down 2d game where you collect resources from the map. It's a browser game,
for pc. It will have multiple levels of terrain (z-levels) but we will start with
just a flat map. This is a prototype to get a feel for the result.

## Concept

Alternate cycles of collecting resources (day) and processing them (night).
Improve the map to collect more and better resources.

## Core game loop

- Collect resources from a map during the day while avoiding obstacles and
  monsters
- Process/trade resources during the night to craft tools and items
- Improve map with items to make travel quicker and unlock new regions

## Extended game loop

- new areas have new resources and new challenges
- new resources allow items that unlock new interactions with existing areas
  - for instance allowing to fight/recruit monsters
- create items that allow harvesting new items (while having to solve new
  challenges)

## Meta game loop

- your character ages, you have only a limited number of days.
- You start young with beginner stats. At night you can use resources to improve
  your stats. But over time it will be harder to maintain your physical stats
- You have influence over the starter stats of your next generation

## Ideas

- play in generations. Each generation is a fresh slate, starting roughly from
  scratch but with some improvements left over from previous generations.

## Numbers (Stardew Valley equivalent)

- day = 15 minutes
- night = pause / no time limit (but let's say 5 minutes)
- each generation is 30 days.
  - 10 days to get to physical peak
  - 10 days of physical peak — get the work done
  - 10 days decline — prepare for next generation

## Mechanics

### Stats

**Stamina**

- Starts at 100%
- drops (1%/s) when you walk over difficult terrain or up a slope
- drops (5%/s) when you sprint
- restores slowly (0.2%/s) when walking over easy terrain
- restores slowly (0.3%/s) when standing still
- restored by eating food

**Hydration**

- start at 100%
- if below 50% your stamina does not recharge passively
- if 0% your stamina passively decreases

**Backpack**

- determines how many items you can hold: 10

### Cool downs

**Full stomach**

- Cannot eat any food until cool down is finished
- Starts when eating food, timer determined by food

## Prototype

- 1 level
- just one day
- resources:
  - fruit -> restores stamina (20%) cooldown full stomach: 60 seconds.
  - water -> restores hydration (20%)
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

