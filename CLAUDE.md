# thirtysummers

Browser prototype of a top-down resource game: collect in summer, sell and
buy in winter, a character who ages through thirty summers. Everything about
the game and the code is in `docs/`, indexed by
[docs/README.md](docs/README.md). This file is how to work on it.

## Read before

- Starting work: [docs/current/PLAN.md](docs/current/PLAN.md), then the file
  of the milestone being built.
- Changing code: [docs/architecture.md](docs/architecture.md). Its rules hold
  for every change.
- Running, testing, debugging or measuring the game:
  [docs/development.md](docs/development.md).
- Proposing or changing a mechanic: [docs/design/](docs/design/README.md) and
  [docs/archive/decided-against.md](docs/archive/decided-against.md), so a
  dropped idea does not come back as new.
- Revisiting a technical choice, or when something in the art or the
  renderer looks arbitrary:
  [docs/rationale/technical.md](docs/rationale/technical.md).

## Keeping the docs

- `docs/design/` holds settled mechanics, `docs/design/ideas.md` what is not
  decided, `docs/rationale/` the reasons, `docs/archive/` what was dropped
  with one line of why, and `docs/current/` the step being built.
- Docs hold the current state. No dated minutes and no history of ideas. Git
  has the history.
- When a milestone is accepted, delete its file and mark it done in the
  plan's table. What was learned building it goes into
  `docs/rationale/technical.md`.
- When a step ends, what it settled moves into design/, rationale/ or
  archive/, and `docs/current/` is rewritten for the next step.

## Working agreement

- Stop at the end of each milestone so it can be verified before the next
  one starts.
- Plan mode is for building a milestone once it is written into its file.
- Do not install non-npm dependencies. Ask instead. Things like Node are
  installed by hand. `npm install` for project libraries is fine.
- Measure claims about how the game looks or behaves; do not assert them.
  Drive the running game over the Chrome DevTools Protocol, read numbers
  back, and prove a check is non-vacuous by reverting the fix and watching
  it fail. `docs/development.md` says how.
- Never commit the Minifantasy art. It is a paid licence, and
  `public/assets/minifantasy/` is gitignored.
- `public/maps/*.txt` are played blind. Do not read a map file to someone
  who is about to play it, and do not describe its layout.
  `public/maps/README.md` is the safe half: which seed each came from, not
  what is in it.

## Running things

Every command that cannot be seen to stay inside the project costs Erik an
approval, so keep the work where it is visible.

- `tmp/` is the scratch space, and it is gitignored. Driver scripts, logs,
  screenshots and the headless browser profile go there, never in `/tmp` or
  a scratch directory outside the project. Nothing in `tmp/` is precious.
- Write commands whose paths are plainly in-project: relative paths as
  arguments, and no `cd` prefix, since the working directory is already the
  project root.
- Change files with the editing tools rather than `sed -i` or a heredoc. One
  named path can be checked; a shell rewrite cannot.
- Anything long-running goes in the background with its output redirected
  into `tmp/`: the dev server, the headless browser, a summer played out
  over the protocol. A five-minute summer is a background job, not a wait.
- [docs/development.md](docs/development.md) has the commands themselves.

## Brainstorms

In design work Erik wants a co-creator, not an option-picker.

- Run brainstorms outside plan mode, and touch only `docs/`.
- Open each round with a spread of ideas: ordinary ones in full, wild ones
  as one-liners at the bottom.
- Lay the options out neutrally. Your own lean goes in one list at the very
  end, never inline, and nothing is labelled "(Recommended)".
- Ask in prose. No AskUserQuestion in a brainstorm; it turns design
  questions into implementation questions.
- The design docs are the floor, not the ceiling. Decided items can be
  reopened.
- Take topics in dependency order, and close each one at "enough to build
  from". Then write the result into the docs as "Keeping the docs" says.
