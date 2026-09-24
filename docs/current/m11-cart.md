# M11: the cart

Summer 4 of [five-summers.md](five-summers.md): the cart, the field it is
for, and the trail its route wears into. The question it asks: does making a
road so a cart can run feel like play, or like hauling?

**Being rethought.** Trails wear the road by walking now, so M10.2 took out
the grass the layout laid from camp to the feather field and the row that held
a cart route to needing a cut. This file is what the cart was before that, and
is to be rewritten before it is built.

**Depends on** M10: the cart bought in the shop at family level 2, the shell
field behind the copse, and shells that do not come back, so summer 4 needs a
field further out.

## Steps

1. **A `cart` in `sim/`.** A position, pushed by walking into it. It stores
   like camp, with a press to put the whole pack in and a hold for the
   transfer panel, and keeps everything over a winter but fruit. It moves
   at walking speed on grass, bridge and planks, at `CART_ROUGH_SPEED_MUL`
   on underbrush, and not at all into mud or thicket. While it is pushed,
   hydration drains `CART_HYDRATION_MUL` times as fast.
2. **Rendering** as a prop that moves, depth-sorted with the player, drawn
   to the one-art-pixel rule.
3. **The cart wears the same trail.** Trails are built in
   M10.2, worn by walking during the summer, and are described in
   [../design/summer.md](../design/summer.md). A pushed cart
   adds to the same wear count, faster than feet, so a route the cart is pushed
   along often becomes its road. Nothing new is needed here but the pusher.
4. **The field for summer 4.** A second shell field further out along the
   route, larger than the first, through underbrush the cart crawls over,
   and past it, seen and out of reach, a mud flat with the dry pocket
   beyond, which M12 fills. Rows for both.

## Verification

- The cart refuses mud and thicket, crawls on underbrush at the configured
  speed, and runs at walking speed on grass and bridge, all read back.
- It follows a push, keeps its contents across the summer and the winter
  except fruit, and hydration drains faster while pushing.
- A pushed cart wears a tile faster than feet do, and a tile crossed once is
  unchanged.
- One summer over the protocol, hauling a parked cart home.
