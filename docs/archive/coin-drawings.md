# The coins that were not used

No Minifantasy pack has money in it, so the coin the winter screen counts
gold with is drawn by hand, in an 8x8 cell like every other icon. Six were
drawn and one was picked. The rest are here, as the character grids they
were, so redrawing one is copying it back into `COIN_PIXELS` in
`src/render/packs/minifantasy.sheets.ts` rather than starting again.

The colours are that file's `COIN_COLORS`, sampled off the trinket sheet's
own gold: `.` clear, `k` pure black outline, `w` white highlight, `l` light
(232,205,109), `g` mid (218,174,20), `d` the mid tone darkened.

**Chosen:** `oval`, six across and four tall, a coin lying at an angle. A
round coin needs seven or eight pixels to read as a circle rather than an
octagon, and at that size it sits beside a number like a plate.

**The trinket sheet's own gold bead**, tile (5,19) of
`Minifantasy_CraftingAndProfessionsTrinketIcons.png` — the gold one of the
five bead colours, in the third column of the necklace parts. Dropped
because it is four pixels across inside its cell and reads as a small square
whatever size it is drawn at. It is the pack's own art, so it is the one to
come back to if the HUD's pills ever want a quieter money marker than the
drawn coin.

**`eight`** — the first one drawn, eight across, which fills its cell and
sits beside 13px text like a plate.

```
..kkkk..
.kwllgk.
klllggdk
klllggdk
klggggdk
klggdddk
.kgdddk.
..kkkk..
```

**`six`** — the straight shrink of it. Reads as a rounded square rather than
a disc: at six pixels the silhouette is an octagon.

```
........
..kkkk..
.kwllgk.
.kllggk.
.klggdk.
.kggddk.
..kkkk..
........
```

**`five`** — quieter than the resource sprites beside it, and indistinct with
it.

```
........
........
...kkk..
..kwlgk.
..klggk.
..kggdk.
...kkk..
........
```

**`rim`** — six across, with the rim darker than the face inside it, to read
as a struck coin. The face is 2x2, which is not enough to be a face.

```
........
..kkkk..
.kggggk.
.kgwllk.
.kgllgk.
.kggggk.
..kkkk..
........
```

**`stack`** — two flat coins, one on the other. The most obviously "money"
of the six, and the strongest candidate after the oval; it is taller than it
is wide, which is what ruled it out beside a line of text.

```
........
..kkkk..
.kwllgk.
.kkkkkk.
.kwllgk.
.kggddk.
..kkkk..
........
```
