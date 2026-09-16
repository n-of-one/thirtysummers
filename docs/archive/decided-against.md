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

- **Sprint as a held key.** A key that makes you faster is a key held all
  the time. Speed comes from changing the map. A burst bought with a fruit
  is a different thing and is M12's experiment.
- **Stamina**, in both forms. As a rate, 1%/s on rough ground and recovering
  while standing, it asked how long to wait, which is not a decision. As a
  budget spent per rough tile and per cut, it could not be planned, because
  underbrush is a third to a half of every map and nobody sums a texture by
  eye, and at zero it stopped the legs, a second hard stop beside the clock.
  Time is the budget now: rough ground is slow and a cut is a hold.
- **Stamina per tool**, as tools that wear with use, so a bridge spends the
  hammer. It is stamina cut into pieces and adds nothing the clock does
  not.
- **Meals**, a counted number of fruit a summer, each refilling stamina.
  They went with stamina. The concern they answered stays: uncapped eating
  can turn fruit into an exchange rate, where a summer's reach is how much
  fruit was brought. A meal count or diminishing returns per fruit is the
  fallback if the fruit burst shows that.
- **A full-stomach cooldown after eating.** It was the one real irritation
  of the discovery test.
- **Springs as pools apart from the stream.** One-tile pools two tiles from
  the water, so the drink and the bridge never shared a key. They looked
  artificial and read as a thing beside the stream rather than part of it.
  Drinking at the bank, at spots marked by reeds, came back on purpose: the
  hydration threshold that was the objection to it had been in the game
  since M8 anyway, for a spring beside a thicket.
- **A dawn at the start of a summer**, the dusk in reverse. Only the evening
  means something: it is the clock running out.
- **Carried water**, as a node in the backpack or in a flask. Hydration's job
  is to tie the character to a place, and carried water cuts that tie.
- **Hydration as gates**, where low hydration slowed or stopped something
  else. Hydration does one thing, the fog.
- **Camp restoring anything.** There is nothing to restore.
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
- **A second stat that reacts to time or effort.** It repeats the clock. A
  second stat, if it comes, reacts to place.

## Winter and the economy

- **Carrying gold across winters, or keeping goods for a better price.**
  Nothing is stockpiled. What is kept is kept for a use, and spare gold goes
  to the family, which gives surplus a meaning.
- **A winter clock.** The first notes gave the night about five minutes.
  Winter has no clock and ends when the player starts the next summer.
- **Upkeep that grows by itself, or that family levels raise.** It rises
  only when a structure is finished.
- **Missing upkeep ending the run.** It costs one tired summer, with longer
  holds and slower mud, and nothing more.
- **Missing upkeep slowing the walk on easy ground.** The walk is the part
  of a summer that is already routing. The penalty lands on the work.
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
  hydration, shop.
- **Hero, main character** for the character.

## Process

- **A shareable build on itch.io (M7).** Abandoned 8 Sep 2026, after the
  verdict. There are no outside testers until the concept is fleshed out.
  The half-finished work is on branch `itch-publish-1`.
- **A test map authored from scratch.** It gives one blind play per map and
  none of the generator's feel. Test maps are generated dumps edited by
  hand.
