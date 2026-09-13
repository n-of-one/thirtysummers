# M11: the cart

The logistics experiment, last because it is the one most likely to be cut
by the log. The question it asks is in [five-summers.md](five-summers.md):
does cutting a road so a cart can run feel like play, or like hauling?

**Depends on** M9: the cache, and the map whose summer-3 row needs a cart.
M10: the shop, which sells the cart in winter 2 for logs.

## Steps

1. **A `cart` entity in `sim/`.** A position, pushed by walking into it. It
   moves only onto grass and bridge and holds any amount. Banking into it
   and out of it is the interact key when in reach.
2. **Rendering** as a prop that moves, depth-sorted with the player.
3. **A map whose summer-3 row needs it**: a cache across the stream, and a
   route that has to be cut wide enough.

## Verification

- The cart refuses mud, underbrush and thicket.
- It follows a push, and keeps its contents across the summer.
- One summer over the protocol, hauling a cache home.
