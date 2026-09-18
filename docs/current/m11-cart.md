# M11: the cart

The logistics experiment, last because it is the one most likely to be cut
by the log. The question it asks is in [five-summers.md](five-summers.md):
does cutting a road so a cart can run feel like play, or like hauling?

**Depends on** M9: the cache, and the layout's summer-3 row, which already
puts a cart route on every map and holds it to needing a cut.
M10: the shop, which sells the cart in winter 2 for logs.

## Steps

1. **A `cart` entity in `sim/`.** A position, pushed by walking into it. It
   moves only onto grass and bridge and holds any amount. Banking into it
   and out of it is the interact key when in reach.
2. **Rendering** as a prop that moves, depth-sorted with the player.
3. **The route as it is walked.** The layout already lays one and the rows
   already hold it to needing a cut, so what is left is whether the route's
   width and the hedge on it are right with a cart actually on them.

## Verification

- The cart refuses mud, underbrush and thicket.
- It follows a push, and keeps its contents across the summer.
- One summer over the protocol, hauling a cache home.
