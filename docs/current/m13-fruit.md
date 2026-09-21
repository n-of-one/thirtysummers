# M13: fruit

The experiment that replaces meals: eating a fruit makes the character
faster for a short while. Fruit is still winter food, so every fruit eaten
is one not stored at camp, and the choice each time is now or winter. The
speed is for a moment that matters, such as getting a full pack home before
the clock stops.

**Depends on** M10: the winter that gives banked fruit its value, so eating
one costs something.

## Steps

1. **Eating.** A key, or the interact key on a carried fruit, takes one
   fruit from the pack and starts a boost of `FRUIT_BOOST_SEC` at
   `FRUIT_BOOST_MUL` times walking speed, on every terrain. Eating during a
   boost extends it rather than stacking it.
2. **Showing it.** The walk animation runs faster with the stride, which it
   does already by distance. A small readout of the seconds left.
3. **No cap, on purpose.** No meal count and no cooldown, so the test is
   whether the clock alone keeps fruit from becoming an exchange rate.

## Verification

- One fruit, one boost, the speed read back on grass and on mud.
- Eating twice extends, never doubles.
- Boosting into the last minute of a summer and banking at camp what would
  otherwise have been banked away.

## What the log should answer

- Was fruit eaten for a reason, or by habit?
- Did camp ever run short of fruit for winter because of it? If a
  summer's reach becomes "how much fruit did I bring", a meal count or
  diminishing returns per fruit is the fallback, as
  [../archive/decided-against.md](../archive/decided-against.md) records.
