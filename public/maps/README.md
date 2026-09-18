# Maps

Play one with `?map=f` (through `j`). **Do not read the map files before playing
them.** The whole point is that the layout is unknown when you walk into it.
This file is safe: it says where they came from, not what is in them.

Each is a dump of one seed through the generator, which lays the table of the
first five summers out itself: `npm run map -- <seed> > public/maps/<name>.txt`.
The landscape is still the generator's, with its own streams and walls taken
out; what is stamped on it is the half circle of stream round camp, the near
ring inside it, and the pockets beyond. Seeds differ in where those land and
which way round they are, so no two of these are the same walk.

They are here so a playtest can be repeated and so a map can still be edited
by hand. The file is the format, not the code: an edited dump plays exactly
the same way.

| file | seed |
|---|---|
| f | 1337 |
| g | 2026 |
| h | 31 |
| i | 555 |
| j | 808 |

`npm run map:check public/maps/*.txt` re-verifies every row of the table on
all of them. It is the thing to run after editing one by hand. `?seed=<n>`
plays a seed straight from the generator without a file at all.

The format is one character per tile, the same dump `npm run map` writes,
which is what makes an edited dump playable. `src/sim/mapfile.ts` is the
reader, and its legend is in `npm run map`'s footer.
