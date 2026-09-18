# Development

How to run, test, debug and measure the game. How the code is shaped is in
[architecture.md](architecture.md).

## Commands

```
npm run dev         # Vite dev server on :5173
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
npm run build
npm run map         # ASCII dump of a seed laid out to the five-summer table
npm run map -- 42 > public/maps/x.txt   # ...and the same dump as a playable map
npm run map -- 42 --noise               # the landscape alone, with no layout on it
npm run map:check public/maps/*.txt     # does each map still hold the five-summer table?
```

`npm run map` writes the map to stdout and its statistics to stderr, so a
redirected dump is a map the game can load. Its statistics end with whether
the map holds every row of the table, and which rows it does not. The
landscape is the generator's; the barriers are stamped on by
`sim/worldgen/layout.ts`, which is also what `?seed=<n>` plays.
The format is one character per
tile. Its legend is in the dump's footer.

## URL parameters

- `?map=<name>` plays `public/maps/<name>.txt` instead of a generated world.
- `?seed=<n>` picks the generated world, laid out to the five-summer table.
- `?pack=placeholder` runs without the paid art.
- `?debug=1` starts with the debug overlay open.
- `?view=1280x720` draws the game in a logical view of that size instead
  of `VIEW_W × VIEW_H`, for trying view sizes in play.

## The art

The Minifantasy packs are a paid licence and are never committed.
[../public/assets/README.md](../public/assets/README.md) says where to buy
them and where to unzip them, into `public/assets/minifantasy/`, which is
gitignored. Without them the code-drawn placeholder pack draws everything.
`npm run dev` logs which pack loaded.

## Controls

WASD or arrows to move. E or Space to gather, cut, fell and bank; held beside
a spring or a well, to drink. At camp a press sells feathers, ore and shells
and stores fruit; sticks, vines and logs stay in the pack. At a cache a press
puts the whole pack in, and a press with an empty pack takes back what fits.

B opens the build menu: a bridge tile, a cache, a well, with what each costs.
The number keys choose, B or Esc closes, and Esc with the menu down puts the
build away again. E never builds on its own: with something chosen, holding E
builds it on the tile ahead, and the pill by the backpack says what is being
built. The clock runs while the menu is open, and a choice does not survive
the summer.

Cutting, felling and building act on the tile next to the player's in the
direction last walked, and only that tile. The axe, the cart and the well come
with summers 2, 3 and 4.
P pauses, and so does the window losing focus; any key resumes, and does
nothing else. At camp an "End summer" button under the player, or Q, ends the
summer early.
The Full screen button in the top right gives the view the whole screen.

## The debug overlay

Press `` ` `` in the running game, or open with `?debug=1`. It has a seed box
with regenerate (`[` and `]` step the seed), a 1x–10x time scale, a tile
grid, a freeze that holds hydration and the clock, click-to-teleport, and a
fixed-width readout of the numbers the frame was drawn with. Regenerating reseeds in place. Keys typed
into the panel do not move the player.

## Measuring the game

Claims about how the game looks or behaves are measured, not asserted. Drive
the running game over the Chrome DevTools Protocol and read numbers back.
`window.__game` is always there to measure from. Walk with real keystrokes
when movement is what is being checked, not teleports. Prove a check is
non-vacuous by reverting the fix and watching it fail.

Two background processes and a driver are the whole rig. Both write into
`tmp/`, which is gitignored, so nothing here touches the tree:

```
npm run dev -- --strictPort                     # :5173, in the background
google-chrome --headless=new --remote-debugging-port=9222 \
  --user-data-dir=tmp/chrome --window-size=1920,1080 \
  --enable-unsafe-swiftshader --use-angle=swiftshader about:blank
```

The driver is a throwaway script in `tmp/`. Node's own `WebSocket` and
`fetch` speak CDP, so it needs no dependency: read the target list from
`http://127.0.0.1:9222/json`, open its `webSocketDebuggerUrl`, then
`Runtime.evaluate` to read numbers out of `window.__game` and
`Input.dispatchKeyEvent` to press real keys. `Page.captureScreenshot` is how
a claim about what is on screen gets settled.

Headless runs at a handful of frames a second on software GL. That does not
change what is measured: the simulation is fixed-step, and a frame slower
than `MAX_FRAME_SEC` is the only thing that would lose time.

The rig's window size does not change what is measured either. The game is
drawn in a fixed logical view, so the camera, the fog and the HUD come out
the same in logical pixels whatever the window; only the scale and the bars
differ. `window.__game.view` has the scale, and
`Emulation.setDeviceMetricsOverride` resizes the window when the scaling
itself is what is being checked. A screenshot is in screen pixels, so divide
by `view.cssScale` and subtract the view's offset to get back to logical
ones.
## What must keep passing

- `npm run typecheck` is clean, with no `any` in `sim/`.
- `npm run test` passes. It covers worldgen determinism and shape, terrain
  distribution, the autotile table, collision, the camera, depth sorting,
  pixel snapping, the view's scale steps, the fixed-step clock under a
  stall, the scroll window,
  both layers against the stub pack, the stat rules over simulated time, the
  backpack's slots, the store and the cache, the HUD model with the last
  minute's notice, dusk and camp arrow, aiming, spring placement, the map
  file round trip with the resource table and wells and every way it
  refuses a bad one, every action in the loop and every way it refuses,
  felling, the well and the cache, the build menu's contents and what it
  refuses, the year table, next summer, the layout pass over several seeds
  against every row of the table, and the debug overlay's arithmetic.
  The menu's own markup has no test: there is no DOM in the test run, so it
  is checked over the protocol instead.
- `npm run map:check public/maps/*.txt` passes on every shipped map. Run it
  after editing one by hand.
- `?pack=placeholder` still draws every terrain.
- 60fps with headroom at 168×168.
