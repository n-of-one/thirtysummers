# Development

How to run, test, debug and measure the game. How the code is shaped is in
[architecture.md](architecture.md).

## Commands

```
npm run dev         # Vite dev server on :5173
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
npm run build
npm run map         # ASCII dump of a generated map, for eyeballing worldgen
npm run map -- 42 > public/maps/x.txt   # ...and the same dump as a playable map
npm run map:check public/maps/*.txt     # does each edited map still hold the chain?
```

`npm run map` writes the map to stdout and its statistics to stderr, so a
redirected dump is a map the game can load. The format is one character per
tile. Its legend is in the dump's footer.

## URL parameters

- `?map=<name>` plays `public/maps/<name>.txt` instead of a generated world.
- `?seed=<n>` picks the generated world.
- `?pack=placeholder` runs without the paid art.
- `?debug=1` starts with the debug overlay open.

## The art

The Minifantasy packs are a paid licence and are never committed.
[../public/assets/README.md](../public/assets/README.md) says where to buy
them and where to unzip them, into `public/assets/minifantasy/`, which is
gitignored. Without them the code-drawn placeholder pack draws everything.
`npm run dev` logs which pack loaded.

## Controls

WASD or arrows to move, Shift to sprint, E or Space to gather, cut, build and
bank ore, F to eat, R to drink. M8 removes sprint and R, and drinking becomes
a hold on E at the water.

## The debug overlay

Press `` ` `` in the running game, or open with `?debug=1`. It has a seed box
with regenerate (`[` and `]` step the seed), a 1x–10x time scale, a tile
grid, a stat freeze, click-to-teleport, and a fixed-width readout of the
numbers the frame was drawn with. Regenerating reseeds in place. Keys typed
into the panel do not move the player.

## Measuring the game

Claims about how the game looks or behaves are measured, not asserted. Drive
the running game over the Chrome DevTools Protocol and read numbers back.
`window.__game` is always there to measure from. Walk with real keystrokes
when movement is what is being checked, not teleports. Prove a check is
non-vacuous by reverting the fix and watching it fail.

## What must keep passing

- `npm run typecheck` is clean, with no `any` in `sim/`.
- `npm run test` passes. It covers worldgen determinism and shape, terrain
  distribution, the autotile table, collision, the camera, depth sorting,
  pixel snapping, the fixed-step clock under a stall, the scroll window,
  both layers against the stub pack, the stat rules over simulated time, the
  backpack, the HUD model, the map file round trip and every way it refuses
  a bad one, every action in the loop and every way it refuses, next summer,
  and the debug overlay's arithmetic.
- `npm run map:check public/maps/*.txt` passes on every shipped map. Run it
  after editing one by hand.
- `?pack=placeholder` still draws every terrain.
- 60fps with headroom at 128×128.
