# M8: the body

Summer as [../design/summer.md](../design/summer.md) describes it, on the
existing maps. No new terrain, no winter. Playable as one summer, then next
summer, as now.

The milestone was built once with stamina as a budget and meals, and the
first playtest dropped both. What is left to do is the strip. Hydration, the
springs, the fog, the end of a summer and the camp button are built and
stay. The reasons are in [../rationale/design.md](../rationale/design.md)
under "One bar".

**Depends on** nothing. The chores are done.

**Replaces** the discovery test's stat model: sprint, stamina that recovers
per second, water carried as a resource, the fruit cooldown. It is recorded
in [../archive/decided-against.md](../archive/decided-against.md).

## Built and staying

- No sprint. `WALK_SPEED 8`, `DIFFICULT_SPEED_MUL 0.4`, both hand-tuned.
- Hydration as the one bar. Water is not a resource. Springs, placed near
  every stream and never touching one, drunk from beside with a short hold.
  Below `HYDRATION_FOG_THRESHOLD` the fog closes in. Fog is the only
  consequence.
- The end of a summer. What is carried when the clock stops is banked,
  `world.awayAtEnd` records whether the player was out of reach of camp,
  and a button at camp ends the summer early.

## Steps

1. **Strip stamina.** `Stats` loses the stamina field, `spend`, and the
   `exhausted` and rough-ground refusals. `MAX_STAMINA_BY_YEAR`,
   `STAMINA_ROUGH_TILE`, `STAMINA_CUT`, `STAMINA_BUILD`,
   `STAMINA_WARN_THRESHOLD`, the `STAMINA_BAR_*` constants and
   `src/render/staminaBar.ts` go. The corner bar, the bar at the feet and
   the cost on the prompt go with them. The freeze in the debug overlay
   freezes hydration and the clock only.
2. **Strip meals.** `MEALS_BY_YEAR`, `MEAL_STAMINA` and the eat key go.
   Fruit is picked, carried and banked like every other kind. The HUD's
   meal count goes.
3. **Rough ground is slow, never refused.** The tick's per-tile charge and
   `roughRefused` go. The look-ahead on the prompt goes with them unless the
   prompt still has something to say about the tile ahead.
4. **Config and docs.** No new numbers. The "Stats" section of
   [../rationale/technical.md](../rationale/technical.md) keeps the spring
   paragraphs and loses the four about stamina. The controls in
   [../development.md](../development.md) lose the eat key. Tests that
   asserted stamina sums, refusals and meal counts go, not get skipped.

## Verification

- Rough ground is entered at `DIFFICULT_SPEED_MUL` with nothing else, and
  the summer's clock is the only thing that runs down on its own besides
  hydration.
- Hydration reaches zero at the drain rate, and the fog radius follows it.
- Drinking beside a spring fills the bar, and the stream offers only the
  bridge.
- A summer ended away from camp banks the pack and flags the world.
- No `stamina`, `meal` or `eat` in `src/`, `tests/` or
  [../development.md](../development.md).
- One summer played on `?map=b` over the protocol, walked not teleported,
  with the numbers read back.
