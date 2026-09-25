# thirtysummers

Browser prototype of a top-down resource game: collect in summer, sell and
buy in winter, a character who ages through thirty summers. Everything about
the game and the code is in `docs/`, indexed by
[docs/README.md](docs/README.md). This file is how to work on it.

## Read before

- Starting work: [docs/current/PLAN.md](docs/current/PLAN.md), then the file
  of the milestone being built.
- Changing code: [docs/architecture.md](docs/architecture.md). Its rules apply
  to every change.
- Running, testing, debugging or measuring the game:
  [docs/development.md](docs/development.md).
- Proposing or changing a mechanic: [docs/design/](docs/design/README.md) and
  [docs/archive/decided-against.md](docs/archive/decided-against.md), so a
  dropped idea does not come back as new.
- Revisiting a technical choice, or when something in the art or the
  renderer looks arbitrary:
  [docs/rationale/technical.md](docs/rationale/technical.md).

## Keeping the docs

- `docs/design/` has settled mechanics, `docs/design/ideas.md` what is not
  decided, `docs/rationale/` the reasons, `docs/archive/` what was dropped
  with one line of why, and `docs/current/` the step being built.
- Docs describe the current state. No dated minutes and no history of ideas. Git
  has the history.
- When a milestone is accepted, delete its file and mark it done in the
  plan's table. What was learned building it goes into
  `docs/rationale/technical.md`.
- When a step ends, what it settled moves into design/, rationale/ or
  archive/, and `docs/current/` is rewritten for the next step.

## Writing the docs

Game words are defined in [docs/design/README.md](docs/design/README.md)
under *Words*. How to write the rest:

- *Hold* is not a word for an input or an action. Write *action*, *press*,
  *long press* or *keep pressed*. For containing, showing or being, use the
  plain verb: *has*, *shows*, *is*.
- *Shape* only in its literal sense: a geometric shape, or how the code is
  structured. For a design, say what changes.
- *Dehydrated*, not *dry*, for a character low on hydration. *Dry* stays
  for ground far from water.
- Put the subject first. Not "On what the game is, design/ wins" or "What
  pushes the family outward is depletion", but "design/ decides what the
  game is" and "Depletion pushes the family outward".
- One meaning per word in a passage. *Back* cannot mean both "grows back"
  and "returns to the layout" in the same paragraph.
- In design prose, explain a code name or leave it out: the rows, the
  layout, the table, a node.
- Full sentences with a verb, not strings of fragments.
- Everyday phrasing, not literary. "Even thinner", not "thinner still";
  "every kind except dense", not "all but the dense kind"; "one and a half
  times as long", not "half as long again".
- Brief is good. Too brief is when a reader needs the history or the code
  to follow a sentence.

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
  who is about to play it, and do not describe its layout. The same goes
  for a seed someone is about to play. `public/maps/README.md` is the safe
  half: how a file is made and which seed it came from, not what is in it.
- There are no map files by default. Testing is on seeds, since every seed
  gives a map that matches the table, and a dump into `public/maps/` is made only when a map is
  worth freezing: a playtest with someone else, or one kept across a change
  to the generator. Do not regenerate files after every generator change.

## Running things

Every command that cannot be seen to stay inside the project costs Erik an
approval, so keep the work where it is visible.

- `tmp/` is the scratch space, and it is gitignored. Driver scripts, logs,
  screenshots and the headless browser profile go there, never in `/tmp` or
  a scratch directory outside the project. Nothing in `tmp/` is precious.
- Images Erik is meant to look at -- mockups, screenshots to judge, side by
  side comparisons -- go in `tmp/mockups/`, always, and the reply names the
  file. Screenshots a driver takes only to check something stay in `tmp/`.
  `tmp/mockups/` is under `tmp/` on purpose: these images are made from the
  Minifantasy art and must never be committed.
- Clean up `tmp/` at the start of every new milestone, `tmp/mockups/`
  included: the last milestone's drivers, logs and images go. Keep only what
  is in use: `tmp/chrome/` while the headless browser runs, the logs of
  running processes, and `tmp/cdp.mjs`, the helper the drivers share.
- Write commands whose paths are plainly in-project: relative paths as
  arguments, and no `cd` prefix, since the working directory is already the
  project root.
- Change files with the editing tools, never with `sed -i`, a heredoc, or a
  script that rewrites a file. An edit through Edit or Write names one path
  and shows its change, so it can be checked; a shell rewrite cannot, even
  when it runs without a prompt. This applies however small the edit is -- a
  one-character change is a reason to use the editing tool, not an excuse to
  reach for `sed`. `.claude/settings.json` denies `sed -i` and `find` with
  `-exec` or `-delete`.
- Read a file with the Read tool. To search, use the Grep and Glob tools when
  the session has them, and otherwise `grep`, `find`, `ls`, `wc` or `sed -n`
  on in-project paths: `.claude/settings.json` allows those, so they cost no
  approval. Keep each one a single plain command, as below.
- One command per call, and nothing in it the harness cannot read literally.
  `$?`, other shell expansions, and several commands strung together with
  `&&` or `;` make the call unverifiable, and then it costs Erik an approval.
  So run `npm run typecheck` and `npm run test` as two calls, and never add
  `echo $?`: a failing command already fails the call. A pipe into `tail` or
  `grep` to keep the output short is fine.
- Anything long-running goes in the background with its output redirected
  into `tmp/`: the dev server, the headless browser, a summer played out
  over the protocol. A five-minute summer is a background job, not a wait.
- Never reach the network from the shell. `curl` and `wget` read outside the
  project, so the harness blocks them and it costs Erik an approval either
  way. Anything that has to fetch -- checking the dev server is up, a request
  to the debugger -- goes in a script under `tmp/` and is run with
  `node tmp/x.mjs`, which is one readable in-project command. The driver
  scripts already work this way.
- The dev server answers on `http://localhost:5173`, and only there: Vite
  binds it to `::1`, so `127.0.0.1` fails to connect. Point the drivers and
  the headless browser at `localhost`.
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
