# The pack

What the backpack is for, and the two ways out of a full one: camp as the
first cache, and dropping what you do not want. It comes before M10 because
a full pack of build material is a dead end today, and that blocks the map
experiments the winter milestone is waiting on.

**Depends on** M9: the cache, the build menu, and the seven-resource table.

## The hole it closes

Three things add up to a run-level dead end, not an annoyance.

- Camp does not take build material. `bank()` in `sim/world.ts` sells
  feathers, ore and shells, moves fruit into the store, and leaves sticks,
  vines and logs in the pack on purpose.
- The pack survives the winter. `startSummer` keeps it exactly as it is, so
  a pack full of vines opens the next summer full of vines.
- The only way to be rid of them is to spend them, and a cache costs three
  sticks. A pack with no sticks in it cannot even build the thing that would
  empty it.

So a player who fills ten slots with vines has no way back, this summer or
any summer after it, and gathers nothing else for the rest of the run.

## Where things are kept

One rule, three tiers, no exceptions.

- **The ground** keeps things until spring. Nothing survives a winter there,
  whatever kind it is.
- **A cache** keeps everything but fruit, which rots wherever it is left.
- **Camp** keeps everything, and is the only place a fruit becomes winter
  food.

This replaces the special case in
[../design/summer.md](../design/summer.md), which says fruit may be left in
a cache and does not survive winter there. The tiers say the same thing
without naming fruit twice, and they read as physics rather than as rules: a
heap in a field is scattered by a year of rain and animals, a box is a box,
a fruit is a fruit anywhere.

## Camp as the first cache

Camp becomes a cache that is already built and that also sells. Resources go
in and come out, and the sellables among them turn into gold on the way in.
The cache stops being a different concept and becomes the same one, built
where the work is instead of given at the centre.

- Camp accepts every kind, in and out. Sticks, vines and logs stay in the
  store over winter, where winter's keep-or-sell question already covers
  them.
- Pure sellables, feathers and ore and shells, are sold the moment they
  reach camp, as they are now. There is no decision in them, so they are
  never a line in the panel. At a cache they are ordinary items, because a
  cache cannot sell.
- Fruit may be taken back out, with no cap and no cooldown. Every fruit
  taken is one not in the store, which is the choice
  [../design/summer.md](../design/summer.md) already asks.
- Tapping the interact key at camp banks everything camp will take, as it
  does today, so the common arrival is still one press. Holding it opens the
  transfer panel, the way holding opens every other choice.
- The same panel serves a cache. One thing to learn, three places it works:
  camp, a cache, and, through the drop keys below, the ground.

What this costs the cache is that its value is now distance alone: a store
where the work is. That is what three sticks buys, and the cost stays as it
is.

## Dropping

The panel is for unloading on purpose, at a place that keeps things. Being
full in a field with nothing to spend on is a different problem, and it
needs one key, not a screen.

- The pack readout names a **selected kind**, always, not only when the pack
  is full.
- `DROP_KEY` drops every item of the selected kind. `DROP_SWITCH_KEY` cycles
  through the kinds the pack holds. Both work wherever the character stands;
  the full-pack prompt is a reminder of keys that already exist, not a mode
  with keys of its own.
- The prompt names the kind and the count: `Backpack full - X: drop 6 vine .
  C: switch`. The count is the whole safeguard against throwing six winter
  meals on the grass, and it is enough, because they can be picked back up.
- When the selected kind runs out, the selection falls to whichever kind now
  takes the most slots. It is never undefined and never hidden.
- A dropped item lands one to a tile. The rest spill outward by ring,
  skipping water, thicket, the camp tile, nodes, springs, wells, caches and
  tiles that already hold something dropped. One item per tile keeps the
  scatter honest about how much was carried. If no free tile is found within
  `DROP_SPILL_RINGS`, the drop is refused with a line saying so.
- Picking one up is a press, with no hold and no bar. Gathering is prying a
  vine out of the mud; picking up is bending down. The prompt says so:
  `Press E to pick up` against `Hold E to gather`.
- Dropped items are drawn lying flat and small where a node stands upright,
  so a dropped vine is never mistaken for a vine that grew there.
- Winter clears the ground, and ending a summer away from camp banks what is
  carried, never what was dropped.

## Steps

1. **Camp takes everything.** `bank()` sells what sells and puts the rest in
   the store. The `deposited` event and the summary grow a count for what
   was stored rather than sold.
2. **The transfer panel**, in `ui/`, against camp or a cache: the pack on one
   side, the store on the other, a cursor over the kinds, one key to move
   one and a modifier to move all, free slots live and a take refused
   politely when a bulky log will not fit. The clock runs while it is open,
   as it does for the build menu.
3. **Dropped items in `sim/`.** A list on the world, like the caches: a
   kind and a tile. The ring search that places them, the drop of a whole
   kind, and picking one up as a tap. New `dropped` and `pickedUp` events.
4. **The selected kind**, in the world and on the HUD, with the two keys and
   the full-pack prompt.
5. **Rendering**, through `render/placements.ts`, which already walks
   springs, wells and caches: dropped items depth-sorted with everything
   else and drawn flat.
6. **Winter clears them.** `startSummer` empties the list, and the pack, the
   store and the caches carry on as they do.

Every new number is a `[GUESS]` in `config.ts`: `DROP_KEY`, `DROP_SWITCH_KEY`,
`DROP_SPILL_RINGS`, and the panel's keys.

## Verification

Measured over the protocol, each one proved non-vacuous by reverting the
change and watching it fail.

- A pack of ten vines at camp banks to zero carried, and the ten come back
  out of the store one kind at a time.
- Fruit taken out of the store leaves the store's count lower by what was
  taken.
- Ore carried to camp is gold, never a line in the panel; ore put in a cache
  comes out of it as ore.
- A drop of six vines leaves six tiles each holding one, none of them on
  water, a node or a cache, and picking them up returns the pack to six.
- A pack full of vines standing on fruit: the prompt names the count, the
  drop key empties the vines, and the fruit is harvested with the same E.
- A summer ended away from camp banks what is carried and leaves what was
  dropped; the next summer starts with the ground clear and the store and
  the caches intact.

## When it is accepted

The mechanics move into the design docs, as
[../../CLAUDE.md](../../CLAUDE.md) says: the three tiers and the drop into
[../design/summer.md](../design/summer.md), which loses its fruit-in-a-cache
line and its rule that camp takes only what it sells; what the store holds
over winter into [../design/winter.md](../design/winter.md); and into
[../rationale/design.md](../rationale/design.md) the two reasons worth
keeping, that refusing a drop is unthematic in a game about carrying things,
and that picking up is not harvesting.
