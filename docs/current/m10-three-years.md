# M10: the first three years

Summers 1 to 3 and the winters after them, as
[five-summers.md](five-summers.md) tells them: the map they are played on,
the winter screen with the shop opened by the family's level, the list the
player carries from winter into summer, and what the map does in between.
After this the first three years can be played end to end, and they have to
be fun before anything is added on top. The cart can be bought in winter 3,
and does nothing until M11.

**Depends on** what M8, M9 and the pack left: `world.awayAtEnd`, the resource
table in `sim/resources.ts`, the layout pass and `worldgen/rows.ts`, camp
taking every kind into `world.store`, the transfer panel, and `nextSummer`
clearing the ground. The winter prototype, `sim/winter.ts`, `sim/shop.ts`,
`ui/winter.ts`, `winter.html` and `winterPrototype.ts`, is where the screen
starts from. `YEAR_GRANTS` in `config.ts` goes, in favour of the shop.

What camp keeps is called **camp**, never "the store", in everything the
player reads; `world.store` stays the code name.

## Steps

1. **The map for three summers.** In the layout pass and its rows:
   - the near ring holds 14 fruit, 10 feathers, 6 sticks in the stand and 6
     vines in the mud pocket;
   - the ore field across the stream becomes the feather field, 30 feathers
     and 4 fruit, and no ore is placed anywhere;
   - the copse hides the shell field, 30 shells;
   - the cart route stays, for M11;
   - the dry pocket, the last pocket and its thick wall come out.

   The rows follow: summer 1 has fruit and feathers on foot, vines waded to
   and sticks behind thin thicket, and springs on both sides; summer 2 has
   feathers only across the stream; summer 3 has shells only behind the
   copse, and the cart route that needs a cut. The rows for summers 4 and 5
   go until M11 and M12 bring those places back. `public/maps/f` to `j` are
   dumped again from their seeds.
2. **The resource table.** Shells sell for 2, logs for 1. Ore stays in the
   table, unplaced, for M12. What comes back is split by place: inside the
   near ring everything is back every year, and outside it `returns` says
   what happens, with fruit and feathers by `REPLENISH_SHARE` and shells
   never. The near ring is what the camp reaches without crossing a stream,
   worked out from the map, so a hand-edited file keeps the rule.
3. **The cache goes.** It leaves the build menu, the world, the transfer
   panel and the summary, and the design keeps it in
   [../design/ideas.md](../design/ideas.md). Camp is the one place the panel
   opens until the cart.
4. **Upkeep and the family, in config.** `UPKEEP_FRUIT` 12, `UPKEEP_GOLD` 10,
   `AWAY_GOLD_CHARGE` 3, `FRUIT_BUY_PRICE` 2, `FAMILY_LEVELS` 10, 35, 80,
   140, 220.
5. **The shop by family level.** In `sim/shop.ts` each item says the level
   that unlocks it: the axe at 1 for 8 gold and 3 sticks, the cart at 2 for
   20 gold and 6 logs. `SHOP_BY_YEAR` goes. The stock is what the level at
   the start of the winter unlocks, less what is owned. What the level
   reached by the end of the winter unlocks is shown frosted with its price,
   and moves as the player buys and undoes, since buying lowers what the
   family is given. Winter 1 shows no shop, frosted or not; reaching level 1
   says the town will trade with them next winter.
6. **The winter screen in the game.** The prototype's markup moves into
   `index.html`, and `sim/winter.ts` gets its input from the world. The end
   of a summer opens the winter screen, with the summer in numbers in a
   closed section at the bottom and a link that saves the game at that
   point; next summer starts from the winter screen. Camp sells nothing, so
   the whole haul, feathers and shells included, is sold here. What the
   winter settles is applied by the world: kept material stays at camp,
   what was sold and eaten leaves it, what is left goes to the family's
   running total, and what was bought is owned. A winter that could not be
   paid makes the next summer tired.
7. **The list.** Every upkeep line, every shop item, frosted ones included,
   and the family's next level have a box on the winter screen, ticked by
   default. In winter 1, what level 1 opens has its box in the family panel,
   so the axe is on summer 2's list. The ticked lines become the list, drawn across the top of the
   screen all summer as a box per line, filled from the top: food in fruit,
   rent, then each item, its gold from what is left and its material in
   kind, then the gold toward the next level. Gold counts feathers and
   shells at their winter price, never building material, and a gold amount
   says what it is in feathers. Each box has a bar for what is collected and
   one for what is at camp, and goes once it is all at camp. Summer 1's list
   is food, rent and level 1. The list replaces the "fruit stored" readout
   and the gold count.
8. **Between summers**, in `world.nextSummer`, all seeded so a map and a
   year always come out the same:
   - replenishment, as step 2 says;
   - saplings back after `SAPLING_RETURN_YEARS`, 3, on tiles nothing now
     stands on;
   - thicket creep with `THICKET_CREEP_CHANCE` on cut tiles touching
     thicket;
   - one bridge tile lost every other winter, the tile chosen from the seed
     and the year;
   - a tired summer after missed upkeep: every hold `TIRED_HOLD_MUL`, 1.5,
     times as long, except the transfer panel's, and rough ground at
     `TIRED_DIFFICULT_SPEED_MUL`, 0.25, for that summer only.
9. **The start of a summer.** A small notice with the summer's length, and
   that it is a tired one when it is, dismissed by the first movement key.
10. **The economy on the map check.** `npm run map:check` and the layout's
   tests play the perfect player of five-summers.md over each map's nodes,
   through the winter model: summer 1's counted gold falls short of rent
   and level 1 without crossing the stream and reaches it with the bridge
   paid, winter 2 buys the axe and reaches level 2, and winter 3 buys the
   cart. The rows say by how much, so a number changed in config shows up
   as a margin.

## Verification

- The winter model over a synthetic camp gives the right gold, fruit bought
  and sold, family total and level, and what is kept is still at camp the
  next summer.
- The stock follows the level the winter began with. Buying the axe
  lowers what the family is given, and the frosted cart appears and
  disappears with level 2. Winter 1 has no shop lines at all.
- The list fills from the top: food by fruit, an item's material in kind,
  and sticks sold for gold ticking nothing. What was unticked in winter is
  not on it.
- Missed upkeep makes next summer tired, with a cut's hold and the mud speed
  read back, and only for one summer.
- Over three simulated winters on a small seeded map, with counts read back:
  the near ring full again, feathers across the stream back by about half,
  shells not back at all, saplings back in the third, thicket crept onto
  cut tiles that touch it and only those, one bridge tile gone in winter 2.
- `npm run map:check public/maps/*.txt` passes, economy rows included, on
  every regenerated map.
- Three summers and three winters on `?map=f` over the protocol, ending with
  the cart bought in winter 3 and owned in summer 4.
- Summer 1 played by hand from a fresh load, to see whether the list steers
  without saying where to go.
