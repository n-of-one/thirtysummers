# M8: the body

Summer as [../design/summer.md](../design/summer.md) describes it, on the
existing maps. No new terrain, no winter. Playable as one summer, then next
summer, as now.

**Depends on** the chores in [PLAN.md](PLAN.md). Nothing else.

**Replaces** the discovery test's stat model: sprint, stamina that recovers
per second, water carried as a resource, the fruit cooldown. It is recorded
in [../archive/decided-against.md](../archive/decided-against.md).

## Steps

1. **No sprint.** Remove the sprint input, `SPRINT_MULTIPLIER`,
   `STAMINA_SPRINT`, `SPRINT_MIN_STAMINA` and the `sprinting` flag. Raise
   `WALK_SPEED` a little, tuned in play. `WALK_SPEED 7` and
   `DIFFICULT_SPEED_MUL 0.4` were hand-tuned in play, so change them on
   purpose. The walk animation loses nothing.
2. **Stamina as a budget.** `Stats` stops recovering. `STAMINA_ROUGH_TILE`
   is charged when the player's tile changes to a difficult one, read off
   the tick's move rather than off the keys, and `STAMINA_CUT`,
   `STAMINA_BUILD` when a hold completes. Max stamina comes from a per-year
   table `MAX_STAMINA_BY_YEAR` (60, 65, 70, 75, 80). At zero the interact
   query refuses cut and build with a new `BlockedReason` `exhausted`, and
   the move code refuses to enter a difficult tile, which is a new refusal
   the prompt has to say. Eating still works.
3. **Meals.** `MEALS_BY_YEAR` (2 for years 1 to 5), `MEAL_STAMINA` 10, no
   cooldown. `FULL_STOMACH_SEC` goes. The HUD shows meals left.
4. **Hydration as a leash.** Water is no longer a resource: the `water`
   kind and its glyph go, and a drinking spot is a tile property instead:
   any tile adjacent to stream, plus spring tiles (new terrain `spring`,
   glyph `o`, passable, easy). Drinking is a short hold on the interact key
   when in reach of one, to full. Below `HYDRATION_FOG_THRESHOLD` the
   renderer draws a fog vignette whose radius shrinks with hydration. At
   zero the view is a few tiles. Fog is the only consequence.
5. **The end of a summer.** What is carried when the clock stops is banked.
   `world.awayAtEnd` records whether the player was out of reach of camp,
   for winter. A button at camp ends the summer early.
6. **The stamina bar under the player.** Drawn by the prop layer or the
   marker as a thin bar at the feet, and the cost of the tile ahead or the
   hold in reach shown on the prompt ("wade, 2 stamina").
7. **Config and docs.** Every new number marked. Delete the "Stats" section
   of [../rationale/technical.md](../rationale/technical.md), which
   describes the model this milestone removes, and write down what replaces
   it and why. Update the controls in
   [../development.md](../development.md).

## Verification

- Stamina over a simulated summer matches the per-tile and per-action sums
  exactly.
- A full bar is refused nothing. An empty one is refused rough ground and
  tools, with the right reason.
- Two meals, then a refusal.
- Hydration reaches zero at the drain rate, and the fog radius follows it.
- Drinking at a bank and at a spring fills the bar.
- A summer ended away from camp banks the pack and flags the world.
- One summer played on `?map=b` over the protocol, walked not teleported,
  with the numbers read back.
