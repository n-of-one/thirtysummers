# M11: the cart

Summer 4 of [five-summers.md](five-summers.md): the cart, the field it is
for, and the trail its route wears in. The question it asks: does making a
road for a cart feel like play, or like hauling?

**Being rethought.** Walking wears trails now, so M10.2 removed the grass
the layout laid from camp to the feather field, together with the check that
a cart route there needed a cut. This file describes the cart as it was
planned before that, and it has to be rewritten before the cart is built.

**Depends on** M10: the cart bought in the shop at family level 2, the shell
field behind the copse, and shells that do not come back, so summer 4 needs
a field further out.

## Steps

1. **A `cart` in `sim/`.** It has a position and moves when the character
   walks into it. It stores like camp: a press puts the whole pack in, and a
   long press opens the transfer panel. Over a winter it keeps everything
   except fruit. It moves at walking speed on grass, bridges and planks, at
   `CART_ROUGH_SPEED_MUL` on underbrush, and not at all into mud or thicket.
   While it is being pushed, hydration drains `CART_HYDRATION_MUL` times as
   fast.
2. **Rendering.** The cart is drawn as a moving prop, depth-sorted with the
   player, and follows the one-art-pixel rule.
3. **The cart wears the same trail.** Trails were built in M10.2: walking
   wears them during the summer, as
   [../design/summer.md](../design/summer.md) describes. A pushed cart adds
   to the same wear count, faster than feet do, so a route the cart is often
   pushed along becomes its road. The only new part is counting the cart as
   something that walks.
4. **The field for summer 4.** A second shell field, further out along the
   route and larger than the first, through underbrush the cart crawls over.
   Past it, visible but out of reach, is a mud flat with the dry pocket
   beyond it, which M12 fills. Both get checks in `worldgen/rows.ts`.

## Verification

- The cart refuses mud and thicket, crawls on underbrush at the configured
  speed, and runs at walking speed on grass and bridges, all read back.
- It follows a push, keeps its contents through the summer and the winter
  except fruit, and hydration drains faster while pushing.
- A pushed cart wears a tile faster than feet do, and a tile crossed once is
  unchanged.
- One summer played over the protocol, pushing a parked cart home.
