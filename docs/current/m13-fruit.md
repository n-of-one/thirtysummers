# M13: fruit

The experiment that replaces meals: eating a fruit makes the character
faster for a short while. Fruit is still winter food, so every fruit eaten
is one fewer stored at camp, and each time the choice is: eat it now, or
keep it for winter. The speed is for a moment that matters, such as getting
a full pack home before the clock stops.

**Depends on** M10, for the winter that gives stored fruit its value, so
eating one costs something.

## Steps

1. **Eating.** A key, or the action key on a carried fruit, takes one fruit
   from the pack and starts a boost of `FRUIT_BOOST_SEC` seconds at
   `FRUIT_BOOST_MUL` times walking speed, on every terrain. Eating during a
   boost makes it last longer; it does not make it faster.
2. **Showing it.** The walk animation already runs faster with the stride,
   because it is driven by distance. A small readout shows the seconds left.
3. **No cap, on purpose.** No meal count and no cooldown, so the test is
   whether the clock alone keeps fruit from becoming an exchange rate.
4. **The docs.** Move the idea from
   [../design/ideas.md](../design/ideas.md) into
   [../design/summer.md](../design/summer.md) under *Player status*.

## Verification

- One fruit gives one boost, with the speed read back on grass and on mud.
- Eating twice makes the boost last longer, never faster.
- A boost in the last minute of a summer gets the character to camp, so the
  load is stored at camp instead of away from it.

## What the log should answer

- Was fruit eaten for a reason, or by habit?
- Did camp ever run short of fruit for winter because of it? If how far a
  summer reaches becomes "how much fruit did I bring", the fallback is a
  meal count or less effect from each extra fruit, as
  [../archive/decided-against.md](../archive/decided-against.md) records.
