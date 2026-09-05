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

## Commands

```
npm run dev         # Vite dev server on :5173
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
npm run build
npm run map         # ASCII dump of a generated map, for eyeballing worldgen
```

Press `` ` `` in the running game for the debug overlay: seed and regenerate
(`[` and `]` step it), a 1x–10x time scale, a tile grid, a stat freeze,
click-to-teleport, and a fixed-width readout. `window.__game` is always there to
measure from.

Useful URL params: `?seed=<n>`, `?pack=placeholder` (run without the paid art),
`?debug=1` (start with the overlay already open).

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

## Working agreement

- **Stop at the end of each milestone** so it can be verified before the next
  one starts.
- **Do not install non-npm dependencies.** Ask instead — things like Node are
  installed by hand. `npm install` for project libraries is fine.
- Claims about how the game looks or behaves should be **measured, not asserted**
  — drive the running game over the Chrome DevTools Protocol and read numbers
  back, and check a fix is non-vacuous by reverting it and watching the check
  fail.

## Art licence

The Minifantasy art is a paid licence and **must not be committed**.
`public/assets/minifantasy/` is gitignored; `public/assets/README.md` says where
to buy the packs and where to unzip them. The repo stays runnable without them
via the code-drawn placeholder pack.

This is not going to be a published project. If that changes, re-read the licence
agreement and fulfil its requirements — see RATIONALE.md for what they were.