# thirtysummers

Browser prototype of a top-down resource game: collect in summer, process in
winter, 30-summer generations, an ageing character.

- **[docs/DESIGN.md](docs/DESIGN.md)** — what the game is. Where it and the plan
  disagree, it wins.
- **[docs/PLAN.md](docs/PLAN.md)** — how it gets built: milestone status, stack,
  rules to build to. **Read this before starting work.**
- **[docs/RATIONALE.md](docs/RATIONALE.md)** — why those choices, and what was
  learned making them. Not needed to execute the plan; read it before revisiting
  a decision, or when something in the art or the renderer looks arbitrary.
- **[docs/BRAINSTORM.md](docs/BRAINSTORM.md)** — what the project is for, the
  hypothesis being tested, what is decided and what is parked. Read it before
  proposing a new system.
- **[docs/PLAYTEST.md](docs/PLAYTEST.md)** — one entry per play session. The
  discovery test's verdict comes from here, and nothing beyond it gets planned
  until there is one.

## Commands

```
npm run dev         # Vite dev server on :5173
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
npm run build
npm run map         # ASCII dump of a generated map, for eyeballing worldgen
npm run map -- 42 > public/maps/x.txt   # ...and the same dump as a playable map
npm run map:check public/maps/*.txt     # does each edited map still hold the chain?
npm run build:itch  # the zip that goes on itch.io, with the refusals that keep art out
npm run log:read <file>   # a pasted playtest record: the digest, then the route on the map
```

The art has one build step of its own. `npm run dev`, then open
http://localhost:5173/bake.html: it bakes the raw packs into
`public/assets/baked/minifantasy.tspk`, the single file the public build draws
from. Rerun it whenever the art or `minifantasy.sheets.ts` changes. Nothing on
localhost needs it -- the dev machine still cuts its textures from the raw
folders -- but `build:itch` refuses without it.

Press `` ` `` in the running game for the debug overlay: seed and regenerate
(`[` and `]` step it), a 1x–10x time scale, a tile grid, a stat freeze,
click-to-teleport, and a fixed-width readout. `window.__game` is always there to
measure from.

Useful URL params: `?map=<name>` (play `public/maps/<name>.txt` instead of a
generated world — `a` through `e` are the discovery test's maps), `?seed=<n>`,
`?pack=placeholder` (run without the paid art), `?pack=baked` (the pack the
public build uses), `?debug=1` (start with the overlay already open),
`?public=1` (behave as though this were itch.io, for checking a `vite preview`).

Controls: WASD or arrows to move, Shift to sprint, E or Space to gather, cut,
build and bank ore, F to eat, R to drink.

## Architecture rules

- **Nothing under `src/sim/` imports Pixi or touches the DOM.** That is what
  keeps the simulation unit-testable and lets the renderer change underneath it.
  Rendering only ever reads simulation state; it never writes to it.
- **Relative imports carry an explicit `.ts` extension.** The same source then
  runs under Vite, Vitest and bare `node --experimental-strip-types`.
- **`src/config.ts` holds every tunable number**, each marked `[DOC]` (from the
  design doc) or `[GUESS]` (mine, tune freely). Numbers do not belong in logic.
- The simulation runs on a **fixed 1/60s timestep** so per-second rates do not
  drift with frame rate. Anything that asks "is this moving" must read a flag the
  tick wrote, not diff positions between draws.
- **`src/env.ts` is the only file that reads the hostname.** Everything that
  differs between this machine and a stranger's -- which packs are tried, which
  map loads, whether the debug overlay is built, whether there is a start card
  and a pasteable record -- hangs off `isDevHost()`. Add a fifth difference
  there, not with a second hostname test.
- **A built bundle must contain no path back to the raw art.** `atlas.ts`
  reaches the Minifantasy loader through a dynamic import behind
  `import.meta.env.DEV`, so Rollup drops the module from a build and the sheet
  paths and tile coordinates go with it. Check with
  `grep -o "Minifantasy_" dist/assets/*.js` after a build: it must find nothing.

## Working agreement

- **Stop at the end of each milestone** so it can be verified before the next
  one starts.
- **Do not install non-npm dependencies.** Ask instead — things like Node are
  installed by hand. `npm install` for project libraries is fine.
- Claims about how the game looks or behaves should be **measured, not asserted**
  — drive the running game over the Chrome DevTools Protocol and read numbers
  back, and check a fix is non-vacuous by reverting it and watching the check
  fail.

## Playing the discovery test

`public/maps/*.txt` are played blind: **do not read a map file to someone who is
about to play it**, and do not describe its layout. `public/maps/README.md` is
the safe half — it says which seed each came from, not what is in it.

## Art licence

The Minifantasy art is a paid licence and **must not be committed**. The raw
packs live in `art/minifantasy/` -- outside `public/`, because Vite copies
`public/` into `dist/` whole -- and the file baked from them lives in
`public/assets/baked/`. Both paths are gitignored, and
`public/assets/README.md` says where to buy the packs, where to unzip them and
how to bake. The repo stays runnable without any of it via the code-drawn
placeholder pack.

**It is now a published project**, as of M7: the build goes on itch.io so a
stranger can play it. The licence's obligations therefore apply. Krishna Palacio
is credited on the start card; the link still has to be sent once the page is
up. `public/assets/README.md` keeps that list, and RATIONALE.md records what the
agreement said.