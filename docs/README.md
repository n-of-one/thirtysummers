# Docs

Everything about the game and the code. Four folders and two loose files.

| Where | What is in it |
|---|---|
| [current/](current/PLAN.md) | The step being built now, the first five summers: the plan, one file per milestone, the spec, the playtest log. |
| [design/](design/README.md) | What the game will eventually be. Global decisions, one document per aspect, and the ideas not decided yet. |
| [rationale/](rationale/) | Why. [technical.md](rationale/technical.md) for the code, the renderer and the art. [design.md](rationale/design.md) for the mechanics. |
| [archive/](archive/decided-against.md) | What we decided not to do, so it does not come back as a new idea. |
| [architecture.md](architecture.md) | How the code is shaped: the rules every change keeps, the stack, a map of the modules. |
| [development.md](development.md) | How to run, test, debug and measure the game. |

design/ decides what the game is, and wins when current/ disagrees with it.
current/ decides what gets built now, and with which numbers.

When a milestone is accepted, its file is deleted and the plan's table marks
it done. When a step ends, what it learned moves out: settled mechanics into
design/, the reasons into rationale/, anything dropped into archive/. Then
current/ is rewritten for the next step. No dated minutes are kept. Git has
the history.

## Files

- [current/PLAN.md](current/PLAN.md) is the status and order of the
  milestones, the chores, and what happens at the end of each milestone.
- [current/m10-6-stream.md](current/m10-6-stream.md),
  [current/m10-7-camp.md](current/m10-7-camp.md) and
  [current/m10-8-upkeep.md](current/m10-8-upkeep.md) are what is left of the
  changes that answer the first playtest of the first three years, built and
  played one at a time. [current/m11-cart.md](current/m11-cart.md),
  [current/m12-planks-well.md](current/m12-planks-well.md) and
  [current/m13-fruit.md](current/m13-fruit.md) wait behind them. A milestone's
  file is deleted when it is done.
- [current/five-summers.md](current/five-summers.md) is what the first five
  summers are: the story, the numbers, the family and the shop, and what the
  generator lays every map out to.
- [current/PLAYTEST.md](current/PLAYTEST.md) is the log for this step, one
  entry per play session.
- [design/README.md](design/README.md) says what the project is for and
  defines the words.
- [design/map-arc.md](design/map-arc.md), [design/summer.md](design/summer.md)
  and [design/winter.md](design/winter.md) are the game, aspect by aspect.
- [design/ideas.md](design/ideas.md) has open questions, parked ideas and
  the first design notes on spirits.
- [rationale/technical.md](rationale/technical.md) says why the code is built
  the way it is.
- [rationale/design.md](rationale/design.md) says why the mechanics are what
  they are.
- [rationale/discovery-test-playtests.md](rationale/discovery-test-playtests.md)
  is the play log the discovery test's verdict came from.
- [archive/decided-against.md](archive/decided-against.md) lists rejected
  ideas, one line of reason each.
- [archive/coin-drawings.md](archive/coin-drawings.md) keeps the coins drawn
  for the winter screen and not used, as their pixel grids.
