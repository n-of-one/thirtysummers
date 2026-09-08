# Maps

Play one with `?map=a` (through `e`). **Do not read the map files before playing
them** — the whole point is that the layout is unknown when you walk into it.
This file is safe: it says where they came from, not what is in them.

Each is a generated map, cropped to a summer-sized 64×64 and then edited by hand
to hold the chain the discovery test needs: a mud pocket of vines you can wade
to, a stand of trees walled in thicket, and gold only across the stream. The
generator's terrain is untouched apart from those edits and the removal of its
fords, so what a map feels like to walk across is still the generator's.

| file | seed |
|---|---|
| a | 1337 |
| b | 2026 |
| c | 31 |
| d | 555 |
| e | 808 |

**`d` is the one that ships.** `npm run build:itch` prunes every other map out
of the build, and `SHIPPED_MAP` in `src/config.ts` is where that is decided. `e`
stays unshipped on purpose: it is being kept unspoiled for a session I can sit
and watch, once the itch.io testers have had theirs.

`npm run map:check public/maps/*.txt` re-verifies the chain on all of them. It
is the thing to run after editing one by hand.

The format is one character per tile — the same dump `npm run map` writes, which
is what makes an edited dump playable. `src/sim/mapfile.ts` is the reader, and
its legend is in `npm run map`'s footer.
