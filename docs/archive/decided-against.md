# Decided against

What we decided not to do, with the reason in a line, so it does not come
back as a new idea. Anything here can be reopened, but on purpose, with the
reason it was dropped in view.

Ideas that are only waiting are in [../design/ideas.md](../design/ideas.md).
Technical alternatives that were tried and dropped, such as other engines,
the animated river art or snapping the simulation position, are in
[../rationale/technical.md](../rationale/technical.md), next to what was
chosen instead.

## Summer

- **Sprint.** A held key that makes you faster is a key held all the time.
  Speed comes from changing the map.
- **Stamina that drains and recovers per second.** The original rules were
  1%/s on rough ground, 5%/s sprinting, +0.2%/s walking easy ground, and
  +1%/s standing while watered or +0.5%/s parched. Stamina is now a budget
  spent per tile and per action, so it asks what to spend on, not how long
  to stand still. The code runs the old rates until M8.
- **A full-stomach cooldown after eating**, with fruit restoring 20%. It was
  the one real irritation of the discovery test. Meals are counted instead.
- **Uncapped eating.** It turns fruit into an exchange rate: fruit buys
  stamina, stamina buys cuts, cuts buy sellables, sellables buy fruit. A
  thick wall becomes "how much fruit did I bring", and the age curve
  disappears.
- **Capping eating by price alone, or by making eating cost clock time.**
  Weighed against a meal count and dropped. Diminishing returns per fruit is
  the fallback if a count feels like a rule that has to be explained.
- **Carried water**, as a node in the backpack or in a flask. Hydration's job
  is to tie the character to a place, and carried water cuts that tie.
- **Hydration as gates**, where stamina stopped recovering below 50% and
  drained at 0%. Hydration now does one thing, the fog.
- **Camp restoring stamina.** Only fruit restores it.
- **Gold in the ground.** Gold is currency. Ore, shells and feathers are what
  sells for it.
- **Tool tiers and tool wear.** One tier, no wear. Gear changes costs
  instead.
- **Health on built things.** Wear removes a tile, so repair is half the work
  of building and no number needs tracking.
- **Fruit surviving winter in a cache.** It rots. Bank it or eat it.
- **Regions as biomes**, with palette swaps. Three biomes forty tiles apart
  look like a theme park, and a test could not say whether the opening or
  the art felt good. A region is a resource field on the same grass.
- **A third stat that reacts to time or effort.** A third stat, if it comes,
  reacts to place.

## Winter and the economy

- **Carrying gold across winters, or keeping goods for a better price.**
  Nothing is stockpiled. What is kept is kept for a use, and spare gold goes
  to the family, which gives surplus a meaning.
- **A winter clock.** The first notes gave the night about five minutes.
  Winter has no clock and ends when the player starts the next summer.
- **Upkeep that grows by itself, or that family levels raise.** It rises
  only when a structure is finished.
- **Missing upkeep ending the run.** It costs ten max stamina for one summer
  and nothing more.
- **A list of what broke over winter.** The player meets the damage in play.

## The map arc and generations

- **Structures that pay out as multipliers.** A structure pays in new play:
  new resources, tools that break new barriers.
- **Wealth as a structure.** Town strength grows only through structures and
  family strength from spare gold. The two are kept apart.
- **A map that ends because it is spent**, and **reaching the far edge on
  foot as the exit.** A map ends with the road to the next valley and a town
  strong enough to follow it.
- **An heir who refuses the map.** An heir stays until the map is done.
- **A generation cap.** The first map is relaxed, so new players learn at
  their own pace. Challenge maps with a time limit may come later, never
  first.
- **Structures tied to generations**, one per life. A structure pays the
  moment it is done. A strong life builds two, a weak one takes two lives
  for one.
- **Enforced phases, one domain per generation**, or a chain of dependent
  structures as the only progression. Steps alone make every generation feel
  the same. Domains have a natural order that nothing enforces.
- **Inheritance as a chest of objects.** The camp puzzle replaced it.
- **Two generations on the map at once.** Too distracting during a summer.
  The spring walk to the heir's camp keeps the good part.
- **The exit as a final exam behind every barrier.** The road is enough.
- **Stacked maps as z-levels.** It clashes with biomes.

## Words

- **Day and night** for the two phases of a year. They are summer and
  winter. Also dropped: "rest of the year", which has no code or HUD form;
  gather and trade, which drops summer from a game called thirtysummers; and
  camp, which clashes with the camp tile.
- **Monument**, retired for structure. Works, landmark and trade were not
  adopted either.
- **Floor, budget, leash, shelf.** Game-design words. The game says upkeep,
  stamina, hydration, shop.
- **Hero, main character** for the character.

## Process

- **A shareable build on itch.io (M7).** Abandoned 8 Sep 2026, after the
  verdict. There are no outside testers until the concept is fleshed out.
  The half-finished work is on branch `itch-publish-1`.
- **A test map authored from scratch.** It gives one blind play per map and
  none of the generator's feel. Test maps are generated dumps edited by
  hand.
