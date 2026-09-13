# Summer

What one summer is: the body, the map's barriers, what is gathered and how
it gets home. Most of this is a first guess to be played, not a verdict,
and the numbers are for the first five summers of a life.

## The shape

A summer is a clock. It runs from a clean slate at camp, both bars full,
to a hard stop wherever the character stands. Its length follows age:
about five minutes at 15 (summer 1), fifteen at the physical peak from summer 10 to
20, back down toward five by 45 (summer 30). Whatever is carried when the
clock stops is banked as if brought home, so the last minute is never
wasted: a final trip out is fine. Ending away from camp costs extra gold
in winter, as compensation for the fetching. A summer can also be ended
early from camp, with a button, once there is nothing left worth doing.

There is no sprint. Speed comes from the map: a cut path, a bridge, a
route the cart can run. A full backpack may slow the walk; that is a
cheap experiment, not a rule yet.

## The body

Two bars, and they answer different questions.

**Hydration.** It drains at a constant rate whatever the
character does, and it is refilled only at drinking spots: springs, and
the banks of streams, many on both sides of any stream, all at one speed.
Water is never carried. When hydration is low the view narrows into fog;
if fog alone is not enough of a consequence, slowness comes after it.
Hydration answers *where*: how far from water the character dares to
work. Near camp, inside the half circle of the first stream, it is no
concern. Beyond, distance from water is a barrier in its own right, and a
stream in a far part of the map is a relief.

**Stamina.** It does not recover. It is spent per tile of
rough ground entered (mud, underbrush) and per tool action completed (a
cut, a felling, a bridge tile), so a path lowers next year's cost exactly.
At zero, no stamina-costing action is allowed; walking on easy ground and
eating still work. Max stamina follows the age curve: about 60 at summer 1,
100 from 10 to 20, back toward 60 by 30. Stamina answers *what to spend
on*. The bar is worth drawing under the character as a constant reminder
of what the summer can still do, and the cost of a tile or a hold is
worth showing before it is paid.

**Meals.** Fruit is the only refill. A summer allows a number of meals
that follows age: two in summers 1 to 5, each restoring 10. No cooldown.
Fruit is also winter food, so every fruit eaten is one not in the store,
and the choice each time is now or winter.

The parent's grave, once it exists, raises max stamina by one on a visit.
It restores nothing. Camp restores nothing.

## Barriers and keys

A barrier is anything the character cannot afford yet, and there are
four currencies it can be short in: stamina (a thick thing), a tool
(the axe, bought), materials (a bridge needs sticks and vines from behind
another barrier), and hydration (a place too far from water until a well
stands). Thickness is the main dial: a thicket 3 tiles deep is a summer-1
job; the same thicket 12 deep, at a few points a tile, is a two-summer
project, and cuts persist, so the second summer starts where the first
stopped.

The barriers of the first five summers:

- **Mud.** A soft barrier that just slows you down.
- **Thicket.** A wall of brambles, cut with the knife a tile at a time.
- **Stream.** Bridged with planks, a tile at a time, from sticks and
  vines. The first stream is a half circle around camp.
- **Saplings.** A copse of young trees, felled with the axe for logs.
  Trees proper, full grown, are a wall no tool in this prototype fells.
- **Distance from water.** Crossed by digging a well.

Rock is the border of the map and nothing crosses it.

## What is gathered

Resources form a ladder, and a rung is distance behind barriers: near
camp sells for nothing or one, each barrier out roughly doubles it. Gold
is currency, never a thing in the ground. Six kinds for the first five
summers:

| Kind | Where | Use |
|---|---|---|
| fruit | near camp and in fields | a meal now, or winter food |
| feather | near camp | sells, nothing else |
| stick | the sapling stand behind thicket | bridge material, or sells for one |
| vine | the mud pocket | bridge material, or sells for one |
| ore | across the stream | sells |
| log | felled saplings | cart and well material, or sells |
| shell | the dry pocket, far from water | sells, the top of the ladder |

Pure sellables are ordinary things, feathers and shells, one per barrier
run. Kinds with a use compete with their price: a stick that sells for one
and builds a bridge is a choice in summer one, a log is a choice for
years. No rarity for now; it may come once respawning is designed.

## Tools and gear

The knife is owned from the start. Every other tool is bought in winter
from the town, and some may need particular things brought back so the
town can make them, so gold is not the whole answer. One tier of tools,
no wear. Gear changes costs rather than adding tools: boots or clothes
that lower the stamina cost of a terrain, a bigger backpack that lowers
max stamina but adds slots.

## Improvements

- **Cut** thicket, hold on a tile with the knife.
- **Bridge** a stream tile with planks.
- **Well**, dug where there is no water, from logs and sticks: a spring
  for the family, so the family can work further from any stream.
- **Cache**, a box in the field: bank there, fetch later. It holds any
  amount. Fruit may be left in one but does not survive winter there.

Built things wear. A bridge loses a tile over a winter rather than
carrying a health number, so repair is half the work of building.

## Getting it home

The backpack is the limit, ten slots, bulky things taking two. The store
at camp holds any amount. What is banked at camp is sold in winter; what
is still carried is also banked. Fruit banked is winter food. If you are 
not in camp when summer ends, you have to pay an additional cost (gold?)
during winter.

The cart is the logistics experiment: it holds any amount, is pushed, and
runs only on grass and bridge, so the route from a cache to camp has to
be cut continuously and a route across mud has no answer until gravel
exists. Whether making a road so a cart can run feels like play or like
hauling is the question the first prototype asks.

## The first five summers

The spec for the test maps: each summer opens one thing and gains one key,
and each barrier is short in exactly one currency the previous summer
supplied. Max stamina from the age curve.

| Summer | Stamina | Opens | Key gained in the winter before | Short in |
|---|---|---|---|---|
| 1 | 60 | the near ring: thin thicket to the vine and stick pockets, mud; bridge the half-circle stream | none; this summer teaches the rules | nothing |
| 2 | 65 | across the stream: the ore field, and a sapling copse hiding a second field | the axe, paid in gold and something carried home | a tool |
| 3 | 70 | the far field worked in bulk: a cache there, a cut route wide enough for the cart | the cart, paid in logs | logistics |
| 4 | 75 | the dry pocket, far from water, where the shells are | the well, from logs and sticks | hydration |
| 5 | 80 | the thick wall begun in summer 4, twelve tiles into the last pocket | none; the summer is the harvest of everything built | stamina |

## Open

- Fruit is the only refill and it grows near camp, so a far field offers
  nothing for the body, only for the ledger, and a character who runs the
  stamina out far from home with no fruit in the pack can only walk back.
  A rarer refill that grows only far out, honey or nuts, would give far
  fields a body reason and a way to recover out there. Add it only if
  play shows two carried fruit are not enough to make far trips feel safe
  and worth it.
- How much extra gold ending the summer away from camp costs.
- Whether fog alone is enough when dry.
- Whether a full pack should slow the walk.
