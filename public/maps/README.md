# Maps

There are no map files right now, and that is on purpose. Play a seed:
`?seed=1337` lays the table of the first three summers out from the
generator itself, and every seed holds every row of that table.

Make a file when one is worth freezing:

```
npm run map -- 1337 > public/maps/f.txt     # a dump of that seed, playable
npm run map:check public/maps/f.txt         # every row, and the first three winters
```

`?map=f` then plays it. A file is worth making for a playtest with someone
else, so everyone walks the same map, or to keep a map that a change to
`sim/worldgen/layout.ts` would otherwise take away: a seed means something
new after every such change, a file does not. Nothing else needs one.

**A map file is played blind.** Whoever is about to walk it does not read it
first, and nobody describes it to them. This README is the safe half: it says
how a file is made, not what is in one. Put the seed of each file in a table
here, so a file can always be remade.

The format is one character per tile, the same dump `npm run map` writes,
which is what makes an edited dump playable: a map that plays badly can be
opened in a text editor and changed, and `map:check` says whether it still
holds the table. `src/sim/mapfile.ts` is the reader, and its legend is in
`npm run map`'s footer.
